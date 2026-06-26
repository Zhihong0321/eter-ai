/**
 * FAQ Cache — persistent JSON-backed cache for pre-generated FAQ answers.
 *
 * Lookup normalises the incoming question (lower-case, trimmed, punctuation
 * stripped), then tries exact match first, followed by fuzzy word-overlap
 * (threshold > 70%).  The cache is loaded from faq-cache/cache.json on first
 * access and can be mutated at runtime (regenerate, mark-stale).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
/* ------------------------------------------------------------------ */
/*  Paths                                                              */
/* ------------------------------------------------------------------ */
// Use process.cwd() so paths resolve correctly in both tsx and compiled modes
const CACHE_PATH = resolve(process.cwd(), 'faq-cache', 'cache.json');
/* ------------------------------------------------------------------ */
/*  In-memory state                                                    */
/* ------------------------------------------------------------------ */
let entries = [];
let loaded = false;
let loadPromise = null;
/* ------------------------------------------------------------------ */
/*  Normalisation helpers                                              */
/* ------------------------------------------------------------------ */
/** Lower-case, collapse whitespace, strip trailing punctuation. */
function normalise(q) {
    return q
        .toLowerCase()
        .replace(/[?!.;,:'"()\-]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Split a normalised question into its content words. */
function toWords(q) {
    return normalise(q).split(' ').filter((w) => w.length > 0);
}
/**
 * Compute word-overlap ratio between two normalised questions.
 * Uses the shorter question as the denominator so that short queries
 * against long cache keys still score high when all query words match.
 */
function wordOverlap(a, b) {
    const wordsA = new Set(toWords(a));
    const wordsB = new Set(toWords(b));
    if (wordsA.size === 0 || wordsB.size === 0)
        return 0;
    let overlap = 0;
    for (const w of wordsA) {
        if (wordsB.has(w))
            overlap++;
    }
    const minSize = Math.min(wordsA.size, wordsB.size);
    return overlap / minSize;
}
/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */
async function ensureLoaded() {
    if (loaded)
        return;
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const raw = await readFile(CACHE_PATH, 'utf-8');
                entries = JSON.parse(raw);
            }
            catch {
                // Cache file missing or malformed — start with empty cache
                entries = [];
            }
            loaded = true;
        })();
    }
    return loadPromise;
}
async function persist() {
    const json = JSON.stringify(entries, null, 2) + '\n';
    await writeFile(CACHE_PATH, json, 'utf-8');
}
/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
/**
 * Look up a question in the FAQ cache.
 *
 * 1. Exact normalised match — fastest path.
 * 2. Fuzzy match — word overlap > 70%.
 *
 * Returns the matched question and answer on hit, or `null` on miss.
 */
export async function findCachedAnswer(question) {
    await ensureLoaded();
    if (entries.length === 0)
        return null;
    const normQ = normalise(question);
    // --- 1. Exact match ---
    for (const entry of entries) {
        if (entry.stale)
            continue;
        if (normalise(entry.question) === normQ) {
            return { question: entry.question, answer: entry.answer };
        }
    }
    // --- 2. Fuzzy match (> 70% word overlap) ---
    let bestEntry = null;
    let bestScore = 0;
    for (const entry of entries) {
        if (entry.stale)
            continue;
        const score = wordOverlap(normQ, normalise(entry.question));
        if (score > bestScore) {
            bestScore = score;
            bestEntry = entry;
        }
    }
    if (bestEntry !== null && bestScore > 0.7) {
        return { question: bestEntry.question, answer: bestEntry.answer };
    }
    return null;
}
/**
 * Return a summary of all cache entries (question, topic, stale flag,
 * timestamp) without exposing the full HTML answers.
 */
export async function getCacheEntries() {
    await ensureLoaded();
    return entries.map((e) => ({
        question: e.question,
        topic: e.topic,
        stale: e.stale,
        generatedAt: e.generatedAt,
    }));
}
/**
 * Re-generate a single FAQ entry by calling the LLM.
 *
 * This is a stub: it marks the entry stale and persists.  The actual LLM
 * call will be wired up once the generation pipeline is in place.  In the
 * meantime, the generate-faq script handles bulk regeneration.
 */
export async function regenerateEntry(question) {
    await ensureLoaded();
    const normQ = normalise(question);
    const idx = entries.findIndex((e) => normalise(e.question) === normQ);
    if (idx === -1) {
        throw new Error(`FAQ entry not found: "${question}"`);
    }
    // Mark stale — the generate-faq script will pick it up and regenerate
    entries[idx].stale = true;
    await persist();
    console.log(`[faq-cache] Marked stale: "${entries[idx].question}"`);
}
/**
 * Flag all entries belonging to a topic as stale.
 * Call this when a knowledge file changes so the next generate-faq run
 * refreshes the affected answers.
 */
export async function markStaleByTopic(topic) {
    await ensureLoaded();
    let count = 0;
    for (const entry of entries) {
        if (entry.topic === topic && !entry.stale) {
            entry.stale = true;
            count++;
        }
    }
    if (count > 0) {
        await persist();
        console.log(`[faq-cache] Marked ${count} entries stale for topic: "${topic}"`);
    }
}
//# sourceMappingURL=faq.js.map
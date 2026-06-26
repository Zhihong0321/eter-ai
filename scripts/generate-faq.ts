/**
 * FAQ Generation Script
 *
 * Reads all questions from faq-cache/cache.json, calls the LLM to generate
 * polished HTML answers using the component library, and writes updated
 * entries back to the cache.
 *
 * Usage:  npm run generate-faq
 *         npm run generate-faq -- --stale-only   (regenerate only stale entries)
 *         npm run generate-faq -- --topic solar-pv  (regenerate one topic)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  question: string;
  answer: string;
  topic: string;
  generatedAt: string;
  stale: boolean;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const CACHE_PATH = resolve(__dirname, '../faq-cache/cache.json');

const API_KEY: string =
  process.env.MINIMAX_API_KEY ?? process.env.LLM_API_KEY ?? '';

const BASE_URL: string =
  process.env.LLM_BASE_URL ?? 'https://api.minimax.chat/v1/text/chatcompletion_v2';

const MODEL: string =
  process.env.LLM_MODEL ?? 'MiniMax-Text-01';

/* ------------------------------------------------------------------ */
/*  Component library spec (mirrors server/knowledge/prompt.ts)        */
/* ------------------------------------------------------------------ */

const COMPONENT_SPEC = `## Component Library

You MUST output HTML using ONLY the components below.  Do NOT invent new tags, classes, or inline styles.

### Plain Text
<p>Short answer (2 sentences or less).</p>

### Section Heading
<h3 class="ans-h">Section Title</h3>

### Bulleted List
<ul class="ans-list">
  <li>First item</li>
  <li>Second item</li>
</ul>

### Callout — Info
<div class="ans-callout ans-callout--info">
  <p>Important information or key-term explanation.</p>
</div>

### Callout — Warning
<div class="ans-callout ans-callout--warn">
  <p>Warning, caution, or eligibility restriction.</p>
</div>

### Fact Card
<div class="ans-card">
  <p class="ans-card__title">Card Title</p>
  <p class="ans-card__body">Supporting detail text.</p>
</div>

### Comparison Table
<table class="ans-compare">
  <thead>
    <tr>
      <th>Feature</th>
      <th>Option A</th>
      <th>Option B</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Row label</td>
      <td>Value A</td>
      <td>Value B</td>
    </tr>
  </tbody>
</table>

### Steps / Process
<ol class="ans-steps">
  <li><strong>Step Title.</strong> Description of what happens.</li>
  <li><strong>Step Title.</strong> Description of what happens.</li>
</ol>

### Slide / Showcase
<section class="ans-slide">
  <h3 class="ans-slide__title">Headline</h3>
  <p class="ans-slide__body">Compelling paragraph with <span class="ans-slide__highlight">key highlights</span>.</p>
</section>

### Call-to-Action
<a class="ans-cta" href="https://example.com" target="_blank" rel="noopener">Get a Free Quote</a>`;

const FORMAT_RULES = `## Format Selection Rules

Choose ONE layout per answer based on the question type:

1. **Simple factual question (answer fits in 2 sentences or less)** → single <p>. Do NOT decorate.
2. **Comparing products, specs, or options** → <table class="ans-compare">.
3. **Explaining a process, sequence, or timeline** → <ol class="ans-steps">.
4. **Pitch, showcase, or "why choose us"** → <section class="ans-slide">.
5. **Highlighting a warning, eligibility rule, or key term** → <div class="ans-callout ans-callout--info"> or ans-callout--warn.
6. **Presenting a single standout fact or feature** → <div class="ans-card">.
7. **Listing items** → <ul class="ans-list">.
8. **Everything else** → <p> with minimal additional structure.

You may COMBINE components when an answer has multiple parts (e.g. a heading + a table + a callout). Always lead with the most important information.

Hard rules:
- NEVER invent CSS classes or inline styles.
- ONLY use the exact class names listed in the Component Library.
- Do NOT wrap your answer in html fences. Output raw HTML only.
- Do NOT include <html>, <head>, <body>, or <!DOCTYPE> tags.`;

/* ------------------------------------------------------------------ */
/*  Knowledge loader (reads all .md files for context)                 */
/* ------------------------------------------------------------------ */

async function loadKnowledgeContext(): Promise<string> {
  const knowledgeDir = resolve(__dirname, '../knowledge');
  const manifestPath = resolve(knowledgeDir, 'manifest.json');

  let manifest: { files: { path: string; topic: string; title: string; loadOrder: number }[] };
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
  } catch {
    return '';
  }

  const sorted = [...manifest.files].sort((a, b) => a.loadOrder - b.loadOrder);
  const sections: string[] = [];

  for (const entry of sorted) {
    try {
      const filePath = resolve(knowledgeDir, entry.path);
      const content = await readFile(filePath, 'utf-8');
      sections.push(`## [${entry.title}] (topic: ${entry.topic})\n\n${content.trim()}`);
    } catch {
      // Skip missing files
    }
  }

  return sections.join('\n\n---\n\n');
}

/* ------------------------------------------------------------------ */
/*  LLM call (non-streaming, single answer)                           */
/* ------------------------------------------------------------------ */

async function callLLM(question: string, knowledgeContext: string): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      'LLM_API_KEY is not set. Configure it in .env before running generate-faq.',
    );
  }

  const systemPrompt = [
    'You are a Solar PV Q&A assistant. Respond ONLY with constrained HTML from the Component Library below. Answer the user question accurately using the Knowledge Base provided.',
    '',
    COMPONENT_SPEC,
    '',
    FORMAT_RULES,
    '',
    '## Brand Tone',
    '',
    'You are a professional solar PV sales engineer at a Malaysian solar installation company.',
    '- Voice: Confident, knowledgeable, and genuinely helpful. Not pushy or salesy.',
    '- Sales bridge: If competitor data is missing, acknowledge it briefly, then explain why Eternalgy selected the recommended product using supported evidence and client benefits.',
    '- Recommendation framing: Internal procurement assessments may be stated as Eternalgy recommendations, but never as universal independent rankings.',
    '- Technical next step: Offer to compare the exact competing model or datasheet instead of ending with a generic quotation CTA.',
    '- Currency: Always use RM (Malaysian Ringgit).',
    '- Context: Tailor answers to Malaysian homeowners and businesses considering solar PV.',
    '- Concise: Lead with the answer, then add supporting detail only if it adds value.',
    '',
    '---',
    '',
    '## Knowledge Base',
    '',
    knowledgeContext,
  ].join('\n');

  const isAnthropicStyle = BASE_URL.includes('/anthropic') || BASE_URL.includes('/v1/messages');

  let body: string;
  let headers: Record<string, string>;

  if (isAnthropicStyle) {
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    };
    body = JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      stream: false,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    });
  } else {
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    };
    body = JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    });
  }

  const response = await fetch(BASE_URL, { method: 'POST', headers, body });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`LLM returned HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }

  const json = await response.json() as Record<string, unknown>;

  // Extract answer from response — handles OpenAI and Anthropic shapes
  let answer = '';

  // OpenAI: choices[0].message.content
  const choices = json.choices as { message?: { content?: string } }[] | undefined;
  if (choices?.[0]?.message?.content) {
    answer = choices[0].message.content;
  }

  // Anthropic: content[0].text
  if (!answer) {
    const content = json.content as { type?: string; text?: string }[] | undefined;
    if (content?.[0]?.text) {
      answer = content[0].text;
    }
  }

  if (!answer) {
    throw new Error('LLM returned no usable content in response.');
  }

  // Clean up: strip markdown code fences if the LLM wrapped output
  answer = answer
    .replace(/^```(?:html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  return answer;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  // Parse CLI flags
  const args = process.argv.slice(2);
  const staleOnly = args.includes('--stale-only');
  const topicIdx = args.indexOf('--topic');
  const filterTopic = topicIdx !== -1 ? args[topicIdx + 1] : null;

  // Load cache
  let entries: CacheEntry[];
  try {
    const raw = await readFile(CACHE_PATH, 'utf-8');
    entries = JSON.parse(raw) as CacheEntry[];
  } catch {
    console.error('Error: Could not read faq-cache/cache.json');
    console.error('Ensure the file exists with pre-seeded questions.');
    process.exit(1);
  }

  // Load knowledge context once
  console.log('\nLoading knowledge base...');
  const knowledgeContext = await loadKnowledgeContext();
  console.log(`Knowledge base loaded (${knowledgeContext.length} chars)\n`);

  // Filter entries to process
  let toProcess = entries;
  if (staleOnly) {
    toProcess = entries.filter((e) => e.stale);
  }
  if (filterTopic) {
    toProcess = toProcess.filter((e) => e.topic === filterTopic);
  }

  console.log(`Processing ${toProcess.length} of ${entries.length} FAQ entries...\n`);
  console.log('='.repeat(60));

  let success = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    const label = `[${i + 1}/${toProcess.length}]`;

    process.stdout.write(`${label} ${entry.question} ... `);

    try {
      const answer = await callLLM(entry.question, knowledgeContext);

      // Update entry in the main array
      const idx = entries.findIndex((e) => e.question === entry.question);
      if (idx !== -1) {
        entries[idx].answer = answer;
        entries[idx].generatedAt = new Date().toISOString();
        entries[idx].stale = false;
      }

      console.log('OK');
      success++;

      // Brief pause to avoid rate-limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED (${msg})`);
      failed++;
    }
  }

  // Write updated cache
  await writeFile(CACHE_PATH, JSON.stringify(entries, null, 2) + '\n', 'utf-8');

  console.log('='.repeat(60));
  console.log(`\nDone. ${success} updated, ${failed} failed.`);
  console.log(`Cache written to: ${CACHE_PATH}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

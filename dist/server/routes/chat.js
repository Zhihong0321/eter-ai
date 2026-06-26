/**
 * POST /api/chat — Chat endpoint.
 *
 * Flow:
 *   1. Validate request body.
 *   2. Check FAQ cache — on hit, return JSON immediately.
 *   3. On cache miss, call the LLM and stream the response as SSE.
 *
 * SSE format per chunk:
 *   data: {"chunk":"<text>"}\n\n
 *
 * End-of-stream sentinel:
 *   data: [DONE]\n\n
 */
import { Router } from 'express';
import { generateAnswer } from '../llm/client.js';
import { buildSystemPrompt } from '../knowledge/prompt.js';
import { findCuratedFaq } from '../knowledge/curated-faq.js';
import { findCachedAnswer } from '../cache/faq.js';
import { buildInvoicePromptContext, buildSalesConsultantWhatsAppCta, getInvoicePackageContext, InvoiceContextError, searchInvoicePackages, validateInvoiceUid, } from '../invoice/context.js';
const router = Router();
function normaliseQuestion(value) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function isElectricityBillSavingsQuestion(question) {
    const normalised = normaliseQuestion(question);
    const hasBillContext = /\b(electric|electricity|tnb|bill|tariff|energy charge|monthly charge)\b/.test(normalised);
    const hasSolarContext = /\b(solar|pv|panel|system|atap|nem)\b/.test(normalised);
    const asksForSavings = /\b(save|saves|saving|savings|saved|reduce|reduces|reduction|lower|lowers|cut|cuts|offset|offsets|eliminate|eliminates|roi|payback|return)\b/.test(normalised);
    const asksForAmount = /\b(how much|amount|estimate|estimated|estimation|monthly|annual|per month|per year|rm|ringgit|%|percent|percentage)\b/.test(normalised);
    return (hasBillContext || hasSolarContext) && asksForSavings && (asksForAmount || hasBillContext);
}
function configuredSalesConsultantWhatsAppUrl() {
    const raw = process.env.SALES_CONSULTANT_WHATSAPP_URL?.trim()
        || process.env.WHATSAPP_SALES_CONSULTANT_URL?.trim()
        || '';
    if (!raw)
        return '';
    if (/^https:\/\/wa\.me\/\d+(?:\?.*)?$/i.test(raw))
        return raw;
    return '';
}
function renderSavingsHandoffHtml(whatsAppUrl) {
    if (!whatsAppUrl) {
        return '<p>Sorry, I can’t calculate your exact savings here — the numbers depend on your actual electricity bill, roof, and usage. Please WhatsApp your sales consultant for a personalised electricity-bill savings estimate.</p>';
    }
    return [
        '<p>Sorry, I can’t give you an exact savings figure here — your real savings depend on your actual electricity bill, roof size, and daily usage.</p>',
        '<p>For an accurate, personalised estimate, please reach out to your sales consultant directly:</p>',
        buildSalesConsultantWhatsAppCta(whatsAppUrl),
    ].join('\n');
}
router.get('/api/invoices/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    try {
        const results = await searchInvoicePackages(query);
        res.json({ results });
    }
    catch (err) {
        if (err instanceof InvoiceContextError) {
            res.status(err.status).json({ error: err.message });
            return;
        }
        res.status(503).json({ error: 'Could not search invoices.' });
    }
});
/* ------------------------------------------------------------------ */
/*  Lazy system-prompt cache (rebuilds once, reuses across requests)   */
/* ------------------------------------------------------------------ */
let cachedPrompt = null;
let promptPromise = null;
async function getSystemPrompt() {
    if (cachedPrompt)
        return cachedPrompt;
    if (!promptPromise) {
        promptPromise = buildSystemPrompt().then((p) => {
            cachedPrompt = p;
            promptPromise = null;
            return p;
        });
    }
    return promptPromise;
}
/* ------------------------------------------------------------------ */
/*  POST /api/chat                                                     */
/* ------------------------------------------------------------------ */
router.post('/api/chat', async (req, res) => {
    /* ---- 1. Validate ---- */
    const message = req.body?.message;
    const rawInvoiceUid = req.body?.invoiceUid;
    if (typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ error: 'Missing or empty "message" field.' });
        return;
    }
    const question = message.trim();
    const hasInvoiceUid = typeof rawInvoiceUid === 'string' && rawInvoiceUid.trim().length > 0;
    const invoiceUid = hasInvoiceUid ? validateInvoiceUid(rawInvoiceUid) : null;
    if (hasInvoiceUid && !invoiceUid) {
        res.status(400).json({ error: 'Invalid invoice UID.' });
        return;
    }
    let invoicePromptContext = '';
    let invoiceContext = null;
    if (invoiceUid) {
        try {
            invoiceContext = await getInvoicePackageContext(invoiceUid);
            invoicePromptContext = buildInvoicePromptContext(invoiceContext);
        }
        catch (err) {
            if (err instanceof InvoiceContextError) {
                res.status(err.status).json({ error: err.message });
                return;
            }
            res.status(503).json({ error: 'Could not load invoice context.' });
            return;
        }
    }
    /* ---- 2. Electricity-bill savings handoff guard ---- */
    if (isElectricityBillSavingsQuestion(question)) {
        const whatsAppUrl = invoiceContext?.agentWhatsAppUrl || configuredSalesConsultantWhatsAppUrl();
        res.json({
            handoff: true,
            html: renderSavingsHandoffHtml(whatsAppUrl),
        });
        return;
    }
    /* ---- 3. Approved curated FAQ check ---- */
    const curated = await findCuratedFaq(question);
    // Skip curated FAQ for invoice users asking about their specific package —
    // the LLM will use the actual invoice package description instead.
    const skipCurated = curated !== null && invoiceUid && curated.intent === 'package-contents';
    if (curated !== null && !skipCurated) {
        res.json({
            curated: true,
            html: curated.html,
            intent: curated.intent,
            matchedQuestion: curated.matchedQuestion,
        });
        return;
    }
    /* ---- 4. Generated FAQ cache check ---- */
    if (!invoiceUid) {
        const cached = await findCachedAnswer(question);
        if (cached !== null) {
            res.json({ cached: true, html: cached.answer, matchedQuestion: cached.question });
            return;
        }
    }
    /* ---- 5. Stream LLM response as SSE ---- */
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
    // Flush headers immediately
    res.flushHeaders();
    let stream;
    try {
        const basePrompt = await getSystemPrompt();
        const systemPrompt = invoicePromptContext
            ? `${basePrompt}\n\n---\n\n${invoicePromptContext}`
            : basePrompt;
        stream = await generateAnswer(question, systemPrompt);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error building prompt.';
        res.write(`data: ${JSON.stringify({ chunk: `[Error] ${msg}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
    }
    /* ---- Pipe tokens → SSE ---- */
    const reader = stream.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            res.write(`data: ${JSON.stringify({ chunk: value })}\n\n`);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream read error.';
        res.write(`data: ${JSON.stringify({ chunk: `[Error] ${msg}` })}\n\n`);
    }
    finally {
        res.write('data: [DONE]\n\n');
        res.end();
    }
});
export default router;
//# sourceMappingURL=chat.js.map
/**
 * Ingestion API routes.
 *
 * All endpoints are prefixed with /api/admin/ingest and protected by authMiddleware.
 *
 *   POST /api/admin/ingest       — Convert source to Markdown, distill via AI
 *   POST /api/admin/ingest/save  — Save distilled content to knowledge base
 */
import express, { Router } from 'express';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authMiddleware } from '../middleware/auth.js';
import { convertFileToMarkdown, convertToMarkdown, } from '../ingest/markitdown.js';
import { distillContent } from '../ingest/distiller.js';
/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge');
const CATEGORIES = ['products', 'basics', 'company', 'schemes'];
/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */
const router = Router();
// All ingest routes require auth
router.use('/api/admin/ingest', authMiddleware);
/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function isValidCategory(cat) {
    return typeof cat === 'string' && CATEGORIES.includes(cat);
}
function categoryPath(cat) {
    return resolve(KNOWLEDGE_DIR, cat);
}
async function buildIngestResult(rawMarkdown, category) {
    if (!rawMarkdown.trim()) {
        throw new Error('Conversion produced empty content.');
    }
    const result = await distillContent(rawMarkdown, category);
    return {
        rawMarkdown,
        distilledMarkdown: result.distilled,
        category,
        suggestedFilename: result.suggestedFilename.endsWith('.md')
            ? result.suggestedFilename
            : `${result.suggestedFilename}.md`,
        title: result.title,
        summary: result.summary,
    };
}
/* ------------------------------------------------------------------ */
/*  POST /api/admin/ingest/file — Native local-file upload             */
/* ------------------------------------------------------------------ */
router.post('/api/admin/ingest/file', express.raw({ type: () => true, limit: '50mb' }), async (req, res) => {
    const category = req.header('x-ingest-category');
    const encodedFilename = req.header('x-file-name') ?? 'upload';
    if (!isValidCategory(category)) {
        res.status(400).json({
            error: `"category" must be one of: ${CATEGORIES.join(', ')}.`,
        });
        return;
    }
    let filename;
    try {
        filename = decodeURIComponent(encodedFilename);
    }
    catch {
        res.status(400).json({ error: 'Invalid file name.' });
        return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Upload a non-empty file.' });
        return;
    }
    try {
        const rawMarkdown = await convertFileToMarkdown(req.body, filename);
        res.json(await buildIngestResult(rawMarkdown, category));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown ingestion error.';
        res.status(502).json({ error: `File ingestion failed: ${msg}` });
    }
});
/* ------------------------------------------------------------------ */
/*  POST /api/admin/ingest — Main ingestion endpoint                   */
/* ------------------------------------------------------------------ */
router.post('/api/admin/ingest', async (req, res) => {
    const { source, content, category } = req.body ?? {};
    // ---- Validate ----
    if (source !== 'url' && source !== 'text' && source !== 'file') {
        res.status(400).json({ error: '"source" must be "url", "text", or "file".' });
        return;
    }
    if (typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: '"content" must be a non-empty string.' });
        return;
    }
    if (!isValidCategory(category)) {
        res.status(400).json({
            error: `"category" must be one of: ${CATEGORIES.join(', ')}.`,
        });
        return;
    }
    // ---- Step 1: Convert to raw Markdown ----
    let rawMarkdown;
    try {
        if (source === 'url') {
            rawMarkdown = await convertToMarkdown(content.trim(), 'url');
        }
        else if (source === 'file') {
            res.status(400).json({
                error: 'File uploads must use the binary /api/admin/ingest/file endpoint.',
            });
            return;
        }
        else {
            // source === 'text' — treat content as raw text/HTML
            const trimmed = content.trim();
            if (trimmed.startsWith('<') && trimmed.includes('>')) {
                rawMarkdown = await convertToMarkdown(trimmed, 'file');
            }
            else {
                rawMarkdown = trimmed;
            }
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown conversion error.';
        res.status(502).json({ error: `Content conversion failed: ${msg}` });
        return;
    }
    try {
        res.json(await buildIngestResult(rawMarkdown, category));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown distillation error.';
        res.status(502).json({ error: `AI distillation failed: ${msg}` });
    }
});
/* ------------------------------------------------------------------ */
/*  POST /api/admin/ingest/save — Save distilled content               */
/* ------------------------------------------------------------------ */
router.post('/api/admin/ingest/save', async (req, res) => {
    const { category, filename, title, summary, content } = req.body ?? {};
    // ---- Validate ----
    if (!isValidCategory(category)) {
        res.status(400).json({
            error: `"category" must be one of: ${CATEGORIES.join(', ')}.`,
        });
        return;
    }
    if (typeof filename !== 'string' || !filename.trim()) {
        res.status(400).json({ error: '"filename" is required.' });
        return;
    }
    if (typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: '"content" must be a non-empty string.' });
        return;
    }
    // Ensure filename ends with .md
    const safeFilename = filename.trim().endsWith('.md')
        ? filename.trim()
        : `${filename.trim()}.md`;
    // Prevent path traversal
    const catDir = categoryPath(category);
    const filePath = resolve(catDir, safeFilename);
    if (!filePath.startsWith(catDir)) {
        res.status(400).json({ error: 'Invalid filename.' });
        return;
    }
    // ---- Build the file content with front matter ----
    let fileBody = '';
    if (typeof title === 'string' && title.trim()) {
        // Prepend the title as an H1 if the content doesn't already start with one
        if (!content.trimStart().startsWith('# ')) {
            fileBody = `# ${title.trim()}\n\n`;
        }
    }
    fileBody += content;
    // ---- Save ----
    try {
        await mkdir(catDir, { recursive: true });
        // Check if file already exists (warn but allow overwrite)
        let existed = false;
        try {
            await stat(filePath);
            existed = true;
        }
        catch {
            // File doesn't exist — good
        }
        await writeFile(filePath, fileBody, 'utf-8');
        // Rebuild manifest with custom metadata
        const manifestPath = resolve(KNOWLEDGE_DIR, 'manifest.json');
        let manifest;
        try {
            const raw = await readFile(manifestPath, 'utf-8');
            manifest = JSON.parse(raw);
        }
        catch {
            manifest = { files: [] };
        }
        const relativePath = `${category}/${safeFilename}`;
        const topic = safeFilename.replace(/\.md$/, '');
        // Remove existing entry for this path
        manifest.files = manifest.files.filter((f) => f.path !== relativePath);
        // Token estimate
        const wordCount = fileBody.split(/\s+/).filter(Boolean).length;
        const tokens = Math.round(wordCount / 0.75);
        // Find max loadOrder
        const maxOrder = manifest.files.reduce((max, f) => Math.max(max, f.loadOrder), 0);
        manifest.files.push({
            path: relativePath,
            topic,
            title: typeof title === 'string' && title.trim()
                ? title.trim()
                : topic
                    .split('-')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' '),
            summary: typeof summary === 'string' ? summary : '',
            tokens,
            loadOrder: maxOrder + 10,
        });
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
        res.json({
            status: 'ok',
            path: relativePath,
            overwritten: existed,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error.';
        res.status(500).json({ error: `Failed to save file: ${msg}` });
    }
});
export default router;
//# sourceMappingURL=ingest.js.map
/**
 * Admin API routes.
 *
 * All endpoints are prefixed with /api/admin and protected by authMiddleware.
 *
 *   GET    /api/admin/knowledge                    — list all files (manifest)
 *   GET    /api/admin/knowledge/:category/:file    — read file content
 *   PUT    /api/admin/knowledge/:category/:file    — save file, rebuild manifest
 *   POST   /api/admin/knowledge/:category          — create new file
 *   DELETE /api/admin/knowledge/:category/:file    — delete file, rebuild manifest
 *   GET    /api/admin/manifest                     — raw manifest.json
 *   GET    /api/admin/tokens                       — total + per-file token counts
 *   GET    /api/admin/cache                        — FAQ cache entries
 *   POST   /api/admin/cache/regenerate             — mark all cache entries stale
 *   POST   /api/admin/login                        — verify password
 */

import { Router, type Request, type Response } from 'express';
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authMiddleware } from '../middleware/auth.js';
import { buildManifest } from '../knowledge/manifest.js';
import { getCacheEntries, markStaleByTopic } from '../cache/faq.js';

// Use process.cwd() so paths resolve correctly in both tsx and compiled modes
const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge');
const MANIFEST_PATH = resolve(KNOWLEDGE_DIR, 'manifest.json');

const CATEGORIES = ['products', 'schemes', 'company', 'basics'] as const;
type Category = (typeof CATEGORIES)[number];

const router = Router();

/* ------------------------------------------------------------------ */
/*  Login (no auth required)                                           */
/* ------------------------------------------------------------------ */

router.post('/api/admin/login', (_req: Request, res: Response) => {
  // Password auth disabled — always allow login
  res.json({ status: 'ok' });
});

/* ------------------------------------------------------------------ */
/*  All routes below require auth                                      */
/* ------------------------------------------------------------------ */

router.use('/api/admin', authMiddleware);

/* ---- Validate category ---- */

function isValidCategory(cat: string): cat is Category {
  return (CATEGORIES as readonly string[]).includes(cat);
}

function categoryPath(cat: string): string {
  return resolve(KNOWLEDGE_DIR, cat);
}

/* ------------------------------------------------------------------ */
/*  GET /api/admin/knowledge — list all files                          */
/* ------------------------------------------------------------------ */

router.get('/api/admin/knowledge', async (_req: Request, res: Response) => {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(raw);
    res.json(manifest.files);
  } catch {
    res.json([]);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/admin/manifest — raw manifest                             */
/* ------------------------------------------------------------------ */

router.get('/api/admin/manifest', async (_req: Request, res: Response) => {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    res.json(JSON.parse(raw));
  } catch {
    res.json({ files: [] });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/admin/tokens — token budget breakdown                     */
/* ------------------------------------------------------------------ */

router.get('/api/admin/tokens', async (_req: Request, res: Response) => {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(raw);
    const files = manifest.files.map((f: { path: string; tokens: number }) => ({
      path: f.path,
      tokens: f.tokens,
    }));
    const total = files.reduce(
      (sum: number, f: { path: string; tokens: number }) => sum + f.tokens,
      0,
    );
    res.json({ total, files });
  } catch {
    res.json({ total: 0, files: [] });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/admin/cache — FAQ cache entries                           */
/* ------------------------------------------------------------------ */

router.get('/api/admin/cache', async (_req: Request, res: Response) => {
  try {
    const entries = await getCacheEntries();
    res.json(entries);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/admin/cache/regenerate — mark all stale                  */
/* ------------------------------------------------------------------ */

router.post('/api/admin/cache/regenerate', async (_req: Request, res: Response) => {
  try {
    const entries = await getCacheEntries();
    // Mark all entries stale by calling markStaleByTopic for each unique topic
    const topics = [...new Set(entries.map((e) => e.topic))];
    let staleCount = 0;
    for (const topic of topics) {
      // Count before marking
      const before = entries.filter((e) => e.topic === topic && !e.stale).length;
      await markStaleByTopic(topic);
      staleCount += before;
    }
    res.json({ staleCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/admin/knowledge/:category/:file — read file               */
/* ------------------------------------------------------------------ */

router.get(
  '/api/admin/knowledge/:category/:file',
  async (req: Request, res: Response) => {
    const { category, file } = req.params;

    if (!isValidCategory(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    const filePath = resolve(categoryPath(category), file);

    // Prevent path traversal
    if (!filePath.startsWith(categoryPath(category))) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      res.json({ content });
    } catch {
      res.status(404).json({ error: 'File not found.' });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  PUT /api/admin/knowledge/:category/:file — save file               */
/* ------------------------------------------------------------------ */

router.put(
  '/api/admin/knowledge/:category/:file',
  async (req: Request, res: Response) => {
    const { category, file } = req.params;
    const { content } = req.body;

    if (!isValidCategory(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Missing "content" in request body.' });
      return;
    }

    const catDir = categoryPath(category);
    const filePath = resolve(catDir, file);

    if (!filePath.startsWith(catDir)) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }

    try {
      await mkdir(catDir, { recursive: true });
      await writeFile(filePath, content, 'utf-8');
      await buildManifest();

      // Derive topic from filename for cache invalidation
      const topic = file.replace(/\.md$/, '');
      await markStaleByTopic(topic).catch(() => {});

      res.json({ status: 'ok' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  POST /api/admin/knowledge/:category — create new file              */
/* ------------------------------------------------------------------ */

router.post(
  '/api/admin/knowledge/:category',
  async (req: Request, res: Response) => {
    const { category } = req.params;
    const { filename, title, summary, content } = req.body;

    if (!isValidCategory(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    if (typeof filename !== 'string' || !filename.endsWith('.md')) {
      res.status(400).json({ error: 'Filename must end with .md' });
      return;
    }

    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Missing "content" in request body.' });
      return;
    }

    const catDir = categoryPath(category);
    const filePath = resolve(catDir, filename);

    if (!filePath.startsWith(catDir)) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }

    try {
      // Check file doesn't already exist
      try {
        await stat(filePath);
        res.status(409).json({ error: 'File already exists.' });
        return;
      } catch {
        // Good — file doesn't exist
      }

      await mkdir(catDir, { recursive: true });
      await writeFile(filePath, content, 'utf-8');

      // Update manifest with custom metadata if provided
      if (title || summary) {
        const raw = await readFile(MANIFEST_PATH, 'utf-8').catch(() => '{"files":[]}');
        const manifest = JSON.parse(raw);
        const path = `${category}/${filename}`;
        const topic = filename.replace(/\.md$/, '');

        // Remove existing entry for this path if present
        manifest.files = manifest.files.filter(
          (f: { path: string }) => f.path !== path,
        );

        // Estimate tokens
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const tokens = Math.round(wordCount / 0.75);

        // Find max loadOrder
        const maxOrder = manifest.files.reduce(
          (max: number, f: { loadOrder: number }) => Math.max(max, f.loadOrder),
          0,
        );

        manifest.files.push({
          path,
          topic,
          title: title ?? topic.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          summary: summary ?? '',
          tokens,
          loadOrder: maxOrder + 10,
        });

        await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
      } else {
        await buildManifest();
      }

      res.status(201).json({ status: 'ok' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  DELETE /api/admin/knowledge/:category/:file — delete file          */
/* ------------------------------------------------------------------ */

router.delete(
  '/api/admin/knowledge/:category/:file',
  async (req: Request, res: Response) => {
    const { category, file } = req.params;

    if (!isValidCategory(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    const catDir = categoryPath(category);
    const filePath = resolve(catDir, file);

    if (!filePath.startsWith(catDir)) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }

    try {
      await unlink(filePath);

      // Derive topic before rebuilding manifest
      const topic = file.replace(/\.md$/, '');
      await buildManifest();
      await markStaleByTopic(topic).catch(() => {});

      res.json({ status: 'ok' });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  GET /api/admin/settings — get current LLM config                   */
/* ------------------------------------------------------------------ */

router.get('/api/admin/settings', (_req: Request, res: Response) => {
  res.json({
    LLM_API_KEY: process.env.CHATBOT_API_KEY ?? process.env.LLM_API_KEY ?? process.env.MINIMAX_API_KEY ?? '',
    LLM_MODEL: process.env.CHATBOT_MODEL ?? process.env.LLM_MODEL ?? '',
    LLM_BASE_URL: process.env.CHATBOT_BASE_URL ?? process.env.LLM_BASE_URL ?? '',
  });
});

/* ------------------------------------------------------------------ */
/*  POST /api/admin/settings — update LLM config                       */
/* ------------------------------------------------------------------ */

router.post('/api/admin/settings', async (req: Request, res: Response) => {
  const { LLM_API_KEY, LLM_MODEL, LLM_BASE_URL } = req.body;

  if (LLM_API_KEY !== undefined) process.env.CHATBOT_API_KEY = LLM_API_KEY;
  if (LLM_MODEL !== undefined) process.env.CHATBOT_MODEL = LLM_MODEL;
  if (LLM_BASE_URL !== undefined) process.env.CHATBOT_BASE_URL = LLM_BASE_URL;

  try {
    const envPath = resolve(process.cwd(), '.env');
    let envContent = '';
    try {
      envContent = await readFile(envPath, 'utf-8');
    } catch {
      // File doesn't exist, create it
    }

    const lines = envContent.split('\n');
    const updateLine = (key: string, value: string) => {
      const idx = lines.findIndex(l => l.startsWith(`${key}=`));
      if (idx !== -1) {
        lines[idx] = `${key}=${value}`;
      } else {
        lines.push(`${key}=${value}`);
      }
    };

    if (LLM_API_KEY !== undefined) updateLine('CHATBOT_API_KEY', LLM_API_KEY);
    if (LLM_MODEL !== undefined) updateLine('CHATBOT_MODEL', LLM_MODEL);
    if (LLM_BASE_URL !== undefined) updateLine('CHATBOT_BASE_URL', LLM_BASE_URL);

    await writeFile(envPath, lines.join('\n').trim() + '\n', 'utf-8');

    res.json({ status: 'ok' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;

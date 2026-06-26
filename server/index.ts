/**
 * Solar PV Q&A — Express Server Entry Point
 *
 * Development:  tsx watch server/index.ts  (API only; Vite serves frontend)
 * Production:   node dist/server/index.js  (serves API + static frontend)
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chatRouter from './routes/chat.js';
import adminRouter from './routes/admin.js';
import ingestRouter from './routes/ingest.js';
import feedbackRouter from './routes/feedback.js';
import { buildManifest, getTotalTokens } from './knowledge/manifest.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect production mode: when the compiled .js file is running
 * (as opposed to tsx executing the .ts source directly).
 */
const isProduction = __filename.endsWith('.js');

const app = express();
const PORT = parseInt(process.env.PORT ?? '5782', 10);

/* ------------------------------------------------------------------ */
/*  Middleware                                                          */
/* ------------------------------------------------------------------ */

app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------------ */
/*  Health check                                                        */
/* ------------------------------------------------------------------ */

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const tokens = await getTotalTokens();
    res.json({ status: 'ok', tokens });
  } catch {
    res.json({ status: 'ok', tokens: 0 });
  }
});

/* ------------------------------------------------------------------ */
/*  API routes                                                          */
/*  Routes define their own full paths (/api/chat, /api/admin/...)     */
/* ------------------------------------------------------------------ */

app.use(chatRouter);
app.use(feedbackRouter);
app.use(adminRouter);
app.use(ingestRouter);

/* ------------------------------------------------------------------ */
/*  Static files & SPA fallback (production only)                       */
/*  In development, Vite serves the frontend on port 5173 and proxies  */
/*  /api requests to this server via the vite.config.ts proxy setting. */
/* ------------------------------------------------------------------ */

if (isProduction) {
  // dist/ sits one level above the compiled server/ directory
  const DIST_DIR = resolve(__dirname, '..');

  app.use(express.static(DIST_DIR));

  // SPA fallback — send index.html for any non-API, non-static route
  // so the client-side router can handle /admin and other paths.
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(resolve(DIST_DIR, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Error handling middleware                                            */
/*  Must have 4 parameters for Express to recognise it as error handler */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

/* ------------------------------------------------------------------ */
/*  Startup                                                             */
/* ------------------------------------------------------------------ */

async function start(): Promise<void> {
  // 1. Build / refresh the knowledge manifest
  await buildManifest();
  console.log('[server] Knowledge manifest built.');

  // 2. Token budget summary
  const totalTokens = await getTotalTokens();
  console.log(`[server] Token budget: ${totalTokens} tokens used`);

  if (totalTokens > 35000) {
    console.warn(
      `[server] WARNING: Token count (${totalTokens}) exceeds 35k budget. ` +
        'Consider trimming knowledge files or running: npm run check-budget',
    );
  }

  // 3. Start listening
  app.listen(PORT, () => {
    console.log(`[server] Running on http://localhost:${PORT}`);
    if (!isProduction) {
      console.log(
        '[server] Development mode — Vite handles the frontend (default http://localhost:5173)',
      );
    }
  });
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});

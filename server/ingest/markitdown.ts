/**
 * markitdown CLI wrapper.
 *
 * Converts URLs or raw HTML to Markdown using the Python `markitdown` package.
 * For YouTube URLs, passes them directly (markitdown handles transcript extraction).
 * For regular URLs, fetches the page HTML first, then pipes it to markitdown.
 */

import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ConvertSource = 'file' | 'url';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Regex patterns that identify YouTube video URLs. */
const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\//,
  /^https?:\/\/youtu\.be\//,
  /^https?:\/\/(www\.)?youtube\.com\/live\//,
];

function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some((pattern) => pattern.test(url));
}

/** Run a command and return stdout. Rejects on non-zero exit. */
function execPromise(
  command: string,
  args: string[],
  options: { timeout?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout ?? 120_000; // 2 minutes default

    const child = execFile(
      command,
      args,
      {
        timeout,
        maxBuffer: 50 * 1024 * 1024, // 50 MB
        encoding: 'utf-8',
        shell: process.platform === 'win32', // needed on Windows
      },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr?.trim() || error.message;
          reject(new Error(`markitdown failed: ${msg}`));
          return;
        }
        resolve(stdout);
      },
    );

    // Safety: ensure child process is killed if parent exits
    if (child.pid) {
      child.unref();
    }
  });
}

/**
 * Fetch a URL and return the response body as text.
 * Sets a realistic User-Agent to avoid bot blocks.
 */
async function fetchPageHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Write HTML content to a temporary file, run markitdown on it, then clean up.
 */
async function markitdownFromHtml(html: string): Promise<string> {
  const tmpFile = resolve(tmpdir(), `markitdown-${randomBytes(8).toString('hex')}.html`);

  try {
    await writeFile(tmpFile, html, 'utf-8');
    const output = await execPromise('python', ['-m', 'markitdown', tmpFile]);
    return output;
  } finally {
    await unlink(tmpFile).catch(() => {
      // Best-effort cleanup
    });
  }
}

/**
 * Write an uploaded binary file to a temporary path with its original
 * extension, then let MarkItDown inspect the actual file bytes.
 */
export async function convertFileToMarkdown(
  bytes: Buffer,
  originalFilename: string,
): Promise<string> {
  if (!bytes.length) {
    throw new Error('Empty file provided for conversion.');
  }

  const safeName = basename(originalFilename || 'upload')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-180);
  const extension = extname(safeName).slice(0, 16);
  const tmpFile = resolve(
    tmpdir(),
    `markitdown-${randomBytes(8).toString('hex')}${extension}`,
  );

  try {
    await writeFile(tmpFile, bytes);
    return await execPromise('python', ['-m', 'markitdown', tmpFile]);
  } finally {
    await unlink(tmpFile).catch(() => {
      // Best-effort cleanup
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Convert a source to Markdown using the markitdown CLI.
 *
 * @param source - A URL string or HTML content (when type is "file").
 * @param type   - "url" to fetch and convert, "file" to treat source as raw HTML.
 * @returns The raw Markdown output from markitdown.
 */
export async function convertToMarkdown(
  source: string,
  type: ConvertSource,
): Promise<string> {
  if (type === 'file') {
    // Source is raw HTML content — write to temp file and run markitdown
    if (!source.trim()) {
      throw new Error('Empty content provided for conversion.');
    }
    return markitdownFromHtml(source);
  }

  // type === 'url'
  const url = source.trim();
  if (!url) {
    throw new Error('Empty URL provided.');
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (isYouTubeUrl(url)) {
    // YouTube: pass URL directly to markitdown (it handles transcript extraction)
    const output = await execPromise('python', ['-m', 'markitdown', url], {
      timeout: 180_000, // YouTube transcripts can take longer
    });
    return output;
  }

  // Regular URL: fetch HTML, then run markitdown on it
  const html = await fetchPageHtml(url);
  return markitdownFromHtml(html);
}

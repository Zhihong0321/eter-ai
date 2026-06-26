import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';

interface ManifestEntry {
  path: string;
  topic: string;
  title: string;
  summary: string;
  tokens: number;
  loadOrder: number;
}

interface Manifest {
  files: ManifestEntry[];
}

// Use process.cwd() so paths resolve correctly in both tsx and compiled modes
const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge');
const MANIFEST_PATH = resolve(KNOWLEDGE_DIR, 'manifest.json');

function estimateTokens(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.round(wordCount / 0.75);
}

function generateTopic(filePath: string): string {
  const basename = filePath.replace(/\.md$/, '').split(/[/\\]/).pop() ?? '';
  return basename;
}

function generateTitle(filePath: string): string {
  const basename = filePath.replace(/\.md$/, '').split(/[/\\]/).pop() ?? '';
  return basename
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function scanMarkdownFiles(dir: string, base: string = ''): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const sub = await scanMarkdownFiles(fullPath, relativePath);
      results.push(...sub);
    } else if (entry.isFile() && extname(entry.name) === '.md') {
      results.push(relativePath);
    }
  }

  return results;
}

export async function buildManifest(): Promise<void> {
  const mdFiles = await scanMarkdownFiles(KNOWLEDGE_DIR);

  let existing: Manifest = { files: [] };
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // manifest doesn't exist yet, start fresh
  }

  const existingMap = new Map(existing.files.map(f => [f.path, f]));

  const entries: ManifestEntry[] = [];
  let order = 10;

  for (const filePath of mdFiles) {
    const content = await readFile(resolve(KNOWLEDGE_DIR, filePath), 'utf-8');
    const tokens = estimateTokens(content);
    const prev = existingMap.get(filePath);

    entries.push({
      path: filePath,
      topic: prev?.topic ?? generateTopic(filePath),
      title: prev?.title ?? generateTitle(filePath),
      summary: prev?.summary ?? '',
      tokens,
      loadOrder: prev?.loadOrder ?? order,
    });

    order += 10;
  }

  const manifest: Manifest = { files: entries };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

export async function getTotalTokens(): Promise<number> {
  let manifest: Manifest;
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(raw);
  } catch {
    return 0;
  }

  return manifest.files.reduce((sum, f) => sum + f.tokens, 0);
}

// Run buildManifest only when executed directly as a script (not when imported).
// The server calls buildManifest() explicitly in its startup sequence.
const isDirectExecution =
  process.argv[1]?.endsWith('manifest.ts') ||
  process.argv[1]?.endsWith('manifest.js');

if (isDirectExecution) {
  buildManifest().then(() => {
    console.log('manifest.json updated successfully.');
  }).catch(err => {
    console.error('Failed to build manifest:', err);
    process.exit(1);
  });
}

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCuratedFaq } from './curated-faq.js';

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

export async function buildKnowledgeContext(): Promise<string> {
  const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  const sorted = [...manifest.files].sort((a, b) => a.loadOrder - b.loadOrder);

  const sections: string[] = [];

  for (const entry of sorted) {
    const filePath = resolve(KNOWLEDGE_DIR, entry.path);
    const content = await readFile(filePath, 'utf-8');
    const header = `## [${entry.title}] (topic: ${entry.topic})`;

    if (entry.path.startsWith('faq/')) {
      const faq = parseCuratedFaq(content);
      sections.push([
        header,
        '',
        `Common client questions: ${faq.questions.join(' | ')}`,
        '',
        faq.answer,
      ].join('\n'));
      continue;
    }

    sections.push(`${header}\n\n${content.trim()}`);
  }

  return sections.join('\n\n---\n\n');
}

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const MANIFEST_PATH = resolve(__dirname, '../knowledge/manifest.json');
const TOKEN_BUDGET = 35000;

async function main(): Promise<void> {
  let manifest: Manifest;
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (err) {
    console.error('Error: Could not read knowledge/manifest.json');
    console.error('Run the manifest builder first to generate it.');
    process.exit(1);
  }

  const files = [...manifest.files].sort((a, b) => a.loadOrder - b.loadOrder);
  const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);

  console.log('\nKnowledge Token Budget Report');
  console.log('='.repeat(60));
  console.log(
    'File'.padEnd(40) +
    'Topic'.padEnd(25) +
    'Tokens'.padStart(10)
  );
  console.log('-'.repeat(60));

  for (const file of files) {
    console.log(
      file.path.padEnd(40) +
      file.topic.padEnd(25) +
      String(file.tokens).padStart(10)
    );
  }

  console.log('-'.repeat(60));
  console.log(
    'TOTAL'.padEnd(65) +
    String(totalTokens).padStart(10)
  );
  console.log('='.repeat(60));

  if (totalTokens > TOKEN_BUDGET) {
    console.error(
      `\nWARNING: Total tokens (${totalTokens}) exceed budget of ${TOKEN_BUDGET} tokens.`
    );
    console.error(
      'Consider removing or trimming knowledge files to stay within budget.\n'
    );
    process.exit(1);
  } else {
    console.log(
      `\nOK: Total tokens (${totalTokens}) are within the ${TOKEN_BUDGET} token budget.`
    );
    console.log(
      `Remaining capacity: ${TOKEN_BUDGET - totalTokens} tokens.\n`
    );
  }
}

main();

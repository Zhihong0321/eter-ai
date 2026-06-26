/**
 * AI distillation logic for ingested content.
 *
 * Uses the `claude code` CLI to distill raw Markdown content into a clean,
 * structured knowledge-base article via the local Claude Code installation.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';

/** Path to the claude-code CLI (3p / third-party provider build) */
const CLAUDE_CLI = 'C:\\Users\\Eternalgy\\AppData\\Local\\Claude-3p\\claude-code\\2.1.181\\claude.exe';

/** Path to Hermes vault for API key retrieval */
const VAULT_PATH = 'C:\\Users\\Eternalgy\\.hermes\\vault.json';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DistillResult {
  distilled: string;
  suggestedFilename: string;
  title: string;
  summary: string;
}

/* ------------------------------------------------------------------ */
/*  Category schema (injected into the distillation prompt)            */
/* ------------------------------------------------------------------ */

const CATEGORY_SCHEMA = `## Knowledge Base Categories

### products/
Solar panels, inverters, batteries, mounting systems, and other equipment.
Structure: Product name as title, then specs, features, advantages, warranty info.
Use comparison tables when multiple products are mentioned.

### basics/
General solar PV knowledge — how solar works, technical concepts, system components, maintenance, sizing.
Structure: Clear explanations with headings, step-by-step processes, FAQs.

### company/
Eternalgy company information — services, team, certifications, projects, testimonials, financing options.
Structure: Professional but approachable, highlight USPs, include CTAs where appropriate.

### schemes/
Malaysian government schemes, NEM, SelCo, financing, incentives, application processes.
Structure: Eligibility criteria, step-by-step application, savings calculations, important deadlines.`;

/* ------------------------------------------------------------------ */
/*  Prompt builders                                                    */
/* ------------------------------------------------------------------ */

/**
 * Build the system prompt for distillation.
 * The raw content is passed as the "user message" — the system prompt
 * sets the rules and expected output format.
 */
function buildDistillSystemPrompt(category: string): string {
  return `You are a content distillation assistant for a Malaysian solar PV company's knowledge base.

Your job is to read raw content extracted from a web page or document and produce a clean, well-structured Markdown article for the "${category}" category.

${CATEGORY_SCHEMA}

## Output Format

You MUST respond with EXACTLY this structure (use the delimiters exactly):

---FILENAME---
<kebab-case-filename-without-extension>
---TITLE---
<Descriptive title for the article>
---SUMMARY---
<1-2 sentence summary of the key information>
---CONTENT---
<The full Markdown article body>

## Distillation Rules

1. **Relevance filter:** Only include information relevant to the "${category}" category. Ignore unrelated content (ads, navigation, footers, unrelated topics).
2. **Factual only:** Do not invent, embellish, or add information that is not in the source content.
3. **Structure:** Use appropriate Markdown formatting — headings (##, ###), bullet lists, numbered lists, tables where useful, bold for key terms.
4. **Clean up:** Remove boilerplate, repeated headers/footers, cookie notices, and other web page noise.
5. **Concise:** Be thorough but not verbose. Consolidate redundant points.
6. **Malaysian context:** Keep prices in RM, retain Malaysian-specific details (e.g., ST eligibility, NEM rules).
7. **Filename:** Suggest a short, descriptive kebab-case filename (without .md extension). Example: "jinko-tiger-neo-3" or "nem-3-application-guide".
8. **If the content does not fit the "${category}" category at all**, still output the structure but set the CONTENT section to a brief note explaining why it does not fit, and suggest a more appropriate category.`;
}

/* ------------------------------------------------------------------ */
/*  Response parser                                                    */
/* ------------------------------------------------------------------ */

interface ParsedResponse {
  suggestedFilename: string;
  title: string;
  summary: string;
  content: string;
}

/**
 * Parse the LLM's structured response.
 * Expects delimiters: ---FILENAME---, ---TITLE---, ---SUMMARY---, ---CONTENT---
 */
function parseDistillResponse(raw: string): ParsedResponse {
  const extract = (marker: string, nextMarker: string | null): string => {
    const startIdx = raw.indexOf(`---${marker}---`);
    if (startIdx === -1) return '';

    const contentStart = startIdx + `---${marker}---`.length;
    let contentEnd: number;

    if (nextMarker) {
      const nextIdx = raw.indexOf(`---${nextMarker}---`, contentStart);
      contentEnd = nextIdx !== -1 ? nextIdx : raw.length;
    } else {
      contentEnd = raw.length;
    }

    return raw.slice(contentStart, contentEnd).trim();
  };

  const suggestedFilename = extract('FILENAME', 'TITLE');
  const title = extract('TITLE', 'SUMMARY');
  const summary = extract('SUMMARY', 'CONTENT');
  const content = extract('CONTENT', null);

  // Fallback: if parsing completely fails, treat the whole response as content
  if (!content && !title) {
    return {
      suggestedFilename: 'untitled',
      title: 'Untitled Article',
      summary: '',
      content: raw.trim(),
    };
  }

  return {
    suggestedFilename: sanitizeFilename(suggestedFilename) || 'untitled',
    title: title || 'Untitled Article',
    summary: summary || '',
    content: content || '',
  };
}

/**
 * Sanitize a filename: lowercase, replace spaces/special chars with hyphens,
 * collapse multiple hyphens, strip leading/trailing hyphens.
 */
function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.md$/i, '') // strip .md if present
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80); // reasonable length cap
}

/* ------------------------------------------------------------------ */
/*  Vault access                                                        */
/* ------------------------------------------------------------------ */

interface VaultEntry {
  id: string;
  type: string;
  subtype: string;
  credential: string;
  remark?: string;
}

interface Vault {
  credentials: VaultEntry[];
}

async function getApiKeyFromVault(): Promise<{ key: string; baseUrl: string }> {
  let vaultData: string;
  try {
    vaultData = await readFile(VAULT_PATH, 'utf-8');
  } catch {
    throw new Error(`Hermes vault not found at ${VAULT_PATH}.`);
  }

  let vault: Vault;
  try {
    vault = JSON.parse(vaultData);
  } catch {
    throw new Error('Vault file is not valid JSON.');
  }

  // Find the primary MiniMax API key
  const minimaxEntry = vault.credentials.find(
    (c) => c.id === 'minimax' && c.type === 'api key',
  );

  if (!minimaxEntry?.credential) {
    throw new Error('MiniMax API key not found in Hermes vault.');
  }

  // Extract base URL from the remark if present
  let baseUrl = 'https://api.minimax.io/anthropic';
  if (minimaxEntry.remark) {
    const urlMatch = minimaxEntry.remark.match(/base\s+(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      baseUrl = urlMatch[1].replace(/\.chatcompletion_v2/, '/anthropic');
    }
  }

  return { key: minimaxEntry.credential, baseUrl };
}

/* ------------------------------------------------------------------ */
/*  Claude Code CLI execution                                            */
/* ------------------------------------------------------------------ */

function execPromise(
  command: string,
  args: string[],
  env: Record<string, string>,
  stdin: string,
  options: { timeout?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout ?? 120_000;

    const child = execFile(
      command,
      args,
      {
        env: { ...process.env, ...env },
        timeout,
        maxBuffer: 50 * 1024 * 1024,
        shell: false,
      },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr?.trim() || error.message;
          reject(new Error(`claude code failed: ${msg}`));
          return;
        }
        resolve(stdout);
      },
    );

    // Large source documents must not be passed as a Windows command-line
    // argument (which triggers spawn ENAMETOOLONG). Claude's print mode reads
    // the prompt from stdin when no positional prompt argument is supplied.
    child.stdin?.on('error', () => {
      // The exec callback reports the useful process error. Avoid an
      // unhandled EPIPE if the child exits before consuming all input.
    });
    child.stdin?.end(stdin);
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Distill raw Markdown content into a structured knowledge-base article
 * using the `claude code` CLI.
 *
 * @param rawMarkdown - The raw Markdown from markitdown.
 * @param category    - Target category: "products" | "basics" | "company" | "schemes".
 * @returns Distilled content with metadata.
 */
export async function distillContent(
  rawMarkdown: string,
  category: string,
): Promise<DistillResult> {
  if (!rawMarkdown.trim()) {
    throw new Error('No content to distill.');
  }

  const validCategories = ['products', 'basics', 'company', 'schemes'];
  if (!validCategories.includes(category)) {
    throw new Error(
      `Invalid category "${category}". Must be one of: ${validCategories.join(', ')}`,
    );
  }

  // Get API key from vault
  const { key: apiKey, baseUrl } = await getApiKeyFromVault();

  const systemPrompt = buildDistillSystemPrompt(category);

  // Build the full user prompt with the raw content included directly
  const userPrompt =
    `Please distill the following content for the "${category}" category.\n\n` +
    `Output EXACTLY this format with delimiters:\n` +
    `---FILENAME---\n<kebab-case-filename>\n` +
    `---TITLE---\n<Descriptive title>\n` +
    `---SUMMARY---\n<1-2 sentence summary>\n` +
    `---CONTENT---\n<Full Markdown article>\n\n` +
    `CONTENT TO DISTILL:\n${rawMarkdown}`;

  const args = [
    '--print',
    '--output-format', 'text',
    '--dangerously-skip-permissions',
    '--bare',
    '--system-prompt', systemPrompt,
  ];

  const env: Record<string, string> = {
    ANTHROPIC_API_KEY: apiKey,
    ANTHROPIC_BASE_URL: baseUrl,
  };

  let stdout: string;
  stdout = await execPromise(CLAUDE_CLI, args, env, userPrompt);

  if (!stdout.trim()) {
    throw new Error('claude code returned empty output during distillation.');
  }

  const parsed = parseDistillResponse(stdout);

  return {
    distilled: parsed.content,
    suggestedFilename: parsed.suggestedFilename,
    title: parsed.title,
    summary: parsed.summary,
  };
}

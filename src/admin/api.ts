/**
 * Admin API client.
 *
 * All functions include the stored password in the Authorization header.
 * Password is persisted in sessionStorage for the browser session lifetime.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FileEntry {
  path: string;
  topic: string;
  title: string;
  summary: string;
  tokens: number;
  loadOrder: number;
}

export interface CacheEntry {
  question: string;
  topic: string;
  stale: boolean;
  generatedAt: string;
}

export interface TokenBudget {
  total: number;
  files: Array<{ path: string; tokens: number }>;
}

/* ------------------------------------------------------------------ */
/*  Password management                                                */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'solar_admin_password';

function getPassword(): string {
  return sessionStorage.getItem(STORAGE_KEY) ?? '';
}

export function storePassword(pw: string): void {
  sessionStorage.setItem(STORAGE_KEY, pw);
}

export function clearPassword(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return true; // Auth disabled — always authenticated
}

/* ------------------------------------------------------------------ */
/*  Fetch wrapper                                                      */
/* ------------------------------------------------------------------ */

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const password = getPassword();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
    Authorization: `Bearer ${password}`,
  };

  // Only set Content-Type for non-FormData bodies
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Server returned ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

export async function login(_password: string): Promise<boolean> {
  // Auth disabled — always succeed
  storePassword('admin');
  return true;
}

/* ------------------------------------------------------------------ */
/*  Knowledge files                                                    */
/* ------------------------------------------------------------------ */

export async function listFiles(): Promise<FileEntry[]> {
  return apiFetch<FileEntry[]>('/api/admin/knowledge');
}

export async function readFile(category: string, file: string): Promise<string> {
  const data = await apiFetch<{ content: string }>(
    `/api/admin/knowledge/${encodeURIComponent(category)}/${encodeURIComponent(file)}`,
  );
  return data.content;
}

export async function saveFile(
  category: string,
  file: string,
  content: string,
): Promise<void> {
  await apiFetch(`/api/admin/knowledge/${encodeURIComponent(category)}/${encodeURIComponent(file)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function createFile(
  category: string,
  filename: string,
  title: string,
  summary: string,
  content: string,
): Promise<void> {
  await apiFetch(`/api/admin/knowledge/${encodeURIComponent(category)}`, {
    method: 'POST',
    body: JSON.stringify({ filename, title, summary, content }),
  });
}

export async function deleteFile(category: string, file: string): Promise<void> {
  await apiFetch(
    `/api/admin/knowledge/${encodeURIComponent(category)}/${encodeURIComponent(file)}`,
    { method: 'DELETE' },
  );
}

/* ------------------------------------------------------------------ */
/*  Manifest                                                           */
/* ------------------------------------------------------------------ */

export async function getManifest(): Promise<{ files: FileEntry[] }> {
  return apiFetch('/api/admin/manifest');
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

export async function getTokenBudget(): Promise<TokenBudget> {
  return apiFetch('/api/admin/tokens');
}

/* ------------------------------------------------------------------ */
/*  FAQ Cache                                                          */
/* ------------------------------------------------------------------ */

export async function getCacheEntries(): Promise<CacheEntry[]> {
  return apiFetch('/api/admin/cache');
}

export async function regenerateCache(): Promise<{ staleCount: number }> {
  return apiFetch('/api/admin/cache/regenerate', { method: 'POST' });
}

/* ------------------------------------------------------------------ */
/*  Ingest                                                             */
/* ------------------------------------------------------------------ */

export interface IngestResult {
  rawMarkdown: string;
  distilledMarkdown: string;
  suggestedFilename: string;
  title: string;
  summary: string;
}

export async function ingestData(
  source: 'url' | 'text',
  content: string,
  category: string,
): Promise<IngestResult> {
  return apiFetch<IngestResult>('/api/admin/ingest', {
    method: 'POST',
    body: JSON.stringify({ source, content, category }),
  });
}

export async function ingestFile(
  file: File,
  category: string,
): Promise<IngestResult> {
  return apiFetch<IngestResult>('/api/admin/ingest/file', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-Ingest-Category': category,
    },
    body: file,
  });
}

export async function saveIngested(
  category: string,
  filename: string,
  title: string,
  summary: string,
  content: string,
): Promise<{ status: string; path: string }> {
  return apiFetch('/api/admin/ingest/save', {
    method: 'POST',
    body: JSON.stringify({ category, filename, title, summary, content }),
  });
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export interface LLMSettings {
  LLM_API_KEY: string;
  LLM_MODEL: string;
  LLM_BASE_URL: string;
}

export async function getSettings(): Promise<LLMSettings> {
  return apiFetch('/api/admin/settings');
}

export async function saveSettings(settings: Partial<LLMSettings>): Promise<void> {
  await apiFetch('/api/admin/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

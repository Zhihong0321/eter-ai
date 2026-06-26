/**
 * SSE client — streams chat responses from the server.
 *
 * Usage:
 *   await streamChat(
 *     'How do solar panels work?',
 *     (chunk) => appendToUI(chunk),
 *     (full)  => finalizeUI(full),
 *     (err)   => showError(err),
 *   );
 */

import { sanitizeHTML } from './sanitize.js';

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Send a question to the chat API and stream the response.
 *
 * @param message  — the user's question
 * @param onChunk  — called with each partial text token as it arrives
 * @param onDone   — called once with the full sanitised HTML when the stream ends
 * @param onError  — called if anything goes wrong
 */
export async function streamChat(
  message: string,
  invoiceUid: string | null,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
): Promise<void> {
  let response: Response;

  /* ---- Fetch ---- */
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        ...(invoiceUid ? { invoiceUid } : {}),
      }),
    });
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Network error — could not reach the server.');
    return;
  }

  /* ---- Non-streaming JSON response (cache hit) ---- */
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();
      if (data.error) {
        onError(data.error);
        return;
      }
      if (typeof data.html === 'string') {
        const safe = sanitizeHTML(data.html);
        onDone(safe);
      } else {
        onError('Unexpected JSON response from server.');
      }
    } catch {
      onError('Failed to parse server response.');
    }
    return;
  }

  /* ---- SSE stream ---- */
  if (!response.ok) {
    onError(`Server returned HTTP ${response.status}.`);
    return;
  }

  if (!response.body) {
    onError('Server returned an empty response.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      /* Split on newlines; keep the last (possibly incomplete) line */
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice(5).trim();

        /* Sentinel */
        if (payload === '[DONE]') {
          const safe = sanitizeHTML(fullText);
          onDone(safe);
          return;
        }

        /* Parse JSON chunk */
        try {
          const parsed = JSON.parse(payload);

          if (typeof parsed.error === 'string') {
            onError(parsed.error);
            return;
          }

          if (typeof parsed.chunk === 'string') {
            fullText += parsed.chunk;
            onChunk(parsed.chunk);
          }
        } catch {
          /* skip malformed JSON */
        }
      }
    }

    /* Stream ended without [DONE] — still finalise */
    if (fullText.length > 0) {
      const safe = sanitizeHTML(fullText);
      onDone(safe);
    } else {
      onError('Server closed the stream without sending a response.');
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Error reading stream.');
  }
}

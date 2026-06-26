/**
 * MiniMax / compatible LLM streaming client.
 *
 * Supports two streaming formats transparently:
 *   1. OpenAI-compatible  (data: {"choices":[{"delta":{"content":"..."}}]})
 *   2. Anthropic-compatible  (event: content_block_delta / data: {"delta":{"text":"..."}})
 *
 * Environment variables:
 *   MINIMAX_API_KEY or LLM_API_KEY  — API key (required)
 *   LLM_MODEL                       — model id  (default: "MiniMax-Text-01")
 *   LLM_BASE_URL                    — endpoint   (default: MiniMax chatcompletion_v2)
 */
export function getConfig() {
    return {
        BASE_URL: process.env.CHATBOT_BASE_URL ?? process.env.LLM_BASE_URL ?? 'https://api.minimax.chat/v1/text/chatcompletion_v2',
        API_KEY: process.env.CHATBOT_API_KEY ?? process.env.MINIMAX_API_KEY ?? process.env.LLM_API_KEY ?? '',
        MODEL: process.env.CHATBOT_MODEL ?? process.env.LLM_MODEL ?? 'MiniMax-Text-01'
    };
}
/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
/** Produce a single-chunk ReadableStream containing an error message. */
function errorStream(message) {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(message);
            controller.close();
        },
    });
}
/**
 * Parse a raw SSE line and return the text token it carries, if any.
 * Handles both OpenAI and Anthropic streaming JSON shapes.
 */
function extractToken(jsonStr) {
    try {
        const obj = JSON.parse(jsonStr);
        // --- OpenAI-compatible (choices[0].delta.content) ---
        const openai = obj?.choices?.[0]?.delta?.content;
        if (typeof openai === 'string' && openai.length > 0)
            return openai;
        // --- Anthropic-compatible (content_block_delta → delta.text) ---
        if (obj?.type === 'content_block_delta' &&
            typeof obj?.delta?.text === 'string' &&
            obj.delta.text.length > 0) {
            return obj.delta.text;
        }
    }
    catch {
        /* malformed JSON — skip */
    }
    return null;
}
/**
 * Detect whether an SSE data payload signals stream end.
 * OpenAI  → literal "[DONE]"
 * Anthropic → message_stop event (handled by caller via event type)
 */
function isDoneSignal(data) {
    return data === '[DONE]';
}
/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
/**
 * Stream an answer from the LLM.
 *
 * Returns a `ReadableStream<string>` that yields individual text tokens.
 * On configuration or network errors the stream emits a single
 * human-readable error message instead of throwing.
 */
export async function generateAnswer(question, systemPrompt) {
    const { BASE_URL, API_KEY, MODEL } = getConfig();
    /* ---- Guard: missing key ---- */
    if (!API_KEY) {
        return errorStream('The AI service is not configured. Please set MINIMAX_API_KEY (or LLM_API_KEY) in the server environment and restart.');
    }
    /* ---- Build request ---- */
    const url = BASE_URL;
    const isAnthropicStyle = url.includes('/anthropic') || url.includes('/v1/messages');
    let body;
    let headers;
    if (isAnthropicStyle) {
        // Anthropic Messages API
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
        };
        body = JSON.stringify({
            model: MODEL,
            max_tokens: 4096,
            stream: true,
            system: systemPrompt,
            messages: [{ role: 'user', content: question }],
        });
    }
    else {
        // OpenAI-compatible (MiniMax chatcompletion_v2, etc.)
        headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
        };
        body = JSON.stringify({
            model: MODEL,
            stream: true,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question },
            ],
        });
    }
    /* ---- Call API ---- */
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers,
            body,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return errorStream(`Network error reaching the AI service: ${msg}`);
    }
    if (!response.ok) {
        let detail = '';
        try {
            detail = await response.text();
        }
        catch { /* ignore */ }
        return errorStream(`AI service returned HTTP ${response.status}. ${detail.slice(0, 300)}`);
    }
    if (!response.body) {
        return errorStream('AI service returned an empty response.');
    }
    /* ---- Transform SSE byte stream into a token stream ---- */
    const upstream = response.body; // ReadableStream<Uint8Array>
    const decoder = new TextDecoder();
    let sseBuffer = '';
    return new ReadableStream({
        async start(controller) {
            const reader = upstream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    sseBuffer += decoder.decode(value, { stream: true });
                    /* Process complete SSE lines (terminated by \n) */
                    const lines = sseBuffer.split('\n');
                    sseBuffer = lines.pop() ?? ''; // keep incomplete tail
                    let currentEvent = '';
                    for (const rawLine of lines) {
                        const line = rawLine.trimEnd();
                        if (line.length === 0) {
                            // blank line = end of SSE frame; nothing to do per-frame
                            currentEvent = '';
                            continue;
                        }
                        /* SSE "event:" field (Anthropic uses this) */
                        if (line.startsWith('event:')) {
                            currentEvent = line.slice(6).trim();
                            if (currentEvent === 'message_stop') {
                                controller.close();
                                return;
                            }
                            continue;
                        }
                        /* SSE "data:" field */
                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim();
                            if (isDoneSignal(data)) {
                                controller.close();
                                return;
                            }
                            const token = extractToken(data);
                            if (token !== null) {
                                controller.enqueue(token);
                            }
                        }
                    }
                }
                // Upstream exhausted without explicit DONE signal — close gracefully
                controller.close();
            }
            catch (err) {
                controller.error(err);
            }
        },
        cancel() {
            upstream.cancel().catch(() => { });
        },
    });
}
//# sourceMappingURL=client.js.map
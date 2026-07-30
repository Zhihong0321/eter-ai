/**
 * Writes to the shared `ai_activity_log` table (prod_main), per
 * how-to-use-ai-activity-log.md. Fire-and-forget: logging must never break
 * the actual chat flow (Rule 1), so every failure is caught and swallowed.
 */

import { getPool } from '../invoice/db.js';

const APP_SLUG = '00product-ai';

export interface AiActivityLogEntry {
  agent: string;
  agentKind?: string;
  model: string;
  apiUrl?: string;
  action: string;
  description?: string;
  inputSummary?: string;
  outputSummary?: string;
  durationMs?: number;
  status?: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  sessionId?: string;
}

function truncate(text: string | undefined, max = 500): string | null {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Insert one row into ai_activity_log. Never throws. */
export async function logAiActivity(entry: AiActivityLogEntry): Promise<void> {
  try {
    const pool = getPool();
    if (!pool) return; // DATABASE_URL not configured — skip silently

    await pool.query(
      `INSERT INTO ai_activity_log
         (app, app_env, agent, agent_kind, model, api_url, action,
          description, input_summary, output_summary, duration_ms,
          status, error_message, session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        APP_SLUG,
        process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
        entry.agent,
        entry.agentKind ?? 'main_loop',
        entry.model,
        entry.apiUrl ?? null,
        entry.action,
        entry.description ?? null,
        truncate(entry.inputSummary),
        truncate(entry.outputSummary),
        entry.durationMs ?? null,
        entry.status ?? 'success',
        entry.errorMessage ?? null,
        entry.sessionId ?? null,
      ],
    );
  } catch (err) {
    console.error('[ai_activity_log] insert failed:', err instanceof Error ? err.message : err);
  }
}

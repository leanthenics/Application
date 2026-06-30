import { config } from '../../config.js';

/**
 * Per-call transient-retry for model calls. We retry ONLY on HTTP 429 / 503
 * (rate-limit / "high demand") — everything else fails fast. Backoff is
 * exponential + jitter, capped; a provider Retry-After header wins if present.
 */

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_BACKOFF_MS = 8000;

/** Best-effort HTTP status from a Gemini (`ApiError.status`) or Replicate (`response.status`) error. */
function getStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { status?: unknown; response?: { status?: unknown }; message?: unknown };
  if (typeof e.status === 'number') return e.status;
  if (typeof e.response?.status === 'number') return e.response.status;
  // Fallback: parse the status out of a Gemini error message JSON.
  const msg = typeof e.message === 'string' ? e.message : '';
  if (/"code"\s*:\s*503|UNAVAILABLE/i.test(msg)) return 503;
  if (/"code"\s*:\s*429|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  return undefined;
}

function isRetryable(err: unknown): boolean {
  const status = getStatus(err);
  return status !== undefined && RETRYABLE_STATUS.has(status);
}

/** Honor a Retry-After header (seconds or HTTP-date) when the SDK exposes one (Replicate). */
function getRetryAfterMs(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const headers = (err as { response?: { headers?: { get?: (k: string) => string | null } } }).response?.headers;
  const raw = headers?.get?.('retry-after');
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const dateMs = Date.parse(raw);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}

function backoffMs(attempt: number, baseDelayMs: number): number {
  const exp = baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface WithRetryOptions {
  /** Total attempts (1 = no retry). */
  maxAttempts?: number;
  baseDelayMs?: number;
  /** Short label for logs (e.g. 'gemini.generateText'). */
  label: string;
}

/**
 * Run `fn`, retrying on transient 429/503 up to `maxAttempts` total. Non-retryable
 * errors (and the final attempt) rethrow. No payloads are logged.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: WithRetryOptions): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? config.ai.retry.maxAttempts;
  const baseDelayMs = opts.baseDelayMs ?? config.ai.retry.baseDelayMs;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const wait = getRetryAfterMs(err) ?? backoffMs(attempt, baseDelayMs);
      console.warn(`[retry] ${opts.label} attempt ${attempt} failed (status ${getStatus(err)}); retrying in ${Math.round(wait)}ms`);
      await sleep(wait);
    }
  }
}

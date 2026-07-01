import { getStatus } from './ai/retry.js';

/**
 * Map any error thrown by the pipeline onto a short, **client-safe** message
 * (architecture §4, decision 4). The raw error — which can carry provider JSON,
 * model ids, quota hints, etc. — must NEVER reach the anonymous client; the
 * worker logs the raw detail server-side and stores only this message as the
 * job's `failedReason` (surfaced via `GET /jobs/:id`).
 *
 * Tiered by *failure kind*, deliberately NOT by pipeline stage: the client has
 * no notion of Model 1/2/3, so we never reveal which step failed (e.g. a
 * product-less image reads the same generic message as any other failure).
 *
 *   - transient (429 / 503) → "busy, try again"
 *   - timeout / abort       → "took too long, try again"
 *   - anything else         → generic "couldn't process it, try again"
 */

const BUSY_MESSAGE = 'Our image service is busy right now. Please try again in a moment.';
const TIMEOUT_MESSAGE = 'This took too long to process. Please try again.';
const GENERIC_MESSAGE = "We couldn't process your image. Please try again.";

/** An AbortController-driven timeout (our per-call hard caps) surfaces as `AbortError`. */
function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

export function toClientSafeMessage(err: unknown): string {
  const status = getStatus(err);
  if (status === 429 || status === 503) return BUSY_MESSAGE;
  if (isAbortError(err)) return TIMEOUT_MESSAGE;
  return GENERIC_MESSAGE;
}

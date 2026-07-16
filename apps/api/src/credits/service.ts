import { getServiceClient } from '../db/supabase.js';

/**
 * Credits service — the only place the API mutates a user's balance. Each call
 * invokes a SECURITY DEFINER Postgres function (docs/private/sql/credits.sql) via
 * the service-role client, so the change is atomic and audited in one round trip.
 * The DB is the source of truth; nothing here trusts a client-supplied balance.
 */

/** Thrown when a spend is attempted at zero balance. The API maps this to HTTP 402. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super('insufficient_credits');
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Atomically spend 1 credit for a job. Returns the new balance.
 * Throws `InsufficientCreditsError` when the user has none left.
 */
export async function spendCredit(userId: string, jobId: string): Promise<number> {
  const { data, error } = await getServiceClient().rpc('spend_credit', {
    p_user_id: userId,
    p_job_id: jobId,
  });
  if (error) {
    if (error.message.includes('insufficient_credits')) throw new InsufficientCreditsError();
    throw new Error(`spend_credit failed: ${error.message}`);
  }
  return data as number;
}

/**
 * Refund 1 credit for a failed job. Idempotent in the DB (one refund per job), so
 * this is safe to call more than once. Best-effort: it logs and swallows errors so a
 * refund hiccup never masks the original job failure.
 */
export async function refundCredit(userId: string, jobId: string): Promise<void> {
  const { error } = await getServiceClient().rpc('refund_credit', {
    p_user_id: userId,
    p_job_id: jobId,
  });
  if (error) console.error(`[credits] refund failed for job ${jobId}:`, error.message);
}

/**
 * Grant credits (purchase / manual grant). Returns the new balance. `externalRef`
 * is where a future payment-provider reference lands on the ledger row.
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  externalRef: string | null = null,
): Promise<number> {
  const { data, error } = await getServiceClient().rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_external_ref: externalRef,
  });
  if (error) throw new Error(`add_credits failed: ${error.message}`);
  return data as number;
}

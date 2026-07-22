import { listExpired, deleteGenerations } from '../db/generations.js';
import { removeImages } from '../db/storage.js';

/**
 * Retention cleanup. Supabase Storage has no native TTL, so the worker runs this on
 * boot and once a day: find generations past `expires_at`, delete their Storage objects
 * via the Storage API (required — SQL would orphan them), then delete the rows.
 *
 * Idempotent + best-effort: deleting already-gone objects/rows is a no-op and any error
 * is logged and swallowed, so a transient hiccup never crashes the worker. Runs in
 * batches to bound memory when a backlog builds up.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;

export async function runCleanup(): Promise<void> {
  try {
    let rows = 0;
    let objects = 0;
    for (;;) {
      const expired = await listExpired(BATCH);
      if (expired.length === 0) break;
      const paths = expired.flatMap((r) => [r.input_path, r.output_path]);
      await removeImages(paths);
      await deleteGenerations(expired.map((r) => r.id));
      rows += expired.length;
      objects += paths.length;
      if (expired.length < BATCH) break;
    }
    console.log(
      rows > 0
        ? `[cleanup] purged ${rows} generation(s), ${objects} object(s)`
        : '[cleanup] nothing to purge',
    );
  } catch (err) {
    console.error('[cleanup] failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Kick off the retention schedule: once now (so a fresh deploy purges immediately),
 * then every 24h. `unref()` so the timer alone never keeps the process alive. Safe to
 * run on multiple worker instances — cleanup is idempotent.
 */
export function startCleanupSchedule(): void {
  void runCleanup();
  setInterval(() => void runCleanup(), DAY_MS).unref();
}

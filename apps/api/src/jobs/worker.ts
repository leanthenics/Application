import { Worker, type Job } from 'bullmq';
import type { JobResult } from '@clickretina/contract';
import { JOBS_QUEUE, createRedis, type JobData } from './shared.js';
import { runPipeline } from '../pipeline/runner.js';
import { toClientSafeMessage } from '../pipeline/errors.js';
import { refundCredit } from '../credits/service.js';
import { getStyle } from '../styles/catalog.js';
import { uploadImage } from '../db/storage.js';
import { recordGeneration } from '../db/generations.js';
import { startCleanupSchedule } from './maintenance.js';

/**
 * BullMQ worker — runs as a SEPARATE process (`pnpm dev:worker`).
 *
 * Delegates to the AI pipeline (`pipeline/runner.ts`), which runs the real
 * 3-model pipeline + Amazon URL builder and returns the edited image BYTES. The
 * worker then persists input + output to Storage, records the history row, and
 * returns the path-based public `JobResult` (so Redis / `GET /jobs/:id` carry
 * references, not bytes). Any step that throws → job `failed` (queue is
 * `attempts: 1`, fail-fast) and the credit spent at creation is refunded.
 *
 * The raw error is logged server-side (full detail for debugging) but only a
 * sanitized, client-safe message is rethrown, so BullMQ stores that as the job's
 * `failedReason` and no provider internals leak via `GET /jobs/:id`.
 */
const worker = new Worker<JobData, JobResult>(
  JOBS_QUEUE,
  async (job: Job<JobData>) => {
    const jobId = job.id!;
    const { userId, style, prompt, night, image, mimeType } = job.data;
    console.log(
      `[worker] processing ${jobId} style="${style}" prompt="${prompt ?? ''}" mime=${mimeType}`,
    );
    try {
      const out = await runPipeline(job.data, { jobId });

      // Persist both images to the private bucket, then record the history row. A
      // failure here fails the job (and refunds the credit below) — the accepted
      // tradeoff being that a successful render we couldn't store is retried for free.
      const [inputPath, outputPath] = await Promise.all([
        uploadImage(userId, jobId, 'input', image, mimeType),
        uploadImage(userId, jobId, 'output', out.outputImage, out.mimeType),
      ]);
      const styleEntry = await getStyle(style);
      await recordGeneration({
        id: jobId,
        user_id: userId,
        style,
        style_label: styleEntry?.label ?? style,
        prompt: prompt ?? null,
        night: night ?? false,
        input_path: inputPath,
        output_path: outputPath,
        mime_type: out.mimeType,
        product_groups: out.productGroups,
      });

      const result: JobResult = {
        inputImagePath: inputPath,
        outputImagePath: outputPath,
        mimeType: out.mimeType,
        productGroups: out.productGroups,
      };
      return result;
    } catch (err) {
      // Full raw detail stays server-side only; client sees the sanitized message.
      console.error(`[worker] pipeline failed ${jobId}:`, err);
      // Our failure (server/AI/infra/storage) — return the credit spent at job
      // creation so users never pay for our errors. Idempotent + best-effort in the DB.
      await refundCredit(userId, jobId);
      throw new Error(toClientSafeMessage(err));
    }
  },
  { connection: createRedis(), concurrency: 5 },
);

// Retention: purge expired images + history rows on boot, then daily.
startCleanupSchedule();

worker.on('completed', (job) => console.log(`[worker] completed ${job.id}`));
worker.on('failed', (job, err) => console.log(`[worker] failed ${job?.id}: ${err.message}`));
worker.on('error', (err) => console.error('[worker] error:', err.message));

console.log(`[worker] started; consuming queue "${JOBS_QUEUE}"`);

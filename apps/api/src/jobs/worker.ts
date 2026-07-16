import { Worker, type Job } from 'bullmq';
import { JOBS_QUEUE, createRedis, type JobData } from './shared.js';
import { runPipeline } from '../pipeline/runner.js';
import { toClientSafeMessage } from '../pipeline/errors.js';
import { refundCredit } from '../credits/service.js';

/**
 * BullMQ worker — runs as a SEPARATE process (`pnpm dev:worker`). Concurrency 1.
 *
 * Delegates to the AI pipeline (`pipeline/runner.ts`), which runs the real
 * 3-model pipeline + Amazon URL builder. Any step that throws → job `failed`
 * (queue is `attempts: 1`, fail-fast).
 *
 * The raw error is logged server-side (full detail for debugging) but only a
 * sanitized, client-safe message is rethrown, so BullMQ stores that as the job's
 * `failedReason` and no provider internals leak via `GET /jobs/:id`.
 */
const worker = new Worker<JobData, Awaited<ReturnType<typeof runPipeline>>>(
  JOBS_QUEUE,
  async (job: Job<JobData>) => {
    console.log(
      `[worker] processing ${job.id} style="${job.data.style}" prompt="${job.data.prompt ?? ''}" mime=${job.data.mimeType}`,
    );
    try {
      return await runPipeline(job.data, { jobId: job.id! });
    } catch (err) {
      // Full raw detail stays server-side only; client sees the sanitized message.
      console.error(`[worker] pipeline failed ${job.id}:`, err);
      // Our failure (server/AI/infra) — return the credit spent at job creation so
      // users never pay for our errors. Idempotent + best-effort in the DB.
      await refundCredit(job.data.userId, job.id!);
      throw new Error(toClientSafeMessage(err));
    }
  },
  { connection: createRedis(), concurrency: 5 },
);

worker.on('completed', (job) => console.log(`[worker] completed ${job.id}`));
worker.on('failed', (job, err) => console.log(`[worker] failed ${job?.id}: ${err.message}`));
worker.on('error', (err) => console.error('[worker] error:', err.message));

console.log(`[worker] started; consuming queue "${JOBS_QUEUE}"`);

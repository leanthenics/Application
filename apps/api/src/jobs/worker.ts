import { Worker, type Job } from 'bullmq';
import { JOBS_QUEUE, createRedis, type JobData } from './shared.js';
import { runPipeline } from '../pipeline/runner.js';

/**
 * BullMQ worker — runs as a SEPARATE process (`pnpm dev:worker`). Concurrency 1.
 *
 * Delegates to the AI pipeline (`pipeline/runner.ts`). As of B2.1, Model 1
 * (Gemini prompt enhancement) is real; Models 2–4 are stubbed inside the runner
 * and replaced in B2.2–B2.4. Any step that throws → job `failed` (queue is
 * `attempts: 1`, fail-fast).
 */
const worker = new Worker<JobData, Awaited<ReturnType<typeof runPipeline>>>(
  JOBS_QUEUE,
  async (job: Job<JobData>) => {
    console.log(`[worker] processing ${job.id} prompt="${job.data.prompt}" mime=${job.data.mimeType}`);
    return runPipeline(job.data, { jobId: job.id! });
  },
  { connection: createRedis(), concurrency: 1 },
);

worker.on('completed', (job) => console.log(`[worker] completed ${job.id}`));
worker.on('failed', (job, err) => console.log(`[worker] failed ${job?.id}: ${err.message}`));
worker.on('error', (err) => console.error('[worker] error:', err.message));

console.log(`[worker] started; consuming queue "${JOBS_QUEUE}"`);

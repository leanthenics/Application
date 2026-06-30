import { Queue } from 'bullmq';
import { config } from '../config.js';
import { JOBS_QUEUE, createRedis, type JobData } from './shared.js';

/**
 * Producer-side queue (imported by the API to enqueue jobs).
 *
 * - `attempts: 1` → fail-fast, no retries (architecture decision 4).
 * - Finished jobs (completed/failed) are evicted after `JOB_TTL_SECONDS`
 *   (default 600s / 10 min) via the `age` removal policy.
 */
export const jobsQueue = new Queue<JobData>(JOBS_QUEUE, {
  connection: createRedis(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: config.jobTtlSeconds },
    removeOnFail: { age: config.jobTtlSeconds },
  },
});

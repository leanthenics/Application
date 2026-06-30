import { Worker, type Job } from 'bullmq';
import type { JobResult } from '@clickretina/contract';
import { config } from '../config.js';
import { JOBS_QUEUE, createRedis, type JobData } from './shared.js';

/**
 * BullMQ worker — runs as a SEPARATE process (`pnpm dev:worker`). Concurrency 1.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  ⚠️  TEMPLATE / STUB ONLY — NOT real output.                                │
 * │  `buildStubResult` returns hard-coded mock data shaped like the real        │
 * │  `JobResult` (architecture §6) so the contract + GET /jobs/:id can be        │
 * │  exercised. It echoes the input image and invents fake products.            │
 * │  TODO(B2): replace `buildStubResult` with the real 3-model pipeline          │
 * │  (Gemini enhance → Replicate edit → Gemini vision keyterms → Amazon URLs).   │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

/** Fake keyterms — placeholder until Model 3 (vision) extracts real ones. */
const STUB_KEYTERMS = ['modern white sofa', 'wooden coffee table', 'arc floor lamp'];

/** TEMPLATE: well-formed Amazon affiliate search URL (architecture §5 / decision 5). */
function stubAmazonUrl(keyterm: string): string {
  return `https://www.amazon.${config.amazon.tld}/s?k=${encodeURIComponent(keyterm)}&tag=${encodeURIComponent(config.amazon.affiliateTag)}`;
}

/** TEMPLATE: mock `JobResult`. Shape is real (contract-typed); the data is fake. Replace in B2. */
function buildStubResult(data: JobData): JobResult {
  return {
    outputImage: data.image, // STUB: echo the input image until Model 2 returns a real edit
    mimeType: data.mimeType,
    products: STUB_KEYTERMS.map((keyterm) => ({ keyterm, amazonUrl: stubAmazonUrl(keyterm) })),
  };
}

const worker = new Worker<JobData>(
  JOBS_QUEUE,
  async (job: Job<JobData>) => {
    console.log(`[worker] processing ${job.id} prompt="${job.data.prompt}" mime=${job.data.mimeType}`);
    await new Promise((resolve) => setTimeout(resolve, 7000)); // simulate work (observe 'processing' across 2s polls)
    console.log(`[worker] ⚠️ returning STUB/template JobResult for ${job.id} (B1.4 — replace in B2)`);
    return buildStubResult(job.data);
  },
  { connection: createRedis(), concurrency: 1 },
);

worker.on('completed', (job) => console.log(`[worker] completed ${job.id}`));
worker.on('failed', (job, err) => console.log(`[worker] failed ${job?.id}: ${err.message}`));
worker.on('error', (err) => console.error('[worker] error:', err.message));

console.log(`[worker] started; consuming queue "${JOBS_QUEUE}"`);

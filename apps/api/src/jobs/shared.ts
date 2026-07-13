import { Redis } from 'ioredis';
import { config } from '../config.js';
import type { ImageMime } from '@clickretina/contract';

/** BullMQ queue name (producer + worker must agree). */
export const JOBS_QUEUE = 'jobs';

/**
 * Internal enqueued payload — NOT part of the public contract.
 * Mirrors `CreateJobRequest` after validation (mimeType defaulted).
 */
export interface JobData {
  image: string;
  mimeType: ImageMime;
  /** Garden style id (validated against the catalog before enqueue). */
  style: string;
  /** Optional free-text request layered on top of the style. */
  prompt?: string;
  /** Supabase user id (token subject) that owns this job — stamped at enqueue. */
  userId: string;
}

/**
 * Create a Redis connection for BullMQ. BullMQ requires
 * `maxRetriesPerRequest: null` on its connection.
 */
export function createRedis(): Redis {
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null });
}

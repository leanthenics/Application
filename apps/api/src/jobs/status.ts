import type { JobStatus } from '@clickretina/contract';

/**
 * Job-state read helper (B1.2): map BullMQ's internal job state to our public
 * `JobStatus` (now sourced from `@clickretina/contract`).
 *
 * Per architecture §6: waiting/delayed → queued, active → processing, else as-is.
 */
export function mapState(state: string): JobStatus {
  switch (state) {
    case 'active':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    // 'waiting' | 'waiting-children' | 'delayed' | 'prioritized' | 'paused' | 'unknown'
    default:
      return 'queued';
  }
}

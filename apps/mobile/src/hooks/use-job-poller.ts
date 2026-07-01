import { useEffect, useRef } from 'react';
import { ApiError, getJob } from '@/api/client';
import { useJobsStore } from '@/store/jobs';

const POLL_INTERVAL_MS = 2500;

/**
 * Single app-wide poller (mounted once in the root layout). Every tick it reads
 * the store directly (non-reactive), polls each non-terminal job, and patches
 * the result back in. One timer for all jobs; per-job in-flight guard prevents
 * overlapping requests. Terminal jobs are skipped.
 */
export function useJobPoller() {
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function tick() {
      const { jobs, patchJob } = useJobsStore.getState();
      const active = Object.values(jobs).filter(
        (j) => j.status === 'queued' || j.status === 'processing',
      );
      for (const job of active) {
        if (inFlight.current.has(job.jobId)) continue;
        inFlight.current.add(job.jobId);
        getJob(job.jobId)
          .then((res) => {
            patchJob(job.jobId, { status: res.status, result: res.result, error: res.error });
          })
          .catch((e) => {
            // Evicted after its TTL → surface as expired. Other (network) errors:
            // leave the job as-is and retry on the next tick.
            if (e instanceof ApiError && e.code === 'not_found') {
              patchJob(job.jobId, { status: 'failed', error: 'This result has expired.' });
            }
          })
          .finally(() => {
            inFlight.current.delete(job.jobId);
          });
      }
    }

    const id = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => clearInterval(id);
  }, []);
}

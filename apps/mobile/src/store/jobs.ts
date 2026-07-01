import type { JobResult, JobStatus } from '@clickretina/contract';
import { create } from 'zustand';

/**
 * One generation job as tracked on the client. `inputThumbUri` is the local
 * file URI of the picked image (for the grid tile / detail placeholder) — we do
 * NOT keep the base64 in the store; it exists only transiently to build the POST.
 */
export type Job = {
  jobId: string;
  inputThumbUri: string;
  prompt: string;
  status: JobStatus;
  result: JobResult | null;
  error: string | null;
  createdAt: number;
};

type JobsState = {
  jobs: Record<string, Job>;
  addJob: (job: Job) => void;
  patchJob: (jobId: string, patch: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
};

export const useJobsStore = create<JobsState>((set) => ({
  jobs: {},
  addJob: (job) => set((s) => ({ jobs: { ...s.jobs, [job.jobId]: job } })),
  patchJob: (jobId, patch) =>
    set((s) => (s.jobs[jobId] ? { jobs: { ...s.jobs, [jobId]: { ...s.jobs[jobId], ...patch } } } : s)),
  removeJob: (jobId) =>
    set((s) => {
      const next = { ...s.jobs };
      delete next[jobId];
      return { jobs: next };
    }),
}));

/** Jobs as a list, newest first. */
export const selectJobsList = (s: JobsState): Job[] =>
  Object.values(s.jobs).sort((a, b) => b.createdAt - a.createdAt);

/** Job ids that are not yet terminal (used by the poller in F2). */
export const selectActiveJobIds = (s: JobsState): string[] =>
  Object.values(s.jobs)
    .filter((j) => j.status === 'queued' || j.status === 'processing')
    .map((j) => j.jobId);

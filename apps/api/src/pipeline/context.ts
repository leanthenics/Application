/**
 * Per-job context threaded through every pipeline step so logs (and later,
 * timeouts/cancellation) can be correlated to a single job.
 */
export interface PipelineContext {
  jobId: string;
}

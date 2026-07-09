import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { CreateJobRequest, type GetJobResponse } from '@clickretina/contract';
import { apiError } from '../http/errors.js';
import { jobsQueue } from '../jobs/queue.js';
import { mapState } from '../jobs/status.js';
import { getStyle } from '../styles/catalog.js';

export const jobsRouter: RouterType = Router();

/**
 * POST /jobs — validate the request, enqueue a BullMQ job, return its id.
 * Returns `202 { jobId }` immediately; the worker processes asynchronously.
 */
jobsRouter.post('/jobs', async (req, res) => {
  const parsed = CreateJobRequest.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
    return res.status(400).json(apiError('invalid_request', message));
  }

  // Validate the style id against the live catalog (ids are server-driven, so the
  // contract only checks it's a non-empty string — the real check is here).
  if (!(await getStyle(parsed.data.style))) {
    return res.status(400).json(apiError('invalid_style', 'Unknown style id'));
  }

  // Opaque UUID as the BullMQ job id (also what the client polls on).
  const jobId = randomUUID();
  await jobsQueue.add('process', parsed.data, { jobId });
  return res.status(202).json({ jobId });
});

/**
 * GET /jobs/:id — poll job status. Client polls until `status` is terminal.
 * Maps BullMQ state → JobStatus; returns `result` when completed, `error` when failed.
 * Unknown or TTL-evicted id → 404.
 */
jobsRouter.get('/jobs/:id', async (req, res) => {
  let job = await jobsQueue.getJob(req.params.id);
  if (!job) {
    return res.status(404).json(apiError('not_found', 'Job not found or expired'));
  }

  const status = mapState(await job.getState());
  // Close a read-skew race: `job` is a snapshot taken before getState(), so the
  // state can flip to terminal while returnvalue/failedReason are still empty.
  // Re-read once so the completed result (or failure reason) is populated.
  if ((status === 'completed' && job.returnvalue == null) ||
      (status === 'failed' && job.failedReason == null)) {
    job = (await jobsQueue.getJob(req.params.id)) ?? job;
  }

  const body: GetJobResponse = {
    jobId: job.id ?? req.params.id,
    status,
    result: status === 'completed' ? (job.returnvalue ?? null) : null,
    error: status === 'failed' ? (job.failedReason ?? 'Job failed') : null,
  };
  return res.status(200).json(body);
});

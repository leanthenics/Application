import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { CreateJobRequest, type GetJobResponse } from '@clickretina/contract';
import { apiError } from '../http/errors.js';
import { requireAuth } from '../http/auth.js';
import { jobsQueue } from '../jobs/queue.js';
import { mapState } from '../jobs/status.js';
import { getStyle } from '../styles/catalog.js';
import { spendCredit, refundCredit, InsufficientCreditsError } from '../credits/service.js';

export const jobsRouter: RouterType = Router();

/**
 * POST /jobs — validate the request, enqueue a BullMQ job, return its id.
 * Returns `202 { jobId }` immediately; the worker processes asynchronously.
 */
jobsRouter.post('/jobs', requireAuth, async (req, res) => {
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

  // Spend 1 credit BEFORE enqueuing — the DB is the source of truth and the atomic
  // gate for the paid pipeline. No credit ⇒ no job ⇒ no paid AI call. Returns the
  // new balance so the client can reflect it immediately.
  let creditsRemaining: number;
  try {
    creditsRemaining = await spendCredit(req.userId!, jobId);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return res
        .status(402)
        .json(apiError('insufficient_credits', "You're out of credits. Buy more to keep generating."));
    }
    throw err; // unexpected DB error → central 500
  }

  // Stamp the authenticated user's id (guaranteed set by requireAuth) so the job is
  // owned. If enqueue fails after we've charged, refund so nobody pays for a job that
  // never ran.
  try {
    await jobsQueue.add('process', { ...parsed.data, userId: req.userId! }, { jobId });
  } catch (err) {
    await refundCredit(req.userId!, jobId);
    throw err;
  }

  return res.status(202).json({ jobId, creditsRemaining });
});

/**
 * GET /jobs/:id — poll job status. Client polls until `status` is terminal.
 * Maps BullMQ state → JobStatus; returns `result` when completed, `error` when failed.
 * Unknown or TTL-evicted id → 404.
 */
jobsRouter.get('/jobs/:id', requireAuth, async (req, res) => {
  // A path param is always a single string at runtime; newer Express types widen it
  // to `string | string[]`, so normalize once here.
  const id = String(req.params.id);
  let job = await jobsQueue.getJob(id);
  if (!job) {
    return res.status(404).json(apiError('not_found', 'Job not found or expired'));
  }

  // Ownership: a job is only visible to the user who created it. Mismatch → 404
  // (not 403) so callers can't probe which job ids exist for other users.
  if (job.data.userId !== req.userId) {
    return res.status(404).json(apiError('not_found', 'Job not found or expired'));
  }

  const status = mapState(await job.getState());
  // Close a read-skew race: `job` is a snapshot taken before getState(), so the
  // state can flip to terminal while returnvalue/failedReason are still empty.
  // Re-read once so the completed result (or failure reason) is populated.
  if ((status === 'completed' && job.returnvalue == null) ||
      (status === 'failed' && job.failedReason == null)) {
    job = (await jobsQueue.getJob(id)) ?? job;
  }

  const body: GetJobResponse = {
    jobId: job.id ?? id,
    status,
    result: status === 'completed' ? (job.returnvalue ?? null) : null,
    error: status === 'failed' ? (job.failedReason ?? 'Job failed') : null,
  };
  return res.status(200).json(body);
});

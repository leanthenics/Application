import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { jobsRouter } from './routes/jobs.js';
import { showcaseRouter, showcaseDir } from './routes/showcase.js';
import { stylesRouter } from './routes/styles.js';
import { creditsRouter } from './routes/credits.js';
import { apiError } from './http/errors.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: config.maxBodySize }));

// Static before/after images for the landing-page showcase (see routes/showcase.ts).
app.use('/showcase/assets', express.static(showcaseDir));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'clickretina-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use(jobsRouter);
app.use(showcaseRouter);
app.use(stylesRouter);
app.use(creditsRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json(apiError('not_found', 'Route not found'));
});

// Central error handler (Express 5, 4-arg signature). Maps body-parser failures
// to the ApiError envelope; everything else is a generic 500.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json(apiError('payload_too_large', 'Image exceeds the maximum allowed size'));
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json(apiError('invalid_json', 'Malformed JSON body'));
  }
  return res.status(500).json(apiError('internal_error', 'Unexpected server error'));
});

app.listen(config.port, () => {
  console.log(`[clickretina-api] listening on http://localhost:${config.port}`);
});

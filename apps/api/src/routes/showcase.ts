import { Router, type Router as RouterType } from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { buildAmazonUrl } from '../pipeline/amazon.js';
import { apiError } from '../http/errors.js';

/**
 * Landing-page showcase: static before/after images + their product lists,
 * driven by a hand-editable `public/showcase/showcase.json` manifest. Adding or
 * swapping a showcase is a data change (drop images + edit JSON), no code change.
 *
 * - Images are served statically at `/showcase/assets/<file>` (see `index.ts`,
 *   which mounts `express.static(showcaseDir)`).
 * - `GET /showcase` returns the manifest with each keyterm expanded into an
 *   Amazon affiliate link via the same `buildAmazonUrl` the real pipeline uses.
 */

// `__dirname` equivalent for ESM. Resolves the same in dev (src/routes) and the
// built output (dist/routes): two levels up is the api package root.
const here = dirname(fileURLToPath(import.meta.url));
export const showcaseDir = join(here, '..', '..', 'public', 'showcase');
const manifestPath = join(showcaseDir, 'showcase.json');

const ManifestItem = z.object({
  id: z.string(),
  title: z.string().optional(),
  before: z.string(),
  after: z.string(),
  keyterms: z.array(z.string()).default([]),
});
const Manifest = z.array(ManifestItem);

export const showcaseRouter: RouterType = Router();

showcaseRouter.get('/showcase', async (_req, res) => {
  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch {
    // No manifest yet → empty showcase; the landing still renders its other sections.
    return res.status(200).json({ items: [] });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return res.status(500).json(apiError('showcase_invalid', 'Showcase manifest is not valid JSON'));
  }

  const parsed = Manifest.safeParse(json);
  if (!parsed.success) {
    return res.status(500).json(apiError('showcase_invalid', 'Showcase manifest has an invalid shape'));
  }

  const items = parsed.data.map((it) => ({
    id: it.id,
    title: it.title ?? '',
    beforeUrl: `/showcase/assets/${it.before}`,
    afterUrl: `/showcase/assets/${it.after}`,
    products: it.keyterms.map((keyterm) => ({ keyterm, amazonUrl: buildAmazonUrl(keyterm) })),
  }));

  return res.status(200).json({ items });
});

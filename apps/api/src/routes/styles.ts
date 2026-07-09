import { Router, type Router as RouterType } from 'express';
import { listStylesPublic } from '../styles/catalog.js';
import { apiError } from '../http/errors.js';

/**
 * GET /styles — the garden style catalog for the style-picker screen, driven by the
 * hand-editable `public/styles.json` manifest (see styles/catalog.ts). Returns the
 * public projection (id, label, blurb, imageUrl); the internal Model 2 `guidance`
 * stays server-side. Editing the manifest + restarting the API updates the picker with
 * no app release.
 */
export const stylesRouter: RouterType = Router();

stylesRouter.get('/styles', async (_req, res) => {
  try {
    const styles = await listStylesPublic();
    return res.status(200).json({ styles });
  } catch {
    // Missing/malformed manifest — a server misconfig, not a client error.
    return res.status(500).json(apiError('styles_invalid', 'Style catalog is unavailable'));
  }
});

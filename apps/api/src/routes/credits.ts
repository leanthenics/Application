import { Router, type Router as RouterType } from 'express';
import { requireAuth } from '../http/auth.js';
import { apiError } from '../http/errors.js';
import { listCreditPackages, getCreditPackage } from '../credits/catalog.js';
import { addCredits } from '../credits/service.js';

/**
 * Credit purchase endpoints. Credit *reads* (the balance) stay client-side via the
 * RLS-protected profiles query — these routes only cover the catalog and buying.
 */
export const creditsRouter: RouterType = Router();

/** GET /credits/packages — purchasable credit packs (hand-editable manifest). */
creditsRouter.get('/credits/packages', requireAuth, async (_req, res) => {
  try {
    const packages = await listCreditPackages();
    return res.status(200).json({ packages });
  } catch {
    // Missing/malformed manifest — a server misconfig, not a client error.
    return res.status(500).json(apiError('packages_invalid', 'Credit packages are unavailable'));
  }
});

/**
 * POST /credits/purchase { packageId } — grant a pack's credits to the user.
 *
 * NO PAYMENT GATEWAY YET: this grants immediately. This handler is the payment seam
 * — later it becomes "create a provider order and return it for the client to pay",
 * and a separate verify endpoint / webhook confirms the payment (writing the
 * provider reference into `external_ref`) before calling `addCredits`. The DB ledger
 * already records every grant, so wiring a real gateway is additive.
 */
creditsRouter.post('/credits/purchase', requireAuth, async (req, res) => {
  const packageId = typeof req.body?.packageId === 'string' ? req.body.packageId : '';
  const pkg = await getCreditPackage(packageId);
  if (!pkg) {
    return res.status(400).json(apiError('invalid_package', 'Unknown credit package'));
  }

  // TODO(payment): verify a completed payment for `pkg` before granting.
  const credits = await addCredits(req.userId!, pkg.credits, 'purchase', null);
  return res.status(200).json({ credits });
});

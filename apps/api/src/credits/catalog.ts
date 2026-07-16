import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';

/**
 * Credit-package catalog — a hand-editable server manifest
 * (`public/credit-packages.json`), mirroring the styles/showcase pattern. Packs can
 * be added/repriced by editing one JSON file + restarting the API (no rebuild, no
 * app release). Exposed via GET /credits/packages; used to validate a purchase.
 *
 * Each entry: id (stable key the client buys), label, credits (granted on purchase),
 * price + currency (display only — no gateway wired yet).
 */
const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, '..', '..', 'public', 'credit-packages.json');

const CreditPackage = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  credits: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: z.string().default('INR'),
});
export type CreditPackage = z.infer<typeof CreditPackage>;

/** Cached load as an id→package map; cached as a Promise so concurrent callers share one read. */
let cache: Promise<Map<string, CreditPackage>> | undefined;

async function readManifest(): Promise<Map<string, CreditPackage>> {
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = z.array(CreditPackage).parse(JSON.parse(raw));
  return new Map(parsed.map((p) => [p.id, p]));
}

export function loadCreditPackages(): Promise<Map<string, CreditPackage>> {
  if (!cache) cache = readManifest();
  return cache;
}

/** All packages, in manifest order, for GET /credits/packages. */
export async function listCreditPackages(): Promise<CreditPackage[]> {
  return [...(await loadCreditPackages()).values()];
}

/** Look up one package by id (undefined if unknown). */
export async function getCreditPackage(id: string): Promise<CreditPackage | undefined> {
  return (await loadCreditPackages()).get(id);
}

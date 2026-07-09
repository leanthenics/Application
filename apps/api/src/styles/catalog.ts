import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';

/**
 * Garden style catalog — a hand-editable server manifest (`public/styles.json`),
 * NOT compiled into the contract, so styles can be added/renamed/retuned by editing
 * one JSON file + restarting the API (no rebuild, no app release). Mirrors the
 * showcase manifest pattern.
 *
 * Each entry:
 *   - id       : stable key the client submits in CreateJobRequest.style
 *   - label    : UI title
 *   - blurb    : short UI subtitle
 *   - imageUrl : preview photo (may be blank now; set later — absolute or a
 *                relative path the client absolutizes against the API base URL)
 *   - guidance : rich style description fed to Model 2 (server-only; not in /styles)
 */

// `__dirname` equivalent for ESM. Two levels up from src/styles (and dist/styles)
// is the api package root — same resolution the showcase route uses.
const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, '..', '..', 'public', 'styles.json');

const StyleEntry = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  blurb: z.string().default(''),
  imageUrl: z.string().default(''),
  guidance: z.string().min(1),
});
export type StyleEntry = z.infer<typeof StyleEntry>;

/** Public projection returned by GET /styles (omits the internal Model 2 guidance). */
export interface PublicStyle {
  id: string;
  label: string;
  blurb: string;
  imageUrl: string;
}

/**
 * Cached load of the manifest as an id→entry map. Cached as a Promise so concurrent
 * callers share one read; throws if the manifest is missing or malformed (styles are
 * required now). Call `reloadStyleCatalog()` if you ever want to pick up edits without
 * a restart.
 */
let cache: Promise<Map<string, StyleEntry>> | undefined;

async function readCatalog(): Promise<Map<string, StyleEntry>> {
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = z.array(StyleEntry).parse(JSON.parse(raw));
  return new Map(parsed.map((s) => [s.id, s]));
}

export function loadStyleCatalog(): Promise<Map<string, StyleEntry>> {
  if (!cache) cache = readCatalog();
  return cache;
}

export function reloadStyleCatalog(): Promise<Map<string, StyleEntry>> {
  cache = readCatalog();
  return cache;
}

/** Look up one style by id (undefined if unknown). */
export async function getStyle(id: string): Promise<StyleEntry | undefined> {
  return (await loadStyleCatalog()).get(id);
}

/** The catalog for GET /styles, in manifest order, without the internal guidance. */
export async function listStylesPublic(): Promise<PublicStyle[]> {
  const catalog = await loadStyleCatalog();
  return [...catalog.values()].map(({ id, label, blurb, imageUrl }) => ({
    id,
    label,
    blurb,
    imageUrl,
  }));
}

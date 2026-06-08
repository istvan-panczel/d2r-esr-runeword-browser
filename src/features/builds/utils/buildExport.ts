import type { BuildWithAuthor } from '../types';

export const EXPORT_APP_NAME = 'D2R ESR Browser';

/** The shape written to the downloaded .json file: a small provenance header + the raw build. */
export interface BuildExport {
  readonly exportedAt: string;
  readonly app: string;
  readonly source: string;
  readonly build: BuildWithAuthor;
}

/** Wraps the full build record with a self-describing header (when/where it came from). */
export function buildExportPayload(build: BuildWithAuthor, source: string, exportedAt: string): BuildExport {
  return { exportedAt, app: EXPORT_APP_NAME, source, build };
}

/** Download filename: a slug of the build name plus a short id, e.g. "hammerdin-mf-1a2b3c4d.json". */
export function buildExportFilename(build: Pick<BuildWithAuthor, 'name' | 'id'>): string {
  const slug = build.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = slug.length > 0 ? slug : 'build';
  return `${base}-${build.id.slice(0, 8)}.json`;
}

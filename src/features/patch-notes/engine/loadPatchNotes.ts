/**
 * Browser loader for `public/patch-notes/index.json` (written by `npm run patch-notes:generate`).
 * Always revalidated (`cache: 'no-cache'`): the index has no content hash in its URL. One cached promise per page
 * lifetime; a failed request clears it so a retry refetches.
 */
import { PATCH_NOTES_SCHEMA, type PatchNotesIndex } from './schema';

let indexPromise: Promise<PatchNotesIndex> | null = null;

/** The URL of a file under public/patch-notes/ (an index path such as `reports/3.3.04-item-changes.pdf`). */
export function patchNotesFileUrl(path: string): string {
  return `${import.meta.env.BASE_URL}patch-notes/${path}`;
}

async function fetchIndex(): Promise<PatchNotesIndex> {
  const url = patchNotesFileUrl('index.json');
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${String(response.status)} ${response.statusText}`);
  const data = (await response.json()) as PatchNotesIndex;
  if (data.schema !== PATCH_NOTES_SCHEMA) throw new Error('The patch notes data is newer than this page. Reload the page.');
  return data;
}

export function loadPatchNotes(): Promise<PatchNotesIndex> {
  indexPromise ??= fetchIndex().catch((error: unknown) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

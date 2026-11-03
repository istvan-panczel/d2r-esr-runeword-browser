/**
 * The uploaded shared stash, remembered in the browser so the page works on the next visit without a new upload.
 *
 * A database of its own (not the app's `d2r-esr-runeword-browser` cache): that one is cleared on every HTM data sync
 * and deleted when Dexie cannot upgrade it, and the uploaded file is user data, not a cache of remote data.
 *
 * The raw file bytes are stored, not the parse result: the file is small (~200 KB for 32 full pages), it is re-parsed
 * on every visit in a few milliseconds, and a parser fix or a new stash.json (an ESR update) then applies to the
 * remembered file without a re-upload or a migration of a stored parse shape.
 */
import Dexie, { type EntityTable } from 'dexie';

export const STASH_DB_NAME = 'd2r-esr-stash';
/** The one record key: only the last upload is kept */
const LAST_UPLOAD_KEY = 'last';

export interface StashFileMeta {
  /** File name as uploaded ("ModernSharedStashSoftCoreV2.d2i") */
  readonly name: string;
  readonly size: number;
  /** The file's last-modified time (when the game last saved it), epoch ms; null when the browser gives none */
  readonly lastModified: number | null;
  /** When it was uploaded and first parsed, epoch ms */
  readonly uploadedAt: number;
}

export interface StoredStashFile extends StashFileMeta {
  readonly key: string;
  readonly bytes: ArrayBuffer;
}

class StashDatabase extends Dexie {
  files!: EntityTable<StoredStashFile, 'key'>;

  constructor() {
    super(STASH_DB_NAME);
    this.version(1).stores({ files: 'key' });
  }
}

const stashDb = new StashDatabase();

/** The remembered upload, or null when there is none. */
export async function loadStoredStash(): Promise<{ meta: StashFileMeta; bytes: Uint8Array } | null> {
  const record = await stashDb.files.get(LAST_UPLOAD_KEY);
  if (record === undefined) return null;
  const { key: _key, bytes, ...meta } = record;
  return { meta, bytes: new Uint8Array(bytes) };
}

/** Replaces the remembered upload. */
export async function saveStoredStash(meta: StashFileMeta, bytes: Uint8Array): Promise<void> {
  // A copy: the record must not share (or keep alive) a larger buffer the bytes are a view of
  const copy = bytes.slice().buffer;
  await stashDb.files.put({ key: LAST_UPLOAD_KEY, ...meta, bytes: copy });
}

export async function clearStoredStash(): Promise<void> {
  await stashDb.files.clear();
}

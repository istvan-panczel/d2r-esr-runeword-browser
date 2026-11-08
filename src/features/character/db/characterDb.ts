/**
 * The last uploaded character save, remembered in the browser so the page works on the next visit without a new upload.
 *
 * A database of its own (like the stash's `d2r-esr-stash`): the app's `d2r-esr-runeword-browser` database is a cache of
 * remote data, and a save is user data. The raw .d2s bytes are stored, not the parse result, so a parser fix or a new
 * stash.json applies to the remembered file without a re-upload. Of the .d2rl sidecar only the outcome is kept (the ESR
 * version once its hash matched the save): that is all the page uses, and it needs no re-verification on every visit.
 */
import Dexie, { type EntityTable } from 'dexie';

export const CHARACTER_DB_NAME = 'd2r-esr-character';
/** The one record key: only the last character is kept */
const LAST_UPLOAD_KEY = 'last';

/** What became of the .d2rl uploaded with the save */
export type CharacterSidecar =
  | { readonly status: 'none' }
  /** Its recorded hash is this save's: `esrVersion` is the exact version that wrote it */
  | { readonly status: 'matched'; readonly name: string; readonly esrVersion: string }
  | { readonly status: 'rejected'; readonly name: string; readonly reason: 'mismatch' | 'unreadable' };

export interface CharacterFileMeta {
  /** File name as uploaded ("SpinToWin.d2s") */
  readonly name: string;
  readonly size: number;
  /** The file's last-modified time, epoch ms; null when the browser gives none */
  readonly lastModified: number | null;
  /** When it was uploaded and first parsed, epoch ms */
  readonly uploadedAt: number;
  readonly sidecar: CharacterSidecar;
}

export interface StoredCharacterFile extends CharacterFileMeta {
  readonly key: string;
  readonly bytes: ArrayBuffer;
}

class CharacterDatabase extends Dexie {
  files!: EntityTable<StoredCharacterFile, 'key'>;

  constructor() {
    super(CHARACTER_DB_NAME);
    this.version(1).stores({ files: 'key' });
  }
}

const characterDb = new CharacterDatabase();

/** The remembered character, or null when there is none. */
export async function loadStoredCharacter(): Promise<{ meta: CharacterFileMeta; bytes: Uint8Array } | null> {
  const record = await characterDb.files.get(LAST_UPLOAD_KEY);
  if (record === undefined) return null;
  const { key: _key, bytes, ...meta } = record;
  return { meta, bytes: new Uint8Array(bytes) };
}

/** Replaces the remembered character. */
export async function saveStoredCharacter(meta: CharacterFileMeta, bytes: Uint8Array): Promise<void> {
  // A copy: the record must not share (or keep alive) a larger buffer the bytes are a view of
  const copy = bytes.slice().buffer;
  await characterDb.files.put({ key: LAST_UPLOAD_KEY, ...meta, bytes: copy });
}

export async function clearStoredCharacter(): Promise<void> {
  await characterDb.files.clear();
}

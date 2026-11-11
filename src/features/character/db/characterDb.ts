/**
 * The uploaded character saves, remembered in the browser so the My Character page works on the next visit without a new
 * upload. Several characters are kept, one record per character name: uploading a save of a character already stored
 * replaces that one.
 *
 * A database of its own (like the stash's `d2r-esr-stash`): the app's `d2r-esr-runeword-browser` database is a cache of
 * remote data, and a save is user data. The raw .d2s bytes are stored, not the parse result, so a parser fix or a new
 * stash.json applies to the remembered files without a re-upload. Of the .d2rl sidecar only the outcome is kept (the ESR
 * version once its hash matched the save): that is all the page uses, and it needs no re-verification on every visit.
 *
 * Versions: 1 kept one record (`files`, key `'last'`); 2 adds `characters` (keyed by the character name) and moves that
 * record over, reading the name from the save header; 3 drops `files`.
 */
import Dexie, { type EntityTable, type Transaction } from 'dexie';

export const CHARACTER_DB_NAME = 'd2r-esr-character';
/** The one record key of version 1 */
const LEGACY_LAST_KEY = 'last';

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

/** A remembered save: its character name (the key), the file meta and the raw bytes */
export interface StoredCharacter {
  readonly characterName: string;
  readonly meta: CharacterFileMeta;
  readonly bytes: Uint8Array;
}

interface CharacterRecord extends CharacterFileMeta {
  readonly characterName: string;
  readonly bytes: ArrayBuffer;
}

/** The version 1 record */
interface LegacyFileRecord extends CharacterFileMeta {
  readonly key: string;
  readonly bytes: ArrayBuffer;
}

/** Offset and size of the character name in the save header (see docs/features/CHARACTER-SAVE.md "Header") */
const NAME_OFFSET = 0x12b;
const NAME_BYTES = 96;

/**
 * The character name in a save's header (UTF-8, up to the first zero byte), or null when the bytes are too short or the
 * name is empty. Only the migration reads it this way: uploads take the name from the full parse.
 */
export function saveNameOf(bytes: Uint8Array): string | null {
  if (bytes.length < NAME_OFFSET + 1) return null;
  let end = NAME_OFFSET;
  const limit = Math.min(bytes.length, NAME_OFFSET + NAME_BYTES);
  while (end < limit && bytes[end] !== 0) end++;
  const name = new TextDecoder().decode(bytes.subarray(NAME_OFFSET, end)).trim();
  return name === '' ? null : name;
}

/** "SpinToWin.d2s" → "SpinToWin": the key of a migrated save whose header holds no readable name */
const fileStem = (fileName: string): string => fileName.replace(/\.[^.]*$/, '').trim() || 'Character';

/** Version 2: the one remembered save of version 1 becomes the first stored character. */
async function moveLegacyRecord(tx: Transaction): Promise<void> {
  const legacy = (await tx.table('files').get(LEGACY_LAST_KEY)) as LegacyFileRecord | undefined;
  if (legacy === undefined) return;
  const { key: _key, ...rest } = legacy;
  const characterName = saveNameOf(new Uint8Array(legacy.bytes)) ?? fileStem(legacy.name);
  const record: CharacterRecord = { ...rest, characterName };
  await tx.table('characters').put(record);
}

class CharacterDatabase extends Dexie {
  characters!: EntityTable<CharacterRecord, 'characterName'>;

  constructor() {
    super(CHARACTER_DB_NAME);
    this.version(1).stores({ files: 'key' });
    this.version(2).stores({ files: 'key', characters: 'characterName' }).upgrade(moveLegacyRecord);
    this.version(3).stores({ files: null, characters: 'characterName' });
  }
}

/** Exported for the migration test (it closes the database, writes a version 1 one and opens it again) */
export const characterDb = new CharacterDatabase();

function toStored(record: CharacterRecord): StoredCharacter {
  const { characterName, bytes, ...meta } = record;
  return { characterName, meta, bytes: new Uint8Array(bytes) };
}

/** Every remembered character, in no particular order. */
export async function loadStoredCharacters(): Promise<StoredCharacter[]> {
  return (await characterDb.characters.toArray()).map(toStored);
}

/** Remembers a character, replacing the stored one of the same name. */
export async function saveStoredCharacter(characterName: string, meta: CharacterFileMeta, bytes: Uint8Array): Promise<void> {
  // A copy: the record must not share (or keep alive) a larger buffer the bytes are a view of
  const copy = bytes.slice().buffer;
  await characterDb.characters.put({ ...meta, characterName, bytes: copy });
}

export async function removeStoredCharacter(characterName: string): Promise<void> {
  await characterDb.characters.delete(characterName);
}

export async function clearStoredCharacters(): Promise<void> {
  await characterDb.characters.clear();
}

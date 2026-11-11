/**
 * The stored characters of the My Character page as the switcher lists them: one entry per character name (a newer
 * upload of the same character replaces it), sorted by name, and which one is shown.
 */
import type { CharacterFileMeta } from '../db/characterDb';
import type { ReadCharacterResult } from './readCharacter';

export interface CharacterEntry {
  /** The character name: the storage key */
  readonly key: string;
  readonly file: CharacterFileMeta;
  /** The raw save, kept for "Create a build from this character" */
  readonly bytes: Uint8Array;
  /** The parse of the save (a stored save the current parser rejects stays listed with its error) */
  readonly result: ReadCharacterResult;
}

/** By name, case-insensitive, then exact (two names differing only in case stay in a fixed order). */
export function sortCharacterEntries<E extends Pick<CharacterEntry, 'key'>>(entries: readonly E[]): E[] {
  return [...entries].sort(
    (a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );
}

/** The list with `added` in it, each replacing the entry of the same name. Sorted. */
export function upsertCharacterEntries<E extends Pick<CharacterEntry, 'key'>>(entries: readonly E[], added: readonly E[]): E[] {
  const keys = new Set(added.map((entry) => entry.key));
  // The last of several uploads of one name wins
  const latest = [...new Map(added.map((entry) => [entry.key, entry])).values()];
  return sortCharacterEntries([...entries.filter((entry) => !keys.has(entry.key)), ...latest]);
}

/**
 * The entry to show: the remembered selection while it is stored, otherwise the most recently uploaded one (ties: the
 * first by name). Null for an empty list.
 */
export function selectedCharacterEntry<E extends Pick<CharacterEntry, 'key' | 'file'>>(
  entries: readonly E[],
  selectedKey: string | null
): E | null {
  const remembered = selectedKey === null ? undefined : entries.find((entry) => entry.key === selectedKey);
  if (remembered !== undefined) return remembered;
  return entries.reduce<E | null>((best, entry) => (best === null || entry.file.uploadedAt > best.file.uploadedAt ? entry : best), null);
}

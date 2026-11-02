import { readPersistentJson, writePersistentJson, type PersistentStorage } from '@/core/hooks/usePersistentState';
import { isPlainObject } from '../engine/parse';
import type { LootFilterBasedOn, LootFilterEntry } from './types';

export const LIBRARY_STORAGE_KEY = 'loot-filters/library';
/** Where an unreadable stored library is copied once before the app starts writing a fresh one. */
export const LIBRARY_BACKUP_STORAGE_KEY = 'loot-filters/library.unreadable';
const LIBRARY_STORAGE_VERSION = 1;

export interface StoredLibrary {
  readonly version: typeof LIBRARY_STORAGE_VERSION;
  readonly entries: readonly LootFilterEntry[];
}

const SOURCES: readonly string[] = ['blank', 'upload', 'template'];

/**
 * Checks the required fields only. The optional ones (`savedId`, `savedOwnerId`, `savedRevision`, `basedOn`) never
 * reject an entry: {@link normalizeEntry} drops a malformed one. Older app versions check the same required fields, so
 * they keep reading a library that has the optional ones.
 */
export function isLootFilterEntry(value: unknown): value is LootFilterEntry {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    value.id !== '' &&
    typeof value.name === 'string' &&
    typeof value.source === 'string' &&
    SOURCES.includes(value.source) &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    typeof value.updatedAt === 'number' &&
    Number.isFinite(value.updatedAt) &&
    typeof value.text === 'string'
  );
}

type OptionalKey = 'savedId' | 'savedOwnerId' | 'savedRevision' | 'basedOn';

const isId = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isRevision = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;

/** `basedOn` with malformed optional keys dropped; undefined when it is not an object with a string `label`. */
function normalizeBasedOn(value: unknown): LootFilterBasedOn | undefined {
  if (!isPlainObject(value) || typeof value.label !== 'string') return undefined;
  return {
    ...(isId(value.id) ? { id: value.id } : {}),
    ...(isRevision(value.revision) ? { revision: value.revision } : {}),
    ...(isId(value.template) ? { template: value.template } : {}),
    ...(isId(value.version) ? { version: value.version } : {}),
    label: value.label,
  };
}

function isWellFormedBasedOn(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.label === 'string' &&
    (value.id === undefined || isId(value.id)) &&
    (value.revision === undefined || isRevision(value.revision)) &&
    (value.template === undefined || isId(value.template)) &&
    (value.version === undefined || isId(value.version))
  );
}

/** The entry with malformed optional fields dropped; the same object when they are all fine (or absent). */
export function normalizeEntry(entry: LootFilterEntry): LootFilterEntry {
  // Typed as stored data: the fields may hold anything another version (or a hand edit) wrote.
  const { savedId, savedOwnerId, savedRevision, basedOn, ...rest } = entry as Omit<LootFilterEntry, OptionalKey> &
    Readonly<Record<OptionalKey, unknown>>;
  const fine =
    (savedId === undefined || isId(savedId)) &&
    (savedOwnerId === undefined || isId(savedOwnerId)) &&
    (savedRevision === undefined || isRevision(savedRevision)) &&
    (basedOn === undefined || isWellFormedBasedOn(basedOn));
  if (fine) return entry;
  const normalizedBasedOn = normalizeBasedOn(basedOn);
  return {
    ...rest,
    ...(isId(savedId) ? { savedId } : {}),
    ...(isId(savedOwnerId) ? { savedOwnerId } : {}),
    ...(isRevision(savedRevision) ? { savedRevision } : {}),
    ...(normalizedBasedOn ? { basedOn: normalizedBasedOn } : {}),
  };
}

export function isStoredLibrary(value: unknown): value is StoredLibrary {
  if (!isPlainObject(value) || value.version !== LIBRARY_STORAGE_VERSION || !Array.isArray(value.entries)) return false;
  const entries: readonly unknown[] = value.entries;
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!isLootFilterEntry(entry) || ids.has(entry.id)) return false;
    ids.add(entry.id);
  }
  return true;
}

/**
 * The stored library's entries (malformed optional fields dropped); empty when nothing is stored. A stored value that
 * fails the guard (corrupt, or written by a newer app version) is copied to {@link LIBRARY_BACKUP_STORAGE_KEY} so the
 * next save cannot destroy it.
 */
export function readLibrary(storage: PersistentStorage | null): readonly LootFilterEntry[] {
  const stored = readPersistentJson<StoredLibrary | null>(storage, LIBRARY_STORAGE_KEY, null, isStoredLibrary);
  if (stored) return stored.entries.map(normalizeEntry);
  if (storage === null) return [];
  try {
    const raw = storage.getItem(LIBRARY_STORAGE_KEY);
    if (raw !== null) {
      console.warn(`[Loot filters] The stored library is unreadable; a copy was kept under "${LIBRARY_BACKUP_STORAGE_KEY}"`);
      storage.setItem(LIBRARY_BACKUP_STORAGE_KEY, raw);
    }
  } catch {
    // Storage blocked or full: nothing more to do.
  }
  return [];
}

/** Writes the library; false when the browser refused (quota or blocked storage). */
export function writeLibrary(storage: PersistentStorage | null, entries: readonly LootFilterEntry[]): boolean {
  const value: StoredLibrary = { version: LIBRARY_STORAGE_VERSION, entries };
  return writePersistentJson(storage, LIBRARY_STORAGE_KEY, value);
}

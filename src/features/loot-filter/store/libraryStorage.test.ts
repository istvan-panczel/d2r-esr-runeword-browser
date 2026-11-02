import { describe, expect, it } from 'vitest';
import type { PersistentStorage } from '@/core/hooks/usePersistentState';
import {
  LIBRARY_BACKUP_STORAGE_KEY,
  LIBRARY_STORAGE_KEY,
  isLootFilterEntry,
  isStoredLibrary,
  normalizeEntry,
  readLibrary,
  writeLibrary,
} from './libraryStorage';
import type { LootFilterEntry } from './types';

const ENTRY: LootFilterEntry = { id: 'a', name: 'A', source: 'blank', createdAt: 1, updatedAt: 2, text: '{}' };

function memoryStorage(initial: Record<string, string> = {}): PersistentStorage & { readonly data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('isLootFilterEntry', () => {
  it('accepts a complete entry', () => {
    expect(isLootFilterEntry(ENTRY)).toBe(true);
  });

  it.each([
    ['missing text', { ...ENTRY, text: undefined }],
    ['empty id', { ...ENTRY, id: '' }],
    ['unknown source', { ...ENTRY, source: 'cloud' }],
    ['string timestamp', { ...ENTRY, createdAt: '1' }],
    ['NaN timestamp', { ...ENTRY, updatedAt: Number.NaN }],
    ['not an object', 'entry'],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isLootFilterEntry(value)).toBe(false);
  });
});

describe('optional draft fields', () => {
  const FULL: LootFilterEntry = {
    ...ENTRY,
    savedId: 'row',
    savedOwnerId: 'user',
    savedRevision: 3,
    basedOn: { id: 'src', revision: 2, template: 'sullys-qol', version: '0.6.11', label: 'L' },
  };

  it('keeps well-formed ones (same object)', () => {
    expect(isLootFilterEntry(FULL)).toBe(true);
    expect(normalizeEntry(FULL)).toBe(FULL);
    expect(normalizeEntry(ENTRY)).toBe(ENTRY);
  });

  it.each([
    ['empty savedId', { savedId: '' }, ['savedOwnerId', 'savedRevision', 'basedOn']],
    ['numeric savedOwnerId', { savedOwnerId: 7 }, ['savedId', 'savedRevision', 'basedOn']],
    ['fractional savedRevision', { savedRevision: 1.5 }, ['savedId', 'savedOwnerId', 'basedOn']],
    ['zero savedRevision', { savedRevision: 0 }, ['savedId', 'savedOwnerId', 'basedOn']],
    ['basedOn without a label', { basedOn: { id: 'src' } }, ['savedId', 'savedOwnerId', 'savedRevision']],
    ['basedOn that is a string', { basedOn: 'src' }, ['savedId', 'savedOwnerId', 'savedRevision']],
  ])('drops a malformed field (%s) and accepts the entry', (_label, bad, kept) => {
    const value = { ...FULL, ...bad };
    expect(isLootFilterEntry(value)).toBe(true);
    const normalized = normalizeEntry(value as LootFilterEntry);
    expect(Object.keys(normalized).sort()).toEqual([...Object.keys(ENTRY), ...kept].sort());
  });

  it('drops only the malformed keys of basedOn', () => {
    const value = { ...ENTRY, basedOn: { id: '', revision: 'x', template: 'sullys-qol', label: 'L' } } as unknown as LootFilterEntry;
    expect(normalizeEntry(value).basedOn).toEqual({ template: 'sullys-qol', label: 'L' });
  });

  it('a library with malformed optional fields is read, not backed up', () => {
    const stored = {
      version: 1,
      entries: [
        { ...ENTRY, savedRevision: 'x' },
        { ...FULL, id: 'b' },
      ],
    };
    const storage = memoryStorage({ [LIBRARY_STORAGE_KEY]: JSON.stringify(stored) });
    expect(readLibrary(storage)).toEqual([ENTRY, { ...FULL, id: 'b' }]);
    expect(storage.data.has(LIBRARY_BACKUP_STORAGE_KEY)).toBe(false);
  });
});

describe('isStoredLibrary', () => {
  it('accepts version 1 with valid entries', () => {
    expect(isStoredLibrary({ version: 1, entries: [ENTRY, { ...ENTRY, id: 'b' }] })).toBe(true);
    expect(isStoredLibrary({ version: 1, entries: [] })).toBe(true);
  });

  it('rejects other versions, bad entries and duplicate ids', () => {
    expect(isStoredLibrary({ version: 2, entries: [] })).toBe(false);
    expect(isStoredLibrary({ version: 1 })).toBe(false);
    expect(isStoredLibrary({ version: 1, entries: [ENTRY, { name: 'x' }] })).toBe(false);
    expect(isStoredLibrary({ version: 1, entries: [ENTRY, ENTRY] })).toBe(false);
    expect(isStoredLibrary([ENTRY])).toBe(false);
  });
});

describe('readLibrary / writeLibrary', () => {
  it('round-trips the entries under the versioned key', () => {
    const storage = memoryStorage();
    expect(writeLibrary(storage, [ENTRY])).toBe(true);
    expect(JSON.parse(storage.data.get(LIBRARY_STORAGE_KEY) ?? '')).toEqual({ version: 1, entries: [ENTRY] });
    expect(readLibrary(storage)).toEqual([ENTRY]);
  });

  it('returns no entries when nothing is stored or storage is unavailable', () => {
    expect(readLibrary(memoryStorage())).toEqual([]);
    expect(readLibrary(null)).toEqual([]);
    expect(writeLibrary(null, [ENTRY])).toBe(false);
  });

  it('keeps a copy of an unreadable library before it can be overwritten', () => {
    const storage = memoryStorage({ [LIBRARY_STORAGE_KEY]: '{"version": 9, "entries": []}' });
    expect(readLibrary(storage)).toEqual([]);
    expect(storage.data.get(LIBRARY_BACKUP_STORAGE_KEY)).toBe('{"version": 9, "entries": []}');
  });

  it('reports a refused write (quota)', () => {
    const storage: PersistentStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
    expect(writeLibrary(storage, [ENTRY])).toBe(false);
  });
});

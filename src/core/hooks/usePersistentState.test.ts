import { describe, expect, it } from 'vitest';
import { readPersistentJson, writePersistentJson, type PersistentStorage } from './usePersistentState';

class MemoryStorage implements PersistentStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('persistent state helpers', () => {
  it('returns fallback values when storage is empty or malformed', () => {
    const storage = new MemoryStorage();

    expect(readPersistentJson(storage, 'missing', { searchText: '' })).toEqual({ searchText: '' });

    storage.setItem('broken', '{');
    expect(readPersistentJson(storage, 'broken', { searchText: 'default' })).toEqual({ searchText: 'default' });
  });

  it('validates parsed values before returning them', () => {
    const storage = new MemoryStorage();
    storage.setItem('filter', JSON.stringify({ searchText: 'life', maxReqLevel: 25 }));

    const isValidFilter = (value: unknown): value is { searchText: string; maxReqLevel: number } =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { searchText?: unknown }).searchText === 'string' &&
      typeof (value as { maxReqLevel?: unknown }).maxReqLevel === 'number';

    expect(readPersistentJson(storage, 'filter', { searchText: '', maxReqLevel: 0 }, isValidFilter)).toEqual({
      searchText: 'life',
      maxReqLevel: 25,
    });

    storage.setItem('filter', JSON.stringify({ searchText: 'life', maxReqLevel: '25' }));
    expect(readPersistentJson(storage, 'filter', { searchText: '', maxReqLevel: 0 }, isValidFilter)).toEqual({
      searchText: '',
      maxReqLevel: 0,
    });
  });

  it('serializes values back into storage', () => {
    const storage = new MemoryStorage();

    writePersistentJson(storage, 'favorites', ['Helm', 'Body Armor']);

    expect(storage.getItem('favorites')).toBe('["Helm","Body Armor"]');
  });
});

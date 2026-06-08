import { describe, expect, it } from 'vitest';
import { filterByFavoriteId, isBoolean, isStringArray, toggleFavoriteId } from './favorites';

describe('generic favorite helpers', () => {
  it('toggles an id without duplicating entries', () => {
    expect(toggleFavoriteId('a', [])).toEqual(['a']);
    expect(toggleFavoriteId('a', ['a'])).toEqual([]);
    expect(toggleFavoriteId('b', ['a'])).toEqual(['a', 'b']);
  });

  it('does not mutate the input array when toggling', () => {
    const original = ['a'];
    toggleFavoriteId('b', original);
    expect(original).toEqual(['a']);
  });

  it('filters items to those whose derived id is favorited', () => {
    const items = [
      { name: 'Keep', code: 'kp' },
      { name: 'Drop', code: 'dp' },
    ];
    const getId = (item: (typeof items)[number]) => `${item.name}:${item.code}`;

    expect(filterByFavoriteId(items, getId, ['Keep:kp'])).toEqual([{ name: 'Keep', code: 'kp' }]);
    expect(filterByFavoriteId(items, getId, [])).toEqual([]);
  });

  it('validates string arrays', () => {
    expect(isStringArray(['a', 'b'])).toBe(true);
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a', 1])).toBe(false);
    expect(isStringArray('a')).toBe(false);
  });

  it('validates booleans', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean('true')).toBe(false);
    expect(isBoolean(0)).toBe(false);
  });
});

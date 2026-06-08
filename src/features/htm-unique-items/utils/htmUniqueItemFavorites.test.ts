import { describe, expect, it } from 'vitest';
import { buildHtmUniqueItemFavoriteId } from './htmUniqueItemFavorites';

describe('htm unique item favorite helpers', () => {
  it('builds ids from name and base item code', () => {
    expect(buildHtmUniqueItemFavoriteId({ name: 'The Gnasher', baseItemCode: 'hax' })).toBe('htmUnique:The Gnasher:hax');
  });

  it('stays stable regardless of the volatile auto-increment id', () => {
    const a = buildHtmUniqueItemFavoriteId({ name: 'The Gnasher', baseItemCode: 'hax' });
    // Re-import would reassign Dexie ids, but the favourite id is content-derived,
    // so the same (name, baseItemCode) keeps producing the same id.
    const b = buildHtmUniqueItemFavoriteId({ name: 'The Gnasher', baseItemCode: 'hax' });
    expect(a).toBe(b);
  });

  it('distinguishes same-named uniques on different base items', () => {
    const ring = buildHtmUniqueItemFavoriteId({ name: 'Nagelring', baseItemCode: 'rin' });
    const other = buildHtmUniqueItemFavoriteId({ name: 'Nagelring', baseItemCode: 'zzz' });
    expect(ring).not.toBe(other);
  });
});

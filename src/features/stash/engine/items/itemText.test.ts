import { describe, expect, it } from 'vitest';
import { makeBundle, makeItem } from '../../testing/stashMocks.mock';
import { stashCatalog } from '../catalog';
import { createItemTextContext, renderItemText, statValues } from './itemText';

const catalog = stashCatalog(makeBundle());

describe('item text placeholder context (no itemtext.json)', () => {
  const ctx = createItemTextContext(null, catalog);

  it('has no names and no stat values', () => {
    expect(ctx.hasText).toBe(false);
    expect(ctx.names.magicPrefix(1)).toBeNull();
    expect(statValues(makeItem('cap', { stats: [{ id: 105, param: 0, value: 20 }] }), ctx)).toEqual([]);
  });

  it('writes the base lines and lists the socketed items', () => {
    const jewel = makeItem('jew');
    const groups = renderItemText(
      makeItem('cap', { defense: 12, durability: 5, maxDurability: 12, ethereal: true, sockets: 2, socketed: [jewel] }),
      ctx
    );
    expect(groups.base).toEqual(['Defense: 12', 'Durability: 5 of 12', 'Ethereal (Cannot be Repaired)', 'Socketed (2)']);
    expect(groups.socketed).toEqual([{ item: jewel, lines: [] }]);
    expect(renderItemText(makeItem('sbw', { maxDurability: 0 }), ctx).base).toEqual(['Indestructible']);
  });
});

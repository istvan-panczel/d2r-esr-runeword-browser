import { describe, expect, it } from 'vitest';
import { STASH_ITEM_FLAGS, type StashStatInfo } from '../../game-data/engine/schema.ts';
import { BitReader } from './bitReader.ts';
import { ItemReadError, readItem } from './parseItem.ts';
import { createStashData } from './stashData.ts';
import { BitWriter, writeItem, type TestItem } from './testItems.ts';

// ESR's widths for the stats the tests use; 107 item_singleskill has a param
const statRows: Record<number, StashStatInfo> = {
  17: [9, 11, 0],
  18: [9, 11, 0],
  31: [12, 1000, 0],
  72: [9, 0, 0],
  73: [8, 0, 0],
  107: [7, 0, 1],
  194: [4, 0, 0],
};
const data = createStashData({
  stats: Array.from({ length: 200 }, (_, id) => statRows[id] ?? null),
  items: [
    ['01c', 0, 1, 1],
    ['jew', 0, 1, 1],
    ['r01', 0, 1, 1],
    ['sbw', STASH_ITEM_FLAGS.weapon, 2, 3],
    ['xtp', STASH_ITEM_FLAGS.armor, 2, 3],
    ['aq2', 0, 1, 3],
  ],
});

function bytesOf(...items: TestItem[]): Uint8Array {
  const writer = new BitWriter();
  for (const item of items) writeItem(writer, data, item);
  return writer.bytes();
}

describe('readItem (ESR extended layout)', () => {
  it('reads a complete normal misc item (an Ancient Coupon) with its grid position and size', () => {
    const bytes = bytesOf({ code: '01c', x: 14, y: 12, level: 89 });
    const reader = new BitReader(bytes);
    const item = readItem(reader, data, { section: 3, index: 7 });
    expect(item).toMatchObject({ section: 3, index: 7, code: '01c', x: 14, y: 12, width: 1, height: 1, level: 89 });
    expect(item.quality).toBe('normal');
    expect(item.compact).toBe(false);
    expect(item.stats).toEqual([]);
    expect(reader.position).toBe(bytes.length * 8);
  });

  it('reads a compact item and the advanced stash stack size', () => {
    const reader = new BitReader(bytesOf({ code: 'r01', compact: true, stackSize: 36 }));
    expect(readItem(reader, data, { section: 1000, index: 0 })).toMatchObject({ code: 'r01', compact: true, quality: null, stackSize: 36 });
  });

  it('reads a unique weapon with a param stat, paired stats, quantity and two socketed items', () => {
    const bytes = bytesOf(
      {
        code: 'sbw',
        x: 3,
        y: 4,
        quality: 7,
        fileIndex: 655,
        sockets: 3,
        stats: [
          { id: 17, value: 120 },
          { id: 18, value: 110 },
          { id: 107, param: 488, value: 3 },
        ],
        socketed: [{ code: 'jew' }, { code: 'r01', compact: true }],
      },
      { code: 'aq2', quantity: 500 }
    );
    const reader = new BitReader(bytes);
    const bow = readItem(reader, data, { section: 0, index: 0 });
    expect(bow).toMatchObject({ code: 'sbw', quality: 'unique', uniqueId: 655, sockets: 3, width: 2, height: 3 });
    expect(bow.stats).toEqual([
      { id: 17, param: 0, value: 120 },
      { id: 18, param: 0, value: 110 },
      { id: 107, param: 488, value: 3 },
    ]);
    expect(bow.socketed.map((child) => [child.code, child.mode, child.index])).toEqual([
      ['jew', 6, 0],
      ['r01', 6, 1],
    ]);
    const arrows = readItem(reader, data, { section: 0, index: 1 });
    expect(arrows).toMatchObject({ code: 'aq2', quantity: 500 });
    expect(reader.position).toBe(bytes.length * 8);
  });

  const readOne = (item: TestItem) => readItem(new BitReader(bytesOf(item)), data, { section: 0, index: 0 });

  it('keeps the magic affix ids, the auto affix and the variable graphics', () => {
    const ring = readOne({ code: 'jew', quality: 4, prefixes: [419], suffixes: [0], autoAffix: 37, gfx: 5 });
    expect(ring).toMatchObject({ quality: 'magic', prefixIds: [419], suffixIds: [0], autoAffixId: 37, gfx: 5, rareNameIds: null });
    expect(readOne({ code: 'jew' })).toMatchObject({ prefixIds: [], suffixIds: [], autoAffixId: null, gfx: null, qualityVariant: null });
  });

  it('keeps the rare name ids and the three prefix and suffix slots, empty slots as 0', () => {
    const rare = readOne({ code: 'xtp', quality: 6, rareNames: [120, 77_001], prefixes: [12, 0, 900], suffixes: [0, 1500, 3] });
    expect(rare).toMatchObject({ quality: 'rare', rareNameIds: [120, 77_001], prefixIds: [12, 0, 900], suffixIds: [0, 1500, 3] });
    const crafted = readOne({ code: 'xtp', quality: 8, rareNames: [5, 6], prefixes: [1], suffixes: [] });
    expect(crafted).toMatchObject({ quality: 'crafted', rareNameIds: [5, 6], prefixIds: [1, 0, 0], suffixIds: [0, 0, 0] });
    expect(readOne({ code: 'xtp', quality: 9, rareNames: [7, 8] })).toMatchObject({
      quality: 'tempered',
      rareNameIds: [7, 8],
      prefixIds: [],
    });
  });

  it('keeps the superior / inferior variant', () => {
    expect(readOne({ code: 'sbw', quality: 3, qualityVariant: 4 })).toMatchObject({ quality: 'superior', qualityVariant: 4 });
    expect(readOne({ code: 'sbw', quality: 1, qualityVariant: 2 })).toMatchObject({ quality: 'inferior', qualityVariant: 2 });
  });

  it('keeps defense (minus Save Add) and durability; an indestructible item has no current durability', () => {
    expect(readOne({ code: 'xtp', defense: 345, maxDurability: 60, durability: 42 })).toMatchObject({
      defense: 345,
      maxDurability: 60,
      durability: 42,
    });
    expect(readOne({ code: 'sbw', maxDurability: 0 })).toMatchObject({ defense: null, maxDurability: 0, durability: null });
    expect(readOne({ code: 'jew' })).toMatchObject({ defense: null, maxDurability: null, durability: null });
  });

  it('keeps the personalized name, the runeword id and the runeword stats', () => {
    const item = readOne({
      code: 'xtp',
      sockets: 2,
      personalized: 'Mefi',
      runeword: { id: 63086, stats: [{ id: 107, param: 54, value: 2 }] },
      stats: [
        { id: 17, value: 30 },
        { id: 18, value: 30 },
      ],
    });
    expect(item).toMatchObject({ personalizedName: 'Mefi', runewordId: 63086, sockets: 2 });
    expect(item.runewordStats).toEqual([{ id: 107, param: 54, value: 2 }]);
    expect(item.stats).toHaveLength(2);
  });

  it('reports the item offset, the failing bit and the code when the bits make no sense', () => {
    // Stat 5 has no Save Bits in this data, so the list cannot be walked
    const writer = new BitWriter().write(0, 8);
    writeItem(writer, createStashData({ stats: [null, null, null, null, null, [7, 0, 0]], items: [['jew', 0, 1, 1]] }), {
      code: 'jew',
      stats: [{ id: 5, value: 1 }],
    });
    const reader = new BitReader(writer.bytes(), 8);
    let error: unknown;
    try {
      readItem(reader, createStashData({ stats: [], items: [['jew', 0, 1, 1]] }), { section: 0, index: 0 });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ItemReadError);
    expect(error).toMatchObject({ code: 'jew', itemBitOffset: 8, socketPath: [] });
    expect((error as ItemReadError).message).toContain('stat 5');
    expect((error as ItemReadError).bitOffset).toBeGreaterThan(8 + 32);
  });

  it('rejects an unknown item code', () => {
    const writer = new BitWriter();
    writeItem(writer, createStashData({ stats: [], items: [['zzz', 0, 1, 1]] }), { code: 'zzz', compact: true });
    expect(() => readItem(new BitReader(writer.bytes()), data, { section: 0, index: 0 })).toThrow(/unknown item code "zzz"/);
  });
});

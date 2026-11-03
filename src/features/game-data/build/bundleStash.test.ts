import { describe, expect, it } from 'vitest';
import { STASH_ITEM_FLAGS } from '../engine/schema.ts';
import { buildStashBundle } from './bundleStash.ts';
import { parseTsv } from './tsv.ts';

const tsv = (rows: string[][]) => parseTsv(rows.map((row) => row.join('\t')).join('\n'), 'test', { keepExpansionRows: true });

const ITEM_HEADER = ['name', 'namestr', 'code', 'type', 'invwidth', 'invheight', 'quest', 'questdiffcheck'];

describe('buildStashBundle', () => {
  const { bundle, warnings } = buildStashBundle(
    {
      itemstatcost: tsv([
        ['Stat', 'Save Bits', 'Save Add', 'Save Param Bits'],
        ['strength', '14', '1000', ''],
        ['hitpoints', '', '', ''],
        ['item_singleskill', '7', '0', '14'],
      ]),
      itemtypes: tsv([
        ['ItemType', 'Code', 'Equiv1', 'Equiv2'],
        ['Any Armor', 'armo', '', ''],
        ['Helm', 'helm', 'armo', ''],
        ['Weapon', 'weap', '', ''],
        ['Bow', 'bow', 'weap', ''],
        ['Charm', 'char', '', ''],
        ['Small Charm', 'scha', 'char', ''],
        ['Body Part', 'body', '', ''],
        ['Player Body Part', 'play', 'body', ''],
        ['Book', 'book', '', ''],
        ['Quest', 'ques', '', ''],
        ['Coupon', 'cpn1', '', ''],
      ]),
      weapons: tsv([ITEM_HEADER, ['Short Bow', 'sbw', 'sbw', 'bow', '2', '3', '0', '0']]),
      armor: tsv([ITEM_HEADER, ['Cap', 'cap', 'cap', 'helm', '2', '2', '0', '0']]),
      misc: tsv([
        ITEM_HEADER,
        ['Small Charm', 'cm1', 'cm1', 'scha', '1', '1', '0', '0'],
        ['Ear', 'ear', 'ear', 'play', '1', '1', '0', '0'],
        ['Heart', 'hrt', 'hrt', 'body', '1', '1', '0', '0'],
        ['Tome', 'tbk', 'tbk', 'book', '1', '2', '0', '0'],
        ['Key to Hell', 'qky', 'qky', 'ques', '1', '1', '1', '1'],
        ['Coupon nor Armor 1', '01c', '01c', 'cpn1', '1', '1', '0', '0'],
        ['Coupon Wild Card', '99j', '99j', 'coup', '1', '1', '0', '0'],
        ['Duplicate Bow', 'dup', 'sbw', 'misc', '1', '1', '0', '0'],
      ]),
      inventory: tsv([
        ['class', 'gridX', 'gridY'],
        ['Bank Page 1', '6', '8'],
        ['Big Bank Page 1', '16', '13'],
      ]),
    },
    new Map([['01c', "(Cap, Biggin's Bonnet)\nAncient Coupon"]])
  );

  it('keeps the saved stat widths by row and nulls the unsaved ones', () => {
    expect(bundle.stats).toEqual([[14, 1000, 0], null, [7, 0, 1]]);
  });

  it('flags item codes from their type hierarchy, first row of a code winning', () => {
    const byCode = new Map(bundle.items.map(([code, flags, width, height]) => [code, { flags, width, height }]));
    expect(byCode.get('sbw')).toEqual({ flags: STASH_ITEM_FLAGS.weapon, width: 2, height: 3 });
    expect(byCode.get('cap')?.flags).toBe(STASH_ITEM_FLAGS.armor);
    expect(byCode.get('cm1')?.flags).toBe(STASH_ITEM_FLAGS.charm);
    expect(byCode.get('hrt')?.flags).toBe(STASH_ITEM_FLAGS.bodyPart);
    expect(byCode.get('ear')?.flags).toBe(0);
    expect(byCode.get('tbk')?.flags).toBe(STASH_ITEM_FLAGS.scrollOrBook);
    expect(byCode.get('qky')?.flags).toBe(STASH_ITEM_FLAGS.questDifficulty);
    expect(bundle.items.filter(([code]) => code === 'sbw')).toHaveLength(1);
  });

  it('lists the coupons with their string-table names and the stash page grid', () => {
    expect(bundle.coupons).toEqual([
      { code: '01c', name: "Ancient Coupon (Cap, Biggin's Bonnet)", type: 'cpn1' },
      { code: '99j', name: 'Coupon Wild Card', type: 'coup', wildCard: true },
    ]);
    expect(bundle.grid).toEqual({ width: 16, height: 13 });
    expect(warnings).toEqual([]);
  });
});

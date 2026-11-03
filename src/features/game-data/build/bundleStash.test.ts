import { describe, expect, it } from 'vitest';
import { STASH_ITEM_FLAGS } from '../engine/schema.ts';
import { buildStashBundle } from './bundleStash.ts';
import { readCouponRecipes } from './coupons.ts';
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
        ['Coupon', 'coup', '', ''],
        ['Coupon norm', 'cpn1', 'coup', ''],
        ['Coupon elite', 'cpn3', 'coup', ''],
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
        ['Coupon eli Armor 1', '01e', '01e', 'cpn3', '1', '1', '0', '0'],
        ['Coupon Blank nor', '96j', '96j', 'cpn1', '1', '1', '0', '0'],
        ['Coupon Wild Card', '99j', '99j', 'coup', '1', '1', '0', '0'],
        ['Duplicate Bow', 'dup', 'sbw', 'misc', '1', '1', '0', '0'],
      ]),
      inventory: tsv([
        ['class', 'gridX', 'gridY'],
        ['Bank Page 1', '6', '8'],
        ['Big Bank Page 1', '16', '13'],
      ]),
      cubemain: tsv([
        ['description', 'enabled', 'numinputs', 'input 1', 'input 2', 'input 3', 'output'],
        ['Coupon', '1', '3', '"01c,qty=3"', '', '', 'War Bonnet'],
        ['Coupon', '1', '3', '"01c,qty=2"', '99j', '', 'War Bonnet'],
        ['Coupon', '1', '3', '"01e,qty=3"', '', '', 'Unknown Unique'],
        ['Coupon', '0', '3', '"01e,qty=3"', '', '', 'Disabled Unique'],
        ['Coupon', '1', '8', '"cpn1,qty=8"', '', '', '99j'],
        ['Coupon', '1', '2', '"cpn3,qty=2"', '', '', '99j'],
        ['Coupon Reroll', '1', '4', 'rnd', '"cpn1,qty=3"', '', '01c'],
        ['Coupon reroll in place', '1', '3', '"01c,qty=3"', '', '', '01c'],
        ['Gem upgrade', '1', '3', '"gzv,qty=2"', '99j', '', 'gpv'],
      ]),
      uniqueitems: tsv([
        ['index', 'code'],
        ['Expansion', ''],
        ['War Bonnet', 'cap'],
        ['War Bonnet', 'cap'],
      ]),
    },
    new Map([
      ['01c', "(Cap, Biggin's Bonnet)\nAncient Coupon"],
      ['War Bonnet', "Biggin's Bonnet"],
    ])
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

  it('lists the coupons with their string-table names, recipes and the stash page grid', () => {
    expect(bundle.coupons).toEqual([
      {
        code: '01c',
        name: "Ancient Coupon (Cap, Biggin's Bonnet)",
        type: 'cpn1',
        unique: { id: 1, name: "Biggin's Bonnet" },
        qty: 3,
        withWildCards: { qty: 2, wildCards: 1 },
      },
      { code: '01e', name: 'Coupon eli Armor 1', type: 'cpn3' },
      { code: '96j', name: 'Coupon Blank nor', type: 'cpn1' },
      { code: '99j', name: 'Coupon Wild Card', type: 'coup', wildCard: true },
    ]);
    expect(bundle.grid).toEqual({ width: 16, height: 13 });
  });

  it('labels the coupon tiers and reads how many coupons of a tier make a Wild Card', () => {
    expect(bundle.couponTiers).toEqual([
      { type: 'cpn1', label: 'Normal', wildCardFrom: 8 },
      { type: 'cpn3', label: 'Elite', wildCardFrom: 2 },
    ]);
  });

  it('warns about a coupon recipe whose output is no unique', () => {
    expect(warnings).toEqual(['stash: coupon 01e makes "Unknown Unique" (cubemain line 4), which is no unique']);
  });
});

describe('readCouponRecipes', () => {
  const cubemain = tsv([
    ['description', 'enabled', 'numinputs', 'input 1', 'input 2', 'output'],
    ['Coupon', '1', '3', '"02c,qty=3"', '', 'Hotspur'],
    ['Coupon', '1', '4', '"02c,qty=2"', '"99j,qty=4"', 'Hotspur'],
    ['Coupon', '1', '4', '"cpn2,qty=4"', '', '99j'],
    ['Coupon', '1', '2', '"02c,qty=2"', '"03c,qty=1"', 'Mixed'],
  ]);
  const { byCode, wildCardFrom } = readCouponRecipes(cubemain, new Set(['02c', '03c']), new Set(['cpn2']), '99j');

  it('reads the coupon-only and the Wild Card recipes of a code, with numinputs', () => {
    expect(byCode.get('02c')).toEqual([
      { qty: 3, wildCards: 0, output: 'Hotspur', numInputs: 3, line: 2 },
      { qty: 2, wildCards: 4, output: 'Hotspur', numInputs: 4, line: 3 },
    ]);
  });

  it('skips rows mixing two coupon codes and reads the Wild Card recipe per tier', () => {
    expect(byCode.get('03c')).toBeUndefined();
    expect(wildCardFrom).toEqual(new Map([['cpn2', 4]]));
  });
});

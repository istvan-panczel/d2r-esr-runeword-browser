import { describe, expect, it } from 'vitest';
import type { MaterialItem, SourceLabel } from '../engine/schema.ts';
import { buildMaterialsBundle, CONTAINER_GROUP, enhanceRolesByCode, type MaterialsInput } from './bundleMaterials.ts';
import type { CubeRow } from './cube/cubeRows.ts';
import { parseTsv } from './tsv.ts';

const table = (rows: string[][]) => parseTsv(rows.map((row) => row.join('\t')).join('\n'));

const COLUMNS = ['name', 'code', 'type', 'type2', 'level', 'levelreq', 'spawnable', 'stackable', 'quest'];
const MISC = table([
  COLUMNS,
  ['Small Charm', 'cm1', 'scha', '', '1', '0', '1', '0', ''],
  ['Small Charm', 'cx1', 'scha', '', '1', '0', '1', '0', ''],
  ['Gold', 'gld', 'gold', '', '0', '0', '1', '0', ''],
  ['Chipped Ruby', 'gcr', 'gemr', 'gem0', '1', '1', '1', '0', ''],
  ['Perfect Ruby', 'gpr', 'gemr', 'gem5', '1', '30', '1', '0', ''],
  ['Perfect Topaz', 'gpy', 'gemt', 'gem5', '1', '30', '1', '0', ''],
  ['El Rune', 'r01', 'rune', '', '11', '11', '1', '0', ''],
  ['Heart', 'hrt', 'body', '', '0', '0', '1', '0', ''],
  ['Ancient Scroll 1', '01a', 'asc1', '', '0', '0', '0', '0', ''],
  ['Lost Scroll', '99a', 'asc1', '', '0', '0', '0', '0', ''],
  ['Khalim Eye', 'qey', 'ques', '', '0', '0', '0', '0', '1'],
  ['Horadric Cube', 'box', 'ques', '', '0', '0', '1', '0', '1'],
  ['Magic Eraser', 'me1', 'cube', '', '0', '0', '1', '0', ''],
  ['Rune Stocker', 's01', 'can2', '', '0', '0', '1', '0', ''],
  ['Rune Stocker', 's02', 'can2', '', '0', '0', '1', '0', ''],
  ['Rune Stocker', 's03', 'can2', '', '0', '0', '1', '0', ''],
  ['Introductory Book', 'ib1', 'scrl', '', '0', '0', '1', '0', ''],
  ['Introductory Book', 'ib2', 'scrl', '', '0', '0', '1', '0', ''],
  ['Ancient Scroll', '01b', 'scrl', '', '5', '0', '1', '0', ''],
  ['Coupon nor 1', '01c', 'cpn1', '', '1', '1', '1', '0', ''],
  ['Coupon nor 2', '02c', 'cpn1', '', '1', '1', '1', '0', ''],
  ['Coupon nor Ring', '01j', 'cpn1', '', '1', '1', '1', '0', ''],
  ['Coupon eli 1', '01e', 'cpn3', '', '1', '1', '1', '0', ''],
  ['Coupon Wild Card', '99j', 'coup', '', '1', '1', '1', '0', ''],
  ['Decal 1', '01l', 'coup', '', '1', '1', '1', '0', ''],
  ['Decal 2', '02l', 'coup', '', '1', '1', '1', '0', ''],
  ['Healing Potion', 'hp1', 'hpot', '', '0', '0', '1', '0', ''],
  ['Key', 'key', 'key', '', '0', '0', '1', '1', ''],
]);

const NAMES: Readonly<Record<string, string>> = {
  '01c': 'Ancient Coupon (Buckler, Pelta Lunata)',
  '02c': 'Ancient Coupon (Cap, Biggin)',
  '01j': 'Ancient Coupon Ring I',
  '01e': 'Ancient Coupon (Shako, Harlequin Crest)',
  '99j': 'Ancient Coupon (Wild Card)',
  '01l': 'Ancient Decal (I -> El)',
  '02l': 'Ancient Decal (U -> Eld)',
};

type TypeRow = MaterialsInput['types'][number];
function type(code: string, parents: string[], name = code): TypeRow {
  return { code, name, parents, ancestors: [code] };
}
const TYPE_ROWS: TypeRow[] = [
  type('misc', []),
  type('char', ['misc'], 'Charm'),
  type('scha', ['char'], 'Small Charm'),
  type('gold', ['misc'], 'Gold'),
  type('sock', ['misc'], 'Socket Filler'),
  type('gem', ['sock'], 'Gem'),
  type('gemr', ['gem'], 'Ruby'),
  type('gemt', ['gem'], 'Topaz'),
  type('gem0', ['gem'], 'Chipped Gem'),
  type('gem5', ['gem'], 'Perfect Gem'),
  type('rune', ['sock'], 'Rune'),
  type('body', ['misc'], 'Body Part'),
  type('scrl', [], 'Ancient Scroll'),
  type('asc1', ['scrl'], 'Ancient Scroll Low'),
  type('ques', [], 'Quest'),
  type('cube', ['misc'], 'Cube Materials'),
  type('can2', ['misc'], 'Gem Can 2'),
  type('coup', ['misc'], 'Coupon'),
  type('cpn1', ['coup'], 'Coupon norm'),
  type('cpn3', ['coup'], 'Coupon elite'),
  type('poti', ['misc'], 'Potion'),
  type('hpot', ['poti'], 'Healing Potion'),
  type('key', ['misc'], 'Key'),
  type('weap', [], 'Weapon'),
  type('axe', ['weap'], 'Axe'),
];
// Ancestors from the parents (the itemtypes Equiv walk)
const byCode = new Map(TYPE_ROWS.map((row) => [row.code, row]));
const TYPES = TYPE_ROWS.map((row) => {
  const ancestors: string[] = [];
  const walk = (code: string) => {
    if (ancestors.includes(code)) return;
    ancestors.push(code);
    for (const parent of byCode.get(code)?.parents ?? []) walk(parent);
  };
  walk(row.code);
  return { ...row, ancestors };
});

let line = 1;
function cubeRow(description: string, inputs: string[], outputs: string[]): CubeRow {
  line++;
  return { line, description, cls: '', minDiff: 0, inputs, outputs: outputs.map((spec) => ({ spec, mods: [] })), condition: null };
}

const gemUpgrade = [cubeRow('Gem 1', ['gcr,qty=3'], ['gpr']), cubeRow('Gem 2', ['gem0,qty=3'], ['gpy'])];
const forging = [cubeRow('Forge any', ['any', 'gem5'], ['useitem']), cubeRow('Forge charm', ['scha', 'r01'], ['useitem'])];
const coupons = [
  cubeRow('Coupon 1', ['01c'], ['Pelta Lunata']),
  cubeRow('Coupon 2', ['02c', '99j'], ['Biggin']),
  cubeRow('Coupon ring', ['01j'], ['rin']),
  cubeRow('Coupon reroll', ['01c', 'rnd'], ['02c']),
];
const scrolls = [cubeRow('Scroll id', ['01b', 'ddd'], ['01a']), cubeRow('Scroll 1', ['01a', 'axe'], ['useitem', '01a'])];
const quest = [cubeRow('Khalim', ['qey', 'hrt'], ['qf1'])];
const stockers = [cubeRow('Rune Stocker', ['s01', 'r01'], ['s01']), cubeRow('Stocker out', ['s01'], ['r01'])];

const FAMILIES = [
  { id: 'gem-upgrade', label: 'Gem upgrades', order: 0 },
  { id: 'forging', label: 'Forging', order: 1 },
  { id: 'coupon-tiers', label: 'Coupons', order: 2 },
  { id: 'ancient-scrolls', label: 'Ancient Scrolls', order: 3 },
  { id: 'secret', label: 'Secret recipes', order: 4 },
  { id: 'quest-items', label: 'Quest items', order: 5 },
];

const label = (kind: SourceLabel['kind'], text: string): SourceLabel => ({ kind, text });

const input: MaterialsInput = {
  misc: MISC,
  types: TYPES,
  bases: [
    { code: 'cm1', name: 'Small Charm', type: 'scha', type2: null },
    { code: 'hax', name: 'Hand Axe', type: 'axe', type2: null },
  ],
  nameOf: (code) => NAMES[code] ?? MISC.rows.find((row) => row.str('code') === code)?.str('name') ?? code,
  cubeRows: [...gemUpgrade, ...forging, ...coupons, ...scrolls, ...quest, ...stockers],
  familyRows: new Map([
    ['gem-upgrade', gemUpgrade],
    ['forging', forging],
    ['coupon-tiers', coupons],
    ['ancient-scrolls', [scrolls[0] as CubeRow]],
    ['secret', [scrolls[1] as CubeRow]],
    ['quest-items', quest],
  ]),
  families: FAMILIES,
  sources: {
    items: [
      { name: 'Perfect Ruby', code: 'gpr', item: 'misc', labels: [label('cube', 'Cube'), label('drop', 'Drops (random)')] },
      // Joined by name for the other stocker codes; its Cube label comes from the hidden stocker rows only
      { name: 'Rune Stocker', code: 's01', item: 'misc', labels: [label('cube', 'Cube'), label('buy', 'Buy: Gheed')] },
      { name: 'El Rune', code: 'r01', item: 'misc', labels: [label('cube', 'Cube'), label('drop', 'Drops (random)')] },
      { name: 'Heart', code: 'hrt', item: 'unique', labels: [label('boss', 'Drops from Somebody')] },
    ],
  },
  miscLabels: (code) => (code === 'hp1' ? [label('buy', 'Buy: Akara')] : [label('unknown', 'Unknown')]),
  enhance: {
    corruption: { reagent: { code: 'gpy', name: 'Perfect Topaz' }, notes: [] },
    anointment: {
      reagent: { code: 'key', name: 'Key' },
      blockedQualities: [],
      noRunewords: true,
      charmReagents: [{ code: 'hrt', name: 'Heart' }],
      vesselItem: 'Vessel',
    },
    vesselRecipes: [],
    vesselTransforms: [{ materials: [{ code: 'hrt', name: 'Heart', qty: 1 }], output: { code: 'x', name: 'X' }, keepsMods: false }],
  },
};

const result = buildMaterialsBundle(input);
const { bundle } = result;
const item = (code: string): MaterialItem | undefined => bundle.items.find((entry) => entry.code === code);
const codes = () => bundle.items.map((entry) => entry.code);

describe('buildMaterialsBundle', () => {
  it('keeps spawnable rows and rows a cube row names, without bases, base copies, gold and unused quest or eraser rows', () => {
    expect(codes()).not.toContain('cm1');
    expect(codes()).not.toContain('cx1');
    expect(codes()).not.toContain('gld');
    expect(codes()).not.toContain('99a'); // not spawnable, in no cube row
    expect(codes()).not.toContain('box'); // quest, no listed recipe
    expect(codes()).not.toContain('me1'); // Magic Eraser, no listed recipe
    expect(codes()).toContain('01a'); // not spawnable, made by a cube row
    expect(codes()).toContain('qey'); // quest item used by a listed recipe
    expect(result.excluded).toEqual({ bases: 2, gold: 1, unlisted: 1, quest: 1, unused: 1 });
  });

  it('groups by the topmost type below misc in the misc browser order, containers last', () => {
    expect(bundle.groups.map((group) => group.code)).toEqual(['sock', 'poti', 'ques', 'scrl', 'body', 'coup', 'key', CONTAINER_GROUP]);
    expect(bundle.groups.find((group) => group.code === 'sock')?.blocks).toEqual([
      { code: 'gem', label: 'Gem' },
      { code: 'rune', label: 'Rune' },
    ]);
    expect(item('gpr')).toMatchObject({ group: 'sock', block: 'gem', grade: 'Perfect' });
    expect(item('gcr')?.grade).toBe('Chipped');
  });

  it('collapses container types into one row in the containers group, and same-named rows of a block', () => {
    expect(item('s01')).toMatchObject({ group: CONTAINER_GROUP, block: 'can2', name: 'Rune Stocker', variants: 3 });
    expect(bundle.groups.at(-1)?.blocks).toEqual([{ code: 'can2', label: 'Rune Stocker' }]);
    expect(item('ib1')).toMatchObject({ group: 'scrl', block: 'scrl', variants: 2 });
    expect(item('01b')?.variants).toBeUndefined();
    expect(result.collapsed).toBe(2 + 1 + 2 + 1); // stockers, books, normal coupons (3 → 1), decals
  });

  it('collapses coupons per tier (rings included), keeps the Wild Card, and decals by name prefix', () => {
    const coupons = bundle.items.filter((entry) => entry.group === 'coup').map((entry) => [entry.name, entry.variants]);
    expect(bundle.groups.find((group) => group.code === 'coup')?.blocks).toEqual([{ code: 'coup', label: 'Coupon' }]);
    expect(coupons).toEqual([
      ['Ancient Coupons (normal tier)', 3],
      ['Ancient Coupons (elite tier)', undefined],
      ['Ancient Coupon (Wild Card)', undefined],
      ['Ancient Decal', 2],
    ]);
    // One row with both coupons counts once; the reroll gives 02c, so the tier is made by the cube
    expect(item('01c')?.usedIn).toEqual([{ family: 'coupon-tiers', recipes: 4 }]);
    expect(item('01c')?.madeBy).toEqual([{ family: 'coupon-tiers', recipes: 1 }]);
  });

  it('counts uses directly and through misc item types, never through any or base types', () => {
    expect(item('gcr')?.usedIn).toEqual([{ family: 'gem-upgrade', recipes: 2 }]);
    expect(item('gpr')?.usedIn).toEqual([{ family: 'forging', recipes: 1 }]); // gem5
    expect(item('gpr')?.madeBy).toEqual([{ family: 'gem-upgrade', recipes: 1 }]);
    // `any`, `scha` (covers the Small Charm base) and `axe` (a weapon type) match no material
    expect(item('r01')?.usedIn).toEqual([{ family: 'forging', recipes: 1 }]);
    expect(item('hrt')?.usedIn).toEqual([{ family: 'quest-items', recipes: 1 }]);
    expect(item('hp1')?.usedIn).toEqual([]);
  });

  it('does not count a returned input as made, nor hidden stocker rows at all', () => {
    expect(item('01a')?.madeBy).toEqual([{ family: 'ancient-scrolls', recipes: 1 }]);
    expect(item('01a')?.usedIn).toEqual([{ family: 'secret', recipes: 1 }]);
    expect(item('s01')?.usedIn).toEqual([]);
  });

  it('joins sources by code, then by name, else computes them; drops Cube when no listed family makes it', () => {
    expect(item('gpr')?.sources.map((entry) => entry.text)).toEqual(['Cube', 'Drops (random)']);
    expect(item('s01')?.sources.map((entry) => entry.text)).toEqual(['Buy: Gheed']);
    expect(item('r01')?.sources.map((entry) => entry.text)).toEqual(['Drops (random)']);
    expect(item('hp1')?.sources.map((entry) => entry.text)).toEqual(['Buy: Akara']);
    // The unique named Heart is not the misc Heart
    expect(item('hrt')?.sources.map((entry) => entry.text)).toEqual(['Unknown']);
  });

  it('gives the sanctification reagent its Enhance role', () => {
    const roles = enhanceRolesByCode({
      ...input.enhance,
      sanctification: { reagent: { code: 'u18', name: 'Relic' }, item: { code: 'jewl', name: 'Jewel' }, rollRange: 2, once: true },
    });
    expect(roles.get('u18')).toEqual([{ tab: 'sanctification', label: 'Sanctification reagent' }]);
  });

  it('gives the Standard of Heroes its Enhance role', () => {
    const roles = enhanceRolesByCode({ ...input.enhance, standardOfHeroes: { reagent: { code: 'std', name: 'Standard' }, once: true } });
    expect(roles.get('std')).toEqual([{ tab: 'standard', label: 'Unique charm upgrade' }]);
  });

  it('lists enhance roles and the referenced families in cube order', () => {
    expect(item('gpy')?.enhance).toEqual([{ tab: 'corruption', label: 'Corruption reagent' }]);
    expect(item('key')?.enhance).toEqual([{ tab: 'anointment', label: 'Anointment reagent' }]);
    expect(item('hrt')?.enhance).toEqual([
      { tab: 'anointment', slot: 'charm', label: 'Unique charm anointment' },
      { tab: 'vessel', label: 'Vessel of Souls material' },
    ]);
    expect(bundle.families.map((family) => family.id)).toEqual([
      'gem-upgrade',
      'forging',
      'coupon-tiers',
      'ancient-scrolls',
      'secret',
      'quest-items',
    ]);
    expect(item('key')).toMatchObject({ stackable: true, level: 0, levelreq: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { buildCraftingBundle, type CraftingInput } from './bundleCrafting.ts';
import type { CubeRow } from './cube/cubeRows.ts';
import type { PropertyMod } from './model.ts';

type Mod = [mod: string, min: number, param?: string];

/** A cubemain row: the item, the ingredients, `useitem` with the mods; `numbered` sets the line */
function row(description: string, inputs: string[], mods: Mod[], options: { output?: string; cap?: number } = {}): CubeRow {
  return {
    line: 0,
    description,
    cls: '',
    minDiff: 0,
    inputs,
    outputs: [{ spec: options.output ?? 'useitem', mods: mods.map(([mod, min, param]) => ({ mod, param: param ?? '', min, max: min })) }],
    condition: options.cap === undefined ? null : { op: 16, param: 584, value: options.cap },
  };
}

/** Line N is the Nth row of the fixture */
function numbered(rows: CubeRow[]): CubeRow[] {
  return rows.map((entry, i) => ({ ...entry, line: i + 1 }));
}

/** Lines read "code min" so the tests see which mods were rendered */
const renderMods = (mods: readonly PropertyMod[]) => ({
  lines: mods.map((mod) => `${mod.code}${mod.param === null ? '' : `[${mod.param}]`} ${String(mod.min)}`),
  warnings: [],
});

const NAMES = new Map([
  ['gcv', 'Chipped Amethyst'],
  ['gcb', 'Chipped Sapphire'],
  ['r01', 'I Rune'],
  ['r84', 'Moon Rune'],
  ['an3', 'Green Aura Stone'],
  ['ppp', 'Dragon Stone'],
  ['eee', 'Blackmoor'],
  ['key', 'Key'],
  ['ggb', 'Perfect Emerald'],
]);

const BASES = [
  { ancestors: ['wand', 'rod', 'blun', 'mele', 'weap'] },
  { ancestors: ['axe', 'mele', 'weap', '2hsw'] },
  { ancestors: ['shie', 'shld', 'armo', 'seco'] },
  { ancestors: ['jewl', 'sock', 'misc'] },
  { ancestors: ['scha', 'char', 'misc'] },
];

function input(cube: CubeRow[]): CraftingInput {
  return {
    cube,
    nameOf: (token) => NAMES.get(token) ?? token,
    classes: [
      { code: 'ama', name: 'Amazon' },
      { code: 'war', name: 'Warlock' },
    ],
    bases: BASES,
    renderMods,
  };
}

describe('buildCraftingBundle: forgings', () => {
  const cube = numbered([
    row(
      'Skill Forging Unique Jewel',
      ['jewl,uni', 'qqq,qty=2', 'gck'],
      [
        ['craftflag2', 8],
        ['war', 1],
      ]
    ),
    row(
      'Weapon Skill Forging War',
      ['weap,nru', 'qqq,qty=2', 'gck'],
      [
        ['craftflag', 19],
        ['war', 1],
      ]
    ),
    row(
      'Armor Skill Forging War',
      ['armo,nru', 'qqq,qty=2', 'gck'],
      [
        ['craftflag', 19],
        ['war', 1],
      ]
    ),
    row(
      'Ring Skill Forging Ama',
      ['ring', 'qqq,qty=2', 'gcg'],
      [
        ['craftflag', 1],
        ['ama', 1],
      ]
    ),
    row(
      'Unique Charm Skill Forging Ama',
      ['char,uni', 'qqq,qty=2', 'gcg'],
      [
        ['craftflag', 1],
        ['ama', 1],
      ]
    ),
    row(
      'All Skill Forging Unique',
      ['amul,uni', 'map', 'qqq', 'gem0'],
      [
        ['craftflag', 128],
        ['allskills', 1],
      ]
    ),
    row(
      'Low Quality Stat Forging Bar_weap',
      ['weap,low,nru', 'qqq', 'gcv'],
      [
        ['craftflag', 14],
        ['dmgpct', 48],
      ]
    ),
    row(
      'Low Quality Stat Forging Bar_armo',
      ['armo,low,nru', 'qqq', 'gcv'],
      [
        ['craftflag', 15],
        ['ac%', 48],
      ]
    ),
    row(
      'Low Quality Stat Forging Bar_else',
      ['any,low,nru', 'qqq', 'gcv'],
      [
        ['craftflag', 16],
        ['crush', 12],
      ]
    ),
    row(
      'Low Quality Stat Forging Sor_else',
      ['any,low,nru', 'qqq', 'gcb'],
      [
        ['craftflag', 10],
        ['mana%', 16],
      ]
    ),
    row(
      'Uni Stat Forging Bar_weap',
      ['weap,uni', 'qqq', 'gcv'],
      [
        ['craftflag', 14],
        ['dmgpct', 50],
      ]
    ),
    row(
      'Rune Forging wand',
      ['wand,nru', 'r01,qty=2', 'gem0'],
      [
        ['craftflag', 375],
        ['ac', 30],
      ]
    ),
    row(
      'Rune Forging weap',
      ['weap,nru', 'r84,qty=2', 'gem0'],
      [
        ['craftflag', 193],
        ['allskills', 1],
        ['extra-mag2', 15],
      ]
    ),
    row(
      'Rune Forging weap',
      ['weap,nru', 'r01,qty=2', 'gem0'],
      [
        ['craftflag', 129],
        ['dmgpct', 15],
      ]
    ),
    row(
      'Rune Forging glov',
      ['glov,nru', 'r01,qty=2', 'gem0'],
      [
        ['craftflag', 129],
        ['dmg-min', 5],
      ]
    ),
    row(
      'Rune Forging armo',
      ['armo,nru', 'r01,qty=2', 'gem0'],
      [
        ['craftflag', 129],
        ['ac%', 15],
      ]
    ),
    row(
      'Rune Forging Jewel W',
      ['jewl', 'r01,qty=2', 'gem0', 'tsc'],
      [
        ['craftflag2', 129],
        ['dmg%', 15],
      ]
    ),
    row(
      'Aura Forging',
      ['amul', 'an3', 'gem0'],
      [
        ['craftflag', 184],
        ['aura', 10, '529'],
      ]
    ),
    row(
      'Aura Forging',
      ['amul', 'an4', 'gem0'],
      [
        ['craftflag', 185],
        ['aura', 15, '543'],
      ]
    ),
    row('Remove Rune Forging', ['weap', 'r01', 'yps'], [['craftflag', -129]]),
    row('Rune Forging weap', ['weap,nru', 'r02,qty=2', 'gem0'], [['craftflag', 130]]),
    row(
      'Weapon Skill Forging Odd',
      ['weap,nru', 'qqq,qty=2', 'gcx'],
      [
        ['craftflag', 20],
        ['allskills', 1],
      ]
    ),
    row(
      'Armor Skill Forging Odd',
      ['zzzz', 'qqq,qty=2', 'gck'],
      [
        ['craftflag', 19],
        ['war', 1],
      ]
    ),
  ]);
  const { bundle, warnings, rowsUsed, rowsSkipped } = buildCraftingBundle(input(cube));
  const forging = (kind: string, key: string) => bundle.forgings.find((option) => option.kind === kind && option.key === key);

  it('reads the class of a skill forging from its bonus, in class order, on every slot the item types allow', () => {
    expect(bundle.forgings.filter((option) => option.kind === 'skill').map((option) => [option.key, option.label])).toEqual([
      ['ama', 'Amazon'],
      ['war', 'Warlock'],
    ]);
    expect(forging('skill', 'war')?.bySlot).toEqual({
      weapon: ['war 1'],
      shield: ['war 1'],
      helmet: ['war 1'],
      armor: ['war 1'],
      gloves: ['war 1'],
      boots: ['war 1'],
      belt: ['war 1'],
    });
    expect(forging('skill', 'ama')?.bySlot).toEqual({ ring: ['ama 1'] });
    expect(forging('all', 'all')).toEqual({ kind: 'all', key: 'all', label: 'All skills', bySlot: { amulet: ['allskills 1'] } });
  });

  it('gives each slot the first row that accepts it (weapon row before the any row)', () => {
    expect(forging('stat', 'gcv')).toEqual({
      kind: 'stat',
      key: 'gcv',
      label: 'Chipped Amethyst',
      bySlot: {
        weapon: ['dmgpct 48'],
        shield: ['ac% 48'],
        helmet: ['ac% 48'],
        armor: ['ac% 48'],
        gloves: ['ac% 48'],
        boots: ['ac% 48'],
        belt: ['ac% 48'],
        amulet: ['crush 12'],
        ring: ['crush 12'],
      },
    });
    expect(forging('stat', 'gcb')?.bySlot.weapon).toEqual(['mana% 16']);
    expect(warnings).toContain('crafting: stat forging "Chipped Amethyst" on weapon: cubemain line 11 differs from an earlier weap row');
  });

  it('lets the glove rune forging row beat the armo row, sorts runes by code and skips wands and jewels', () => {
    expect(bundle.forgings.filter((option) => option.kind === 'rune').map((option) => option.key)).toEqual(['r01', 'r02', 'r84']);
    expect(forging('rune', 'r01')?.bySlot).toEqual({
      weapon: ['dmgpct 15'],
      shield: ['ac% 15'],
      helmet: ['ac% 15'],
      armor: ['ac% 15'],
      gloves: ['dmg-min 5'],
      boots: ['ac% 15'],
      belt: ['ac% 15'],
    });
    expect(forging('rune', 'r84')?.bySlot.weapon).toEqual(['allskills 1', 'extra-mag2 15']);
  });

  it('renders aura forgings with the aura param, amulet only', () => {
    expect(forging('aura', 'an3')).toEqual({ kind: 'aura', key: 'an3', label: 'Green Aura Stone', bySlot: { amulet: ['aura[529] 10'] } });
  });

  it('warns about rows without a bonus, an unknown item type or class', () => {
    expect(warnings).toContain('crafting: cubemain line 21 "Rune Forging weap" renders no bonus line');
    expect(warnings).toContain('crafting: cubemain line 22 "Weapon Skill Forging Odd": cannot tell which skill forging it is');
    expect(warnings).toContain('crafting: cubemain line 23 "Armor Skill Forging Odd": item type "zzzz" maps to no slot');
    expect(warnings).toHaveLength(4);
    // Jewel (2), charm, wand, unknown class, unknown type skipped; the removal row is not a forging
    expect(rowsSkipped).toBe(6);
    expect(rowsUsed).toBe(16);
  });
});

describe('buildCraftingBundle: D-stoning and gem melding', () => {
  const cube = numbered([
    row(
      'DS + Any Weapon',
      ['weap', 'ppp'],
      [
        ['levelreq', 2],
        ['swing2', 5],
        ['swing2-cap', 5],
      ],
      { cap: 116 }
    ),
    row(
      'DS + Any Weapon',
      ['weap', 'ppp'],
      [
        ['levelreq', 2],
        ['swing2', 4],
        ['swing2-cap', 4],
      ],
      { cap: 117 }
    ),
    row(
      'DS + Any Weapon',
      ['weap', 'ppp'],
      [
        ['levelreq', 2],
        ['swing2', 3],
        ['swing2-cap', 3],
      ],
      { cap: 118 }
    ),
    row(
      'HS + Any Weapon',
      ['weap', 'hly'],
      [
        ['levelreq', 2],
        ['dmg-undead', 12],
        ['dmg-undead-cap', 12],
      ],
      { cap: 500 }
    ),
    row(
      'HS + Any Weapon',
      ['weap', 'hly'],
      [
        ['levelreq', 2],
        ['dmg-undead', 12],
        ['dmg-undead-cap', 12],
      ],
      { cap: 501 }
    ),
    row(
      'DS + Any Torso',
      ['tors', 'ppp'],
      [
        ['levelreq', 3],
        ['swing1', 5],
        ['swing2-cap', 5],
      ],
      { cap: 119 }
    ),
    row(
      'DS + Any Armor',
      ['armo', 'ppp'],
      [
        ['levelreq', 4],
        ['swing1', 5],
        ['swing2-cap', 5],
      ],
      { cap: 119 }
    ),
    row(
      'DS + Any Weapon + key',
      ['2hsw,eli', 'ppp', 'key'],
      [
        ['levelreq', 2],
        ['extra-fire', 5],
        ['extra-fire-cap', 5],
      ],
      { cap: 299 }
    ),
    row(
      'DS + Any Weapon + key',
      ['2hsw', 'ppp', 'key'],
      [
        ['levelreq', 2],
        ['extra-fire', 3],
        ['extra-fire-cap', 3],
      ],
      { cap: 299 }
    ),
    row(
      'DS + Any Weapon + key',
      ['weap,exc', 'ppp', 'key'],
      [
        ['levelreq', 2],
        ['extra-fire', 3],
        ['extra-fire-cap', 3],
      ],
      { cap: 299 }
    ),
    row(
      'DS + Any Weapon + key',
      ['weap', 'ppp', 'key'],
      [
        ['levelreq', 2],
        ['extra-fire', 2],
        ['extra-fire-cap', 2],
      ],
      { cap: 299 }
    ),
    row(
      'BM + Any Weapon + key',
      ['weap', 'eee', 'key'],
      [
        ['levelreq', 2],
        ['extra-ele', 1],
        ['extra-ele-cap', 1],
      ],
      { cap: 300 }
    ),
    row(
      'BM + Any Weapon + key',
      ['weap', 'eee', 'key'],
      [
        ['levelreq', 2],
        ['cast1', 3],
      ],
      { cap: 300 }
    ),
    row('VS + Any Weapon + vps', ['weap', 'vvv', 'vps'], [], { output: 'void' }),
    // No cap condition: no cap
    row(
      'FH + Any Weapon',
      ['weap', 'hh2'],
      [
        ['levelreq', 2],
        ['dmg%', 12],
      ]
    ),
    row(
      'TO + Any Weapon',
      ['weap', 'ttt'],
      [
        ['levelreq', 2],
        ['hp%', 1],
        ['hp%-cap', 1],
      ],
      { cap: 56 }
    ),
    row(
      'TO + Any Weapon',
      ['weap', 'ttt'],
      [
        ['levelreq', 2],
        ['hp%', 2],
        ['hp%-cap', 2],
      ],
      { cap: 57 }
    ),
    row(
      'P-Eme + Any Wand + 3 ddd',
      ['wand', 'ggb', 'ddd,qty=3'],
      [
        ['levelreq', 2],
        ['dex', 5],
        ['meldflag', 1],
      ]
    ),
    row(
      'P-Eme + Any Weapon + 3 ddd',
      ['weap', 'ggb', 'ddd,qty=3'],
      [
        ['levelreq', 2],
        ['crush', 5],
        ['meldflag', 1],
      ]
    ),
    row(
      'P-Eme + Any Helm + 3 ddd',
      ['helm', 'ggb', 'ddd,qty=3'],
      [
        ['levelreq', 3],
        ['dex', 5],
        ['meldflag', 1],
      ]
    ),
  ]);
  const { bundle, warnings, rowsUsed, rowsSkipped } = buildCraftingBundle(input(cube));
  const option = (kind: string, material: string, switchItem?: string) =>
    bundle.stacking.find((entry) => entry.kind === kind && entry.material.code === material && entry.switchItem?.code === switchItem);

  it('groups the rows of one D-stoning into steps, the first row giving the lines and level requirement', () => {
    expect(option('dstone', 'ppp')).toEqual({
      kind: 'dstone',
      material: { code: 'ppp', label: 'Dragon Stone' },
      bySlot: {
        weapon: { lines: ['swing2 5'], levelReq: 2, steps: [5, 4, 3], cap: 120, capLines: ['swing2 120'] },
        shield: { lines: ['swing1 5'], levelReq: 4, steps: [5], cap: 120, capLines: ['swing1 120'] },
        helmet: { lines: ['swing1 5'], levelReq: 4, steps: [5], cap: 120, capLines: ['swing1 120'] },
        armor: { lines: ['swing1 5'], levelReq: 3, steps: [5], cap: 120, capLines: ['swing1 120'] },
        gloves: { lines: ['swing1 5'], levelReq: 4, steps: [5], cap: 120, capLines: ['swing1 120'] },
        boots: { lines: ['swing1 5'], levelReq: 4, steps: [5], cap: 120, capLines: ['swing1 120'] },
        belt: { lines: ['swing1 5'], levelReq: 4, steps: [5], cap: 120, capLines: ['swing1 120'] },
      },
    });
    // The same bonus under another cap condition is one step
    expect(option('dstone', 'hly')?.bySlot.weapon?.steps).toEqual([12]);
  });

  it('stores the total a D-stoning stops at: its rows applied from zero until no cap condition holds', () => {
    // ≤ 116 +5, ≤ 117 +4, ≤ 118 +3: 115 → 120, then no row applies
    expect(option('dstone', 'ppp')?.bySlot.weapon).toMatchObject({ cap: 120, capLines: ['swing2 120'] });
    // +12 while at most 500 (or 501): 492 → 504
    expect(option('dstone', 'hly')?.bySlot.weapon).toMatchObject({ cap: 504, capLines: ['dmg-undead 504'] });
    // ≤ 56 +1, ≤ 57 +2: 56 → 57 → 59
    expect(option('dstone', 'ttt')?.bySlot.weapon).toMatchObject({ cap: 59 });
    // A row without a cap condition never stops: no cap
    expect(option('dstone', 'hh2')?.bySlot.weapon).toEqual({ lines: ['dmg% 12'], levelReq: 2, steps: [12] });
  });

  it('uses the untiered row of a switch-item D-stoning and skips two-handed and tiered variants', () => {
    expect(option('dstone', 'ppp', 'key')).toEqual({
      kind: 'dstone',
      material: { code: 'ppp', label: 'Dragon Stone' },
      switchItem: { code: 'key', label: 'Key' },
      bySlot: { weapon: { lines: ['extra-fire 2'], levelReq: 2, steps: [2], cap: 300, capLines: ['extra-fire 300'] } },
    });
    expect(bundle.stacking.map((entry) => entry.switchItem?.code ?? null)).toEqual([null, null, null, null, 'key', 'key', null]);
  });

  it('warns about a shadowed group and steps that do not decrease; skips blocker rows', () => {
    expect(option('dstone', 'eee', 'key')?.bySlot.weapon?.lines).toEqual(['extra-ele 1']);
    expect(warnings).toEqual([
      'crafting: cubemain line 13 "BM + Any Weapon + key" is shadowed by an earlier dstone row with the same ingredients',
      'crafting: D-stoning "TO + Any Weapon" (cubemain line 16) steps 1, 2 are not decreasing',
    ]);
    expect(option('dstone', 'vvv', 'vps')).toBeUndefined();
  });

  it('melds a perfect gem per slot without steps, wands left out', () => {
    expect(option('meld', 'ggb')).toEqual({
      kind: 'meld',
      material: { code: 'ggb', label: 'Perfect Emerald' },
      bySlot: { weapon: { lines: ['crush 5'], levelReq: 2 }, helmet: { lines: ['dex 5'], levelReq: 3 } },
    });
  });

  it('counts the rows used and skipped', () => {
    // Skipped: 2hsw,eli + 2hsw + weap,exc, the shadowed row, the void row, the wand meld
    expect(rowsSkipped).toBe(6);
    expect(rowsUsed).toBe(cube.length - 6);
  });
});

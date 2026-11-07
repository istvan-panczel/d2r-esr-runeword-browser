import { describe, expect, it } from 'vitest';
import type { ItemTypeInfo } from '../engine/schema.ts';
import { base, type } from '../utils/testBases.mock.ts';
import { buildSuperiorAffixes, frequencyColumn, readSuperiorConfig } from './bundleSuperior.ts';
import type { ModsRenderer } from './bundleRunewords.ts';
import { parseTsv } from './tsv.ts';

const HEADER = [
  'mod1code',
  'mod1param',
  'mod1min',
  'mod1max',
  'mod2code',
  'mod2param',
  'mod2min',
  'mod2max',
  'armor',
  'weapon',
  'shield',
  'scepter',
  'wand',
  'staff',
  'bow',
  'boots',
  'gloves',
  'belt',
  'itype1',
  'itype2',
  'etype1',
];

/** A qualityitems.txt row: mod1, optional mod2, stock columns set to 1, itypes and etype */
function qualityRow(mod1: string, mod2: string, columns: string[], itypes: string[], etype = ''): string {
  const cells = Object.fromEntries(HEADER.map((column) => [column, '']));
  if (mod1 !== '') Object.assign(cells, { mod1code: mod1, mod1min: '1', mod1max: '2' });
  if (mod2 !== '') Object.assign(cells, { mod2code: mod2, mod2min: '3', mod2max: '4' });
  for (const column of columns) cells[column] = '1';
  itypes.forEach((code, i) => (cells[`itype${String(i + 1)}`] = code));
  cells.etype1 = etype;
  return HEADER.map((column) => cells[column]).join('\t');
}

const qualityitems = parseTsv(
  [
    HEADER.join('\t'),
    qualityRow('str', '', ['belt'], []), // 0: stock belt column
    qualityRow('', 'dex', ['weapon'], []), // 1: no mod1 → no bonus, mod2 ignored
    qualityRow('allskills', '', [], ['weap', 'armo']), // 2
    qualityRow('dmg%', 'att', [], ['weap'], 'orb'), // 3
    qualityRow('spell', '', [], ['orb']), // 4
    qualityRow('ac%', '', [], ['tors', 'shld']), // 5
  ].join('\n'),
  'qualityitems.txt'
);

const withParents = (code: string, name: string, ancestors: string[]): ItemTypeInfo => ({
  ...type(code, name),
  ancestors: [code, ...ancestors],
});
const types = [
  withParents('weap', 'Weapon', []),
  withParents('axe', 'Axe', ['weap']),
  withParents('orb', 'Orb', ['weap']),
  withParents('armo', 'Any Armor', []),
  withParents('tors', 'Armor', ['armo']),
  withParents('shld', 'Any Shield', ['armo']),
  withParents('shie', 'Shield', ['shld', 'armo']),
  withParents('belt', 'Belt', ['armo']),
];
const bases = [
  base('hax', 'Hand Axe', 'axe', 'normal', ['hax', '9ha', '7ha'], 3, { kind: 'weapon', ancestors: ['axe', 'weap'] }),
  base('ob1', 'Eagle Orb', 'orb', 'normal', ['ob1', 'ob6', 'obb'], 1, { kind: 'weapon', ancestors: ['orb', 'weap'], indestructible: true }),
  base('qui', 'Quilted Armor', 'tors', 'normal', ['qui', 'xui', 'uui'], 1, { ancestors: ['tors', 'armo'] }),
  base('buc', 'Buckler', 'shie', 'normal', ['buc', 'xuc', 'uuc'], 1, { ancestors: ['shie', 'shld', 'armo'] }),
  base('lbl', 'Sash', 'belt', 'normal', ['lbl', 'zlb', 'ulc'], 3, { ancestors: ['belt', 'armo'] }),
  base('rin', 'Ring', 'ring', 'normal', ['rin', 'rin', 'rin'], 1, { kind: 'misc', ancestors: ['ring'] }),
];
const renderMods: ModsRenderer = (mods) => ({
  lines: mods.map((mod) => `${mod.code} ${String(mod.min)}-${String(mod.max)}`),
  warnings: [],
});

const CONFIG = `
[superior_affixes]
enabled = true
default_weight = 100
first_four_rows_for_throwing_and_nodurability = false

[superior_affixes.weights]
# a comment
2 = 1
3 = 25
9 = 1
`;

const build = (config: string | null) =>
  buildSuperiorAffixes({ qualityitems, config, bases, types, throwableTypes: new Set(['tpot']), renderMods });

describe('readSuperiorConfig', () => {
  it('reads the switches and the per-row weights', () => {
    const warnings: string[] = [];
    const config = readSuperiorConfig(CONFIG, warnings);
    expect(config).toEqual({
      enabled: true,
      defaultWeight: 100,
      firstFourRows: false,
      weights: new Map([
        [2, 1],
        [3, 25],
        [9, 1],
      ]),
    });
    expect(warnings).toEqual([]);
  });

  it('warns about weights that are not row = 0-65535', () => {
    const warnings: string[] = [];
    readSuperiorConfig(`[superior_affixes]\ndefault_weight = 100\n[superior_affixes.weights]\nx = 5\n4 = 70000\n`, warnings);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/^superior: superior-affixes.toml line 4: "x = 5"/);
  });

  it('falls back to the stock rules without a config or when disabled', () => {
    const warnings: string[] = [];
    expect(readSuperiorConfig(null, warnings)).toEqual({ enabled: false, defaultWeight: 100, firstFourRows: true, weights: new Map() });
    expect(warnings).toHaveLength(1);
    expect(readSuperiorConfig(CONFIG.replace('enabled = true', 'enabled = false'), []).enabled).toBe(false);
  });
});

describe('buildSuperiorAffixes', () => {
  const { superior, warnings } = build(CONFIG);

  it('reads every row with its weight (listed or default), mods, rendered text and eligibility columns', () => {
    expect(superior.rows.map((row) => [row.row, row.weight])).toEqual([
      [0, 100],
      [1, 100],
      [2, 1],
      [3, 25],
      [4, 100],
      [5, 100],
    ]);
    expect(superior.rows[0]).toMatchObject({ columns: ['belt'], itypes: [], etypes: [], text: ['str 1-2'] });
    // mod2 only counts when mod1code is filled in
    expect(superior.rows[1]).toMatchObject({ mods: [], text: [], columns: ['weapon'] });
    expect(superior.rows[3]).toMatchObject({
      mods: [
        { prop: 'dmg%', param: null, min: 1, max: 2 },
        { prop: 'att', param: null, min: 3, max: 4 },
      ],
      itypes: ['weap'],
      etypes: ['orb'],
    });
  });

  it('warns about weights for rows past the end of qualityitems.txt', () => {
    expect(warnings).toEqual(['superior: superior-affixes.toml has weights for rows 9; qualityitems.txt has 6 rows (0-5)']);
  });

  it('groups the bases into pools of identical rows with their summed weights and labels', () => {
    expect(superior.pools).toEqual([
      { label: 'Axe', types: ['axe'], bases: 1, rows: [1, 2, 3], total: 126 },
      { label: 'Orb', types: ['orb'], bases: 1, rows: [1, 2, 4], total: 201 },
      { label: 'Any Armor (other types)', types: ['tors', 'shie'], bases: 2, rows: [2, 5], total: 101 },
      { label: 'Belt', types: ['belt'], bases: 1, rows: [0, 2], total: 101 },
    ]);
    expect(superior.firstFourRowBases).toBeUndefined();
  });

  it('lists the throwing / nodurability bases when the stock rows 0-3 rule is on', () => {
    const stockRule = build(CONFIG.replace('nodurability = false', 'nodurability = true')).superior;
    expect(stockRule.firstFourRowBases).toEqual(['ob1']);
    expect(stockRule.pools.find((pool) => pool.types.includes('orb'))?.rows).toEqual([1, 2]);
  });

  it('gives every row the same weight when the plugin is off', () => {
    expect(new Set(build(null).superior.rows.map((row) => row.weight))).toEqual(new Set([100]));
  });

  it('reads the ESR 3.3 frequency column instead of the toml weights (empty: never rolls)', () => {
    const lines = qualityitems.rows.map((_, i) => HEADER.map((column) => qualityitems.rows[i].str(column)).join('\t'));
    const withFrequency = parseTsv(
      [[...HEADER, 'frequency'].join('\t'), ...lines.map((line, i) => `${line}\t${['125', '5', '', '500', 'x', '25'][i] ?? ''}`)].join(
        '\n'
      ),
      'qualityitems.txt'
    );
    const result = buildSuperiorAffixes({
      qualityitems: withFrequency,
      config: CONFIG,
      bases,
      types,
      throwableTypes: new Set(),
      renderMods,
    });
    expect(result.superior.weightSource).toBe('frequency');
    expect(result.superior.defaultWeight).toBe(0);
    expect(result.superior.rows.map((row) => row.weight)).toEqual([125, 5, 0, 500, 0, 25]);
    // The toml weights table is not read (no orphan-row warning); the bad cell is
    expect(result.warnings).toEqual(['superior: qualityitems.txt row 4: frequency "x" is not 0-65535; the row never rolls']);
    expect(frequencyColumn(qualityitems, [])).toBeNull();
    expect(superior.weightSource).toBe('config');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Affix, AffixesBundle } from '@/features/game-data/engine/schema';
import type { StatCheck } from '../engine/types';
import {
  affixKindCounts,
  affixMatches,
  affixText,
  applyAffixSelection,
  buildAffixBrowserModel,
  filterAffixBrowser,
  initialAffixSelection,
} from './affixBrowser';

let nextId = 0;
function affix(kind: Affix['kind'], name: string, lvl: number, stats: number[]): Affix {
  return {
    id: nextId++,
    kind,
    name,
    lvl,
    maxLvl: 0,
    reqLvl: 1,
    cls: null,
    reqCls: null,
    clsReqLvl: 0,
    freq: 1,
    group: 1,
    rare: true,
    itypes: [],
    etypes: [],
    mods: [],
    stats,
    text: [],
  };
}

const BUNDLE: AffixesBundle = {
  stats: [
    { id: 0, name: 'strength', label: 'Strength' },
    { id: 17, name: 'item_maxdamage_percent', label: 'Enhanced Maximum Damage' },
    { id: 18, name: 'item_mindamage_percent', label: 'Enhanced Minimum Damage' },
    { id: 19, name: 'tohit', label: 'Attack Rating' },
    { id: 93, name: 'item_fasterattackrate', label: 'Increased Attack Speed' },
  ],
  affixes: [
    affix('p', 'Cruel', 40, [17, 18]),
    affix('p', 'Jagged', 1, [17, 18]),
    affix('p', 'Jagged', 5, [17, 18]),
    affix('p', 'Bronze', 1, [17, 18, 19]),
    affix('s', 'of Mastery', 50, [17, 18, 93]),
    affix('s', 'of Strength', 3, [0]),
    affix('a', '', 10, [0]),
    affix('s', 'of Haste', 8, [93]),
    affix('a', 'Sharp', 12, [17, 18, 19]),
  ],
};

const model = buildAffixBrowserModel(BUNDLE);
const row = (id: number) => model.rows.find((candidate) => candidate.id === id);

describe('buildAffixBrowserModel', () => {
  it('has one row per stat, by label, with enhanced damage merged onto the max stat', () => {
    expect(model.rows.map((candidate) => [candidate.id, candidate.label])).toEqual([
      [19, 'Attack Rating'],
      [17, 'Enhanced Damage'],
      [93, 'Increased Attack Speed'],
      [0, 'Strength'],
    ]);
  });

  it('lists the affixes by level, one per name and stat set, with hybrids marked', () => {
    expect(row(17)?.affixes).toEqual([
      { name: 'Bronze', kind: 'prefix', lvl: 1, hybridWith: ['Attack Rating'] },
      { name: 'Jagged', kind: 'prefix', lvl: 1, hybridWith: [] },
      { name: 'Sharp', kind: 'automagic', lvl: 12, hybridWith: ['Attack Rating'] },
      { name: 'Cruel', kind: 'prefix', lvl: 40, hybridWith: [] },
      { name: 'of Mastery', kind: 'suffix', lvl: 50, hybridWith: ['Increased Attack Speed'] },
    ]);
    expect(row(93)?.affixes.map(affixText)).toEqual(['of Haste', 'of Mastery (+Enhanced Damage)']);
    expect(row(0)?.affixes.map(affixText)).toEqual(['of Strength', 'unnamed automod']);
    expect(row(19)?.affixes.map(affixText)).toEqual(['Bronze (+Enhanced Damage)', 'Sharp (automod, +Enhanced Damage)']);
  });

  it('keeps the min stat as its own row when an affix writes it without the max stat', () => {
    const odd = buildAffixBrowserModel({ ...BUNDLE, affixes: [affix('p', 'Odd', 1, [18])] });
    expect(odd.rows.map((candidate) => [candidate.id, candidate.label])).toEqual([[18, 'Enhanced Minimum Damage']]);
  });

  it('notes the stats the plugin reads as 0 on some items, and only those', () => {
    expect(row(17)?.note).toMatch(/^Reads 0 on weapons/);
    expect(row(19)).not.toHaveProperty('note');
    const odd = buildAffixBrowserModel({ ...BUNDLE, affixes: [affix('p', 'Odd', 1, [18])] });
    expect(odd.rows[0]?.note).toMatch(/^Reads 0 on weapons/);
  });
});

describe('filterAffixBrowser', () => {
  const ids = (query: string) => filterAffixBrowser(model.rows, query).map((candidate) => candidate.id);
  it('matches every term against the label, stat name, id or an affix name', () => {
    expect(ids('')).toEqual([19, 17, 93, 0]);
    expect(ids('mastery')).toEqual([17, 93]);
    expect(ids('mastery speed')).toEqual([93]);
    expect(ids('tohit')).toEqual([19]);
    expect(ids('93')).toEqual([93]);
    expect(ids('jagged nope')).toEqual([]);
  });

  it('marks the affixes a search found', () => {
    const jagged = row(17)?.affixes[1];
    expect(jagged !== undefined && affixMatches(jagged, 'jag')).toBe(true);
    expect(jagged !== undefined && affixMatches(jagged, 'cruel')).toBe(false);
  });
});

describe('affixKindCounts', () => {
  it('counts per kind', () => {
    expect(affixKindCounts(row(17)?.affixes ?? [])).toBe('3 prefixes, 1 suffix, 1 automod');
    expect(affixKindCounts(row(0)?.affixes ?? [])).toBe('1 suffix, 1 automod');
  });
});

describe('selection', () => {
  const checks: StatCheck[] = [
    { stat: 'item_maxdamage_percent', op: '>=', value: 100 },
    { stat: 'item_numsockets', op: '>=', value: 2 },
    { stat: 93, op: '>', value: 0 },
  ];

  it('starts from the listed stats that have a check (names or ids)', () => {
    expect([...initialAffixSelection(checks, model)].sort((a, b) => a - b)).toEqual([17, 93]);
    expect(initialAffixSelection(undefined, model).size).toBe(0);
  });

  it('keeps ticked and unlisted checks, removes unticked ones and appends new presence checks in display order', () => {
    expect(applyAffixSelection(checks, model, new Set([17, 0, 19]))).toEqual([
      { stat: 'item_maxdamage_percent', op: '>=', value: 100 },
      { stat: 'item_numsockets', op: '>=', value: 2 },
      { stat: 'tohit', op: '>=', value: 1 },
      { stat: 'strength', op: '>=', value: 1 },
    ]);
  });

  it('in the inverted (exception) mode owns only the exception checks and appends “< 1” checks', () => {
    const hide: StatCheck[] = [
      { stat: 'item_maxdamage_percent', op: '>=', value: 100 },
      { stat: 'tohit', op: '<', value: 1 },
      { stat: 93, op: '<=', value: 4 },
    ];
    expect([...initialAffixSelection(hide, model, true)].sort((a, b) => a - b)).toEqual([19, 93]);
    // Unticking Attack Rating removes its exception, ticking Enhanced Damage adds one beside the plain >= 100 check.
    expect(applyAffixSelection(hide, model, new Set([93, 17]), true)).toEqual([
      { stat: 'item_maxdamage_percent', op: '>=', value: 100 },
      { stat: 93, op: '<=', value: 4 },
      { stat: 'item_maxdamage_percent', op: '<', value: 1 },
    ]);
    expect(applyAffixSelection(hide, model, new Set([19, 93]), true)).toBe(hide);
    expect(applyAffixSelection(undefined, model, new Set([0]), true)).toEqual([{ stat: 'strength', op: '<', value: 1 }]);
  });

  it('in the plain mode leaves exception checks alone: not ticked, not removed', () => {
    const mixed: StatCheck[] = [
      { stat: 'item_maxdamage_percent', op: '<', value: 1 },
      { stat: 'tohit', op: '>=', value: 5 },
    ];
    expect([...initialAffixSelection(mixed, model)]).toEqual([19]);
    expect(applyAffixSelection(mixed, model, new Set())).toEqual([{ stat: 'item_maxdamage_percent', op: '<', value: 1 }]);
    expect(applyAffixSelection(mixed, model, new Set([19, 17]))).toEqual([
      ...mixed,
      { stat: 'item_maxdamage_percent', op: '>=', value: 1 },
    ]);
  });

  it('returns the same list when nothing changes and undefined when emptied', () => {
    expect(applyAffixSelection(checks, model, new Set([17, 93]))).toBe(checks);
    expect(applyAffixSelection(undefined, model, new Set())).toBeUndefined();
    expect(applyAffixSelection([{ stat: 'strength', value: 1 }], model, new Set())).toBeUndefined();
  });
});

describe('the generated affixes.json', () => {
  const bundle = JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data/affixes.json'), 'utf8')) as AffixesBundle;
  const real = buildAffixBrowserModel(bundle);

  it('lists the enhanced damage prefixes and hybrids on one row', () => {
    const ed = real.rows.find((candidate) => candidate.name === 'item_maxdamage_percent');
    expect(ed?.label).toBe('Enhanced Damage');
    const names = ed?.affixes.map((entry) => entry.name) ?? [];
    expect(names).toEqual(expect.arrayContaining(['Jagged', 'Deadly', 'Cruel']));
    expect(ed?.affixes.some((entry) => entry.hybridWith.includes('Increased Attack Speed'))).toBe(true);
    expect(real.rows.some((candidate) => candidate.name === 'item_mindamage_percent')).toBe(false);
  });

  it('notes Enhanced Damage and Enhanced Defense', () => {
    expect(real.rows.find((candidate) => candidate.name === 'item_maxdamage_percent')?.note).toMatch(/weapons/);
    expect(real.rows.find((candidate) => candidate.name === 'item_armor_percent')?.note).toMatch(/armour/);
  });

  it('never lists technical stats', () => {
    expect(real.rows.filter((candidate) => /tinkerflag|jewelflag|_display$/.test(candidate.name))).toEqual([]);
  });
});

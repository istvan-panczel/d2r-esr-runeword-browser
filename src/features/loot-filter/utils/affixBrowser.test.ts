import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Affix, AffixesBundle, LootFilterDataBundle, StatParam, TypesBundle } from '@/features/game-data/engine/schema';
import type { StatCheck } from '../engine/types';
import {
  affixKindCounts,
  affixMatches,
  affixText,
  applyAffixSelection,
  buildAffixBrowserModel,
  filterAffixBrowser,
  initialAffixParams,
  initialAffixSelection,
  matchingParams,
  rowsMissingParams,
} from './affixBrowser';
import { buildStatParamData } from './statParams';
import { TEST_DATA, TEST_TYPES } from './testLookup.mock';

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
    expect(row(93)?.affixes.map((entry) => affixText(entry))).toEqual(['of Haste', 'of Mastery (+Enhanced Damage)']);
    expect(row(0)?.affixes.map((entry) => affixText(entry))).toEqual(['of Strength', 'unnamed automod']);
    expect(row(19)?.affixes.map((entry) => affixText(entry))).toEqual(['Bronze (+Enhanced Damage)', 'Sharp (automod, +Enhanced Damage)']);
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

describe('layered stats', () => {
  const layered = (kind: Affix['kind'], name: string, lvl: number, layers: StatParam[]): Affix => ({
    ...affix(kind, name, lvl, [...new Set(layers.map((layer) => layer.stat))]),
    layers,
  });
  const tab = (param: number): StatParam => ({ stat: 188, param });
  const orb = (level: number): StatParam => ({ stat: 198, param: (472 << 6) | level });
  const LAYERED: AffixesBundle = {
    stats: [
      { id: 0, name: 'strength', label: 'Strength' },
      { id: 188, name: 'item_addskill_tab', label: 'Skill Tab Levels' },
      { id: 198, name: 'item_skillonhit', label: 'Chance to Cast on Striking' },
    ],
    affixes: [
      layered('p', 'Shogukusha’s', 10, [tab(50)]),
      layered('p', 'Arcing', 20, [tab(9)]),
      layered('p', 'Arcing', 30, [tab(10)]),
      layered('p', 'Lettered', 5, [tab(0), tab(1), tab(2), tab(8)]),
      layered('s', 'of Frost', 12, [orb(13)]),
      layered('s', 'of Winter', 40, [orb(25)]),
      affix('s', 'of Strength', 3, [0]),
    ],
  };
  const params = buildStatParamData(TEST_DATA, TEST_TYPES);
  const lmodel = buildAffixBrowserModel(LAYERED, params);
  const lrow = (id: number) => lmodel.rows.find((candidate) => candidate.id === id);
  const tabRow = lrow(188);
  const orbRow = lrow(198);

  it('names the params of layered rows and their affixes, merging rows of one name', () => {
    expect(tabRow?.layerKind).toBe('tab');
    expect(tabRow?.params?.map((entry) => entry.label)).toEqual([
      'Bow and Crossbow Skills (Amazon)',
      'Passive and Magic Skills (Amazon)',
      'Javelin and Spear Skills (Amazon)',
      'Fire Skills (Sorceress)',
      'Lightning Skills (Sorceress)',
      'Cold Skills (Sorceress)',
      'Martial Arts (Assassin)',
    ]);
    const arcing = tabRow?.affixes.find((entry) => entry.name === 'Arcing');
    expect(arcing).toMatchObject({ lvl: 20, params: [{ param: 9 }, { param: 10 }] });
    expect(arcing === undefined ? '' : affixText(arcing, 'tab')).toBe('Arcing [Lightning Skills (Sorceress), Cold Skills (Sorceress)]');
    const lettered = tabRow?.affixes.find((entry) => entry.name === 'Lettered');
    expect(lettered === undefined ? '' : affixText(lettered, 'tab')).toBe('Lettered [4 tabs]');
    expect(lrow(0)?.layerKind).toBeUndefined();
    // Without the loot filter data a param is only a number
    expect(buildAffixBrowserModel(LAYERED).rows.find((candidate) => candidate.id === 188)?.params?.[0].label).toBe('param 0');
  });

  it('finds layered rows and their params by tab and skill name', () => {
    const ids = (query: string) => filterAffixBrowser(lmodel.rows, query).map((candidate) => candidate.id);
    expect(ids('martial')).toEqual([188]);
    expect(ids('orb of winter')).toEqual([198]);
    expect(tabRow === undefined ? [] : matchingParams(tabRow, 'martial')).toEqual([50]);
    expect(tabRow === undefined ? [] : matchingParams(tabRow, 'skill tab sorceress')).toEqual([8, 9, 10]);
    expect(tabRow === undefined ? [] : matchingParams(tabRow, 'arcing')).toEqual([9, 10]);
    expect(tabRow === undefined ? [] : matchingParams(tabRow, 'tab levels')).toEqual([]);
    expect(orbRow === undefined ? [] : matchingParams(orbRow, 'chance orb winter')).toEqual([(472 << 6) | 13, (472 << 6) | 25]);
    const frost = orbRow?.affixes.find((entry) => entry.name === 'of Frost');
    expect(frost !== undefined && affixMatches(frost, 'orb')).toBe(true);
    // Every term must be in the affix or the row: "of" alone in a name does not mark "of Strength" for "orb of winter"
    const strength = lrow(0)?.affixes[0];
    expect(strength !== undefined && affixMatches(strength, 'orb of winter', lrow(0))).toBe(false);
    expect(frost !== undefined && affixMatches(frost, 'chance orb', orbRow)).toBe(true);
    expect(frost === undefined ? '' : affixText(frost, 'event')).toBe('of Frost [Orb of Winter lvl 13]');
    expect(affixText({ name: 'of Orb of Winter', kind: 'suffix', lvl: 1, hybridWith: [], params: orbRow?.params }, 'event')).toBe(
      'of Orb of Winter [lvl 13, 25]'
    );
  });

  it('writes one check per picked param, keeping paramless checks', () => {
    const mt = (param: number) => ({ stat: 'item_addskill_tab', op: '>=', value: 1, param }) as const;
    const existing: StatCheck[] = [
      { stat: 188, param: 9, value: 3 },
      { stat: 'item_addskill_tab', value: 1 },
      { stat: 'strength', value: 5 },
    ];
    expect(initialAffixParams(existing, lmodel)).toEqual(new Map([[188, new Set([9])]]));
    // Unpicking 9 removes its check, picking 50 and 0 adds them by param; the paramless check stays.
    expect(applyAffixSelection(existing, lmodel, new Set([188, 0]), false, new Map([[188, new Set([50, 0])]]))).toEqual([
      { stat: 'item_addskill_tab', value: 1 },
      { stat: 'strength', value: 5 },
      mt(0),
      mt(50),
    ]);
    expect(applyAffixSelection(undefined, lmodel, new Set([198]), false, new Map([[198, new Set([(472 << 6) | 25])]]))).toEqual([
      { stat: 'item_skillonhit', op: '>=', value: 1, param: (472 << 6) | 25 },
    ]);
  });

  it('writes “< 1” exceptions per param in the inverted mode', () => {
    const hide: StatCheck[] = [{ stat: 188, param: 50, op: '>=', value: 3 }];
    expect(initialAffixParams(hide, lmodel, true).size).toBe(0);
    expect(applyAffixSelection(hide, lmodel, new Set([188]), true, new Map([[188, new Set([50])]]))).toEqual([
      ...hide,
      { stat: 'item_addskill_tab', op: '<', value: 1, param: 50 },
    ]);
  });

  it('waits for a param on a ticked layered row without a paramless check', () => {
    const none = new Map<number, Set<number>>();
    expect(rowsMissingParams(undefined, lmodel, new Set([188, 0]), none).map((candidate) => candidate.id)).toEqual([188]);
    expect(rowsMissingParams(undefined, lmodel, new Set([188]), new Map([[188, new Set([50])]]))).toEqual([]);
    expect(rowsMissingParams([{ stat: 188, value: 1 }], lmodel, new Set([188]), none)).toEqual([]);
    // The paramless check is a plain one: the inverted mode does not own it
    expect(rowsMissingParams([{ stat: 188, value: 1 }], lmodel, new Set([188]), none, true)).toHaveLength(1);
  });
});

describe('the generated affixes.json', () => {
  const bundle = JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data/affixes.json'), 'utf8')) as AffixesBundle;
  const lootfilter = JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data/lootfilter.json'), 'utf8')) as LootFilterDataBundle;
  const types = JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data/types.json'), 'utf8')) as TypesBundle;
  const real = buildAffixBrowserModel(bundle, buildStatParamData(lootfilter, types));

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

  it('finds the skill tab and chance-to-cast rows by tab and skill name', () => {
    const names = (query: string) => filterAffixBrowser(real.rows, query).map((candidate) => candidate.name);
    expect(names('martial')).toContain('item_addskill_tab');
    expect(names('demon')).toContain('item_addskill_tab');
    // ESR 3.2.24: the "of Orb of Winter" suffixes cast it on casting a skill
    expect(names('orb of winter')).toContain('item_skilloncast');
    const tabs = real.rows.find((candidate) => candidate.name === 'item_addskill_tab');
    expect(tabs === undefined ? [] : matchingParams(tabs, 'martial')).toEqual([50]);
    expect(tabs === undefined ? [] : matchingParams(tabs, 'demon')).toEqual([56]);
    // ESR reuses the Necromancer prefix names for the Warlock tabs; the params tell them apart
    const apprentice = tabs?.affixes.filter((entry) => entry.name === "Apprentice's").map((entry) => affixText(entry, 'tab'));
    expect(apprentice?.some((text) => text.includes('Demon Skills (Warlock)'))).toBe(true);
  });
});

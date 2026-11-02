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
  autoPickedParams,
  buildAffixBrowserModel,
  filterAffixBrowser,
  initialAffixParams,
  initialAffixSelection,
  matchingParams,
  pickShownParams,
  rowsMissingParams,
  shownParams,
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

  it('matches the text of an affix writing several stats in one line, not the per-stat lines of a hybrid', () => {
    const texts = buildAffixBrowserModel({
      ...BUNDLE,
      affixes: [
        { ...affix('s', 'of the Sky', 20, [0, 19]), text: ['+(10 to 15) to Everything'] },
        { ...affix('p', 'Sharp', 12, [17, 18, 19]), text: ['+(10 to 20)% Enhanced Damage', '+(10 to 20) to Attack Rating'] },
        { ...affix('s', 'of Haste', 8, [93]), text: ['+10% Increased Attack Speed', 'Knockback'] },
      ],
    });
    const found = (query: string) => filterAffixBrowser(texts.rows, query).map((candidate) => candidate.id);
    expect(found('everything')).toEqual([19, 0]);
    expect(found('knockback')).toEqual([93]);
    // Sharp's "Attack Rating" line does not find its Enhanced Damage row
    expect(found('to attack rating')).toEqual([19]);
    const strength = texts.rows.find((candidate) => candidate.id === 0);
    const sky = strength?.affixes[0];
    expect(sky?.text).toEqual(['+(10 to 15) to Everything']);
    expect(sky !== undefined && strength !== undefined && affixMatches(sky, 'everything', strength)).toBe(true);
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

  it('shows the named and picked params as chips, also picked ones no affix writes', () => {
    const chips = (query: string, picked: number[]) =>
      tabRow === undefined ? [] : shownParams(tabRow, query, new Set(picked), lmodel).map((entry) => entry.label);
    expect(chips('', [])).toHaveLength(7);
    expect(chips('martial', [9])).toEqual(['Lightning Skills (Sorceress)', 'Martial Arts (Assassin)']);
    // 49 (Assassin Shadow Disciplines) and 99 (no tab) are on no affix: still shown while picked
    expect(chips('martial', [49, 99])).toEqual(['Shadow Disciplines (Assassin)', 'Martial Arts (Assassin)', 'param 99']);
  });

  it('pre-picks only a row’s single param or the one param the search names', () => {
    const auto = (query: string) => (tabRow === undefined ? [] : autoPickedParams(tabRow, query));
    expect(auto('martial')).toEqual([50]);
    // Several named (three Sorceress tabs, the two "Arcing" tabs) or none: nothing is picked
    expect(auto('skill tab sorceress')).toEqual([]);
    expect(auto('arcing')).toEqual([]);
    expect(auto('')).toEqual([]);
    const single = tabRow === undefined ? undefined : { ...tabRow, params: tabRow.params?.slice(0, 1) };
    expect(single === undefined ? [] : autoPickedParams(single, 'arcing')).toEqual([0]);
  });

  it('searches every param of the row with the chip search, by name, class, writing affix or param', () => {
    const chips = (chipQuery: string, picked: number[] = [], query = 'martial') =>
      tabRow === undefined ? [] : shownParams(tabRow, query, new Set(picked), lmodel, chipQuery).map((entry) => entry.label);
    // Independent of the main search ("martial" names only Martial Arts)
    expect(chips('sorceress')).toEqual(['Fire Skills (Sorceress)', 'Lightning Skills (Sorceress)', 'Cold Skills (Sorceress)']);
    expect(chips('fire')).toEqual(['Fire Skills (Sorceress)']);
    expect(chips('arcing')).toEqual(['Lightning Skills (Sorceress)', 'Cold Skills (Sorceress)']);
    expect(chips('50')).toEqual(['Martial Arts (Assassin)']);
    // A picked param that does not match is not shown; one no affix writes is, when it matches
    expect(chips('fire', [50])).toEqual(['Fire Skills (Sorceress)']);
    expect(chips('shadow', [49])).toEqual(['Shadow Disciplines (Assassin)']);
    expect(chips('nothing')).toEqual([]);
    // A whitespace-only chip search is no search
    expect(chips('  ', [], '')).toHaveLength(7);
    // Skill params carry their class: "sorceress" finds the Orb of Winter levels
    expect(orbRow?.params?.map((entry) => entry.className)).toEqual(['Sorceress', 'Sorceress']);
    expect(orbRow === undefined ? [] : shownParams(orbRow, '', new Set(), lmodel, 'sorceress 25').map((entry) => entry.label)).toEqual([
      'Orb of Winter lvl 25',
    ]);
  });

  it('adds every shown chip to the picks', () => {
    const shown = tabRow === undefined ? [] : shownParams(tabRow, '', new Set(), lmodel, 'sorceress');
    expect(pickShownParams(new Set([50]), shown)).toEqual(new Set([50, 8, 9, 10]));
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
    expect(tabs === undefined ? [] : autoPickedParams(tabs, 'skill')).toEqual([]);
    const apprentice = tabs?.affixes.filter((entry) => entry.name === "Apprentice's").map((entry) => affixText(entry, 'tab'));
    expect(apprentice?.some((text) => text.includes('Demon Skills (Warlock)'))).toBe(true);
  });

  it('finds the flat and the percent attributes by the affix text "all attributes", the percent ones labelled so', () => {
    const found = filterAffixBrowser(real.rows, 'all attributes');
    expect(found.map((candidate) => candidate.id)).toEqual(expect.arrayContaining([0, 1, 2, 3, 255, 256, 257, 258]));
    const label = (id: number) => real.rows.find((candidate) => candidate.id === id)?.label;
    expect([0, 255].map(label)).toEqual(['Strength', 'Bonus to Strength %']);
    expect([3, 258].map(label)).toEqual(['Vitality', 'Bonus to Energy %']);
    // "of the Sky" (+X to All Attributes) is marked on the Strength row, "of All Attributes" on the percent row
    const strength = found.find((candidate) => candidate.id === 0);
    const marked = strength?.affixes.filter((entry) => affixMatches(entry, 'all attributes', strength)).map((entry) => entry.name);
    expect(marked).toEqual(expect.arrayContaining(['of the Sky', 'of the Zodiac']));
    expect(marked).not.toContain('of All Attributes');
    const percent = found.find((candidate) => candidate.id === 255);
    expect(percent?.affixes.filter((entry) => affixMatches(entry, 'all attributes', percent)).map((entry) => entry.name)).toContain(
      'of All Attributes'
    );
  });

  it('pre-picks nothing when a broad search names every class skill (the "Skillful" prefix writes all of them)', () => {
    const single = real.rows.find((candidate) => candidate.name === 'item_singleskill');
    if (single === undefined) throw new Error('no item_singleskill row');
    expect(matchingParams(single, 'skill').length).toBe(single.params?.length);
    expect(autoPickedParams(single, 'skill')).toEqual([]);
    expect(autoPickedParams(single, 'single class skill')).toEqual([]);
    const teleport = autoPickedParams(single, 'teleport');
    expect(teleport).toHaveLength(1);
    // The chip search finds Teleport among all 280, and a class's skills by the class name
    const chip = (chipQuery: string) => shownParams(single, 'skill', new Set(), real, chipQuery);
    expect(chip('teleport').map((entry) => entry.param)).toEqual(teleport);
    const sorceress = chip('sorceress');
    expect(sorceress.length).toBeGreaterThan(20);
    expect(sorceress.every((entry) => entry.className === 'Sorceress')).toBe(true);
  });
});

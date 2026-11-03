import { describe, expect, it } from 'vitest';
import type { StashItem } from '../../parser/types';
import { makeBundle, makeItem, makeSection, makeStash } from '../../testing/stashMocks.mock';
import { stashCatalog } from '../catalog';
import { buildItemTypeIndex } from '../itemTypes';
import {
  createItemRows,
  DEFAULT_ITEMS_STATE,
  encodeItemsState,
  encodeStatCondition,
  filterItemRows,
  formatStatValue,
  hasItemFilters,
  initialItemSortDir,
  itemPages,
  itemPageUrl,
  itemRows,
  itemsSummary,
  kindLabel,
  matchesConditions,
  parseStatCondition,
  readItemsState,
  sortItemRows,
  fillStatLabel,
  statTitle,
  statOptions,
  type ItemRow,
  type ItemSortKey,
  type ItemsState,
  type SortDir,
  type ItemTextEngine,
} from './allItems';
import type { ItemTextContext, StatValue } from './itemText';

const TYPES = buildItemTypeIndex([
  { code: 'armo', name: 'Any Armor', ancestors: ['armo'] },
  { code: 'weap', name: 'Weapon', ancestors: ['weap'] },
  { code: 'helm', name: 'Helm', ancestors: ['helm', 'armo'] },
  { code: 'tors', name: 'Armor', ancestors: ['tors', 'armo'] },
  { code: 'swor', name: 'Sword', ancestors: ['swor', 'weap'] },
  { code: 'ring', name: 'Ring', ancestors: ['ring', 'misc'] },
  { code: 'rune', name: 'Rune', ancestors: ['rune', 'misc'] },
  { code: 'jewl', name: 'Jewel', ancestors: ['jewl', 'misc'] },
  { code: 'misc', name: 'Miscellaneous', ancestors: ['misc'] },
]);

const catalog = stashCatalog(
  makeBundle({
    bases: [
      { code: 'cap', name: 'Cap', type: 'helm', tier: 'normal' },
      { code: 'uap', name: 'Shako', type: 'helm', tier: 'elite' },
      { code: 'rng', name: 'Ring Mail', type: 'tors', tier: 'normal' },
      { code: 'lsd', name: 'Long Sword', type: 'swor', tier: 'normal' },
      { code: 'rin', name: 'Ring', type: 'ring' },
      { code: 'r30', name: 'Ber Rune', type: 'rune' },
      { code: 'jew', name: 'Jewel', type: 'jewl' },
    ],
    uniques: [{ id: 300, name: 'Harlequin Crest', code: 'uap' }],
    setItems: [{ id: 3, name: "Civerb's Ward", code: 'cap', set: 'civ' }],
    sets: [{ id: 'civ', name: "Civerb's Vestments" }],
    runewords: [
      { id: 100, key: 'Runeword1', name: 'Spirit' },
      { id: 200, key: 'Holy', name: 'Holy', gemword: true },
    ],
  }),
  TYPES
);

/** Stat labels of the fake engine, by stat id */
const LABELS: Readonly<Record<number, string>> = {
  105: '+#% Faster Cast Rate',
  39: 'Fire Resist +#%',
  107: '+# to [Skill]',
};
const SKILLS: Readonly<Record<number, string>> = { 54: 'Teleport', 36: 'Fire Bolt' };

/** The fake text engine: one StatValue per saved stat (key `s<id>`, `s<id>.<param>` for 107) and a line per stat */
const engine: ItemTextEngine = {
  stats: (item) =>
    [...item.stats, ...item.socketed.flatMap((child) => child.stats)].map((stat): StatValue => {
      const label = LABELS[stat.id] ?? `Stat ${String(stat.id)} #`;
      const param = stat.id === 107 ? stat.param : null;
      const paramLabel = param === null ? null : (SKILLS[param] ?? null);
      return {
        key: param === null ? `s${String(stat.id)}` : `s${String(stat.id)}.${String(param)}`,
        statKey: `s${String(stat.id)}`,
        statId: stat.id,
        param,
        label: paramLabel === null ? label : label.replace('[Skill]', paramLabel),
        statLabel: label,
        paramLabel,
        value: stat.value,
      };
    }),
  render: (item) => ({
    base: item.ethereal ? ['Ethereal (Cannot be Repaired)'] : [],
    stats: item.stats.map((stat) => (LABELS[stat.id] ?? 'Stat #').replace('#', String(stat.value))),
    runeword: [],
    setBonuses: [],
    socketed: item.socketed.map((child) => ({
      item: child,
      lines: child.stats.map((stat) => (LABELS[stat.id] ?? '#').replace('#', String(stat.value))),
    })),
  }),
};

const text: ItemTextContext = {
  catalog,
  hasText: true,
  names: { ...emptyNames(), rareName: (id) => ({ 1: 'Grim', 2: 'Visor' })[id] ?? null },
};

function emptyNames(): ItemTextContext['names'] {
  return {
    magicPrefix: () => null,
    magicSuffix: () => null,
    autoAffix: () => null,
    rareName: () => null,
    lowQuality: () => null,
    superior: 'Superior',
  };
}

const stat = (id: number, value: number, param = 0) => ({ id, param, value });

const ber = makeItem('r30', { compact: true, quality: null, level: null });
const fcrJewel = makeItem('jew', { quality: 'magic', stats: [stat(105, 15)] });

// page 1: shako unique, civerb set, ring rare (fcr 10), sword runeword with a Ber
// page 2: ethereal ring mail with 2 sockets (1 jewel), a ring with fcr 20 and +3 teleport, a Holy gemword ring
const ITEMS: readonly [number, StashItem][] = [
  [0, makeItem('uap', { quality: 'unique', uniqueId: 300, level: 90, x: 0, y: 0, stats: [stat(107, 2, 54)] })],
  [0, makeItem('cap', { quality: 'set', setId: 3, level: 10, x: 3, y: 0 })],
  [0, makeItem('rin', { quality: 'rare', rareNameIds: [1, 2], level: 70, x: 5, y: 0, stats: [stat(105, 10), stat(39, 30)] })],
  [0, makeItem('lsd', { runewordId: 100, level: 40, x: 7, y: 0, sockets: 1, socketed: [ber] })],
  [1, makeItem('rng', { ethereal: true, level: 30, x: 0, y: 0, sockets: 2, socketed: [fcrJewel] })],
  [1, makeItem('rin', { quality: 'magic', level: 50, x: 2, y: 0, stats: [stat(105, 20), stat(107, 3, 54)] })],
  [1, makeItem('rin', { runewordId: 200, level: 60, x: 3, y: 0 })],
];

const stash = makeStash([
  makeSection(
    0,
    ITEMS.filter(([page]) => page === 0).map(([, item]) => item)
  ),
  makeSection(
    1,
    ITEMS.filter(([page]) => page === 1).map(([, item]) => item)
  ),
  makeSection(2, [makeItem('r30', { compact: true, quality: null, level: null })], 'advanced'),
]);

const rows = createItemRows(stash, catalog, text, engine);
const names = (list: readonly ItemRow[]) => list.map((row) => row.name);
const filter = (patch: Partial<ItemsState>) => names(filterItemRows(rows, { ...DEFAULT_ITEMS_STATE, ...patch }, TYPES));

describe('item rows', () => {
  it('lists the page items in stash order, sockets inside their parent, without the materials tab', () => {
    expect(names(rows)).toEqual(['Harlequin Crest', "Civerb's Ward", 'Grim Visor', 'Spirit', 'Ring Mail', 'Ring', 'Holy']);
    expect(rows.map((row) => row.page)).toEqual([1, 1, 1, 1, 2, 2, 2]);
    expect(rows[3]?.socketed.map((entry) => entry.name)).toEqual(['Ber Rune']);
    expect(rows[4]?.socketed).toEqual([{ item: rows[4]?.item.socketed[0], name: 'Jewel', lines: ['+15% Faster Cast Rate'] }]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it('keeps one stat value per key, the jewel stats included', () => {
    expect(rows[4]?.stats.get('s105')?.value).toBe(15);
    expect([...(rows[5]?.stats.keys() ?? [])]).toEqual(['s105', 's107.54']);
  });

  it('names the kind, gemwords apart', () => {
    expect(rows.map(kindLabel)).toEqual(['Unique', 'Set', 'Rare', 'Runeword', 'Normal', 'Magic', 'Gemword']);
  });

  it('links uniques, set items, runewords and gemwords to their pages', () => {
    expect(rows.map(itemPageUrl)).toEqual([
      '/uniques?name=Harlequin+Crest',
      '/game-data/sets?name=Civerb%27s+Ward',
      null,
      '/runewords?name=Spirit',
      null,
      null,
      '/gemwords?name=Holy',
    ]);
  });

  it('builds once per stash, catalog and text context', () => {
    expect(itemRows(stash, catalog, null)).toBe(itemRows(stash, catalog, null));
    expect(itemRows(stash, catalog, text)).not.toBe(itemRows(stash, catalog, null));
    // without the text the names fall back to the base name and there are no stat values
    expect(itemRows(stash, catalog, null)[2]?.name).toBe('Ring');
    expect(itemRows(stash, catalog, null).every((row) => row.stats.size === 0)).toBe(true);
  });

  it('counts the summary without the item text', () => {
    expect(itemsSummary(stash, catalog)).toEqual({ total: 7, uniques: 1, sets: 1, runewords: 1, gemwords: 1, socketed: 2 });
  });
});

describe('item search', () => {
  it('searches names, bases, type words, quality, code, set and socketed names', () => {
    expect(filter({ search: 'harlequin' })).toEqual(['Harlequin Crest']);
    expect(filter({ search: 'shako' })).toEqual(['Harlequin Crest']);
    expect(filter({ search: 'ring' })).toEqual(['Grim Visor', 'Ring', 'Holy']);
    expect(filter({ search: 'helm' })).toEqual(['Harlequin Crest', "Civerb's Ward"]);
    expect(filter({ search: 'rare' })).toEqual(['Grim Visor']);
    expect(filter({ search: 'lsd' })).toEqual(['Spirit']);
    expect(filter({ search: 'vestments' })).toEqual(["Civerb's Ward"]);
    expect(filter({ search: 'ber' })).toEqual(['Spirit']);
    // a type word also finds a word of the name or of a socketed item, never the row's own base / type
    expect(filter({ search: 'rune' })).toEqual(['Spirit']);
    expect(filter({ search: 'ber rune' })).toEqual(['Spirit']);
    expect(filter({ search: 'jewel' })).toEqual(['Ring Mail']);
    expect(filter({ search: 'elite' })).toEqual(['Harlequin Crest']);
    expect(filter({ search: 'ethereal' })).toEqual(['Ring Mail']);
  });

  it('searches the stat text, socketed lines included, every term', () => {
    expect(filter({ search: 'faster cast rate' })).toEqual(['Grim Visor', 'Ring Mail', 'Ring']);
    expect(filter({ search: '"faster cast rate" ring' })).toEqual(['Grim Visor', 'Ring']);
    expect(filter({ search: '"20% faster"' })).toEqual(['Ring']);
  });
});

describe('item filters', () => {
  it('filters by quality, category, tier and page', () => {
    expect(filter({ quality: 'runeword' })).toEqual(['Spirit', 'Holy']);
    expect(filter({ quality: 'normal' })).toEqual(['Ring Mail']);
    expect(filter({ category: 'jewelry' })).toEqual(['Grim Visor', 'Ring', 'Holy']);
    expect(filter({ category: 'weapon' })).toEqual(['Spirit']);
    expect(filter({ category: 'armor' })).toEqual(['Harlequin Crest', "Civerb's Ward", 'Ring Mail']);
    expect(filter({ tier: 'elite' })).toEqual(['Harlequin Crest']);
    expect(filter({ tier: 'none' })).toEqual(['Grim Visor', 'Ring', 'Holy']);
    expect(filter({ page: 2 })).toEqual(['Ring Mail', 'Ring', 'Holy']);
    expect(filter({ page: 3 })).toEqual([]);
  });

  it('filters by ethereal and sockets', () => {
    expect(filter({ ethereal: 'yes' })).toEqual(['Ring Mail']);
    expect(filter({ ethereal: 'no' })).toHaveLength(6);
    expect(filter({ sockets: 'socketed' })).toEqual(['Spirit', 'Ring Mail']);
    expect(filter({ sockets: 'open' })).toEqual(['Ring Mail']);
    expect(filter({ sockets: 'none' })).toHaveLength(5);
    expect(filter({ sockets: 'runeword' })).toEqual(['Spirit', 'Holy']);
  });

  it('combines the filters', () => {
    expect(filter({ category: 'jewelry', page: 2, search: 'faster' })).toEqual(['Ring']);
    expect(hasItemFilters(DEFAULT_ITEMS_STATE)).toBe(false);
    expect(hasItemFilters({ ...DEFAULT_ITEMS_STATE, search: '  ' })).toBe(false);
    expect(hasItemFilters({ ...DEFAULT_ITEMS_STATE, stats: [{ key: 's105', op: 'min', value: 1 }] })).toBe(true);
  });
});

describe('stat conditions', () => {
  it('matches min and max on the displayed value; an item without the stat fails', () => {
    expect(filter({ stats: [{ key: 's105', op: 'min', value: 15 }] })).toEqual(['Ring Mail', 'Ring']);
    expect(filter({ stats: [{ key: 's105', op: 'max', value: 15 }] })).toEqual(['Grim Visor', 'Ring Mail']);
    expect(filter({ stats: [{ key: 's105', op: 'max', value: 100 }] })).toEqual(['Grim Visor', 'Ring Mail', 'Ring']);
    expect(filter({ stats: [{ key: 's999', op: 'max', value: 100 }] })).toEqual([]);
  });

  it('ANDs several conditions, params apart', () => {
    expect(
      filter({
        stats: [
          { key: 's105', op: 'min', value: 10 },
          { key: 's107.54', op: 'min', value: 3 },
        ],
      })
    ).toEqual(['Ring']);
    expect(filter({ stats: [{ key: 's107.54', op: 'min', value: 2 }] })).toEqual(['Harlequin Crest', 'Ring']);
    expect(filter({ stats: [{ key: 's107.36', op: 'min', value: 1 }] })).toEqual([]);
    expect(matchesConditions({ stats: new Map() }, [])).toBe(true);
  });

  it('lists the stats present with counts and value spans, by label', () => {
    expect(statOptions(rows).map(({ key, label, count, min, max }) => ({ key, label, count, min, max }))).toEqual([
      { key: 's105', label: '+#% Faster Cast Rate', count: 3, min: 10, max: 20 },
      { key: 's39', label: 'Fire Resist +#%', count: 1, min: 30, max: 30 },
      { key: 's107.54', label: '+# to Teleport', count: 2, min: 2, max: 3 },
    ]);
    expect(statOptions([])).toEqual([]);
  });

  it('tells per-level stats and remaining label twins apart', () => {
    const value = (key: string, statId: number | null, label: string, perLevel?: true): StatValue => ({
      key,
      statKey: key,
      statId,
      param: null,
      label,
      statLabel: label,
      paramLabel: null,
      value: 1,
      ...(perLevel === undefined ? {} : { perLevel }),
    });
    const stats = [
      value('s0', 0, '+# to Strength'),
      value('s220', 220, '+# to Strength', true),
      value('s22', 22, '+# to Maximum Damage'),
      value('s24', 24, '+# to Maximum Damage'),
      value('s338', 338, '+#% Dodge Chance'),
      value('g.dodge', null, '+#% Dodge Chance'),
    ];
    const options = statOptions([{ stats: new Map(stats.map((stat) => [stat.key, stat])) }]);
    expect(options.map(({ key, label, perLevel }) => [key, label, perLevel])).toEqual([
      ['g.dodge', '+#% Dodge Chance (group)', false],
      ['s338', '+#% Dodge Chance (stat 338)', false],
      ['s22', '+# to Maximum Damage (stat 22)', false],
      ['s24', '+# to Maximum Damage (stat 24)', false],
      ['s0', '+# to Strength', false],
      ['s220', '+# to Strength (per level)', true],
    ]);
  });

  it('writes labels and values for display', () => {
    expect(fillStatLabel('+#% Faster Cast Rate', { value: 20 })).toBe('+20% Faster Cast Rate');
    expect(fillStatLabel('Adds #-# Fire Damage', { value: 20, range: { min: 10, max: 20 } })).toBe('Adds 10-20 Fire Damage');
    expect(fillStatLabel('+# Fire Damage', { value: 20, range: { min: 10, max: 20 } })).toBe('+10-20 Fire Damage');
    expect(fillStatLabel('+# to Life', { value: 1.5, perLevel: true })).toBe('+1.5 to Life (per character level)');
    expect(fillStatLabel('Cannot Be Frozen', { value: 1 })).toBe('Cannot Be Frozen');
    expect(fillStatLabel('Corrupted', { value: -1 })).toBe('Corrupted');
    expect(fillStatLabel('Tinkering Points', { value: 30 })).toBe('Tinkering Points: 30');
    expect(fillStatLabel('+#% Increased Attack Speed', { value: -20 })).toBe('-20% Increased Attack Speed');
    expect(fillStatLabel('Requirements +#%', { value: -100 })).toBe('Requirements -100%');
    expect(fillStatLabel('Lightning Resist +#%', { value: 40 })).toBe('Lightning Resist +40%');
    expect(fillStatLabel('Adds #-# Damage', { value: 5, range: { min: -2, max: 5 } })).toBe('Adds -2-5 Damage');
    expect(statTitle('+#% Faster Cast Rate')).toBe('Faster Cast Rate');
    expect(statTitle('Fire Resist +#%')).toBe('Fire Resist');
    expect(statTitle('+# to Fire Ball (Sorceress Only)')).toBe('Fire Ball (Sorceress Only)');
    expect(statTitle('Adds #-# Fire Damage')).toBe('Adds Fire Damage');
    expect(statTitle('+# to Strength (per level)')).toBe('Strength (per level)');
    expect(statTitle('Indestructible')).toBe('Indestructible');
    expect(formatStatValue({ value: 20 })).toBe('20');
    expect(formatStatValue({ value: 20, range: { min: 10, max: 20 } })).toBe('10-20');
    expect(formatStatValue({ value: 0.375, perLevel: true })).toBe('0.38 per level');
  });
});

describe('item sorting', () => {
  const sorted = (sort: ItemSortKey, dir: SortDir, sortStat: string | null = null) => names(sortItemRows(rows, sort, dir, sortStat));

  it('sorts by location, name, quality and item level', () => {
    expect(sorted('location', 'desc')).toEqual(['Holy', 'Ring', 'Ring Mail', 'Spirit', 'Grim Visor', "Civerb's Ward", 'Harlequin Crest']);
    expect(sorted('name', 'asc')).toEqual(["Civerb's Ward", 'Grim Visor', 'Harlequin Crest', 'Holy', 'Ring', 'Ring Mail', 'Spirit']);
    expect(sorted('quality', 'asc')).toEqual(['Harlequin Crest', "Civerb's Ward", 'Holy', 'Spirit', 'Grim Visor', 'Ring', 'Ring Mail']);
    expect(sorted('ilvl', 'desc')).toEqual(['Harlequin Crest', 'Grim Visor', 'Holy', 'Ring', 'Spirit', 'Ring Mail', "Civerb's Ward"]);
  });

  it('sorts by a stat value, items without it last in both directions', () => {
    expect(sorted('stat', 'desc', 's105')).toEqual([
      'Ring',
      'Ring Mail',
      'Grim Visor',
      "Civerb's Ward",
      'Harlequin Crest',
      'Holy',
      'Spirit',
    ]);
    expect(sorted('stat', 'asc', 's105')).toEqual([
      'Grim Visor',
      'Ring Mail',
      'Ring',
      "Civerb's Ward",
      'Harlequin Crest',
      'Holy',
      'Spirit',
    ]);
    expect(sorted('stat', 'asc', null)).toEqual(names(rows));
  });

  it('starts levels and stats high to low', () => {
    expect(initialItemSortDir('ilvl')).toBe('desc');
    expect(initialItemSortDir('stat')).toBe('desc');
    expect(initialItemSortDir('name')).toBe('asc');
    expect(itemPages(rows)).toEqual([1, 2]);
  });
});

describe('items URL state', () => {
  it('round-trips every field', () => {
    const state: ItemsState = {
      search: 'ring "faster cast"',
      quality: 'rare',
      category: 'jewelry',
      tier: 'none',
      page: 12,
      ethereal: 'no',
      sockets: 'open',
      stats: [
        { key: 's105', op: 'min', value: 20 },
        { key: 'g.dmg-fire', op: 'max', value: -2.5 },
        { key: 's107.54', op: 'min', value: 3 },
      ],
      sort: 'stat',
      sortStat: 'g.allres',
      dir: 'desc',
      details: true,
    };
    const params = encodeItemsState(state);
    expect(params.getAll('stat')).toEqual(['s105_min_20', 'g.dmg-fire_max_-2.5', 's107.54_min_3']);
    expect(params.toString()).toContain('stat=s105_min_20');
    expect(readItemsState(new URLSearchParams(params.toString()))).toEqual(state);
  });

  it('writes nothing for the defaults and reads defaults for bad values', () => {
    expect(encodeItemsState(DEFAULT_ITEMS_STATE).toString()).toBe('');
    expect(readItemsState(new URLSearchParams())).toEqual(DEFAULT_ITEMS_STATE);
    const bad = new URLSearchParams('quality=epic&cat=x&tier=god&page=0&eth=maybe&sockets=9&sort=power&dir=up&details=yes&by=a_b');
    bad.append('stat', 's105_gt_1');
    bad.append('stat', 's105_min_x');
    bad.append('stat', 'bad key_min_1');
    bad.append('stat', 's105_min_');
    bad.append('stat', 's105_min_1_2');
    expect(readItemsState(bad)).toEqual(DEFAULT_ITEMS_STATE);
  });

  it('keeps the stat sort key only with the stat sort', () => {
    expect(encodeItemsState({ ...DEFAULT_ITEMS_STATE, sort: 'name', sortStat: 's105' }).has('by')).toBe(false);
    expect(parseStatCondition(encodeStatCondition({ key: 's0', op: 'max', value: 0 }))).toEqual({ key: 's0', op: 'max', value: 0 });
  });
});

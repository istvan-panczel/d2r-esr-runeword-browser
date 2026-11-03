import { describe, expect, it } from 'vitest';
import type { StashBundle } from '@/features/game-data/engine/schema';
import type { StashFile, StashItem, StashSection, StashTabType } from '../parser/types';
import { buildItemTypeIndex, normaliseTypeWord, typeCodesOfTerm } from './itemTypes';
import {
  collectCoupons,
  couponPages,
  couponStatus,
  DEFAULT_COUPONS_STATE,
  encodeCouponsState,
  filterCouponRows,
  formatHaveNeed,
  formatLocation,
  itemCount,
  readCouponsState,
  sortCouponRows,
  uniquePageUrl,
  type CouponRow,
} from './coupons';

const BUNDLE: Pick<StashBundle, 'coupons' | 'couponTiers'> = {
  coupons: [
    {
      code: '01c',
      name: 'Ancient Coupon (Buckler, Pelta Lunata)',
      type: 'cpn1',
      unique: { id: 793, name: 'Pelta Lunata' },
      base: { code: 'buc', name: 'Buckler', type: 'shie' },
      qty: 3,
      withWildCards: { qty: 2, wildCards: 1 },
    },
    {
      code: '02c',
      name: "Ancient Coupon (Cap, Biggin's Bonnet)",
      type: 'cpn1',
      unique: { id: 770, name: "Biggin's Bonnet" },
      qty: 3,
      withWildCards: { qty: 2, wildCards: 1 },
    },
    {
      code: '01e',
      name: 'Ancient Coupon (Burnt Text, Measured Wrath)',
      type: 'cpn3',
      unique: { id: 1377, name: 'Measured Wrath' },
      qty: 3,
      withWildCards: { qty: 2, wildCards: 4 },
    },
    { code: '03c', name: 'Ancient Coupon (Boots, Hotspur)', type: 'cpn1', unique: { id: 806, name: 'Hotspur' }, qty: 3 },
    { code: '96j', name: 'Ancient Coupon (nor)', type: 'cpn1' },
    { code: '99j', name: 'Ancient Coupon (Wild Card)', type: 'coup', wildCard: true },
  ],
  couponTiers: [
    { type: 'cpn1', name: 'Coupon norm', tier: 'normal', wildCardFrom: 8 },
    { type: 'cpn3', name: 'Coupon elite', tier: null, wildCardFrom: 2 },
  ],
};

function item(code: string, x: number, y: number, stackSize: number | null = null): StashItem {
  return {
    section: 0,
    index: 0,
    bitOffset: 0,
    flags: 0,
    mode: 0,
    x,
    y,
    width: 1,
    height: 1,
    code,
    compact: false,
    identified: true,
    ethereal: false,
    quality: 'normal',
    level: 1,
    uniqueId: null,
    setId: null,
    runewordId: null,
    quantity: null,
    stackSize,
    sockets: null,
    socketed: [],
    stats: [],
    setBonusStats: [],
    runewordStats: [],
  };
}

function section(index: number, items: StashItem[], tabType: StashTabType = 'normal'): StashSection {
  return { index, offset: 0, byteSize: 0, tabType, gold: 0, items, chronicle: null };
}

function stashOf(sections: StashSection[]): StashFile {
  return { stashFormat: 2, version: 0x44520005, sections };
}

const STASH = stashOf([
  section(0, [item('01c', 4, 2), item('01c', 0, 0), item('02c', 1, 0), item('jew', 5, 5), item('96j', 3, 3)]),
  section(2, [item('01c', 15, 12), item('01c', 3, 0), item('01c', 0, 1), item('01c', 9, 9), item('01e', 0, 0), item('01e', 1, 0)]),
  section(3, [item('99j', 7, 7), item('03c', 2, 2), item('03c', 2, 3)]),
  section(1000, [item('02c', 0, 0, 1)], 'advanced'),
]);

const rowOf = (rows: readonly CouponRow[], code: string): CouponRow => {
  const row = rows.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`no row ${code}`);
  return row;
};

describe('collectCoupons', () => {
  const { rows, summary, wildCardLocations } = collectCoupons(STASH, BUNDLE);

  it('lists only the coupon codes the stash holds, with counts, crafts and status', () => {
    expect(rows.map((row) => row.code).sort()).toEqual(['01c', '01e', '02c', '03c']);
    expect(rowOf(rows, '01c')).toMatchObject({ have: 6, need: 3, crafts: 2, status: 'ready', tier: 'normal', tierLabel: 'Normal' });
    expect(rowOf(rows, '02c')).toMatchObject({ have: 2, crafts: 0, status: 'wildcards' });
    // A tier without a base tier in the data is labelled with its itemtypes name
    expect(rowOf(rows, '01e')).toMatchObject({ have: 2, status: 'almost', tier: null, tierLabel: 'Coupon elite' });
    expect(rowOf(rows, '01c').base).toEqual({ code: 'buc', name: 'Buckler', type: 'shie' });
    expect(rowOf(rows, '02c')).toMatchObject({ base: null, baseTypeName: null, typeCodes: [] });
  });

  it('sorts each coupon’s locations by page, row, column, the materials tab included', () => {
    expect(rowOf(rows, '01c').locations.map(formatLocation)).toEqual([
      'Page 1 · row 1, col 1',
      'Page 1 · row 3, col 5',
      'Page 3 · row 1, col 4',
      'Page 3 · row 2, col 1',
      'Page 3 · row 10, col 10',
      'Page 3 · row 13, col 16',
    ]);
    expect(rowOf(rows, '02c').locations.map(formatLocation)).toEqual(['Page 1 · row 1, col 2', 'Materials tab']);
  });

  it('marks a row ready with Wild Cards only when the stash has enough of them', () => {
    // 2 Biggin's Bonnet coupons + 1 Wild Card: yes; 2 Measured Wrath + 4 Wild Cards: only 1 owned; Hotspur: no alternative
    expect(rowOf(rows, '02c').status).toBe('wildcards');
    expect(rowOf(rows, '01e').status).toBe('almost');
    expect(rowOf(rows, '03c').status).toBe('almost');
    expect(rowOf(rows, '01c').status).toBe('ready');
  });

  it('never counts a suspect Wild Card recipe as ready', () => {
    const bundle = {
      ...BUNDLE,
      coupons: BUNDLE.coupons.map((coupon) =>
        coupon.code === '02c' ? { ...coupon, withWildCards: { qty: 2, wildCards: 1, suspect: true as const } } : coupon
      ),
    };
    const { rows: suspectRows, summary: suspectSummary } = collectCoupons(STASH, bundle);
    expect(rowOf(suspectRows, '02c')).toMatchObject({ status: 'almost', withWildCards: { suspect: true } });
    expect(suspectSummary.readyWithWildCards).toBe(0);
  });

  it('summarises the owned coupons, leaving the Wild Card and the blank coupons out of the rows', () => {
    expect(summary).toEqual({ distinct: 4, total: 12, craftable: 1, crafts: 2, wildCards: 1, readyWithWildCards: 1, blanks: 1 });
    expect(wildCardLocations.map(formatLocation)).toEqual(['Page 4 · row 8, col 8']);
  });

  it('counts a page item as one coupon even when it carries stack size 0 (stackable codes like the Wild Card)', () => {
    const paged = collectCoupons(stashOf([section(0, [item('99j', 0, 0, 0), item('99j', 1, 0, 0), item('01c', 2, 0, 0)])]), BUNDLE);
    expect(paged.summary.wildCards).toBe(2);
    expect(rowOf(paged.rows, '01c').have).toBe(1);
    expect(itemCount('normal', { stackSize: 0 })).toBe(1);
    expect(itemCount('advanced', { stackSize: 0 })).toBe(1);
    expect(itemCount('advanced', { stackSize: 12 })).toBe(12);
  });

  it('counts a materials-tab stack by its stack size', () => {
    const stacked = collectCoupons(stashOf([section(1000, [item('01c', 0, 0, 7), item('99j', 1, 0, 3)], 'advanced')]), BUNDLE);
    expect(rowOf(stacked.rows, '01c')).toMatchObject({ have: 7, crafts: 2 });
    expect(stacked.summary.wildCards).toBe(3);
  });

  it('returns nothing for a stash without coupons', () => {
    const empty = collectCoupons(stashOf([section(0, [item('jew', 0, 0)])]), BUNDLE);
    expect(empty.rows).toEqual([]);
    expect(empty.summary.wildCards).toBe(0);
  });
});

describe('coupon formatting', () => {
  it('derives the status from have and need', () => {
    expect([couponStatus(4, 3), couponStatus(3, 3), couponStatus(2, 3), couponStatus(1, 3)]).toEqual(['ready', 'ready', 'almost', 'other']);
    expect([couponStatus(3, 3, true), couponStatus(2, 3, true), couponStatus(1, 3, true)]).toEqual(['ready', 'wildcards', 'wildcards']);
  });

  it('formats a page cell 1-based and the materials tab without a cell', () => {
    expect(formatLocation({ section: 9, tabType: 'normal', x: 15, y: 0 })).toBe('Page 10 · row 1, col 16');
    expect(formatLocation({ section: 1000, tabType: 'advanced', x: 9, y: 4 })).toBe('Materials tab');
  });

  it('formats have / need', () => {
    expect(formatHaveNeed({ have: 7, need: 3 })).toBe('7 / 3');
  });

  it('links the unique by exact name', () => {
    expect(uniquePageUrl("Biggin's Bonnet")).toBe('/uniques?name=Biggin%27s+Bonnet');
  });
});

describe('coupon filters and sorting', () => {
  const { rows } = collectCoupons(STASH, BUNDLE);
  const filter = (patch: Partial<typeof DEFAULT_COUPONS_STATE>) =>
    filterCouponRows(rows, { ...DEFAULT_COUPONS_STATE, ...patch })
      .map((row) => row.code)
      .sort();

  it('searches the coupon name, the unique name and the code', () => {
    expect(filter({ search: 'buckler' })).toEqual(['01c']);
    expect(filter({ search: 'bonnet' })).toEqual(['02c']);
    expect(filter({ search: '01E' })).toEqual(['01e']);
    expect(filter({ search: '"measured wrath"' })).toEqual(['01e']);
    expect(filter({ search: 'ancient nothing' })).toEqual([]);
  });

  it('filters by status, tier and page', () => {
    expect(filter({ status: 'ready' })).toEqual(['01c']);
    expect(filter({ status: 'wildcards' })).toEqual(['02c']);
    expect(filter({ status: 'almost' })).toEqual(['01e', '03c']);
    expect(filter({ status: 'other' })).toEqual([]);
    expect(filter({ tier: 'cpn3' })).toEqual(['01e']);
    expect(filter({ page: 1 })).toEqual(['01c', '02c']);
    expect(filter({ page: 4 })).toEqual(['03c']);
  });

  it('sorts ready first, then ready with Wild Cards, then by count', () => {
    expect(sortCouponRows(rows, 'status', 'asc').map((row) => row.code)).toEqual(['01c', '02c', '03c', '01e']);
  });

  it('sorts by a column in both directions, ties by unique name', () => {
    expect(sortCouponRows(rows, 'unique', 'asc').map((row) => row.unique.name)).toEqual([
      "Biggin's Bonnet",
      'Hotspur',
      'Measured Wrath',
      'Pelta Lunata',
    ]);
    expect(sortCouponRows(rows, 'have', 'desc').map((row) => row.code)).toEqual(['01c', '02c', '03c', '01e']);
    expect(sortCouponRows(rows, 'tier', 'desc').map((row) => row.code)).toEqual(['01e', '02c', '03c', '01c']);
    expect(sortCouponRows(rows, 'location', 'asc').map((row) => row.code)).toEqual(['01c', '02c', '01e', '03c']);
  });

  it('lists the pages holding coupons', () => {
    expect(couponPages(rows)).toEqual([1, 3, 4]);
  });
});

describe('coupons URL state', () => {
  it('round-trips the state and drops defaults', () => {
    const state = { search: 'bonnet', status: 'wildcards', tier: 'cpn1', page: 3, sort: 'have', dir: 'desc', details: true } as const;
    expect(readCouponsState(encodeCouponsState(state))).toEqual(state);
    expect(encodeCouponsState(DEFAULT_COUPONS_STATE).toString()).toBe('');
  });

  it('ignores invalid values', () => {
    expect(readCouponsState(new URLSearchParams('status=nope&page=0&sort=x&dir=up&details=yes'))).toEqual(DEFAULT_COUPONS_STATE);
  });
});

describe('item type search', () => {
  const TYPES = buildItemTypeIndex([
    { code: 'armo', name: 'Any Armor', ancestors: ['armo'] },
    { code: 'merc', name: 'Helm (merc)', ancestors: ['merc'] },
    { code: 'belt', name: 'Belt', ancestors: ['belt', 'armo', 'merc'] },
    { code: 'tors', name: 'Armor', ancestors: ['tors', 'armo'] },
    { code: 'ring', name: 'Ring', ancestors: ['ring', 'misc', 'merc'] },
    { code: 'helm', name: 'Helm', ancestors: ['helm', 'armo', 'merc'] },
    { code: 'boot', name: 'Boots', ancestors: ['boot', 'armo', 'merc'] },
    { code: 'shld', name: 'Any Shield', ancestors: ['shld', 'armo', 'seco'] },
    { code: 'shie', name: 'Shield', ancestors: ['shie', 'shld', 'armo', 'seco'] },
    { code: 'grim', name: 'Grimoire', ancestors: ['grim', 'shld', 'armo', 'seco', 'clas', 'warl'] },
  ]);
  const coupon = (code: string, unique: string, base: string, baseName: string, type: string) => ({
    code,
    name: `Ancient Coupon (${baseName}, ${unique})`,
    type: 'cpn1',
    unique: { id: 1, name: unique },
    base: { code: base, name: baseName, type },
    qty: 3,
  });
  const bundle: Pick<StashBundle, 'coupons' | 'couponTiers'> = {
    coupons: [
      coupon('a1', 'Lenymo', '3lb', 'Sash', 'belt'),
      coupon('a2', "Verdungo's Hearty Cord", 'umc', 'Mithril Coil', 'belt'),
      coupon('a3', 'Darkglow', 'rng', 'Ring Mail', 'tors'),
      coupon('a4', 'Nagelring', 'rin', 'Ring', 'ring'),
      coupon('a5', "Biggin's Bonnet", 'cap', 'Cap', 'helm'),
      coupon('a6', 'Hotspur', 'lbt', 'Boots', 'boot'),
      coupon('a7', 'Umbral Disk', 'sml', 'Small Shield', 'shie'),
      coupon('a8', 'Measured Wrath', 'w1a', 'Burnt Text', 'grim'),
    ],
    couponTiers: [{ type: 'cpn1', name: 'Coupon norm', tier: 'normal', wildCardFrom: 8 }],
  };
  const stash = stashOf([
    section(
      0,
      bundle.coupons.map((entry, i) => item(entry.code, i, 0))
    ),
  ]);
  const { rows } = collectCoupons(stash, bundle, TYPES);
  const search = (text: string) =>
    filterCouponRows(rows, { ...DEFAULT_COUPONS_STATE, search: text }, TYPES)
      .map((row) => row.code)
      .sort();

  it('gives each row its base type name and type chain', () => {
    expect(rowOf(rows, 'a1')).toMatchObject({ baseTypeName: 'Belt', typeCodes: ['belt', 'armo', 'merc'] });
  });

  it('finds every base of a type, whatever its name, and only those', () => {
    expect(search('belt')).toEqual(['a1', 'a2']);
    expect(search('Belts')).toEqual(['a1', 'a2']);
    // "ring" is the Ring type, not the Ring Mail armor; "helm" is not the merc type the boots and belts descend from
    expect(search('ring')).toEqual(['a4']);
    expect(search('helm')).toEqual(['a5']);
    expect(search('boot')).toEqual(['a6']);
    expect(search('armor')).toEqual(['a3']);
  });

  it('maps everyday words onto ESR type names', () => {
    expect(search('helmet')).toEqual(['a5']);
    // every shield, the class ones included
    expect(search('shield')).toEqual(['a7', 'a8']);
  });

  it('matches other words as text: base names, coupon names, uniques', () => {
    expect(search('sash')).toEqual(['a1']);
    expect(search('coil')).toEqual(['a2']);
    expect(search('"ring mail"')).toEqual(['a3']);
    expect(search('belt lenymo')).toEqual(['a1']);
    expect(search('belt hotspur')).toEqual([]);
  });

  it('searches as text only without types.json', () => {
    expect(
      filterCouponRows(rows, { ...DEFAULT_COUPONS_STATE, search: 'ring' })
        .map((row) => row.code)
        .sort()
    ).toEqual(['a3', 'a4']);
  });

  it('normalises type words and resolves only type names', () => {
    expect(normaliseTypeWord(' Boots ')).toBe('boot');
    expect(normaliseTypeWord('Glass')).toBe('glass');
    expect(typeCodesOfTerm('rings', TYPES)).toEqual(['ring']);
    expect(typeCodesOfTerm('sash', TYPES)).toBeNull();
    expect(typeCodesOfTerm('helm (merc)', TYPES)).toEqual(['merc']);
  });
});

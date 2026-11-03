import { describe, expect, it } from 'vitest';
import type { StashBundle } from '@/features/game-data/engine/schema';
import type { StashFile, StashItem, StashSection, StashTabType } from '../parser/types';
import {
  collectCoupons,
  couponPages,
  couponStatus,
  DEFAULT_COUPONS_STATE,
  encodeCouponsState,
  filterCouponRows,
  formatHaveNeed,
  formatLocation,
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
    { type: 'cpn1', label: 'Normal', wildCardFrom: 8 },
    { type: 'cpn3', label: 'Elite', wildCardFrom: 2 },
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
    expect(rowOf(rows, '01c')).toMatchObject({ have: 6, need: 3, crafts: 2, status: 'ready', tierLabel: 'Normal' });
    expect(rowOf(rows, '02c')).toMatchObject({ have: 2, crafts: 0, status: 'almost' });
    expect(rowOf(rows, '01e')).toMatchObject({ have: 2, status: 'almost', tierLabel: 'Elite' });
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
    expect(rowOf(rows, '02c').locations.map(formatLocation)).toEqual(['Page 1 · row 1, col 2', 'Materials tab · row 1, col 1']);
  });

  it('marks a row ready with Wild Cards only when the stash has enough of them', () => {
    // 2 Biggin's Bonnet coupons + 1 Wild Card: yes; 2 Measured Wrath + 4 Wild Cards: only 1 owned; Hotspur: no alternative
    expect(rowOf(rows, '02c').readyWithWildCards).toBe(true);
    expect(rowOf(rows, '01e').readyWithWildCards).toBe(false);
    expect(rowOf(rows, '03c').readyWithWildCards).toBe(false);
    expect(rowOf(rows, '01c').readyWithWildCards).toBe(false);
  });

  it('summarises the owned coupons, leaving the Wild Card and the blank coupons out of the rows', () => {
    expect(summary).toEqual({ distinct: 4, total: 12, craftable: 1, crafts: 2, wildCards: 1, readyWithWildCards: 1, blanks: 1 });
    expect(wildCardLocations.map(formatLocation)).toEqual(['Page 4 · row 8, col 8']);
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
    expect(filter({ status: 'almost' })).toEqual(['01e', '02c', '03c']);
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
    const state = { search: 'bonnet', status: 'ready', tier: 'cpn1', page: 3, sort: 'have', dir: 'desc' } as const;
    expect(readCouponsState(encodeCouponsState(state))).toEqual(state);
    expect(encodeCouponsState(DEFAULT_COUPONS_STATE).toString()).toBe('');
  });

  it('ignores invalid values', () => {
    expect(readCouponsState(new URLSearchParams('status=nope&page=0&sort=x&dir=up'))).toEqual(DEFAULT_COUPONS_STATE);
  });
});

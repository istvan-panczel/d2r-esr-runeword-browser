/**
 * Ancient Coupons page: the coupons a parsed stash holds, joined with their cube recipes from stash.json, and the
 * page's filters, sorting and URL state. See docs/features/STASH.md "Ancient Coupons".
 */
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import type { StashBundle, StashCouponUnique } from '@/features/game-data/engine/schema';
import type { StashFile, StashTabType } from '../parser/types';

/** Where one coupon (or one stack of them) lies */
export interface CouponLocation {
  /** Stash section, 0-based */
  readonly section: number;
  readonly tabType: StashTabType;
  readonly x: number;
  readonly y: number;
}

/** have ≥ need: craftable now; need − 1: one coupon short; other: the rest */
export type CouponStatus = 'ready' | 'almost' | 'other';

export interface CouponRow {
  readonly code: string;
  /** "Ancient Coupon (Buckler, Pelta Lunata)" */
  readonly name: string;
  /** Coupon item type (cpn1 …) */
  readonly tier: string;
  readonly tierLabel: string;
  readonly unique: StashCouponUnique;
  /** Coupons the recipe takes */
  readonly need: number;
  /** Coupons of this code in the stash */
  readonly have: number;
  /** How many times the coupon-only recipe can be cubed */
  readonly crafts: number;
  readonly status: CouponStatus;
  /** The coupon + Wild Card recipe, when there is one */
  readonly withWildCards: { readonly qty: number; readonly wildCards: number } | null;
  /** Not craftable with coupons alone, but with the Wild Card recipe and the Wild Cards in the stash */
  readonly readyWithWildCards: boolean;
  /** Sorted by page, then row, then column */
  readonly locations: readonly CouponLocation[];
}

export interface CouponSummary {
  /** Coupon codes owned (rows) */
  readonly distinct: number;
  /** Coupons owned, all codes */
  readonly total: number;
  /** Rows craftable with coupons alone */
  readonly craftable: number;
  /** Crafts of all rows together */
  readonly crafts: number;
  readonly wildCards: number;
  readonly readyWithWildCards: number;
  /** Blank coupons (no recipe of their own), not in the rows */
  readonly blanks: number;
}

export interface CouponCollection {
  readonly rows: readonly CouponRow[];
  readonly summary: CouponSummary;
  /** Wild Card locations */
  readonly wildCardLocations: readonly CouponLocation[];
}

type CouponBundle = Pick<StashBundle, 'coupons' | 'couponTiers'>;

/** A stack's count: the materials tab stores stacks, a page item is one coupon. */
const itemCount = (item: { readonly stackSize: number | null; readonly quantity: number | null }) => item.stackSize ?? item.quantity ?? 1;

const byLocation = (a: CouponLocation, b: CouponLocation) => a.section - b.section || a.y - b.y || a.x - b.x;

export function couponStatus(have: number, need: number): CouponStatus {
  if (have >= need) return 'ready';
  return have === need - 1 ? 'almost' : 'other';
}

/** Every coupon code the stash holds at least one of, with its recipe; the Wild Cards are counted for the summary. */
export function collectCoupons(stash: StashFile, bundle: CouponBundle): CouponCollection {
  const coupons = new Map(bundle.coupons.map((coupon) => [coupon.code, coupon]));
  const tierLabels = new Map(bundle.couponTiers.map((tier) => [tier.type, tier.label]));
  const found = new Map<string, { count: number; locations: CouponLocation[] }>();
  for (const section of stash.sections) {
    for (const item of section.items) {
      if (!coupons.has(item.code)) continue;
      const entry = found.get(item.code) ?? { count: 0, locations: [] };
      entry.count += itemCount(item);
      entry.locations.push({ section: section.index, tabType: section.tabType, x: item.x, y: item.y });
      found.set(item.code, entry);
    }
  }

  const wildCardEntry = [...found].find(([code]) => coupons.get(code)?.wildCard === true)?.[1];
  const wildCards = wildCardEntry?.count ?? 0;
  const rows: CouponRow[] = [];
  let blanks = 0;
  for (const [code, { count, locations }] of found) {
    const coupon = coupons.get(code);
    if (coupon === undefined || coupon.wildCard === true) continue;
    if (coupon.unique === undefined || coupon.qty === undefined) {
      blanks += count;
      continue;
    }
    const withWildCards = coupon.withWildCards ?? null;
    const crafts = Math.floor(count / coupon.qty);
    rows.push({
      code,
      name: coupon.name,
      tier: coupon.type,
      tierLabel: tierLabels.get(coupon.type) ?? coupon.type,
      unique: coupon.unique,
      need: coupon.qty,
      have: count,
      crafts,
      status: couponStatus(count, coupon.qty),
      withWildCards,
      readyWithWildCards: crafts === 0 && withWildCards !== null && count >= withWildCards.qty && wildCards >= withWildCards.wildCards,
      locations: locations.sort(byLocation),
    });
  }

  return {
    rows,
    summary: {
      distinct: rows.length,
      total: rows.reduce((sum, row) => sum + row.have, 0),
      craftable: rows.filter((row) => row.crafts > 0).length,
      crafts: rows.reduce((sum, row) => sum + row.crafts, 0),
      wildCards,
      readyWithWildCards: rows.filter((row) => row.readyWithWildCards).length,
      blanks,
    },
    wildCardLocations: (wildCardEntry?.locations ?? []).sort(byLocation),
  };
}

/** The in-game page of a stash section (1-based), null for the materials tab */
export function pageOf(location: Pick<CouponLocation, 'section' | 'tabType'>): number | null {
  return location.tabType === 'normal' ? location.section + 1 : null;
}

/** "Page 3 · row 2, col 15" (1-based); the materials tab has no page number */
export function formatLocation(location: CouponLocation): string {
  const page = pageOf(location);
  const tab = page === null ? 'Materials tab' : `Page ${String(page)}`;
  return `${tab} · row ${String(location.y + 1)}, col ${String(location.x + 1)}`;
}

/** "2 / 3"; with spare coupons the crafts are shown by the page */
export function formatHaveNeed(row: Pick<CouponRow, 'have' | 'need'>): string {
  return `${String(row.have)} / ${String(row.need)}`;
}

// --- filters, sorting, URL state ----------------------------------------------------------------------------------

export const COUPON_SORT_KEYS = ['status', 'coupon', 'unique', 'tier', 'have', 'location'] as const;
export type CouponSortKey = (typeof COUPON_SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';
export type CouponStatusFilter = CouponStatus | 'all';

export interface CouponsState {
  readonly search: string;
  readonly status: CouponStatusFilter;
  /** Coupon type (cpn1 …) or null for every tier */
  readonly tier: string | null;
  /** In-game page (1-based) or null for every page */
  readonly page: number | null;
  readonly sort: CouponSortKey;
  readonly dir: SortDir;
}

export const DEFAULT_COUPONS_STATE: CouponsState = { search: '', status: 'all', tier: null, page: null, sort: 'status', dir: 'asc' };

const KEYS = { SEARCH: FILTER_URL_PARAM_KEYS.SEARCH, STATUS: 'status', TIER: 'tier', PAGE: 'page', SORT: 'sort', DIR: 'dir' } as const;
const STATUS_FILTERS: readonly CouponStatusFilter[] = ['all', 'ready', 'almost', 'other'];
/** Stash sections 0–999 are pages */
const MAX_PAGE = 1000;

const isOneOf = <T extends string>(values: readonly T[], value: string | null): value is T => values.some((entry) => entry === value);

export const isCouponStatusFilter = (value: string): value is CouponStatusFilter => isOneOf(STATUS_FILTERS, value);

export function readCouponsState(params: URLSearchParams): CouponsState {
  const status = params.get(KEYS.STATUS);
  const sort = params.get(KEYS.SORT);
  const page = Number(params.get(KEYS.PAGE));
  const tier = params.get(KEYS.TIER);
  return {
    search: params.get(KEYS.SEARCH) ?? '',
    status: isOneOf(STATUS_FILTERS, status) ? status : DEFAULT_COUPONS_STATE.status,
    tier: tier === null || tier === '' ? null : tier,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : null,
    sort: isOneOf(COUPON_SORT_KEYS, sort) ? sort : DEFAULT_COUPONS_STATE.sort,
    dir: params.get(KEYS.DIR) === 'desc' ? 'desc' : 'asc',
  };
}

export function encodeCouponsState(state: CouponsState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.search.trim() !== '') params.set(KEYS.SEARCH, state.search.trim());
  if (state.status !== 'all') params.set(KEYS.STATUS, state.status);
  if (state.tier !== null) params.set(KEYS.TIER, state.tier);
  if (state.page !== null) params.set(KEYS.PAGE, String(state.page));
  if (state.sort !== DEFAULT_COUPONS_STATE.sort || state.dir !== DEFAULT_COUPONS_STATE.dir) {
    params.set(KEYS.SORT, state.sort);
    params.set(KEYS.DIR, state.dir);
  }
  return params;
}

/** The rows matching the search (coupon name, unique name, code), status, tier and page filters. */
export function filterCouponRows(rows: readonly CouponRow[], state: Omit<CouponsState, 'sort' | 'dir'>): CouponRow[] {
  const terms = parseSearchTerms(state.search);
  return rows.filter((row) => {
    if (state.status !== 'all' && row.status !== state.status) return false;
    if (state.tier !== null && row.tier !== state.tier) return false;
    if (state.page !== null && !row.locations.some((location) => pageOf(location) === state.page)) return false;
    if (terms.length === 0) return true;
    const haystack = [row.name, row.unique.name, row.code].join('\n').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** Ready first, then ready with Wild Cards, one short, the rest */
const statusRank = (row: CouponRow) => {
  if (row.status === 'ready') return 0;
  if (row.readyWithWildCards) return 1;
  return row.status === 'almost' ? 2 : 3;
};

/** By first location; a row without one (never built) sorts last */
const compareFirstLocations = (a: CouponRow, b: CouponRow) => {
  const [first, second] = [a.locations.at(0), b.locations.at(0)];
  if (first === undefined || second === undefined) return (first === undefined ? 1 : 0) - (second === undefined ? 1 : 0);
  return byLocation(first, second);
};

const COMPARE: Readonly<Record<CouponSortKey, (a: CouponRow, b: CouponRow) => number>> = {
  status: (a, b) => statusRank(a) - statusRank(b) || b.have - a.have,
  coupon: (a, b) => a.name.localeCompare(b.name),
  unique: (a, b) => a.unique.name.localeCompare(b.unique.name),
  tier: (a, b) => a.tier.localeCompare(b.tier),
  have: (a, b) => a.have - b.have || a.crafts - b.crafts,
  location: compareFirstLocations,
};

/** The default sort (`status`, asc) is ready first, then count descending; every sort breaks ties by unique name. */
export function sortCouponRows(rows: readonly CouponRow[], sort: CouponSortKey, dir: SortDir): CouponRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * COMPARE[sort](a, b) || a.unique.name.localeCompare(b.unique.name) || a.code.localeCompare(b.code));
}

/** The direction a column starts in when first clicked: counts high to low, names A to Z */
export function initialSortDir(sort: CouponSortKey): SortDir {
  return sort === 'have' ? 'desc' : 'asc';
}

/** The in-game pages the rows' coupons are on, ascending (the materials tab has none) */
export function couponPages(rows: readonly CouponRow[]): number[] {
  const pages = new Set(rows.flatMap((row) => row.locations.map(pageOf).filter((page) => page !== null)));
  return [...pages].sort((a, b) => a - b);
}

/** The page of a unique (exact-name focus, like the other `?name=` links) */
export function uniquePageUrl(name: string): string {
  return `/uniques?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.NAME]: name }).toString()}`;
}

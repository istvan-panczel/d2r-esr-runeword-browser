/**
 * Ancient Coupons page: the coupons a parsed stash holds, joined with their cube recipes from stash.json, and the
 * page's filters, sorting and URL state. See docs/features/STASH.md "Ancient Coupons".
 */
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { BASE_TIER_LABELS, type BaseTier } from '@/features/game-data/constants/bases';
import type { StashBundle, StashCouponBase, StashCouponUnique } from '@/features/game-data/engine/schema';
import type { StashFile, StashTabType } from '../parser/types';
import { typeAncestors, type ItemTypeIndex } from './itemTypes';
import { compareLocations, pageOf, pagesOf, type StashLocation } from './locations';
import { matchesItemSearch, parseItemSearch, searchText, withoutBaseName } from './search';
import { isOneOf, readEnum, readFlag, readPage, readSortDir, readText, setParam, setSort, type SortDir } from './urlState';
import { walkStashItems } from './walk';

export { formatLocation, pageOf } from './locations';
export type { SortDir } from './urlState';

/** Where one coupon (or one stack of them) lies */
export type CouponLocation = StashLocation;

/**
 * ready: have ≥ need; wildcards: not ready, but the Wild Card recipe works with the stash's Wild Cards; almost: one
 * coupon short (need − 1); other: the rest. In this order on the page (badge, status filter, default sort).
 */
export const COUPON_STATUSES = ['ready', 'wildcards', 'almost', 'other'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

/** Status filter and badge labels */
export const COUPON_STATUS_LABELS: Readonly<Record<CouponStatus, string>> = {
  ready: 'Ready',
  wildcards: 'Ready with Wild Cards',
  almost: 'Almost (1 short)',
  other: 'Other',
};

export interface CouponRow {
  readonly code: string;
  /** "Ancient Coupon (Buckler, Pelta Lunata)" */
  readonly name: string;
  /** Coupon item type (cpn1 …): the tier filter value */
  readonly couponType: string;
  /** Base tier of the coupon type's uniques; null when it has none (the label is then the itemtypes name) */
  readonly tier: BaseTier | null;
  readonly tierLabel: string;
  readonly unique: StashCouponUnique;
  /** The unique's base item; null when stash.json does not know it */
  readonly base: StashCouponBase | null;
  /** Display name of the base's item type ("Belt"); null when unknown */
  readonly baseTypeName: string | null;
  /** The base's item type and its ancestors (types.json), for the item type search */
  readonly typeCodes: readonly string[];
  /** Coupons the recipe takes */
  readonly need: number;
  /** Coupons of this code in the stash */
  readonly have: number;
  /** How many times the coupon-only recipe can be cubed */
  readonly crafts: number;
  readonly status: CouponStatus;
  /** The coupon + Wild Card recipe, when there is one; `suspect` when its numinputs looks wrong (never counted as ready) */
  readonly withWildCards: { readonly qty: number; readonly wildCards: number; readonly suspect?: true } | null;
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
  /** Rows with status `wildcards` */
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

/**
 * How many coupons an item is: the materials tab stores one stack per code with its count in `stackSize`; a page item
 * is one coupon (stackable codes such as the Wild Card carry `stackSize` 0 on a page).
 */
export function itemCount(tabType: StashTabType, item: { readonly stackSize: number | null }): number {
  return tabType !== 'normal' && item.stackSize !== null && item.stackSize > 0 ? item.stackSize : 1;
}

const byLocation = compareLocations;

export function couponStatus(have: number, need: number, readyWithWildCards = false): CouponStatus {
  if (have >= need) return 'ready';
  if (readyWithWildCards) return 'wildcards';
  return have === need - 1 ? 'almost' : 'other';
}

/** The Wild Card recipe works now: no craft with coupons alone, enough coupons and Wild Cards, a sound recipe row. */
function readyWithWildCards(have: number, need: number, recipe: CouponRow['withWildCards'], wildCards: number): boolean {
  return have < need && recipe !== null && recipe.suspect !== true && have >= recipe.qty && wildCards >= recipe.wildCards;
}

/**
 * Every coupon code the stash holds at least one of, with its recipe; the Wild Cards are counted for the summary.
 * `types` (types.json) gives each row its base type chain for the item type search.
 */
export function collectCoupons(stash: StashFile, bundle: CouponBundle, types: ItemTypeIndex | null = null): CouponCollection {
  const coupons = new Map(bundle.coupons.map((coupon) => [coupon.code, coupon]));
  const tiers = new Map(bundle.couponTiers.map((tier) => [tier.type, tier]));
  const found = new Map<string, { count: number; locations: CouponLocation[] }>();
  // Pages and the materials tab; socketed items are never coupons
  for (const { item, location } of walkStashItems(stash, { tabs: 'all' })) {
    if (!coupons.has(item.code)) continue;
    const entry = found.get(item.code) ?? { count: 0, locations: [] };
    entry.count += itemCount(location.tabType, item);
    entry.locations.push(location);
    found.set(item.code, entry);
  }

  const wildCardCode = bundle.coupons.find((coupon) => coupon.wildCard === true)?.code;
  const wildCardEntry = wildCardCode === undefined ? undefined : found.get(wildCardCode);
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
      couponType: coupon.type,
      tier: tiers.get(coupon.type)?.tier ?? null,
      tierLabel: couponTierLabel(tiers.get(coupon.type) ?? { type: coupon.type, name: coupon.type, tier: null }),
      unique: coupon.unique,
      base: coupon.base ?? null,
      baseTypeName: coupon.base === undefined ? null : (types?.byCode.get(coupon.base.type)?.name ?? null),
      typeCodes: coupon.base === undefined || types === null ? [] : typeAncestors(coupon.base.type, types),
      need: coupon.qty,
      have: count,
      crafts,
      status: couponStatus(count, coupon.qty, readyWithWildCards(count, coupon.qty, withWildCards, wildCards)),
      withWildCards,
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
      readyWithWildCards: rows.filter((row) => row.status === 'wildcards').length,
      blanks,
    },
    wildCardLocations: (wildCardEntry?.locations ?? []).sort(byLocation),
  };
}

/** "Normal" / "Exceptional" / "Elite" from the data's base tier, else the itemtypes.txt name */
export function couponTierLabel(tier: Pick<StashBundle['couponTiers'][number], 'type' | 'name' | 'tier'>): string {
  return tier.tier === null ? tier.name : BASE_TIER_LABELS[tier.tier];
}

/** "2 / 3"; with spare coupons the crafts are shown by the page */
export function formatHaveNeed(row: Pick<CouponRow, 'have' | 'need'>): string {
  return `${String(row.have)} / ${String(row.need)}`;
}

// --- filters, sorting, URL state ----------------------------------------------------------------------------------

export const COUPON_SORT_KEYS = ['status', 'coupon', 'unique', 'tier', 'have', 'location'] as const;
export type CouponSortKey = (typeof COUPON_SORT_KEYS)[number];
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
  /** "Show all item information": each row shows the unique's full description (cards instead of the table) */
  readonly details: boolean;
}

export const DEFAULT_COUPONS_STATE: CouponsState = {
  search: '',
  status: 'all',
  tier: null,
  page: null,
  sort: 'status',
  dir: 'asc',
  details: false,
};

const KEYS = {
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
  STATUS: 'status',
  TIER: 'tier',
  PAGE: 'page',
  SORT: 'sort',
  DIR: 'dir',
  DETAILS: 'details',
} as const;
const STATUS_FILTERS: readonly CouponStatusFilter[] = ['all', ...COUPON_STATUSES];

export const isCouponStatusFilter = (value: string): value is CouponStatusFilter => isOneOf(STATUS_FILTERS, value);
export const isCouponSortKey = (value: string): value is CouponSortKey => isOneOf(COUPON_SORT_KEYS, value);

export function readCouponsState(params: URLSearchParams): CouponsState {
  return {
    search: params.get(KEYS.SEARCH) ?? '',
    status: readEnum(params, KEYS.STATUS, STATUS_FILTERS, DEFAULT_COUPONS_STATE.status),
    tier: readText(params, KEYS.TIER),
    page: readPage(params, KEYS.PAGE),
    sort: readEnum(params, KEYS.SORT, COUPON_SORT_KEYS, DEFAULT_COUPONS_STATE.sort),
    dir: readSortDir(params, KEYS.DIR),
    details: readFlag(params, KEYS.DETAILS),
  };
}

export function encodeCouponsState(state: CouponsState): URLSearchParams {
  const params = new URLSearchParams();
  setParam(params, KEYS.SEARCH, state.search.trim());
  if (state.status !== 'all') params.set(KEYS.STATUS, state.status);
  setParam(params, KEYS.TIER, state.tier);
  setParam(params, KEYS.PAGE, state.page);
  setSort(params, { sort: KEYS.SORT, dir: KEYS.DIR }, state, DEFAULT_COUPONS_STATE);
  setParam(params, KEYS.DETAILS, state.details);
  return params;
}

/**
 * The rows matching the search, status, tier and page filters. A search word that names an item type ("belt",
 * "helmet", "rings", "orb"; see itemTypes.ts) matches by the base's type chain or as a word of the unique's name, so
 * "ring" finds rings (and a unique named "… Ring") but not Ring Mail, and "orb" finds Milabrega's Orb; any other word
 * matches the coupon name, unique, code, base name or base type name as text ("sash" → the Sash only).
 */
export function filterCouponRows(
  rows: readonly CouponRow[],
  state: Pick<CouponsState, 'search' | 'status' | 'tier' | 'page'>,
  types: ItemTypeIndex | null = null
): CouponRow[] {
  const terms = parseItemSearch(state.search, types);
  return rows.filter((row) => {
    if (state.status !== 'all' && row.status !== state.status) return false;
    if (state.tier !== null && row.couponType !== state.tier) return false;
    if (state.page !== null && !row.locations.some((location) => pageOf(location) === state.page)) return false;
    if (terms.length === 0) return true;
    const text = searchText([row.name, row.unique.name, row.code, row.base?.name, row.baseTypeName]);
    // A type word also matches a word of the unique's name (Milabrega's Orb), not of the coupon or base names
    const typeWordText = searchText([withoutBaseName(row.unique.name, row.base?.name)]);
    return matchesItemSearch(terms, { text, typeCodes: row.typeCodes, typeWordText });
  });
}

/** Ready first, then ready with Wild Cards, one short, the rest */
const statusRank = (row: CouponRow) => COUPON_STATUSES.indexOf(row.status);

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
  tier: (a, b) => a.couponType.localeCompare(b.couponType),
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
  return pagesOf(rows.flatMap((row) => row.locations));
}

/** The page of a unique (exact-name focus, like the other `?name=` links) */
export function uniquePageUrl(name: string): string {
  return `/uniques?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.NAME]: name }).toString()}`;
}

/**
 * All items page (/stash/items): one row per item on the stash pages (the materials tab is left out; socketed items
 * live inside their parent row), with its name, description, tooltip text and stat values computed once per stash and
 * text context; the page's text search, stat conditions, filters, sorting and URL state. See
 * docs/features/STASH-ITEMS.md "Page".
 */
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { BASE_TIER_LABELS, BASE_TIERS, type BaseTier } from '@/features/game-data/constants/bases';
import type { StashFile, StashItem } from '../../parser/types';
import type { StashCatalog } from '../catalog';
import {
  describeStashItem,
  ITEM_CATEGORIES,
  STASH_ITEM_KINDS,
  type ItemCategory,
  type StashItemDescription,
  type StashItemKind,
} from '../describeItem';
import type { ItemTypeIndex } from '../itemTypes';
import { compareLocations, pageOf, pagesOf, type StashLocation } from '../locations';
import { matchesItemSearch, parseItemSearch, searchText } from '../search';
import { isOneOf, readEnum, readFlag, readPage, readSortDir, readText, setParam, type SortDir } from '../urlState';
import { walkStashItems } from '../walk';
import { itemDisplayName } from './itemNames';
import { createItemTextContext, renderItemText, statValues, type ItemTextContext, type ItemTextGroups, type StatValue } from './itemText';

export type { SortDir } from '../urlState';

// --- rows ------------------------------------------------------------------------------------------------------------

/** An item in a socket of a row's item, with its name and (jewels) stat lines */
export interface SocketedEntry {
  readonly item: StashItem;
  readonly name: string;
  readonly lines: readonly string[];
}

export interface ItemRow {
  /** Unique per listed item: section and index in the section */
  readonly key: string;
  readonly item: StashItem;
  readonly info: StashItemDescription;
  /** itemDisplayName */
  readonly name: string;
  readonly location: StashLocation;
  /** In-game page, 1-based */
  readonly page: number;
  readonly socketed: readonly SocketedEntry[];
  /** renderItemText (base lines only while the text context is the placeholder) */
  readonly text: ItemTextGroups;
  /** statValues by key (empty without the item text) */
  readonly stats: ReadonlyMap<string, StatValue>;
  /** Lower-cased search text: name, base, type, quality, code, set, socketed names, every tooltip line */
  readonly search: string;
}

/** The item text functions a row build uses; tests swap in fakes (the real ones are workstream A's) */
export interface ItemTextEngine {
  readonly render: (item: StashItem, ctx: ItemTextContext) => ItemTextGroups;
  readonly stats: (item: StashItem, ctx: ItemTextContext) => StatValue[];
}

const DEFAULT_ENGINE: ItemTextEngine = { render: renderItemText, stats: statValues };

export const ITEM_KIND_LABELS: Readonly<Record<StashItemKind, string>> = {
  unique: 'Unique',
  set: 'Set',
  runeword: 'Runeword',
  rare: 'Rare',
  crafted: 'Crafted',
  tempered: 'Tempered',
  magic: 'Magic',
  superior: 'Superior',
  inferior: 'Inferior',
  normal: 'Normal',
  simple: 'Simple',
};

export const ITEM_CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  weapon: 'Weapons',
  armor: 'Armor',
  jewelry: 'Rings & amulets',
  charm: 'Charms',
  jewel: 'Jewels',
  other: 'Other',
};

/** "Runeword", or "Gemword" for a charm gemword */
export function kindLabel(row: Pick<ItemRow, 'info'>): string {
  return row.info.kind === 'runeword' && row.info.runeword?.gemword === true ? 'Gemword' : ITEM_KIND_LABELS[row.info.kind];
}

const allLines = (text: ItemTextGroups): string[] => [
  ...text.base,
  ...text.stats,
  ...text.runeword,
  ...text.setBonuses.flatMap((bonus) => bonus.lines),
  ...text.socketed.flatMap((entry) => entry.lines),
];

function buildRow(item: StashItem, location: StashLocation, catalog: StashCatalog, ctx: ItemTextContext, engine: ItemTextEngine): ItemRow {
  const info = describeStashItem(item, catalog);
  const name = itemDisplayName(item, catalog, ctx);
  const text = engine.render(item, ctx);
  const linesOf = new Map(text.socketed.map((entry) => [entry.item, entry.lines]));
  const socketed = item.socketed.map((child) => ({
    item: child,
    name: itemDisplayName(child, catalog, ctx),
    lines: linesOf.get(child) ?? [],
  }));
  const stats = new Map<string, StatValue>();
  for (const value of engine.stats(item, ctx)) if (!stats.has(value.key)) stats.set(value.key, value);
  const row = { info };
  const search = searchText([
    name,
    info.baseName,
    info.typeName,
    kindLabel(row),
    info.tier === null ? null : BASE_TIER_LABELS[info.tier],
    info.code,
    info.set?.name,
    item.ethereal ? 'ethereal' : null,
    ...socketed.map((entry) => entry.name),
    ...allLines(text),
  ]);
  return {
    key: `${String(location.section)}:${String(item.index)}`,
    item,
    info,
    name,
    location,
    page: pageOf(location) ?? location.section + 1,
    socketed,
    text,
    stats,
    search,
  };
}

/** The rows of a stash (pages only, in stash order), uncached; `text` null builds them with the placeholder context. */
export function createItemRows(
  stash: StashFile,
  catalog: StashCatalog,
  text: ItemTextContext | null,
  engine: ItemTextEngine = DEFAULT_ENGINE
): ItemRow[] {
  const ctx = text ?? placeholderContext(catalog);
  return walkStashItems(stash, { tabs: 'pages' }).map(({ item, location }) => buildRow(item, location, catalog, ctx, engine));
}

const placeholders = new WeakMap<StashCatalog, ItemTextContext>();
function placeholderContext(catalog: StashCatalog): ItemTextContext {
  let ctx = placeholders.get(catalog);
  if (ctx === undefined) {
    ctx = createItemTextContext(null, catalog);
    placeholders.set(catalog, ctx);
  }
  return ctx;
}

// The rows of the last stash / catalog / text contexts (the page re-renders on every keystroke; ~2500 items)
const rowCache = new WeakMap<StashFile, { catalog: StashCatalog; text: ItemTextContext | null; rows: readonly ItemRow[] }[]>();

/** The rows of a stash for a catalog and text context, built once per triple (the last two kept per stash). */
export function itemRows(stash: StashFile, catalog: StashCatalog, text: ItemTextContext | null): readonly ItemRow[] {
  const entries = rowCache.get(stash) ?? [];
  const hit = entries.find((entry) => entry.catalog === catalog && entry.text === text);
  if (hit !== undefined) return hit.rows;
  const rows = createItemRows(stash, catalog, text);
  rowCache.set(stash, [...entries.slice(-1), { catalog, text, rows }]);
  return rows;
}

export interface ItemsSummary {
  readonly total: number;
  readonly uniques: number;
  readonly sets: number;
  readonly runewords: number;
  /** Items sitting in sockets (not rows of their own) */
  readonly socketed: number;
}

/** The counts of the page's summary chips and the My Stash home card (no item text needed) */
export function itemsSummary(stash: StashFile, catalog: StashCatalog): ItemsSummary {
  const walked = walkStashItems(stash, { tabs: 'pages' });
  const kinds = walked.map(({ item }) => describeStashItem(item, catalog).kind);
  const count = (kind: StashItemKind) => kinds.filter((entry) => entry === kind).length;
  return {
    total: walked.length,
    uniques: count('unique'),
    sets: count('set'),
    runewords: count('runeword'),
    socketed: walked.reduce((sum, { item }) => sum + item.socketed.length, 0),
  };
}

// --- stat conditions -------------------------------------------------------------------------------------------------

export const STAT_OPS = ['min', 'max'] as const;
export type StatOp = (typeof STAT_OPS)[number];

/** "stat ≥ value" (min) or "stat ≤ value" (max) on a StatValue key */
export interface StatCondition {
  readonly key: string;
  readonly op: StatOp;
  readonly value: number;
}

/** The row has the stat and its value passes; a row without the stat fails every condition on it */
export function matchesCondition(row: Pick<ItemRow, 'stats'>, condition: StatCondition): boolean {
  const stat = row.stats.get(condition.key);
  if (stat === undefined) return false;
  return condition.op === 'min' ? stat.value >= condition.value : stat.value <= condition.value;
}

/** Every condition passes (AND); no conditions pass everything */
export function matchesConditions(row: Pick<ItemRow, 'stats'>, conditions: readonly StatCondition[]): boolean {
  return conditions.every((condition) => matchesCondition(row, condition));
}

/** A stat of the stat picker: a key present in the stash, how many rows have it and their value span */
export interface StatOption {
  readonly key: string;
  readonly statKey: string;
  readonly label: string;
  readonly statLabel: string;
  readonly paramLabel: string | null;
  readonly count: number;
  readonly min: number;
  readonly max: number;
}

/** A label's sort text: without the leading signs and placeholders ("+#% Faster Cast Rate" → "Faster Cast Rate") */
const labelSortText = (label: string) => label.replace(/^[^A-Za-z[]+/, '');

/** The distinct stat keys of the rows, by stat label (its words, signs and `#` skipped), then param label */
export function statOptions(rows: readonly Pick<ItemRow, 'stats'>[]): StatOption[] {
  const options = new Map<string, StatOption>();
  for (const row of rows) {
    for (const stat of row.stats.values()) {
      const known = options.get(stat.key);
      options.set(
        stat.key,
        known === undefined
          ? {
              key: stat.key,
              statKey: stat.statKey,
              label: stat.label,
              statLabel: stat.statLabel,
              paramLabel: stat.paramLabel,
              count: 1,
              min: stat.value,
              max: stat.value,
            }
          : { ...known, count: known.count + 1, min: Math.min(known.min, stat.value), max: Math.max(known.max, stat.value) }
      );
    }
  }
  return [...options.values()].sort(
    (a, b) =>
      labelSortText(a.statLabel).localeCompare(labelSortText(b.statLabel)) ||
      (a.paramLabel ?? '').localeCompare(b.paramLabel ?? '') ||
      a.key.localeCompare(b.key)
  );
}

/** A stat label without the `#` placeholder ("+#% Faster Cast Rate" → "+% Faster Cast Rate"), for picker and chips */
export function statName(label: string): string {
  return label
    .replace(/#/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** A displayed value: "20", "10-20" for a range, "1.5 per level" */
export function formatStatValue(stat: Pick<StatValue, 'value' | 'range' | 'perLevel'>): string {
  const number = (value: number) => String(Math.round(value * 100) / 100);
  const text = stat.range === undefined ? number(stat.value) : `${number(stat.range.min)}-${number(stat.range.max)}`;
  return stat.perLevel === true ? `${text} per level` : text;
}

// --- filters, sorting, URL state -------------------------------------------------------------------------------------

export const ITEM_SORT_KEYS = ['location', 'name', 'quality', 'ilvl', 'stat'] as const;
export type ItemSortKey = (typeof ITEM_SORT_KEYS)[number];

export const ETHEREAL_FILTERS = ['all', 'yes', 'no'] as const;
export type EtherealFilter = (typeof ETHEREAL_FILTERS)[number];

/** socketed: has sockets; open: has an empty socket; none: no sockets; runeword: a runeword (or gemword) */
export const SOCKET_FILTERS = ['all', 'socketed', 'open', 'none', 'runeword'] as const;
export type SocketFilter = (typeof SOCKET_FILTERS)[number];

export type QualityFilter = StashItemKind | 'all';
export type CategoryFilter = ItemCategory | 'all';
/** A base tier, `none` (tierless: misc items and tierless gear) or `all` */
export type TierFilter = BaseTier | 'none' | 'all';

export interface ItemsState {
  readonly search: string;
  readonly quality: QualityFilter;
  readonly category: CategoryFilter;
  readonly tier: TierFilter;
  /** In-game page (1-based) or null for every page */
  readonly page: number | null;
  readonly ethereal: EtherealFilter;
  readonly sockets: SocketFilter;
  /** Stat conditions, ANDed */
  readonly stats: readonly StatCondition[];
  readonly sort: ItemSortKey;
  /** The stat key of the `stat` sort */
  readonly sortStat: string | null;
  readonly dir: SortDir;
  /** "Show all item information": tooltip cards instead of the table */
  readonly details: boolean;
}

export const DEFAULT_ITEMS_STATE: ItemsState = {
  search: '',
  quality: 'all',
  category: 'all',
  tier: 'all',
  page: null,
  ethereal: 'all',
  sockets: 'all',
  stats: [],
  sort: 'location',
  sortStat: null,
  dir: 'asc',
  details: false,
};

const KEYS = {
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
  QUALITY: 'quality',
  CATEGORY: 'cat',
  TIER: 'tier',
  PAGE: 'page',
  ETHEREAL: 'eth',
  SOCKETS: 'sockets',
  STAT: 'stat',
  SORT: 'sort',
  SORT_STAT: 'by',
  DIR: 'dir',
  DETAILS: 'details',
} as const;

const QUALITY_FILTERS: readonly QualityFilter[] = ['all', ...STASH_ITEM_KINDS];
const CATEGORY_FILTERS: readonly CategoryFilter[] = ['all', ...ITEM_CATEGORIES];
const TIER_FILTERS: readonly TierFilter[] = ['all', ...BASE_TIERS, 'none'];

export const isQualityFilter = (value: string): value is QualityFilter => isOneOf(QUALITY_FILTERS, value);
export const isCategoryFilter = (value: string): value is CategoryFilter => isOneOf(CATEGORY_FILTERS, value);
export const isTierFilter = (value: string): value is TierFilter => isOneOf(TIER_FILTERS, value);
export const isEtherealFilter = (value: string): value is EtherealFilter => isOneOf(ETHEREAL_FILTERS, value);
export const isSocketFilter = (value: string): value is SocketFilter => isOneOf(SOCKET_FILTERS, value);
export const isItemSortKey = (value: string): value is ItemSortKey => isOneOf(ITEM_SORT_KEYS, value);

/** A StatValue key as the URL carries it: letters, digits, `.` and `-` (`s127.54`, `g.dmg-fire`) */
const STAT_KEY = /^[A-Za-z0-9.-]+$/;

/** `s105_min_20`: key, op and value joined by `_` (the key holds no `_`; URLSearchParams leaves all three as is) */
export function encodeStatCondition(condition: StatCondition): string {
  return `${condition.key}_${condition.op}_${String(condition.value)}`;
}

const STAT_CONDITION = /^([A-Za-z0-9.-]+)_(min|max)_([^_]+)$/;

export function parseStatCondition(text: string): StatCondition | null {
  const match = STAT_CONDITION.exec(text);
  if (match === null) return null;
  const [, key = '', op = '', value = ''] = match;
  const number = Number(value);
  if (!isOneOf(STAT_OPS, op) || !Number.isFinite(number)) return null;
  return { key, op, value: number };
}

export function readItemsState(params: URLSearchParams): ItemsState {
  const sortStat = readText(params, KEYS.SORT_STAT);
  return {
    search: params.get(KEYS.SEARCH) ?? '',
    quality: readEnum(params, KEYS.QUALITY, QUALITY_FILTERS, 'all'),
    category: readEnum(params, KEYS.CATEGORY, CATEGORY_FILTERS, 'all'),
    tier: readEnum(params, KEYS.TIER, TIER_FILTERS, 'all'),
    page: readPage(params, KEYS.PAGE),
    ethereal: readEnum(params, KEYS.ETHEREAL, ETHEREAL_FILTERS, 'all'),
    sockets: readEnum(params, KEYS.SOCKETS, SOCKET_FILTERS, 'all'),
    stats: params.getAll(KEYS.STAT).flatMap((text) => parseStatCondition(text) ?? []),
    sort: readEnum(params, KEYS.SORT, ITEM_SORT_KEYS, DEFAULT_ITEMS_STATE.sort),
    sortStat: sortStat !== null && STAT_KEY.test(sortStat) ? sortStat : null,
    dir: readSortDir(params, KEYS.DIR),
    details: readFlag(params, KEYS.DETAILS),
  };
}

export function encodeItemsState(state: ItemsState): URLSearchParams {
  const params = new URLSearchParams();
  setParam(params, KEYS.SEARCH, state.search.trim());
  if (state.quality !== 'all') params.set(KEYS.QUALITY, state.quality);
  if (state.category !== 'all') params.set(KEYS.CATEGORY, state.category);
  if (state.tier !== 'all') params.set(KEYS.TIER, state.tier);
  setParam(params, KEYS.PAGE, state.page);
  if (state.ethereal !== 'all') params.set(KEYS.ETHEREAL, state.ethereal);
  if (state.sockets !== 'all') params.set(KEYS.SOCKETS, state.sockets);
  for (const condition of state.stats) params.append(KEYS.STAT, encodeStatCondition(condition));
  if (state.sort !== DEFAULT_ITEMS_STATE.sort || state.dir !== DEFAULT_ITEMS_STATE.dir) {
    params.set(KEYS.SORT, state.sort);
    params.set(KEYS.DIR, state.dir);
  }
  if (state.sort === 'stat') setParam(params, KEYS.SORT_STAT, state.sortStat);
  setParam(params, KEYS.DETAILS, state.details);
  return params;
}

function matchesSockets(row: ItemRow, filter: SocketFilter): boolean {
  const sockets = row.item.sockets ?? 0;
  switch (filter) {
    case 'all':
      return true;
    case 'socketed':
      return sockets > 0;
    case 'open':
      return sockets > row.item.socketed.length;
    case 'none':
      return sockets === 0;
    case 'runeword':
      return row.info.kind === 'runeword';
  }
}

export type ItemFilter = Omit<ItemsState, 'sort' | 'sortStat' | 'dir' | 'details'>;

/** The filters other than search and stats, one row at a time */
function matchesFields(row: ItemRow, state: ItemFilter): boolean {
  if (state.quality !== 'all' && row.info.kind !== state.quality) return false;
  if (state.category !== 'all' && row.info.category !== state.category) return false;
  if (state.tier !== 'all' && (row.info.tier ?? 'none') !== state.tier) return false;
  if (state.page !== null && row.page !== state.page) return false;
  if (state.ethereal !== 'all' && row.item.ethereal !== (state.ethereal === 'yes')) return false;
  return matchesSockets(row, state.sockets);
}

/**
 * The rows matching every filter: search terms (an item type word by the type chain, any other term as text in the
 * row's search text), quality, category, tier, page, ethereal, sockets and the stat conditions.
 */
export function filterItemRows(rows: readonly ItemRow[], state: ItemFilter, types: ItemTypeIndex | null = null): ItemRow[] {
  const terms = parseItemSearch(state.search, types);
  return rows.filter(
    (row) =>
      matchesFields(row, state) &&
      matchesConditions(row, state.stats) &&
      matchesItemSearch(terms, { text: row.search, typeCodes: row.info.typeChain })
  );
}

const kindRank = (row: ItemRow) => STASH_ITEM_KINDS.indexOf(row.info.kind);
const byName = (a: ItemRow, b: ItemRow) => a.name.localeCompare(b.name);
const byLocation = (a: ItemRow, b: ItemRow) => compareLocations(a.location, b.location) || a.item.index - b.item.index;

const COMPARE: Readonly<Record<Exclude<ItemSortKey, 'stat'>, (a: ItemRow, b: ItemRow) => number>> = {
  location: byLocation,
  name: (a, b) => byName(a, b) || byLocation(a, b),
  quality: (a, b) => kindRank(a) - kindRank(b) || byName(a, b) || byLocation(a, b),
  ilvl: (a, b) => (a.item.level ?? 0) - (b.item.level ?? 0) || byName(a, b) || byLocation(a, b),
};

/**
 * Sorted copy. `stat` sorts by the `sortStat` value, rows without the stat last in both directions (then by name);
 * `stat` without a stat key sorts by location.
 */
export function sortItemRows(rows: readonly ItemRow[], sort: ItemSortKey, dir: SortDir, sortStat: string | null = null): ItemRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  if (sort === 'stat' && sortStat !== null) {
    return [...rows].sort((a, b) => {
      const [first, second] = [a.stats.get(sortStat), b.stats.get(sortStat)];
      if (first === undefined || second === undefined) {
        return (first === undefined ? 1 : 0) - (second === undefined ? 1 : 0) || byName(a, b) || byLocation(a, b);
      }
      return sign * (first.value - second.value) || byName(a, b) || byLocation(a, b);
    });
  }
  const compare = COMPARE[sort === 'stat' ? 'location' : sort];
  return [...rows].sort((a, b) => sign * compare(a, b));
}

/** The direction a sort starts in: item level and stat values high to low, the rest A to Z / stash order */
export function initialItemSortDir(sort: ItemSortKey): SortDir {
  return sort === 'ilvl' || sort === 'stat' ? 'desc' : 'asc';
}

/** The in-game pages holding a row, ascending */
export function itemPages(rows: readonly ItemRow[]): number[] {
  return pagesOf(rows.map((row) => row.location));
}

/** How many rows each value of a field has (the filter pills' counts) */
export function countBy<K extends string>(rows: readonly ItemRow[], keyOf: (row: ItemRow) => K): ReadonlyMap<K, number> {
  const counts = new Map<K, number>();
  for (const row of rows) counts.set(keyOf(row), (counts.get(keyOf(row)) ?? 0) + 1);
  return counts;
}

/** Whether a state filters anything (the reset link) */
export function hasItemFilters(state: ItemFilter): boolean {
  return (
    state.search.trim() !== '' ||
    state.quality !== 'all' ||
    state.category !== 'all' ||
    state.tier !== 'all' ||
    state.page !== null ||
    state.ethereal !== 'all' ||
    state.sockets !== 'all' ||
    state.stats.length > 0
  );
}

import { FILTER_URL_PARAM_KEYS, MAX_REQ_LEVEL_RANGE, SOCKET_COUNT_RANGE, parseBoundedIntParam } from '@/core/utils/filterUrlParams';
import { isClassCode } from '../engine/schema';
import { BASE_KINDS, BASE_TIERS, isBaseSortKey, isBaseView, type BaseView } from '../constants/bases';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import { DEFAULT_BASE_FILTERS, type BaseFilters, type ClassFilter } from './gameDataSlice';

/** Every URL param the Bases page reads. */
export const BASE_FILTER_PARAM_KEYS: readonly string[] = [
  FILTER_URL_PARAM_KEYS.SEARCH,
  FILTER_URL_PARAM_KEYS.SOCKETS,
  FILTER_URL_PARAM_KEYS.MAXLVL,
  GAME_DATA_URL_PARAM_KEYS.KIND,
  GAME_DATA_URL_PARAM_KEYS.TIER,
  GAME_DATA_URL_PARAM_KEYS.TYPE,
  GAME_DATA_URL_PARAM_KEYS.CODES,
  GAME_DATA_URL_PARAM_KEYS.CLS,
  GAME_DATA_URL_PARAM_KEYS.SORT,
  GAME_DATA_URL_PARAM_KEYS.VIEW,
];

export function hasBaseFilterParams(params: URLSearchParams): boolean {
  return BASE_FILTER_PARAM_KEYS.some((key) => params.has(key));
}

function splitList(value: string | null): string[] {
  return value === null ? [] : value.split(',').filter(Boolean);
}

function pickKnown<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  const known = values.filter((value): value is T => (allowed as readonly string[]).includes(value));
  return [...new Set(known)];
}

/**
 * Non-default filters as URL params. Sort is `sort=<key>` ascending or `sort=-<key>` descending; the families view is
 * `view=families` (cards, the default, is omitted).
 */
export function encodeBaseFilters(filters: BaseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set(FILTER_URL_PARAM_KEYS.SEARCH, filters.search);
  if (filters.minSockets !== null) params.set(FILTER_URL_PARAM_KEYS.SOCKETS, String(filters.minSockets));
  if (filters.maxReqLvl !== null) params.set(FILTER_URL_PARAM_KEYS.MAXLVL, String(filters.maxReqLvl));
  if (filters.kinds.length > 0) params.set(GAME_DATA_URL_PARAM_KEYS.KIND, filters.kinds.join(','));
  if (filters.tiers.length > 0) params.set(GAME_DATA_URL_PARAM_KEYS.TIER, filters.tiers.join(','));
  if (filters.types.length > 0) params.set(GAME_DATA_URL_PARAM_KEYS.TYPE, filters.types.join(','));
  if (filters.codes.length > 0) params.set(GAME_DATA_URL_PARAM_KEYS.CODES, filters.codes.join(','));
  if (filters.classOnly !== 'any') params.set(GAME_DATA_URL_PARAM_KEYS.CLS, filters.classOnly);
  if (filters.sort !== DEFAULT_BASE_FILTERS.sort || filters.sortDir !== DEFAULT_BASE_FILTERS.sortDir) {
    params.set(GAME_DATA_URL_PARAM_KEYS.SORT, `${filters.sortDir === 'desc' ? '-' : ''}${filters.sort}`);
  }
  if (filters.view !== DEFAULT_BASE_FILTERS.view) params.set(GAME_DATA_URL_PARAM_KEYS.VIEW, filters.view);
  return params;
}

function decodeClassFilter(value: string | null): ClassFilter {
  if (value === 'none') return 'none';
  if (value !== null && isClassCode(value)) return value;
  return 'any';
}

function decodeView(value: string | null): BaseView {
  return value !== null && isBaseView(value) ? value : DEFAULT_BASE_FILTERS.view;
}

function decodeSort(value: string | null): Pick<BaseFilters, 'sort' | 'sortDir'> {
  if (value === null) return { sort: DEFAULT_BASE_FILTERS.sort, sortDir: DEFAULT_BASE_FILTERS.sortDir };
  const desc = value.startsWith('-');
  const key = desc ? value.slice(1) : value;
  if (!isBaseSortKey(key)) return { sort: DEFAULT_BASE_FILTERS.sort, sortDir: DEFAULT_BASE_FILTERS.sortDir };
  return { sort: key, sortDir: desc ? 'desc' : 'asc' };
}

/**
 * Full filter state from URL params; anything missing or invalid falls back to the default.
 * `knownTypes`, when given, drops type codes that do not exist in the types bundle.
 */
export function decodeBaseFilters(params: URLSearchParams, knownTypes?: ReadonlySet<string>): BaseFilters {
  const types = [...new Set(splitList(params.get(GAME_DATA_URL_PARAM_KEYS.TYPE)))].filter(
    (code) => knownTypes === undefined || knownTypes.has(code)
  );
  return {
    search: params.get(FILTER_URL_PARAM_KEYS.SEARCH) ?? '',
    kinds: pickKnown(splitList(params.get(GAME_DATA_URL_PARAM_KEYS.KIND)), BASE_KINDS),
    tiers: pickKnown(splitList(params.get(GAME_DATA_URL_PARAM_KEYS.TIER)), BASE_TIERS),
    types,
    codes: [...new Set(splitList(params.get(GAME_DATA_URL_PARAM_KEYS.CODES)))],
    minSockets: parseBoundedIntParam(params.get(FILTER_URL_PARAM_KEYS.SOCKETS), SOCKET_COUNT_RANGE),
    maxReqLvl: parseBoundedIntParam(params.get(FILTER_URL_PARAM_KEYS.MAXLVL), MAX_REQ_LEVEL_RANGE),
    classOnly: decodeClassFilter(params.get(GAME_DATA_URL_PARAM_KEYS.CLS)),
    ...decodeSort(params.get(GAME_DATA_URL_PARAM_KEYS.SORT)),
    view: decodeView(params.get(GAME_DATA_URL_PARAM_KEYS.VIEW)),
  };
}

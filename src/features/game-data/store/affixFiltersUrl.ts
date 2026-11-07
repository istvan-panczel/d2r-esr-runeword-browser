import { FILTER_URL_PARAM_KEYS, parseBoundedIntParam } from '@/core/utils/filterUrlParams';
import { isClassCode } from '../engine/schema';
import { AFFIX_KINDS, AFFIX_LEVEL_RANGE, isAffixSortKey, isAffixView, type AffixKind } from '../constants/affixes';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import { DEFAULT_AFFIX_FILTERS, type AffixFilters, type ClassFilter } from './gameDataSlice';

const KEYS = GAME_DATA_URL_PARAM_KEYS;

/** Every URL param the Affixes page reads. */
export const AFFIX_FILTER_PARAM_KEYS: readonly string[] = [
  FILTER_URL_PARAM_KEYS.SEARCH,
  FILTER_URL_PARAM_KEYS.MAXLVL,
  KEYS.AFF,
  KEYS.RARE,
  KEYS.MINLVL,
  KEYS.CLS,
  KEYS.TYPE,
  KEYS.BASE,
  KEYS.ILVL,
  KEYS.QUALITY,
  KEYS.AUTO,
  KEYS.SORT,
  KEYS.VIEW,
  KEYS.SUPERIOR_TYPE,
];

export function hasAffixFilterParams(params: URLSearchParams): boolean {
  return AFFIX_FILTER_PARAM_KEYS.some((key) => params.has(key));
}

function splitList(value: string | null): string[] {
  return value === null ? [] : [...new Set(value.split(',').filter(Boolean))];
}

/**
 * Non-default filters as URL params: `view=superior`, `stype=<type code>`, `search`, `aff=p,s,a`, `rare=1`, `minlvl`/`maxlvl`, `cls`, `type=a,b`,
 * `base=<code>`, `ilvl`, `q=rare`, `auto=0`, `sort=<key>` or `sort=-<key>` (descending).
 */
export function encodeAffixFilters(filters: AffixFilters): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = DEFAULT_AFFIX_FILTERS;
  if (filters.view !== defaults.view) params.set(KEYS.VIEW, filters.view);
  if (filters.superiorType !== null) params.set(KEYS.SUPERIOR_TYPE, filters.superiorType);
  if (filters.search) params.set(FILTER_URL_PARAM_KEYS.SEARCH, filters.search);
  if (filters.kinds.length > 0) params.set(KEYS.AFF, filters.kinds.join(','));
  if (filters.rareOnly) params.set(KEYS.RARE, '1');
  if (filters.minLvl !== null) params.set(KEYS.MINLVL, String(filters.minLvl));
  if (filters.maxLvl !== null) params.set(FILTER_URL_PARAM_KEYS.MAXLVL, String(filters.maxLvl));
  if (filters.cls !== 'any') params.set(KEYS.CLS, filters.cls);
  if (filters.types.length > 0) params.set(KEYS.TYPE, filters.types.join(','));
  if (filters.base !== null) params.set(KEYS.BASE, filters.base);
  if (filters.ilvl !== defaults.ilvl) params.set(KEYS.ILVL, String(filters.ilvl));
  if (filters.quality !== defaults.quality) params.set(KEYS.QUALITY, filters.quality);
  if (filters.includeAutomagic !== defaults.includeAutomagic) params.set(KEYS.AUTO, filters.includeAutomagic ? '1' : '0');
  if (filters.sort !== defaults.sort || filters.sortDir !== defaults.sortDir) {
    params.set(KEYS.SORT, `${filters.sortDir === 'desc' ? '-' : ''}${filters.sort}`);
  }
  return params;
}

function decodeClassFilter(value: string | null): ClassFilter {
  if (value === 'none') return 'none';
  if (value !== null && isClassCode(value)) return value;
  return 'any';
}

function decodeSort(value: string | null): Pick<AffixFilters, 'sort' | 'sortDir'> {
  const fallback = { sort: DEFAULT_AFFIX_FILTERS.sort, sortDir: DEFAULT_AFFIX_FILTERS.sortDir };
  if (value === null) return fallback;
  const desc = value.startsWith('-');
  const key = desc ? value.slice(1) : value;
  return isAffixSortKey(key) ? { sort: key, sortDir: desc ? 'desc' : 'asc' } : fallback;
}

function decodeBool(value: string | null, fallback: boolean): boolean {
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}

export interface AffixUrlKnownCodes {
  readonly types?: ReadonlySet<string>;
  readonly bases?: ReadonlySet<string>;
}

/**
 * Full filter state from URL params; anything missing or invalid falls back to the default.
 * `known.types` / `known.bases`, when given, drop type and base codes that do not exist in the bundles.
 */
export function decodeAffixFilters(params: URLSearchParams, known: AffixUrlKnownCodes = {}): AffixFilters {
  const kinds = splitList(params.get(KEYS.AFF)).filter((kind): kind is AffixKind => (AFFIX_KINDS as readonly string[]).includes(kind));
  const types = splitList(params.get(KEYS.TYPE)).filter((code) => known.types === undefined || known.types.has(code));
  const base = params.get(KEYS.BASE)?.trim() ?? '';
  const quality = params.get(KEYS.QUALITY);
  const view = params.get(KEYS.VIEW) ?? '';
  const superiorType = params.get(KEYS.SUPERIOR_TYPE)?.trim() ?? '';
  return {
    view: isAffixView(view) ? view : DEFAULT_AFFIX_FILTERS.view,
    search: params.get(FILTER_URL_PARAM_KEYS.SEARCH) ?? '',
    kinds,
    rareOnly: decodeBool(params.get(KEYS.RARE), false),
    minLvl: parseBoundedIntParam(params.get(KEYS.MINLVL), AFFIX_LEVEL_RANGE),
    maxLvl: parseBoundedIntParam(params.get(FILTER_URL_PARAM_KEYS.MAXLVL), AFFIX_LEVEL_RANGE),
    cls: decodeClassFilter(params.get(KEYS.CLS)),
    types,
    base: base === '' || (known.bases !== undefined && !known.bases.has(base)) ? null : base,
    ilvl: parseBoundedIntParam(params.get(KEYS.ILVL), AFFIX_LEVEL_RANGE) ?? DEFAULT_AFFIX_FILTERS.ilvl,
    quality: quality === 'rare' || quality === 'magic' ? quality : DEFAULT_AFFIX_FILTERS.quality,
    includeAutomagic: decodeBool(params.get(KEYS.AUTO), DEFAULT_AFFIX_FILTERS.includeAutomagic),
    ...decodeSort(params.get(KEYS.SORT)),
    superiorType: superiorType === '' || (known.types !== undefined && !known.types.has(superiorType)) ? null : superiorType,
  };
}

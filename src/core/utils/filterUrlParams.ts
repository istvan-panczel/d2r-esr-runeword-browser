/**
 * Shared helpers for encoding/decoding recipe filter state in share URLs.
 * Used by the runewords and gemwords useShareUrl/useUrlInitialize hooks so the
 * param names and "absent param = everything selected" semantics stay in sync.
 */
export const FILTER_URL_PARAM_KEYS = {
  SEARCH: 'search',
  SOCKETS: 'sockets',
  MAXLVL: 'maxlvl',
  ITEMS: 'items',
  RUNES: 'runes',
  TIERPTS: 'tierpts',
  GEMS: 'gems',
} as const;

export const SOCKET_COUNT_RANGE = { min: 1, max: 6 } as const;
export const MAX_REQ_LEVEL_RANGE = { min: 1, max: 999 } as const;

export interface CommonFilterState {
  readonly searchText: string;
  readonly socketCount: number | null;
  readonly maxReqLevel: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
}

/**
 * Adds a comma-separated selection param, but only when NOT everything is
 * selected (an absent param means "all selected" when decoding).
 */
export function appendSelectionParam(params: URLSearchParams, key: string, selection: Record<string, boolean>): void {
  const keys = Object.keys(selection);
  if (keys.length === 0) return;
  if (Object.values(selection).every(Boolean)) return;

  const selectedKeys = keys.filter((entry) => selection[entry]);
  if (selectedKeys.length > 0) {
    params.set(key, selectedKeys.join(','));
  }
}

/** Adds the search/sockets/maxlvl/items params shared by all recipe screens. */
export function appendCommonFilterParams(params: URLSearchParams, filters: CommonFilterState): void {
  if (filters.searchText) {
    params.set(FILTER_URL_PARAM_KEYS.SEARCH, filters.searchText);
  }

  if (filters.socketCount !== null) {
    params.set(FILTER_URL_PARAM_KEYS.SOCKETS, String(filters.socketCount));
  }

  if (filters.maxReqLevel !== null) {
    params.set(FILTER_URL_PARAM_KEYS.MAXLVL, String(filters.maxReqLevel));
  }

  appendSelectionParam(params, FILTER_URL_PARAM_KEYS.ITEMS, filters.selectedItemTypes);
}

/**
 * Decodes a comma-separated selection param into a full selection record:
 * - param present → only the listed keys are selected
 * - param absent → stored value per key (when provided), defaulting to selected
 */
export function decodeSelectionParam(
  allKeys: readonly string[],
  paramValue: string | null,
  storedSelection?: Record<string, boolean>
): Record<string, boolean> {
  const selectedSet = paramValue ? new Set(paramValue.split(',')) : null;
  const selection: Record<string, boolean> = {};
  for (const key of allKeys) {
    selection[key] = selectedSet ? selectedSet.has(key) : (storedSelection?.[key] ?? true);
  }
  return selection;
}

/** Parses an integer URL param, returning null when missing or out of range. */
export function parseBoundedIntParam(value: string | null, range: { readonly min: number; readonly max: number }): number | null {
  if (value === null) return null;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < range.min || parsed > range.max) return null;
  return parsed;
}

/** Builds an absolute share URL for a route ('' for the index route). */
export function buildShareUrl(routePath: string, params: URLSearchParams): string {
  const baseUrl = import.meta.env.BASE_URL;
  const path = routePath ? `${baseUrl.replace(/\/$/, '')}/${routePath}` : baseUrl;
  const base = `${window.location.origin}${path}`;
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Removes the query string after URL filters were read, keeping the URL tidy. */
export function clearUrlSearchParams(): void {
  window.history.replaceState({}, '', window.location.pathname);
}

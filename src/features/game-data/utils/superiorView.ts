import { parseSearchTerms } from '@/core/utils/searchTerms';
import type { SuperiorAffixes, SuperiorPool, SuperiorRow } from '../engine/schema';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';

export interface SuperiorTypeOption {
  readonly code: string;
  readonly name: string;
}

/** Every own item type of some pool, by name (the Superior view's item type select). */
export function superiorTypeOptions(superior: SuperiorAffixes, typeNames: ReadonlyMap<string, string>): SuperiorTypeOption[] {
  const codes = [...new Set(superior.pools.flatMap((pool) => pool.types))];
  return codes.map((code) => ({ code, name: typeNames.get(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
}

export interface SuperiorPoolRoll {
  readonly row: SuperiorRow;
  /** weight / pool total */
  readonly chance: number;
}

export interface SuperiorPoolView {
  readonly pool: SuperiorPool;
  /** The pool's own type names, in pool order */
  readonly typeNames: readonly string[];
  /** The rows matching the search, in row order */
  readonly rolls: readonly SuperiorPoolRoll[];
}

/**
 * The pools of the Superior view: only those with `superiorType` among their types (null = all), and in each the rows
 * whose text, or the pool's label and type names, contain every search term. Pools without a matching row are left out;
 * chances always use the pool's full total.
 */
export function filterSuperiorPools(
  superior: SuperiorAffixes,
  filters: { readonly search: string; readonly superiorType: string | null },
  typeNames: ReadonlyMap<string, string>
): SuperiorPoolView[] {
  const terms = parseSearchTerms(filters.search);
  const rowByIndex = new Map(superior.rows.map((row) => [row.row, row]));
  return superior.pools.flatMap((pool) => {
    if (filters.superiorType !== null && !pool.types.includes(filters.superiorType)) return [];
    const names = pool.types.map((code) => typeNames.get(code) ?? code);
    const poolText = [pool.label, ...names].join('\n');
    const rolls = pool.rows.flatMap((index) => {
      const row = rowByIndex.get(index);
      if (row === undefined) return [];
      const haystack = `${poolText}\n${row.text.join('\n')}`.toLowerCase();
      if (!terms.every((term) => haystack.includes(term))) return [];
      return [{ row, chance: pool.total > 0 ? row.weight / pool.total : 0 }];
    });
    return rolls.length === 0 ? [] : [{ pool, typeNames: names, rolls }];
  });
}

/** The Affixes page's Superior view, filtered to one own item type when given. */
export function superiorAffixesPath(type?: string): string {
  const params = new URLSearchParams({ [GAME_DATA_URL_PARAM_KEYS.VIEW]: 'superior' });
  if (type !== undefined) params.set(GAME_DATA_URL_PARAM_KEYS.SUPERIOR_TYPE, type);
  return `/game-data/affixes?${params.toString()}`;
}

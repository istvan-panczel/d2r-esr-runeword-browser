/**
 * Sets page: URL state, filters and links over sets.json.
 *
 * - Search: a set is kept whole when its texts (set name, class, item names, bases, categories, every bonus line)
 *   contain every term; the items whose own texts contain every term are highlighted.
 * - `maxlvl`: the whole set is wearable (its highest item required level ≤ the value).
 * - `pieces`: the number of items in the set; `cls`: a class code, or `any` for the sets any class can use.
 * - `?name=`: a set name or a set item name (that item is highlighted); the other filters are ignored.
 */
import { ESR_DOCS_URL } from '@/core/navigation/navConfig';
import { matchesExactName, parseExactNameParam } from '@/core/utils/exactName';
import { FILTER_URL_PARAM_KEYS, MAX_REQ_LEVEL_RANGE, parseBoundedIntParam } from '@/core/utils/filterUrlParams';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { BASE_TIERS, type BaseTier } from '../constants/bases';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import type { SetInfo, SetItemInfo, SetsBundle } from '../engine/schema';

/** `cls` value of the sets without a class */
export const ANY_CLASS = 'any';
export const SETS_ROUTE = 'sets';
const SETS_DOCS_PAGE = 'sets.htm';

export interface SetsState {
  readonly search: string;
  /** Highest required level of the whole set */
  readonly maxLevel: number | null;
  /** Number of items in the set */
  readonly pieces: number | null;
  /** Class code, ANY_CLASS (sets without a class), or null for every set */
  readonly cls: string | null;
  /** Exact-name focus (`?name=`): a set or a set item */
  readonly name: string | null;
}

const KEYS = {
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
  MAXLVL: FILTER_URL_PARAM_KEYS.MAXLVL,
  NAME: FILTER_URL_PARAM_KEYS.NAME,
  PIECES: GAME_DATA_URL_PARAM_KEYS.PIECES,
  CLS: GAME_DATA_URL_PARAM_KEYS.CLS,
} as const;

export const EMPTY_SETS_STATE: SetsState = { search: '', maxLevel: null, pieces: null, cls: null, name: null };

/** The item counts that occur, ascending */
export function pieceOptions(sets: readonly Pick<SetInfo, 'items'>[]): number[] {
  return [...new Set(sets.map((set) => set.items.length))].sort((a, b) => a - b);
}

/** The classes of the class sets, by name */
export function classOptions(sets: readonly Pick<SetInfo, 'classCode' | 'className'>[]): { code: string; name: string }[] {
  const names = new Map<string, string>();
  for (const set of sets) if (set.classCode !== null) names.set(set.classCode, set.className ?? set.classCode);
  return [...names].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** URL → state; an unknown piece count or class shows every set */
export function readSetsState(params: URLSearchParams, bundle: Pick<SetsBundle, 'sets'>): SetsState {
  const pieces = parseBoundedIntParam(params.get(KEYS.PIECES), { min: 1, max: 99 });
  const cls = params.get(KEYS.CLS);
  const known = cls === ANY_CLASS || classOptions(bundle.sets).some((option) => option.code === cls);
  return {
    search: params.get(KEYS.SEARCH) ?? '',
    maxLevel: parseBoundedIntParam(params.get(KEYS.MAXLVL), MAX_REQ_LEVEL_RANGE),
    pieces: pieces !== null && pieceOptions(bundle.sets).includes(pieces) ? pieces : null,
    cls: known ? cls : null,
    name: parseExactNameParam(params.get(KEYS.NAME)),
  };
}

export function encodeSetsState(state: SetsState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.name !== null) params.set(KEYS.NAME, state.name);
  if (state.cls !== null) params.set(KEYS.CLS, state.cls);
  if (state.pieces !== null) params.set(KEYS.PIECES, String(state.pieces));
  if (state.maxLevel !== null) params.set(KEYS.MAXLVL, String(state.maxLevel));
  if (state.search.trim() !== '') params.set(KEYS.SEARCH, state.search.trim());
  return params;
}

// --- filtering ----------------------------------------------------------------------------------------------------

export interface SetView {
  readonly set: SetInfo;
  /** Indexes of the items to highlight (search or name matches) */
  readonly highlighted: ReadonlySet<number>;
}

function matches(texts: readonly string[], terms: readonly string[]): boolean {
  const haystack = texts.join('\n').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function setItemTexts(item: SetItemInfo): string[] {
  return [item.name, item.baseName, item.category, ...item.lines, ...item.partial.flatMap((group) => group.lines)];
}

const DIFFICULTIES: Readonly<Partial<Record<string, string>>> = { N: 'Normal', NM: 'Nightmare', H: 'Hell' };

/** Difficulty of a hireling set from its sets.txt id suffix (`-N`, `-NM`, `-H`); null for the other sets */
export function setDifficulty(set: Pick<SetInfo, 'id'>): string | null {
  const suffix = /-(N|NM|H)$/.exec(set.id)?.[1];
  return suffix === undefined ? null : (DIFFICULTIES[suffix] ?? null);
}

export function setTexts(set: SetInfo): string[] {
  return [
    set.name,
    set.className ?? '',
    setDifficulty(set) ?? '',
    ...set.items.flatMap(setItemTexts),
    ...set.partial.flatMap((group) => group.lines),
    ...set.full,
  ];
}

const NONE: ReadonlySet<number> = new Set();

/** Sets by the highest required level, then name (hireling sets share a name: then the lowest level) */
export function sortSets(sets: readonly SetInfo[]): SetInfo[] {
  return [...sets].sort((a, b) => a.reqLevel.max - b.reqLevel.max || a.name.localeCompare(b.name) || a.reqLevel.min - b.reqLevel.min);
}

export function filterSets(sets: readonly SetInfo[], state: SetsState): SetView[] {
  if (state.name !== null) {
    const name = state.name;
    return sets.flatMap((set): SetView[] => {
      if (matchesExactName(set.name, name)) return [{ set, highlighted: NONE }];
      const items = set.items.flatMap((item, index) => (matchesExactName(item.name, name) ? [index] : []));
      return items.length === 0 ? [] : [{ set, highlighted: new Set(items) }];
    });
  }
  const terms = parseSearchTerms(state.search);
  return sets.flatMap((set): SetView[] => {
    if (state.maxLevel !== null && set.reqLevel.max > state.maxLevel) return [];
    if (state.pieces !== null && set.items.length !== state.pieces) return [];
    if (state.cls === ANY_CLASS ? set.classCode !== null : state.cls !== null && set.classCode !== state.cls) return [];
    if (terms.length === 0) return [{ set, highlighted: NONE }];
    if (!matches(setTexts(set), terms)) return [];
    const items = set.items.flatMap((item, index) => (matches(setItemTexts(item), terms) ? [index] : []));
    return [{ set, highlighted: new Set(items) }];
  });
}

// --- links --------------------------------------------------------------------------------------------------------

/** The official sets page, at the class section when the set has a class (its anchors are the class names) */
export function setDocsUrl(set: Pick<SetInfo, 'className'>): string {
  const anchor = set.className === null ? '' : `#${encodeURIComponent(set.className)}`;
  return `${ESR_DOCS_URL}${SETS_DOCS_PAGE}${anchor}`;
}

/** The page focused on one set */
export function setFocusParams(set: Pick<SetInfo, 'name'>): URLSearchParams {
  return encodeSetsState({ ...EMPTY_SETS_STATE, name: set.name });
}

/** "Req Lvl 45" or "Req Lvl 60–70" */
export function reqLevelText({ min, max }: SetInfo['reqLevel']): string {
  return min === max ? `Req Lvl ${String(min)}` : `Req Lvl ${String(min)}–${String(max)}`;
}

/**
 * Lowest and highest base tier of a set's items (`from === to` when they all share one); items without a tier
 * (rings, amulets, unknown codes) are skipped, and a set with no tiered item gives null.
 */
export function setTierRange(
  items: readonly Pick<SetItemInfo, 'code'>[],
  tierOf: ReadonlyMap<string, BaseTier>
): { from: BaseTier; to: BaseTier } | null {
  const ranks = items.flatMap((item) => {
    const tier = tierOf.get(item.code);
    return tier === undefined ? [] : [BASE_TIERS.indexOf(tier)];
  });
  if (ranks.length === 0) return null;
  return { from: BASE_TIERS[Math.min(...ranks)], to: BASE_TIERS[Math.max(...ranks)] };
}

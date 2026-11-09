/**
 * Home page cross-section search: ranks item names per category and builds the link of a picked result.
 * Pure (no Dexie, no DOM) so it is unit-tested; the home search component feeds it the names it has loaded.
 */
import { NAME_FOCUS_PAGES } from '@/features/guide/engine/linkSchemes';
import { normaliseItemName } from '@/core/utils/itemName';
import { GAME_DATA_URL_PARAM_KEYS } from '@/features/game-data/constants/urlParams';
import type { Area, SkillDetail } from '@/features/game-data/engine/schema';
import { disambiguation, duplicateNames, SKILLS_ROUTE, SKILLS_URL_PARAMS } from '@/features/skills/utils/skills';
import { campaignMapAreaPath } from '@/features/campaign-map/utils/urlState';
import { MODIFIERS_ROUTE, MODIFIERS_URL_PARAMS } from '@/features/modifiers/utils/modifierRoutes';

const SETS_PAGE = '/sets';

export type HomeSearchCategory =
  | 'runewords'
  | 'gemwords'
  | 'uniques'
  | 'mythicals'
  | 'sets'
  | 'setItems'
  | 'bases'
  | 'skills'
  | 'modifiers'
  | 'materials'
  | 'areas'
  | 'cube';

export interface HomeSearchCategoryInfo {
  readonly key: HomeSearchCategory;
  readonly label: string;
}

/** Results popover groups, in display order. */
export const HOME_SEARCH_CATEGORIES: readonly HomeSearchCategoryInfo[] = [
  { key: 'runewords', label: 'Runewords' },
  { key: 'gemwords', label: 'Gemwords' },
  { key: 'uniques', label: 'Uniques' },
  { key: 'mythicals', label: 'Mythicals' },
  { key: 'sets', label: 'Sets' },
  { key: 'setItems', label: 'Set items' },
  { key: 'bases', label: 'Bases' },
  { key: 'skills', label: 'Skills' },
  { key: 'modifiers', label: 'Modifiers' },
  { key: 'materials', label: 'Materials' },
  { key: 'areas', label: 'Areas' },
  { key: 'cube', label: 'Cube recipes' },
];

/** Results shown per group. */
export const HOME_SEARCH_GROUP_LIMIT = 6;

/** cmdk value of the "Search runewords for …" row */
export const SEARCH_RUNEWORDS_VALUE = '__search-runewords';

/** cmdk value of an item result row */
export function homeSearchRowValue(category: HomeSearchCategory, href: string): string {
  return `${category}:${href}`;
}

/**
 * A searchable name: the plain name, or a display name with the id its page link needs (a skill id, a cube family id).
 * Names are what is matched and shown; the id only feeds `homeResultHref`.
 */
export type HomeSearchName = string | { readonly name: string; readonly id: string };

export type HomeSearchSources = Partial<Record<HomeSearchCategory, readonly HomeSearchName[]>>;

export interface HomeSearchResult {
  readonly name: string;
  readonly href: string;
}

export interface HomeSearchGroup {
  readonly category: HomeSearchCategory;
  readonly label: string;
  readonly results: readonly HomeSearchResult[];
}

const nameOf = (entry: HomeSearchName): string => (typeof entry === 'string' ? entry : entry.name);

/** 0 exact, 1 name starts with the query, 2 a later word starts with it, 3 anywhere else; null when it does not match. */
function matchRank(name: string, query: string): number | null {
  const at = name.indexOf(query);
  if (at === -1) return null;
  if (name === query) return 0;
  if (at === 0) return 1;
  if (new RegExp(`(^|[\\s'"(-])${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name)) return 2;
  return 3;
}

/**
 * Names containing `query` (case-insensitive, quotes/dashes/whitespace unified), best first: exact, prefix, word prefix,
 * substring; ties alphabetical. Duplicate names (runeword variants, same-named items) collapse to one entry.
 */
export function rankNames<T extends HomeSearchName>(names: readonly T[], query: string, limit = HOME_SEARCH_GROUP_LIMIT): T[] {
  const needle = normaliseItemName(query);
  if (needle === '') return [];
  const seen = new Set<string>();
  const ranked: { entry: T; name: string; rank: number }[] = [];
  for (const entry of names) {
    const name = nameOf(entry);
    const normalised = normaliseItemName(name);
    if (normalised === '' || seen.has(normalised)) continue;
    const rank = matchRank(normalised, needle);
    if (rank === null) continue;
    seen.add(normalised);
    ranked.push({ entry, name, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return ranked.slice(0, limit).map((item) => item.entry);
}

/** The non-empty result groups, in HOME_SEARCH_CATEGORIES order; categories missing from `sources` are skipped. */
export function searchHome(query: string, sources: HomeSearchSources, limit = HOME_SEARCH_GROUP_LIMIT): HomeSearchGroup[] {
  return HOME_SEARCH_CATEGORIES.flatMap(({ key, label }) => {
    const names = sources[key];
    if (names === undefined) return [];
    const matches = rankNames(names, query, limit);
    if (matches.length === 0) return [];
    return [{ category: key, label, results: matches.map((entry) => ({ name: nameOf(entry), href: homeResultHref(key, entry) })) }];
  });
}

const NAME_FOCUS_PATHS: Record<Exclude<HomeSearchCategory, 'bases' | 'skills' | 'modifiers' | 'areas' | 'cube'>, string> = {
  runewords: NAME_FOCUS_PAGES.rw,
  gemwords: NAME_FOCUS_PAGES.gw,
  uniques: NAME_FOCUS_PAGES.unique,
  mythicals: NAME_FOCUS_PAGES.mythical,
  // The Sets page focuses a set, or the set of an item with that item highlighted
  sets: SETS_PAGE,
  setItems: SETS_PAGE,
  materials: '/materials',
};

/**
 * Page link of a picked result. The list pages and Materials focus the exact name (`?name=`); Skills focuses the skill id
 * (`?skill=`, the page picks its class and tab), Modifiers a modifier kind (`?kind=`) and the Cube page a family id (`?family=`), falling back to the name
 * when the entry carries no id. An area with its levels.txt id opens the Campaign Map on it (`/campaign-map?area=<id>`,
 * whose detail panel links the Areas page row); without an id it falls back to the Areas page. Bases (and id-less
 * areas) have no exact-name focus, so they get a quoted phrase search (`?search=`, the same link the guide's `base:`
 * scheme builds).
 */
export function homeResultHref(category: HomeSearchCategory, entry: HomeSearchName): string {
  const name = nameOf(entry);
  const id = typeof entry === 'string' ? name : entry.id;
  switch (category) {
    case 'bases':
      return `/bases?search=${encodeURIComponent(`"${name}"`)}`;
    case 'areas':
      return typeof entry === 'string' || !/^\d+$/.test(entry.id)
        ? `/area-levels?search=${encodeURIComponent(`"${name}"`)}`
        : campaignMapAreaPath(Number(entry.id));
    case 'skills':
      return `/${SKILLS_ROUTE}?${SKILLS_URL_PARAMS.SKILL}=${encodeURIComponent(id)}`;
    case 'modifiers':
      return `/${MODIFIERS_ROUTE}?${MODIFIERS_URL_PARAMS.KIND}=${encodeURIComponent(id)}`;
    case 'cube':
      return `/cube-recipes?${GAME_DATA_URL_PARAM_KEYS.FAMILY}=${encodeURIComponent(id)}`;
    default:
      return `${NAME_FOCUS_PATHS[category]}?name=${encodeURIComponent(name)}`;
  }
}

/**
 * Skill search names with their ids. Skills sharing a name (a class skill and its item proc or aura variants) get the
 * variant the Skills page shows as a suffix ("Amplify Damage (Aura)"), so each stays its own result.
 */
export function skillSearchNames(skills: readonly Pick<SkillDetail, 'id' | 'name'>[]): HomeSearchName[] {
  const duplicates = duplicateNames(skills);
  return skills.map((skill) => {
    const variant = disambiguation(skill, duplicates);
    return { name: variant === null ? skill.name : `${skill.name} (${variant})`, id: skill.id };
  });
}

const ACT_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

/**
 * Area search names with their levels.txt ids (each opens its own `/campaign-map?area=<id>`). Names shared across acts
 * get the act as a suffix ("Sewers Level 1 (Act II)", "Tristram (Act V)" for the uber level); rows sharing a name within
 * one act (Tal Rasha's Tomb ×7, one station on the map) stay one result.
 */
export function areaSearchNames(areas: readonly Pick<Area, 'id' | 'name' | 'act'>[]): HomeSearchName[] {
  const actsOf = new Map<string, Set<number>>();
  for (const area of areas) actsOf.set(area.name, (actsOf.get(area.name) ?? new Set()).add(area.act));
  return areas.map((area) => {
    const shared = (actsOf.get(area.name)?.size ?? 0) > 1;
    const act = ACT_NUMERALS[area.act] ?? String(area.act + 1);
    return { name: shared ? `${area.name} (Act ${act})` : area.name, id: String(area.id) };
  });
}

/** Enter without picking a result: the runewords free-text search (names and bonuses). */
export function runewordsSearchHref(query: string): string {
  return `${NAME_FOCUS_PAGES.rw}?search=${encodeURIComponent(query.trim())}`;
}

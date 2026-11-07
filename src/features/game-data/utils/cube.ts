/**
 * Cube Recipes page: URL state, the family / group / row tree built from cube.json and the filters over it.
 *
 * Filters: an ingredient search (`in`, inputs only), a result search (`out`, outputs only) and output qualities (`q`),
 * all of which a row must pass. A legacy `?search=` (old links) matches either side with the old rule: a family whose
 * label matches every term is kept whole; otherwise a group whose header (its recipe shape, the unique and set names
 * its rows use, its conditions) matches every term is kept whole; otherwise the merged rows and the raw recipes are
 * filtered one by one.
 */
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { ESR_DOCS_URL } from '@/core/navigation/navConfig';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import { CUBE_QUALITIES, type CubeQuality } from '../engine/schema';
import type { CubeBundle, CubeFamilyInfo, CubeGroup, CubeMergedRow, CubeRecipe, CubeSection, MaterialEnhanceTab } from '../engine/schema';
import type { GuideNoteIndex } from './materials';

export interface CubeState {
  /** Legacy `?search=` of old links: matches ingredients or results; the page no longer has a box for it */
  readonly search: string;
  /** Ingredient search: the inputs only */
  readonly input: string;
  /** Result search: the outputs only */
  readonly output: string;
  /** Output qualities to keep (any of them); empty keeps every row */
  readonly qualities: readonly CubeQuality[];
  /** Focused family id, null for all families */
  readonly family: string | null;
}

export const CUBE_QUALITY_LABELS: Record<CubeQuality, string> = {
  unique: 'Unique',
  set: 'Set',
  rare: 'Rare',
  magic: 'Magic',
  crafted: 'Crafted',
};

const KEYS = {
  SEARCH: FILTER_URL_PARAM_KEYS.SEARCH,
  IN: GAME_DATA_URL_PARAM_KEYS.IN,
  OUT: GAME_DATA_URL_PARAM_KEYS.OUT,
  QUALITY: GAME_DATA_URL_PARAM_KEYS.QUALITY,
  FAMILY: GAME_DATA_URL_PARAM_KEYS.FAMILY,
} as const;

function isCubeQuality(value: string): value is CubeQuality {
  return (CUBE_QUALITIES as readonly string[]).includes(value);
}

/** URL → state; an unknown family id shows every family, unknown qualities are dropped */
export function readCubeState(params: URLSearchParams, bundle: CubeBundle): CubeState {
  const family = params.get(KEYS.FAMILY);
  const qualities = new Set((params.get(KEYS.QUALITY) ?? '').split(',').filter(isCubeQuality));
  return {
    search: params.get(KEYS.SEARCH) ?? '',
    input: params.get(KEYS.IN) ?? '',
    output: params.get(KEYS.OUT) ?? '',
    qualities: CUBE_QUALITIES.filter((quality) => qualities.has(quality)),
    family: family !== null && bundle.families.some((entry) => entry.id === family) ? family : null,
  };
}

export function encodeCubeState(state: CubeState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.family !== null) params.set(KEYS.FAMILY, state.family);
  if (state.search.trim() !== '') params.set(KEYS.SEARCH, state.search.trim());
  if (state.input.trim() !== '') params.set(KEYS.IN, state.input.trim());
  if (state.output.trim() !== '') params.set(KEYS.OUT, state.output.trim());
  if (state.qualities.length > 0) params.set(KEYS.QUALITY, state.qualities.join(','));
  return params;
}

/** True when any filter (a search or a quality) narrows the rows */
export function isFiltering(state: Pick<CubeState, 'search' | 'input' | 'output' | 'qualities'>): boolean {
  return [state.search, state.input, state.output].some((text) => text.trim() !== '') || state.qualities.length > 0;
}

// --- tree ---------------------------------------------------------------------------------------------------------

export interface CubeGroupView {
  readonly group: CubeGroup;
  readonly rows: readonly CubeMergedRow[];
  /** Every cubemain row of the group (small families only; empty otherwise) */
  readonly recipes: readonly CubeRecipe[];
}

export interface CubeFamilyView {
  readonly family: CubeFamilyInfo;
  readonly groups: readonly CubeGroupView[];
}

export interface CubeSectionView {
  readonly section: CubeSection;
  readonly families: readonly CubeFamilyView[];
}

/** Sections (official page order) → families (display order) → groups with their merged rows and raw recipes */
export function buildCubeTree(bundle: CubeBundle): CubeSectionView[] {
  const rowsByGroup = groupBy(bundle.rows, (row) => row.group);
  const recipesByGroup = groupBy(bundle.recipes, (recipe) => recipe.group);
  const groupsByFamily = groupBy(bundle.groups, (group) => group.family);
  const families = [...bundle.families].sort((a, b) => a.order - b.order);
  return bundle.sections.flatMap((section) => {
    const views = families
      .filter((family) => family.section === section.id)
      .map((family) => ({
        family,
        groups: (groupsByFamily.get(family.id) ?? []).map((group) => ({
          group,
          rows: rowsByGroup.get(group.id) ?? [],
          recipes: recipesByGroup.get(group.id) ?? [],
        })),
      }));
    return views.length === 0 ? [] : [{ section, families: views }];
  });
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list === undefined) map.set(k, [item]);
    else list.push(item);
  }
  return map;
}

// --- search -------------------------------------------------------------------------------------------------------

function matches(texts: readonly string[], terms: readonly string[]): boolean {
  const haystack = texts.join('\n').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function groupHeaderTexts(group: CubeGroup): string[] {
  return [group.label, ...(group.inputNames ?? []), ...(group.outputNames ?? []), ...group.conditions];
}

export function mergedRowTexts(row: CubeMergedRow): string[] {
  return [...row.inputs, ...mergedOutputTexts(row), ...(row.conditions ?? []), ...(row.returned === undefined ? [] : [row.returned])];
}

/** What the result search reads on a merged row: its output and the odds of a random pool */
function mergedOutputTexts(row: CubeMergedRow): string[] {
  return [row.output, ...(row.odds ?? [])];
}

/**
 * Guide notes for a family: the section's (cube.json `guide`), then those that show the family (guide.json
 * `familyNotes`), without repeats and unknown slugs; `excludeSection` leaves the section's out (shown above).
 */
export function familyGuideNotes(
  section: Pick<CubeSection, 'guide'>,
  family: string,
  index: GuideNoteIndex | null,
  known: ReadonlySet<string>,
  excludeSection = false
): string[] {
  const own = excludeSection ? [] : (section.guide ?? []);
  const shown = new Set(excludeSection ? (section.guide ?? []) : []);
  const slugs = [...own, ...(index?.familyNotes?.[family] ?? [])];
  return [...new Set(slugs)].filter((slug) => known.has(slug) && !shown.has(slug));
}

export function recipeTexts(recipe: CubeRecipe): string[] {
  return [recipe.description, ...recipeInputTexts(recipe), ...recipeOutputTexts(recipe), ...recipe.conditions];
}

function recipeInputTexts(recipe: CubeRecipe): string[] {
  return recipe.inputs.flatMap((input) => [input.text, input.code]);
}

function recipeOutputTexts(recipe: CubeRecipe): string[] {
  return recipe.outputs.flatMap((output) => [output.text, output.code ?? '', ...output.bonus, ...output.details]);
}

export interface CubeFilters {
  /** Legacy search: either side (old `?search=` links) */
  readonly search: string;
  readonly input: string;
  readonly output: string;
  readonly qualities: readonly CubeQuality[];
}

/** Filters the tree; sections, families and groups left without a row are dropped. */
export function filterCubeTree(tree: readonly CubeSectionView[], filters: CubeFilters): CubeSectionView[] {
  return filterBySides(filterBySearch(tree, filters.search), filters);
}

/** The legacy search over either side (see the header comment) */
function filterBySearch(tree: readonly CubeSectionView[], search: string): CubeSectionView[] {
  const terms = parseSearchTerms(search);
  if (terms.length === 0) return [...tree];
  return mapGroups(tree, (view, groupView) => {
    if (matches([view.family.label], terms)) return groupView;
    if (matches(groupHeaderTexts(groupView.group), terms)) return groupView;
    const rows = groupView.rows.filter((row) => matches([...mergedRowTexts(row), ...groupView.group.conditions], terms));
    const recipes = groupView.recipes.filter((recipe) => matches(recipeTexts(recipe), terms));
    return { group: groupView.group, rows, recipes };
  });
}

/**
 * The ingredient and result searches and the quality filter. Family labels and group labels (the txt descriptions,
 * "A + B -> C") are not matched: they mix both sides, so a match would keep rows the other side's words name. A
 * group's unique / set names are, per side (`inputNames` / `outputNames`, the big families whose merged rows list
 * only a few names): a match keeps every row of the group that passes the other filters.
 */
function filterBySides(tree: readonly CubeSectionView[], filters: CubeFilters): CubeSectionView[] {
  const inTerms = parseSearchTerms(filters.input);
  const outTerms = parseSearchTerms(filters.output);
  const qualities = new Set(filters.qualities);
  if (inTerms.length === 0 && outTerms.length === 0 && qualities.size === 0) return [...tree];
  const hasQuality = (list: readonly CubeQuality[]) => qualities.size === 0 || list.some((quality) => qualities.has(quality));
  return mapGroups(tree, (_view, groupView) => {
    const { group } = groupView;
    const inGroup = inTerms.length === 0 || matches(group.inputNames ?? [], inTerms);
    const outGroup = outTerms.length === 0 || matches(group.outputNames ?? [], outTerms);
    const rows = groupView.rows.filter(
      (row) =>
        hasQuality(row.qualities) && (inGroup || matches(row.inputs, inTerms)) && (outGroup || matches(mergedOutputTexts(row), outTerms))
    );
    const recipes = groupView.recipes.filter(
      (recipe) =>
        hasQuality(recipe.qualities) &&
        (inGroup || matches(recipeInputTexts(recipe), inTerms)) &&
        (outGroup || matches(recipeOutputTexts(recipe), outTerms))
    );
    return { group, rows, recipes };
  });
}

/** Rebuilds the tree from each group's filtered view, dropping groups without rows and recipes and empty families */
function mapGroups(
  tree: readonly CubeSectionView[],
  filter: (family: CubeFamilyView, group: CubeGroupView) => CubeGroupView
): CubeSectionView[] {
  return tree.flatMap((section) => {
    const families = section.families.flatMap((view): CubeFamilyView[] => {
      const groups = view.groups.flatMap((groupView) => {
        const result = filter(view, groupView);
        return result.rows.length === 0 && result.recipes.length === 0 ? [] : [result];
      });
      return groups.length === 0 ? [] : [{ family: view.family, groups }];
    });
    return families.length === 0 ? [] : [{ section: section.section, families }];
  });
}

/** Only the focused family (null: every family) */
export function focusCubeTree(tree: readonly CubeSectionView[], family: string | null): CubeSectionView[] {
  if (family === null) return [...tree];
  return tree.flatMap((section) => {
    const families = section.families.filter((view) => view.family.id === family);
    return families.length === 0 ? [] : [{ section: section.section, families }];
  });
}

/** cubemain rows shown in a (filtered) family: the rows its merged rows stand for, or its matching raw recipes */
export function shownRowCount(view: CubeFamilyView): number {
  return view.groups.reduce(
    (sum, group) =>
      sum +
      Math.max(
        group.rows.reduce((rows, row) => rows + row.variants, 0),
        group.recipes.length
      ),
    0
  );
}

// --- texts --------------------------------------------------------------------------------------------------------

export const CUBE_DOCS_PAGE = 'Eastern Sun Resurrected Cube Recipes.html';

/** Official page of a section (with its anchor), null when no page covers it */
export function sectionDocsUrl(section: CubeSection): string | null {
  if (section.doc === null) return null;
  return `${ESR_DOCS_URL}${encodeURIComponent(section.doc)}${section.anchor === null ? '' : `#${encodeURIComponent(section.anchor)}`}`;
}

export const CUBE_DOCS_URL = `${ESR_DOCS_URL}${encodeURIComponent(CUBE_DOCS_PAGE)}`;

/** The Enhance page tab that lists a merged row's outcomes (`CubeMergedRow.enhanceTab`) */
export function enhanceTabHref(tab: MaterialEnhanceTab): string {
  return `/game-data/enhance?${new URLSearchParams({ [GAME_DATA_URL_PARAM_KEYS.TAB]: tab }).toString()}`;
}

/** DOM id of a family's section */
export function familyAnchor(id: string): string {
  return `cube-family-${id.replace(/[^a-z0-9-]/gi, '-')}`;
}

/** 1408 → "1,408" */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

/**
 * Materials page: URL state, the group / block / item tree built from materials.json, the search over it and the
 * links to the Cube, Enhance and guide pages.
 *
 * Search rule (same as the Cube page): a group whose label matches every term is kept whole; otherwise a block whose
 * label matches every term is kept whole; otherwise the items are filtered one by one (name, code, grade, sources,
 * family labels, Enhance roles). `?name=` shows only the items with that exact name and ignores the other filters.
 */
import { matchesExactName, parseExactNameParam } from '@/core/utils/exactName';
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import type { MaterialEnhanceRole, MaterialGroup, MaterialItem, MaterialsBundle } from '../engine/schema';

export interface MaterialsState {
  readonly search: string;
  /** Group code (`sock`, `cube` …); null for every group */
  readonly group: string | null;
  /** Exact-name focus (`?name=`) */
  readonly name: string | null;
}

const KEYS = { SEARCH: FILTER_URL_PARAM_KEYS.SEARCH, NAME: FILTER_URL_PARAM_KEYS.NAME, GROUP: GAME_DATA_URL_PARAM_KEYS.GROUP } as const;

/** URL → state; an unknown group shows every group */
export function readMaterialsState(params: URLSearchParams, bundle: Pick<MaterialsBundle, 'groups'>): MaterialsState {
  const group = params.get(KEYS.GROUP);
  return {
    search: params.get(KEYS.SEARCH) ?? '',
    group: group !== null && bundle.groups.some((entry) => entry.code === group) ? group : null,
    name: parseExactNameParam(params.get(KEYS.NAME)),
  };
}

export function encodeMaterialsState(state: MaterialsState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.name !== null) params.set(KEYS.NAME, state.name);
  if (state.group !== null) params.set(KEYS.GROUP, state.group);
  if (state.search.trim() !== '') params.set(KEYS.SEARCH, state.search.trim());
  return params;
}

// --- tree ---------------------------------------------------------------------------------------------------------

export interface MaterialBlockView {
  readonly code: string;
  readonly label: string;
  readonly items: readonly MaterialItem[];
}

export interface MaterialGroupView {
  readonly group: MaterialGroup;
  readonly blocks: readonly MaterialBlockView[];
}

/** Groups (bundle order) → blocks → items (bundle order); empty blocks and groups are dropped */
export function buildMaterialsTree(bundle: Pick<MaterialsBundle, 'groups' | 'items'>): MaterialGroupView[] {
  return bundle.groups.flatMap((group) => {
    const blocks = group.blocks
      .map((block) => ({
        code: block.code,
        label: block.label,
        items: bundle.items.filter((item) => item.group === group.code && item.block === block.code),
      }))
      .filter((block) => block.items.length > 0);
    return blocks.length === 0 ? [] : [{ group, blocks }];
  });
}

export function itemCount(view: MaterialGroupView): number {
  return view.blocks.reduce((sum, block) => sum + block.items.length, 0);
}

// --- search -------------------------------------------------------------------------------------------------------

function matches(texts: readonly string[], terms: readonly string[]): boolean {
  const haystack = texts.join('\n').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** What the item search reads: name, code, grade, sources, the families that use or make it, its Enhance roles */
export function materialTexts(item: MaterialItem, familyLabel: (id: string) => string): string[] {
  return [
    item.name,
    item.code,
    item.grade ?? '',
    ...item.sources.map((source) => source.text),
    ...[...item.usedIn, ...item.madeBy].map((use) => familyLabel(use.family)),
    ...(item.enhance ?? []).map((role) => role.label),
  ];
}

export function filterMaterialsTree(
  tree: readonly MaterialGroupView[],
  state: MaterialsState,
  familyLabel: (id: string) => string
): MaterialGroupView[] {
  if (state.name !== null) {
    const name = state.name;
    return keepItems(tree, (item) => matchesExactName(item.name, name));
  }
  const grouped = state.group === null ? tree : tree.filter((view) => view.group.code === state.group);
  const terms = parseSearchTerms(state.search);
  if (terms.length === 0) return [...grouped];
  return grouped.flatMap((view): MaterialGroupView[] => {
    if (matches([view.group.label], terms)) return [view];
    const blocks = view.blocks.flatMap((block): MaterialBlockView[] => {
      if (matches([block.label], terms)) return [block];
      const items = block.items.filter((item) => matches(materialTexts(item, familyLabel), terms));
      return items.length === 0 ? [] : [{ ...block, items }];
    });
    return blocks.length === 0 ? [] : [{ group: view.group, blocks }];
  });
}

function keepItems(tree: readonly MaterialGroupView[], keep: (item: MaterialItem) => boolean): MaterialGroupView[] {
  return tree.flatMap((view) => {
    const blocks = view.blocks.flatMap((block) => {
      const items = block.items.filter(keep);
      return items.length === 0 ? [] : [{ ...block, items }];
    });
    return blocks.length === 0 ? [] : [{ group: view.group, blocks }];
  });
}

// --- links --------------------------------------------------------------------------------------------------------

export function cubeFamilyHref(family: string): string {
  return `/cube-recipes?${new URLSearchParams({ [GAME_DATA_URL_PARAM_KEYS.FAMILY]: family }).toString()}`;
}

export function enhanceHref(role: MaterialEnhanceRole): string {
  const params = new URLSearchParams({ [GAME_DATA_URL_PARAM_KEYS.TAB]: role.tab });
  if (role.slot !== undefined) params.set(GAME_DATA_URL_PARAM_KEYS.SLOT, role.slot);
  return `/enhance?${params.toString()}`;
}

export interface GuideNoteIndex {
  readonly itemNotes?: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly familyNotes?: Readonly<Partial<Record<string, readonly string[]>>>;
}

/**
 * Guide notes for an item: the notes that show the item itself, then the notes that show the family making most of
 * it (the "Cube" link's family). Unknown slugs are dropped.
 */
export function itemGuideNotes(item: MaterialItem, index: GuideNoteIndex | null, known: ReadonlySet<string>): string[] {
  if (index === null) return [];
  const made = item.madeBy.at(0)?.family;
  const slugs = [...(index.itemNotes?.[item.code] ?? []), ...(made === undefined ? [] : (index.familyNotes?.[made] ?? []))];
  return [...new Set(slugs)].filter((slug) => known.has(slug));
}

/** "lvl 11 · req 11" (a part that is 0 is left out) */
export function levelText(item: Pick<MaterialItem, 'level' | 'levelreq'>): string {
  const parts = [item.level > 0 ? `lvl ${String(item.level)}` : '', item.levelreq > 0 ? `req ${String(item.levelreq)}` : ''];
  return parts.filter((part) => part !== '').join(' · ');
}

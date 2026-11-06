/**
 * The /modifiers page model: modifiers.json kinds joined with the hand-written explanations into page entries, the URL
 * state, the search and the item links. Pure; see docs/features/MODIFIERS.md "Page".
 */
import type {
  ModifierCategory,
  ModifierFact,
  ModifierItemKind,
  ModifierKind,
  ModifiersBundle,
  ModifierStat,
} from '@/features/game-data/engine/schema';
import { FILTER_URL_PARAM_KEYS } from '@/core/utils/filterUrlParams';
import { normaliseItemName } from '@/core/utils/itemName';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { NAME_FOCUS_PAGES } from '@/features/guide/engine/linkSchemes';
import {
  plainText,
  sourceLink,
  tokenizeInline,
  type ContentBlock,
  type InlineToken,
  type OpenQuestion,
  type SourceLink,
} from './modifierContent';
import { CONTENT_KINDS, KIND_CALCULATORS, KIND_FACTS, type ModifierCalculator } from './modifierContentKinds';
import { resolveText } from './modifierPlaceholders';
import { MODIFIERS_ROUTE, MODIFIERS_URL_PARAMS } from './modifierRoutes';

export { MODIFIERS_ROUTE, MODIFIERS_URL_PARAMS };

export const CATEGORY_ORDER: readonly ModifierCategory[] = [
  'offense',
  'defense',
  'speed',
  'procs',
  'resources',
  'find',
  'skills',
  'attributes',
  'other',
];

export const CATEGORY_LABELS: Readonly<Record<ModifierCategory, string>> = {
  offense: 'Offense',
  defense: 'Defense',
  speed: 'Speed',
  procs: 'Procs',
  resources: 'Life and mana',
  find: 'Find',
  skills: 'Skills',
  attributes: 'Attributes',
  other: 'Other',
};

export const ALL_CATEGORIES = 'all';
export type CategoryFilter = ModifierCategory | typeof ALL_CATEGORIES;

/** The category pills, in order */
export const CATEGORY_FILTERS: readonly CategoryFilter[] = [ALL_CATEGORIES, ...CATEGORY_ORDER];

/** `key`: the hand-written and key modifiers (default); `all`: every stat ESR items carry */
export type ModifiersListView = 'key' | 'all';

// --- entries ------------------------------------------------------------------------------------------------------------

/** One content line, resolved against the facts and tokenized */
export type RichLine = readonly InlineToken[];

export interface EntryContent {
  readonly key: string;
  readonly summary: RichLine;
  readonly body: RichLine;
  readonly factsIntro: string;
  readonly facts: readonly RichLine[];
  readonly caveats: readonly RichLine[];
  readonly sources: readonly SourceLink[];
  readonly questions: readonly OpenQuestion[];
}

export interface ModifierEntry {
  /** The content key of a hand-written entry, else the kind key */
  readonly key: string;
  readonly title: string;
  readonly category: ModifierCategory;
  readonly kinds: readonly ModifierKind[];
  readonly stats: readonly ModifierStat[];
  readonly content: EntryContent | null;
  /** Hand-written, or a reviewed key kind: shown in the "Key modifiers" view */
  readonly featured: boolean;
  /** Every stat is ESR-only / some stat's mechanics differ from vanilla */
  readonly esrOnly: boolean;
  readonly changed: boolean;
  /** Only ESR bookkeeping stats (tinkering caps, display twins) */
  readonly technical: boolean;
  /** Most items carrying one of its kinds */
  readonly items: number;
  /** Facts the card tabulates: the ones the text quotes, then KIND_FACTS */
  readonly facts: readonly ModifierFact[];
  readonly calculators: readonly ModifierCalculator[];
  /** Normalised search haystack: titles, texts, stat names and display texts */
  readonly searchText: string;
}

export interface ModifiersView {
  readonly entries: readonly ModifierEntry[];
  readonly byKey: ReadonlyMap<string, ModifierEntry>;
  /** Every kind key → the key of the entry that shows it */
  readonly entryOfKind: ReadonlyMap<string, string>;
  /** Content problems: unknown content keys or kinds, placeholders that resolve to nothing (the content test pins none) */
  readonly problems: readonly string[];
}

/** A stat display text with the format codes as readers see them ("%+d%% Deadly Strike" → "+N% Deadly Strike") */
export function statDisplayText(text: string): string {
  return text
    .replace(/ÿc./g, '')
    .replace(/\\n|\n/g, ' / ')
    .replace(/%\+d/g, '+N')
    .replace(/%-d/g, '-N')
    .replace(/%d/g, 'N')
    .replace(/%0/g, 'N')
    .replace(/%1/g, 'X')
    .replace(/%s/g, 'X')
    .replace(/%%/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A generated title that is only a stat name or a stray word ("item_nonclassskill", "to") */
function weakTitle(title: string): boolean {
  return /^[a-z0-9_]+$/.test(title) || title.length <= 3;
}

function generatedTitle(kind: ModifierKind, stats: readonly ModifierStat[]): string {
  if (!weakTitle(kind.title)) return kind.title;
  const text = stats.find((stat) => stat.text !== undefined)?.text;
  return text === undefined ? kind.title : statDisplayText(text);
}

function resolveLines(
  lines: readonly string[],
  facts: readonly ModifierFact[],
  used: string[],
  problems: string[],
  key: string
): RichLine[] {
  return lines.map((line) => {
    const resolved = resolveText(line, facts);
    for (const fact of resolved.facts) if (!used.includes(fact)) used.push(fact);
    for (const path of resolved.missing) problems.push(`${key}: placeholder {${path}} resolves to nothing`);
    return tokenizeInline(resolved.text);
  });
}

function buildContent(
  block: ContentBlock,
  facts: readonly ModifierFact[],
  questions: readonly OpenQuestion[],
  problems: string[]
): { content: EntryContent; usedFacts: string[] } {
  const used: string[] = [];
  const [summary = [], body = []] = resolveLines([block.summary, block.body], facts, used, problems, block.key);
  return {
    content: {
      key: block.key,
      summary,
      body,
      factsIntro: block.factsIntro,
      facts: resolveLines(block.facts, facts, used, problems, block.key),
      caveats: resolveLines(block.caveats, facts, used, problems, block.key),
      sources: block.sources.flatMap((source) => {
        const link = sourceLink(source);
        return link === null ? [] : [link];
      }),
      questions: questions.filter((question) => question.keys.includes(block.key)),
    },
    usedFacts: used,
  };
}

function searchHaystack(parts: readonly string[]): string {
  return normaliseItemName(parts.filter((part) => part !== '').join(' \n '));
}

/**
 * The page entries: one per content block (covering the kinds CONTENT_KINDS gives it), then one per remaining kind,
 * ordered by category (CATEGORY_ORDER), featured before generated, then by the bundle's kind order.
 */
export function buildModifiersView(
  bundle: ModifiersBundle,
  blocks: readonly ContentBlock[],
  questions: readonly OpenQuestion[] = []
): ModifiersView {
  const problems: string[] = [];
  const kindByKey = new Map(bundle.kinds.map((kind) => [kind.key, kind]));
  const kindIndex = new Map(bundle.kinds.map((kind, index) => [kind.key, index]));
  const statById = new Map(bundle.stats.map((stat) => [stat.id, stat]));
  const factByKey = new Map(bundle.facts.map((fact) => [fact.key, fact]));
  const claimed = new Set<string>();
  const drafts: { entry: ModifierEntry; order: number }[] = [];

  const make = (
    key: string,
    title: string | null,
    kinds: ModifierKind[],
    category: ModifierCategory | undefined,
    block: ContentBlock | null
  ) => {
    const stats = kinds.flatMap((kind) => kind.stats.flatMap((id) => statById.get(id) ?? []));
    const built = block === null ? null : buildContent(block, bundle.facts, questions, problems);
    const factKeys = [...(built?.usedFacts ?? [])];
    for (const kind of kinds) for (const fact of KIND_FACTS[kind.key] ?? []) if (!factKeys.includes(fact)) factKeys.push(fact);
    const facts = factKeys.flatMap((fact) => factByKey.get(fact) ?? []);
    const calculators = [...new Set(kinds.flatMap((kind) => KIND_CALCULATORS[kind.key] ?? []))];
    const first = kinds.at(0);
    const finalTitle = title ?? (first === undefined ? key : generatedTitle(first, stats));
    const content = built?.content ?? null;
    const statTexts = stats.flatMap((stat) => [
      stat.stat,
      ...[stat.text, stat.textNeg, stat.text2, stat.group].flatMap((text) => (text === undefined ? [] : [statDisplayText(text)])),
    ]);
    const entry: ModifierEntry = {
      key,
      title: finalTitle,
      category: category ?? first?.category ?? 'other',
      kinds,
      stats,
      content,
      featured: content !== null || kinds.some((kind) => kind.generated !== true),
      esrOnly: stats.length > 0 && stats.every((stat) => stat.vanilla === 'esr'),
      changed: stats.some((stat) => stat.vanilla === 'changed'),
      technical: stats.length > 0 && stats.every((stat) => stat.technical === true),
      items: Math.max(0, ...kinds.map((kind) => kind.items)),
      facts,
      calculators,
      searchText: searchHaystack([
        finalTitle,
        ...kinds.map((kind) => kind.title),
        content === null ? '' : plainText(content.summary),
        content === null ? '' : plainText(content.body),
        ...statTexts,
      ]),
    };
    drafts.push({ entry, order: Math.min(...kinds.map((kind) => kindIndex.get(kind.key) ?? Number.MAX_SAFE_INTEGER)) });
  };

  for (const block of blocks) {
    const mapping = CONTENT_KINDS[block.key];
    if (mapping === undefined) {
      problems.push(`content ${block.key} has no CONTENT_KINDS entry`);
      continue;
    }
    const kinds = mapping.kinds.flatMap((key) => {
      const kind = kindByKey.get(key);
      if (kind === undefined) problems.push(`content ${block.key}: modifiers.json has no kind ${key}`);
      else if (claimed.has(key)) problems.push(`content ${block.key}: kind ${key} is already claimed`);
      else {
        claimed.add(key);
        return [kind];
      }
      return [];
    });
    if (kinds.length === 0) continue;
    make(block.key, block.title, kinds, mapping.category, block);
  }
  for (const kind of bundle.kinds) if (!claimed.has(kind.key)) make(kind.key, null, [kind], undefined, null);

  const rank = (entry: ModifierEntry) => CATEGORY_ORDER.indexOf(entry.category);
  drafts.sort(
    (a, b) =>
      rank(a.entry) - rank(b.entry) ||
      Number(b.entry.featured) - Number(a.entry.featured) ||
      Number(a.entry.technical) - Number(b.entry.technical) ||
      a.order - b.order
  );
  const entries = drafts.map((draft) => draft.entry);
  const entryOfKind = new Map<string, string>();
  for (const entry of entries) for (const kind of entry.kinds) entryOfKind.set(kind.key, entry.key);
  return { entries, byKey: new Map(entries.map((entry) => [entry.key, entry])), entryOfKind, problems };
}

// --- URL state ----------------------------------------------------------------------------------------------------------

export interface ModifiersState {
  /** The focused entry key (a kind key in the URL resolves to its entry), null for the list */
  readonly kind: string | null;
  readonly category: CategoryFilter;
  readonly search: string;
  readonly view: ModifiersListView;
}

export const DEFAULT_MODIFIERS_STATE: ModifiersState = { kind: null, category: ALL_CATEGORIES, search: '', view: 'key' };

/** The entry a `kind` value names: an entry key, or any kind key it holds */
export function resolveEntryKey(view: Pick<ModifiersView, 'byKey' | 'entryOfKind'>, key: string | null): string | null {
  if (key === null || key === '') return null;
  if (view.byKey.has(key)) return key;
  return view.entryOfKind.get(key) ?? null;
}

export function readModifiersState(params: URLSearchParams, view: Pick<ModifiersView, 'byKey' | 'entryOfKind'>): ModifiersState {
  const category = params.get(MODIFIERS_URL_PARAMS.CATEGORY);
  return {
    kind: resolveEntryKey(view, params.get(MODIFIERS_URL_PARAMS.KIND)),
    category:
      category !== null && (CATEGORY_ORDER as readonly string[]).includes(category) ? (category as ModifierCategory) : ALL_CATEGORIES,
    search: params.get(MODIFIERS_URL_PARAMS.SEARCH) ?? '',
    view: params.get(MODIFIERS_URL_PARAMS.VIEW) === 'all' ? 'all' : 'key',
  };
}

/** Defaults are left out of the URL */
export function encodeModifiersState(state: ModifiersState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.kind !== null) params.set(MODIFIERS_URL_PARAMS.KIND, state.kind);
  if (state.category !== ALL_CATEGORIES) params.set(MODIFIERS_URL_PARAMS.CATEGORY, state.category);
  if (state.search !== '') params.set(MODIFIERS_URL_PARAMS.SEARCH, state.search);
  if (state.view !== 'key') params.set(MODIFIERS_URL_PARAMS.VIEW, state.view);
  return params;
}

/** The page focused on one entry or kind (`/modifiers?kind=<key>`) */
export function modifierPageUrl(key: string): string {
  return `/${MODIFIERS_ROUTE}?${encodeModifiersState({ ...DEFAULT_MODIFIERS_STATE, kind: key }).toString()}`;
}

// --- list ---------------------------------------------------------------------------------------------------------------

/** Every word or "quoted phrase" occurs in the entry's titles, texts or stat texts (case-insensitive) */
export function matchesSearch(entry: Pick<ModifierEntry, 'searchText'>, search: string): boolean {
  const terms = parseSearchTerms(search).map(normaliseItemName);
  return terms.every((term) => entry.searchText.includes(term));
}

export interface ModifiersList {
  readonly entries: readonly ModifierEntry[];
  /** Matches the "All" view adds to the "Key modifiers" view (0 in the All view) */
  readonly moreInAll: number;
  /** Entries per category for the pills (after the view and search, before the category) */
  readonly counts: Readonly<Record<CategoryFilter, number>>;
}

export function filterModifiers(
  view: Pick<ModifiersView, 'entries'>,
  state: Pick<ModifiersState, 'category' | 'search' | 'view'>
): ModifiersList {
  const searched = view.entries.filter((entry) => matchesSearch(entry, state.search));
  const inView = state.view === 'all' ? searched : searched.filter((entry) => entry.featured);
  const counts = Object.fromEntries(CATEGORY_FILTERS.map((category) => [category, 0])) as Record<CategoryFilter, number>;
  for (const entry of inView) {
    counts[entry.category] += 1;
    counts[ALL_CATEGORIES] += 1;
  }
  const inCategory = (entry: ModifierEntry) => state.category === ALL_CATEGORIES || entry.category === state.category;
  return {
    entries: inView.filter(inCategory),
    moreInAll: state.view === 'all' ? 0 : searched.filter((entry) => !entry.featured && inCategory(entry)).length,
    counts,
  };
}

// --- items --------------------------------------------------------------------------------------------------------------

export const ITEM_KIND_LABELS: Readonly<Record<ModifierItemKind, string>> = {
  unique: 'Unique',
  set: 'Set item',
  setBonus: 'Set bonus',
  runeword: 'Runeword',
  gemword: 'Gemword',
  prefix: 'Prefix',
  suffix: 'Suffix',
  automagic: 'Automagic',
  superior: 'Superior',
  socketable: 'Socketable',
  cube: 'Cube recipe',
};

/**
 * The page of an example item, focused on it: uniques (the Mythicals page for the names in `mythicals`, normalised),
 * set items and sets (`?name=`), runewords, gemwords and socketables (exact-name focus), affixes (a quoted search).
 * Superior mods and cube recipes have no page that focuses one row: null.
 */
export function exampleItemUrl(kind: ModifierItemKind, name: string, mythicals: ReadonlySet<string>): string | null {
  const exact = new URLSearchParams({ [FILTER_URL_PARAM_KEYS.NAME]: name }).toString();
  switch (kind) {
    case 'unique':
      return `${mythicals.has(normaliseItemName(name)) ? NAME_FOCUS_PAGES.mythical : NAME_FOCUS_PAGES.unique}?${exact}`;
    case 'set':
    case 'setBonus':
      return `/game-data/sets?${exact}`;
    case 'runeword':
      return `${NAME_FOCUS_PAGES.rw}?${exact}`;
    case 'gemword':
      return `${NAME_FOCUS_PAGES.gw}?${exact}`;
    case 'socketable':
      return `${NAME_FOCUS_PAGES.socketable}?${exact}`;
    case 'prefix':
    case 'suffix':
    case 'automagic':
      return `/game-data/affixes?${new URLSearchParams({ [FILTER_URL_PARAM_KEYS.SEARCH]: `"${name}"` }).toString()}`;
    case 'superior':
    case 'cube':
      return null;
  }
}

export interface ExampleItem {
  readonly kind: ModifierItemKind;
  readonly name: string;
}

/** The entry's example items over all its stats, without repeats, in the bundle's round-robin order, at most `limit` */
export function entryExamples(stats: readonly Pick<ModifierStat, 'examples'>[], limit = 12): ExampleItem[] {
  const seen = new Set<string>();
  const out: ExampleItem[] = [];
  const lists = stats.map((stat) => stat.examples);
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest && out.length < limit; index++) {
    for (const list of lists) {
      const example = list.at(index);
      if (example === undefined) continue;
      const [kind, name] = example;
      // An empty name would render as an invisible link
      if (name.trim() === '') continue;
      const id = `${kind}:${name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ kind, name });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** "Runeword 33 · Unique 84 · …" usage per item list, largest first */
export function usageSummary(usage: ModifierStat['usage']): { kind: ModifierItemKind; label: string; count: number }[] {
  return (Object.entries(usage) as [ModifierItemKind, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => ({ kind, label: ITEM_KIND_LABELS[kind], count }));
}

// --- fact tables --------------------------------------------------------------------------------------------------------

export interface FactGroups {
  /** `[Normal, Nightmare, Hell]` numbers: one table with a column per difficulty */
  readonly perDifficulty: readonly ModifierFact[];
  /** Per class / target / setting: a table each */
  readonly records: readonly ModifierFact[];
  /** Numbers, switches, strings and lists: one table */
  readonly scalars: readonly ModifierFact[];
}

export function groupFacts(facts: readonly ModifierFact[]): FactGroups {
  const perDifficulty: ModifierFact[] = [];
  const records: ModifierFact[] = [];
  const scalars: ModifierFact[] = [];
  for (const fact of facts) {
    const { value } = fact;
    if (Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number')) perDifficulty.push(fact);
    else if (typeof value === 'object' && !Array.isArray(value)) records.push(fact);
    else scalars.push(fact);
  }
  return { perDifficulty, records, scalars };
}

const RECORD_KEY_LABELS: Readonly<Partial<Record<string, string>>> = {
  monster: 'Normal monster',
  champion: 'Champion',
  minion: 'Minion',
  unique: 'Unique',
  super_unique: 'Superunique',
  act_boss: 'Act boss',
  mercenary: 'Mercenary',
  player: 'Player',
  ias: 'IAS',
  fcr: 'FCR',
  fhr: 'FHR',
  fbr: 'FBR',
  frw: 'FRW',
};

/** A record field as a row label: known names, "×5" for the hit-chance table's ratios, else camelCase / snake_case as words */
export function recordKeyLabel(key: string): string {
  const known = RECORD_KEY_LABELS[key];
  if (known !== undefined) return known;
  if (/^\d+(\.\d+)?$/.test(key)) return `×${key}`;
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

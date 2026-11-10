/**
 * Which section headings are unfolded, remembered per filter in this browser (docs/features/LOOT-FILTER.md "Section
 * comments"). The Rules and Styles lists keep their own sets of OPEN heading keys (`utils/sections.ts`, `2:Gold#1`), so a
 * heading this browser has not seen for the filter (a filter opened for the first time, a new section in a newer version
 * of the file) starts folded.
 */
import type { LootFilter } from '../engine/types';
import type { EditorTarget } from '../store/types';
import { enclosingHeadingKeys, type HeadingKeyChanges, type HeadingRow } from './sections';
import { SULLYS_QOL_TEMPLATE } from './template';

/** localStorage key of the remembered folds. */
export const SECTION_FOLDS_STORAGE_KEY = 'loot-filters/section-folds';
/** The folds of this many filters are kept, the most recently changed first; older ones start folded again. */
export const MAX_REMEMBERED_FILTERS = 30;
/** At most this many open headings per list are kept (Sully's filter has 50 headings). */
export const MAX_OPEN_HEADINGS = 500;
/** A longer heading key is not kept (a heading title is one comment line). */
const MAX_KEY_LENGTH = 300;
const MAX_ID_LENGTH = 200;

/** The open headings of one filter's lists. */
export interface FilterFolds {
  readonly rules: ReadonlySet<string>;
  readonly styles: ReadonlySet<string>;
}

export type FoldList = keyof FilterFolds;

/** Nothing open: how a filter starts. */
export const NO_FOLDS: FilterFolds = { rules: new Set(), styles: new Set() };

/** One remembered filter, as stored. */
interface StoredFilterFolds {
  readonly id: string;
  readonly rules: readonly string[];
  readonly styles: readonly string[];
}

/** The stored value: `{ "v": 1, "filters": [{ "id": "draft:…", "rules": ["1:PART 1"], "styles": [] }] }`, newest first. */
interface StoredFolds {
  readonly v: 1;
  readonly filters: readonly StoredFilterFolds[];
}

/**
 * Which filter the folds belong to: a saved or shared filter by its id (the owner's editor, a draft holding unsaved
 * edits of it, and the sandbox of the same filter share them, so Discard on such a draft keeps them), a new draft by its
 * library entry, a bundled template's sandbox by the template. `draftSavedId`: the saved filter a draft target belongs
 * to (its library entry's `savedId`).
 */
export function foldsIdOf(target: EditorTarget, draftSavedId?: string): string {
  if (target.kind === 'draft') return draftSavedId === undefined ? `draft:${target.entryId}` : `saved:${draftSavedId}`;
  if (target.kind === 'saved' || target.savedId !== null) return `saved:${target.savedId ?? ''}`;
  return `template:${target.basedOn?.template ?? SULLYS_QOL_TEMPLATE.id}`;
}

/** The editor screen's folds: the open filter's id, its folds, whether they changed since read, the ids it has shown. */
export interface FoldsSession {
  readonly id: string | null;
  readonly folds: FilterFolds;
  readonly changed: boolean;
  readonly seen: ReadonlySet<string>;
}

export function startFoldsSession(id: string | null, read: (id: string) => FilterFolds): FoldsSession {
  return { id, folds: id === null ? NO_FOLDS : read(id), changed: false, seen: new Set(id === null ? [] : [id]) };
}

/**
 * Another filter id opened: its stored folds, or the previous filter's carried over when `carry` says the open filter
 * only moved to a new id (a draft saved, a sandbox copied). The carry applies only to an id this session has not shown
 * yet, which a Save or Copy creates: going back to a filter opened before (browser Back) reads its own folds.
 */
export function switchFoldsSession(
  session: FoldsSession,
  id: string | null,
  carry: boolean,
  read: (id: string) => FilterFolds
): FoldsSession {
  if (id === session.id) return session;
  const seen = id === null || session.seen.has(id) ? session.seen : new Set([...session.seen, id]);
  if (carry && session.id !== null && id !== null && !session.seen.has(id)) return { id, folds: session.folds, changed: true, seen };
  return { id, folds: id === null ? NO_FOLDS : read(id), changed: false, seen };
}

/** The headings rule `index` of the filter sits in (its part, then its section). */
export function ruleHeadingKeys(filter: LootFilter, index: number): string[] {
  return enclosingHeadingKeys(filter.rules, (rule) => rule.commentsBefore, filter.rulesEndComments ?? [], index);
}

/** The headings the style `name` sits in, in the filter's Styles list. */
export function styleHeadingKeys(filter: LootFilter, name: string): string[] {
  const entries = Object.entries(filter.styles ?? {});
  const index = entries.findIndex(([key]) => key === name);
  return index === -1 ? [] : enclosingHeadingKeys(entries, ([, style]) => style.commentsBefore, [], index);
}

function keyList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value.filter((key): key is string => typeof key === 'string' && key !== '' && key.length <= MAX_KEY_LENGTH);
  return [...new Set(keys)].slice(0, MAX_OPEN_HEADINGS);
}

/** The remembered filters, newest first; anything unusable (not JSON, another shape, junk entries) is left out. */
export function parseStoredFolds(raw: string | null): StoredFilterFolds[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null || !('v' in parsed) || parsed.v !== 1 || !('filters' in parsed)) return [];
  if (!Array.isArray(parsed.filters)) return [];
  const filters: StoredFilterFolds[] = [];
  for (const entry of parsed.filters as unknown[]) {
    if (typeof entry !== 'object' || entry === null || !('id' in entry)) continue;
    const { id } = entry;
    if (typeof id !== 'string' || id === '' || id.length > MAX_ID_LENGTH || filters.some((known) => known.id === id)) continue;
    filters.push({ id, rules: keyList('rules' in entry ? entry.rules : []), styles: keyList('styles' in entry ? entry.styles : []) });
    if (filters.length === MAX_REMEMBERED_FILTERS) break;
  }
  return filters;
}

/** The folds of filter `id` (nothing open when it is not remembered). */
export function foldsOf(filters: readonly StoredFilterFolds[], id: string): FilterFolds {
  const stored = filters.find((entry) => entry.id === id);
  return stored === undefined ? NO_FOLDS : { rules: new Set(stored.rules), styles: new Set(stored.styles) };
}

/** The stored value with filter `id`'s folds first (the most recently changed), bounded. */
export function withFilterFolds(filters: readonly StoredFilterFolds[], id: string, folds: FilterFolds): string {
  const entry: StoredFilterFolds = { id, rules: keyList([...folds.rules]), styles: keyList([...folds.styles]) };
  const others = filters.filter((known) => known.id !== id);
  const value: StoredFolds = { v: 1, filters: [entry, ...others].slice(0, MAX_REMEMBERED_FILTERS) };
  return JSON.stringify(value);
}

/** The remembered folds of filter `id`; nothing open without storage (private windows, blocked site data). */
export function readFilterFolds(id: string): FilterFolds {
  try {
    return foldsOf(parseStoredFolds(window.localStorage.getItem(SECTION_FOLDS_STORAGE_KEY)), id);
  } catch {
    return NO_FOLDS;
  }
}

/** Remembers filter `id`'s folds. Ignores storage errors (the folds still apply until the page is left). */
export function writeFilterFolds(id: string, folds: FilterFolds): void {
  try {
    const filters = parseStoredFolds(window.localStorage.getItem(SECTION_FOLDS_STORAGE_KEY));
    window.localStorage.setItem(SECTION_FOLDS_STORAGE_KEY, withFilterFolds(filters, id, folds));
  } catch {
    // Not remembered.
  }
}

// ---------------------------------------------------------------------------
// Changes to an open set (`keys`: the headings the list has now, so keys of headings that are gone are dropped)
// ---------------------------------------------------------------------------

/**
 * A heading row clicked: a row shown folded opens, with its part (a section listed above a kept item inside a folded
 * part shows folded though it may be open itself); a row shown open folds.
 */
export function toggleHeading(
  open: ReadonlySet<string>,
  row: Pick<HeadingRow, 'key' | 'partKey' | 'collapsed'>,
  keys: readonly string[]
): Set<string> {
  const next = new Set(keys.filter((known) => open.has(known)));
  if (!row.collapsed) next.delete(row.key);
  else {
    next.add(row.key);
    if (row.partKey !== null) next.add(row.partKey);
  }
  return next;
}

/** `open` with these headings opened too (the headings around a selected rule or style); `open` itself when it has them. */
export function withOpened(open: ReadonlySet<string>, keys: readonly string[]): ReadonlySet<string> {
  if (keys.every((key) => open.has(key))) return open;
  return new Set([...open, ...keys]);
}

/**
 * The open set after a section edit (`headingKeyChanges`): a kept heading stays open or folded under its new key, a new
 * heading (Add section) starts open, a removed one is gone.
 */
export function openAfterEdit(open: ReadonlySet<string>, changes: HeadingKeyChanges): Set<string> {
  const next = new Set(changes.added);
  for (const [before, after] of changes.kept) {
    if (open.has(before)) next.add(after);
  }
  return next;
}

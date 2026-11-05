import type { SharedFilterLevel, SharedFilterSummary, SourceRevision } from '../sharing/types';
import type { LootFilterEntry } from '../store/types';
import { BUNDLED_TEMPLATES, bundledTemplate, type BundledTemplate, type BundledTemplateId } from './template';

// --- Routes ---

/** A saved filter: the editor for its owner, the sandbox for everyone else. */
export function savedFilterPath(id: string): string {
  return `/loot-filters/${id}`;
}

/** A draft in this browser. */
export function draftPath(entryId: string): string {
  return `/loot-filters/draft/${entryId}`;
}

/** The search param that opens the Rules tab's example rules dialog once (`withExamples`). */
export const EXAMPLES_PARAM = 'examples';

/** Opens the editor with the example rules dialog (a new blank filter's starter). */
export function withExamples(path: string): string {
  return `${path}?${EXAMPLES_PARAM}=1`;
}

/** Opens the editor with the Save dialog. */
export function withSave(path: string): string {
  return `${path}?save=1`;
}

/** The "Create a filter with AI help" page. */
export const AI_PAGE_PATH = '/loot-filters/ai';

/** The library tab with the public filters. */
export const SHARED_TAB_PATH = '/loot-filters?tab=shared';

/**
 * Where a draft's Open and Save go. A draft of a saved filter opens through the saved filter (its header knows the
 * saved name, Discard changes and Details) unless it needs a sign-in first: signed out, the saved route would show the
 * public filter instead of the edits, so it opens as a plain draft. So does a draft that does not record its owner
 * (`savedOwnerId` missing or dropped as malformed): the saved route only finds the drafts of its owner.
 */
export function draftLinks(
  entry: Pick<LootFilterEntry, 'id' | 'savedId' | 'savedOwnerId'>,
  needsSignIn: boolean
): { open: string; save: string } {
  const { savedId } = entry;
  const open = savedId !== undefined && entry.savedOwnerId !== undefined && !needsSignIn ? savedFilterPath(savedId) : draftPath(entry.id);
  return { open, save: withSave(open) };
}

// --- Library tabs ---

export type LibraryTab = 'shared' | 'mine';

export interface LibraryTabContext {
  /** The sign-in state is known (or the screen stopped waiting for it). */
  readonly authKnown: boolean;
  readonly signedIn: boolean;
  /** The library has been read from localStorage. */
  readonly libraryHydrated: boolean;
  /** Drafts in this browser that the library lists (signed out: all of them). */
  readonly hasLocalDrafts: boolean;
}

/**
 * The library tab: `?tab=` when it names one, else My filters when signed in or when this browser has drafts (a
 * returning visitor who is signed out must see their filters, not think they are gone), Shared otherwise. Drafts open
 * My filters even before the sign-in state is known; without them it is null (a spinner) until it is, so the page does
 * not flash the wrong tab.
 */
export function resolveLibraryTab(raw: string | null, context: LibraryTabContext): LibraryTab | null {
  if (raw === 'shared' || raw === 'mine') return raw;
  if (context.signedIn) return 'mine';
  if (!context.libraryHydrated) return null;
  if (context.hasLocalDrafts) return 'mine';
  return context.authKnown ? 'shared' : null;
}

// --- Card text ---

/** Dotted version compare ("0.6.9" < "0.6.11"); numeric parts compare as numbers, others as text. */
export function compareVersions(a: string, b: string): number {
  const left = a.trim().replace(/^v/i, '').split('.');
  const right = b.trim().replace(/^v/i, '').split('.');
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const x = left[index] ?? '0';
    const y = right[index] ?? '0';
    if (x === y) continue;
    const numeric = /^\d+$/.test(x) && /^\d+$/.test(y);
    if (numeric) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
  return 0;
}

type VersionFields = Pick<
  SharedFilterSummary,
  'esr_version' | 'plugin_version' | 'file_version' | 'esr_version_updated' | 'plugin_version_updated'
>;

/** "Created on ESR 3.2.24 · plugin 1.5.3 · filter v0.6.11"; null when none of them is known. */
export function createdOnLine(filter: VersionFields): string | null {
  const parts = [
    filter.esr_version === null ? null : `ESR ${filter.esr_version}`,
    filter.plugin_version === null ? null : `plugin ${filter.plugin_version}`,
    filter.file_version === null ? null : `filter v${filter.file_version.replace(/^v/i, '')}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `Created on ${parts.join(' · ')}`;
}

/** "Updated on ESR 3.2.25 · plugin 1.5.4" after a content save; null when it was never re-saved. */
export function updatedOnLine(filter: VersionFields): string | null {
  if (filter.esr_version_updated === null && filter.plugin_version_updated === null) return null;
  const parts = [
    filter.esr_version_updated === null ? null : `ESR ${filter.esr_version_updated}`,
    filter.plugin_version_updated === null ? null : `plugin ${filter.plugin_version_updated}`,
  ].filter((part) => part !== null);
  return `Updated on ${parts.join(' · ')}`;
}

/** "12 rules". */
export function ruleCountLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'rule' : 'rules'}`;
}

/** The level names in file order, blanks left out. */
export function levelNames(levels: readonly SharedFilterLevel[] | null): string[] {
  return (levels ?? []).map((level) => level.name.trim()).filter((name) => name !== '');
}

// --- Copies and updates ---

export type FilterUpdateStatus =
  | { readonly kind: 'update'; readonly note: string | null }
  | { readonly kind: 'gone' }
  /** Not a copy, up to date, or the source not looked up yet. */
  | null;

type BasedOnFields = Pick<
  SharedFilterSummary,
  'based_on_id' | 'based_on_revision' | 'based_on_template' | 'based_on_version' | 'based_on_label'
>;

/**
 * Whether a saved filter's source has moved on: a copy of a shared filter compares its `based_on_revision` with the
 * source's revision (`sourceRevisions`, from `fetchSourceRevisionsRequested`; null there = deleted or private now); a
 * filter started from a bundled template compares its `based_on_version` with that template's bundled version
 * (`templates`, default the bundled ones; an unknown template or version never reads as an update). A copy whose source
 * was deleted has lost its `based_on_id` (`on delete set null`) but keeps its label: that is "no longer shared" too.
 */
export function filterUpdateStatus(
  filter: BasedOnFields,
  sourceRevisions: Readonly<Record<string, SourceRevision | null>>,
  templates: Readonly<Record<BundledTemplateId, Pick<BundledTemplate, 'version'>>> = BUNDLED_TEMPLATES
): FilterUpdateStatus {
  if (filter.based_on_template !== null) {
    const template = bundledTemplate(filter.based_on_template);
    if (template === null || filter.based_on_version === null) return null;
    return compareVersions(filter.based_on_version, templates[template.id].version) < 0 ? { kind: 'update', note: null } : null;
  }
  if (filter.based_on_id === null) return filter.based_on_label === null ? null : { kind: 'gone' };
  if (!(filter.based_on_id in sourceRevisions)) return null;
  const source = sourceRevisions[filter.based_on_id];
  if (source === null) return { kind: 'gone' };
  return source.revision > (filter.based_on_revision ?? 0) ? { kind: 'update', note: source.change_note } : null;
}

/** The shared filters `filters` were copied from, for one `fetchSourceRevisionsRequested`, sorted for a stable key. */
export function sourceIdsOf(filters: readonly BasedOnFields[]): string[] {
  return [...new Set(filters.map((filter) => filter.based_on_id).filter((id) => id !== null))].sort();
}

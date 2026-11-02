import { createSelector } from '@reduxjs/toolkit';
import { readLootFilter } from '../engine/parse';
import { toPlainJson } from '../engine/serialize';
import { validateLootFilter } from '../engine/validate';
import type { Diagnostic, LootFilterReference } from '../engine/types';
import { entryBasedOn } from '../utils/basedOn';
import type { EditorTarget, LootFilterBasedOn, LootFilterEntry, LootFilterState } from './types';

/** The part of the root state these selectors read (the app's `LootFilterRootState` is one). */
interface LootFilterRootState {
  readonly lootFilter: LootFilterState;
}

export const selectLibraryHydrated = (state: LootFilterRootState): boolean => state.lootFilter.library.hydrated;
export const selectLibraryEntries = (state: LootFilterRootState): readonly LootFilterEntry[] => state.lootFilter.library.entries;

export const selectLibraryEntry = (state: LootFilterRootState, id: string | undefined): LootFilterEntry | undefined =>
  id === undefined ? undefined : state.lootFilter.library.entries.find((entry) => entry.id === id);

export const selectEditor = (state: LootFilterRootState) => state.lootFilter.editor;
export const selectEditorTarget = (state: LootFilterRootState): EditorTarget | null => state.lootFilter.editor.target;
export const selectEditorFilter = (state: LootFilterRootState) => state.lootFilter.editor.filter;

/**
 * The open filter's stored text (what the model was parsed from, or was last written as): the draft's text; for a
 * saved filter its draft's text, else the saved content; the sandbox's original text. Null when nothing is open (or the
 * draft is missing).
 */
export function selectEditorText(state: LootFilterRootState): string | null {
  const target = selectEditorTarget(state);
  if (target === null) return null;
  if (target.kind === 'draft') return selectLibraryEntry(state, target.entryId)?.text ?? null;
  if (target.kind === 'saved') return selectLibraryEntry(state, target.draftId)?.text ?? target.baseText;
  return target.baseText;
}

/** The open filter's name: the draft's library name, the saved or shared filter's name. */
export function selectEditorName(state: LootFilterRootState): string | null {
  const target = selectEditorTarget(state);
  if (target === null) return null;
  return target.kind === 'draft' ? (selectLibraryEntry(state, target.entryId)?.name ?? null) : target.name;
}

/**
 * Whether the open filter has something Save would write: always for a draft (it was never saved, or it holds unsaved
 * edits of a saved filter); for a saved filter, a draft or pending edits; in the sandbox, edits since it opened (for
 * the "leave with changes?" prompt; the sandbox itself cannot be saved).
 */
export function selectHasUnsavedChanges(state: LootFilterRootState): boolean {
  const { target, dirty } = state.lootFilter.editor;
  if (target === null) return false;
  if (target.kind === 'draft') return true;
  if (target.kind === 'saved') return dirty || selectLibraryEntry(state, target.draftId) !== undefined;
  return dirty;
}

/** What Save sends; the save saga puts `flushNow()` first so the stored text is the model. */
export interface LootFilterSaveRequest {
  /** `insert` for a new filter (a draft without `savedId`), `update` for a saved one. */
  readonly kind: 'insert' | 'update';
  /** The draft's text, verbatim: it becomes `content` (and `saveSucceeded.sentText`). */
  readonly text: string;
  /** The draft's name (used by an insert; a saved filter's name is a server field). */
  readonly name: string;
  /** The draft holding `text` (for `saveSucceeded.entryId`). */
  readonly entryId: string;
  readonly savedId: string | null;
  /** The revision the draft started from (compare-and-swap); null for an insert or a draft that lost it. */
  readonly expectedRevision: number | null;
  /** The draft's `basedOn` (inferred from the file for an old template draft): the `based_on_*` columns. */
  readonly basedOn: LootFilterBasedOn | null;
}

/**
 * The open filter's save request, read after `flushNow`: from the draft target's entry, or the saved target's draft.
 * Null in the sandbox, with nothing open, or for a saved filter without changes (no draft after the flush).
 */
export const selectSaveRequest = createSelector(
  [selectEditorTarget, selectLibraryEntries],
  (target, entries): LootFilterSaveRequest | null => {
    if (target === null || target.kind === 'sandbox') return null;
    const entryId = target.kind === 'draft' ? target.entryId : target.draftId;
    const entry = entries.find((candidate) => candidate.id === entryId);
    if (!entry) return null;
    const savedId = target.kind === 'saved' ? target.savedId : (entry.savedId ?? null);
    return {
      kind: savedId === null ? 'insert' : 'update',
      text: entry.text,
      name: target.kind === 'saved' ? target.name : entry.name,
      entryId,
      savedId,
      expectedRevision: savedId === null ? null : (entry.savedRevision ?? (target.kind === 'saved' ? target.revision : null)),
      basedOn: entryBasedOn(entry) ?? (target.kind === 'saved' ? target.basedOn : null),
    };
  }
);

export interface VisibleDraft {
  readonly entry: LootFilterEntry;
  /**
   * Signed out, a draft of a saved filter (it has `savedOwnerId`) is listed under "Sign in to save": it belongs to an
   * account. Signed in, drafts of another account are not listed at all, so this is false.
   */
  readonly needsSignIn: boolean;
}

/**
 * The drafts to list for `viewerId` (null when signed out), in library order: signed in, the drafts of another
 * account's saved filters are hidden (they stay in storage); signed out, every draft is listed and those of a saved
 * filter are flagged `needsSignIn`.
 */
export const selectVisibleDrafts = createSelector(
  [selectLibraryEntries, (_state: LootFilterRootState, viewerId: string | null) => viewerId],
  (entries, viewerId): readonly VisibleDraft[] =>
    entries
      .filter((entry) => viewerId === null || entry.savedOwnerId === undefined || entry.savedOwnerId === viewerId)
      .map((entry) => ({ entry, needsSignIn: viewerId === null && entry.savedOwnerId !== undefined }))
);
export const selectParseDiagnostics = (state: LootFilterRootState) => state.lootFilter.editor.parseDiagnostics;
export const selectTextNotes = (state: LootFilterRootState) => state.lootFilter.editor.textNotes;

/**
 * The open model's diagnostics: shape diagnostics from re-reading the model as JSON (so rule indices and fixed keys
 * follow edits) plus `validateLootFilter`, after the entry text's notes (`textNotes`: accepted trailing commas and block
 * comments, comments that are dropped; cleared once the model is written back). Without a model (a JSONC syntax error)
 * it is the stored parse diagnostics.
 * The reference is passed by the caller (from `useLootFilterReference`) instead of living in Redux: it holds Sets,
 * which Redux state should not. Memoized on (filter, parse diagnostics, text notes, reference) identity.
 */
export const selectDiagnostics = createSelector(
  [
    selectEditorFilter,
    selectParseDiagnostics,
    selectTextNotes,
    (_state: LootFilterRootState, reference?: LootFilterReference) => reference,
  ],
  (filter, parseDiagnostics, textNotes, reference): readonly Diagnostic[] =>
    filter === null
      ? parseDiagnostics
      : [...textNotes, ...readLootFilter(toPlainJson(filter)).diagnostics, ...validateLootFilter(filter, reference)]
);

export interface DiagnosticCounts {
  readonly errors: number;
  readonly warnings: number;
}

export function countDiagnostics(diagnostics: readonly Diagnostic[]): DiagnosticCounts {
  let errors = 0;
  for (const diagnostic of diagnostics) if (diagnostic.severity === 'error') errors += 1;
  return { errors, warnings: diagnostics.length - errors };
}

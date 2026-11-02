/**
 * Loot filter library (the drafts in this browser) + editor state.
 *
 * - `library.entries[].text` (the serialized filter file) is the source of truth and what localStorage holds.
 * - `editor.target` says what is open (see `EditorTarget`): a draft entry, the owner's saved filter (whose unsaved edits
 *   live in a draft created on the first flush) or a sandbox that never writes.
 * - `editor.filter` is the parsed model of the open filter. Editor mutations change the model and set `dirty`;
 *   the saga serializes it back (`editorFlushed`, debounced), and `open`/`openSaved`/`openSandbox`/`close`/`flushNow`
 *   flush synchronously. A flush only writes while `dirty`, so a debounced flush that fires after Save or Discard
 *   (which leave `dirty` false) writes nothing.
 * - Reducers return new objects instead of mutating the Immer draft: the engine model is deeply readonly, and
 *   building new values keeps every reducer a plain function of (state, payload).
 * - Ids and timestamps come from `prepare` callbacks, so the reducers stay pure (tests pass them in the payload).
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { parseLootFilter } from '../engine/parse';
import { serializeLootFilter } from '../engine/serialize';
import type { Diagnostic, FilterLevel, LootFilter, LootFilterRule, LootFilterStyle, Notifications, QualityColors } from '../engine/types';
import type { LootFilterRow } from '@/core/supabase/types';
import { basedOnFromRow, sharedBasedOn } from '../utils/basedOn';
import { createBlankFilter } from '../utils/blankFilter';
import { newEntryId } from '../utils/ids';
import { applyPatch, type ShallowPatch } from '../utils/patch';
import type { EditorTarget, LootFilterBasedOn, LootFilterEditorState, LootFilterEntry, LootFilterSource, LootFilterState } from './types';

type State = LootFilterState;

/** Top-level settings `setHeader` edits (filter levels, notifications and quality colours have their own reducers). */
export type LootFilterHeader = Pick<
  LootFilter,
  'title' | 'author' | 'version' | 'description' | 'updateUrl' | 'defaultLevel' | 'hideUnmatchedItems' | 'soundVolume'
>;

const DEFAULT_ENTRY_NAME = 'Untitled filter';

export const EMPTY_EDITOR: LootFilterEditorState = {
  target: null,
  filter: null,
  parseDiagnostics: [],
  textNotes: [],
  selectedRule: null,
  dirty: false,
};

export const initialState: State = {
  library: { hydrated: false, entries: [] },
  editor: EMPTY_EDITOR,
};

// ---------------------------------------------------------------------------
// Helpers (pure, on plain or draft state)
// ---------------------------------------------------------------------------

function cleanName(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? DEFAULT_ENTRY_NAME : trimmed;
}

function withEntries(state: State, entries: readonly LootFilterEntry[]): State {
  return { ...state, library: { ...state.library, entries } };
}

function withEditor(state: State, editor: Partial<LootFilterEditorState>): State {
  return { ...state, editor: { ...state.editor, ...editor } };
}

function updateEntry(state: State, id: string, update: (entry: LootFilterEntry) => LootFilterEntry): State {
  const index = state.library.entries.findIndex((entry) => entry.id === id);
  if (index === -1) return state;
  const entries = [...state.library.entries];
  entries[index] = update(entries[index]);
  return withEntries(state, entries);
}

function findEntry(state: State, id: string): LootFilterEntry | undefined {
  return state.library.entries.find((entry) => entry.id === id);
}

function removeEntry(state: State, id: string): State {
  const entries = state.library.entries.filter((entry) => entry.id !== id);
  return entries.length === state.library.entries.length ? state : withEntries(state, entries);
}

/** The library entry the editor writes to: the draft target's entry, the saved target's draft; none in the sandbox. */
function backingEntryId(target: EditorTarget | null): string | null {
  if (target?.kind === 'draft') return target.entryId;
  if (target?.kind === 'saved') return target.draftId;
  return null;
}

/** The `source` of a draft made from a saved or shared filter (the field predates sharing; it only labels the card). */
function sourceFor(basedOn: LootFilterBasedOn | null | undefined): LootFilterSource {
  return basedOn?.template === undefined ? 'upload' : 'template';
}

/** `{ basedOn }` when set, else nothing: entries never store `basedOn: undefined`. */
function basedOnField(basedOn: LootFilterBasedOn | null | undefined): { readonly basedOn?: LootFilterBasedOn } {
  return basedOn ? { basedOn } : {};
}

/** The text as the editor writes it: `serializeLootFilter(parse(text))`, or null when the text cannot be read. */
export function canonicalText(text: string): string | null {
  try {
    return serializeLootFilter(parseLootFilter(text).filter);
  } catch {
    return null;
  }
}

/**
 * Writes the saved target's draft: created on the first edit (with the saved filter's id, owner, revision, name and
 * `based_on`), updated after that, and removed once the text is the saved content again.
 */
function writeSavedDraft(state: State, target: Extract<EditorTarget, { kind: 'saved' }>, text: string, now: number): State {
  if (text === target.baseCanonical) return removeEntry(state, target.draftId);
  if (findEntry(state, target.draftId)) return updateEntry(state, target.draftId, (entry) => ({ ...entry, text, updatedAt: now }));
  const draft: LootFilterEntry = {
    id: target.draftId,
    name: target.name,
    source: sourceFor(target.basedOn),
    createdAt: now,
    updatedAt: now,
    text,
    savedId: target.savedId,
    savedOwnerId: target.ownerId,
    savedRevision: target.revision,
    ...basedOnField(target.basedOn),
  };
  return withEntries(state, [...state.library.entries, draft]);
}

/**
 * Writes a dirty editor model back (draft: into its entry; saved: into its draft), whose text then no longer has what
 * `textNotes` describe. The sandbox never writes. Without `dirty` it is a no-op: that is what keeps a late debounced
 * flush from re-creating a draft that Save or Discard removed.
 */
function flushEditor(state: State, now: number): State {
  const { target, filter, dirty } = state.editor;
  if (target === null || target.kind === 'sandbox' || filter === null || !dirty) return state;
  const text = serializeLootFilter(filter);
  const flushed =
    target.kind === 'draft'
      ? updateEntry(state, target.entryId, (entry) => ({ ...entry, text, updatedAt: now }))
      : writeSavedDraft(state, target, text, now);
  return withEditor(flushed, { dirty: false, textNotes: [] });
}

/** Opens `text` in the editor under `target`; template-based text gets no text notes (Sully's comments are on purpose). */
function openText(state: State, target: EditorTarget, text: string, template: boolean): State {
  const parsed = parseEntryText(text);
  return { ...state, editor: { ...EMPTY_EDITOR, target, ...parsed, textNotes: template ? [] : parsed.textNotes } };
}

/** Re-parses `text` into the open editor (same target), keeping the selected rule when it still exists. */
function reloadText(state: State, target: EditorTarget, text: string, template: boolean): State {
  const reopened = openText(state, target, text, template);
  const selected = state.editor.selectedRule;
  const count = reopened.editor.filter?.rules.length ?? 0;
  return withEditor(reopened, { selectedRule: selected !== null && isIndex(selected, count) ? selected : null });
}

/** The name shown for the open filter (the draft's library name, or the saved / shared filter's name). */
function editorName(state: State): string | undefined {
  const target = state.editor.target;
  if (target === null) return undefined;
  return target.kind === 'draft' ? findEntry(state, target.entryId)?.name : target.name;
}

/** Applies `update` to the open filter; a no-op (same object or undefined) leaves the state and `dirty` alone. */
function editFilter(state: State, update: (filter: LootFilter) => LootFilter | undefined): State {
  const filter = state.editor.filter;
  if (filter === null) return state;
  const next = update(filter);
  if (next === undefined || next === filter) return state;
  return withEditor(state, { filter: next, dirty: true });
}

function editRules(
  state: State,
  update: (
    rules: readonly LootFilterRule[]
  ) => { readonly rules: readonly LootFilterRule[]; readonly selectedRule?: number | null } | undefined
): State {
  const filter = state.editor.filter;
  if (filter === null) return state;
  const result = update(filter.rules);
  if (result === undefined) return state;
  const selectedRule = result.selectedRule === undefined ? state.editor.selectedRule : result.selectedRule;
  return withEditor(state, { filter: { ...filter, rules: result.rules }, dirty: true, selectedRule });
}

function isIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

/** `value` without its empty-object form: `{}` becomes undefined so the key is dropped from the file. */
function nonEmpty<T extends object>(value: T): T | undefined {
  return Object.keys(value).length === 0 ? undefined : value;
}

function parseEntryText(text: string): Pick<LootFilterEditorState, 'filter' | 'parseDiagnostics' | 'textNotes'> {
  try {
    const { filter, diagnostics, notes } = parseLootFilter(text);
    return { filter, parseDiagnostics: diagnostics, textNotes: notes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      filter: null,
      parseDiagnostics: [{ severity: 'error', path: '', message: `The filter is not valid JSON: ${message}` }],
      textNotes: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

interface CreateBlankPayload {
  readonly id: string;
  readonly name: string;
  readonly now: number;
}

interface ImportTextPayload {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  readonly source: LootFilterSource;
  /** Start from Sully's records the template and its version. */
  readonly basedOn?: LootFilterBasedOn;
  readonly now: number;
}

interface DuplicatePayload {
  readonly id: string;
  readonly newId: string;
  readonly now: number;
}

export interface OpenSavedInput {
  /** The saved filter as fetched (with `content`). */
  readonly row: LootFilterRow;
  /** The signed-in user's id, or null when signed out. */
  readonly viewerId: string | null;
  /** The author as shown ("Name#1234"): the sandbox's Copy to my filters labels the copy "<name> by <author>". */
  readonly authorLabel: string;
}

interface OpenSavedPayload extends OpenSavedInput {
  /** The id a new draft gets when the owner has none for this filter yet. */
  readonly draftId: string;
  readonly now: number;
}

export interface OpenSandboxInput {
  readonly text: string;
  readonly name: string;
  /** What Copy to my filters records (the template and its version for Sully's). */
  readonly basedOn: LootFilterBasedOn | null;
}

export interface SaveSucceededInput {
  /** The exact text Save sent (`LootFilterSaveRequest.text`). */
  readonly sentText: string;
  /** The row as the server returned it (new `revision`, `content`). */
  readonly row: LootFilterRow;
  /** The draft the text came from (`LootFilterSaveRequest.entryId`). */
  readonly entryId: string | null;
}

interface SaveSucceededPayload extends SaveSucceededInput {
  /** The id a later draft of the now saved filter gets (when no draft remains). */
  readonly draftId: string;
  readonly now: number;
}

export interface TakeUpdateInput {
  /** The source's latest content (or the bundled template's text). */
  readonly text: string;
  /** The new `basedOn` (the source's new revision, or the template's new version). */
  readonly basedOn: LootFilterBasedOn;
  /** `replace`: load into the open filter as unsaved changes; `new`: add as a new draft. */
  readonly mode: 'replace' | 'new';
  /** The new draft's name (`new` only); default: the open filter's name, else the `basedOn` label. */
  readonly name?: string;
}

interface TakeUpdatePayload extends TakeUpdateInput {
  /** The new draft's id (`new`, or `replace` on a saved filter without a draft keeps its target's `draftId`). */
  readonly id: string;
  readonly now: number;
}

const stamp = <T extends object>(payload: T) => ({ payload: { ...payload, now: Date.now() } });

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const lootFilterSlice = createSlice({
  name: 'lootFilter',
  initialState,
  reducers: {
    // ----- library -----

    /** Loads the stored library (saga, at startup), replacing whatever the library held. */
    hydrate(state, action: PayloadAction<readonly LootFilterEntry[]>): State {
      return { ...state, library: { hydrated: true, entries: action.payload } };
    },

    createBlank: {
      reducer(state, action: PayloadAction<CreateBlankPayload>): State {
        const { id, now } = action.payload;
        const name = cleanName(action.payload.name);
        const text = serializeLootFilter(createBlankFilter(name));
        return withEntries(state, [...state.library.entries, { id, name, source: 'blank', createdAt: now, updatedAt: now, text }]);
      },
      prepare: (name: string) => stamp({ id: newEntryId(), name }),
    },

    /** Adds a filter file as a new entry (upload or template). The text is stored as given. */
    importText: {
      reducer(state, action: PayloadAction<ImportTextPayload>): State {
        const { id, text, source, basedOn, now } = action.payload;
        const name = cleanName(action.payload.name);
        const entry: LootFilterEntry = { id, name, source, createdAt: now, updatedAt: now, text, ...basedOnField(basedOn) };
        return withEntries(state, [...state.library.entries, entry]);
      },
      prepare: (input: {
        readonly name: string;
        readonly text: string;
        readonly source: LootFilterSource;
        readonly basedOn?: LootFilterBasedOn;
      }) => stamp({ id: newEntryId(), ...input }),
    },

    /**
     * Copies an entry (flushing the editor first when it is the open one) right after the original. The copy is a new
     * filter: it keeps neither the saved filter it edits (`saved*`) nor `basedOn`.
     */
    duplicate: {
      reducer(state, action: PayloadAction<DuplicatePayload>): State {
        const { id, newId, now } = action.payload;
        const flushed = backingEntryId(state.editor.target) === id ? flushEditor(state, now) : state;
        const index = flushed.library.entries.findIndex((entry) => entry.id === id);
        if (index === -1) return state;
        const { name, source, text } = flushed.library.entries[index];
        const copy: LootFilterEntry = { id: newId, name: `${name} (copy)`, source, createdAt: now, updatedAt: now, text };
        const entries = [...flushed.library.entries];
        entries.splice(index + 1, 0, copy);
        return withEntries(flushed, entries);
      },
      prepare: (id: string) => stamp({ id, newId: newEntryId() }),
    },

    rename: {
      reducer(state, action: PayloadAction<{ readonly id: string; readonly name: string; readonly now: number }>): State {
        const { id, now } = action.payload;
        const name = cleanName(action.payload.name);
        return updateEntry(state, id, (entry) => (entry.name === name ? entry : { ...entry, name, updatedAt: now }));
      },
      prepare: (input: { readonly id: string; readonly name: string }) => stamp(input),
    },

    /** Deletes an entry; closes the editor when it is the open draft. */
    remove(state, action: PayloadAction<string>): State {
      const id = action.payload;
      const removed = removeEntry(state, id);
      if (removed === state) return state;
      const target = state.editor.target;
      return target?.kind === 'draft' && target.entryId === id ? { ...removed, editor: EMPTY_EDITOR } : removed;
    },

    /** Serializes a dirty editor model into its entry (saga, debounced; the editor screen also sends it on unload). */
    editorFlushed: {
      reducer(state, action: PayloadAction<{ readonly now: number }>): State {
        return flushEditor(state, action.payload.now);
      },
      prepare: () => stamp({}),
    },

    /**
     * The same flush, sent by Save before it reads the text (`selectSaveRequest`): afterwards the stored text is the
     * model and `dirty` is false, so the debounced flush still pending from the last edit writes nothing.
     */
    flushNow: {
      reducer(state, action: PayloadAction<{ readonly now: number }>): State {
        return flushEditor(state, action.payload.now);
      },
      prepare: () => stamp({}),
    },

    // ----- editor: open / close -----

    /**
     * Opens a library entry as a draft target: flushes the previously open filter, then parses the text. A JSONC syntax
     * error leaves `filter: null`.
     */
    open: {
      reducer(state, action: PayloadAction<{ readonly id: string; readonly now: number }>): State {
        const { id, now } = action.payload;
        const flushed = flushEditor(state, now);
        const target: EditorTarget = { kind: 'draft', entryId: id };
        const entry = findEntry(flushed, id);
        if (!entry) return { ...flushed, editor: { ...EMPTY_EDITOR, target } };
        // The template's section comments are Sully's, shipped on purpose; a notice about losing them would only be noise.
        return openText(flushed, target, entry.text, entry.source === 'template');
      },
      prepare: (id: string) => stamp({ id }),
    },

    /**
     * Opens a saved filter. Its owner gets the `saved` target, on their draft of it when there is one (else on the
     * content); anyone else (or a signed-out visitor) gets the sandbox on the content.
     */
    openSaved: {
      reducer(state, action: PayloadAction<OpenSavedPayload>): State {
        const { row, viewerId, authorLabel, draftId, now } = action.payload;
        const flushed = flushEditor(state, now);
        const rowBasedOn = basedOnFromRow(row);
        const template = rowBasedOn?.template !== undefined;
        if (viewerId === null || viewerId !== row.user_id) {
          const target: EditorTarget = {
            kind: 'sandbox',
            savedId: row.id,
            revision: row.revision,
            ownerId: row.user_id,
            name: row.name,
            baseText: row.content,
            // Never label a copy with a private filter's name (it is only visible to its owner anyway).
            basedOn: row.is_private ? null : sharedBasedOn(row, authorLabel),
          };
          return openText(flushed, target, row.content, template);
        }
        // The most recently edited draft when a second tab made another one.
        let draft: LootFilterEntry | undefined;
        for (const entry of flushed.library.entries) {
          if (entry.savedId !== row.id || entry.savedOwnerId !== viewerId) continue;
          if (!draft || entry.updatedAt > draft.updatedAt) draft = entry;
        }
        const target: EditorTarget = {
          kind: 'saved',
          savedId: row.id,
          revision: row.revision,
          ownerId: row.user_id,
          name: row.name,
          baseText: row.content,
          baseCanonical: canonicalText(row.content),
          draftId: draft?.id ?? draftId,
          basedOn: rowBasedOn,
        };
        return openText(flushed, target, draft?.text ?? row.content, template);
      },
      prepare: (input: OpenSavedInput) => stamp({ ...input, draftId: newEntryId() }),
    },

    /** Opens a sandbox on a text that is not a saved filter (the bundled template): editable, never written. */
    openSandbox: {
      reducer(state, action: PayloadAction<OpenSandboxInput & { readonly now: number }>): State {
        const { text, name, basedOn, now } = action.payload;
        const flushed = flushEditor(state, now);
        const target: EditorTarget = { kind: 'sandbox', savedId: null, revision: null, ownerId: null, name, baseText: text, basedOn };
        return openText(flushed, target, text, basedOn?.template !== undefined);
      },
      prepare: (input: OpenSandboxInput) => stamp(input),
    },

    close: {
      reducer(state, action: PayloadAction<{ readonly now: number }>): State {
        return { ...flushEditor(state, action.payload.now), editor: EMPTY_EDITOR };
      },
      prepare: () => stamp({}),
    },

    // ----- saving, discarding, copies and updates -----

    /**
     * Save went through (insert or update). The draft that held the sent text is removed if it still has that text;
     * otherwise (edited and flushed while saving) it stays as the saved filter's draft, now based on the new revision.
     * When the editor is on this filter its target becomes (or stays) `saved` with the row as the new base, without
     * touching the model, the selection or `dirty` (edits made while saving still flush, against the new base).
     */
    saveSucceeded: {
      reducer(state, action: PayloadAction<SaveSucceededPayload>): State {
        const { sentText, row, entryId, draftId } = action.payload;
        const draft = entryId === null ? undefined : findEntry(state, entryId);
        const remaining =
          draft === undefined || draft.text === sentText
            ? undefined
            : { ...draft, savedId: row.id, savedOwnerId: row.user_id, savedRevision: row.revision };
        let next: State = state;
        if (remaining) next = updateEntry(state, remaining.id, () => remaining);
        else if (draft) next = removeEntry(state, draft.id);
        const target = next.editor.target;
        // Save as a new filter from a saved one sends the saved target's draft: the editor moves to the new row.
        const onThisFilter =
          (target?.kind === 'draft' && target.entryId === entryId) ||
          (target?.kind === 'saved' && (target.savedId === row.id || target.draftId === entryId));
        if (!onThisFilter) return next;
        const saved: EditorTarget = {
          kind: 'saved',
          savedId: row.id,
          revision: row.revision,
          ownerId: row.user_id,
          name: row.name,
          baseText: row.content,
          baseCanonical: canonicalText(row.content),
          draftId: remaining?.id ?? (target.kind === 'saved' ? target.draftId : draftId),
          basedOn: basedOnFromRow(row),
        };
        return withEditor(next, { target: saved });
      },
      prepare: (input: SaveSucceededInput) => stamp({ ...input, draftId: newEntryId() }),
    },

    /**
     * A saved filter's name changed on the server (the Details dialog): the open target and the drafts of that filter
     * take it (a draft created later for it gets the new name too).
     */
    savedFilterRenamed(state, action: PayloadAction<{ readonly savedId: string; readonly name: string }>): State {
      const { savedId, name } = action.payload;
      const target = state.editor.target;
      const renamedTarget = target !== null && target.kind !== 'draft' && target.savedId === savedId && target.name !== name;
      const entries = state.library.entries.map((entry) => (entry.savedId === savedId && entry.name !== name ? { ...entry, name } : entry));
      const changed = entries.some((entry, index) => entry !== state.library.entries[index]);
      if (!renamedTarget && !changed) return state;
      const withNames = changed ? withEntries(state, entries) : state;
      return renamedTarget ? withEditor(withNames, { target: { ...target, name } }) : withNames;
    },

    /**
     * Drops the unsaved changes: a saved filter's draft is removed and its content re-parsed; the sandbox goes back to
     * its original text. `dirty` ends false, so a pending debounced flush writes nothing. No-op on a draft target (a new
     * filter has nothing to go back to: delete it instead).
     */
    discardChanges(state): State {
      const target = state.editor.target;
      if (target === null || target.kind === 'draft') return state;
      const removed = target.kind === 'saved' ? removeEntry(state, target.draftId) : state;
      return reloadText(removed, target, target.baseText, target.basedOn?.template !== undefined);
    },

    /**
     * The sandbox's Copy to my filters: a new draft from the edited model (or the original text when unchanged), with
     * the sandbox's `basedOn`. The editor switches to that draft in place (model, selection and tabs kept); the caller
     * reads the new id from the action's `payload.id` to replace the route. No-op outside the sandbox.
     */
    copyToMyFilters: {
      reducer(state, action: PayloadAction<{ readonly id: string; readonly now: number }>): State {
        const { id, now } = action.payload;
        const { target, filter, dirty, textNotes } = state.editor;
        if (target?.kind !== 'sandbox') return state;
        const edited = dirty && filter !== null;
        const entry: LootFilterEntry = {
          id,
          name: cleanName(target.name),
          source: sourceFor(target.basedOn),
          createdAt: now,
          updatedAt: now,
          text: edited ? serializeLootFilter(filter) : target.baseText,
          ...basedOnField(target.basedOn),
        };
        const added = withEntries(state, [...state.library.entries, entry]);
        return withEditor(added, { target: { kind: 'draft', entryId: id }, dirty: false, textNotes: edited ? [] : textNotes });
      },
      prepare: () => stamp({ id: newEntryId() }),
    },

    /**
     * Update available: `new` adds the source's latest text as a new draft (editor untouched). `replace` loads it into the
     * open draft or saved filter as unsaved changes, written to the draft right away together with the new `basedOn`
     * (so a later Save writes `based_on_revision` / `based_on_version`); the edits it replaces are dropped (the UI asks
     * first). `replace` is a no-op in the sandbox or with nothing open.
     */
    takeUpdate: {
      reducer(state, action: PayloadAction<TakeUpdatePayload>): State {
        const { text, basedOn, mode, id, now } = action.payload;
        const template = basedOn.template !== undefined;
        if (mode === 'new') {
          const name = cleanName(action.payload.name ?? editorName(state) ?? basedOn.label);
          const entry: LootFilterEntry = { id, name, source: sourceFor(basedOn), createdAt: now, updatedAt: now, text, basedOn };
          return withEntries(state, [...state.library.entries, entry]);
        }
        const target = state.editor.target;
        if (target === null || target.kind === 'sandbox') return state;
        let written: State;
        if (target.kind === 'draft') {
          written = updateEntry(state, target.entryId, (entry) => ({ ...entry, text, basedOn, updatedAt: now }));
        } else if (findEntry(state, target.draftId)) {
          written = updateEntry(state, target.draftId, (entry) => ({ ...entry, text, basedOn, updatedAt: now }));
        } else {
          const draft: LootFilterEntry = {
            id: target.draftId,
            name: target.name,
            source: sourceFor(basedOn),
            createdAt: now,
            updatedAt: now,
            text,
            savedId: target.savedId,
            savedOwnerId: target.ownerId,
            savedRevision: target.revision,
            basedOn,
          };
          written = withEntries(state, [...state.library.entries, draft]);
        }
        return reloadText(written, target, text, template);
      },
      prepare: (input: TakeUpdateInput) => stamp({ ...input, id: newEntryId() }),
    },

    // ----- editor: settings -----

    /** Patches the top-level settings; an `undefined` value removes the key. */
    setHeader(state, action: PayloadAction<ShallowPatch<LootFilterHeader>>): State {
      return editFilter(state, (filter) => applyPatch<LootFilter>(filter, action.payload));
    },

    /** Replaces the level list; `undefined` removes `filterLevels`. */
    setFilterLevels(state, action: PayloadAction<readonly FilterLevel[] | undefined>): State {
      return editFilter(state, (filter) => applyPatch(filter, { filterLevels: action.payload }));
    },

    /** Patches `notifications` (an `undefined` value removes that format); an empty result removes the key. */
    setNotifications(state, action: PayloadAction<ShallowPatch<Notifications>>): State {
      return editFilter(state, (filter) => {
        const notifications = nonEmpty(applyPatch<Notifications>(filter.notifications ?? {}, action.payload));
        return applyPatch(filter, { notifications });
      });
    },

    /** Patches `qualityColors` (an `undefined` value restores the game default); an empty result removes the key. */
    setQualityColors(state, action: PayloadAction<ShallowPatch<QualityColors>>): State {
      return editFilter(state, (filter) => {
        const qualityColors = nonEmpty(applyPatch<QualityColors>(filter.qualityColors ?? {}, action.payload));
        return applyPatch(filter, { qualityColors });
      });
    },

    /**
     * Changes a level's id and points `activeInLevels` and `defaultLevel` at the new one. No-op when `from` is not a
     * level, `to` is not an integer or another level already has it.
     */
    renumberLevel(state, action: PayloadAction<{ readonly from: number; readonly to: number }>): State {
      const { from, to } = action.payload;
      return editFilter(state, (filter) => {
        const levels = filter.filterLevels;
        if (from === to || !Number.isInteger(to) || !levels?.some((level) => level.id === from)) return undefined;
        if (levels.some((level) => level.id === to)) return undefined;
        const renumber = (id: number): number => (id === from ? to : id);
        const rules = filter.rules.map((rule) =>
          rule.activeInLevels?.includes(from) ? { ...rule, activeInLevels: rule.activeInLevels.map(renumber) } : rule
        );
        return {
          ...filter,
          filterLevels: levels.map((level) => (level.id === from ? { ...level, id: to } : level)),
          ...(filter.defaultLevel === undefined ? {} : { defaultLevel: renumber(filter.defaultLevel) }),
          rules,
        };
      });
    },

    // ----- editor: rules -----

    /** Inserts a rule (default: an empty one) at `at` (default: the end) and selects it. */
    addRule(state, action: PayloadAction<{ readonly rule?: LootFilterRule; readonly at?: number } | undefined>): State {
      return editRules(state, (rules) => {
        const at = action.payload?.at;
        const index = at === undefined || !Number.isInteger(at) ? rules.length : Math.min(Math.max(at, 0), rules.length);
        const next = [...rules];
        next.splice(index, 0, action.payload?.rule ?? {});
        return { rules: next, selectedRule: index };
      });
    },

    /** Replaces a whole rule. */
    updateRule(state, action: PayloadAction<{ readonly index: number; readonly rule: LootFilterRule }>): State {
      const { index, rule } = action.payload;
      return editRules(state, (rules) => {
        if (!isIndex(index, rules.length)) return undefined;
        const next = [...rules];
        next[index] = rule;
        return { rules: next };
      });
    },

    /** Shallow-merges into a rule; an `undefined` value removes the key (and a same-named passthrough key). */
    patchRule(state, action: PayloadAction<{ readonly index: number; readonly patch: ShallowPatch<LootFilterRule> }>): State {
      const { index, patch } = action.payload;
      return editRules(state, (rules) => {
        if (!isIndex(index, rules.length)) return undefined;
        const next = [...rules];
        next[index] = applyPatch(rules[index], patch);
        return { rules: next };
      });
    },

    /**
     * Switches a rule off or on. A disabled rule keeps its place in `rules` (indices and the selection stay put) and is
     * written to `disabledRules`; the flag is not a rule key, so the rule's passthrough is untouched. Same value: no-op.
     */
    setRuleDisabled(state, action: PayloadAction<{ readonly index: number; readonly disabled: boolean }>): State {
      const { index, disabled } = action.payload;
      return editRules(state, (rules) => {
        if (!isIndex(index, rules.length) || (rules[index].disabled === true) === disabled) return undefined;
        const next = [...rules];
        const { disabled: _flag, ...rule } = rules[index];
        next[index] = disabled ? { ...rule, disabled: true } : rule;
        return { rules: next };
      });
    },

    removeRule(state, action: PayloadAction<number>): State {
      const index = action.payload;
      const selected = state.editor.selectedRule;
      return editRules(state, (rules) => {
        if (!isIndex(index, rules.length)) return undefined;
        let selectedRule = selected;
        if (selected === index) selectedRule = null;
        else if (selected !== null && selected > index) selectedRule = selected - 1;
        return { rules: rules.filter((_, position) => position !== index), selectedRule };
      });
    },

    /** Moves a rule; out-of-range or equal indices are a no-op. The selection follows the rules it pointed at. */
    moveRule(state, action: PayloadAction<{ readonly from: number; readonly to: number }>): State {
      const { from, to } = action.payload;
      const selected = state.editor.selectedRule;
      return editRules(state, (rules) => {
        if (from === to || !isIndex(from, rules.length) || !isIndex(to, rules.length)) return undefined;
        const next = [...rules];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        let selectedRule = selected;
        if (selected === from) selectedRule = to;
        else if (selected !== null && from < selected && selected <= to) selectedRule = selected - 1;
        else if (selected !== null && to <= selected && selected < from) selectedRule = selected + 1;
        return { rules: next, selectedRule };
      });
    },

    /** Inserts a copy right after the rule and selects the copy (a disabled rule's copy is disabled too). */
    duplicateRule(state, action: PayloadAction<number>): State {
      const index = action.payload;
      return editRules(state, (rules) => {
        if (!isIndex(index, rules.length)) return undefined;
        const next = [...rules];
        next.splice(index + 1, 0, rules[index]);
        return { rules: next, selectedRule: index + 1 };
      });
    },

    /** Selects a rule (or none). Not an edit: `dirty` is unchanged. */
    selectRule(state, action: PayloadAction<number | null>): State {
      const index = action.payload;
      const count = state.editor.filter?.rules.length ?? 0;
      const selectedRule = index !== null && isIndex(index, count) ? index : null;
      return selectedRule === state.editor.selectedRule ? state : withEditor(state, { selectedRule });
    },

    // ----- editor: styles -----

    /** Adds a style at the end, or replaces an existing one in place. */
    setStyle(state, action: PayloadAction<{ readonly name: string; readonly style: LootFilterStyle }>): State {
      const { name, style } = action.payload;
      return editFilter(state, (filter) => (name === '' ? undefined : { ...filter, styles: { ...filter.styles, [name]: style } }));
    },

    /** Renames a style in place and points the rules that used the old name at the new one. No-op when `to` is taken or empty. */
    renameStyle(state, action: PayloadAction<{ readonly from: string; readonly to: string }>): State {
      const { from, to } = action.payload;
      return editFilter(state, (filter) => {
        const styles = filter.styles;
        if (!styles || !Object.hasOwn(styles, from) || to === '' || Object.hasOwn(styles, to)) return undefined;
        const renamed = Object.fromEntries(Object.entries(styles).map(([name, style]) => [name === from ? to : name, style]));
        const rules = filter.rules.map((rule) => (rule.useStyle === from ? { ...rule, useStyle: to } : rule));
        return { ...filter, styles: renamed, rules };
      });
    },

    /** Removes a style; rules that use it keep the name (the validator reports it). An empty `styles` is dropped. */
    removeStyle(state, action: PayloadAction<string>): State {
      const name = action.payload;
      return editFilter(state, (filter) => {
        if (!filter.styles || !Object.hasOwn(filter.styles, name)) return undefined;
        const styles = Object.fromEntries(Object.entries(filter.styles).filter(([key]) => key !== name));
        return applyPatch(filter, { styles: nonEmpty(styles) });
      });
    },

    // ----- editor: whole filter -----

    /** The JSON tab's "Apply": a freshly parsed filter, its parse diagnostics and the applied text's notes. */
    replaceFilter(
      state,
      action: PayloadAction<{
        readonly filter: LootFilter;
        readonly diagnostics: readonly Diagnostic[];
        readonly notes?: readonly Diagnostic[];
      }>
    ): State {
      if (state.editor.target === null) return state;
      const { filter, diagnostics, notes = [] } = action.payload;
      const selected = state.editor.selectedRule;
      const selectedRule = selected !== null && isIndex(selected, filter.rules.length) ? selected : null;
      return withEditor(state, { filter, parseDiagnostics: diagnostics, textNotes: notes, selectedRule, dirty: true });
    },
  },
});

export const {
  hydrate,
  createBlank,
  importText,
  duplicate,
  rename,
  remove,
  editorFlushed,
  flushNow,
  open,
  openSaved,
  openSandbox,
  close,
  saveSucceeded,
  savedFilterRenamed,
  discardChanges,
  copyToMyFilters,
  takeUpdate,
  setHeader,
  setFilterLevels,
  renumberLevel,
  setNotifications,
  setQualityColors,
  addRule,
  updateRule,
  patchRule,
  setRuleDisabled,
  removeRule,
  moveRule,
  duplicateRule,
  selectRule,
  setStyle,
  renameStyle,
  removeStyle,
  replaceFilter,
} = lootFilterSlice.actions;

export default lootFilterSlice.reducer;

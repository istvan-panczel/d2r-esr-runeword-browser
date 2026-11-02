import { describe, expect, it } from 'vitest';
import type { UnknownAction } from '@reduxjs/toolkit';
import type { LootFilterRow } from '@/core/supabase/types';
import { parseLootFilter } from '../engine/parse';
import { serializeLootFilter } from '../engine/serialize';
import type { LootFilter } from '../engine/types';
import { createBlankFilter } from '../utils/blankFilter';
import { templateBasedOn } from '../utils/basedOn';
import reducer, {
  EMPTY_EDITOR,
  close,
  copyToMyFilters,
  discardChanges,
  duplicate,
  editorFlushed,
  flushNow,
  hydrate,
  importText,
  initialState,
  open,
  openSandbox,
  openSaved,
  replaceFilter,
  saveSucceeded,
  selectRule,
  setHeader,
  takeUpdate,
  type OpenSavedInput,
} from './lootFilterSlice';
import {
  selectEditorName,
  selectEditorText,
  selectHasUnsavedChanges,
  selectSaveRequest,
  selectVisibleDrafts,
  type LootFilterSaveRequest,
} from './selectors';
import { lootFilterRow } from './testRow.mock';
import type { EditorTarget, LootFilterEntry, LootFilterState } from './types';

const NOW = 1_000;
const LATER = 2_000;
const OWNER = 'owner-1';
const OTHER = 'other-2';

const FILTER: LootFilter = { ...createBlankFilter('Shared'), rules: [{ comment: 'a' }, { comment: 'b' }] };
/** The saved content as uploaded: a comment and a layout the editor would not write. */
const CONTENT = `// Shared filter\n${JSON.stringify(JSON.parse(serializeLootFilter(FILTER)))}`;
const CANONICAL = serializeLootFilter(parseLootFilter(CONTENT).filter);

const row = (overrides: Partial<LootFilterRow> = {}): LootFilterRow => lootFilterRow({ content: CONTENT, rule_count: 2, ...overrides });

function entry(id: string, overrides: Partial<LootFilterEntry> = {}): LootFilterEntry {
  return { id, name: id, source: 'upload', createdAt: NOW, updatedAt: NOW, text: serializeLootFilter(createBlankFilter(id)), ...overrides };
}

function run(state: LootFilterState, ...actions: UnknownAction[]): LootFilterState {
  return actions.reduce(reducer, state);
}

const at = <T extends UnknownAction & { payload: object }>(action: T, now = NOW): UnknownAction => ({
  ...action,
  payload: { ...action.payload, now },
});

function openSavedAction(input: Partial<OpenSavedInput> = {}, draftId = 'new-draft'): UnknownAction {
  const action = openSaved({ row: row(), viewerId: OWNER, authorLabel: 'Owner#1', ...input });
  return { ...action, payload: { ...action.payload, draftId, now: NOW } };
}

function savedState(entries: readonly LootFilterEntry[] = [], input: Partial<OpenSavedInput> = {}): LootFilterState {
  return run(initialState, hydrate(entries), openSavedAction(input));
}

const wrap = (state: LootFilterState) => ({ lootFilter: state });
const entryById = (state: LootFilterState, id: string) => state.library.entries.find((candidate) => candidate.id === id);
const titleOf = (text: string | undefined) => (text === undefined ? undefined : parseLootFilter(text).filter.title);

describe('openSaved', () => {
  it('gives the owner the saved target on the content, without writing a draft', () => {
    const state = savedState();
    expect(state.editor.target).toEqual({
      kind: 'saved',
      savedId: 'row-1',
      revision: 3,
      ownerId: OWNER,
      name: 'Shared',
      baseText: CONTENT,
      baseCanonical: CANONICAL,
      draftId: 'new-draft',
      basedOn: null,
    } satisfies EditorTarget);
    expect(state.editor.filter?.rules).toHaveLength(2);
    expect(state.editor.dirty).toBe(false);
    expect(state.library.entries).toEqual([]);
  });

  it("opens the owner's existing draft of it instead (the newest one; another account's is ignored)", () => {
    const mine = entry('d1', {
      savedId: 'row-1',
      savedOwnerId: OWNER,
      savedRevision: 2,
      text: serializeLootFilter(createBlankFilter('Mine')),
    });
    const newer = { ...mine, id: 'd2', updatedAt: LATER, text: serializeLootFilter(createBlankFilter('Newer')) };
    const theirs = { ...mine, id: 'd3', savedOwnerId: OTHER, updatedAt: LATER * 2 };
    const state = savedState([mine, newer, theirs]);
    expect(state.editor.target).toMatchObject({ kind: 'saved', draftId: 'd2', revision: 3 });
    expect(state.editor.filter?.title).toBe('Newer');
  });

  it('gives everyone else the sandbox, labelled for a copy', () => {
    for (const viewerId of [OTHER, null]) {
      const state = savedState([], { viewerId });
      expect(state.editor.target).toEqual({
        kind: 'sandbox',
        savedId: 'row-1',
        revision: 3,
        ownerId: OWNER,
        name: 'Shared',
        baseText: CONTENT,
        basedOn: { id: 'row-1', revision: 3, label: 'Shared by Owner#1' },
      } satisfies EditorTarget);
    }
  });

  it('a private filter in the sandbox records no source', () => {
    const state = savedState([], { viewerId: OTHER, row: row({ is_private: true }) });
    expect(state.editor.target).toMatchObject({ kind: 'sandbox', basedOn: null });
  });

  it('keeps the based_on columns on the saved target, and gives template-based content no text notes', () => {
    const template = row({ based_on_template: 'sullys-qol', based_on_version: '0.6.11', based_on_label: "Sully's QoL Filter v0.6.11" });
    const state = savedState([], { row: template });
    expect(state.editor.target).toMatchObject({ basedOn: templateBasedOn('0.6.11') });
    expect(state.editor.textNotes).toEqual([]);
  });

  it('an unreadable content has no canonical text and no model', () => {
    const state = savedState([], { row: row({ content: '{ broken' }) });
    expect(state.editor.target).toMatchObject({ kind: 'saved', baseCanonical: null });
    expect(state.editor.filter).toBeNull();
  });

  it('flushes the previously open draft first', () => {
    const state = run(initialState, hydrate([entry('one')]), at(open('one')), setHeader({ title: 'Kept' }), openSavedAction());
    expect(titleOf(entryById(state, 'one')?.text)).toBe('Kept');
  });
});

describe('saved target flush', () => {
  it('creates the draft on the first edit, updates it after, and removes it when the text is the content again', () => {
    const edited = run(savedState(), setHeader({ title: 'Edited' }), at(editorFlushed()));
    expect(edited.editor.dirty).toBe(false);
    expect(edited.library.entries).toEqual([
      {
        id: 'new-draft',
        name: 'Shared',
        source: 'upload',
        createdAt: NOW,
        updatedAt: NOW,
        text: serializeLootFilter({ ...parseLootFilter(CONTENT).filter, title: 'Edited' }),
        savedId: 'row-1',
        savedOwnerId: OWNER,
        savedRevision: 3,
      },
    ]);

    const again = run(edited, setHeader({ author: 'Me' }), at(editorFlushed(), LATER));
    expect(again.library.entries).toHaveLength(1);
    expect(again.library.entries[0]).toMatchObject({ id: 'new-draft', createdAt: NOW, updatedAt: LATER });

    const back = run(again, setHeader({ title: 'Shared', author: undefined }), at(editorFlushed()));
    expect(back.library.entries).toEqual([]);
    expect(back.editor.dirty).toBe(false);
  });

  it("records the saved filter's based_on in the new draft", () => {
    const basedOn = { id: 'src', revision: 1, label: 'X by Y#2' };
    const state = run(
      savedState([], { row: row({ based_on_id: 'src', based_on_revision: 1, based_on_label: 'X by Y#2' }) }),
      setHeader({ title: 'E' }),
      at(flushNow())
    );
    expect(state.library.entries[0]?.basedOn).toEqual(basedOn);
  });

  it('flushNow is the same synchronous flush', () => {
    const state = run(savedState(), setHeader({ title: 'Now' }), at(flushNow()));
    expect(titleOf(state.library.entries[0]?.text)).toBe('Now');
    expect(state.editor.dirty).toBe(false);
  });

  it('close flushes into the draft', () => {
    const state = run(savedState(), setHeader({ title: 'Closed' }), at(close()));
    expect(state.editor).toEqual(EMPTY_EDITOR);
    expect(titleOf(state.library.entries[0]?.text)).toBe('Closed');
  });
});

describe('sandbox', () => {
  it('never writes: not on flush, not on close', () => {
    const sandbox = savedState([], { viewerId: OTHER });
    const edited = run(sandbox, setHeader({ title: 'Tweaked' }), at(editorFlushed()), at(flushNow()));
    expect(edited.library).toBe(sandbox.library);
    expect(edited.editor.dirty).toBe(true);
    expect(run(edited, at(close())).library).toBe(sandbox.library);
  });

  it('openSandbox opens a text that is not saved anywhere', () => {
    const text = serializeLootFilter(FILTER);
    const state = run(initialState, hydrate([]), at(openSandbox({ text, name: "Sully's", basedOn: templateBasedOn() })));
    expect(state.editor.target).toEqual({
      kind: 'sandbox',
      savedId: null,
      revision: null,
      ownerId: null,
      name: "Sully's",
      baseText: text,
      basedOn: templateBasedOn(),
    } satisfies EditorTarget);
    expect(state.editor.filter?.rules).toHaveLength(2);
  });

  it('discardChanges goes back to the original text', () => {
    const state = run(savedState([], { viewerId: OTHER }), setHeader({ title: 'Tweaked' }), discardChanges());
    expect(state.editor.dirty).toBe(false);
    expect(state.editor.filter?.title).toBe('Shared');
  });
});

describe('copyToMyFilters', () => {
  it('copies the original text verbatim when unchanged and switches the editor to the new draft', () => {
    const sandbox = run(savedState([], { viewerId: OTHER }), selectRule(1));
    const state = run(sandbox, at(copyToMyFilters()));
    const action = copyToMyFilters();
    expect(action.payload.id).not.toBe('');
    const copy = state.library.entries[0];
    expect(copy).toMatchObject({
      name: 'Shared',
      source: 'upload',
      text: CONTENT,
      basedOn: { id: 'row-1', revision: 3, label: 'Shared by Owner#1' },
    });
    expect(state.editor.target).toEqual({ kind: 'draft', entryId: copy.id });
    expect(state.editor.selectedRule).toBe(1);
    expect(state.editor.filter).toBe(sandbox.editor.filter);
  });

  it('copies the edited model', () => {
    const state = run(savedState([], { viewerId: OTHER }), setHeader({ title: 'Tweaked' }), {
      ...copyToMyFilters(),
      payload: { id: 'c', now: NOW },
    });
    expect(titleOf(entryById(state, 'c')?.text)).toBe('Tweaked');
    expect(state.editor.dirty).toBe(false);
  });

  it('records no source for a private filter, the template for the bundled one', () => {
    const fromPrivate = run(savedState([], { viewerId: OTHER, row: row({ is_private: true }) }), at(copyToMyFilters()));
    expect(fromPrivate.library.entries[0]).not.toHaveProperty('basedOn');

    const text = serializeLootFilter(FILTER);
    const fromTemplate = run(initialState, at(openSandbox({ text, name: "Sully's", basedOn: templateBasedOn() })), at(copyToMyFilters()));
    expect(fromTemplate.library.entries[0]).toMatchObject({ source: 'template', basedOn: templateBasedOn() });
  });

  it('is a no-op outside the sandbox', () => {
    const state = savedState();
    expect(reducer(state, at(copyToMyFilters()))).toBe(state);
  });
});

describe('saveSucceeded', () => {
  const sent = (state: LootFilterState): LootFilterSaveRequest => {
    const request = selectSaveRequest(wrap(state));
    if (request === null) throw new Error('nothing to save');
    return request;
  };
  const succeeded = (request: LootFilterSaveRequest, saved: LootFilterRow): UnknownAction => ({
    type: saveSucceeded.type,
    payload: { sentText: request.text, row: saved, entryId: request.entryId, draftId: 'later-draft', now: LATER },
  });

  it('a first save removes the new draft and switches the editor to the saved target, keeping the editor state', () => {
    const draft = run(
      initialState,
      hydrate([entry('d', { name: 'Mine' })]),
      at(open('d')),
      selectRule(null),
      setHeader({ title: 'T' }),
      at(flushNow())
    );
    const request = sent(draft);
    expect(request).toMatchObject({ kind: 'insert', name: 'Mine', entryId: 'd', savedId: null, expectedRevision: null, basedOn: null });
    const state = reducer(draft, succeeded(request, row({ id: 'new-row', name: 'Mine', content: request.text, revision: 1 })));
    expect(state.library.entries).toEqual([]);
    expect(state.editor.filter).toBe(draft.editor.filter);
    expect(state.editor.target).toEqual({
      kind: 'saved',
      savedId: 'new-row',
      revision: 1,
      ownerId: OWNER,
      name: 'Mine',
      baseText: request.text,
      baseCanonical: request.text,
      draftId: 'later-draft',
      basedOn: null,
    } satisfies EditorTarget);
  });

  it('keeps a draft edited (and flushed) while saving, as a draft of the new revision', () => {
    const draft = run(initialState, hydrate([entry('d')]), at(open('d')), setHeader({ title: 'Sent' }), at(flushNow()));
    const request = sent(draft);
    const later = run(draft, setHeader({ title: 'After' }), at(editorFlushed()));
    const state = reducer(later, succeeded(request, row({ id: 'new-row', content: request.text, revision: 1 })));
    expect(state.library.entries).toEqual([
      expect.objectContaining({ id: 'd', savedId: 'new-row', savedOwnerId: OWNER, savedRevision: 1 }),
    ]);
    expect(titleOf(state.library.entries[0].text)).toBe('After');
    expect(state.editor.target).toMatchObject({ kind: 'saved', draftId: 'd' });
  });

  it("an update removes the saved filter's draft and moves the base and revision on", () => {
    const edited = run(savedState(), setHeader({ title: 'V2' }), at(flushNow()));
    const request = sent(edited);
    expect(request).toMatchObject({ kind: 'update', entryId: 'new-draft', savedId: 'row-1', expectedRevision: 3, name: 'Shared' });
    const state = reducer(edited, succeeded(request, row({ content: request.text, revision: 4 })));
    expect(state.library.entries).toEqual([]);
    expect(state.editor.target).toMatchObject({
      kind: 'saved',
      revision: 4,
      baseText: request.text,
      baseCanonical: request.text,
      draftId: 'new-draft',
    });
    expect(selectHasUnsavedChanges(wrap(state))).toBe(false);
  });

  it('only touches the library when the editor has moved on', () => {
    const draft = run(initialState, hydrate([entry('d'), entry('e')]), at(open('d')), setHeader({ title: 'S' }), at(flushNow()));
    const request = sent(draft);
    const elsewhere = run(draft, at(open('e')));
    const state = reducer(elsewhere, succeeded(request, row({ content: request.text })));
    expect(state.library.entries.map((candidate) => candidate.id)).toEqual(['e']);
    expect(state.editor).toBe(elsewhere.editor);
  });
});

describe('discardChanges', () => {
  it("removes the saved filter's draft, clears dirty and re-parses the content", () => {
    const edited = run(savedState(), selectRule(1), setHeader({ title: 'Flushed' }), at(flushNow()), setHeader({ title: 'Pending' }));
    expect(edited.library.entries).toHaveLength(1);
    const state = reducer(edited, discardChanges());
    expect(state.library.entries).toEqual([]);
    expect(state.editor.dirty).toBe(false);
    expect(state.editor.filter?.title).toBe('Shared');
    expect(state.editor.selectedRule).toBe(1);
    // A late flush has nothing to write.
    expect(reducer(state, at(editorFlushed()))).toBe(state);
  });

  it('is a no-op on a draft target', () => {
    const state = run(initialState, hydrate([entry('d')]), at(open('d')), setHeader({ title: 'X' }));
    expect(reducer(state, discardChanges())).toBe(state);
  });
});

describe('takeUpdate', () => {
  const LATEST = serializeLootFilter({ ...FILTER, title: 'Latest' });
  const BASED_ON = { id: 'src', revision: 5, label: 'X by Y#2' };

  it('new: adds a draft named after the open filter, editor untouched', () => {
    const before = savedState();
    const state = reducer(before, { type: takeUpdate.type, payload: { text: LATEST, basedOn: BASED_ON, mode: 'new', id: 'n', now: NOW } });
    expect(state.library.entries).toEqual([
      { id: 'n', name: 'Shared', source: 'upload', createdAt: NOW, updatedAt: NOW, text: LATEST, basedOn: BASED_ON },
    ]);
    expect(state.editor).toBe(before.editor);
  });

  it('replace on a saved filter writes the draft with the new basedOn right away', () => {
    const state = run(savedState(), {
      type: takeUpdate.type,
      payload: { text: LATEST, basedOn: BASED_ON, mode: 'replace', id: 'n', now: NOW },
    });
    expect(state.library.entries).toEqual([
      expect.objectContaining({
        id: 'new-draft',
        text: LATEST,
        savedId: 'row-1',
        savedOwnerId: OWNER,
        savedRevision: 3,
        basedOn: BASED_ON,
      }),
    ]);
    expect(state.editor.filter?.title).toBe('Latest');
    expect(state.editor.dirty).toBe(false);
    expect(selectSaveRequest(wrap(state))).toMatchObject({ kind: 'update', text: LATEST, basedOn: BASED_ON, expectedRevision: 3 });
  });

  it('replace updates an existing draft (and a draft target), keeping its revision', () => {
    const draft = entry('d1', { savedId: 'row-1', savedOwnerId: OWNER, savedRevision: 2 });
    const saved = run(savedState([draft]), {
      type: takeUpdate.type,
      payload: { text: LATEST, basedOn: BASED_ON, mode: 'replace', id: 'n', now: LATER },
    });
    expect(saved.library.entries).toEqual([{ ...draft, text: LATEST, basedOn: BASED_ON, updatedAt: LATER }]);

    const local = run(initialState, hydrate([entry('d')]), at(open('d')), {
      type: takeUpdate.type,
      payload: { text: LATEST, basedOn: BASED_ON, mode: 'replace', id: 'n', now: LATER },
    });
    expect(local.library.entries[0]).toMatchObject({ id: 'd', text: LATEST, basedOn: BASED_ON });
    expect(local.editor.filter?.title).toBe('Latest');
  });

  it('replace is a no-op in the sandbox', () => {
    const sandbox = savedState([], { viewerId: OTHER });
    expect(
      reducer(sandbox, { type: takeUpdate.type, payload: { text: LATEST, basedOn: BASED_ON, mode: 'replace', id: 'n', now: NOW } })
    ).toBe(sandbox);
  });
});

describe('draft fields in library reducers', () => {
  it('duplicate copies neither the saved filter nor basedOn', () => {
    const draft = entry('d', { savedId: 'row-1', savedOwnerId: OWNER, savedRevision: 2, basedOn: templateBasedOn(), source: 'template' });
    const state = run(initialState, hydrate([draft]), { type: duplicate.type, payload: { id: 'd', newId: 'c', now: LATER } });
    expect(entryById(state, 'c')).toEqual({
      id: 'c',
      name: 'd (copy)',
      source: 'template',
      createdAt: LATER,
      updatedAt: LATER,
      text: draft.text,
    });
  });

  it("duplicate of the saved target's draft flushes it first", () => {
    const edited = run(savedState(), setHeader({ title: 'E' }), at(flushNow()), setHeader({ title: 'Pending' }));
    const state = reducer(edited, { type: duplicate.type, payload: { id: 'new-draft', newId: 'c', now: LATER } });
    expect(titleOf(entryById(state, 'c')?.text)).toBe('Pending');
  });

  it("importText records Start from Sully's basedOn", () => {
    const action = importText({ name: "Sully's", text: '{}', source: 'template', basedOn: templateBasedOn() });
    expect(reducer(initialState, action).library.entries[0].basedOn).toEqual(templateBasedOn());
  });

  it('replaceFilter works on a saved target', () => {
    const { filter, diagnostics } = parseLootFilter('{"formatVersion": 1, "title": "Applied", "rules": []}');
    const state = run(savedState(), replaceFilter({ filter, diagnostics }), at(flushNow()));
    expect(titleOf(state.library.entries[0]?.text)).toBe('Applied');
  });
});

describe('selectors', () => {
  it('selectSaveRequest: an old template draft infers basedOn; a draft of a saved filter opened as a draft updates it', () => {
    const old = run(
      initialState,
      hydrate([entry('t', { source: 'template', text: '{"formatVersion": 1, "version": "0.6.2", "rules": []}' })]),
      at(open('t'))
    );
    expect(selectSaveRequest(wrap(old))?.basedOn).toEqual(templateBasedOn('0.6.2'));

    const local = run(initialState, hydrate([entry('d', { savedId: 'row-1', savedOwnerId: OWNER, savedRevision: 2 })]), at(open('d')));
    expect(selectSaveRequest(wrap(local))).toMatchObject({ kind: 'update', savedId: 'row-1', expectedRevision: 2, entryId: 'd' });
  });

  it('selectSaveRequest is null with nothing to save', () => {
    expect(selectSaveRequest(wrap(initialState))).toBeNull();
    expect(selectSaveRequest(wrap(savedState()))).toBeNull();
    expect(selectSaveRequest(wrap(run(savedState([], { viewerId: OTHER }), setHeader({ title: 'X' }))))).toBeNull();
  });

  it('selectHasUnsavedChanges', () => {
    expect(selectHasUnsavedChanges(wrap(initialState))).toBe(false);
    expect(selectHasUnsavedChanges(wrap(run(initialState, hydrate([entry('d')]), at(open('d')))))).toBe(true);
    const saved = savedState();
    expect(selectHasUnsavedChanges(wrap(saved))).toBe(false);
    expect(selectHasUnsavedChanges(wrap(run(saved, setHeader({ title: 'X' }))))).toBe(true);
    expect(selectHasUnsavedChanges(wrap(run(saved, setHeader({ title: 'X' }), at(flushNow()))))).toBe(true);
    const sandbox = savedState([], { viewerId: OTHER });
    expect(selectHasUnsavedChanges(wrap(sandbox))).toBe(false);
    expect(selectHasUnsavedChanges(wrap(run(sandbox, setHeader({ title: 'X' }))))).toBe(true);
  });

  it('selectEditorText and selectEditorName follow the target', () => {
    const saved = savedState();
    expect(selectEditorText(wrap(saved))).toBe(CONTENT);
    expect(selectEditorName(wrap(saved))).toBe('Shared');
    const edited = run(saved, setHeader({ title: 'X' }), at(flushNow()));
    expect(titleOf(selectEditorText(wrap(edited)) ?? undefined)).toBe('X');
    const local = run(initialState, hydrate([entry('d', { name: 'Local' })]), at(open('d')));
    expect(selectEditorName(wrap(local))).toBe('Local');
    expect(selectEditorText(wrap(initialState))).toBeNull();
  });

  it("selectVisibleDrafts hides another account's drafts and flags account drafts when signed out", () => {
    const fresh = entry('fresh');
    const mine = entry('mine', { savedId: 'r1', savedOwnerId: OWNER });
    const theirs = entry('theirs', { savedId: 'r2', savedOwnerId: OTHER });
    const state = wrap(run(initialState, hydrate([fresh, mine, theirs])));
    expect(selectVisibleDrafts(state, OWNER)).toEqual([
      { entry: fresh, needsSignIn: false },
      { entry: mine, needsSignIn: false },
    ]);
    expect(selectVisibleDrafts(state, null)).toEqual([
      { entry: fresh, needsSignIn: false },
      { entry: mine, needsSignIn: true },
      { entry: theirs, needsSignIn: true },
    ]);
  });
});

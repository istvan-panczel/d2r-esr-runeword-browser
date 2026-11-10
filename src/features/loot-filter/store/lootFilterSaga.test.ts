import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import type { PersistentStorage } from '@/core/hooks/usePersistentState';
import { parseLootFilter } from '../engine/parse';
import { LIBRARY_STORAGE_KEY } from './libraryStorage';
import { EDITOR_FLUSH_DELAY_MS, createLootFilterSaga, isEditorMutation } from './lootFilterSaga';
import * as slice from './lootFilterSlice';
import reducer, {
  addRules,
  chooseRuleStyle,
  close,
  createBlank,
  discardChanges,
  flushNow,
  open,
  openSaved,
  rename,
  saveSucceeded,
  selectRule,
  setHeader,
} from './lootFilterSlice';
import { selectSaveRequest } from './selectors';
import { lootFilterRow } from './testRow.mock';
import type { LootFilterEntry } from './types';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const STORED: LootFilterEntry = {
  id: 'stored',
  name: 'Stored',
  source: 'upload',
  createdAt: 1,
  updatedAt: 1,
  text: '{"formatVersion": 1, "title": "Stored", "rules": []}',
};

interface TestStorage extends PersistentStorage {
  readonly data: Map<string, string>;
  readonly setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;
  full: boolean;
}

function testStorage(entries: readonly LootFilterEntry[] = []): TestStorage {
  const data = new Map<string, string>();
  if (entries.length > 0) data.set(LIBRARY_STORAGE_KEY, JSON.stringify({ version: 1, entries }));
  const storage: TestStorage = {
    data,
    full: false,
    getItem: (key) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      if (storage.full) throw new DOMException('full', 'QuotaExceededError');
      data.set(key, value);
    }),
  };
  return storage;
}

function setup(storage: TestStorage) {
  const onSaveFailed = vi.fn();
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { lootFilter: reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  sagaMiddleware.run(createLootFilterSaga({ storage, onSaveFailed }));
  return { store, onSaveFailed };
}

function storedEntries(storage: TestStorage): LootFilterEntry[] {
  const raw = storage.data.get(LIBRARY_STORAGE_KEY);
  if (raw === undefined) return [];
  const parsed = JSON.parse(raw) as { entries: LootFilterEntry[] };
  return parsed.entries;
}

describe('lootFilterSaga', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates the library from storage without rewriting it', () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    expect(store.getState().lootFilter.library).toEqual({ hydrated: true, entries: [STORED] });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('hydrates an empty library when nothing is stored', () => {
    const { store } = setup(testStorage());
    expect(store.getState().lootFilter.library).toEqual({ hydrated: true, entries: [] });
  });

  it('persists library changes right away', () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(createBlank('New one'));
    expect(storedEntries(storage).map((entry) => entry.name)).toEqual(['Stored', 'New one']);
    store.dispatch(rename({ id: 'stored', name: 'Renamed' }));
    expect(storedEntries(storage)[0].name).toBe('Renamed');
  });

  it('flushes editor edits into the entry text after the debounce and persists them', async () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(open('stored'));
    expect(storage.setItem).not.toHaveBeenCalled();

    store.dispatch(setHeader({ title: 'First' }));
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS - 50);
    store.dispatch(setHeader({ title: 'Second' }));
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS - 50);
    expect(store.getState().lootFilter.editor.dirty).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(store.getState().lootFilter.editor.dirty).toBe(false);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(parseLootFilter(storedEntries(storage)[0].text).filter.title).toBe('Second');
  });

  it('flushes the rules and styles the example rules dialog adds in one edit (addRules)', async () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(open('stored'));
    store.dispatch(
      addRules({
        rules: [{ comment: 'Set items', quality: 'set', useStyle: 'SetItem' }],
        styles: { SetItem: { replaceName: 'ÿc2{name}' } },
      })
    );
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS + 50);
    expect(store.getState().lootFilter.editor.dirty).toBe(false);
    const stored = parseLootFilter(storedEntries(storage)[0].text).filter;
    expect(stored.rules.map((rule) => rule.useStyle)).toEqual(['SetItem']);
    expect(Object.keys(stored.styles ?? {})).toEqual(['SetItem']);
  });

  it('flushes a style picked in the rule editor (chooseRuleStyle) and its undo', async () => {
    const storage = testStorage([
      { ...STORED, text: '{"formatVersion": 1, "title": "Stored", "rules": [{"comment": "r", "labelBackground": [1, 2, 3]}]}' },
    ]);
    const { store } = setup(storage);
    store.dispatch(open('stored'));
    store.dispatch(
      chooseRuleStyle({
        index: 0,
        patch: { useStyle: 'UniqueItem', labelBackground: undefined },
        addStyle: { name: 'UniqueItem', style: { labelBackground: [9, 9, 9] } },
      })
    );
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS + 50);
    expect(store.getState().lootFilter.editor.dirty).toBe(false);
    const stored = parseLootFilter(storedEntries(storage)[0].text).filter;
    expect(stored.rules[0]).toEqual({ comment: 'r', useStyle: 'UniqueItem' });
    expect(Object.keys(stored.styles ?? {})).toEqual(['UniqueItem']);

    store.dispatch(
      chooseRuleStyle({
        index: 0,
        patch: { useStyle: undefined, labelBackground: [1, 2, 3] },
        removeStyleIfUnused: 'UniqueItem',
        ifUseStyle: { value: 'UniqueItem' },
      })
    );
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS + 50);
    const undone = parseLootFilter(storedEntries(storage)[0].text).filter;
    expect(undone.rules[0]).toEqual({ comment: 'r', labelBackground: [1, 2, 3] });
    expect(undone.styles).toBeUndefined();
  });

  it('classifies every slice action: an editor edit starts the flush, the rest are known non-edits', () => {
    // A new reducer that edits the open filter must be added to `isEditorMutation` (else its edit is only kept in
    // memory until another edit flushes it); one that does not goes here.
    const notEditorEdits = new Set([
      'hydrate',
      'createBlank',
      'importText',
      'duplicate',
      'rename',
      'remove',
      'editorFlushed',
      'flushNow',
      'open',
      'openSaved',
      'openSandbox',
      'close',
      'saveSucceeded',
      'savedFilterRenamed',
      'discardChanges',
      'copyToMyFilters',
      'takeUpdate',
      'selectRule',
      'foldSelection',
    ]);
    // The module's action creators (functions with a `type` and `match`), by export name.
    const creators: (readonly [string, string])[] = [];
    for (const [name, value] of Object.entries(slice) as [string, unknown][])
      if (typeof value === 'function' && 'match' in value && 'type' in value && typeof value.type === 'string')
        creators.push([name, value.type]);
    expect(creators.length).toBeGreaterThan(notEditorEdits.size);
    const unclassified = creators.filter(([name, type]) => notEditorEdits.has(name) === isEditorMutation({ type })).map(([name]) => name);
    expect(unclassified).toEqual([]);
  });

  it('selecting a rule is not an edit', async () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(open('stored'));
    store.dispatch(selectRule(null));
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS * 2);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('close persists pending edits without waiting for the debounce', () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(open('stored'));
    store.dispatch(setHeader({ author: 'Me' }));
    store.dispatch(close());
    expect(parseLootFilter(storedEntries(storage)[0].text).filter.author).toBe('Me');
  });

  it('close cancels the pending debounced flush: the timer does not write again', async () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(open('stored'));
    store.dispatch(setHeader({ author: 'Me' }));
    store.dispatch(close());
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS * 2);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(parseLootFilter(storedEntries(storage)[0].text).filter.author).toBe('Me');
  });

  it('reports a full storage once and keeps working', () => {
    const storage = testStorage([STORED]);
    const { store, onSaveFailed } = setup(storage);
    storage.full = true;
    store.dispatch(createBlank('A'));
    store.dispatch(createBlank('B'));
    expect(onSaveFailed).toHaveBeenCalledTimes(1);
    expect(store.getState().lootFilter.library.entries).toHaveLength(3);

    storage.full = false;
    store.dispatch(createBlank('C'));
    expect(storedEntries(storage)).toHaveLength(4);

    storage.full = true;
    store.dispatch(createBlank('D'));
    expect(onSaveFailed).toHaveBeenCalledTimes(2);
  });
});

describe('lootFilterSaga with a saved filter', () => {
  const OWNER = 'owner-1';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** What the save saga will do: flush, read the request, then report the row the server returned. */
  function save(store: ReturnType<typeof setup>['store'], revision: number) {
    store.dispatch(flushNow());
    const request = selectSaveRequest(store.getState());
    if (request === null) throw new Error('nothing to save');
    store.dispatch(
      saveSucceeded({ sentText: request.text, row: lootFilterRow({ content: request.text, revision }), entryId: request.entryId })
    );
    return request;
  }

  it('the debounced flush pending when Save ran does not re-create the removed draft', async () => {
    const storage = testStorage();
    const { store } = setup(storage);
    store.dispatch(openSaved({ row: lootFilterRow(), viewerId: OWNER, authorLabel: 'Owner#1' }));
    store.dispatch(setHeader({ title: 'Edited' }));
    save(store, 4);
    expect(store.getState().lootFilter.library.entries).toEqual([]);
    expect(storedEntries(storage)).toEqual([]);

    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS * 2);
    expect(store.getState().lootFilter.library.entries).toEqual([]);
    expect(storedEntries(storage)).toEqual([]);
    expect(store.getState().lootFilter.editor.target).toMatchObject({ kind: 'saved', revision: 4 });
  });

  it('edits made while saving flush into a draft of the new revision', async () => {
    const storage = testStorage();
    const { store } = setup(storage);
    store.dispatch(openSaved({ row: lootFilterRow(), viewerId: OWNER, authorLabel: 'Owner#1' }));
    store.dispatch(setHeader({ title: 'Sent' }));
    store.dispatch(flushNow());
    const request = selectSaveRequest(store.getState());
    if (request === null) throw new Error('nothing to save');
    store.dispatch(setHeader({ title: 'While saving' }));
    store.dispatch(
      saveSucceeded({ sentText: request.text, row: lootFilterRow({ content: request.text, revision: 4 }), entryId: request.entryId })
    );
    expect(storedEntries(storage)).toEqual([]);

    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS);
    const [draft] = storedEntries(storage);
    expect(draft).toMatchObject({ savedId: 'row-1', savedOwnerId: OWNER, savedRevision: 4 });
    expect(parseLootFilter(draft.text).filter.title).toBe('While saving');
  });

  it('Discard changes wins over the pending debounced flush', async () => {
    const storage = testStorage();
    const { store } = setup(storage);
    store.dispatch(openSaved({ row: lootFilterRow(), viewerId: OWNER, authorLabel: 'Owner#1' }));
    store.dispatch(setHeader({ title: 'First' }));
    store.dispatch(flushNow());
    expect(storedEntries(storage)).toHaveLength(1);
    store.dispatch(setHeader({ title: 'Second' }));
    store.dispatch(discardChanges());
    expect(storedEntries(storage)).toEqual([]);

    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS * 2);
    expect(storedEntries(storage)).toEqual([]);
    expect(store.getState().lootFilter.editor.filter?.title).toBe('Shared');
  });

  it('a first save of a new draft removes it from storage', () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(open('stored'));
    store.dispatch(setHeader({ author: 'Me' }));
    const request = save(store, 1);
    expect(request.kind).toBe('insert');
    expect(storedEntries(storage)).toEqual([]);
  });

  it('the sandbox never writes the library', async () => {
    const storage = testStorage([STORED]);
    const { store } = setup(storage);
    store.dispatch(openSaved({ row: lootFilterRow(), viewerId: 'someone-else', authorLabel: 'Owner#1' }));
    store.dispatch(setHeader({ title: 'Tweaked' }));
    await vi.advanceTimersByTimeAsync(EDITOR_FLUSH_DELAY_MS * 2);
    store.dispatch(close());
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

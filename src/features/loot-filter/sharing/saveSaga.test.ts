import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

interface Result {
  data?: unknown;
  error: { message: string; code?: string } | null;
}

// Mock Supabase client: a chainable builder per from(table) that logs its calls. An insert ends with single()
// (`insertQueue` first, one result per insert, then `insertResult`), an update is awaited after select() (`updateResult`), maybeSingle() is the conflict lookup and the
// source fetch (`lookupResult`). Anything else awaited resolves to an empty list.
const mocks = vi.hoisted(() => {
  type Call = { table: string; method: string; args: unknown[] };
  const state = {
    insertResult: { data: null, error: null } as Result,
    insertQueue: [] as Result[],
    updateResult: { data: [], error: null } as Result,
    lookupResult: { data: null, error: null } as Result,
    calls: [] as Call[],
  };
  const CHAIN = ['select', 'eq', 'ilike', 'order', 'or', 'limit', 'in', 'insert', 'delete', 'update'];
  function makeBuilder(table: string) {
    const own: string[] = [];
    const builder: Record<string, unknown> = {};
    for (const method of CHAIN) {
      builder[method] = (...args: unknown[]) => {
        own.push(method);
        state.calls.push({ table, method, args });
        return builder;
      };
    }
    builder.single = () => {
      state.calls.push({ table, method: 'single', args: [] });
      return Promise.resolve(state.insertQueue.shift() ?? state.insertResult);
    };
    builder.maybeSingle = () => {
      state.calls.push({ table, method: 'maybeSingle', args: [] });
      return Promise.resolve(state.lookupResult);
    };
    builder.then = (resolve: (value: unknown) => void) => {
      void Promise.resolve(own.includes('update') ? state.updateResult : { data: [], error: null }).then(resolve);
    };
    return builder;
  }
  const client = {
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  };
  return { client, state };
});

vi.mock('@/core/supabase', () => ({
  requireSupabase: () => mocks.client,
  isSupabaseConfigured: true,
}));

vi.mock('@/core/db', () => ({
  db: { metadata: { get: vi.fn(() => Promise.resolve({ key: 'esrVersion', value: '3.2.24' })) } },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { RequestState } from '@/core/types';
import authReducer, { authStateChanged, profileLoaded } from '@/features/auth/store/authSlice';
import { serializeLootFilter } from '../engine/serialize';
import lootFilterReducer, { importText, open, openSaved, setHeader } from '../store/lootFilterSlice';
import { LOOT_FILTER_PLUGIN_VERSION } from '../utils/template';
import { templateBasedOn } from '../utils/basedOn';
import { lootFilterSharingSaga } from './sharingSaga';
import sharingReducer, {
  fetchSourceFilterRequested,
  fetchSourceRevisionsSuccess,
  saveFilterRequested,
  updateFilterDetailsRequested,
} from './sharingSlice';
import {
  LOOT_FILTER_LIMIT_MESSAGE,
  SAVE_CONFLICT_MESSAGES,
  basedOnMoved,
  checkDetails,
  checkSaveText,
  insertBasedOnColumns,
  saveErrorMessage,
} from './saveSaga';
import { SHARED_FILTER_DETAIL_SELECT } from './sharingQuery';
import { OTHER_USER_ID, VIEWER_ID, filterId, makeDetail, makeDetailRow } from './sharing.mock';
import { detailToRow } from './sharingQuery';

const A = filterId(1);
const B = filterId(2);
const TEXT = '{ "formatVersion": 1, "title": "Mine", "rules": [{ "codes": ["r01"] }] }';

function setupStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { auth: authReducer, lootFilter: lootFilterReducer, lootFilterSharing: sharingReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }).concat(sagaMiddleware),
  });
  sagaMiddleware.run(lootFilterSharingSaga);
  return store;
}
type Store = ReturnType<typeof setupStore>;

function signedInStore(): Store {
  const store = setupStore();
  store.dispatch(authStateChanged({ user: { id: VIEWER_ID, email: null } }));
  return store;
}

/** Adds a new draft with `text` and opens it. */
function openNewDraft(store: Store, text = TEXT, basedOn?: ReturnType<typeof templateBasedOn>): string {
  const action = store.dispatch(importText({ name: 'My draft', text, source: basedOn ? 'template' : 'upload', basedOn }));
  store.dispatch(open(action.payload.id));
  return action.payload.id;
}

/** Opens the viewer's saved filter A (revision 3) and edits it, without letting any debounced flush run. */
function openEditedSaved(store: Store) {
  const row = detailToRow(makeDetail(A, { user_id: VIEWER_ID, content: TEXT, revision: 3 }));
  store.dispatch(openSaved({ row, viewerId: VIEWER_ID, authorLabel: 'Me#1111' }));
  store.dispatch(setHeader({ title: 'Edited' }));
}

const editor = (store: Store) => store.getState().lootFilter.editor;
const save = (store: Store) => store.getState().lootFilterSharing.save;

function callsOf(method: string): unknown[][] {
  return mocks.state.calls.filter((call) => call.table === 'loot_filters' && call.method === method).map((call) => call.args);
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.insertResult = { data: null, error: null };
  mocks.state.insertQueue = [];
  mocks.state.updateResult = { data: [], error: null };
  mocks.state.lookupResult = { data: null, error: null };
  mocks.state.calls = [];
});

describe('pure checks', () => {
  it('checkSaveText accepts a filter, rejects unreadable text and other format versions', () => {
    expect(checkSaveText(TEXT)).toBeNull();
    // Validator errors do not block (an unknown style is an error, a rule key typo a warning).
    expect(checkSaveText('{ "formatVersion": 1, "rules": [{ "useStyle": "missing" }] }')).toBeNull();
    expect(checkSaveText('{ "formatVersion": 1, ')).toMatch(/cannot be read/);
    expect(checkSaveText('{ "formatVersion": 2, "rules": [] }')).toMatch(/formatVersion/);
    expect(checkSaveText('{ "rules": [] }')).toMatch(/formatVersion/);
    expect(checkSaveText('[1, 2]')).toMatch(/formatVersion/);
    expect(checkSaveText(`{ "formatVersion": 1, "rules": [], "description": "${'x'.repeat(512 * 1024)}" }`)).toMatch(/512 KB/);
  });

  it('checkDetails enforces the name and description limits', () => {
    expect(checkDetails({ name: 'Ok', description: '' })).toBeNull();
    expect(checkDetails({ name: '   ', description: '' })).toMatch(/name/);
    expect(checkDetails({ name: 'x'.repeat(101), description: '' })).toMatch(/100/);
    expect(checkDetails({ name: 'Ok', description: 'x'.repeat(2001) })).toMatch(/2000/);
  });

  it('basedOnMoved compares revision, version and label', () => {
    const shared = { id: B, revision: 2, label: 'X by Y#1' };
    expect(basedOnMoved(null, shared)).toBe(false);
    expect(basedOnMoved(shared, shared)).toBe(false);
    expect(basedOnMoved({ ...shared, revision: 3 }, shared)).toBe(true);
    expect(basedOnMoved(shared, undefined)).toBe(true);
    expect(basedOnMoved(templateBasedOn('0.7.0'), templateBasedOn('0.6.11'))).toBe(true);
  });

  it('insertBasedOnColumns drops the id of a source the lookup found gone, keeping the rest', () => {
    const shared = { id: B, revision: 2, label: 'X by Y#1' };
    expect(insertBasedOnColumns(shared, {})).toMatchObject({ based_on_id: B, based_on_revision: 2, based_on_label: 'X by Y#1' });
    expect(insertBasedOnColumns(shared, { [B]: { id: B, revision: 3, change_note: null, name: 'X' } }).based_on_id).toBe(B);
    expect(insertBasedOnColumns(shared, { [B]: null })).toEqual({
      based_on_id: null,
      based_on_revision: 2,
      based_on_template: null,
      based_on_version: null,
      based_on_label: 'X by Y#1',
    });
    expect(insertBasedOnColumns(null, { [B]: null }).based_on_id).toBeNull();
  });

  it('saveErrorMessage turns the cap trigger into the 50-filter message', () => {
    expect(saveErrorMessage(new Error('loot_filter_limit: 50'))).toBe(LOOT_FILTER_LIMIT_MESSAGE);
    expect(saveErrorMessage(new Error('boom'))).toBe('Could not save the filter: boom');
  });
});

describe('saveFilterRequested: gating', () => {
  it('signed out: opens the sign-in dialog and writes nothing', async () => {
    const store = setupStore();
    openNewDraft(store);
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(store.getState().auth.signInDialogOpen).toBe(true);
    expect(save(store).status).toBe(RequestState.IDLE);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('without the privacy policy accepted: fails and writes nothing', async () => {
    const store = signedInStore();
    store.dispatch(
      profileLoaded({
        id: VIEWER_ID,
        display_name: 'Me',
        discriminator: 1111,
        avatar_url: null,
        privacy_policy_accepted_at: null,
        created_at: '',
        updated_at: '',
      })
    );
    openNewDraft(store);
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store).status).toBe(RequestState.ERROR);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('nothing to save (a saved filter without edits): cancelled, no request', async () => {
    const store = signedInStore();
    const row = detailToRow(makeDetail(A, { user_id: VIEWER_ID, content: TEXT }));
    store.dispatch(openSaved({ row, viewerId: VIEWER_ID, authorLabel: 'Me#1111' }));
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store).status).toBe(RequestState.IDLE);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('a file that cannot be read is not saved', async () => {
    const store = signedInStore();
    openNewDraft(store, '{ "formatVersion": 1, "rules": [');
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store)).toMatchObject({ status: RequestState.ERROR, conflict: null });
    expect(save(store).error).toMatch(/cannot be read/);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('a file with another formatVersion is not saved', async () => {
    const store = signedInStore();
    openNewDraft(store, '{ "formatVersion": 2, "rules": [] }');
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store).error).toMatch(/formatVersion/);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });
});

describe('saveFilterRequested: insert', () => {
  it('inserts a new draft with its details, metadata and versions; the editor moves to the saved row', async () => {
    const store = signedInStore();
    const draftId = openNewDraft(store, TEXT, templateBasedOn('0.6.11'));
    mocks.state.insertResult = {
      data: makeDetailRow(A, { user_id: VIEWER_ID, content: TEXT, name: 'Saved', is_private: true }),
      error: null,
    };

    store.dispatch(saveFilterRequested({ mode: 'normal', details: { name: ' Saved ', description: ' About ', isPrivate: true } }));
    await settle();

    const [[inserted]] = callsOf('insert') as [[Record<string, unknown>]];
    expect(inserted).toEqual({
      user_id: VIEWER_ID,
      name: 'Saved',
      description: 'About',
      content: TEXT,
      is_private: true,
      title: 'Mine',
      author: null,
      file_version: null,
      rule_count: 1,
      levels: null,
      esr_version: '3.2.24',
      plugin_version: LOOT_FILTER_PLUGIN_VERSION,
      change_note: null,
      based_on_id: null,
      based_on_revision: null,
      based_on_template: 'sullys-qol',
      based_on_version: '0.6.11',
      based_on_label: "Sully's QoL Filter v0.6.11",
    });
    expect(callsOf('select')).toContainEqual([SHARED_FILTER_DETAIL_SELECT]);
    expect(save(store)).toMatchObject({ status: RequestState.SUCCESS, savedId: A });
    expect(editor(store).target).toMatchObject({ kind: 'saved', savedId: A, ownerId: VIEWER_ID });
    // The draft is gone (its text was what was saved); the row is the detail and heads My filters.
    expect(store.getState().lootFilter.library.entries.some((entry) => entry.id === draftId)).toBe(false);
    expect(store.getState().lootFilterSharing.detail?.id).toBe(A);
    expect(store.getState().lootFilterSharing.myFilters.map((item) => item.id)).toEqual([A]);
  });

  it('defaults to the draft name, no description and public', async () => {
    const store = signedInStore();
    openNewDraft(store);
    mocks.state.insertResult = { data: makeDetailRow(A, { user_id: VIEWER_ID, content: TEXT }), error: null };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    const [[inserted]] = callsOf('insert') as [[Record<string, unknown>]];
    expect(inserted).toMatchObject({ name: 'My draft', description: null, is_private: false });
  });

  it('a copy whose source was deleted: retries once without based_on_id and keeps the label', async () => {
    const store = signedInStore();
    const basedOn = { id: B, revision: 2, label: 'Source by Hero#4242' };
    const action = store.dispatch(importText({ name: 'Copy', text: TEXT, source: 'upload', basedOn }));
    store.dispatch(open(action.payload.id));
    mocks.state.insertQueue = [
      { data: null, error: { message: 'insert or update on table "loot_filters" violates foreign key constraint', code: '23503' } },
      { data: makeDetailRow(A, { user_id: VIEWER_ID, content: TEXT, based_on_label: basedOn.label, based_on_revision: 2 }), error: null },
    ];
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    const inserts = callsOf('insert') as [Record<string, unknown>][];
    expect(inserts.map(([row]) => row.based_on_id)).toEqual([B, null]);
    expect(inserts[1][0]).toMatchObject({ based_on_revision: 2, based_on_label: basedOn.label });
    expect(save(store)).toMatchObject({ status: RequestState.SUCCESS, savedId: A });
  });

  it('a copy whose source the lookup found gone is inserted without based_on_id at once', async () => {
    const store = signedInStore();
    store.dispatch(fetchSourceRevisionsSuccess({ viewerId: VIEWER_ID, requestedIds: [B], rows: [] }));
    const action = store.dispatch(importText({ name: 'Copy', text: TEXT, source: 'upload', basedOn: { id: B, revision: 2, label: 'S' } }));
    store.dispatch(open(action.payload.id));
    mocks.state.insertResult = { data: makeDetailRow(A, { user_id: VIEWER_ID, content: TEXT }), error: null };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    const inserts = callsOf('insert') as [Record<string, unknown>][];
    expect(inserts).toHaveLength(1);
    expect(inserts[0][0]).toMatchObject({ based_on_id: null, based_on_label: 'S', based_on_revision: 2 });
  });

  it('another insert error is not retried', async () => {
    const store = signedInStore();
    openNewDraft(store);
    mocks.state.insertResult = { data: null, error: { message: 'boom', code: '23503' } };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    // No based_on_id to drop: one attempt, the error shown.
    expect(callsOf('insert')).toHaveLength(1);
    expect(save(store)).toMatchObject({ status: RequestState.ERROR, error: 'Could not save the filter: boom' });
  });

  it('the 50-filter cap reads as its own message', async () => {
    const store = signedInStore();
    const draftId = openNewDraft(store);
    mocks.state.insertResult = { data: null, error: { message: 'loot_filter_limit' } };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store)).toMatchObject({ status: RequestState.ERROR, error: LOOT_FILTER_LIMIT_MESSAGE });
    // Nothing changed locally.
    expect(editor(store).target).toEqual({ kind: 'draft', entryId: draftId });
  });
});

describe('saveFilterRequested: update', () => {
  it('flushes the pending edit, then updates with a compare-and-swap on the revision', async () => {
    const store = signedInStore();
    openEditedSaved(store);
    const filter = editor(store).filter;
    if (filter === null) throw new Error('The edited filter should be open');
    const modelText = serializeLootFilter(filter);
    mocks.state.updateResult = { data: [makeDetailRow(A, { user_id: VIEWER_ID, content: modelText, revision: 4 })], error: null };

    store.dispatch(saveFilterRequested({ mode: 'normal', changeNote: ' Tweaked ' }));
    await settle();

    const [[update]] = callsOf('update') as [[Record<string, unknown>]];
    // The text sent is the edited model, written into the draft by flushNow (no debounced flush ran).
    expect(update).toMatchObject({
      content: modelText,
      title: 'Edited',
      esr_version_updated: '3.2.24',
      plugin_version_updated: LOOT_FILTER_PLUGIN_VERSION,
      change_note: 'Tweaked',
    });
    expect(update).not.toHaveProperty('based_on_revision');
    expect(callsOf('eq')).toEqual([
      ['id', A],
      ['revision', 3],
    ]);
    expect(save(store).status).toBe(RequestState.SUCCESS);
    expect(editor(store).target).toMatchObject({ kind: 'saved', savedId: A, revision: 4, baseText: modelText });
    expect(editor(store).dirty).toBe(false);
    expect(store.getState().lootFilter.library.entries).toEqual([]);
  });

  it('writes the moved based_on columns after an update was taken', async () => {
    const store = signedInStore();
    const row = detailToRow(
      makeDetail(A, { user_id: VIEWER_ID, content: TEXT, based_on_id: B, based_on_revision: 1, based_on_label: 'X by Y#1' })
    );
    store.dispatch(openSaved({ row, viewerId: VIEWER_ID, authorLabel: 'Me#1111' }));
    // What takeUpdate (replace) leaves: a draft with the new basedOn.
    const { takeUpdate } = await import('../store/lootFilterSlice');
    store.dispatch(
      takeUpdate({ text: TEXT.replace('Mine', 'Newer'), basedOn: { id: B, revision: 2, label: 'X by Y#1' }, mode: 'replace' })
    );
    mocks.state.updateResult = { data: [makeDetailRow(A, { user_id: VIEWER_ID, revision: 2 })], error: null };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    const [[update]] = callsOf('update') as [[Record<string, unknown>]];
    expect(update).toMatchObject({ based_on_revision: 2, based_on_version: null, based_on_label: 'X by Y#1', change_note: null });
  });

  it('changed elsewhere (still mine): conflict "changed", the draft stays', async () => {
    const store = signedInStore();
    openEditedSaved(store);
    mocks.state.updateResult = { data: [], error: null };
    mocks.state.lookupResult = { data: { id: A, user_id: VIEWER_ID }, error: null };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store)).toMatchObject({ status: RequestState.ERROR, conflict: 'changed', error: SAVE_CONFLICT_MESSAGES.changed });
    expect(editor(store).target).toMatchObject({ kind: 'saved', savedId: A, revision: 3 });
    expect(store.getState().lootFilter.library.entries).toHaveLength(1);
  });

  it('deleted or not mine: conflict "gone"', async () => {
    const store = signedInStore();
    openEditedSaved(store);
    mocks.state.lookupResult = { data: null, error: null };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store).conflict).toBe('gone');

    mocks.state.lookupResult = { data: { id: A, user_id: OTHER_USER_ID }, error: null };
    store.dispatch(saveFilterRequested({ mode: 'normal' }));
    await settle();
    expect(save(store).conflict).toBe('gone');
  });

  it('overwrite: updates without the revision check', async () => {
    const store = signedInStore();
    openEditedSaved(store);
    mocks.state.updateResult = { data: [makeDetailRow(A, { user_id: VIEWER_ID, revision: 9 })], error: null };
    store.dispatch(saveFilterRequested({ mode: 'overwrite' }));
    await settle();
    expect(callsOf('eq')).toEqual([['id', A]]);
    expect(save(store).status).toBe(RequestState.SUCCESS);
    expect(editor(store).target).toMatchObject({ kind: 'saved', savedId: A, revision: 9 });
  });

  it('save as a new filter: inserts the edited text and the editor moves to the new row', async () => {
    const store = signedInStore();
    openEditedSaved(store);
    mocks.state.insertResult = { data: makeDetailRow(B, { user_id: VIEWER_ID, name: 'Copy' }), error: null };
    store.dispatch(saveFilterRequested({ mode: 'asNew', details: { name: 'Copy', description: '', isPrivate: false } }));
    await settle();
    expect(callsOf('update')).toEqual([]);
    const [[inserted]] = callsOf('insert') as [[Record<string, unknown>]];
    expect(inserted).toMatchObject({ name: 'Copy', title: 'Edited' });
    expect(save(store)).toMatchObject({ status: RequestState.SUCCESS, savedId: B });
    expect(editor(store).target).toMatchObject({ kind: 'saved', savedId: B });
    expect(store.getState().lootFilter.library.entries).toEqual([]);
  });
});

describe('updateFilterDetailsRequested', () => {
  it('writes name, description and Private; the open target takes the new name', async () => {
    const store = signedInStore();
    const row = detailToRow(makeDetail(A, { user_id: VIEWER_ID, content: TEXT }));
    store.dispatch(openSaved({ row, viewerId: VIEWER_ID, authorLabel: 'Me#1111' }));
    mocks.state.updateResult = { data: [makeDetailRow(A, { user_id: VIEWER_ID, name: 'Renamed', is_private: true })], error: null };
    store.dispatch(updateFilterDetailsRequested({ id: A, name: ' Renamed ', description: '', isPrivate: true }));
    await settle();
    const [[update]] = callsOf('update') as [[Record<string, unknown>]];
    expect(update).toEqual({ name: 'Renamed', description: null, is_private: true });
    expect(store.getState().lootFilterSharing.detailsStatus).toBe(RequestState.SUCCESS);
    expect(editor(store).target).toMatchObject({ kind: 'saved', name: 'Renamed' });
  });

  it('no row updated: fails with the "gone" message', async () => {
    const store = signedInStore();
    store.dispatch(updateFilterDetailsRequested({ id: A, name: 'X', description: '', isPrivate: false }));
    await settle();
    expect(store.getState().lootFilterSharing).toMatchObject({
      detailsStatus: RequestState.ERROR,
      detailsError: SAVE_CONFLICT_MESSAGES.gone,
    });
  });
});

describe('fetchSourceFilterRequested', () => {
  it('loads the source with its file, or marks it no longer shared', async () => {
    const store = signedInStore();
    mocks.state.lookupResult = { data: makeDetailRow(B, { content: TEXT }), error: null };
    store.dispatch(fetchSourceFilterRequested(B));
    await settle();
    expect(store.getState().lootFilterSharing.sourceFilter).toMatchObject({ id: B, status: RequestState.SUCCESS });

    mocks.state.lookupResult = { data: null, error: null };
    store.dispatch(fetchSourceFilterRequested(B));
    await settle();
    expect(store.getState().lootFilterSharing.sourceFilter).toMatchObject({ id: B, status: RequestState.ERROR, notFound: true });
    expect(store.getState().lootFilterSharing.sourceRevisions[B]).toBeNull();
  });
});

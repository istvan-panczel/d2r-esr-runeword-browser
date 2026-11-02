import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

interface Result {
  data?: unknown;
  error: { message: string; code?: string } | null;
}

// Mock Supabase client: every from(table) gets a fresh chainable builder that logs its calls and is thenable. What a
// query resolves to depends on the table and on whether it writes (insert / delete), so the list, likes and write
// results can be set independently. maybeSingle() resolves `detailResult`; rpc() resolves `rpcResult`.
const mocks = vi.hoisted(() => {
  type Call = { table: string; method: string; args: unknown[] };
  const state = {
    listResult: { data: [], error: null } as Result,
    likesResult: { data: [], error: null } as Result,
    writeResult: { error: null } as Result,
    detailResult: { data: null, error: null } as Result,
    rpcResult: { error: null } as Result,
    // When set, the next awaited query waits for this promise before resolving (one-shot).
    nextGate: null as Promise<void> | null,
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
    builder.maybeSingle = () => {
      state.calls.push({ table, method: 'maybeSingle', args: [] });
      return Promise.resolve(state.detailResult);
    };
    // Resolves on a microtask (like a network call), with the result captured when the request is made.
    builder.then = (resolve: (value: unknown) => void) => {
      const writes = own.includes('insert') || own.includes('delete');
      const result = writes ? state.writeResult : table === 'loot_filter_likes' ? state.likesResult : state.listResult;
      const gate = state.nextGate ?? Promise.resolve();
      state.nextGate = null;
      void gate.then(() => {
        resolve(result);
      });
    };
    return builder;
  }
  const client = {
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc: vi.fn((name: string, args: unknown) => {
      state.calls.push({ table: `rpc:${name}`, method: 'rpc', args: [args] });
      return Promise.resolve(state.rpcResult);
    }),
  };
  return { client, state };
});

vi.mock('@/core/supabase', () => ({
  requireSupabase: () => mocks.client,
  isSupabaseConfigured: true,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'sonner';
import { RequestState } from '@/core/types';
import authReducer, { authStateChanged } from '@/features/auth/store/authSlice';
import { LATEST_FILTERS_COUNT, MY_FILTERS_LIMIT, SHARED_FILTERS_PAGE_SIZE } from './constants';
import { lootFilterSharingSaga } from './sharingSaga';
import { SHARED_FILTER_DETAIL_SELECT, SHARED_FILTER_LIST_SELECT, SOURCE_REVISION_SELECT } from './sharingQuery';
import sharingReducer, {
  deleteSharedFilterRequested,
  downloadCounted,
  fetchAuthorFiltersRequested,
  fetchLatestFiltersRequested,
  fetchMoreAuthorFiltersRequested,
  fetchMoreSharedFiltersRequested,
  fetchMyFiltersRequested,
  fetchMyFiltersSuccess,
  fetchSharedFilterRequested,
  fetchSharedFilterSuccess,
  fetchSharedFiltersRequested,
  fetchSharedFiltersSuccess,
  fetchSourceRevisionsRequested,
  setSharedFiltersSearchText,
  setSharedFiltersSortMode,
  sharedFilterLikesLoaded,
  toggleSharedFilterLikeRequested,
} from './sharingSlice';
import { OTHER_USER_ID, VIEWER_ID, filterId, makeDetail, makeDetailRow, makeSummary } from './sharing.mock';

const A = filterId(1);
const B = filterId(2);

function setupStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { auth: authReducer, lootFilterSharing: sharingReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  sagaMiddleware.run(lootFilterSharingSaga);
  return store;
}

function signedInStore() {
  const store = setupStore();
  store.dispatch(authStateChanged({ user: { id: VIEWER_ID, email: null } }));
  return store;
}

const sharing = (store: ReturnType<typeof setupStore>) => store.getState().lootFilterSharing;

/** The calls of `method` on `table`, as argument lists. */
function callsOf(table: string, method: string): unknown[][] {
  return mocks.state.calls.filter((call) => call.table === table && call.method === method).map((call) => call.args);
}

/** A full page of rows, so the list reports hasMore and load-more is possible. */
function fullPage(offset: number) {
  return Array.from({ length: SHARED_FILTERS_PAGE_SIZE }, (_, index) => makeSummary(filterId(offset + index)));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.listResult = { data: [], error: null };
  mocks.state.likesResult = { data: [], error: null };
  mocks.state.writeResult = { error: null };
  mocks.state.detailResult = { data: null, error: null };
  mocks.state.rpcResult = { error: null };
  mocks.state.nextGate = null;
  mocks.state.calls = [];
});

describe('lootFilterSharingSaga', () => {
  describe('Shared tab', () => {
    it('fetches public filters, newest first, with the list columns and checked levels', async () => {
      mocks.state.listResult = { data: [{ ...makeSummary(A), levels: [{ id: 1, name: 'Leveling' }, { bogus: true }] }], error: null };
      const store = setupStore();

      store.dispatch(fetchSharedFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).shared.status).toBe(RequestState.SUCCESS);
      });
      expect(sharing(store).shared.items[0].levels).toEqual([{ id: 1, name: 'Leveling' }]);
      expect(callsOf('loot_filters', 'select')).toEqual([[SHARED_FILTER_LIST_SELECT]]);
      expect(callsOf('loot_filters', 'eq')).toEqual([['is_private', false]]);
      expect(callsOf('loot_filters', 'order')).toEqual([
        ['created_at', { ascending: false }],
        ['id', { ascending: false }],
      ]);
      expect(callsOf('loot_filters', 'limit')).toEqual([[SHARED_FILTERS_PAGE_SIZE]]);
      expect(callsOf('loot_filters', 'or')).toEqual([]);
    });

    it('refetches with a name search and a sort change', async () => {
      const store = setupStore();

      store.dispatch(setSharedFiltersSearchText('  mf  '));
      await vi.waitFor(() => {
        expect(callsOf('loot_filters', 'ilike')).toEqual([['name', '%mf%']]);
      });
      store.dispatch(setSharedFiltersSortMode('most_downloaded'));

      await vi.waitFor(() => {
        expect(callsOf('loot_filters', 'order')).toContainEqual(['download_count', { ascending: false }]);
      });
      await vi.waitFor(() => {
        expect(sharing(store).shared.status).toBe(RequestState.SUCCESS);
      });
    });

    it('pages on with the keyset cursor of the active sort', async () => {
      const page = fullPage(100);
      mocks.state.listResult = { data: page, error: null };
      const store = setupStore();
      store.dispatch(setSharedFiltersSortMode('most_liked'));
      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE);
      });
      expect(sharing(store).shared.hasMore).toBe(true);

      mocks.state.listResult = { data: [makeSummary(A)], error: null };
      store.dispatch(fetchMoreSharedFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE + 1);
      });
      const last = page[page.length - 1];
      expect(callsOf('loot_filters', 'or')).toEqual([
        [
          `likes_count.lt.0,and(likes_count.eq.0,created_at.lt.${last.created_at}),` +
            `and(likes_count.eq.0,created_at.eq.${last.created_at},id.lt.${last.id})`,
        ],
      ]);
      expect(sharing(store).shared.hasMore).toBe(false);
    });

    it('flags which listed filters the signed-in viewer has liked', async () => {
      mocks.state.listResult = { data: [makeSummary(A), makeSummary(B)], error: null };
      mocks.state.likesResult = { data: [{ filter_id: A }], error: null };
      const store = signedInStore();

      store.dispatch(fetchSharedFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(2);
      });
      expect(sharing(store).likedIds).toEqual([A]);
      expect(callsOf('loot_filter_likes', 'in')).toEqual([['filter_id', [A, B]]]);
      expect(callsOf('loot_filter_likes', 'eq')).toEqual([['user_id', VIEWER_ID]]);
    });

    it('does not look up likes for a signed-out visitor', async () => {
      mocks.state.listResult = { data: [makeSummary(A)], error: null };
      const store = setupStore();

      store.dispatch(fetchSharedFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(1);
      });
      expect(callsOf('loot_filter_likes', 'select')).toEqual([]);
    });

    it('records an error when the first page fails', async () => {
      mocks.state.listResult = { data: null, error: { message: 'backend down' } };
      const store = setupStore();

      store.dispatch(fetchSharedFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).shared.status).toBe(RequestState.ERROR);
      });
      expect(sharing(store).shared.error).toBe('backend down');
    });

    it('flags a failed load-more without touching the list or retrying, and appends on an explicit retry', async () => {
      mocks.state.listResult = { data: fullPage(100), error: null };
      const store = setupStore();
      store.dispatch(fetchSharedFiltersRequested());
      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE);
      });

      mocks.state.listResult = { data: null, error: { message: 'backend down' } };
      store.dispatch(fetchMoreSharedFiltersRequested());
      await vi.waitFor(() => {
        expect(sharing(store).shared.loadMoreError).toBe('backend down');
      });
      const callsAfterFailure = mocks.client.from.mock.calls.length;
      await settle();
      expect(mocks.client.from.mock.calls.length).toBe(callsAfterFailure);
      const shared = sharing(store).shared;
      expect(shared.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE);
      expect(shared.status).toBe(RequestState.SUCCESS);
      expect(shared.error).toBeNull();
      expect(shared.loadingMore).toBe(false);

      mocks.state.listResult = { data: [makeSummary(A)], error: null };
      store.dispatch(fetchMoreSharedFiltersRequested());
      expect(sharing(store).shared.loadMoreError).toBeNull();
      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE + 1);
      });
    });

    it('drops an in-flight load-more page when the list is refetched', async () => {
      mocks.state.listResult = { data: fullPage(100), error: null };
      const store = setupStore();
      store.dispatch(fetchSharedFiltersRequested());
      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE);
      });

      let releaseStale = () => {};
      mocks.state.nextGate = new Promise<void>((resolve) => {
        releaseStale = resolve;
      });
      mocks.state.listResult = { data: [makeSummary(filterId(999))], error: null };
      store.dispatch(fetchMoreSharedFiltersRequested());

      mocks.state.listResult = { data: [makeSummary(A)], error: null };
      store.dispatch(setSharedFiltersSearchText('fresh'));
      expect(sharing(store).shared.loadingMore).toBe(false);
      await vi.waitFor(() => {
        expect(sharing(store).shared.items.map((item) => item.id)).toEqual([A]);
      });

      releaseStale();
      await settle();
      expect(sharing(store).shared.items.map((item) => item.id)).toEqual([A]);
    });
  });

  describe('My filters', () => {
    it("loads the viewer's own filters, private ones included, most recently updated first", async () => {
      mocks.state.listResult = { data: [makeSummary(A, { user_id: VIEWER_ID, is_private: true })], error: null };
      const store = signedInStore();

      store.dispatch(fetchMyFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).myFiltersStatus).toBe(RequestState.SUCCESS);
      });
      expect(sharing(store).myFilters.map((item) => item.id)).toEqual([A]);
      expect(callsOf('loot_filters', 'eq')).toEqual([['user_id', VIEWER_ID]]);
      expect(callsOf('loot_filters', 'order')[0]).toEqual(['updated_at', { ascending: false }]);
      expect(callsOf('loot_filters', 'limit')).toEqual([[MY_FILTERS_LIMIT]]);
    });

    it('fails without a query when signed out', async () => {
      const store = setupStore();

      store.dispatch(fetchMyFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).myFiltersStatus).toBe(RequestState.ERROR);
      });
      expect(mocks.client.from).not.toHaveBeenCalled();
    });
  });

  describe('detail', () => {
    it('loads the full row with its content and whether the viewer liked it', async () => {
      mocks.state.detailResult = { data: makeDetailRow(A, { levels: [{ id: 2, name: 'Strict' }] }), error: null };
      mocks.state.likesResult = { data: [{ filter_id: A }], error: null };
      const store = signedInStore();

      store.dispatch(fetchSharedFilterRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).detail?.id).toBe(A);
      });
      expect(sharing(store).detail?.content).toContain('formatVersion');
      expect(sharing(store).detail?.levels).toEqual([{ id: 2, name: 'Strict' }]);
      expect(sharing(store).likedIds).toEqual([A]);
      expect(callsOf('loot_filters', 'select')).toEqual([[SHARED_FILTER_DETAIL_SELECT]]);
      expect(callsOf('loot_filters', 'eq')).toEqual([['id', A]]);
    });

    it('marks a missing (or private) filter not found', async () => {
      const store = setupStore();

      store.dispatch(fetchSharedFilterRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).detailNotFound).toBe(true);
      });
    });

    it('treats a malformed id as not found without querying', async () => {
      const store = setupStore();

      store.dispatch(fetchSharedFilterRequested('not-a-uuid'));

      await vi.waitFor(() => {
        expect(sharing(store).detailNotFound).toBe(true);
      });
      expect(mocks.client.from).not.toHaveBeenCalled();
    });

    it('records a failure on a query error', async () => {
      mocks.state.detailResult = { data: null, error: { message: 'down' } };
      const store = setupStore();

      store.dispatch(fetchSharedFilterRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).detailStatus).toBe(RequestState.ERROR);
      });
    });
  });

  describe('likes', () => {
    it('inserts a like optimistically and settles on success', async () => {
      const store = signedInStore();
      store.dispatch(fetchSharedFilterSuccess(makeDetail(A, { likes_count: 1 })));

      store.dispatch(toggleSharedFilterLikeRequested(A));
      expect(sharing(store).detail?.likes_count).toBe(2); // optimistic

      await vi.waitFor(() => {
        expect(sharing(store).likePendingIds).toEqual([]);
      });
      expect(sharing(store).likedIds).toEqual([A]);
      expect(callsOf('loot_filter_likes', 'insert')).toEqual([[{ filter_id: A, user_id: VIEWER_ID }]]);
    });

    it('deletes the like when unliking', async () => {
      const store = signedInStore();
      store.dispatch(sharedFilterLikesLoaded({ viewerId: VIEWER_ID, checkedIds: [A], likedIds: [A] }));

      store.dispatch(toggleSharedFilterLikeRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).likePendingIds).toEqual([]);
      });
      expect(sharing(store).likedIds).toEqual([]);
      expect(callsOf('loot_filter_likes', 'delete')).toHaveLength(1);
      expect(callsOf('loot_filter_likes', 'eq')).toEqual([
        ['filter_id', A],
        ['user_id', VIEWER_ID],
      ]);
    });

    it('reverts the optimistic like and tells the user when the request fails', async () => {
      mocks.state.writeResult = { error: { message: 'nope' } };
      const store = signedInStore();
      store.dispatch(
        fetchSharedFiltersSuccess({ items: [makeSummary(A, { likes_count: 1 })], cursor: null, hasMore: false, append: false })
      );

      store.dispatch(toggleSharedFilterLikeRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).likePendingIds).toEqual([]);
      });
      expect(sharing(store).likedIds).toEqual([]);
      expect(sharing(store).shared.items[0].likes_count).toBe(1);
      expect(toast.error).toHaveBeenCalled();
    });

    it('keeps the like when it already existed (liked from another tab)', async () => {
      mocks.state.writeResult = { error: { message: 'duplicate key', code: '23505' } };
      const store = signedInStore();

      store.dispatch(toggleSharedFilterLikeRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).likePendingIds).toEqual([]);
      });
      expect(sharing(store).likedIds).toEqual([A]);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('sends one request per filter while one is in flight', async () => {
      const store = signedInStore();

      store.dispatch(toggleSharedFilterLikeRequested(A));
      store.dispatch(toggleSharedFilterLikeRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).likePendingIds).toEqual([]);
      });
      expect(callsOf('loot_filter_likes', 'insert')).toHaveLength(1);
      expect(sharing(store).likedIds).toEqual([A]);
    });

    it('does nothing for a signed-out visitor', async () => {
      const store = setupStore();

      store.dispatch(toggleSharedFilterLikeRequested(A));
      await settle();

      expect(mocks.client.from).not.toHaveBeenCalled();
      expect(sharing(store).likedIds).toEqual([]);
    });
  });

  describe('downloads', () => {
    it('counts the download at once and calls the RPC', async () => {
      const store = setupStore();
      store.dispatch(fetchSharedFilterSuccess(makeDetail(A, { download_count: 3 })));

      store.dispatch(downloadCounted(A));

      expect(sharing(store).detail?.download_count).toBe(4);
      await vi.waitFor(() => {
        expect(mocks.client.rpc).toHaveBeenCalledWith('increment_loot_filter_download', { filter_id: A });
      });
    });

    it('only logs a failed RPC and keeps the optimistic count', async () => {
      mocks.state.rpcResult = { error: { message: 'down' } };
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const store = setupStore();
      store.dispatch(fetchSharedFilterSuccess(makeDetail(A, { download_count: 3 })));

      store.dispatch(downloadCounted(A));

      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });
      expect(sharing(store).detail?.download_count).toBe(4);
      expect(toast.error).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('skips the RPC for an id that is not a saved filter', async () => {
      const store = setupStore();

      store.dispatch(downloadCounted('sully'));
      await settle();

      expect(mocks.client.rpc).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes the filter and removes it from the lists and the detail', async () => {
      const store = signedInStore();
      store.dispatch(fetchMyFiltersSuccess({ userId: VIEWER_ID, items: [makeSummary(A, { user_id: VIEWER_ID }), makeSummary(B)] }));
      store.dispatch(fetchSharedFilterSuccess(makeDetail(A, { user_id: VIEWER_ID })));

      store.dispatch(deleteSharedFilterRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).deleteStatus).toBe(RequestState.SUCCESS);
      });
      expect(callsOf('loot_filters', 'delete')).toHaveLength(1);
      expect(callsOf('loot_filters', 'eq')).toEqual([['id', A]]);
      expect(sharing(store).myFilters.map((item) => item.id)).toEqual([B]);
      expect(sharing(store).detail).toBeNull();
    });

    it('keeps the filter and reports a failed delete', async () => {
      mocks.state.writeResult = { error: { message: 'nope' } };
      const store = signedInStore();
      store.dispatch(fetchMyFiltersSuccess({ userId: VIEWER_ID, items: [makeSummary(A, { user_id: VIEWER_ID })] }));

      store.dispatch(deleteSharedFilterRequested(A));

      await vi.waitFor(() => {
        expect(sharing(store).deleteStatus).toBe(RequestState.ERROR);
      });
      expect(sharing(store).myFilters).toHaveLength(1);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('author filters', () => {
    it("loads an author's filters newest first, without a privacy filter (RLS shows the owner theirs), then pages on", async () => {
      mocks.state.listResult = { data: fullPage(100), error: null };
      const store = setupStore();

      store.dispatch(fetchAuthorFiltersRequested(OTHER_USER_ID));

      await vi.waitFor(() => {
        expect(sharing(store).author.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE);
      });
      expect(callsOf('loot_filters', 'eq')).toEqual([['user_id', OTHER_USER_ID]]);

      mocks.state.listResult = { data: [makeSummary(A)], error: null };
      store.dispatch(fetchMoreAuthorFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).author.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE + 1);
      });
      expect(callsOf('loot_filters', 'or')).toHaveLength(1);
      expect(String(callsOf('loot_filters', 'or')[0][0])).toMatch(/^created_at\.lt\./);
    });

    it('gives an empty list for a malformed user id without querying', async () => {
      const store = setupStore();

      store.dispatch(fetchAuthorFiltersRequested('nope'));

      await vi.waitFor(() => {
        expect(sharing(store).author.status).toBe(RequestState.SUCCESS);
      });
      expect(mocks.client.from).not.toHaveBeenCalled();
    });

    it('reports a failed load-more on the list', async () => {
      mocks.state.listResult = { data: fullPage(100), error: null };
      const store = setupStore();
      store.dispatch(fetchAuthorFiltersRequested(OTHER_USER_ID));
      await vi.waitFor(() => {
        expect(sharing(store).author.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE);
      });

      mocks.state.listResult = { data: null, error: { message: 'down' } };
      store.dispatch(fetchMoreAuthorFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).author.loadMoreError).toBe('down');
      });
      expect(sharing(store).author.items).toHaveLength(SHARED_FILTERS_PAGE_SIZE);
    });
  });

  describe('latest', () => {
    it('loads the newest public filters without touching the Shared tab', async () => {
      mocks.state.listResult = { data: [makeSummary(A), makeSummary(B)], error: null };
      const store = setupStore();

      store.dispatch(fetchLatestFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).latestStatus).toBe(RequestState.SUCCESS);
      });
      expect(sharing(store).latest.map((item) => item.id)).toEqual([A, B]);
      expect(sharing(store).shared.items).toEqual([]);
      expect(callsOf('loot_filters', 'eq')).toEqual([['is_private', false]]);
      expect(callsOf('loot_filters', 'limit')).toEqual([[LATEST_FILTERS_COUNT]]);
    });

    it('marks the block failed on a query error', async () => {
      mocks.state.listResult = { data: null, error: { message: 'down' } };
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const store = setupStore();

      store.dispatch(fetchLatestFiltersRequested());

      await vi.waitFor(() => {
        expect(sharing(store).latestStatus).toBe(RequestState.ERROR);
      });
    });
  });

  describe('source revisions', () => {
    it('looks the sources up in one query; ids without a row are no longer shared', async () => {
      mocks.state.listResult = { data: [{ id: A, revision: 4, change_note: 'new uniques', name: 'Base' }], error: null };
      const store = signedInStore();

      store.dispatch(fetchSourceRevisionsRequested([A, B, A, 'local-draft-id']));

      await vi.waitFor(() => {
        expect(sharing(store).sourceRevisionsStatus).toBe(RequestState.SUCCESS);
      });
      expect(sharing(store).sourceRevisions).toEqual({
        [A]: { id: A, revision: 4, change_note: 'new uniques', name: 'Base' },
        [B]: null,
        'local-draft-id': null,
      });
      expect(callsOf('loot_filters', 'select')).toEqual([[SOURCE_REVISION_SELECT]]);
      expect(callsOf('loot_filters', 'in')).toEqual([['id', [A, B]]]);
    });

    it('does not query when no id is a uuid', async () => {
      const store = signedInStore();

      store.dispatch(fetchSourceRevisionsRequested(['x']));

      await vi.waitFor(() => {
        expect(sharing(store).sourceRevisionsStatus).toBe(RequestState.SUCCESS);
      });
      expect(mocks.client.from).not.toHaveBeenCalled();
    });
  });

  describe('viewer changes', () => {
    it("looks up the new viewer's likes on what is on screen after a sign-in", async () => {
      mocks.state.listResult = { data: [makeSummary(A), makeSummary(B)], error: null };
      const store = setupStore();
      store.dispatch(fetchSharedFiltersRequested());
      await vi.waitFor(() => {
        expect(sharing(store).shared.items).toHaveLength(2);
      });
      expect(callsOf('loot_filter_likes', 'select')).toEqual([]);

      mocks.state.likesResult = { data: [{ filter_id: B }], error: null };
      store.dispatch(authStateChanged({ user: { id: VIEWER_ID, email: null } }));

      await vi.waitFor(() => {
        expect(sharing(store).likedIds).toEqual([B]);
      });

      // A token refresh for the same user does not look again.
      store.dispatch(authStateChanged({ user: { id: VIEWER_ID, email: null } }));
      await settle();
      expect(callsOf('loot_filter_likes', 'select')).toHaveLength(1);
    });

    it('clears the likes on sign-out without a request', async () => {
      const store = signedInStore();
      store.dispatch(sharedFilterLikesLoaded({ viewerId: VIEWER_ID, checkedIds: [A], likedIds: [A] }));

      store.dispatch(authStateChanged({ user: null }));
      await settle();

      expect(sharing(store).likedIds).toEqual([]);
      expect(mocks.client.from).not.toHaveBeenCalled();
    });
  });
});

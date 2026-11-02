import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { authStateChanged } from '@/features/auth/store/authSlice';
import { RequestState } from '@/core/types';
import type { RootState } from '@/core/store/store';
import sharingReducer, {
  deleteSharedFilterSucceeded,
  downloadCounted,
  fetchAuthorFiltersRequested,
  fetchAuthorFiltersSuccess,
  fetchLatestFiltersSuccess,
  fetchMoreSharedFiltersFailure,
  fetchMoreSharedFiltersRequested,
  fetchMyFiltersSuccess,
  fetchSharedFilterSuccess,
  fetchSharedFiltersRequested,
  fetchSharedFiltersSuccess,
  fetchSourceRevisionsSuccess,
  selectSharedFilterDetailLiked,
  selectVisibleFilterIds,
  sharedFilterLikesLoaded,
  toggleSharedFilterLikeReverted,
  toggleSharedFilterLikeRequested,
  toggleSharedFilterLikeSettled,
} from './sharingSlice';
import { OTHER_USER_ID, VIEWER_ID, filterId, makeDetail, makeSummary } from './sharing.mock';

const A = filterId(1);
const B = filterId(2);
const C = filterId(3);

function setupStore() {
  return configureStore({ reducer: { auth: authReducer, lootFilterSharing: sharingReducer } });
}

function signedInStore() {
  const store = setupStore();
  store.dispatch(authStateChanged({ user: { id: VIEWER_ID, email: null } }));
  return store;
}

const sharing = (store: ReturnType<typeof setupStore>) => store.getState().lootFilterSharing;
const root = (store: ReturnType<typeof setupStore>) => store.getState() as unknown as RootState;

describe('lootFilterSharing slice', () => {
  describe('paged lists', () => {
    it('replaces the list on a first page and appends on load-more', () => {
      const store = setupStore();
      store.dispatch(fetchSharedFiltersRequested());
      expect(sharing(store).shared.status).toBe(RequestState.LOADING);
      store.dispatch(fetchSharedFiltersSuccess({ items: [makeSummary(A)], cursor: null, hasMore: true, append: false }));
      store.dispatch(fetchSharedFiltersSuccess({ items: [makeSummary(B)], cursor: null, hasMore: false, append: true }));
      expect(sharing(store).shared.items.map((item) => item.id)).toEqual([A, B]);
      expect(sharing(store).shared.hasMore).toBe(false);
    });

    it('keeps the list on a load-more failure and clears the error on retry', () => {
      const store = setupStore();
      store.dispatch(fetchSharedFiltersSuccess({ items: [makeSummary(A)], cursor: null, hasMore: true, append: false }));
      store.dispatch(fetchMoreSharedFiltersRequested());
      store.dispatch(fetchMoreSharedFiltersFailure('down'));
      expect(sharing(store).shared.loadMoreError).toBe('down');
      expect(sharing(store).shared.loadingMore).toBe(false);
      expect(sharing(store).shared.status).toBe(RequestState.SUCCESS);
      store.dispatch(fetchMoreSharedFiltersRequested());
      expect(sharing(store).shared.loadMoreError).toBeNull();
    });

    it("ignores a page of a previous author's filters", () => {
      const store = setupStore();
      store.dispatch(fetchAuthorFiltersRequested(VIEWER_ID));
      store.dispatch(fetchAuthorFiltersRequested(OTHER_USER_ID));
      store.dispatch(
        fetchAuthorFiltersSuccess({ items: [makeSummary(A)], cursor: null, hasMore: false, append: false, authorId: VIEWER_ID })
      );
      expect(sharing(store).author.items).toEqual([]);
      expect(sharing(store).author.status).toBe(RequestState.LOADING);
    });
  });

  describe('likes', () => {
    it('flips the like and its count everywhere the filter is shown, then settles', () => {
      const store = signedInStore();
      store.dispatch(
        fetchSharedFiltersSuccess({ items: [makeSummary(A, { likes_count: 2 })], cursor: null, hasMore: false, append: false })
      );
      store.dispatch(fetchLatestFiltersSuccess([makeSummary(A, { likes_count: 2 })]));
      store.dispatch(fetchSharedFilterSuccess(makeDetail(A, { likes_count: 2 })));

      store.dispatch(toggleSharedFilterLikeRequested(A));

      const state = sharing(store);
      expect(state.likedIds).toEqual([A]);
      expect(state.likePendingIds).toEqual([A]);
      expect(state.shared.items[0].likes_count).toBe(3);
      expect(state.latest[0].likes_count).toBe(3);
      expect(state.detail?.likes_count).toBe(3);
      expect(state.detail?.content).toBeDefined();
      expect(selectSharedFilterDetailLiked(root(store))).toBe(true);

      store.dispatch(toggleSharedFilterLikeSettled(A));
      expect(sharing(store).likePendingIds).toEqual([]);
      expect(sharing(store).likedIds).toEqual([A]);
    });

    it('reverts the optimistic flip', () => {
      const store = signedInStore();
      store.dispatch(
        fetchSharedFiltersSuccess({ items: [makeSummary(A, { likes_count: 2 })], cursor: null, hasMore: false, append: false })
      );
      store.dispatch(toggleSharedFilterLikeRequested(A));
      store.dispatch(toggleSharedFilterLikeReverted(A));
      expect(sharing(store).likedIds).toEqual([]);
      expect(sharing(store).shared.items[0].likes_count).toBe(2);
      expect(sharing(store).likePendingIds).toEqual([]);
    });

    it('ignores a toggle while signed out or while that filter has a request in flight', () => {
      const signedOut = setupStore();
      signedOut.dispatch(toggleSharedFilterLikeRequested(A));
      expect(sharing(signedOut).likedIds).toEqual([]);

      const store = signedInStore();
      store.dispatch(toggleSharedFilterLikeRequested(A));
      store.dispatch(toggleSharedFilterLikeRequested(A));
      expect(sharing(store).likedIds).toEqual([A]);
    });

    it('replaces the liked state of the checked ids only, keeping pending ones and dropping stale viewers', () => {
      const store = signedInStore();
      store.dispatch(sharedFilterLikesLoaded({ viewerId: VIEWER_ID, checkedIds: [A, B], likedIds: [A, B] }));
      store.dispatch(toggleSharedFilterLikeRequested(C)); // pending like on C

      store.dispatch(sharedFilterLikesLoaded({ viewerId: VIEWER_ID, checkedIds: [B, C], likedIds: [] }));
      expect([...sharing(store).likedIds].sort()).toEqual([A, C]);

      store.dispatch(sharedFilterLikesLoaded({ viewerId: OTHER_USER_ID, checkedIds: [A], likedIds: [] }));
      expect(sharing(store).likedIds).toContain(A);
    });
  });

  it('counts a download in every list and the detail', () => {
    const store = setupStore();
    store.dispatch(
      fetchSharedFiltersSuccess({
        items: [makeSummary(A, { download_count: 4 }), makeSummary(B)],
        cursor: null,
        hasMore: false,
        append: false,
      })
    );
    store.dispatch(fetchSharedFilterSuccess(makeDetail(A, { download_count: 4 })));
    store.dispatch(downloadCounted(A));
    expect(sharing(store).shared.items.map((item) => item.download_count)).toEqual([5, 0]);
    expect(sharing(store).detail?.download_count).toBe(5);
  });

  it('removes a deleted filter from every list, the detail and the likes, and marks it gone as a source', () => {
    const store = signedInStore();
    store.dispatch(fetchSharedFiltersSuccess({ items: [makeSummary(A), makeSummary(B)], cursor: null, hasMore: false, append: false }));
    store.dispatch(fetchMyFiltersSuccess({ userId: VIEWER_ID, items: [makeSummary(A, { user_id: VIEWER_ID })] }));
    store.dispatch(fetchSharedFilterSuccess(makeDetail(A)));
    store.dispatch(sharedFilterLikesLoaded({ viewerId: VIEWER_ID, checkedIds: [A], likedIds: [A] }));
    store.dispatch(
      fetchSourceRevisionsSuccess({ viewerId: VIEWER_ID, requestedIds: [A], rows: [{ id: A, revision: 2, change_note: null, name: 'A' }] })
    );

    store.dispatch(deleteSharedFilterSucceeded(A));

    const state = sharing(store);
    expect(state.shared.items.map((item) => item.id)).toEqual([B]);
    expect(state.myFilters).toEqual([]);
    expect(state.detail).toBeNull();
    expect(state.likedIds).toEqual([]);
    expect(state.sourceRevisions[A]).toBeNull();
    expect(state.deleteStatus).toBe(RequestState.SUCCESS);
  });

  it('records source revisions, null for requested ids that came back without a row', () => {
    const store = signedInStore();
    store.dispatch(
      fetchSourceRevisionsSuccess({
        viewerId: VIEWER_ID,
        requestedIds: [A, B],
        rows: [{ id: A, revision: 3, change_note: 'tweaks', name: 'A' }],
      })
    );
    expect(sharing(store).sourceRevisions).toEqual({ [A]: { id: A, revision: 3, change_note: 'tweaks', name: 'A' }, [B]: null });

    // A lookup for a viewer that has since signed out is dropped.
    store.dispatch(fetchSourceRevisionsSuccess({ viewerId: OTHER_USER_ID, requestedIds: [C], rows: [] }));
    expect(C in sharing(store).sourceRevisions).toBe(false);
  });

  describe('viewer changes', () => {
    it("drops the previous viewer's likes, My filters, sources and private filters on sign-out", () => {
      const store = signedInStore();
      const own = makeSummary(A, { user_id: VIEWER_ID, is_private: true });
      store.dispatch(fetchMyFiltersSuccess({ userId: VIEWER_ID, items: [own] }));
      store.dispatch(fetchAuthorFiltersRequested(VIEWER_ID));
      store.dispatch(
        fetchAuthorFiltersSuccess({
          items: [own, makeSummary(B, { user_id: VIEWER_ID })],
          cursor: null,
          hasMore: false,
          append: false,
          authorId: VIEWER_ID,
        })
      );
      store.dispatch(fetchSharedFilterSuccess(makeDetail(A, { user_id: VIEWER_ID, is_private: true })));
      store.dispatch(sharedFilterLikesLoaded({ viewerId: VIEWER_ID, checkedIds: [B], likedIds: [B] }));
      store.dispatch(fetchSourceRevisionsSuccess({ viewerId: VIEWER_ID, requestedIds: [C], rows: [] }));

      store.dispatch(authStateChanged({ user: null }));

      const state = sharing(store);
      expect(state.viewerId).toBeNull();
      expect(state.likedIds).toEqual([]);
      expect(state.myFilters).toEqual([]);
      expect(state.myFiltersStatus).toBe(RequestState.IDLE);
      expect(state.sourceRevisions).toEqual({});
      expect(state.author.items.map((item) => item.id)).toEqual([B]);
      expect(state.detail).toBeNull();
      expect(state.detailNotFound).toBe(true);
    });

    it('keeps everything on a repeated auth event for the same user (token refresh)', () => {
      const store = signedInStore();
      store.dispatch(sharedFilterLikesLoaded({ viewerId: VIEWER_ID, checkedIds: [A], likedIds: [A] }));
      store.dispatch(authStateChanged({ user: { id: VIEWER_ID, email: null } }));
      expect(sharing(store).likedIds).toEqual([A]);
    });

    it('ignores My filters loaded for a previous viewer', () => {
      const store = setupStore();
      store.dispatch(fetchMyFiltersSuccess({ userId: VIEWER_ID, items: [makeSummary(A)] }));
      expect(sharing(store).myFilters).toEqual([]);
    });
  });

  it('lists the ids on screen once each', () => {
    const store = setupStore();
    store.dispatch(fetchSharedFiltersSuccess({ items: [makeSummary(A), makeSummary(B)], cursor: null, hasMore: false, append: false }));
    store.dispatch(fetchLatestFiltersSuccess([makeSummary(A)]));
    store.dispatch(fetchSharedFilterSuccess(makeDetail(C)));
    expect(selectVisibleFilterIds(root(store))).toEqual([A, B, C]);
  });
});

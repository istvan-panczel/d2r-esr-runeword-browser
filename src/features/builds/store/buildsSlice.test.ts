import { describe, expect, it } from 'vitest';
import buildsReducer, {
  clearAuthorProfile,
  clearDetail,
  createBuildFailed,
  createBuildRequested,
  createBuildSucceeded,
  fetchAuthorBuildsSuccess,
  fetchAuthorProfileNotFound,
  fetchAuthorProfileRequested,
  fetchAuthorProfileSuccess,
  fetchBuildNotFound,
  fetchBuildSuccess,
  fetchBuildsFailure,
  fetchBuildsSuccess,
  fetchMoreBuildsRequested,
  resetCreateStatus,
  resetUpdateStatus,
  selectBuildsHasActiveFilters,
  setClassFilter,
  setMyBuildsOnly,
  setSearchText,
  setSortMode,
  toggleLikeRequested,
  toggleLikeReverted,
  updateBuildFailed,
  updateBuildRequested,
  updateBuildSucceeded,
} from './buildsSlice';
import { RequestState } from '@/core/types';
import type { RootState } from '@/core/store/store';
import type { Profile } from '@/core/supabase';
import type { BuildWithAuthor } from '../types';

function makeBuild(id: string): BuildWithAuthor {
  return {
    id,
    user_id: 'u1',
    name: `Build ${id}`,
    description: null,
    class: 'Paladin',
    build_data: {},
    esr_version: '3.9.07',
    esr_version_updated: null,
    likes_count: 0,
    created_at: '2026-06-08T10:00:00.000Z',
    updated_at: '2026-06-08T10:00:00.000Z',
    profiles: { display_name: 'Hero', discriminator: 4242, avatar_url: null },
  };
}

const initial = buildsReducer(undefined, { type: '@@INIT' });

describe('buildsSlice', () => {
  it('replaces items on a non-append fetch success', () => {
    const next = buildsReducer(initial, fetchBuildsSuccess({ items: [makeBuild('a')], cursor: null, hasMore: false, append: false }));
    expect(next.items).toHaveLength(1);
    expect(next.listStatus).toBe(RequestState.SUCCESS);
  });

  it('appends items on an append fetch success', () => {
    const first = buildsReducer(initial, fetchBuildsSuccess({ items: [makeBuild('a')], cursor: null, hasMore: true, append: false }));
    const loading = buildsReducer(first, fetchMoreBuildsRequested());
    expect(loading.loadingMore).toBe(true);

    const second = buildsReducer(loading, fetchBuildsSuccess({ items: [makeBuild('b')], cursor: null, hasMore: false, append: true }));
    expect(second.items.map((b) => b.id)).toEqual(['a', 'b']);
    expect(second.loadingMore).toBe(false);
    expect(second.hasMore).toBe(false);
  });

  it('records list errors and clears loadingMore', () => {
    const next = buildsReducer({ ...initial, loadingMore: true }, fetchBuildsFailure('boom'));
    expect(next.listStatus).toBe(RequestState.ERROR);
    expect(next.error).toBe('boom');
    expect(next.loadingMore).toBe(false);
  });

  it('tracks filter and sort changes', () => {
    let state = buildsReducer(initial, setSearchText('hammer'));
    state = buildsReducer(state, setClassFilter('Paladin'));
    state = buildsReducer(state, setSortMode('most_liked'));
    state = buildsReducer(state, setMyBuildsOnly(true));
    expect(state.searchText).toBe('hammer');
    expect(state.classFilter).toBe('Paladin');
    expect(state.sortMode).toBe('most_liked');
    expect(state.myBuildsOnly).toBe(true);
  });

  it('tracks the create lifecycle', () => {
    const requested = buildsReducer(initial, createBuildRequested({ name: 'X', description: '', class: 'Druid', buildData: {} }));
    expect(requested.createStatus).toBe(RequestState.LOADING);

    const ok = buildsReducer(requested, createBuildSucceeded({ id: 'new-id' }));
    expect(ok.createStatus).toBe(RequestState.SUCCESS);

    expect(buildsReducer(ok, resetCreateStatus()).createStatus).toBe(RequestState.IDLE);

    const failed = buildsReducer(requested, createBuildFailed('nope'));
    expect(failed.createStatus).toBe(RequestState.ERROR);
    expect(failed.error).toBe('nope');
  });

  it('reports active filters for search, class, or My Builds', () => {
    const base = { builds: initial } as unknown as RootState;
    expect(selectBuildsHasActiveFilters(base)).toBe(false);

    const withSearch = { builds: { ...initial, searchText: 'x' } } as unknown as RootState;
    expect(selectBuildsHasActiveFilters(withSearch)).toBe(true);

    const withMine = { builds: { ...initial, myBuildsOnly: true } } as unknown as RootState;
    expect(selectBuildsHasActiveFilters(withMine)).toBe(true);
  });

  it('loads build detail and tracks not-found', () => {
    const loaded = buildsReducer(initial, fetchBuildSuccess({ build: makeBuild('b1'), liked: true }));
    expect(loaded.detailBuild?.id).toBe('b1');
    expect(loaded.detailLiked).toBe(true);
    expect(buildsReducer(initial, fetchBuildNotFound()).detailNotFound).toBe(true);
  });

  it('optimistically toggles a like and can revert', () => {
    const loaded = buildsReducer(initial, fetchBuildSuccess({ build: makeBuild('b1'), liked: false }));
    const liked = buildsReducer(loaded, toggleLikeRequested());
    expect(liked.detailLiked).toBe(true);
    expect(liked.detailBuild?.likes_count).toBe(1);
    expect(liked.likePending).toBe(true);

    const reverted = buildsReducer(liked, toggleLikeReverted());
    expect(reverted.detailLiked).toBe(false);
    expect(reverted.detailBuild?.likes_count).toBe(0);
    expect(reverted.likePending).toBe(false);
  });

  it('clears detail state', () => {
    const loaded = buildsReducer(initial, fetchBuildSuccess({ build: makeBuild('b1'), liked: true }));
    const cleared = buildsReducer(loaded, clearDetail());
    expect(cleared.detailBuild).toBeNull();
    expect(cleared.detailLiked).toBe(false);
  });

  it('tracks the update lifecycle', () => {
    const requested = buildsReducer(initial, updateBuildRequested({ id: 'b1', name: 'X', description: '', class: 'Druid', buildData: {} }));
    expect(requested.updateStatus).toBe(RequestState.LOADING);
    expect(buildsReducer(requested, updateBuildSucceeded({ id: 'b1' })).updateStatus).toBe(RequestState.SUCCESS);
    expect(buildsReducer(requested, updateBuildFailed()).updateStatus).toBe(RequestState.ERROR);
    expect(buildsReducer({ ...initial, updateStatus: RequestState.SUCCESS }, resetUpdateStatus()).updateStatus).toBe(RequestState.IDLE);
  });

  it('loads an author profile and resets prior author builds on a fresh request', () => {
    const profile: Profile = {
      id: 'u1',
      display_name: 'Hero',
      discriminator: 4242,
      avatar_url: null,
      privacy_policy_accepted_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const stale = buildsReducer(
      initial,
      fetchAuthorBuildsSuccess({ items: [makeBuild('old')], cursor: null, hasMore: true, append: false })
    );
    expect(stale.authorBuilds).toHaveLength(1);

    const requested = buildsReducer(stale, fetchAuthorProfileRequested('u1'));
    expect(requested.authorStatus).toBe(RequestState.LOADING);
    expect(requested.authorBuilds).toHaveLength(0);

    const loaded = buildsReducer(requested, fetchAuthorProfileSuccess(profile));
    expect(loaded.authorProfile?.id).toBe('u1');
    expect(loaded.authorStatus).toBe(RequestState.SUCCESS);
  });

  it('appends author builds and clears author state', () => {
    const first = buildsReducer(initial, fetchAuthorBuildsSuccess({ items: [makeBuild('a')], cursor: null, hasMore: true, append: false }));
    const second = buildsReducer(first, fetchAuthorBuildsSuccess({ items: [makeBuild('b')], cursor: null, hasMore: false, append: true }));
    expect(second.authorBuilds.map((b) => b.id)).toEqual(['a', 'b']);

    const cleared = buildsReducer(second, clearAuthorProfile());
    expect(cleared.authorBuilds).toHaveLength(0);
    expect(cleared.authorStatus).toBe(RequestState.IDLE);
  });

  it('marks the author not found', () => {
    expect(buildsReducer(initial, fetchAuthorProfileNotFound()).authorNotFound).toBe(true);
  });

  it('tracks liked build ids: replace on fresh fetch, union on append', () => {
    const first = buildsReducer(
      initial,
      fetchBuildsSuccess({ items: [makeBuild('a'), makeBuild('b')], cursor: null, hasMore: true, append: false, likedIds: ['a'] })
    );
    expect(first.likedBuildIds).toEqual(['a']);

    const more = buildsReducer(
      first,
      fetchBuildsSuccess({ items: [makeBuild('c')], cursor: null, hasMore: false, append: true, likedIds: ['c'] })
    );
    expect([...more.likedBuildIds].sort()).toEqual(['a', 'c']);

    // A fresh (non-append) fetch replaces the liked set.
    const refetch = buildsReducer(
      more,
      fetchBuildsSuccess({ items: [makeBuild('a')], cursor: null, hasMore: false, append: false, likedIds: [] })
    );
    expect(refetch.likedBuildIds).toEqual([]);
  });

  it('tracks the author liked set and clears it', () => {
    const loaded = buildsReducer(
      initial,
      fetchAuthorBuildsSuccess({ items: [makeBuild('a')], cursor: null, hasMore: false, append: false, likedIds: ['a'] })
    );
    expect(loaded.authorLikedBuildIds).toEqual(['a']);

    expect(buildsReducer(loaded, clearAuthorProfile()).authorLikedBuildIds).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import type { Profile } from '@/core/supabase';
import type { BuildWithAuthor } from '../types';

// Mock Supabase query builder: chainable methods return the builder; the builder
// itself is thenable (resolves the list query), and `single()` resolves inserts.
const mocks = vi.hoisted(() => {
  const state = {
    listResult: { data: [] as unknown[] | null, error: null as { message: string } | null },
    singleResult: { data: null as { id: string } | null, error: null as { message: string } | null },
    // Result of the "which of these builds did the viewer like" query (terminated by .in()).
    likesResult: { data: [] as { build_id: string }[] | null, error: null as { message: string } | null },
    // When set, the next awaited query waits for this promise before resolving (one-shot),
    // so a test can hold one request in flight while others complete.
    nextGate: null as Promise<void> | null,
  };
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.ilike = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(state.singleResult));
  builder.maybeSingle = vi.fn();
  // The liked-ids lookup awaits the .in(...) result directly, so make it terminal here
  // (resolves likesResult) — keeping it off the shared `.then` that resolves listResult.
  builder.in = vi.fn(() => Promise.resolve(state.likesResult));
  // Resolve on a microtask (like a real network call) so the saga blocks at the
  // yield — letting optimistic state be observed before the request settles.
  // The result is captured when the request is made, so later changes to listResult
  // don't leak into an in-flight request.
  builder.then = (resolve: (value: unknown) => void) => {
    const result = state.listResult;
    const gate = state.nextGate ?? Promise.resolve();
    state.nextGate = null;
    void gate.then(() => {
      resolve(result);
    });
  };
  const client = { from: vi.fn(() => builder) };
  return { client, builder, state };
});

vi.mock('@/core/supabase', () => ({
  requireSupabase: () => mocks.client,
  isSupabaseConfigured: true,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { buildsSaga } from './buildsSaga';
import buildsReducer, {
  createBuildRequested,
  deleteBuildRequested,
  fetchAuthorProfileRequested,
  fetchBuildRequested,
  fetchBuildSuccess,
  fetchBuildsRequested,
  fetchMoreAuthorBuildsRequested,
  fetchMoreBuildsRequested,
  fetchRecentBuildsRequested,
  setClassFilter,
  setMyBuildsOnly,
  toggleLikeRequested,
  updateBuildRequested,
} from './buildsSlice';
import authReducer, { authStateChanged } from '@/features/auth/store/authSlice';
import { RequestState } from '@/core/types';
import { BUILD_DATA_MAX_BYTES, BUILDS_PAGE_SIZE, RECENT_BUILDS_COUNT } from '../constants';

function makeRow(id: string): BuildWithAuthor {
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

/** A full page of rows, so the list reports hasMore and load-more is possible. */
function makeFullPage(prefix: string): BuildWithAuthor[] {
  return Array.from({ length: BUILDS_PAGE_SIZE }, (_, index) => makeRow(`${prefix}${String(index)}`));
}

function makeProfileRow(id: string): Profile {
  return {
    id,
    display_name: 'Hero',
    discriminator: 4242,
    avatar_url: null,
    privacy_policy_accepted_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

const VALID_USER_ID = '11111111-1111-4111-8111-111111111111';

function setupStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { auth: authReducer, builds: buildsReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  sagaMiddleware.run(buildsSaga);
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.listResult = { data: [], error: null };
  mocks.state.singleResult = { data: null, error: null };
  mocks.state.likesResult = { data: [], error: null };
  mocks.state.nextGate = null;
  // maybeSingle is set per test; reset clears any prior once-queue (clearAllMocks does not).
  (mocks.builder.maybeSingle as Mock).mockReset();
});

describe('buildsSaga', () => {
  it('fetches builds and stores them', async () => {
    mocks.state.listResult = { data: [makeRow('a'), makeRow('b')], error: null };
    const store = setupStore();

    store.dispatch(fetchBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(2);
    });
    expect(mocks.client.from).toHaveBeenCalledWith('builds');
  });

  it('flags which listed builds the signed-in viewer has liked', async () => {
    mocks.state.listResult = { data: [makeRow('a'), makeRow('b')], error: null };
    mocks.state.likesResult = { data: [{ build_id: 'a' }], error: null };
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'u1', email: null } }));

    store.dispatch(fetchBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(2);
    });
    expect(store.getState().builds.likedBuildIds).toEqual(['a']);
    expect(mocks.builder.in as Mock).toHaveBeenCalledWith('build_id', ['a', 'b']);
  });

  it('does not query likes when the viewer is signed out', async () => {
    mocks.state.listResult = { data: [makeRow('a')], error: null };
    mocks.state.likesResult = { data: [{ build_id: 'a' }], error: null };
    const store = setupStore();

    store.dispatch(fetchBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(1);
    });
    expect(store.getState().builds.likedBuildIds).toEqual([]);
    expect(mocks.builder.in as Mock).not.toHaveBeenCalled();
  });

  it('records an error when the fetch fails', async () => {
    mocks.state.listResult = { data: null, error: { message: 'backend down' } };
    const store = setupStore();

    store.dispatch(fetchBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.listStatus).toBe(RequestState.ERROR);
    });
  });

  it('refetches with a class filter when the filter changes', async () => {
    mocks.state.listResult = { data: [makeRow('a')], error: null };
    const store = setupStore();

    store.dispatch(setClassFilter('Paladin'));

    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(1);
    });
    expect(mocks.builder.eq).toHaveBeenCalledWith('class', 'Paladin');
  });

  it('creates a build for the signed-in user', async () => {
    mocks.state.singleResult = { data: { id: 'new-1' }, error: null };
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'u1', email: null } }));

    store.dispatch(createBuildRequested({ name: 'Hammerdin', description: '', class: 'Paladin', buildData: {} }));

    await vi.waitFor(() => {
      expect(store.getState().builds.createStatus).toBe(RequestState.SUCCESS);
    });
    expect(mocks.builder.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', name: 'Hammerdin', class: 'Paladin' }));
  });

  it('fails to create a build when not signed in', async () => {
    const store = setupStore();

    store.dispatch(createBuildRequested({ name: 'X', description: '', class: 'Druid', buildData: {} }));

    await vi.waitFor(() => {
      expect(store.getState().builds.createStatus).toBe(RequestState.ERROR);
    });
  });

  it('refuses to create a build over the size cap without calling Supabase', async () => {
    const { toast } = await import('sonner');
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'u1', email: null } }));

    const buildData = { skills: 'x'.repeat(BUILD_DATA_MAX_BYTES) };
    store.dispatch(createBuildRequested({ name: 'Huge', description: '', class: 'Paladin', buildData }));

    await vi.waitFor(() => {
      expect(store.getState().builds.createStatus).toBe(RequestState.ERROR);
    });
    expect(store.getState().builds.error).toMatch(/^This build is too large to save \(1025 KB, limit 1024 KB\)/);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Remove some alternatives or variants.'));
    expect(mocks.builder.insert).not.toHaveBeenCalled();
  });

  it('loads a build by id', async () => {
    const validId = '11111111-1111-4111-8111-111111111111';
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: makeRow(validId), error: null });
    const store = setupStore();

    store.dispatch(fetchBuildRequested(validId));

    await vi.waitFor(() => {
      expect(store.getState().builds.detailBuild?.id).toBe(validId);
    });
    expect(store.getState().builds.detailLiked).toBe(false);
  });

  it('marks a build not found when missing', async () => {
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: null, error: null });
    const store = setupStore();

    store.dispatch(fetchBuildRequested('11111111-1111-4111-8111-111111111111'));

    await vi.waitFor(() => {
      expect(store.getState().builds.detailNotFound).toBe(true);
    });
  });

  it('treats a malformed build id as not found without querying', async () => {
    const store = setupStore();

    store.dispatch(fetchBuildRequested('not-a-uuid'));

    await vi.waitFor(() => {
      expect(store.getState().builds.detailNotFound).toBe(true);
    });
    expect(mocks.builder.maybeSingle).not.toHaveBeenCalled();
  });

  it('inserts a like optimistically and settles on success', async () => {
    mocks.state.listResult = { data: [], error: null };
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'u1', email: null } }));
    store.dispatch(fetchBuildSuccess({ build: makeRow('b1'), liked: false }));

    store.dispatch(toggleLikeRequested());
    expect(store.getState().builds.detailLiked).toBe(true); // optimistic

    await vi.waitFor(() => {
      expect(store.getState().builds.likePending).toBe(false);
    });
    expect(store.getState().builds.detailLiked).toBe(true);
    expect(mocks.builder.insert).toHaveBeenCalledWith({ build_id: 'b1', user_id: 'u1' });
  });

  it('reverts the optimistic like when the request fails', async () => {
    mocks.state.listResult = { data: null, error: { message: 'nope' } };
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'u1', email: null } }));
    store.dispatch(fetchBuildSuccess({ build: makeRow('b1'), liked: false }));

    store.dispatch(toggleLikeRequested());
    expect(store.getState().builds.detailLiked).toBe(true); // optimistic

    await vi.waitFor(() => {
      expect(store.getState().builds.likePending).toBe(false);
    });
    expect(store.getState().builds.detailLiked).toBe(false); // reverted
  });

  it('deletes a build', async () => {
    mocks.state.listResult = { data: [], error: null };
    const store = setupStore();

    store.dispatch(deleteBuildRequested('b1'));

    await vi.waitFor(() => {
      expect(store.getState().builds.deleteStatus).toBe(RequestState.SUCCESS);
    });
    expect(mocks.client.from).toHaveBeenCalledWith('builds');
  });

  it('updates a build', async () => {
    mocks.state.listResult = { data: [], error: null };
    const store = setupStore();

    store.dispatch(updateBuildRequested({ id: 'b1', name: 'Updated', description: '', class: 'Paladin', buildData: {} }));

    await vi.waitFor(() => {
      expect(store.getState().builds.updateStatus).toBe(RequestState.SUCCESS);
    });
    expect(mocks.builder.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
  });

  it('refuses to update a build whose refreshed data is over the size cap without calling Supabase', async () => {
    const { toast } = await import('sonner');
    const store = setupStore();

    const buildData = { items: { gloves: { type: 'freetext', name: 'x'.repeat(BUILD_DATA_MAX_BYTES) } } } as const;
    store.dispatch(updateBuildRequested({ id: 'b1', name: 'Huge', description: '', class: 'Paladin', buildData }));

    await vi.waitFor(() => {
      expect(store.getState().builds.updateStatus).toBe(RequestState.ERROR);
    });
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^This build is too large to save/));
    expect(mocks.builder.update).not.toHaveBeenCalled();
  });

  it('loads an author profile and their first page of builds', async () => {
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: makeProfileRow(VALID_USER_ID), error: null });
    mocks.state.listResult = { data: [makeRow('a'), makeRow('b')], error: null };
    const store = setupStore();

    store.dispatch(fetchAuthorProfileRequested(VALID_USER_ID));

    await vi.waitFor(() => {
      expect(store.getState().builds.authorProfile?.id).toBe(VALID_USER_ID);
      expect(store.getState().builds.authorBuilds).toHaveLength(2);
    });
    expect(mocks.builder.eq).toHaveBeenCalledWith('user_id', VALID_USER_ID);
  });

  it('treats a malformed author id as not found without querying', async () => {
    const store = setupStore();

    store.dispatch(fetchAuthorProfileRequested('not-a-uuid'));

    await vi.waitFor(() => {
      expect(store.getState().builds.authorNotFound).toBe(true);
    });
    expect(mocks.builder.maybeSingle).not.toHaveBeenCalled();
  });

  it('marks the author not found when the profile is missing', async () => {
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: null, error: null });
    const store = setupStore();

    store.dispatch(fetchAuthorProfileRequested(VALID_USER_ID));

    await vi.waitFor(() => {
      expect(store.getState().builds.authorNotFound).toBe(true);
    });
  });

  it('resets the My Builds filter on sign-out so the list cannot get stuck', async () => {
    mocks.state.listResult = { data: [makeRow('a')], error: null };
    const store = setupStore();
    store.dispatch(authStateChanged({ user: { id: 'u1', email: null } }));
    store.dispatch(setMyBuildsOnly(true));
    await vi.waitFor(() => {
      expect(store.getState().builds.myBuildsOnly).toBe(true);
    });

    store.dispatch(authStateChanged({ user: null }));

    await vi.waitFor(() => {
      expect(store.getState().builds.myBuildsOnly).toBe(false);
    });
  });

  it('appends the next page of author builds', async () => {
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: makeProfileRow(VALID_USER_ID), error: null });
    mocks.state.listResult = { data: [makeRow('a')], error: null };
    const store = setupStore();

    store.dispatch(fetchAuthorProfileRequested(VALID_USER_ID));
    await vi.waitFor(() => {
      expect(store.getState().builds.authorBuilds).toHaveLength(1);
    });

    mocks.state.listResult = { data: [makeRow('b')], error: null };
    store.dispatch(fetchMoreAuthorBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.authorBuilds).toHaveLength(2);
    });
  });
  it('flags a failed load-more without touching the loaded list or retrying', async () => {
    mocks.state.listResult = { data: makeFullPage('a'), error: null };
    const store = setupStore();
    store.dispatch(fetchBuildsRequested());
    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(BUILDS_PAGE_SIZE);
    });

    mocks.state.listResult = { data: null, error: { message: 'backend down' } };
    store.dispatch(fetchMoreBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.loadMoreError).toBe('backend down');
    });
    const callsAfterFailure = mocks.client.from.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const builds = store.getState().builds;
    expect(mocks.client.from.mock.calls.length).toBe(callsAfterFailure);
    expect(builds.items).toHaveLength(BUILDS_PAGE_SIZE);
    expect(builds.listStatus).toBe(RequestState.SUCCESS);
    expect(builds.error).toBeNull();
    expect(builds.loadingMore).toBe(false);
    expect(builds.hasMore).toBe(true);

    // An explicit retry clears the flag and appends the page.
    mocks.state.listResult = { data: [makeRow('b')], error: null };
    store.dispatch(fetchMoreBuildsRequested());
    expect(store.getState().builds.loadMoreError).toBeNull();
    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(BUILDS_PAGE_SIZE + 1);
    });
  });

  it('drops an in-flight load-more page when the list is refetched', async () => {
    mocks.state.listResult = { data: makeFullPage('a'), error: null };
    const store = setupStore();
    store.dispatch(fetchBuildsRequested());
    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(BUILDS_PAGE_SIZE);
    });

    // Hold the load-more request in flight until after the refetch has settled.
    let releaseStale = () => {};
    mocks.state.nextGate = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    mocks.state.listResult = { data: [makeRow('stale')], error: null };
    store.dispatch(fetchMoreBuildsRequested());

    mocks.state.listResult = { data: [makeRow('fresh')], error: null };
    store.dispatch(setClassFilter('Paladin'));
    expect(store.getState().builds.loadingMore).toBe(false);
    await vi.waitFor(() => {
      expect(store.getState().builds.items.map((item) => item.id)).toEqual(['fresh']);
    });

    releaseStale();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().builds.items.map((item) => item.id)).toEqual(['fresh']);
  });

  it('reports an author builds failure on the builds list, not the profile', async () => {
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: makeProfileRow(VALID_USER_ID), error: null });
    mocks.state.listResult = { data: null, error: { message: 'builds down' } };
    const store = setupStore();

    store.dispatch(fetchAuthorProfileRequested(VALID_USER_ID));

    await vi.waitFor(() => {
      expect(store.getState().builds.authorBuildsError).toBe('builds down');
    });
    const builds = store.getState().builds;
    expect(builds.authorProfile?.id).toBe(VALID_USER_ID);
    expect(builds.authorStatus).toBe(RequestState.SUCCESS);
    expect(builds.authorBuilds).toEqual([]);
  });

  it('flags a failed author load-more without retrying', async () => {
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: makeProfileRow(VALID_USER_ID), error: null });
    mocks.state.listResult = { data: makeFullPage('a'), error: null };
    const store = setupStore();
    store.dispatch(fetchAuthorProfileRequested(VALID_USER_ID));
    await vi.waitFor(() => {
      expect(store.getState().builds.authorBuilds).toHaveLength(BUILDS_PAGE_SIZE);
    });

    mocks.state.listResult = { data: null, error: { message: 'backend down' } };
    store.dispatch(fetchMoreAuthorBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.authorBuildsError).toBe('backend down');
    });
    const builds = store.getState().builds;
    expect(builds.authorBuildsLoadingMore).toBe(false);
    expect(builds.authorBuilds).toHaveLength(BUILDS_PAGE_SIZE);
  });

  it('requests list columns without build_data for the listing and the full row for the detail page', async () => {
    mocks.state.listResult = { data: [makeRow('a')], error: null };
    (mocks.builder.maybeSingle as Mock).mockResolvedValue({ data: makeRow(VALID_USER_ID), error: null });
    const store = setupStore();

    store.dispatch(fetchBuildsRequested());
    await vi.waitFor(() => {
      expect(store.getState().builds.items).toHaveLength(1);
    });
    store.dispatch(fetchBuildRequested(VALID_USER_ID));
    await vi.waitFor(() => {
      expect(store.getState().builds.detailBuild?.id).toBe(VALID_USER_ID);
    });

    const selects = (mocks.builder.select as Mock).mock.calls.map((call) => String(call[0]));
    const [listSelect, detailSelect] = selects;
    expect(listSelect).not.toContain('*');
    expect(listSelect).not.toContain('build_data');
    expect(listSelect).not.toContain('description');
    expect(detailSelect.startsWith('*')).toBe(true);
  });

  it('loads the newest builds for the home strip without touching the /builds list or its filters', async () => {
    mocks.state.listResult = { data: [makeRow('n1'), makeRow('n2'), makeRow('n3')], error: null };
    const store = setupStore();
    store.dispatch(setClassFilter('Paladin'));
    await vi.waitFor(() => {
      expect(store.getState().builds.listStatus).toBe(RequestState.SUCCESS);
    });
    (mocks.builder.eq as Mock).mockClear();
    const listBefore = store.getState().builds.items;

    store.dispatch(fetchRecentBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.recentStatus).toBe(RequestState.SUCCESS);
    });
    const builds = store.getState().builds;
    expect(builds.recentBuilds.map((b) => b.id)).toEqual(['n1', 'n2', 'n3']);
    expect(builds.items).toBe(listBefore);
    expect(builds.classFilter).toBe('Paladin');
    expect(mocks.builder.limit as Mock).toHaveBeenLastCalledWith(RECENT_BUILDS_COUNT);
    expect(mocks.builder.eq as Mock).not.toHaveBeenCalled();
  });

  it('marks the home strip failed on a query error', async () => {
    mocks.state.listResult = { data: null, error: { message: 'down' } };
    const store = setupStore();

    store.dispatch(fetchRecentBuildsRequested());

    await vi.waitFor(() => {
      expect(store.getState().builds.recentStatus).toBe(RequestState.ERROR);
    });
    expect(store.getState().builds.error).toBeNull();
  });
});

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
  builder.then = (resolve: (value: unknown) => void) => {
    Promise.resolve().then(() => {
      resolve(state.listResult);
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
  setClassFilter,
  toggleLikeRequested,
  updateBuildRequested,
} from './buildsSlice';
import authReducer, { authStateChanged } from '@/features/auth/store/authSlice';
import { RequestState } from '@/core/types';

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
});

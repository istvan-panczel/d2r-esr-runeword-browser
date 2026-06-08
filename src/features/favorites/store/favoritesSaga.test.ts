import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

// Mock Supabase query builder. Chainable methods return the builder, which is
// thenable; what it resolves to depends on the table and whether the call was a
// read (select) or a write (insert/upsert/delete).
const mocks = vi.hoisted(() => {
  const state = {
    table: '',
    op: '' as '' | 'read' | 'write',
    countsResult: { data: [] as { item_id: string; count: number }[] | null, error: null as { message: string } | null },
    favoritesResult: { data: [] as { item_id: string }[] | null, error: null as { message: string } | null },
    writeResult: { error: null as { message: string } | null },
  };
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => {
    state.op = 'read';
    return builder;
  });
  builder.eq = vi.fn(() => builder);
  builder.insert = vi.fn(() => {
    state.op = 'write';
    return builder;
  });
  builder.upsert = vi.fn(() => {
    state.op = 'write';
    return builder;
  });
  builder.delete = vi.fn(() => {
    state.op = 'write';
    return builder;
  });
  // Resolve on a microtask (like a real network call) so the saga blocks at the
  // yield, letting optimistic state be observed before the request settles.
  builder.then = (resolve: (value: unknown) => void) => {
    Promise.resolve().then(() => {
      if (state.op === 'write') resolve(state.writeResult);
      else if (state.table === 'favorite_counts') resolve(state.countsResult);
      else resolve(state.favoritesResult);
    });
  };
  const client = {
    from: vi.fn((table: string) => {
      state.table = table;
      state.op = '';
      return builder;
    }),
  };
  return { client, builder, state };
});

vi.mock('@/core/supabase', () => ({
  requireSupabase: () => mocks.client,
  isSupabaseConfigured: true,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { favoritesSaga } from './favoritesSaga';
import favoritesReducer, { toggleFavoriteRequested } from './favoritesSlice';
import authReducer, { authStateChanged } from '@/features/auth/store/authSlice';
import { RequestState } from '@/core/types';

const USER = { id: 'u1', email: null };

function setupStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { auth: authReducer, favorites: favoritesReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  sagaMiddleware.run(favoritesSaga);
  return store;
}

// Sign in and wait until the user's favourites have loaded.
async function signIn(store: ReturnType<typeof setupStore>) {
  store.dispatch(authStateChanged({ user: USER }));
  await vi.waitFor(() => {
    expect(store.getState().favorites.status).toBe(RequestState.SUCCESS);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.state.table = '';
  mocks.state.op = '';
  mocks.state.countsResult = { data: [], error: null };
  mocks.state.favoritesResult = { data: [], error: null };
  mocks.state.writeResult = { error: null };
});

describe('favoritesSaga', () => {
  it('loads public favourite counts on startup', async () => {
    mocks.state.countsResult = { data: [{ item_id: 'runeword:Spirit:1', count: 3 }], error: null };
    const store = setupStore();

    await vi.waitFor(() => {
      expect(store.getState().favorites.countsStatus).toBe(RequestState.SUCCESS);
    });
    expect(store.getState().favorites.counts).toEqual({ 'runeword:Spirit:1': 3 });
    expect(mocks.client.from).toHaveBeenCalledWith('favorite_counts');
  });

  it("loads the user's favourites on sign-in", async () => {
    mocks.state.favoritesResult = { data: [{ item_id: 'gemword:Black:1' }], error: null };
    const store = setupStore();
    await vi.waitFor(() => {
      expect(store.getState().favorites.countsStatus).toBe(RequestState.SUCCESS);
    });

    await signIn(store);
    expect(store.getState().favorites.favoriteItemIds).toEqual(['gemword:Black:1']);
  });

  it('migrates leftover localStorage favourites to the cloud on first sign-in', async () => {
    localStorage.setItem('d2r-esr.runewords.favoriteRecipes.v1', JSON.stringify(['runeword:Spirit:1']));
    mocks.state.favoritesResult = { data: [{ item_id: 'gemword:Black:1' }], error: null };
    const store = setupStore();
    await vi.waitFor(() => {
      expect(store.getState().favorites.countsStatus).toBe(RequestState.SUCCESS);
    });

    await signIn(store);

    expect(new Set(store.getState().favorites.favoriteItemIds)).toEqual(new Set(['gemword:Black:1', 'runeword:Spirit:1']));
    expect(mocks.builder.upsert).toHaveBeenCalledWith(
      [{ user_id: 'u1', item_id: 'runeword:Spirit:1' }],
      expect.objectContaining({ ignoreDuplicates: true })
    );
    // Legacy data cleared and migration recorded so it won't run again.
    expect(localStorage.getItem('d2r-esr.runewords.favoriteRecipes.v1')).toBeNull();
    expect(localStorage.getItem('d2r-esr.favorites.migratedToCloud.v1')).toBe('true');
  });

  it('inserts a favourite optimistically and settles on success', async () => {
    const store = setupStore();
    await vi.waitFor(() => {
      expect(store.getState().favorites.countsStatus).toBe(RequestState.SUCCESS);
    });
    await signIn(store);

    store.dispatch(toggleFavoriteRequested('runeword:Spirit:1'));
    expect(store.getState().favorites.favoriteItemIds).toContain('runeword:Spirit:1'); // optimistic
    expect(store.getState().favorites.pendingItemIds).toContain('runeword:Spirit:1');

    await vi.waitFor(() => {
      expect(store.getState().favorites.pendingItemIds).toHaveLength(0);
    });
    expect(store.getState().favorites.favoriteItemIds).toContain('runeword:Spirit:1');
    expect(mocks.builder.insert).toHaveBeenCalledWith({ user_id: 'u1', item_id: 'runeword:Spirit:1' });
  });

  it('ignores a duplicate in-flight toggle for the same item', async () => {
    const store = setupStore();
    await vi.waitFor(() => {
      expect(store.getState().favorites.countsStatus).toBe(RequestState.SUCCESS);
    });
    await signIn(store);

    // Two dispatches before the first write settles (a stray duplicate). The first
    // wins; the duplicate is undone and never fires a second network write.
    store.dispatch(toggleFavoriteRequested('runeword:Spirit:1'));
    store.dispatch(toggleFavoriteRequested('runeword:Spirit:1'));

    await vi.waitFor(() => {
      expect(store.getState().favorites.pendingItemIds).toHaveLength(0);
    });
    expect(store.getState().favorites.favoriteItemIds).toContain('runeword:Spirit:1');
    expect(mocks.builder.insert).toHaveBeenCalledTimes(1);
  });

  it('reverts the optimistic favourite when the write fails', async () => {
    const store = setupStore();
    await vi.waitFor(() => {
      expect(store.getState().favorites.countsStatus).toBe(RequestState.SUCCESS);
    });
    await signIn(store);

    mocks.state.writeResult = { error: { message: 'nope' } };
    store.dispatch(toggleFavoriteRequested('runeword:Spirit:1'));
    expect(store.getState().favorites.favoriteItemIds).toContain('runeword:Spirit:1'); // optimistic

    await vi.waitFor(() => {
      expect(store.getState().favorites.pendingItemIds).toHaveLength(0);
    });
    expect(store.getState().favorites.favoriteItemIds).not.toContain('runeword:Spirit:1'); // reverted
  });

  it('clears the user favourites on sign-out but keeps public counts', async () => {
    mocks.state.countsResult = { data: [{ item_id: 'runeword:Spirit:1', count: 2 }], error: null };
    mocks.state.favoritesResult = { data: [{ item_id: 'gemword:Black:1' }], error: null };
    const store = setupStore();
    await vi.waitFor(() => {
      expect(store.getState().favorites.countsStatus).toBe(RequestState.SUCCESS);
    });
    await signIn(store);
    expect(store.getState().favorites.favoriteItemIds).toHaveLength(1);

    store.dispatch(authStateChanged({ user: null }));

    await vi.waitFor(() => {
      expect(store.getState().favorites.favoriteItemIds).toHaveLength(0);
    });
    expect(store.getState().favorites.counts).toEqual({ 'runeword:Spirit:1': 2 });
  });
});

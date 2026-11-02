import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

// The card download: one detail-style query (`maybeSingle`), then the file is saved and the download counted.
const mocks = vi.hoisted(() => {
  const state = {
    detailResult: { data: null, error: null } as { data: unknown; error: { message: string } | null },
    calls: [] as { method: string; args: unknown[] }[],
  };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) {
    builder[method] = (...args: unknown[]) => {
      state.calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(state.detailResult);
  const client = {
    from: vi.fn(() => builder),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  };
  return { client, state, downloadFilter: vi.fn(() => Promise.resolve('json')) };
});

vi.mock('@/core/supabase', () => ({
  requireSupabase: () => mocks.client,
  isSupabaseConfigured: true,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../utils/download', () => ({ downloadFilter: mocks.downloadFilter }));

import { toast } from 'sonner';
import authReducer from '@/features/auth/store/authSlice';
import { DOWNLOAD_SELECT, lootFilterSharingSaga } from './sharingSaga';
import sharingReducer, { downloadSharedFilterRequested, fetchSharedFiltersSuccess, selectDownloadingFilterIdSet } from './sharingSlice';
import { filterId, makeSummary } from './sharing.mock';

const A = filterId(1);

function setupStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { auth: authReducer, lootFilterSharing: sharingReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  sagaMiddleware.run(lootFilterSharingSaga);
  store.dispatch(
    fetchSharedFiltersSuccess({ items: [makeSummary(A, { download_count: 2 })], cursor: null, hasMore: false, append: false })
  );
  return store;
}

type TestStore = ReturnType<typeof setupStore>;
// The selector is typed for the app's RootState; these stores hold the slices it reads.
const downloading = (store: TestStore) => selectDownloadingFilterIdSet(store.getState() as never).has(A);
const count = (store: TestStore) => store.getState().lootFilterSharing.shared.items[0].download_count;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.detailResult = { data: null, error: null };
  mocks.state.calls = [];
});

describe('downloadSharedFilterRequested', () => {
  it('fetches the file, saves it, counts the download and clears the in-flight state', async () => {
    mocks.state.detailResult = { data: { id: A, name: 'My filter', content: '{"rules":[]}' }, error: null };
    const store = setupStore();

    store.dispatch(downloadSharedFilterRequested(A));
    expect(downloading(store)).toBe(true);

    await vi.waitFor(() => {
      expect(downloading(store)).toBe(false);
    });
    expect(mocks.client.from).toHaveBeenCalledWith('loot_filters');
    expect(mocks.state.calls).toEqual([
      { method: 'select', args: [DOWNLOAD_SELECT] },
      { method: 'eq', args: ['id', A] },
    ]);
    expect(mocks.downloadFilter).toHaveBeenCalledWith('My filter', '{"rules":[]}');
    expect(count(store)).toBe(3);
    await vi.waitFor(() => {
      expect(mocks.client.rpc).toHaveBeenCalledWith('increment_loot_filter_download', { filter_id: A });
    });
  });

  it('says so when the filter is gone, without counting', async () => {
    const store = setupStore();

    store.dispatch(downloadSharedFilterRequested(A));

    await vi.waitFor(() => {
      expect(downloading(store)).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith('This loot filter is no longer shared.');
    expect(mocks.downloadFilter).not.toHaveBeenCalled();
    expect(count(store)).toBe(2);
  });

  it('reports a failed fetch or save without counting', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.state.detailResult = { data: null, error: { message: 'down' } };
    const store = setupStore();

    store.dispatch(downloadSharedFilterRequested(A));

    await vi.waitFor(() => {
      expect(downloading(store)).toBe(false);
    });
    expect(toast.error).toHaveBeenCalledWith('Could not download the loot filter. Please try again.');
    expect(count(store)).toBe(2);

    mocks.state.detailResult = { data: { id: A, name: 'My filter', content: '{}' }, error: null };
    mocks.downloadFilter.mockRejectedValueOnce(new Error('zip failed'));
    store.dispatch(downloadSharedFilterRequested(A));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(2);
    });
    expect(count(store)).toBe(2);
    consoleError.mockRestore();
  });

  it('never queries for an id that is not a saved filter', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = setupStore();

    store.dispatch(downloadSharedFilterRequested('sully'));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(mocks.client.from).not.toHaveBeenCalled();
    expect(selectDownloadingFilterIdSet(store.getState() as never).size).toBe(0);
    consoleError.mockRestore();
  });
});

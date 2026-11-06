import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { toast } from 'sonner';
import { db } from '@/core/db';
import appVersion from '@/assets/version.json';
import { dataSyncSaga } from './dataSyncSaga';
import dataSyncReducer, { fetchHtmlSuccess, initDataLoad, parseDataSuccess, type FetchedHtmlData } from './dataSyncSlice';
import type { ParsedData } from '../interfaces';
import type { Runeword } from '@/core/db';

// Lets individual tests make the first parser throw; otherwise the real parser runs
const parserControl = vi.hoisted(() => ({ parseGemsError: null as Error | null }));

vi.mock('../parsers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../parsers')>();
  return {
    ...actual,
    parseGemsHtml: (html: string) => {
      if (parserControl.parseGemsError) throw parserControl.parseGemsError;
      return actual.parseGemsHtml(html);
    },
  };
});

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const EMPTY_PARSED_DATA: ParsedData = {
  gems: [],
  esrRunes: [],
  lodRunes: [],
  kanjiRunes: [],
  crystals: [],
  runewords: [],
  gemwords: [],
  htmUniqueItems: [],
  mythicalUniques: [],
  ascendancies: [],
  ascendancyChallenges: [],
};

const EMPTY_FETCHED_HTML: FetchedHtmlData = {
  gemsHtml: '',
  gemwordsHtml: '',
  runewordsHtml: '',
  uniqueWeaponsHtml: '',
  uniqueArmorsHtml: '',
  uniqueOthersHtml: '',
  mythicalsHtml: '',
  ascendanciesHtml: '',
  esrVersion: '9.9.9',
};

// Only the primary key matters for the cache check and rollback assertions
const CACHED_RUNEWORD = { name: 'Cached', variant: 1 } as Runeword;

const DATASETS = [
  'gems',
  'esrRunes',
  'lodRunes',
  'kanjiRunes',
  'crystals',
  'runewords',
  'gemwords',
  'htmUniqueItems',
  'mythicalUniques',
  'ascendancies',
] as const;

// Minimal stand-in rows: only a primary key ([name+variant] or name; ++id tables auto-assign)
function fakeRows(prefix: string, count: number): never[] {
  return Array.from({ length: count }, (_, i) => ({ name: `${prefix}${String(i)}`, variant: 1 }) as never);
}

function fullParsedData(count = 10): ParsedData {
  const datasets = Object.fromEntries(DATASETS.map((dataset) => [dataset, fakeRows('fresh', count)])) as unknown as ParsedData;
  return { ...datasets, ascendancyChallenges: [] };
}

/** Populates every dataset table with `count` rows and stamps an old ESR version. */
async function seedCache(count = 10) {
  await Promise.all(DATASETS.map((dataset) => db.table(dataset).bulkPut(fakeRows('cached', count))));
  await db.metadata.put({ key: 'esrVersion', value: '1.0.0' });
}

async function expectCacheUntouched(count = 10) {
  for (const dataset of DATASETS) {
    expect(await db.table(dataset).count()).toBe(count);
  }
  expect(await db.gems.get('fresh0')).toBeUndefined();
  expect((await db.metadata.get('esrVersion'))?.value).toBe('1.0.0');
  expect(await db.metadata.get('lastUpdated')).toBeUndefined();
}

function createTestStore() {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { dataSync: dataSyncReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  sagaMiddleware.run(dataSyncSaga);
  return store;
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(toast.warning).mockClear();
  parserControl.parseGemsError = null;
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('dataSyncSaga store step', () => {
  it('stores data and metadata transactionally using the version from the action payload', async () => {
    const sagaMiddleware = createSagaMiddleware();
    const store = configureStore({
      reducer: { dataSync: dataSyncReducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
    });
    sagaMiddleware.run(dataSyncSaga);

    // Triggers handleStoreData; with esrVersion in the payload no network
    // fetch happens, and all writes run inside a single Dexie transaction.
    store.dispatch(parseDataSuccess({ ...fullParsedData(), esrVersion: '9.9.9' }));

    await vi.waitFor(async () => {
      const esrVersionMeta = await db.metadata.get('esrVersion');
      expect(esrVersionMeta?.value).toBe('9.9.9');
    });

    const appVersionMeta = await db.metadata.get('appVersion');
    const lastUpdatedMeta = await db.metadata.get('lastUpdated');
    expect(appVersionMeta?.value).toBe(appVersion.version);
    expect(lastUpdatedMeta?.value).toBeTruthy();
    expect(await db.runewords.count()).toBe(10);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('stores the ascendancy challenges in their own table', async () => {
    const store = createTestStore();
    const challenge = {
      tier: 2,
      description: ['Kill Nihlathak.'],
      recipes: [{ inputs: ['Ascendancy Stone'], outputs: ['Upgraded to Tier 2'] }],
    };

    store.dispatch(parseDataSuccess({ ...fullParsedData(), ascendancyChallenges: [challenge], esrVersion: '9.9.9' }));

    await vi.waitFor(async () => {
      expect((await db.metadata.get('esrVersion'))?.value).toBe('9.9.9');
    });
    expect(await db.ascendancyChallenges.toArray()).toEqual([challenge]);
  });

  it('stores the other data when the page had no challenge section', async () => {
    const store = createTestStore();
    await db.ascendancyChallenges.put({ tier: 1, description: ['Old'], recipes: [] });

    store.dispatch(parseDataSuccess({ ...fullParsedData(), esrVersion: '9.9.9' }));

    await vi.waitFor(async () => {
      expect((await db.metadata.get('esrVersion'))?.value).toBe('9.9.9');
    });
    expect(await db.ascendancies.count()).toBe(10);
    expect(await db.ascendancyChallenges.count()).toBe(0);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('stores the docs Last-Modified date alongside the ESR version', async () => {
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), esrVersion: '3.2.24', docsLastModified: '2026-10-21T09:49:06.000Z' }));

    await vi.waitFor(async () => {
      expect((await db.metadata.get('docsLastModified'))?.value).toBe('2026-10-21T09:49:06.000Z');
    });
    expect((await db.metadata.get('esrVersion'))?.value).toBe('3.2.24');
  });

  it('omits docsLastModified when the header was missing', async () => {
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), esrVersion: '3.2.24' }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    expect(await db.metadata.get('docsLastModified')).toBeUndefined();
  });
});

describe('dataSyncSaga fetch failure', () => {
  it('warns and keeps the cached data when a forced refresh fails', async () => {
    await db.runewords.put(CACHED_RUNEWORD);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const store = createTestStore();

    store.dispatch(initDataLoad({ force: true }));

    const warning = 'Refresh failed: offline. Still using cached data.';
    await vi.waitFor(() => {
      expect(store.getState().dataSync.networkWarning).toBe(warning);
    });
    const state = store.getState().dataSync;
    expect(state.isInitialized).toBe(true);
    expect(state.isUsingCachedData).toBe(true);
    expect(state.error).toBeNull();
    expect(toast.warning).toHaveBeenCalledWith(warning, { description: 'See Settings for details.' });
    expect(await db.runewords.count()).toBe(1);
  });

  it('reports a fatal error when a forced refresh fails and there is no cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const store = createTestStore();

    store.dispatch(initDataLoad({ force: true }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.error).toBe('Unable to load data. Please check your internet connection and try again.');
    });
    expect(store.getState().dataSync.isInitialized).toBe(false);
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe('dataSyncSaga parse/store failure fallback', () => {
  it('falls back to cached data with a warning when parsing fails and a cache exists', async () => {
    await db.runewords.put(CACHED_RUNEWORD);
    parserControl.parseGemsError = new Error('unexpected HTML format');
    const store = createTestStore();

    store.dispatch(fetchHtmlSuccess(EMPTY_FETCHED_HTML));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    const state = store.getState().dataSync;
    expect(state.isUsingCachedData).toBe(true);
    expect(state.networkWarning).toBe('Unable to process the latest data. Using cached version.');
    expect(state.error).toBeNull();
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith('Unable to process the latest data. Using cached version.', {
      description: 'See Settings for details.',
    });
  });

  it('reports a parse error when parsing fails and there is no cache', async () => {
    parserControl.parseGemsError = new Error('unexpected HTML format');
    const store = createTestStore();

    store.dispatch(fetchHtmlSuccess(EMPTY_FETCHED_HTML));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.error).toBe('Failed to parse data: unexpected HTML format');
    });
    const state = store.getState().dataSync;
    expect(state.isInitialized).toBe(false);
    expect(state.networkWarning).toBeNull();
  });

  it('keeps the rolled-back cache and falls back to it with a warning when storing fails', async () => {
    await db.runewords.put(CACHED_RUNEWORD);
    const store = createTestStore();

    // A runeword without its primary key fails bulkPut inside the transaction,
    // which rolls back the clear() so the previous cache survives
    store.dispatch(parseDataSuccess({ ...fullParsedData(), runewords: [{} as Runeword], esrVersion: '9.9.9' }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    const state = store.getState().dataSync;
    expect(state.isUsingCachedData).toBe(true);
    expect(state.networkWarning).toBe('Unable to process the latest data. Using cached version.');
    expect(state.error).toBeNull();
    expect(await db.runewords.count()).toBe(1);
    expect(await db.metadata.get('esrVersion')).toBeUndefined();
  });

  it('reports a store error when storing fails and there is no cache', async () => {
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), runewords: [{} as Runeword], esrVersion: '9.9.9' }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.error).toMatch(/^Failed to store data: /);
    });
    const state = store.getState().dataSync;
    expect(state.isInitialized).toBe(false);
    expect(state.networkWarning).toBeNull();
  });
});

describe('dataSyncSaga store sanity check', () => {
  it('keeps the cache untouched and warns when a dataset parses empty', async () => {
    await seedCache();
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), htmUniqueItems: [], esrVersion: '9.9.9' }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    const state = store.getState().dataSync;
    const warning = 'Could not read the latest Unique Items data. Showing the previously cached version.';
    expect(state.isUsingCachedData).toBe(true);
    expect(state.networkWarning).toBe(warning);
    expect(state.error).toBeNull();
    await expectCacheUntouched();
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(warning, { description: 'See Settings for details.' });
  });

  it('keeps the cache untouched when a dataset shrinks below half of the cached count', async () => {
    await seedCache();
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), runewords: fakeRows('fresh', 4), mythicalUniques: [], esrVersion: '9.9.9' }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    const state = store.getState().dataSync;
    expect(state.isUsingCachedData).toBe(true);
    expect(state.networkWarning).toBe('Could not read the latest Runewords, Mythical Uniques data. Showing the previously cached version.');
    expect(state.error).toBeNull();
    await expectCacheUntouched();
  });

  it('stores normally when a dataset shrinks but stays above half of the cached count', async () => {
    await seedCache();
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), runewords: fakeRows('fresh', 6), esrVersion: '9.9.9' }));

    await vi.waitFor(async () => {
      expect((await db.metadata.get('esrVersion'))?.value).toBe('9.9.9');
    });
    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    expect(await db.runewords.count()).toBe(6);
    expect(await db.gems.get('cached0')).toBeUndefined();
    const state = store.getState().dataSync;
    expect(state.isUsingCachedData).toBe(false);
    expect(state.networkWarning).toBeNull();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('keeps the cache on a force refresh (no version in payload) that trips the check', async () => {
    await seedCache();
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), gemwords: [] }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    expect(store.getState().dataSync.networkWarning).toBe(
      'Could not read the latest Gemwords data. Showing the previously cached version.'
    );
    await expectCacheUntouched();
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('stores the usable datasets without the ESR version when there is no cache', async () => {
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...fullParsedData(), htmUniqueItems: [], esrVersion: '9.9.9' }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.isInitialized).toBe(true);
    });
    const state = store.getState().dataSync;
    const warning = 'Could not read the latest Unique Items data. Other data was loaded; this will be retried on the next start.';
    expect(state.isUsingCachedData).toBe(false);
    expect(state.networkWarning).toBe(warning);
    expect(state.error).toBeNull();
    expect(await db.runewords.count()).toBe(10);
    expect(await db.htmUniqueItems.count()).toBe(0);
    expect(await db.metadata.get('esrVersion')).toBeUndefined();
    expect((await db.metadata.get('appVersion'))?.value).toBe(appVersion.version);
    expect((await db.metadata.get('lastUpdated'))?.value).toBeTruthy();
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(warning, { description: 'See Settings for details.' });
  });

  it('reports a store error when every dataset is empty and there is no cache', async () => {
    const store = createTestStore();

    store.dispatch(parseDataSuccess({ ...EMPTY_PARSED_DATA, esrVersion: '9.9.9' }));

    await vi.waitFor(() => {
      expect(store.getState().dataSync.error).toBe('Failed to store data: No data could be read from the latest documentation');
    });
    const state = store.getState().dataSync;
    expect(state.isInitialized).toBe(false);
    expect(state.networkWarning).toBeNull();
    expect(await db.metadata.count()).toBe(0);
  });
});

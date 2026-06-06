import { describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { db } from '@/core/db';
import appVersion from '@/assets/version.json';
import { dataSyncSaga } from './dataSyncSaga';
import dataSyncReducer, { parseDataSuccess } from './dataSyncSlice';
import type { ParsedData } from '../interfaces';

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
};

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
    store.dispatch(parseDataSuccess({ ...EMPTY_PARSED_DATA, esrVersion: '9.9.9' }));

    await vi.waitFor(async () => {
      const esrVersionMeta = await db.metadata.get('esrVersion');
      expect(esrVersionMeta?.value).toBe('9.9.9');
    });

    const appVersionMeta = await db.metadata.get('appVersion');
    const lastUpdatedMeta = await db.metadata.get('lastUpdated');
    expect(appVersionMeta?.value).toBe(appVersion.version);
    expect(lastUpdatedMeta?.value).toBeTruthy();
  });
});

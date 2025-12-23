import { all, call, put, takeLatest } from 'redux-saga/effects';
import { initDataLoad, setRequestState, setError } from '@/core/store';
import { RequestState } from '@/core/types';
import { fetchGemsHtml } from '@/core/api';
import { db } from '@/core/db';
import { parseGemsHtml, parseEsrRunesHtml, parseLodRunesHtml, parseKanjiRunesHtml, parseCrystalsHtml } from '../parsers';

class DataSyncError extends Error {
  readonly phase: 'fetch' | 'parse' | 'clear' | 'store';
  override readonly cause?: unknown;

  constructor(message: string, phase: 'fetch' | 'parse' | 'clear' | 'store', cause?: unknown) {
    super(message);
    this.name = 'DataSyncError';
    this.phase = phase;
    this.cause = cause;
  }
}

function* handleDataLoad() {
  try {
    yield put(setRequestState(RequestState.LOADING));

    // Phase 1: Fetch HTML
    let html: string;
    try {
      html = (yield call(fetchGemsHtml)) as string;
    } catch (error) {
      throw new DataSyncError(`Failed to fetch data: ${error instanceof Error ? error.message : 'Network error'}`, 'fetch', error);
    }

    // Phase 2: Parse all data types
    let gems, esrRunes, lodRunes, kanjiRunes, crystals;
    try {
      gems = parseGemsHtml(html);
      esrRunes = parseEsrRunesHtml(html);
      lodRunes = parseLodRunesHtml(html);
      kanjiRunes = parseKanjiRunesHtml(html);
      crystals = parseCrystalsHtml(html);
    } catch (error) {
      throw new DataSyncError(`Failed to parse data: ${error instanceof Error ? error.message : 'Parse error'}`, 'parse', error);
    }

    // Phase 3: Clear database (only after successful fetch and parse)
    try {
      yield call(() => Promise.all(db.tables.map((table) => table.clear())));
    } catch (error) {
      throw new DataSyncError(`Failed to clear database: ${error instanceof Error ? error.message : 'Database error'}`, 'clear', error);
    }

    // Phase 4: Store all data in respective Dexie tables
    try {
      yield all([
        call(() => db.gems.bulkPut(gems)),
        call(() => db.esrRunes.bulkPut(esrRunes)),
        call(() => db.lodRunes.bulkPut(lodRunes)),
        call(() => db.kanjiRunes.bulkPut(kanjiRunes)),
        call(() => db.crystals.bulkPut(crystals)),
      ]);
    } catch (error) {
      throw new DataSyncError(`Failed to store data: ${error instanceof Error ? error.message : 'Database error'}`, 'store', error);
    }

    console.log(
      `Data sync complete: ${String(gems.length)} gems, ${String(esrRunes.length)} ESR runes, ${String(lodRunes.length)} LoD runes, ${String(kanjiRunes.length)} Kanji runes, ${String(crystals.length)} crystals`
    );

    yield put(setRequestState(RequestState.SUCCESS));
  } catch (error) {
    const message = error instanceof DataSyncError ? error.message : error instanceof Error ? error.message : 'Unknown error occurred';
    yield put(setError(message));
    yield put(setRequestState(RequestState.ERROR));
  }
}

export function* dataSyncSaga() {
  yield takeLatest(initDataLoad.type, handleDataLoad);
}

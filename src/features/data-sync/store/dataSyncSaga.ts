import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { fetchGemsHtml, fetchRunewordsHtml } from '@/core/api';
import { db } from '@/core/db';
import {
  parseGemsHtml,
  parseEsrRunesHtml,
  parseLodRunesHtml,
  parseKanjiRunesHtml,
  parseCrystalsHtml,
  parseRunewordsHtml,
} from '../parsers';
import {
  initDataLoad,
  fetchHtmlSuccess,
  fetchHtmlError,
  parseDataSuccess,
  parseDataError,
  storeDataSuccess,
  storeDataError,
  type FetchedHtmlData,
} from './dataSyncSlice';
import type { ParsedData } from '../interfaces';

function* handleFetchHtml() {
  try {
    const [gemsHtml, runewordsHtml] = (yield all([call(fetchGemsHtml), call(fetchRunewordsHtml)])) as [string, string];
    yield put(fetchHtmlSuccess({ gemsHtml, runewordsHtml }));
  } catch (error) {
    yield put(fetchHtmlError(error instanceof Error ? error.message : 'Network error'));
  }
}

function* handleParseData(action: PayloadAction<FetchedHtmlData>) {
  try {
    const { gemsHtml, runewordsHtml } = action.payload;
    const gems = parseGemsHtml(gemsHtml);
    const esrRunes = parseEsrRunesHtml(gemsHtml);
    const lodRunes = parseLodRunesHtml(gemsHtml);
    const kanjiRunes = parseKanjiRunesHtml(gemsHtml);
    const crystals = parseCrystalsHtml(gemsHtml);
    const runewords = parseRunewordsHtml(runewordsHtml);
    yield put(parseDataSuccess({ gems, esrRunes, lodRunes, kanjiRunes, crystals, runewords }));
  } catch (error) {
    yield put(parseDataError(error instanceof Error ? error.message : 'Parse error'));
  }
}

function* handleStoreData(action: PayloadAction<ParsedData>) {
  try {
    const { gems, esrRunes, lodRunes, kanjiRunes, crystals, runewords } = action.payload;

    // Clear all tables
    yield call(() => Promise.all(db.tables.map((table) => table.clear())));

    // Store data
    yield all([
      call(() => db.gems.bulkPut(gems)),
      call(() => db.esrRunes.bulkPut(esrRunes)),
      call(() => db.lodRunes.bulkPut(lodRunes)),
      call(() => db.kanjiRunes.bulkPut(kanjiRunes)),
      call(() => db.crystals.bulkPut(crystals)),
      call(() => db.runewords.bulkPut(runewords)),
    ]);

    console.log(
      `Data sync complete: ${String(gems.length)} gems, ${String(esrRunes.length)} ESR runes, ${String(lodRunes.length)} LoD runes, ${String(kanjiRunes.length)} Kanji runes, ${String(crystals.length)} crystals, ${String(runewords.length)} runewords`
    );

    yield put(storeDataSuccess());
  } catch (error) {
    yield put(storeDataError(error instanceof Error ? error.message : 'Database error'));
  }
}

export function* dataSyncSaga() {
  yield takeLatest(initDataLoad.type, handleFetchHtml);
  yield takeLatest(fetchHtmlSuccess.type, handleParseData);
  yield takeLatest(parseDataSuccess.type, handleStoreData);
}

import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { fetchGemsHtml } from '@/core/api';
import { db } from '@/core/db';
import { parseGemsHtml, parseEsrRunesHtml, parseLodRunesHtml, parseKanjiRunesHtml, parseCrystalsHtml } from '../parsers';
import {
  initDataLoad,
  fetchHtmlSuccess,
  fetchHtmlError,
  parseDataSuccess,
  parseDataError,
  storeDataSuccess,
  storeDataError,
} from './dataSyncSlice';
import type { ParsedData } from '../interfaces';

function* handleFetchHtml() {
  try {
    const html = (yield call(fetchGemsHtml)) as string;
    yield put(fetchHtmlSuccess(html));
  } catch (error) {
    yield put(fetchHtmlError(error instanceof Error ? error.message : 'Network error'));
  }
}

function* handleParseData(action: PayloadAction<string>) {
  try {
    const html = action.payload;
    const gems = parseGemsHtml(html);
    const esrRunes = parseEsrRunesHtml(html);
    const lodRunes = parseLodRunesHtml(html);
    const kanjiRunes = parseKanjiRunesHtml(html);
    const crystals = parseCrystalsHtml(html);
    yield put(parseDataSuccess({ gems, esrRunes, lodRunes, kanjiRunes, crystals }));
  } catch (error) {
    yield put(parseDataError(error instanceof Error ? error.message : 'Parse error'));
  }
}

function* handleStoreData(action: PayloadAction<ParsedData>) {
  try {
    const { gems, esrRunes, lodRunes, kanjiRunes, crystals } = action.payload;

    // Clear all tables
    yield call(() => Promise.all(db.tables.map((table) => table.clear())));

    // Store data
    yield all([
      call(() => db.gems.bulkPut(gems)),
      call(() => db.esrRunes.bulkPut(esrRunes)),
      call(() => db.lodRunes.bulkPut(lodRunes)),
      call(() => db.kanjiRunes.bulkPut(kanjiRunes)),
      call(() => db.crystals.bulkPut(crystals)),
    ]);

    console.log(
      `Data sync complete: ${String(gems.length)} gems, ${String(esrRunes.length)} ESR runes, ${String(lodRunes.length)} LoD runes, ${String(kanjiRunes.length)} Kanji runes, ${String(crystals.length)} crystals`
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

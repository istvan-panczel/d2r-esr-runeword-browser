import { all, call, put, takeLatest } from 'redux-saga/effects';
import { initDataLoad, setRequestState, setError } from '@/core/store';
import { RequestState } from '@/core/types';
import { fetchGemsHtml } from '@/core/api';
import { db } from '@/core/db';
import { parseGemsHtml, parseEsrRunesHtml, parseLodRunesHtml, parseKanjiRunesHtml, parseCrystalsHtml } from '../parsers';

function* handleDataLoad() {
  try {
    yield put(setRequestState(RequestState.LOADING));

    const html = (yield call(fetchGemsHtml)) as string;

    // Parse all data types from the same HTML
    const gems = parseGemsHtml(html);
    const esrRunes = parseEsrRunesHtml(html);
    const lodRunes = parseLodRunesHtml(html);
    const kanjiRunes = parseKanjiRunesHtml(html);
    const crystals = parseCrystalsHtml(html);

    // Store all data in respective Dexie tables (parallel writes)
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

    yield put(setRequestState(RequestState.SUCCESS));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    yield put(setError(message));
    yield put(setRequestState(RequestState.ERROR));
  }
}

export function* dataSyncSaga() {
  yield takeLatest(initDataLoad.type, handleDataLoad);
}

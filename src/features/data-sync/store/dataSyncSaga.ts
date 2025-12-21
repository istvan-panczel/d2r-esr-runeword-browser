import { call, put, takeLatest } from 'redux-saga/effects';
import { initDataLoad, setRequestState, setError } from '@/core/store';
import { RequestState } from '@/core/types';
import { fetchGemsHtml } from '@/core/api';
import { db } from '@/core/db';
import { parseGemsHtml } from '../parsers';

function* handleDataLoad() {
  try {
    yield put(setRequestState(RequestState.LOADING));

    const html = (yield call(fetchGemsHtml)) as string;
    const gems = parseGemsHtml(html);

    yield call((data: typeof gems) => db.gems.bulkPut(data), gems);

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

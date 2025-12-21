import { all } from 'redux-saga/effects';
import type { Saga } from 'redux-saga';

// Feature sagas are registered externally to avoid core importing features
const featureSagas: Saga[] = [];

export function registerSaga(saga: Saga) {
  featureSagas.push(saga);
}

export function* rootSaga() {
  yield all(featureSagas.map((saga) => saga()));
}

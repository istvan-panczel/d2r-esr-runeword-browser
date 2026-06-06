import { describe, expect, it, vi } from 'vitest';
import { configureStore, createAction } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import type { Saga } from 'redux-saga';
import { all, takeEvery } from 'redux-saga/effects';
import { createSagaRegistry } from './sagaRegistry';

function createNoopSaga(): Saga {
  return function* noopSaga() {
    yield all([]);
  };
}

describe('createSagaRegistry', () => {
  it('queues sagas registered before start and runs them on startSagas', () => {
    const registry = createSagaRegistry();
    const run = vi.fn();
    const sagaA = createNoopSaga();
    const sagaB = createNoopSaga();

    registry.registerSaga(sagaA);
    registry.registerSaga(sagaB);
    expect(run).not.toHaveBeenCalled();

    registry.startSagas(run);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(1, sagaA);
    expect(run).toHaveBeenNthCalledWith(2, sagaB);
  });

  it('runs sagas registered after start immediately', () => {
    const registry = createSagaRegistry();
    const run = vi.fn();
    const lateSaga = createNoopSaga();

    registry.startSagas(run);
    expect(run).not.toHaveBeenCalled();

    registry.registerSaga(lateSaga);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(lateSaga);
  });

  it('never starts the same saga twice', () => {
    const registry = createSagaRegistry();
    const run = vi.fn();
    const saga = createNoopSaga();

    // Duplicate registration before start
    registry.registerSaga(saga);
    registry.registerSaga(saga);
    registry.startSagas(run);
    expect(run).toHaveBeenCalledTimes(1);

    // Duplicate registration after start
    registry.registerSaga(saga);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not restart sagas when startSagas is called again', () => {
    const registry = createSagaRegistry();
    const run = vi.fn();
    const saga = createNoopSaga();

    registry.registerSaga(saga);
    registry.startSagas(run);
    registry.startSagas(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('processes actions in a saga registered after the middleware started', () => {
    const ping = createAction('test/ping');
    const handler = vi.fn();

    const registry = createSagaRegistry();
    const sagaMiddleware = createSagaMiddleware();
    const store = configureStore({
      reducer: { noop: (state: Record<string, never> = {}) => state },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
    });

    // Simulates runSagas() at startup, before any feature saga is registered
    registry.startSagas((saga) => sagaMiddleware.run(saga));

    // Simulates a lazy-loaded feature registering its saga later
    registry.registerSaga(function* lateFeatureSaga() {
      yield takeEvery(ping.type, handler);
    });

    store.dispatch(ping());
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

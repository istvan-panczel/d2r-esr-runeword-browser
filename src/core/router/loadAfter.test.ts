import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { configureStore, createAction } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { takeLatest } from 'redux-saga/effects';
import { createSagaRegistry } from '@/core/store/sagaRegistry';
import { loadAfter } from './loadAfter';

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolvePromise = res;
  });
  return { promise, resolve: resolvePromise };
}

const fetchRequested = createAction('test/fetchRequested');

/** A store with the saga middleware already running and a "feature" saga that is registered late, like startBuilds(). */
function createLateSagaSetup() {
  const handler = vi.fn();
  const registry = createSagaRegistry();
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { noop: (state: Record<string, never> = {}) => state },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware),
  });
  registry.startSagas((saga) => sagaMiddleware.run(saga));

  const featureChunk = deferred<undefined>();
  const startFeature = async () => {
    await featureChunk.promise; // the dynamic import of the saga module
    registry.registerSaga(function* featureSaga() {
      yield takeLatest(fetchRequested.type, handler);
    });
  };
  return { store, handler, featureChunk, startFeature };
}

describe('loadAfter', () => {
  it('does not resolve the module until ready has resolved', async () => {
    const ready = deferred<undefined>();
    let resolved = false;
    const loading = loadAfter(
      () => Promise.resolve('screen-module'),
      () => ready.promise
    ).then((module) => {
      resolved = true;
      return module;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    ready.resolve(undefined);
    await expect(loading).resolves.toBe('screen-module');
  });

  it('starts loading the module and the ready step in parallel', () => {
    const load = vi.fn(() => Promise.resolve('screen-module'));
    const ready = vi.fn(() => new Promise<void>(() => undefined));

    void loadAfter(load, ready);

    expect(load).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('loses a mount dispatch made before the late saga registers (the race it prevents)', async () => {
    const { store, handler, featureChunk, startFeature } = createLateSagaSetup();
    const starting = startFeature();

    store.dispatch(fetchRequested()); // screen mounted before registration
    featureChunk.resolve(undefined);
    await starting;

    expect(handler).not.toHaveBeenCalled();
  });

  it('handles the mount dispatch when the route module waits for saga registration', async () => {
    const { store, handler, featureChunk, startFeature } = createLateSagaSetup();
    const loading = loadAfter(() => Promise.resolve({ mountScreen: () => store.dispatch(fetchRequested()) }), startFeature);

    featureChunk.resolve(undefined);
    const screenModule = await loading;
    screenModule.mountScreen();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is used by every builds route so they wait for startBuilds()', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/core/router/index.tsx'), 'utf8');
    const builds = "import('@/features/builds')";

    expect(source).toContain(`loadAfter(() => ${builds}, startBuilds)`);
    expect(source.split(builds)).toHaveLength(2); // the only import of the builds feature is the guarded one
  });

  it('is used by every loot filter route so they wait for startLootFilterSharing()', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/core/router/index.tsx'), 'utf8');
    const lootFilter = "import('@/features/loot-filter')";

    expect(source).toContain(`loadAfter(() => ${lootFilter}, startLootFilterSharing)`);
    expect(source.split(lootFilter)).toHaveLength(2);
  });
});

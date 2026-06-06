import type { Saga, Task } from 'redux-saga';

type SagaRunner = (saga: Saga) => Task;

export interface SagaRegistry {
  registerSaga: (saga: Saga) => void;
  startSagas: (run: SagaRunner) => void;
}

/**
 * Feature sagas are registered externally to avoid core importing features.
 *
 * Sagas registered before the middleware starts are queued and started by
 * `startSagas`. Once started, later registrations run immediately, so
 * lazy-loaded feature chunks can register their sagas whenever they load.
 * A saga is never started twice, no matter how often it is registered.
 */
export function createSagaRegistry(): SagaRegistry {
  const pendingSagas: Saga[] = [];
  const startedSagas = new Set<Saga>();
  let runner: SagaRunner | null = null;

  function startSaga(saga: Saga, run: SagaRunner): void {
    if (startedSagas.has(saga)) return;
    startedSagas.add(saga);
    run(saga);
  }

  return {
    registerSaga(saga: Saga): void {
      if (runner) {
        startSaga(saga, runner);
      } else if (!pendingSagas.includes(saga)) {
        pendingSagas.push(saga);
      }
    },
    startSagas(run: SagaRunner): void {
      runner = run;
      for (const saga of pendingSagas.splice(0)) {
        startSaga(saga, run);
      }
    },
  };
}

const registry = createSagaRegistry();

export function registerSaga(saga: Saga): void {
  registry.registerSaga(saga);
}

export function startSagas(run: SagaRunner): void {
  registry.startSagas(run);
}

import { store, fatalError, registerSaga, runSagas, startupCheck } from '@/core/store';

let sagasRegistered = false;

function getStartupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Unknown error';
}

/**
 * Loads the data sync module dynamically so the entry chunk stays small and the
 * app shell can render before the heavy parsing/saga code is downloaded.
 *
 * Safe to call repeatedly: if the chunk failed to load (e.g. offline), calling
 * again retries the import; once sagas are registered it only re-dispatches the
 * startup check.
 */
export async function startDataSync(): Promise<void> {
  if (sagasRegistered) {
    store.dispatch(startupCheck());
    return;
  }

  try {
    const { dataSyncSaga } = await import('@/features/data-sync');
    registerSaga(dataSyncSaga);
    runSagas();
    sagasRegistered = true;
    store.dispatch(startupCheck());
  } catch (error) {
    console.error('[Startup] Failed to load data sync module', error);
    store.dispatch(
      fatalError(`Failed to load the data sync module. Please refresh the page to try again: ${getStartupErrorMessage(error)}`)
    );
  }
}

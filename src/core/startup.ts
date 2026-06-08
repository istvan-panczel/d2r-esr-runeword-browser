import { store, fatalError, registerSaga, runSagas, startupCheck } from '@/core/store';
import { isSupabaseConfigured } from '@/core/supabase/config';

let sagasRegistered = false;
let authSagaRegistered = false;
let buildsSagaRegistered = false;

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

/**
 * Loads the auth module dynamically and starts its saga, which watches Supabase
 * `onAuthStateChange` for the rest of the session. No-op when Supabase is not
 * configured (the build-sharing feature is hidden in that case). Safe to call
 * repeatedly — the saga registry never starts a saga twice.
 */
export async function startAuth(): Promise<void> {
  if (!isSupabaseConfigured || authSagaRegistered) return;

  try {
    const { authSaga } = await import('@/features/auth/store/authSaga');
    registerSaga(authSaga);
    runSagas();
    authSagaRegistered = true;
  } catch (error) {
    console.error('[Startup] Failed to load auth module', error);
  }
}

/**
 * Loads the builds module dynamically and starts its saga (list fetching,
 * pagination, create). No-op when Supabase is not configured. Safe to call
 * repeatedly — the saga registry never starts a saga twice.
 */
export async function startBuilds(): Promise<void> {
  if (!isSupabaseConfigured || buildsSagaRegistered) return;

  try {
    const { buildsSaga } = await import('@/features/builds/store/buildsSaga');
    registerSaga(buildsSaga);
    runSagas();
    buildsSagaRegistered = true;
  } catch (error) {
    console.error('[Startup] Failed to load builds module', error);
  }
}

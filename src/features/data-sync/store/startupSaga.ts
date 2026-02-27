import { call, put } from 'redux-saga/effects';
import { db } from '@/core/db';
import type { Metadata, Runeword } from '@/core/db';
import { fetchLatestVersion, type ChangelogVersion } from '@/core/api';
import { isVersionDifferent } from '@/core/utils';
import { startupUseCached, startupNeedsFetch, setNetworkWarning, fatalError, initDataLoad } from './dataSyncSlice';
import appVersion from '@/assets/version.json';

interface CachedDataCheck {
  hasData: boolean;
  storedVersion: string | null;
}

function* checkCachedData(): Generator<unknown, CachedDataCheck, unknown> {
  // Check if we have any runewords in the DB (primary indicator of data presence)
  const count: number = (yield call(() => db.runewords.count())) as number;

  // Get stored version
  const versionMeta = (yield call(() => db.metadata.get('esrVersion'))) as Metadata | undefined;

  // Get last updated timestamp for logging
  const lastUpdatedMeta = (yield call(() => db.metadata.get('lastUpdated'))) as Metadata | undefined;

  console.log('[HTML] Cache check - runewords count:', count, 'stored version:', versionMeta?.value ?? 'none');
  if (lastUpdatedMeta) {
    console.log('[HTML] Last updated:', lastUpdatedMeta.value);
  }

  return {
    hasData: count > 0,
    storedVersion: versionMeta?.value ?? null,
  };
}

/**
 * Checks if cached runewords need migration for tierPointTotals.
 * Returns true if any runeword is missing the tierPointTotals field.
 */
function* checkNeedsTierPointsMigration(): Generator<unknown, boolean, unknown> {
  // Sample one runeword to check if it has tierPointTotals
  const runewords: Runeword[] = (yield call(() => db.runewords.limit(1).toArray())) as Runeword[];

  if (runewords.length === 0) {
    return false; // No data, no migration needed
  }

  // Check if tierPointTotals field exists (old cached data may not have it)
  // Use 'in' operator to avoid TypeScript's strict type checking
  return !('tierPointTotals' in runewords[0]);
}

/**
 * Checks if cached runewords need migration for reqLevel.
 * Returns true if any runeword is missing the reqLevel field.
 */
function* checkNeedsReqLevelMigration(): Generator<unknown, boolean, unknown> {
  // Sample one runeword to check if it has reqLevel
  const runewords: Runeword[] = (yield call(() => db.runewords.limit(1).toArray())) as Runeword[];

  if (runewords.length === 0) {
    return false; // No data, no migration needed
  }

  // Check if reqLevel field exists (old cached data may not have it)
  return !('reqLevel' in runewords[0]);
}

/**
 * Checks if cached runewords need migration for sortKey.
 * Returns true if any runeword is missing the sortKey field.
 */
function* checkNeedsSortKeyMigration(): Generator<unknown, boolean, unknown> {
  // Sample one runeword to check if it has sortKey
  const runewords: Runeword[] = (yield call(() => db.runewords.limit(1).toArray())) as Runeword[];

  if (runewords.length === 0) {
    return false; // No data, no migration needed
  }

  // Check if sortKey field exists (old cached data may not have it)
  return !('sortKey' in runewords[0]);
}

export function* handleStartupCheck() {
  try {
    console.log('[HTML] Startup check initiated');

    // Step 1: Check what we have cached
    const cached: CachedDataCheck = (yield call(checkCachedData)) as CachedDataCheck;

    // Step 2: Try to fetch latest version from changelog
    let remoteVersion: ChangelogVersion | null = null;

    try {
      console.log('[HTML] Fetching remote version from changelog...');
      remoteVersion = (yield call(fetchLatestVersion)) as ChangelogVersion;
      console.log('[HTML] Remote ESR version:', remoteVersion.version);
    } catch {
      // Network error during version check
      console.log('[HTML] Network error during version check');
      if (cached.hasData) {
        // We have cached data, use it with a warning
        console.log('[HTML] Using cached data (network unavailable)');
        yield put(setNetworkWarning('Unable to check for updates. Using cached data.'));
        yield put(startupUseCached());
        return;
      } else {
        // No cached data and no network - fatal error
        console.log('[HTML] Fatal: No cached data and no network');
        yield put(fatalError('Unable to load data. Please check your internet connection and try again.'));
        return;
      }
    }

    // Step 3: Compare versions
    const needsFetch = isVersionDifferent(cached.storedVersion, remoteVersion.version);
    console.log('[HTML] Startup check - stored:', cached.storedVersion, 'remote:', remoteVersion.version, 'needsFetch:', needsFetch);

    if (!needsFetch && cached.hasData) {
      // Check if we need to migrate for tierPointTotals
      const needsTierPointsMigration: boolean = (yield call(checkNeedsTierPointsMigration)) as boolean;

      if (needsTierPointsMigration) {
        console.log('[HTML] Migration needed: runewords missing tierPointTotals, refetching...');
        yield put(startupNeedsFetch());
        yield put(initDataLoad({ force: false }));
        return;
      }

      // Check if we need to migrate for reqLevel
      const needsReqLevelMigration: boolean = (yield call(checkNeedsReqLevelMigration)) as boolean;

      if (needsReqLevelMigration) {
        console.log('[HTML] Migration needed: runewords missing reqLevel, refetching...');
        yield put(startupNeedsFetch());
        yield put(initDataLoad({ force: false }));
        return;
      }

      // Check if we need to migrate for sortKey
      const needsSortKeyMigration: boolean = (yield call(checkNeedsSortKeyMigration)) as boolean;

      if (needsSortKeyMigration) {
        console.log('[HTML] Migration needed: runewords missing sortKey, refetching...');
        yield put(startupNeedsFetch());
        yield put(initDataLoad({ force: false }));
        return;
      }

      // Check if app version changed (catches data logic fixes like sortKey algorithm changes)
      const storedAppVersion = (yield call(() => db.metadata.get('appVersion'))) as Metadata | undefined;
      const currentVersion = appVersion.version;

      if (!storedAppVersion || storedAppVersion.value !== currentVersion) {
        console.log('[HTML] App version changed:', storedAppVersion?.value, '→', currentVersion, '- refetching...');
        yield put(startupNeedsFetch());
        yield put(initDataLoad({ force: false }));
        return;
      }

      // Version matches and we have data - use cached
      console.log('[HTML] Using cached data - version matches');
      yield put(startupUseCached());
      return;
    }

    // Step 4: Need to fetch - trigger the data load saga
    console.log('[HTML] Version mismatch or no data - triggering fetch');
    yield put(startupNeedsFetch());
    yield put(initDataLoad({ force: false }));
  } catch (error) {
    console.error('[HTML] Startup error:', error);
    yield put(fatalError(error instanceof Error ? error.message : 'Startup error'));
  }
}

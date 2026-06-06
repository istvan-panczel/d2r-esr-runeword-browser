import { call, put } from 'redux-saga/effects';
import { db } from '@/core/db';
import type { Metadata } from '@/core/db';
import { fetchLatestVersion, type ChangelogVersion } from '@/core/api';
import { isVersionDifferent } from '@/core/utils';
import { startupUseCached, startupNeedsFetch, setNetworkWarning, fatalError, initDataLoad } from './dataSyncSlice';
import { checkCacheCompleteness, hasAnyCachedData, type CacheCompleteness } from './cacheStatus';
import appVersion from '@/assets/version.json';

interface CachedDataCheck {
  hasData: boolean;
  storedVersion: string | null;
}

function* checkCachedData(): Generator<unknown, CachedDataCheck, unknown> {
  // Check if we have any cached data at all (primary indicator of data presence)
  const hasData: boolean = (yield call(hasAnyCachedData)) as boolean;

  // Get stored version
  const versionMeta = (yield call(() => db.metadata.get('esrVersion'))) as Metadata | undefined;

  // Get last updated timestamp for logging
  const lastUpdatedMeta = (yield call(() => db.metadata.get('lastUpdated'))) as Metadata | undefined;

  console.log('[HTML] Cache check - has data:', hasData, 'stored version:', versionMeta?.value ?? 'none');
  if (lastUpdatedMeta) {
    console.log('[HTML] Last updated:', lastUpdatedMeta.value);
  }

  return {
    hasData,
    storedVersion: versionMeta?.value ?? null,
  };
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
      // Table-level migration: if any required table is empty (added in a
      // newer app version), refetch once to populate it
      const completeness: CacheCompleteness = (yield call(checkCacheCompleteness)) as CacheCompleteness;

      if (!completeness.isComplete) {
        console.log(`[HTML] Migration needed: ${completeness.emptyTable ?? 'unknown'} table empty, refetching...`);
        yield put(startupNeedsFetch());
        yield put(initDataLoad({ force: false, esrVersion: remoteVersion.version }));
        return;
      }

      // Check if app version changed (catches data model changes and logic fixes)
      const storedAppVersion = (yield call(() => db.metadata.get('appVersion'))) as Metadata | undefined;
      const currentVersion = appVersion.version;

      if (!storedAppVersion || storedAppVersion.value !== currentVersion) {
        console.log('[HTML] App version changed:', storedAppVersion?.value, '→', currentVersion, '- refetching...');
        yield put(startupNeedsFetch());
        yield put(initDataLoad({ force: false, esrVersion: remoteVersion.version }));
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
    yield put(initDataLoad({ force: false, esrVersion: remoteVersion.version }));
  } catch (error) {
    console.error('[HTML] Startup error:', error);
    yield put(fatalError(error instanceof Error ? error.message : 'Startup error'));
  }
}

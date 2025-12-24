import { call, put } from 'redux-saga/effects';
import { db } from '@/core/db';
import type { Metadata } from '@/core/db';
import { fetchLatestVersion, type ChangelogVersion } from '@/core/api';
import { isVersionDifferent } from '@/core/utils';
import { startupUseCached, startupNeedsFetch, setNetworkWarning, fatalError, initDataLoad } from './dataSyncSlice';

interface CachedDataCheck {
  hasData: boolean;
  storedVersion: string | null;
}

function* checkCachedData(): Generator<unknown, CachedDataCheck, unknown> {
  // Check if we have any runewords in the DB (primary indicator of data presence)
  const count: number = (yield call(() => db.runewords.count())) as number;

  // Get stored version
  const versionMeta = (yield call(() => db.metadata.get('esrVersion'))) as Metadata | undefined;

  return {
    hasData: count > 0,
    storedVersion: versionMeta?.value ?? null,
  };
}

export function* handleStartupCheck() {
  try {
    // Step 1: Check what we have cached
    const cached: CachedDataCheck = (yield call(checkCachedData)) as CachedDataCheck;

    // Step 2: Try to fetch latest version from changelog
    let remoteVersion: ChangelogVersion | null = null;

    try {
      remoteVersion = (yield call(fetchLatestVersion)) as ChangelogVersion;
    } catch {
      // Network error during version check
      if (cached.hasData) {
        // We have cached data, use it with a warning
        yield put(setNetworkWarning('Unable to check for updates. Using cached data.'));
        yield put(startupUseCached());
        return;
      } else {
        // No cached data and no network - fatal error
        yield put(fatalError('Unable to load data. Please check your internet connection and try again.'));
        return;
      }
    }

    // Step 3: Compare versions
    const needsFetch = isVersionDifferent(cached.storedVersion, remoteVersion.version);

    if (!needsFetch && cached.hasData) {
      // Version matches and we have data - use cached
      yield put(startupUseCached());
      return;
    }

    // Step 4: Need to fetch - trigger the data load saga
    yield put(startupNeedsFetch());
    yield put(initDataLoad({ force: false }));
  } catch (error) {
    yield put(fatalError(error instanceof Error ? error.message : 'Startup error'));
  }
}

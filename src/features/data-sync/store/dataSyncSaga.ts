import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { toast } from 'sonner';
import {
  fetchGemsHtml,
  fetchGemwordsHtml,
  fetchRunewordsPage,
  fetchUniqueWeaponsHtml,
  fetchUniqueArmorsHtml,
  fetchUniqueOthersHtml,
  fetchUniqueMythicalsHtml,
  fetchAscendanciesHtml,
  fetchLatestVersion,
  type EsrVersionInfo,
  type HtmPage,
} from '@/core/api';
import { db } from '@/core/db';
import appVersion from '@/assets/version.json';
import {
  parseGemsHtml,
  parseEsrRunesHtml,
  parseLodRunesHtml,
  parseKanjiRunesHtml,
  parseCrystalsHtml,
  parseRunewordsHtml,
  parseGemwordsHtml,
  parseHtmUniqueItems,
  parseMythicalUniques,
  parseAscendancies,
  type RunePointsLookup,
  type RuneReqLevelLookup,
  type RunePriorityLookup,
  type GemReqLevelLookup,
} from '../parsers';
import { DEFAULT_ESR_RUNE_POINTS, DEFAULT_LOD_RUNE_POINTS } from '../constants/defaultRunePoints';
import {
  startupCheck,
  startupUseCached,
  setNetworkWarning,
  initDataLoad,
  fetchHtmlSuccess,
  fetchHtmlError,
  parseDataSuccess,
  parseDataError,
  storeDataSuccess,
  storeDataError,
  fatalError,
  type FetchedHtmlData,
  type InitDataLoadPayload,
} from './dataSyncSlice';
import { handleStartupCheck } from './startupSaga';
import { countCachedDatasets, hasAnyCachedData } from './cacheStatus';
import { findBadDatasets, formatBadDatasetsWarning, SANITY_CHECKED_DATASETS, type BadDataset, type DatasetCounts } from './storeSanity';
import type { ParsedData } from '../interfaces';

function* handleFetchHtml(action: PayloadAction<InitDataLoadPayload | undefined>) {
  try {
    console.log('[HTML] Fetching HTML files...', { force: action.payload?.force ?? false });
    const [gemsHtml, gemwordsHtml, runewordsPage, uniqueWeaponsHtml, uniqueArmorsHtml, uniqueOthersHtml, mythicalsHtml, ascendanciesHtml] =
      (yield all([
        call(fetchGemsHtml),
        call(fetchGemwordsHtml),
        call(fetchRunewordsPage),
        call(fetchUniqueWeaponsHtml),
        call(fetchUniqueArmorsHtml),
        call(fetchUniqueOthersHtml),
        call(fetchUniqueMythicalsHtml),
        call(fetchAscendanciesHtml),
      ])) as [string, string, HtmPage, string, string, string, string, string];
    const runewordsHtml = runewordsPage.html;
    // The docs site regenerates every page at once, so one page's Last-Modified dates the whole set
    const docsLastModified = runewordsPage.lastModified ?? undefined;
    console.log('[HTML] Fetched HTML files', {
      gemsHtmlLength: gemsHtml.length,
      gemwordsHtmlLength: gemwordsHtml.length,
      runewordsHtmlLength: runewordsHtml.length,
      uniqueWeaponsHtmlLength: uniqueWeaponsHtml.length,
      uniqueArmorsHtmlLength: uniqueArmorsHtml.length,
      uniqueOthersHtmlLength: uniqueOthersHtml.length,
      mythicalsHtmlLength: mythicalsHtml.length,
      ascendanciesHtmlLength: ascendanciesHtml.length,
      docsLastModified: docsLastModified ?? 'unknown',
    });
    yield put(
      fetchHtmlSuccess({
        gemsHtml,
        gemwordsHtml,
        runewordsHtml,
        uniqueWeaponsHtml,
        uniqueArmorsHtml,
        uniqueOthersHtml,
        mythicalsHtml,
        ascendanciesHtml,
        esrVersion: action.payload?.esrVersion,
        docsLastModified,
      })
    );
  } catch (error) {
    console.error('[HTML] Fetch error:', error);
    // Check if we have cached data to fall back to
    const hasCache: boolean = (yield call(hasAnyCachedData)) as boolean;
    const reason = error instanceof Error ? error.message : 'Network error';

    if (!hasCache) {
      console.log('[HTML] Fatal: fetch failed with no cached data');
      yield put(fetchHtmlError(reason));
      yield put(fatalError('Unable to load data. Please check your internet connection and try again.'));
    } else if (action.payload?.force) {
      // The user asked for this refresh, so tell them it failed
      console.log('[HTML] Using cached data (forced refresh failed)');
      yield call(warnUser, `Refresh failed: ${reason}. Still using cached data.`);
      yield put(startupUseCached());
    } else {
      console.log('[HTML] Using cached data (fetch failed)');
      yield put(setNetworkWarning('Unable to fetch latest data. Using cached version.'));
      yield put(startupUseCached());
    }
  }
}

/**
 * Warnings about unusable fresh data: stored for the Settings drawer and shown
 * once as a toast, since the user would otherwise not notice stale data.
 * (The ordinary offline/fetch-failure warning is expected and stays drawer-only.)
 */
function* warnUser(message: string) {
  yield put(setNetworkWarning(message));
  yield call([toast, toast.warning], message, { description: 'See Settings for details.' });
}

/**
 * Parse/store failures after a successful fetch: if any cached data exists,
 * keep the app usable on it (with a warning) instead of showing the fatal
 * error screen; only report the failure when there is nothing to fall back to.
 */
function* fallBackToCacheOrFail(stage: 'parse' | 'store', failureAction: PayloadAction<string>) {
  let hasCache = false;
  try {
    hasCache = (yield call(hasAnyCachedData)) as boolean;
  } catch (cacheError) {
    // The database itself may be unusable (e.g. after a store failure)
    console.error('[HTML] Cache check error:', cacheError);
  }

  if (hasCache) {
    console.log(`[HTML] Using cached data (${stage} failed)`);
    yield call(warnUser, 'Unable to process the latest data. Using cached version.');
    yield put(startupUseCached());
  } else {
    console.log(`[HTML] Fatal: ${stage} failed with no cached data`);
    yield put(failureAction);
  }
}

function* handleParseData(action: PayloadAction<FetchedHtmlData>) {
  try {
    console.log('[HTML] Parsing HTML data...');
    const {
      gemsHtml,
      gemwordsHtml,
      runewordsHtml,
      uniqueWeaponsHtml,
      uniqueArmorsHtml,
      uniqueOthersHtml,
      mythicalsHtml,
      ascendanciesHtml,
    } = action.payload;
    const gems = parseGemsHtml(gemsHtml);
    console.log('[HTML] Parsed gems:', gems.length);
    const esrRunes = parseEsrRunesHtml(gemsHtml);
    console.log('[HTML] Parsed ESR runes:', esrRunes.length);
    const lodRunes = parseLodRunesHtml(gemsHtml);
    console.log('[HTML] Parsed LoD runes:', lodRunes.length);
    const kanjiRunes = parseKanjiRunesHtml(gemsHtml);
    console.log('[HTML] Parsed Kanji runes:', kanjiRunes.length);
    const crystals = parseCrystalsHtml(gemsHtml);
    console.log('[HTML] Parsed crystals:', crystals.length);

    // Build rune points lookup for runeword tier point calculation.
    // Stores both plain keys ("Ko Rune") and category-prefixed keys ("esrRunes:Ko Rune")
    // so that shared runes (e.g. Ko exists in both ESR and LoD) can be resolved correctly.
    const runePointsLookup: RunePointsLookup = new Map();
    for (const rune of esrRunes) {
      const info =
        rune.points !== undefined
          ? { points: rune.points, tier: rune.tier, category: 'esrRunes' as const }
          : rune.name in DEFAULT_ESR_RUNE_POINTS
            ? (() => {
                const defaultPoints = DEFAULT_ESR_RUNE_POINTS[rune.name];
                console.warn(`[HTML] Warning: ${rune.name} missing points in docs, using default (${String(defaultPoints)} points)`);
                return { points: defaultPoints, tier: rune.tier, category: 'esrRunes' as const };
              })()
            : null;
      if (info) {
        runePointsLookup.set(rune.name, info);
        runePointsLookup.set(`esrRunes:${rune.name}`, info);
      }
    }
    for (const rune of lodRunes) {
      const info =
        rune.points !== undefined
          ? { points: rune.points, tier: rune.tier, category: 'lodRunes' as const }
          : rune.name in DEFAULT_LOD_RUNE_POINTS
            ? (() => {
                const defaultPoints = DEFAULT_LOD_RUNE_POINTS[rune.name];
                console.warn(`[HTML] Warning: ${rune.name} missing points in docs, using default (${String(defaultPoints)} points)`);
                return { points: defaultPoints, tier: rune.tier, category: 'lodRunes' as const };
              })()
            : null;
      if (info) {
        runePointsLookup.set(rune.name, info);
        runePointsLookup.set(`lodRunes:${rune.name}`, info);
      }
    }
    console.log('[HTML] Built rune points lookup with', runePointsLookup.size, 'entries');

    // Build rune required level lookup for runeword reqLevel calculation
    const runeReqLevelLookup: RuneReqLevelLookup = new Map();
    for (const rune of esrRunes) {
      runeReqLevelLookup.set(rune.name, rune.reqLevel);
    }
    for (const rune of lodRunes) {
      runeReqLevelLookup.set(rune.name, rune.reqLevel);
    }
    for (const rune of kanjiRunes) {
      runeReqLevelLookup.set(rune.name, rune.reqLevel);
    }
    console.log('[HTML] Built rune reqLevel lookup with', runeReqLevelLookup.size, 'entries');

    // Build rune priority lookup for the runeword LoD flag (isLod).
    // Priority: ESR (100-700 by tier) → Kanji (800) → LoD (901-933 by order)
    // Stores both plain keys and category-prefixed keys so shared runes (e.g. Ko)
    // can be resolved correctly when determining if a runeword is LoD or ESR.
    const runePriorityLookup: RunePriorityLookup = new Map();
    for (const rune of esrRunes) {
      runePriorityLookup.set(rune.name, rune.tier * 100);
      runePriorityLookup.set(`esrRunes:${rune.name}`, rune.tier * 100);
    }
    for (const rune of kanjiRunes) {
      runePriorityLookup.set(rune.name, 800);
      runePriorityLookup.set(`kanjiRunes:${rune.name}`, 800);
    }
    for (const rune of lodRunes) {
      runePriorityLookup.set(rune.name, 900 + rune.order);
      runePriorityLookup.set(`lodRunes:${rune.name}`, 900 + rune.order);
    }
    console.log('[HTML] Built rune priority lookup with', runePriorityLookup.size, 'entries');

    // Build gem required level lookup for runeword reqLevel calculation
    const gemReqLevelLookup: GemReqLevelLookup = new Map();
    for (const gem of gems) {
      gemReqLevelLookup.set(gem.name, gem.reqLevel);
    }
    console.log('[HTML] Built gem reqLevel lookup with', gemReqLevelLookup.size, 'entries');

    const runewords = parseRunewordsHtml(runewordsHtml, runePointsLookup, runeReqLevelLookup, runePriorityLookup, gemReqLevelLookup);
    console.log('[HTML] Parsed runewords:', runewords.length);

    const gemwords = parseGemwordsHtml(gemwordsHtml, gemReqLevelLookup);
    console.log('[HTML] Parsed gemwords:', gemwords.length);

    const htmUniqueWeapons = parseHtmUniqueItems(uniqueWeaponsHtml, 'weapons');
    console.log('[HTML] Parsed HTM unique weapons:', htmUniqueWeapons.length);
    const htmUniqueArmors = parseHtmUniqueItems(uniqueArmorsHtml, 'armors');
    console.log('[HTML] Parsed HTM unique armors:', htmUniqueArmors.length);
    const htmUniqueOthers = parseHtmUniqueItems(uniqueOthersHtml, 'other');
    console.log('[HTML] Parsed HTM unique others:', htmUniqueOthers.length);
    const htmUniqueItems = [...htmUniqueWeapons, ...htmUniqueArmors, ...htmUniqueOthers];
    console.log('[HTML] Parsed HTM unique items total:', htmUniqueItems.length);

    const mythicalUniques = parseMythicalUniques(mythicalsHtml);
    console.log('[HTML] Parsed mythical uniques:', mythicalUniques.length);

    const ascendancies = parseAscendancies(ascendanciesHtml);
    console.log('[HTML] Parsed ascendancies:', ascendancies.length);

    yield put(
      parseDataSuccess({
        gems,
        esrRunes,
        lodRunes,
        kanjiRunes,
        crystals,
        runewords,
        gemwords,
        htmUniqueItems,
        mythicalUniques,
        ascendancies,
        esrVersion: action.payload.esrVersion,
        docsLastModified: action.payload.docsLastModified,
      })
    );
  } catch (error) {
    console.error('[HTML] Parse error:', error);
    yield call(fallBackToCacheOrFail, 'parse', parseDataError(error instanceof Error ? error.message : 'Parse error'));
  }
}

function* handleStoreData(action: PayloadAction<ParsedData>) {
  try {
    const {
      gems,
      esrRunes,
      lodRunes,
      kanjiRunes,
      crystals,
      runewords,
      gemwords,
      htmUniqueItems,
      mythicalUniques,
      ascendancies,
      docsLastModified,
    } = action.payload;

    // Sanity check: parsers silently return [] (or far fewer rows) when the
    // upstream HTML format drifts. Never replace a good cache with that.
    const parsedCounts = Object.fromEntries(
      SANITY_CHECKED_DATASETS.map((dataset) => [dataset, action.payload[dataset].length])
    ) as DatasetCounts;
    const cachedCounts: DatasetCounts = (yield call(countCachedDatasets)) as DatasetCounts;
    const badDatasets: BadDataset[] = findBadDatasets(parsedCounts, cachedCounts);

    if (badDatasets.length > 0) {
      console.warn('[HTML] Sanity check failed for datasets (parsed vs cached):', badDatasets);
      const hasCache: boolean = (yield call(hasAnyCachedData)) as boolean;
      if (hasCache) {
        // Write nothing: esrVersion stays at the old value, so the next startup refetches and retries
        console.log('[HTML] Keeping cached data (sanity check failed)');
        yield call(warnUser, formatBadDatasetsWarning(badDatasets, true));
        yield put(startupUseCached());
        return;
      }
      if (badDatasets.length === SANITY_CHECKED_DATASETS.length) {
        console.log('[HTML] Fatal: no dataset could be parsed and there is no cached data');
        yield put(storeDataError('No data could be read from the latest documentation'));
        return;
      }
    }
    const isPartial = badDatasets.length > 0;

    // Resolve the ESR version to store: reuse the version already fetched during
    // the startup check; on force refresh (no version in the payload) fetch it now.
    // A partial store (no cache to fall back to) omits esrVersion so the next startup retries.
    let esrVersion: string | null = isPartial ? null : (action.payload.esrVersion ?? null);
    if (esrVersion === null && !isPartial) {
      try {
        const versionInfo: EsrVersionInfo = (yield call(fetchLatestVersion)) as EsrVersionInfo;
        esrVersion = versionInfo.version;
      } catch {
        // If we can't get version info, just continue; without the esrVersion
        // metadata the next startup check will refetch everything.
        console.log('[HTML] Could not fetch version info for metadata');
      }
    }

    console.log('[HTML] Storing data to IndexedDB...');

    // Clear and rewrite everything in a single transaction so an interrupted
    // store (tab closed, crash) never leaves partially written data behind
    yield call(() =>
      db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((table) => table.clear()));
        await Promise.all([
          db.gems.bulkPut(gems),
          db.esrRunes.bulkPut(esrRunes),
          db.lodRunes.bulkPut(lodRunes),
          db.kanjiRunes.bulkPut(kanjiRunes),
          db.crystals.bulkPut(crystals),
          db.runewords.bulkPut(runewords),
          db.gemwords.bulkPut(gemwords),
          db.htmUniqueItems.bulkPut(htmUniqueItems),
          db.mythicalUniques.bulkPut(mythicalUniques),
          db.ascendancies.bulkPut(ascendancies),
        ]);
        if (esrVersion !== null) {
          await db.metadata.put({ key: 'esrVersion', value: esrVersion });
        }
        if (docsLastModified !== undefined) {
          await db.metadata.put({ key: 'docsLastModified', value: docsLastModified });
        }
        await db.metadata.put({ key: 'lastUpdated', value: new Date().toISOString() });
        await db.metadata.put({ key: 'appVersion', value: appVersion.version });
      })
    );
    console.log(
      '[HTML] Stored metadata with ESR version:',
      esrVersion ?? 'unknown',
      'docs last modified:',
      docsLastModified ?? 'unknown',
      'app version:',
      appVersion.version
    );

    console.log('[HTML] Store complete:', {
      gems: gems.length,
      esrRunes: esrRunes.length,
      lodRunes: lodRunes.length,
      kanjiRunes: kanjiRunes.length,
      crystals: crystals.length,
      runewords: runewords.length,
      gemwords: gemwords.length,
      htmUniqueItems: htmUniqueItems.length,
      mythicalUniques: mythicalUniques.length,
      ascendancies: ascendancies.length,
    });

    if (isPartial) {
      yield call(warnUser, formatBadDatasetsWarning(badDatasets, false));
    }

    console.log('[HTML] Data sync complete!');
    yield put(storeDataSuccess());
  } catch (error) {
    console.error('[HTML] Store error:', error);
    // The store runs in a single Dexie transaction, so a failure (e.g.
    // QuotaExceededError) rolls back and leaves the previous cache intact
    yield call(fallBackToCacheOrFail, 'store', storeDataError(error instanceof Error ? error.message : 'Database error'));
  }
}

export function* dataSyncSaga() {
  yield takeLatest(startupCheck.type, handleStartupCheck);
  yield takeLatest(initDataLoad.type, handleFetchHtml);
  yield takeLatest(fetchHtmlSuccess.type, handleParseData);
  yield takeLatest(parseDataSuccess.type, handleStoreData);
}

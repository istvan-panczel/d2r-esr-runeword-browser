import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { fetchGemsHtml, fetchRunewordsHtml, fetchLatestVersion, type ChangelogVersion } from '@/core/api';
import { db } from '@/core/db';
import {
  parseGemsHtml,
  parseEsrRunesHtml,
  parseLodRunesHtml,
  parseKanjiRunesHtml,
  parseCrystalsHtml,
  parseRunewordsHtml,
  type RunePointsLookup,
} from '../parsers';
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
  extractAffixesSuccess,
  extractAffixesError,
  fatalError,
  type FetchedHtmlData,
} from './dataSyncSlice';
import { handleStartupCheck } from './startupSaga';
import type { AffixPattern, Gem, EsrRune, LodRune, KanjiRune, Crystal, Runeword } from '@/core/db';
import type { ParsedData } from '../interfaces';

function* handleFetchHtml(action: PayloadAction<{ force?: boolean } | undefined>) {
  try {
    console.log('[HTML] Fetching HTML files...', { force: action.payload?.force ?? false });
    const [gemsHtml, runewordsHtml] = (yield all([call(fetchGemsHtml), call(fetchRunewordsHtml)])) as [string, string];
    console.log('[HTML] Fetched HTML files', {
      gemsHtmlLength: gemsHtml.length,
      runewordsHtmlLength: runewordsHtml.length,
    });
    yield put(fetchHtmlSuccess({ gemsHtml, runewordsHtml }));
  } catch (error) {
    console.error('[HTML] Fetch error:', error);
    // Check if we have cached data to fall back to
    const count: number = (yield call(() => db.runewords.count())) as number;

    if (count > 0 && !action.payload?.force) {
      // Not a force refresh and we have cached data - use it
      console.log('[HTML] Using cached data (fetch failed, have', count, 'runewords cached)');
      yield put(setNetworkWarning('Unable to fetch latest data. Using cached version.'));
      yield put(startupUseCached());
    } else {
      // Force refresh or no cached data - report error
      console.log('[HTML] Fatal: fetch failed with no cached data');
      yield put(fetchHtmlError(error instanceof Error ? error.message : 'Network error'));

      if (count === 0) {
        yield put(fatalError('Unable to load data. Please check your internet connection and try again.'));
      }
    }
  }
}

function* handleParseData(action: PayloadAction<FetchedHtmlData>) {
  try {
    console.log('[HTML] Parsing HTML data...');
    const { gemsHtml, runewordsHtml } = action.payload;
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

    // Build rune points lookup for runeword tier point calculation
    const runePointsLookup: RunePointsLookup = new Map();
    for (const rune of esrRunes) {
      if (rune.points !== undefined) {
        runePointsLookup.set(rune.name, { points: rune.points, tier: rune.tier, category: 'esrRunes' });
      }
    }
    for (const rune of lodRunes) {
      if (rune.points !== undefined) {
        runePointsLookup.set(rune.name, { points: rune.points, tier: rune.tier, category: 'lodRunes' });
      }
    }
    console.log('[HTML] Built rune points lookup with', runePointsLookup.size, 'entries');

    const runewords = parseRunewordsHtml(runewordsHtml, runePointsLookup);
    console.log('[HTML] Parsed runewords:', runewords.length);
    yield put(parseDataSuccess({ gems, esrRunes, lodRunes, kanjiRunes, crystals, runewords }));
  } catch (error) {
    console.error('[HTML] Parse error:', error);
    yield put(parseDataError(error instanceof Error ? error.message : 'Parse error'));
  }
}

function* handleStoreData(action: PayloadAction<ParsedData>) {
  try {
    const { gems, esrRunes, lodRunes, kanjiRunes, crystals, runewords } = action.payload;

    console.log('[HTML] Storing data to IndexedDB...');

    // Clear all tables
    yield call(() => Promise.all(db.tables.map((table) => table.clear())));
    console.log('[HTML] Cleared all tables');

    // Store data
    yield all([
      call(() => db.gems.bulkPut(gems)),
      call(() => db.esrRunes.bulkPut(esrRunes)),
      call(() => db.lodRunes.bulkPut(lodRunes)),
      call(() => db.kanjiRunes.bulkPut(kanjiRunes)),
      call(() => db.crystals.bulkPut(crystals)),
      call(() => db.runewords.bulkPut(runewords)),
    ]);
    console.log('[HTML] Stored all data tables');

    // Store metadata (version and timestamp)
    let storedVersion = 'unknown';
    try {
      const versionInfo: ChangelogVersion = (yield call(fetchLatestVersion)) as ChangelogVersion;
      yield call(() => db.metadata.put({ key: 'esrVersion', value: versionInfo.version }));
      storedVersion = versionInfo.version;
    } catch {
      // If we can't get version info, just continue
      console.log('[HTML] Could not fetch version info for metadata');
    }
    yield call(() => db.metadata.put({ key: 'lastUpdated', value: new Date().toISOString() }));
    console.log('[HTML] Stored metadata with ESR version:', storedVersion);

    console.log('[HTML] Store complete:', {
      gems: gems.length,
      esrRunes: esrRunes.length,
      lodRunes: lodRunes.length,
      kanjiRunes: kanjiRunes.length,
      crystals: crystals.length,
      runewords: runewords.length,
    });

    yield put(storeDataSuccess());
  } catch (error) {
    console.error('[HTML] Store error:', error);
    yield put(storeDataError(error instanceof Error ? error.message : 'Database error'));
  }
}

function collectAffixesFromSocketable(item: Gem | EsrRune | LodRune | KanjiRune | Crystal, affixMap: Map<string, AffixPattern>): void {
  for (const affix of [...item.bonuses.weaponsGloves, ...item.bonuses.helmsBoots, ...item.bonuses.armorShieldsBelts]) {
    if (!affixMap.has(affix.pattern)) {
      affixMap.set(affix.pattern, { pattern: affix.pattern, valueType: affix.valueType });
    }
  }
}

function* handleExtractAffixes() {
  try {
    console.log('[HTML] Extracting affixes...');

    // Read all data from IndexedDB
    const runewords: Runeword[] = (yield call(() => db.runewords.toArray())) as Runeword[];
    const gems: Gem[] = (yield call(() => db.gems.toArray())) as Gem[];
    const esrRunes: EsrRune[] = (yield call(() => db.esrRunes.toArray())) as EsrRune[];
    const lodRunes: LodRune[] = (yield call(() => db.lodRunes.toArray())) as LodRune[];
    const kanjiRunes: KanjiRune[] = (yield call(() => db.kanjiRunes.toArray())) as KanjiRune[];
    const crystals: Crystal[] = (yield call(() => db.crystals.toArray())) as Crystal[];

    // Collect all affixes into a Map keyed by pattern
    const affixMap = new Map<string, AffixPattern>();

    // From runewords
    for (const rw of runewords) {
      for (const affix of rw.affixes) {
        if (!affixMap.has(affix.pattern)) {
          affixMap.set(affix.pattern, { pattern: affix.pattern, valueType: affix.valueType });
        }
      }
    }

    // From socketables (gems, runes, crystals)
    for (const item of gems) collectAffixesFromSocketable(item, affixMap);
    for (const item of esrRunes) collectAffixesFromSocketable(item, affixMap);
    for (const item of lodRunes) collectAffixesFromSocketable(item, affixMap);
    for (const item of kanjiRunes) collectAffixesFromSocketable(item, affixMap);
    for (const item of crystals) collectAffixesFromSocketable(item, affixMap);

    // Store unique affixes
    const uniqueAffixes = Array.from(affixMap.values());
    yield call(() => db.affixes.bulkPut(uniqueAffixes));

    console.log('[HTML] Affix extraction complete:', uniqueAffixes.length, 'unique patterns');
    console.log('[HTML] Data sync complete!');

    yield put(extractAffixesSuccess());
  } catch (error) {
    console.error('[HTML] Affix extraction error:', error);
    yield put(extractAffixesError(error instanceof Error ? error.message : 'Affix extraction error'));
  }
}

export function* dataSyncSaga() {
  yield takeLatest(startupCheck.type, handleStartupCheck);
  yield takeLatest(initDataLoad.type, handleFetchHtml);
  yield takeLatest(fetchHtmlSuccess.type, handleParseData);
  yield takeLatest(parseDataSuccess.type, handleStoreData);
  yield takeLatest(storeDataSuccess.type, handleExtractAffixes);
}

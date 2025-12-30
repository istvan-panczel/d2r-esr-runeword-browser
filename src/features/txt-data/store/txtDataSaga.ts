import { call, put, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { fetchAllTxtFiles } from '@/core/api';
import { txtDb, type TxtFilesData, type ParsedTxtData, type TxtMetadata } from '@/core/db';
import {
  parsePropertiesTxt,
  parseSocketablesTxt,
  buildCodeToNameMap,
  parseRunewordsTxt,
  parseUniqueItemsTxt,
  parseSetsTxt,
  parseSetItemsTxt,
  parseItemTypesTxt,
  parseItemTypeDefsTxt,
  parseAncientCouponItems,
} from '../parsers';
import {
  startupTxtCheck,
  initTxtDataLoad,
  loadCachedTxtData,
  fetchTxtFilesSuccess,
  fetchTxtFilesError,
  parseTxtDataSuccess,
  parseTxtDataError,
  storeTxtDataSuccess,
  storeTxtDataError,
} from './txtDataSlice';
import appVersion from '@/assets/version.json';

/**
 * Startup check - auto-parse TXT data if version changed or no data exists
 */
function* handleStartupTxtCheck() {
  try {
    // Get stored app version from metadata
    const storedVersion: TxtMetadata | undefined = (yield call(() => txtDb.metadata.get('appVersion'))) as TxtMetadata | undefined;
    const currentVersion = appVersion.version;

    console.log('[TXT] Startup check - stored:', storedVersion?.value, 'current:', currentVersion);

    // Check if we need to parse
    const needsParsing = !storedVersion || storedVersion.value !== currentVersion;

    if (needsParsing) {
      console.log('[TXT] Version mismatch or no data - triggering parse');
      // Trigger full parsing (force: false so it respects existing data if version was stored)
      yield put(initTxtDataLoad({ force: true }));
    } else {
      // Version matches and data exists - use cache
      const lastUpdated: TxtMetadata | undefined = (yield call(() => txtDb.metadata.get('lastUpdated'))) as TxtMetadata | undefined;
      console.log('[TXT] Using cached data from:', lastUpdated?.value);
      yield put(loadCachedTxtData(lastUpdated?.value ?? new Date().toISOString()));
    }
  } catch (error) {
    // TXT parsing is optional - don't block app startup on error
    console.error('[TXT] Startup check error:', error);
    // Mark as initialized anyway so app can proceed
    yield put(loadCachedTxtData(new Date().toISOString()));
  }
}

/**
 * Check if we have cached TXT data and trigger load if needed
 */
function* handleInitTxtDataLoad(action: PayloadAction<{ force?: boolean } | undefined>) {
  try {
    const force = action.payload?.force ?? false;

    // If forcing, clear all data first
    if (force) {
      yield call(() => Promise.all(txtDb.tables.map((table) => table.clear())));
    }

    // Check if data already exists (only if not forcing)
    if (!force) {
      const existingTimestamp: TxtMetadata | undefined = (yield call(() => txtDb.metadata.get('lastUpdated'))) as TxtMetadata | undefined;

      if (existingTimestamp) {
        // Data exists, use cached
        yield put(loadCachedTxtData(existingTimestamp.value));
        return;
      }
    }

    // No cached data or forcing refresh, fetch from server
    const txtFiles: TxtFilesData = (yield call(fetchAllTxtFiles)) as TxtFilesData;
    yield put(fetchTxtFilesSuccess(txtFiles));
  } catch (error) {
    yield put(fetchTxtFilesError(error instanceof Error ? error.message : 'Fetch error'));
  }
}

/**
 * Parse fetched TXT file contents
 */
function* handleParseTxtData(action: PayloadAction<TxtFilesData>) {
  try {
    const { properties, gems, runes, uniqueItems, sets, setItems, weapons, armor, misc, itemTypes, cubemain } = action.payload;

    console.log('[TXT] Parsing TXT files...', {
      propertiesLength: properties.length,
      gemsLength: gems.length,
      runesLength: runes.length,
      uniqueItemsLength: uniqueItems.length,
      setsLength: sets.length,
      setItemsLength: setItems.length,
      weaponsLength: weapons.length,
      armorLength: armor.length,
      miscLength: misc.length,
      itemTypesLength: itemTypes.length,
      cubemainLength: cubemain.length,
    });

    // Parse properties first (needed for lookups, but we store raw data)
    const parsedProperties = parsePropertiesTxt(properties);
    console.log('[TXT] Parsed properties:', parsedProperties.length);

    // Parse socketables and build code-to-name map
    const parsedSocketables = parseSocketablesTxt(gems);
    const codeToNameMap = buildCodeToNameMap(parsedSocketables);
    console.log('[TXT] Parsed socketables:', parsedSocketables.length);

    // Parse runewords with resolved rune names
    const parsedRunewords = parseRunewordsTxt(runes, codeToNameMap);
    console.log('[TXT] Parsed runewords:', parsedRunewords.length);

    // Parse Ancient Coupon items from cubemain.txt
    const ancientCouponItems = parseAncientCouponItems(cubemain);
    console.log('[TXT] Parsed Ancient Coupon items:', ancientCouponItems.size);

    // Parse unique items with Ancient Coupon detection and pre-resolved properties
    const parsedUniqueItems = parseUniqueItemsTxt(uniqueItems, ancientCouponItems, parsedProperties);
    console.log('[TXT] Parsed uniqueItems:', parsedUniqueItems.length);

    // Parse sets
    const parsedSets = parseSetsTxt(sets);
    console.log('[TXT] Parsed sets:', parsedSets.length);

    // Parse set items
    const parsedSetItems = parseSetItemsTxt(setItems);
    console.log('[TXT] Parsed setItems:', parsedSetItems.length);

    // Parse item types (for unique item categorization - maps item code to type code)
    const parsedItemTypes = parseItemTypesTxt(weapons, armor, misc);
    console.log('[TXT] Parsed itemTypes:', parsedItemTypes.length);

    // Parse item type definitions (from itemtypes.txt - defines type hierarchy)
    const parsedItemTypeDefs = parseItemTypeDefsTxt(itemTypes);
    console.log('[TXT] Parsed itemTypeDefs:', parsedItemTypeDefs.length);

    const parsedData: ParsedTxtData = {
      properties: parsedProperties,
      socketables: parsedSocketables,
      runewords: parsedRunewords,
      uniqueItems: parsedUniqueItems,
      sets: parsedSets,
      setItems: parsedSetItems,
      itemTypes: parsedItemTypes,
      itemTypeDefs: parsedItemTypeDefs,
    };

    yield put(parseTxtDataSuccess(parsedData));
  } catch (error) {
    console.error('[TXT] Parse error:', error);
    yield put(parseTxtDataError(error instanceof Error ? error.message : 'Parse error'));
  }
}

/**
 * Store parsed TXT data in IndexedDB
 */
function* handleStoreTxtData(action: PayloadAction<ParsedTxtData>) {
  try {
    const { properties, socketables, runewords, uniqueItems, sets, setItems, itemTypes, itemTypeDefs } = action.payload;

    console.log('[TXT] Storing data to IndexedDB...', {
      properties: properties.length,
      socketables: socketables.length,
      runewords: runewords.length,
      uniqueItems: uniqueItems.length,
      sets: sets.length,
      setItems: setItems.length,
      itemTypes: itemTypes.length,
      itemTypeDefs: itemTypeDefs.length,
    });

    // Clear all tables
    yield call(() => Promise.all(txtDb.tables.map((table) => table.clear())));
    console.log('[TXT] Cleared all tables');

    // Store all data
    yield call(() => txtDb.properties.bulkPut([...properties]));
    console.log('[TXT] Stored properties');
    yield call(() => txtDb.socketables.bulkPut([...socketables]));
    console.log('[TXT] Stored socketables');
    yield call(() => txtDb.runewords.bulkPut([...runewords]));
    console.log('[TXT] Stored runewords');
    yield call(() => txtDb.uniqueItems.bulkPut([...uniqueItems]));
    console.log('[TXT] Stored uniqueItems');
    yield call(() => txtDb.sets.bulkPut([...sets]));
    console.log('[TXT] Stored sets');
    yield call(() => txtDb.setItems.bulkPut([...setItems]));
    console.log('[TXT] Stored setItems');
    yield call(() => txtDb.itemTypes.bulkPut([...itemTypes]));
    console.log('[TXT] Stored itemTypes');
    yield call(() => txtDb.itemTypeDefs.bulkPut([...itemTypeDefs]));
    console.log('[TXT] Stored itemTypeDefs');

    // Store metadata
    yield call(() =>
      txtDb.metadata.put({
        key: 'lastUpdated',
        value: new Date().toISOString(),
      })
    );
    // Store app version to track which version parsed this data
    yield call(() =>
      txtDb.metadata.put({
        key: 'appVersion',
        value: appVersion.version,
      })
    );
    console.log('[TXT] Stored metadata with app version:', appVersion.version);

    yield put(storeTxtDataSuccess());
    console.log('[TXT] Store complete!');
  } catch (error) {
    console.error('[TXT] Store error:', error);
    yield put(storeTxtDataError(error instanceof Error ? error.message : 'Store error'));
  }
}

/**
 * Root saga for TXT data feature
 */
export function* txtDataSaga() {
  yield takeLatest(startupTxtCheck.type, handleStartupTxtCheck);
  yield takeLatest(initTxtDataLoad.type, handleInitTxtDataLoad);
  yield takeLatest(fetchTxtFilesSuccess.type, handleParseTxtData);
  yield takeLatest(parseTxtDataSuccess.type, handleStoreTxtData);
}

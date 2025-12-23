import { all, call, put, takeLatest } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { fetchGemsHtml, fetchRunewordsHtml } from '@/core/api';
import { db } from '@/core/db';
import {
  parseGemsHtml,
  parseEsrRunesHtml,
  parseLodRunesHtml,
  parseKanjiRunesHtml,
  parseCrystalsHtml,
  parseRunewordsHtml,
} from '../parsers';
import {
  initDataLoad,
  fetchHtmlSuccess,
  fetchHtmlError,
  parseDataSuccess,
  parseDataError,
  storeDataSuccess,
  storeDataError,
  extractAffixesSuccess,
  extractAffixesError,
  type FetchedHtmlData,
} from './dataSyncSlice';
import type { AffixPattern, Gem, EsrRune, LodRune, KanjiRune, Crystal, Runeword } from '@/core/db';
import type { ParsedData } from '../interfaces';

function* handleFetchHtml() {
  try {
    const [gemsHtml, runewordsHtml] = (yield all([call(fetchGemsHtml), call(fetchRunewordsHtml)])) as [string, string];
    yield put(fetchHtmlSuccess({ gemsHtml, runewordsHtml }));
  } catch (error) {
    yield put(fetchHtmlError(error instanceof Error ? error.message : 'Network error'));
  }
}

function* handleParseData(action: PayloadAction<FetchedHtmlData>) {
  try {
    const { gemsHtml, runewordsHtml } = action.payload;
    const gems = parseGemsHtml(gemsHtml);
    const esrRunes = parseEsrRunesHtml(gemsHtml);
    const lodRunes = parseLodRunesHtml(gemsHtml);
    const kanjiRunes = parseKanjiRunesHtml(gemsHtml);
    const crystals = parseCrystalsHtml(gemsHtml);
    const runewords = parseRunewordsHtml(runewordsHtml);
    yield put(parseDataSuccess({ gems, esrRunes, lodRunes, kanjiRunes, crystals, runewords }));
  } catch (error) {
    yield put(parseDataError(error instanceof Error ? error.message : 'Parse error'));
  }
}

function* handleStoreData(action: PayloadAction<ParsedData>) {
  try {
    const { gems, esrRunes, lodRunes, kanjiRunes, crystals, runewords } = action.payload;

    // Clear all tables
    yield call(() => Promise.all(db.tables.map((table) => table.clear())));

    // Store data
    yield all([
      call(() => db.gems.bulkPut(gems)),
      call(() => db.esrRunes.bulkPut(esrRunes)),
      call(() => db.lodRunes.bulkPut(lodRunes)),
      call(() => db.kanjiRunes.bulkPut(kanjiRunes)),
      call(() => db.crystals.bulkPut(crystals)),
      call(() => db.runewords.bulkPut(runewords)),
    ]);

    console.log(
      `Data sync complete: ${String(gems.length)} gems, ${String(esrRunes.length)} ESR runes, ${String(lodRunes.length)} LoD runes, ${String(kanjiRunes.length)} Kanji runes, ${String(crystals.length)} crystals, ${String(runewords.length)} runewords`
    );

    yield put(storeDataSuccess());
  } catch (error) {
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

    console.log(`Affix extraction complete: ${String(uniqueAffixes.length)} unique patterns`);

    yield put(extractAffixesSuccess());
  } catch (error) {
    yield put(extractAffixesError(error instanceof Error ? error.message : 'Affix extraction error'));
  }
}

export function* dataSyncSaga() {
  yield takeLatest(initDataLoad.type, handleFetchHtml);
  yield takeLatest(fetchHtmlSuccess.type, handleParseData);
  yield takeLatest(parseDataSuccess.type, handleStoreData);
  yield takeLatest(storeDataSuccess.type, handleExtractAffixes);
}

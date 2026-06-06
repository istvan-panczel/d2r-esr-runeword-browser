import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import type { Runeword } from '@/core/db/models';
import {
  selectSearchText,
  selectSocketCount,
  selectMaxReqLevel,
  selectSelectedItemTypes,
  selectSelectedRunes,
  selectMaxTierPoints,
} from '../store/runewordsSlice';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import {
  matchesSearch,
  matchesSockets,
  matchesMaxReqLevel,
  matchesItemTypes,
  matchesRunes,
  matchesTierPoints,
  buildRuneCategoryMap,
  buildRuneBonusMap,
  buildGemBonusMap,
  expandRunewordsByColumn,
} from '../utils/filteringHelpers';

export function useFilteredRunewords(): readonly Runeword[] | undefined {
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedRunes = useSelector(selectSelectedRunes);
  const maxTierPoints = useSelector(selectMaxTierPoints);

  // Fetch runewords pre-sorted by sortKey from IndexedDB (ESR/Kanji first by reqLevel, then LoD by reqLevel)
  const data = useLiveQuery(async () => {
    const [runewords, esrRunes, lodRunes, kanjiRunes, gems] = await Promise.all([
      db.runewords.orderBy('sortKey').toArray(),
      db.esrRunes.toArray(),
      db.lodRunes.toArray(),
      db.kanjiRunes.toArray(),
      db.gems.toArray(),
    ]);
    return { runewords, esrRunes, lodRunes, kanjiRunes, gems };
  }, []);

  if (!data) return undefined;

  const { runewords, esrRunes, lodRunes, kanjiRunes, gems } = data;
  const runeBonusMap = buildRuneBonusMap(esrRunes, lodRunes, kanjiRunes);
  const gemBonusMap = buildGemBonusMap(gems);
  const runeCategoryMap = buildRuneCategoryMap(esrRunes, lodRunes, kanjiRunes);

  // Expand runewords with different column bonuses into separate entries per item category
  const expandedRunewords = expandRunewordsByColumn(runewords);

  const searchTerms = parseSearchTerms(searchText);

  // Filter preserves the pre-sorted order from IndexedDB
  return expandedRunewords.filter((runeword) => {
    if (!matchesSearch(runeword, searchTerms, runeBonusMap, gemBonusMap)) return false;
    if (!matchesSockets(runeword, socketCount)) return false;
    if (!matchesMaxReqLevel(runeword, maxReqLevel)) return false;
    if (!matchesItemTypes(runeword, selectedItemTypes)) return false;
    if (!matchesRunes(runeword, selectedRunes, runeCategoryMap)) return false;
    if (!matchesTierPoints(runeword, maxTierPoints)) return false;
    return true;
  });
}

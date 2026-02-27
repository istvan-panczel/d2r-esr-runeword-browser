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
import {
  parseSearchTerms,
  matchesSearch,
  matchesSockets,
  matchesMaxReqLevel,
  matchesItemTypes,
  matchesRunes,
  matchesTierPoints,
  buildRuneCategoryMap,
  buildRuneBonusMap,
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
    const [runewords, esrRunes, lodRunes, kanjiRunes] = await Promise.all([
      db.runewords.orderBy('sortKey').toArray(),
      db.esrRunes.toArray(),
      db.lodRunes.toArray(),
      db.kanjiRunes.toArray(),
    ]);
    return { runewords, esrRunes, lodRunes, kanjiRunes };
  }, []);

  if (!data) return undefined;

  const { runewords, esrRunes, lodRunes, kanjiRunes } = data;
  const runeBonusMap = buildRuneBonusMap(esrRunes, lodRunes, kanjiRunes);
  const runeCategoryMap = buildRuneCategoryMap(esrRunes, lodRunes, kanjiRunes);

  const searchTerms = parseSearchTerms(searchText);

  // Filter preserves the pre-sorted order from IndexedDB
  return runewords.filter((runeword) => {
    if (!matchesSearch(runeword, searchTerms, runeBonusMap)) return false;
    if (!matchesSockets(runeword, socketCount)) return false;
    if (!matchesMaxReqLevel(runeword, maxReqLevel)) return false;
    if (!matchesItemTypes(runeword, selectedItemTypes)) return false;
    if (!matchesRunes(runeword, selectedRunes, runeCategoryMap)) return false;
    if (!matchesTierPoints(runeword, maxTierPoints)) return false;
    return true;
  });
}

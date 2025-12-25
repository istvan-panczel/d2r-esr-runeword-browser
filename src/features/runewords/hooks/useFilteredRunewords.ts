import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import type { Runeword } from '@/core/db/models';
import { selectSearchText, selectSocketCount, selectSelectedItemTypes, selectSelectedRunes } from '../store/runewordsSlice';
import {
  parseSearchTerms,
  matchesSearch,
  matchesSockets,
  matchesItemTypes,
  matchesRunes,
  buildRuneCategoryMap,
  buildRunePriorityMap,
  buildRuneBonusMap,
  getRunewordSortKey,
} from '../utils/filteringHelpers';

export function useFilteredRunewords(): readonly Runeword[] | undefined {
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedRunes = useSelector(selectSelectedRunes);

  const data = useLiveQuery(async () => {
    const [runewords, esrRunes, lodRunes, kanjiRunes] = await Promise.all([
      db.runewords.toArray(),
      db.esrRunes.toArray(),
      db.lodRunes.toArray(),
      db.kanjiRunes.toArray(),
    ]);
    return { runewords, esrRunes, lodRunes, kanjiRunes };
  }, []);

  if (!data) return undefined;

  const { runewords, esrRunes, lodRunes, kanjiRunes } = data;
  const priorityMap = buildRunePriorityMap(esrRunes, kanjiRunes, lodRunes);
  const runeBonusMap = buildRuneBonusMap(esrRunes, lodRunes, kanjiRunes);
  const runeCategoryMap = buildRuneCategoryMap(esrRunes, lodRunes, kanjiRunes);

  const searchTerms = parseSearchTerms(searchText);

  const filtered = runewords.filter((runeword) => {
    if (!matchesSearch(runeword, searchTerms, runeBonusMap)) return false;
    if (!matchesSockets(runeword, socketCount)) return false;
    if (!matchesItemTypes(runeword, selectedItemTypes)) return false;
    if (!matchesRunes(runeword, selectedRunes, runeCategoryMap)) return false;
    return true;
  });

  // Sort by highest rune priority (lowest priority first)
  return filtered.sort((a, b) => getRunewordSortKey(a, priorityMap) - getRunewordSortKey(b, priorityMap));
}

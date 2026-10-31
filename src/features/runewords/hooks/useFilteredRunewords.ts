import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import type { Runeword } from '@/core/db/models';
import type { SocketableLookup } from '@/core/utils/socketableLookup';
import {
  selectSearchText,
  selectSocketRange,
  selectMaxReqLevel,
  selectSelectedItemTypes,
  selectSelectedRunes,
  selectRuneMatchMode,
  selectMaxTierPoints,
  selectExactName,
} from '../store/runewordsSlice';
import { applyExactNameFocus } from '@/core/utils/exactName';
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
  compareRunewordsByLevel,
} from '../utils/filteringHelpers';
import { foldJewelVariants } from '../utils/foldJewelVariants';

/**
 * All runewords in screen order (see compareRunewordsByLevel). Sorted here rather than by a Dexie index:
 * IndexedDB compares names by code unit, which would put e.g. "hand of Justice" after "Pride". Uses
 * `reqLevel`, not `sortKey`, so old cached rows with the legacy LoD sort key (10000+) sort the same way.
 */
export async function queryRunewordsInDisplayOrder(): Promise<Runeword[]> {
  const runewords = await db.runewords.toArray();
  return runewords.sort(compareRunewordsByLevel);
}

/** `lookup` is the screen-level rune/gem lookup (see useSocketableLookupQuery), reused for search and rune filters. */
export function useFilteredRunewords(lookup: SocketableLookup | undefined): readonly Runeword[] | undefined {
  const searchText = useSelector(selectSearchText);
  const socketRange = useSelector(selectSocketRange);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedRunes = useSelector(selectSelectedRunes);
  const runeMatchMode = useSelector(selectRuneMatchMode);
  const maxTierPoints = useSelector(selectMaxTierPoints);
  const exactName = useSelector(selectExactName);

  const runewords = useLiveQuery(queryRunewordsInDisplayOrder, []);

  if (!runewords || !lookup) return undefined;

  const runeBonusMap = buildRuneBonusMap(lookup.esrRunes.values(), lookup.lodRunes.values(), lookup.kanjiRunes.values());
  const gemBonusMap = buildGemBonusMap(lookup.gems.values());
  const runeCategoryMap = buildRuneCategoryMap(lookup.esrRunes.values(), lookup.lodRunes.values(), lookup.kanjiRunes.values());

  // One entry per jewel recipe content (ESR lists a row per jewel count), then one per item category where the
  // column bonuses differ
  const expandedRunewords = expandRunewordsByColumn(foldJewelVariants(runewords));

  const searchTerms = parseSearchTerms(searchText);

  // Jewel folding, column expansion, exact-name focus and filtering all preserve the query's order
  return applyExactNameFocus(expandedRunewords, exactName, (list) =>
    list.filter((runeword) => {
      if (!matchesSearch(runeword, searchTerms, runeBonusMap, gemBonusMap)) return false;
      if (!matchesSockets(runeword, socketRange)) return false;
      if (!matchesMaxReqLevel(runeword, maxReqLevel)) return false;
      if (!matchesItemTypes(runeword, selectedItemTypes)) return false;
      if (!matchesRunes(runeword, selectedRunes, runeCategoryMap, runeMatchMode)) return false;
      if (!matchesTierPoints(runeword, maxTierPoints)) return false;
      return true;
    })
  );
}

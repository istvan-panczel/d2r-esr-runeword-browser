import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import type { Gemword } from '@/core/db/models';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import {
  selectSearchText,
  selectSocketCount,
  selectMaxReqLevel,
  selectSelectedItemTypes,
  selectSelectedGems,
} from '../store/gemwordsSlice';
import {
  matchesGemSelection,
  matchesGemwordItemTypes,
  matchesGemwordMaxReqLevel,
  matchesGemwordSearch,
  matchesGemwordSockets,
} from '../utils/filteringHelpers';

export function useFilteredGemwords(): readonly Gemword[] | undefined {
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedGems = useSelector(selectSelectedGems);

  const gemwords = useLiveQuery(() => db.gemwords.orderBy('sortKey').toArray(), []);

  if (!gemwords) return undefined;

  const searchTerms = parseSearchTerms(searchText);

  return gemwords.filter((gemword) => {
    if (!matchesGemwordSearch(gemword, searchTerms)) return false;
    if (!matchesGemwordSockets(gemword, socketCount)) return false;
    if (!matchesGemwordMaxReqLevel(gemword, maxReqLevel)) return false;
    if (!matchesGemwordItemTypes(gemword, selectedItemTypes)) return false;
    if (!matchesGemSelection(gemword, selectedGems)) return false;
    return true;
  });
}

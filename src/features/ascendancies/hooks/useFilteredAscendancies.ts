import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import type { Ascendancy } from '@/core/db';
import { selectSearchText } from '../store';
import { parseSearchTerms } from '@/core/utils/searchTerms';
import { matchesSearch } from '../utils/filteringHelpers';

/**
 * Hook to get filtered ascendancies.
 * Returns undefined while loading.
 */
export function useFilteredAscendancies(): readonly Ascendancy[] | undefined {
  const searchText = useSelector(selectSearchText);

  const allItems = useLiveQuery(() => db.ascendancies.toArray());

  if (!allItems) {
    return undefined;
  }

  const searchTerms = parseSearchTerms(searchText);

  const filtered = allItems.filter((item) => matchesSearch(item, searchTerms));

  // Sort alphabetically by name
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  return filtered;
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import type { HtmUniqueItem } from '@/core/db';
import { selectSearchText, selectMaxReqLevel, selectSelectedCategories, selectIncludeCouponItems } from '../store';
import { parseSearchTerms } from '@/core/utils/searchTerms';

/**
 * Hook to get filtered and sorted HTM unique items.
 * Returns undefined while loading.
 */
export function useFilteredHtmUniqueItems(): readonly HtmUniqueItem[] | undefined {
  const searchText = useSelector(selectSearchText);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedCategories = useSelector(selectSelectedCategories);
  const includeCouponItems = useSelector(selectIncludeCouponItems);

  const allItems = useLiveQuery(() => db.htmUniqueItems.toArray());

  if (!allItems) {
    return undefined;
  }

  const searchTerms = parseSearchTerms(searchText);

  const filtered = allItems
    .filter((item) => includeCouponItems || !item.isAncientCoupon)
    .filter((item) => maxReqLevel === null || item.reqLevel <= maxReqLevel)
    .filter((item) => matchesCategory(item.category, selectedCategories))
    .filter((item) => matchesSearch(item, searchTerms));

  // Sort by reqLevel ascending, then by name alphabetically
  filtered.sort((a, b) => {
    if (a.reqLevel !== b.reqLevel) {
      return a.reqLevel - b.reqLevel;
    }
    return a.name.localeCompare(b.name);
  });

  return filtered;
}

function matchesCategory(category: string, selectedCategories: ReadonlySet<string>): boolean {
  if (selectedCategories.has('__all__')) {
    return true;
  }
  return selectedCategories.has(category);
}

function matchesSearch(item: HtmUniqueItem, searchTerms: readonly string[]): boolean {
  if (searchTerms.length === 0) return true;

  const propertyText = item.properties.join(' ');
  const searchableText = `${item.name} ${item.baseItem} ${item.category} ${propertyText}`.toLowerCase();

  return searchTerms.every((term) => searchableText.includes(term));
}

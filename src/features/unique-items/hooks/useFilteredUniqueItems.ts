import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { txtDb } from '@/core/db';
import type { DisplayUniqueItem } from '../types';
import { selectSearchText, selectMaxReqLevel, selectSelectedTypeCodes, selectIncludeCouponItems } from '../store';
import { getItemTypeFromCode, type ItemTypeDefInfo } from '../utils/itemTypeMapping';
import { parseSearchTerms } from '@/features/runewords/utils/filteringHelpers';

/**
 * Hook to get filtered and sorted unique items
 * Returns undefined while loading
 *
 * Note: Property translation is pre-computed during parse time (stored in resolvedProperties).
 * This eliminates ~8,824 string translations per filter/search change.
 */
export function useFilteredUniqueItems(): readonly DisplayUniqueItem[] | undefined {
  const searchText = useSelector(selectSearchText);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedTypeCodes = useSelector(selectSelectedTypeCodes);
  const includeCouponItems = useSelector(selectIncludeCouponItems);

  // Load items, item type mappings, and item type definitions together
  const data = useLiveQuery(async () => {
    // Get all enabled unique items and type data in parallel
    const [allItems, itemTypes, itemTypeDefs] = await Promise.all([
      txtDb.uniqueItems.filter((item) => item.enabled).toArray(),
      txtDb.itemTypes.toArray(),
      txtDb.itemTypeDefs.toArray(),
    ]);

    // Build the item code to type mapping (e.g., "amf" -> "ajav")
    const itemCodeToTypeMap = new Map<string, string>();
    for (const item of itemTypes) {
      itemCodeToTypeMap.set(item.code.toLowerCase(), item.type.toLowerCase());
    }

    // Build the item type defs mapping (e.g., "ajav" -> {storePage: "weap", name: "Amazon Javelin"})
    const itemTypeDefsMap = new Map<string, ItemTypeDefInfo>();
    for (const def of itemTypeDefs) {
      itemTypeDefsMap.set(def.code.toLowerCase(), {
        storePage: def.storePage,
        name: def.name,
      });
    }

    return { allItems, itemCodeToTypeMap, itemTypeDefsMap };
  });

  if (!data) {
    return undefined;
  }

  const { allItems, itemCodeToTypeMap, itemTypeDefsMap } = data;

  // Parse search terms (supports quoted phrases)
  const searchTerms = parseSearchTerms(searchText);

  // Transform, filter, and sort items
  // Uses pre-resolved properties from parse time (no runtime translation needed)
  const displayItems: DisplayUniqueItem[] = allItems
    .map((item) => {
      const typeInfo = getItemTypeFromCode(item.itemCode, item.itemName, itemCodeToTypeMap, itemTypeDefsMap);
      // Fallback to empty array for old data without resolvedProperties
      // Users need to refresh data from Settings to populate this field
      // Note: IndexedDB data may lack this field if stored before the optimization was added
      const resolvedProps = (item as { resolvedProperties?: readonly string[] }).resolvedProperties ?? [];
      return {
        ...item,
        group: typeInfo.group,
        typeCode: typeInfo.typeCode,
        typeLabel: typeInfo.label,
        // Map pre-resolved strings to TranslatedProperty objects
        translatedProperties: resolvedProps.map((text, i) => ({
          text,
          rawCode: item.properties[i]?.code ?? '',
          param: item.properties[i]?.param ?? '',
          min: item.properties[i]?.min ?? 0,
          max: item.properties[i]?.max ?? 0,
        })),
      };
    })
    .filter((item) => includeCouponItems || !item.isAncientCoupon)
    .filter((item) => maxReqLevel === null || item.levelReq <= maxReqLevel)
    .filter((item) => matchesTypeCode(item.typeCode, selectedTypeCodes))
    .filter((item) => matchesSearch(item, searchTerms));

  // Sort by level requirement ascending, then by name alphabetically
  displayItems.sort((a, b) => {
    if (a.levelReq !== b.levelReq) {
      return a.levelReq - b.levelReq;
    }
    return a.index.localeCompare(b.index);
  });

  return displayItems;
}

/**
 * Check if an item's typeCode is selected
 * Special case: if set contains '__all__', all types are selected
 */
function matchesTypeCode(typeCode: string, selectedTypeCodes: ReadonlySet<string>): boolean {
  // '__all__' means all types are selected (no filtering)
  if (selectedTypeCodes.has('__all__')) {
    return true;
  }
  return selectedTypeCodes.has(typeCode);
}

/**
 * Check if an item matches the search terms (AND logic)
 * Searches in item name and translated properties
 */
function matchesSearch(item: DisplayUniqueItem, searchTerms: readonly string[]): boolean {
  if (searchTerms.length === 0) return true;

  // Build searchable text from name and properties
  const propertyText = item.translatedProperties.map((p) => p.text).join(' ');
  const searchableText = `${item.index} ${item.itemName} ${propertyText}`.toLowerCase();

  // All terms must match (AND logic)
  return searchTerms.every((term) => searchableText.includes(term));
}

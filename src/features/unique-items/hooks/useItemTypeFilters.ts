import { useLiveQuery } from 'dexie-react-hooks';
import { txtDb } from '@/core/db';
import type { TxtItemTypeDef } from '@/core/db';
import type { FilterGroup, FilterItemType } from '../types';
import type { ItemGroup } from '../utils/itemTypeMapping';

/**
 * Type codes that should be categorized as weapons despite having storePage: misc
 * These are throwable weapons that the game stores in misc tab but are logically weapons
 */
const WEAPON_TYPE_OVERRIDES = new Set([
  'tkni', // Throwing Knife
  'taxe', // Throwing Axe
  'jave', // Javelin
  'ajav', // Amazon Javelin
  'bjav', // Barbarian Javs
]);

/**
 * Convert storePage value to our group
 * Also checks for weapon type overrides
 */
function storePageToGroup(storePage: string, typeCode?: string): ItemGroup | null {
  // Check for weapon overrides first
  if (typeCode && WEAPON_TYPE_OVERRIDES.has(typeCode)) {
    return 'weapons';
  }

  switch (storePage) {
    case 'weap':
      return 'weapons';
    case 'armo':
      return 'armors';
    case 'misc':
      return 'other';
    default:
      return null; // Abstract types (no storePage)
  }
}

/**
 * Group labels
 */
const GROUP_LABELS: Record<string, string> = {
  weapons: 'Weapons',
  armors: 'Armors',
  other: 'Other',
  mythical: 'Mythical',
};

/**
 * Find the best parent type for consolidation
 * Walks up the type hierarchy to find a suitable parent
 */
function findConsolidationParent(typeCode: string, typeDefsMap: Map<string, TxtItemTypeDef>, usedTypeCodes: Set<string>): string | null {
  const typeDef = typeDefsMap.get(typeCode);
  if (!typeDef) return null;

  // Check equiv1 parent
  const parent1 = typeDef.equiv1;
  const parentDef = parent1 ? typeDefsMap.get(parent1) : undefined;
  if (parentDef) {
    // Use parent if it has a storePage (is concrete) and is NOT directly used by items
    if (parentDef.storePage && !usedTypeCodes.has(parent1)) {
      return parent1;
    }
    // Try grandparent
    const grandparent = findConsolidationParent(parent1, typeDefsMap, usedTypeCodes);
    if (grandparent) return grandparent;
  }

  return null;
}

/**
 * Hook to get filter groups built dynamically from itemTypeDefs table
 * Only shows types that have actual unique items, consolidated by parent type
 * Returns undefined while loading
 */
export function useItemTypeFilters(): readonly FilterGroup[] | undefined {
  return useLiveQuery(async () => {
    // Get all data in parallel
    const [uniqueItems, itemTypes, itemTypeDefs] = await Promise.all([
      txtDb.uniqueItems.filter((item) => item.enabled).toArray(),
      txtDb.itemTypes.toArray(),
      txtDb.itemTypeDefs.toArray(),
    ]);

    // Build item code to type code mapping (e.g., "ktr" -> "h2h1")
    const itemCodeToTypeMap = new Map<string, string>();
    for (const item of itemTypes) {
      itemCodeToTypeMap.set(item.code.toLowerCase(), item.type.toLowerCase());
    }

    // Build type defs map for quick lookup
    const typeDefsMap = new Map<string, TxtItemTypeDef>();
    for (const def of itemTypeDefs) {
      typeDefsMap.set(def.code.toLowerCase(), def);
    }

    // Find all type codes actually used by unique items
    const usedTypeCodes = new Set<string>();
    let hasMythical = false;

    for (const item of uniqueItems) {
      // Check for mythical items (special case - detected by name)
      if (item.itemName.toLowerCase().startsWith('mythical')) {
        hasMythical = true;
        continue;
      }

      const typeCode = itemCodeToTypeMap.get(item.itemCode.toLowerCase());
      if (typeCode) {
        usedTypeCodes.add(typeCode);
      }
    }

    // Build consolidation map: childCode -> parentCode
    // Types with same parent get consolidated under that parent
    const consolidationMap = new Map<string, string>(); // childCode -> consolidatedCode
    const consolidatedGroups = new Map<string, Set<string>>(); // consolidatedCode -> Set of childCodes

    for (const typeCode of usedTypeCodes) {
      const parentCode = findConsolidationParent(typeCode, typeDefsMap, usedTypeCodes);

      if (parentCode) {
        // Consolidate under parent
        consolidationMap.set(typeCode, parentCode);
        let parentGroup = consolidatedGroups.get(parentCode);
        if (!parentGroup) {
          parentGroup = new Set();
          consolidatedGroups.set(parentCode, parentGroup);
        }
        parentGroup.add(typeCode);
      } else {
        // No consolidation - use type itself
        // But check if types with same display name should be merged
        const typeDef = typeDefsMap.get(typeCode);
        if (typeDef) {
          // Find if another type has same name
          let foundExisting = false;
          for (const [existingCode, existingChildren] of consolidatedGroups) {
            const existingDef = typeDefsMap.get(existingCode);
            if (existingDef && existingDef.name === typeDef.name) {
              // Same display name - add to existing group
              existingChildren.add(typeCode);
              consolidationMap.set(typeCode, existingCode);
              foundExisting = true;
              break;
            }
          }
          if (!foundExisting) {
            consolidationMap.set(typeCode, typeCode);
            consolidatedGroups.set(typeCode, new Set([typeCode]));
          }
        }
      }
    }

    // Build filter groups from consolidated types
    const groups = new Map<string, FilterItemType[]>([
      ['weapons', []],
      ['armors', []],
      ['other', []],
    ]);

    for (const [consolidatedCode, childCodes] of consolidatedGroups) {
      const typeDef = typeDefsMap.get(consolidatedCode);
      if (!typeDef || !typeDef.storePage) continue;

      const group = storePageToGroup(typeDef.storePage, consolidatedCode);
      const groupItems = group ? groups.get(group) : undefined;
      if (groupItems) {
        groupItems.push({
          code: consolidatedCode,
          label: typeDef.name,
          childCodes: Array.from(childCodes),
        });
      }
    }

    // Sort item types within each group alphabetically by label
    for (const items of groups.values()) {
      items.sort((a, b) => a.label.localeCompare(b.label));
    }

    // Build the final filter groups array
    const filterGroups: FilterGroup[] = [
      { id: 'weapons', label: GROUP_LABELS['weapons'], itemTypes: groups.get('weapons') ?? [] },
      { id: 'armors', label: GROUP_LABELS['armors'], itemTypes: groups.get('armors') ?? [] },
      { id: 'other', label: GROUP_LABELS['other'], itemTypes: groups.get('other') ?? [] },
    ];

    // Only add mythical if there are mythical items
    if (hasMythical) {
      filterGroups.push({
        id: 'mythical',
        label: GROUP_LABELS['mythical'],
        itemTypes: [{ code: 'mythical', label: 'Mythical', childCodes: ['mythical'] }],
      });
    }

    return filterGroups;
  });
}

/**
 * Get all type codes from filter groups (for toggle logic)
 * Returns all child codes (expanded)
 */
export function getAllTypeCodesFromGroups(groups: readonly FilterGroup[]): string[] {
  const codes: string[] = [];
  for (const group of groups) {
    for (const itemType of group.itemTypes) {
      codes.push(...itemType.childCodes);
    }
  }
  return codes;
}

/**
 * Get type codes for a specific group
 */
export function getTypeCodesForGroup(groups: readonly FilterGroup[], groupId: string): string[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];
  const codes: string[] = [];
  for (const itemType of group.itemTypes) {
    codes.push(...itemType.childCodes);
  }
  return codes;
}

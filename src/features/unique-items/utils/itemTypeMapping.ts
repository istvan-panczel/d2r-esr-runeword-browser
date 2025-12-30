import { txtDb } from '@/core/db';

/**
 * Item group derived from storePage column in itemtypes.txt
 */
export type ItemGroup = 'weapons' | 'armors' | 'other' | 'mythical';

/**
 * Result of item type lookup - fully data-driven from IndexedDB
 */
export interface ItemTypeResult {
  readonly group: ItemGroup;
  readonly typeCode: string; // The type code for filtering (e.g., 'swor', 'helm')
  readonly label: string; // Display label from itemtypes.txt (e.g., 'Sword', 'Helm')
}

/**
 * Map structure for item type definitions from IndexedDB
 */
export interface ItemTypeDefInfo {
  readonly storePage: string;
  readonly name: string;
}

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
function storePageToGroup(storePage: string, typeCode?: string): ItemGroup {
  // Check for weapon overrides first
  if (typeCode && WEAPON_TYPE_OVERRIDES.has(typeCode)) {
    return 'weapons';
  }

  switch (storePage) {
    case 'weap':
      return 'weapons';
    case 'armo':
      return 'armors';
    default:
      return 'other';
  }
}

/**
 * Get the item type info from an item code.
 * Fully data-driven - uses itemTypes and itemTypeDefs tables from IndexedDB.
 *
 * @param itemCode - The item code from uniqueitems.txt (e.g., "amf" for Matriarchal Javelin)
 * @param itemName - The item name for Mythical detection
 * @param itemCodeToTypeMap - Pre-loaded map from item code to type code (from itemTypes table)
 * @param itemTypeDefsMap - Pre-loaded map from type code to {storePage, name} (from itemTypeDefs table)
 * @returns ItemTypeResult with group, typeCode, and label
 */
export function getItemTypeFromCode(
  itemCode: string,
  itemName: string,
  itemCodeToTypeMap: Map<string, string>,
  itemTypeDefsMap: Map<string, ItemTypeDefInfo>
): ItemTypeResult {
  // Special case: Mythical items (detected by name prefix)
  if (itemName.toLowerCase().startsWith('mythical')) {
    return { group: 'mythical', typeCode: 'mythical', label: 'Mythical' };
  }

  const code = itemCode.toLowerCase();

  // Look up the type code from the item code (e.g., "amf" -> "ajav")
  const typeCode = itemCodeToTypeMap.get(code);

  if (typeCode) {
    // Look up the type definition (storePage and display name)
    const typeDef = itemTypeDefsMap.get(typeCode);
    if (typeDef) {
      return {
        group: storePageToGroup(typeDef.storePage, typeCode),
        typeCode,
        label: typeDef.name,
      };
    }
  }

  // Fallback: try the item code directly as a type code
  const directDef = itemTypeDefsMap.get(code);
  if (directDef) {
    return {
      group: storePageToGroup(directDef.storePage, code),
      typeCode: code,
      label: directDef.name,
    };
  }

  // Final fallback for unknown items
  return { group: 'other', typeCode: 'unknown', label: 'Unknown' };
}

// Cache for the item code to type mapping (loaded from IndexedDB)
let itemCodeToTypeCache: Map<string, string> | null = null;

/**
 * Load the item code to type mapping from IndexedDB
 * Called once to populate the cache
 */
export async function loadItemCodeToTypeMap(): Promise<Map<string, string>> {
  if (itemCodeToTypeCache) {
    return itemCodeToTypeCache;
  }

  const map = new Map<string, string>();
  const itemTypes = await txtDb.itemTypes.toArray();

  for (const item of itemTypes) {
    map.set(item.code.toLowerCase(), item.type.toLowerCase());
  }

  itemCodeToTypeCache = map;
  return map;
}

/**
 * Debug function to get the raw type code for an item code
 */
export async function getItemTypeCode(itemCode: string): Promise<string | undefined> {
  const map = await loadItemCodeToTypeMap();
  return map.get(itemCode.toLowerCase());
}

/**
 * Clear the cache (useful for testing or forcing reload)
 */
export function clearItemTypeCache(): void {
  itemCodeToTypeCache = null;
}

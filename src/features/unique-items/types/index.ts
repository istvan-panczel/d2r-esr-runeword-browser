import type { TxtUniqueItem } from '@/core/db';
import type { TranslatedProperty } from '@/features/txt-data/utils/propertyTranslator';
import type { ItemGroup } from '../utils/itemTypeMapping';

// Re-export ItemGroup for convenience
export type { ItemGroup };

/**
 * Unique item enriched with group, type code, type label, and translated properties for display
 * All categorization is data-driven from itemtypes.txt
 */
export interface DisplayUniqueItem extends TxtUniqueItem {
  readonly group: ItemGroup;
  readonly typeCode: string; // Type code from itemtypes.txt (e.g., 'swor', 'helm')
  readonly typeLabel: string; // Display label from itemtypes.txt (e.g., 'Sword', 'Helm')
  readonly translatedProperties: readonly TranslatedProperty[];
}

/**
 * Filter group for UI - built dynamically from itemTypeDefs
 */
export interface FilterGroup {
  readonly id: string; // 'weapons', 'armors', 'other', 'mythical'
  readonly label: string; // 'Weapons', 'Armors', 'Other', 'Mythical'
  readonly itemTypes: readonly FilterItemType[];
}

/**
 * Individual item type filter option
 * Supports consolidated types where multiple type codes map to one filter
 */
export interface FilterItemType {
  readonly code: string; // Primary type code (e.g., 'swor')
  readonly label: string; // Display label (e.g., 'Sword')
  readonly childCodes: readonly string[]; // All type codes this filter matches (includes code itself)
}

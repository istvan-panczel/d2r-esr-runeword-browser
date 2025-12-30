/**
 * Type definitions for TXT file data
 * These models represent parsed data from Diablo 2 TXT files (TSV format)
 */

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Item property with code, parameter, and value range
 * Used across runewords, unique items, and set items
 */
export interface TxtProperty {
  readonly code: string;
  readonly param: string;
  readonly min: number;
  readonly max: number;
}

/**
 * Socketable modifier (for gems.txt weapon/helm/shield bonuses)
 */
export interface TxtSocketableMod {
  readonly code: string;
  readonly param: string;
  readonly min: number;
  readonly max: number;
}

// ============================================================================
// Properties (properties.txt)
// ============================================================================

/**
 * Property definition with tooltip translation
 */
export interface TxtPropertyDef {
  readonly code: string;
  readonly tooltip: string;
  readonly parameter: string;
}

// ============================================================================
// Socketables (gems.txt)
// ============================================================================

/**
 * Socketable item (gem, rune, etc.) from gems.txt
 */
export interface TxtSocketable {
  readonly name: string;
  readonly code: string;
  readonly letter: string;
  readonly weaponMods: readonly TxtSocketableMod[];
  readonly helmMods: readonly TxtSocketableMod[];
  readonly shieldMods: readonly TxtSocketableMod[];
}

// ============================================================================
// Runewords (runes.txt)
// ============================================================================

/**
 * Reference to a rune with both code and resolved name
 */
export interface TxtRuneRef {
  readonly code: string;
  readonly name: string;
}

/**
 * Runeword definition from runes.txt
 */
export interface TxtRuneword {
  readonly id: string;
  readonly displayName: string;
  readonly complete: boolean;
  readonly itemTypes: readonly string[];
  readonly excludeTypes: readonly string[];
  readonly runes: readonly TxtRuneRef[];
  readonly properties: readonly TxtProperty[];
}

// ============================================================================
// Unique Items (uniqueitems.txt)
// ============================================================================

/**
 * Unique item definition from uniqueitems.txt
 */
export interface TxtUniqueItem {
  readonly index: string;
  readonly id: number;
  readonly version: number;
  readonly enabled: boolean;
  readonly level: number;
  readonly levelReq: number;
  readonly itemCode: string;
  readonly itemName: string;
  readonly properties: readonly TxtProperty[];
  readonly resolvedProperties: readonly string[]; // Pre-translated property text for display
  readonly isAncientCoupon: boolean; // True if item is obtained via Ancient Coupon (not droppable)
}

// ============================================================================
// Sets (sets.txt)
// ============================================================================

/**
 * Partial set bonus (when 2+ items are equipped)
 */
export interface TxtPartialBonus {
  readonly itemCount: number;
  readonly properties: readonly TxtProperty[];
}

/**
 * Set definition from sets.txt
 */
export interface TxtSet {
  readonly index: string;
  readonly name: string;
  readonly partialBonuses: readonly TxtPartialBonus[];
  readonly fullSetBonuses: readonly TxtProperty[];
}

// ============================================================================
// Set Items (setitems.txt)
// ============================================================================

/**
 * Per-slot partial bonus for set items
 */
export interface TxtSetItemBonus {
  readonly slot: number;
  readonly propertyA: TxtProperty | null;
  readonly propertyB: TxtProperty | null;
}

/**
 * Set item definition from setitems.txt
 */
export interface TxtSetItem {
  readonly index: string;
  readonly id: number;
  readonly setName: string;
  readonly itemCode: string;
  readonly itemName: string;
  readonly level: number;
  readonly levelReq: number;
  readonly properties: readonly TxtProperty[];
  readonly partialBonuses: readonly TxtSetItemBonus[];
}

// ============================================================================
// Metadata
// ============================================================================

/**
 * Key-value metadata for tracking database state
 */
export interface TxtMetadata {
  readonly key: string;
  readonly value: string;
}

// ============================================================================
// Item Types (for unique item categorization)
// ============================================================================

/**
 * Item type mapping from item code to type code
 * Used to categorize unique items by their base item type
 * Parsed from weapons.txt, armor.txt, misc.txt
 */
export interface TxtItemType {
  readonly code: string; // Item code (e.g., "amf" for Matriarchal Javelin)
  readonly type: string; // Item type code (e.g., "ajav" for Amazon Javelin)
  readonly name: string; // Display name (e.g., "Matriarchal Javelin")
}

/**
 * Item type definition from itemtypes.txt
 * Defines the type hierarchy and categorization
 */
export interface TxtItemTypeDef {
  readonly code: string; // Type code (e.g., "swor", "helm", "lcha")
  readonly name: string; // Display name from ItemType column (e.g., "Sword", "Helm", "Grand Charm")
  readonly equiv1: string; // Parent type 1 for hierarchy
  readonly equiv2: string; // Parent type 2 for hierarchy
  readonly storePage: string; // Top-level category: "weap", "armo", "misc", or ""
}

// ============================================================================
// Data Transfer Objects
// ============================================================================

/**
 * Fetched TXT file contents
 */
export interface TxtFilesData {
  readonly properties: string;
  readonly gems: string;
  readonly runes: string;
  readonly uniqueItems: string;
  readonly sets: string;
  readonly setItems: string;
  readonly weapons: string;
  readonly armor: string;
  readonly misc: string;
  readonly itemTypes: string; // itemtypes.txt content
  readonly cubemain: string; // cubemain.txt content (for Ancient Coupon detection)
}

/**
 * Parsed TXT data ready for storage
 */
export interface ParsedTxtData {
  readonly properties: readonly TxtPropertyDef[];
  readonly socketables: readonly TxtSocketable[];
  readonly runewords: readonly TxtRuneword[];
  readonly uniqueItems: readonly TxtUniqueItem[];
  readonly sets: readonly TxtSet[];
  readonly setItems: readonly TxtSetItem[];
  readonly itemTypes: readonly TxtItemType[];
  readonly itemTypeDefs: readonly TxtItemTypeDef[];
}

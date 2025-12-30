# Unique Items Feature

Browse and filter unique items from the D2R ESR mod.

## Overview

The Unique Items feature displays all unique items parsed from `uniqueitems.txt`. Items are categorized by type (weapons, armors, other) and can be filtered using checkboxes. The categorization system is fully data-driven from the TXT files.

## Data Flow

```
uniqueitems.txt → TxtUniqueItem → DisplayUniqueItem → UI
       ↓
  itemtypes.txt → TxtItemTypeDef → FilterGroup/FilterItemType → Checkboxes
       ↓
weapons/armor/misc.txt → TxtItemType (code → type mapping)
```

## Item Type System

### Three-Level Hierarchy

1. **Item Code** (`itemCode`): The specific base item code (e.g., `ktr` for Katar, `am1` for Stag Bow)
2. **Type Code** (`typeCode`): The item type category (e.g., `h2h1` for Hand to Hand 1, `abow` for Amazon Bow)
3. **Store Page** (`storePage`): Top-level grouping (e.g., `weap`, `armo`, `misc`)

### Data Sources

| File | Purpose | Key Columns |
|------|---------|-------------|
| `uniqueitems.txt` | Unique item definitions | `index`, `code`, `lvl req`, `prop1-12` |
| `weapons.txt` / `armor.txt` / `misc.txt` | Item code → type code mapping | `code`, `type` |
| `itemtypes.txt` | Type code definitions and hierarchy | `Code`, `ItemType`, `Equiv1`, `Equiv2`, `StorePage` |

### Type Hierarchy Example

```
itemtypes.txt hierarchy for Assassin claws:

mele (Melee)
  └── h2h (Hand to Hand) - storePage: weap
       └── claw (Claw) - storePage: weap
            ├── h2h1 (Hand to Hand 1) - storePage: weap
            └── h2h2 (Hand to Hand 2) - storePage: weap

Items in weapons.txt use h2h1 or h2h2 as their type:
- Katar (ktr) → h2h1
- Quhab (9ar) → h2h1
- Hand Scythe (9cs) → h2h2
- Greater Claws (9lw) → h2h2
```

## Filter Consolidation

The filter system consolidates related types to reduce checkbox clutter and provide a better UX.

### Consolidation Rules

1. **Only show types with items**: Types that have no unique items are hidden from filters
2. **Parent-based consolidation**: Child types sharing a common parent are consolidated under that parent
3. **Name-based consolidation**: Types with identical display names are merged (e.g., `abow` and `pbow` both named "Amazon Bow")

### Consolidation Algorithm

```typescript
function findConsolidationParent(typeCode, typeDefsMap, usedTypeCodes):
  1. Get the type's parent from equiv1
  2. If parent exists, has a storePage, and is NOT directly used by items:
     - Return parent as consolidation target
  3. Otherwise, recursively check grandparent
  4. If no suitable parent found, return null (type stands alone)
```

### Examples

| Child Types | Parent | Display Name | Items Using |
|-------------|--------|--------------|-------------|
| `h2h1`, `h2h2` | `claw` | "Claw" | Katar, Hand Scythe, etc. |
| `abow`, `pbow` | (same name) | "Amazon Bow" | Stag Bow, Precision Bow, etc. |
| `swor` | (none) | "Sword" | Long Sword, Crystal Sword, etc. |

### Why Parent Consolidation?

Without consolidation, users would see:
- "Hand to Hand 1" (7 items)
- "Hand to Hand 2" (14 items)
- "Hand to Hand" (0 items - abstract)
- "Claw" (0 items - abstract)

With consolidation:
- "Claw" (21 items) ← h2h1 + h2h2 merged under parent

## Data Models

### FilterGroup

```typescript
interface FilterGroup {
  readonly id: string;      // 'weapons', 'armors', 'other', 'mythical'
  readonly label: string;   // 'Weapons', 'Armors', 'Other', 'Mythical'
  readonly itemTypes: readonly FilterItemType[];
}
```

### FilterItemType

```typescript
interface FilterItemType {
  readonly code: string;           // Primary type code (e.g., 'claw')
  readonly label: string;          // Display label (e.g., 'Claw')
  readonly childCodes: readonly string[];  // All codes this filter matches ['h2h1', 'h2h2']
}
```

### DisplayUniqueItem

```typescript
interface DisplayUniqueItem extends TxtUniqueItem {
  readonly group: ItemGroup;        // 'weapons' | 'armors' | 'other' | 'mythical'
  readonly typeCode: string;        // Leaf type code (e.g., 'h2h1')
  readonly typeLabel: string;       // Display label (e.g., 'Hand to Hand 1')
  readonly translatedProperties: readonly TranslatedProperty[];
  // Inherited from TxtUniqueItem:
  readonly isAncientCoupon: boolean; // True if obtained via Ancient Coupon
}
```

## Special Cases

### Mythical Items

Items with names starting with "Mythical" are detected by name prefix and categorized as `mythical` group, regardless of their actual item type. This is because mythical items span multiple item types.

```typescript
if (itemName.toLowerCase().startsWith('mythical')) {
  return { group: 'mythical', typeCode: 'mythical', label: 'Mythical' };
}
```

### Weapon Type Overrides

Some item types have `storePage: misc` in the game data but are logically weapons (throwables). These are overridden to appear in the Weapons group:

| Code | Name | Original storePage |
|------|------|--------------------|
| `tkni` | Throwing Knife | misc |
| `taxe` | Throwing Axe | misc |
| `jave` | Javelin | misc |
| `ajav` | Amazon Javelin | misc |
| `bjav` | Barbarian Javs | misc |

### Excluded Items

Certain item types are excluded from parsing:

| Code | Name | Reason |
|------|------|--------|
| `ore` | Uni Ore | Crafting material, not equippable |
| `ast` | Ascendancy Stone | Special charm items, not traditional uniques |

### Excluded Properties

Internal properties are filtered from display:

| Code | Reason |
|------|--------|
| `tinkerflag` | Internal game flag |
| `tinkerflag2` | Internal game flag |

### Ancient Coupon Detection

Some unique items cannot be obtained as drops - they are created using Ancient Coupons via the Horadric Cube. These items are identified by parsing `cubemain.txt` and matching the output item names.

**Data Flow:**
1. `cubemain.txt` is fetched and parsed at TXT data load time
2. Coupon recipes (rows starting with "Coupon") are extracted
3. The `output` column contains the unique item name
4. Each unique item is marked with `isAncientCoupon: true` if its name matches

**Examples:**
| Item | isAncientCoupon | Reason |
|------|-----------------|--------|
| Titan's Revenge | false | Regular drop |
| Titan's Revenge_lod | true | Coupon version (LoD recreation) |
| Thunderstroke | true | Only from coupon |
| Windforce | true | Only from coupon |

**UI Display:**
Ancient Coupon items show "Ancient Coupon Unique" text in purple below the item name on the card.

## Redux State

```typescript
interface UniqueItemsState {
  readonly searchText: string;
  readonly selectedTypeCodes: readonly string[];  // Empty = all selected
}
```

### Selection Logic

- Empty array (`[]`) = all types selected (show everything)
- `['__none__']` = no types selected (show nothing)
- `['h2h1', 'h2h2', 'swor']` = only show items with these type codes

When a consolidated filter is toggled, ALL of its `childCodes` are added/removed from selection.

## Hooks

### useItemTypeFilters

Returns filter groups built dynamically from IndexedDB:

```typescript
function useItemTypeFilters(): readonly FilterGroup[] | undefined
```

1. Queries unique items to find used type codes
2. Queries itemTypeDefs for type hierarchy
3. Consolidates types by parent
4. Returns structured FilterGroup array

### useFilteredUniqueItems

Returns filtered and sorted unique items:

```typescript
function useFilteredUniqueItems(): readonly DisplayUniqueItem[] | undefined
```

1. Loads items, type mappings, and type definitions from IndexedDB
2. Maps each item to its type using `getItemTypeFromCode()`
3. Filters by selected type codes and search text
4. Sorts by level requirement, then name

## File Structure

```
src/features/unique-items/
├── components/
│   ├── ItemTypeFilter.tsx      # Checkbox filter UI
│   └── UniqueItemCard.tsx      # Item display card
├── hooks/
│   ├── useItemTypeFilters.ts   # Build filter groups from DB
│   ├── useFilteredUniqueItems.ts  # Filter and sort items
│   └── usePropertyTranslator.ts   # Property translation
├── store/
│   └── uniqueItemsSlice.ts     # Redux state and actions
├── utils/
│   └── itemTypeMapping.ts      # Type lookup and categorization
├── types/
│   └── index.ts                # TypeScript interfaces
└── screens/
    └── UniqueItemsScreen.tsx   # Main screen component
```

## UI Components

### Filter Section

```
Item Types: [All] [None]

Weapons: ☑ Amazon Bow  ☑ Amazon Javelin  ☑ Axe  ☑ Claw  ...

Armors:  ☑ Belt  ☑ Boots  ☑ Circlet  ☑ Gloves  ...

Other:   ☑ Amulet  ☑ Grand Charm  ☑ Large Charm  ...

Mythical: ☑ Mythical
```

### Group Checkbox States

| State | Visual | Meaning |
|-------|--------|---------|
| All | ☑ | All types in group are selected |
| Some | ☐̲ (indeterminate) | Some types in group are selected |
| None | ☐ | No types in group are selected |

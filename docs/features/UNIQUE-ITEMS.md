# Unique Items Feature

Browse and filter unique items from the D2R ESR mod.

## Overview

The Unique Items feature displays all unique items parsed from three HTM pages on the ESR documentation site: `unique_weapons.htm`, `unique_armors.htm`, and `unique_others.htm`. Items are categorized by their parsed category and grouped into filter groups for the UI.

## Data Flow

```
unique_weapons.htm ─┐
unique_armors.htm  ─┼─→ htmUniqueItemsParser → HtmUniqueItem[] → IndexedDB → UI
unique_others.htm  ─┘
```

Each HTML page contains tables of unique items organized by category headers. The parser extracts item name, base item, category, level, properties, notes, and coupon status.

### Source HTML structure

All three pages share the same table layout:

- Each category starts with `<a name="CategoryName">` followed by a `<table>`.
- Category header row: `<td colspan="4" bgcolor="#402040"><b>CategoryName</b></td>`.
- Column header row: `Name | Stats | Properties | Notes`.
- Data rows have 4 cells: name cell | stats cell | properties cell | notes cell.

The **Notes** column was introduced in ESR 3.12; before that the tables had 3 columns and the
category header used `colspan="3"`. The parser accepts both layouts (it matches category headers with
`colspan` 3 **or** 4), and items parsed from the legacy 3-column layout get an empty `notes` value.

## Data Model

```typescript
type HtmUniqueItemPage = 'weapons' | 'armors' | 'other';

interface HtmUniqueItem {
  readonly id?: number;           // Auto-increment primary key
  readonly name: string;          // "Titan's Revenge", "Windforce"
  readonly baseItem: string;      // "Ceremonial Javelin", "Hydra Bow"
  readonly baseItemCode: string;  // Item code for resolution
  readonly page: HtmUniqueItemPage; // Which page it came from
  readonly category: string;      // "Amazon Javelin", "Bow", etc.
  readonly itemLevel: number;     // Item level
  readonly reqLevel: number;      // Required level
  readonly properties: readonly string[]; // Human-readable property strings
  readonly isAncientCoupon: boolean; // True if coupon-only item
  readonly gambleItem: string;    // Gamble item identifier
  readonly notes: string;         // "Notes" column (ESR 3.12+), e.g. "Blessed Edge Variant"; '' for most items
}
```

`notes` is not indexed, so adding it did not require a Dexie schema version bump. It is empty for the
vast majority of items (16 of ~1031 items carry a note in ESR 3.12) and is only rendered when non-empty.

## Category System

### Filter Groups

Categories are organized into groups defined in `src/features/htm-unique-items/constants/htmCategoryGroups.ts`:

| Group | Label | Example Categories |
|-------|-------|--------------------|
| `missile-weapons` | Missile Weapons | Bow, Crossbow, Javelin, Throwing Knife, etc. |
| `class-weapons` | Class Specific | Amazon Bow, Assassin 2H Katana, Orb, etc. |
| `weapons` | Weapons | Axe, Sword, Mace, Polearm, Staff, etc. |
| `armors` | Armors | Belt, Body Armor, Boots, Helm, Shield, etc. |
| `class-armors` | Class Specific | Auric Shields, Pelt, Spirit Crown, etc. |
| `rings` | Rings | Ring, Ama Ring, Bar Ring, Coupon Rings, etc. |
| `amulets` | Amulets | Amulet, Ama Amulet, Coupon Amulets, etc. |
| `charms` | Charms | Grand Charm, Large Charm, Odd Charm, Small Charm |
| `jewels` | Jewels | Jewel |

Any new category not in the known list is placed in a "New" group so that newly added categories are never silently hidden.

```typescript
interface HtmFilterGroup {
  readonly id: string;           // 'weapons', 'rings', etc.
  readonly label: string;        // 'Weapons', 'Rings', etc.
  readonly categories: readonly string[];
}
```

## Filters

### Text Search
- Searches item name, base item, category, properties, and notes
- AND logic: all words must match
- Supports quoted phrases: `"exact phrase"`

### Max Required Level
- Number input to cap the required level of shown items

### Category Filters
- Grouped checkboxes organized by filter groups
- Group-level toggle (all/none within a group)
- "All" / "None" buttons for selecting/deselecting all categories
- `__none__` sentinel value represents "no categories selected"

### Ancient Coupon Toggle
- `includeCouponItems` (default: true)
- When disabled, hides items marked as `isAncientCoupon: true`

## Redux State

```typescript
interface HtmUniqueItemsState {
  readonly searchText: string;
  readonly maxReqLevel: number | null;
  readonly selectedCategories: readonly string[];  // Empty = all selected
  readonly includeCouponItems: boolean;
}
```

### Selection Logic

- Empty array (`[]`) = all categories selected (show everything)
- `['__none__']` = no categories selected (show nothing)
- `['Bow', 'Sword', 'Ring']` = only show items in these categories

**Actions:** `setSearchText`, `setMaxReqLevel`, `toggleCategory`, `toggleGroup`, `selectAllCategories`, `deselectAllCategories`, `setIncludeCouponItems`

## Ancient Coupon Detection

Some unique items cannot be obtained as drops - they are created using Ancient Coupons via the Horadric Cube. These are identified during parsing and marked with `isAncientCoupon: true`.

**UI Display:** Ancient Coupon items show a distinct visual indicator on the card.

## Hooks

### useCategoryFilters

Builds filter groups from the available categories in IndexedDB:

```typescript
function useCategoryFilters(): readonly HtmFilterGroup[] | undefined
```

### useFilteredHtmUniqueItems

Returns filtered and sorted unique items based on current Redux state:

```typescript
function useFilteredHtmUniqueItems(): readonly HtmUniqueItem[] | undefined
```

### useShareUrl / useUrlInitialize

Generate shareable URLs with current filter state and initialize filters from URL parameters.

## File Structure

```
src/features/htm-unique-items/
├── components/
│   ├── HtmCategoryFilter.tsx        # Grouped checkbox filter UI
│   ├── HtmUniqueItemCard.tsx        # Item display card
│   └── HtmUniqueItemFilters.tsx     # All filter controls
├── constants/
│   └── htmCategoryGroups.ts         # Category → group mapping
├── hooks/
│   ├── index.ts
│   ├── useCategoryFilters.ts        # Build filter groups from DB
│   ├── useFilteredHtmUniqueItems.ts # Filter and sort items
│   ├── useShareUrl.ts               # Generate shareable URL
│   └── useUrlInitialize.ts          # Init filters from URL
├── screens/
│   └── HtmUniqueItemsScreen.tsx     # Main screen component
├── store/
│   └── htmUniqueItemsSlice.ts       # Redux state and actions
├── types/
│   └── index.ts                     # HtmFilterGroup interface
└── index.ts
```

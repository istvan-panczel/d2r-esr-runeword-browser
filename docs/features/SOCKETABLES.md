# Socketables Feature

Unified view of all socketable items (gems, runes, crystals) with filtering.

## Purpose

- View all socketable items in one place
- Filter by category via checkboxes
- Filter by quality (only highest tier)
- Search across name and bonus text
- Share filtered views via URL

## Data Sources

| Category | Table | Count |
|----------|-------|-------|
| Gems | `gems` | 48 |
| ESR Runes | `esrRunes` | ~46 |
| LoD Runes | `lodRunes` | 33 |
| Kanji Runes | `kanjiRunes` | 14 |
| Crystals | `crystals` | 36 |

**Total:** ~177 socketable items

## Filter Controls

### Checkbox Group
- 5 checkboxes: Gems, ESR Runes, LoD Runes, Kanji Runes, Crystals
- All checked by default
- "All" button resets all checkboxes to checked
- Toggling updates results immediately

### Only Highest Quality
- Toggle to show only the highest tier of each gem/crystal type
- Default: **true** (shows only Perfect gems and Standard crystals)
- When disabled, shows all quality tiers (Chipped through Perfect for gems, Chipped through Standard for crystals)
- Does not affect runes (runes have no quality tiers)

### Text Search
- Searches against item **name** and **bonus text**
- Input is split by spaces, trimmed
- All words must match (AND logic)
- Supports quoted phrases: `"exact phrase"`
- Example: `resist life` matches items containing both "resist" AND "life"

### Item Count
Item count is displayed in the page title showing the number of visible items.

## Display

### Item Card
Each socketable displays:
- Name (with item color if available)
- Category badge (Gem, ESR, LoD, Kanji, Crystal)
- Required level
- Bonuses for each slot type:
  - Weapons/Gloves
  - Helms/Boots
  - Armor/Shields/Belts

### Order
Fixed order: items displayed by category (Gems -> ESR -> LoD -> Kanji -> Crystals), then by tier/name within category. No user sorting options.

## State Management

```typescript
interface SocketablesState {
  readonly enabledCategories: EnabledCategories;
  readonly searchText: string;
  readonly onlyHighestQuality: boolean;
}

interface EnabledCategories {
  readonly gems: boolean;
  readonly esrRunes: boolean;
  readonly lodRunes: boolean;
  readonly kanjiRunes: boolean;
  readonly crystals: boolean;
}
```

**Actions:** `toggleCategory`, `setSearchText`, `toggleOnlyHighestQuality`, `selectAllCategories`, `initializeFromUrl`

## Hooks

- `useFilteredSocketables()` - Category + quality + search filtering
- `useShareUrl()` - Generates shareable URLs with current filter state
- `useUrlInitialize()` - Initializes filters from URL params, cleans URL after load

## Feature Location

```
src/features/socketables/
├── components/
│   ├── CategoryBadge.tsx
│   ├── SocketableCard.tsx
│   └── SocketableFilters.tsx
├── hooks/
│   ├── useFilteredSocketables.ts
│   ├── useShareUrl.ts
│   └── useUrlInitialize.ts
├── screens/
│   └── SocketablesScreen.tsx
├── store/
│   └── socketablesSlice.ts
├── types/
│   └── index.ts
└── utils/
    ├── filteringHelpers.ts
    └── socketableColors.ts
```

# Socketables Feature

Unified view of all socketable items with filtering across categories.

## Purpose

Allow users to:
- View all socketable items (gems, runes, crystals) in one place
- Filter by socketable type via checkboxes
- Search across all fields (name, affixes) with text input
- Quick comparison across different socketable categories

## Socketable Categories

| Category | Table | Count |
|----------|-------|-------|
| Gems | `gems` | 48 |
| ESR Runes | `esrRunes` | ~50 |
| LoD Runes | `lodRunes` | 35 |
| Kanji Runes | `kanjiRunes` | ~14 |
| Crystals | `crystals` | 36 |

**Total:** ~183 socketable items

## UI Components

### SocketablesScreen

Main screen with filters and unified item list.

```
┌─────────────────────────────────────────────────────────────┐
│  Socketables                                                │
├─────────────────────────────────────────────────────────────┤
│  Show: ☑ Gems  ☑ ESR Runes  ☑ LoD Runes  ☑ Kanji  ☑ Crystals│
│                                                             │
│  Search: [_______________________________]                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Perfect  │  │ Ka Rune  │  │ El Rune  │  │ Shadow   │    │
│  │ Ruby     │  │ (ESR)    │  │ (LoD)    │  │ Quartz   │    │
│  │ [Gem]    │  │ [ESR]    │  │ [LoD]    │  │ [Crystal]│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ ...      │  │ ...      │  │ ...      │  │ ...      │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### SocketableFilters

Filter controls at the top of the page.

```
┌─────────────────────────────────────────────────────────────┐
│  Show:                                                      │
│  ☑ Gems  ☑ ESR Runes  ☑ LoD Runes  ☑ Kanji Runes  ☑ Crystals│
│                                                             │
│  Search: [_______________________________] [Clear]          │
└─────────────────────────────────────────────────────────────┘
```

**Checkbox Group:**
- All checkboxes checked by default
- At least one must remain checked (prevent empty state)
- Toggling updates the list immediately

**Search Field:**
- Text input for free-text search
- Searches across: name, affix rawText, affix pattern
- Case-insensitive matching
- Debounced input (300ms) to avoid excessive filtering

### SocketableCard

Unified card component that can display any socketable type.

```
┌─────────────────────────────────────┐
│ Perfect Ruby                  [Gem] │
│ Req Level: 35                       │
│─────────────────────────────────────│
│ Weapons/Gloves:                     │
│   +40% Enhanced Damage              │
│─────────────────────────────────────│
│ Helms/Boots:                        │
│   +38 to Life                       │
│─────────────────────────────────────│
│ Armor/Shields/Belts:                │
│   +38 to Life                       │
└─────────────────────────────────────┘
```

**Display Notes:**
- Category badge in top-right corner (Gem, ESR, LoD, Kanji, Crystal)
- Badge color matches category
- Name displayed in item's color (if available)
- All three bonus categories always visible

### Category Badges

| Category | Badge Text | Color |
|----------|------------|-------|
| Gems | `Gem` | Purple |
| ESR Runes | `ESR` | Gold |
| LoD Runes | `LoD` | Silver |
| Kanji Runes | `Kanji` | Red |
| Crystals | `Crystal` | Teal |

## Search Behavior

The search field filters across multiple fields:

```typescript
function matchesSearch(item: Socketable, searchText: string): boolean {
  const lower = searchText.toLowerCase();

  // Search in name
  if (item.name.toLowerCase().includes(lower)) return true;

  // Search in all affix texts
  const allAffixes = [
    ...item.bonuses.weaponsGloves,
    ...item.bonuses.helmsBoots,
    ...item.bonuses.armorShieldsBelts,
  ];

  for (const affix of allAffixes) {
    if (affix.rawText.toLowerCase().includes(lower)) return true;
    if (affix.pattern.toLowerCase().includes(lower)) return true;
  }

  return false;
}
```

**Search Examples:**
- `ruby` → matches "Perfect Ruby", "Chipped Ruby", etc.
- `enhanced damage` → matches any socketable with this affix
- `resist` → matches socketables with resistance affixes
- `level 35` → matches socketables with "Level 35" in name or affixes

## Data Flow

```
┌─────────────────────────────────────────┐
│  User navigates to /socketables         │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Load all socketables from 5 tables     │
│  (gems, esrRunes, lodRunes, kanjiRunes, │
│   crystals) using useLiveQuery          │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Combine into unified array with        │
│  category metadata                      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Apply category filter (checkboxes)     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Apply search filter (text input)       │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Display SocketableCards                │
└─────────────────────────────────────────┘
```

## State Management

### Redux Slice

```typescript
type SocketableCategory = 'gems' | 'esrRunes' | 'lodRunes' | 'kanjiRunes' | 'crystals';

interface SocketablesState {
  // Category filters - all true by default
  enabledCategories: Record<SocketableCategory, boolean>;

  // Text search
  searchText: string;
}

const initialState: SocketablesState = {
  enabledCategories: {
    gems: true,
    esrRunes: true,
    lodRunes: true,
    kanjiRunes: true,
    crystals: true,
  },
  searchText: '',
};
```

### Actions

```typescript
// Toggle a category on/off
toggleCategory(category: SocketableCategory)

// Set search text
setSearchText(text: string)

// Reset all filters to default
resetFilters()
```

### Data from Dexie

```typescript
// Load all socketables with category metadata
function useAllSocketables() {
  const gems = useLiveQuery(() => db.gems.toArray());
  const esrRunes = useLiveQuery(() => db.esrRunes.toArray());
  const lodRunes = useLiveQuery(() => db.lodRunes.toArray());
  const kanjiRunes = useLiveQuery(() => db.kanjiRunes.toArray());
  const crystals = useLiveQuery(() => db.crystals.toArray());

  // Combine with category tags
  return useMemo(() => {
    if (!gems || !esrRunes || !lodRunes || !kanjiRunes || !crystals) {
      return null;
    }

    return [
      ...gems.map(g => ({ ...g, category: 'gems' as const })),
      ...esrRunes.map(r => ({ ...r, category: 'esrRunes' as const })),
      ...lodRunes.map(r => ({ ...r, category: 'lodRunes' as const })),
      ...kanjiRunes.map(r => ({ ...r, category: 'kanjiRunes' as const })),
      ...crystals.map(c => ({ ...c, category: 'crystals' as const })),
    ];
  }, [gems, esrRunes, lodRunes, kanjiRunes, crystals]);
}
```

**Note:** This is one of the rare cases where `useMemo` is justified (combining multiple data sources). Add a comment explaining why React Compiler optimization is insufficient here.

## Feature Location

```
src/features/socketables/
├── components/
│   ├── SocketableCard.tsx
│   ├── SocketableFilters.tsx
│   ├── CategoryCheckbox.tsx
│   ├── SearchInput.tsx
│   └── CategoryBadge.tsx
├── containers/
│   └── SocketableListContainer.tsx
├── store/
│   └── socketablesSlice.ts
├── hooks/
│   ├── useAllSocketables.ts
│   ├── useSocketableSearch.ts
│   └── useFilteredSocketables.ts
├── types/
│   └── index.ts
└── screens/
    └── SocketablesScreen.tsx
```

## Relationship to Other Pages

This page aggregates data from the individual feature pages:

| Route | Relationship |
|-------|--------------|
| `/socketables` | Aggregator - shows all |
| `/gems` | Detail - gems only, grouped by type |
| `/runes` | Detail - runes only, with ESR/LoD/Kanji tabs |
| `/crystals` | Detail - crystals only, grouped by type |

Users can use `/socketables` for quick search across all categories, then navigate to specific pages for more detailed browsing with category-specific organization.

## Performance Considerations

With ~183 items, performance should be fine. However:

1. **Debounce search input** - 300ms delay before filtering
2. **Virtual scrolling** - Consider if item count grows significantly
3. **Lazy load cards** - Only render visible cards if needed

For the current item count, simple array filtering should be sufficient.

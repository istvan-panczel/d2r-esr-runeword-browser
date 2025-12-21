# Runewords Feature

The primary feature of the application - browse and filter all Eastern Sun Resurrected runewords.

## Purpose

Allow users to:
- View all available runewords with complete data
- Filter by various criteria (affixes, sockets, item types, runes)
- Search by text or select specific affix patterns
- See both runeword bonuses AND what the runes contribute

## UI Components

### RunewordList
Main container displaying runewords in a grid or list layout.

```
┌─────────────────────────────────────────────────────────────┐
│  [Filters Bar]                                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ RunewordCard│  │ RunewordCard│  │ RunewordCard│  ...    │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ RunewordCard│  │ RunewordCard│  │ RunewordCard│  ...    │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### RunewordCard
Displays a single runeword with all its data.

```
┌─────────────────────────────────────┐
│ Stone                    [2 Socket] │
│─────────────────────────────────────│
│ Runes: [Ta] [Ri]                    │
│ Items: Any Armor                    │
│─────────────────────────────────────│
│ Runeword Bonuses:                   │
│   +100 Defense                      │
│   +30 to Strength                   │
│   +80 to Life                       │
│   Damage Reduced by 5               │
│   Physical Resist: +10%             │
│─────────────────────────────────────│
│ Rune Bonuses (in Armor):            │
│   +30 Defense                       │
│   +5 to Mana after each Kill        │
└─────────────────────────────────────┘
```

### RunewordFilters
Filter controls above the list.

```
┌─────────────────────────────────────────────────────────────┐
│ Search: [___________________]  Sockets: [Any ▼]             │
│                                                             │
│ Item Type: [Any ▼]  Runes: [Select runes...]               │
│                                                             │
│ [Affix Selector Button]                                     │
└─────────────────────────────────────────────────────────────┘
```

### AffixSelector
Modal or dropdown for selecting specific affix patterns.

**Two Modes:**

1. **Category View** - Browse by affix categories
```
┌─────────────────────────────────────┐
│ Categories:                         │
│ ├─ Defense                          │
│ │  ├─ +# Defense                    │
│ │  ├─ +#% Enhanced Defense          │
│ │  └─ Damage Reduced by #           │
│ ├─ Damage                           │
│ │  ├─ +#% Enhanced Damage           │
│ │  ├─ Adds #-# Fire Damage          │
│ │  └─ ...                           │
│ ├─ Resistances                      │
│ │  ├─ Physical Resist: +#%          │
│ │  ├─ All Resistances +#            │
│ │  └─ ...                           │
│ └─ Skills                           │
│    └─ ...                           │
└─────────────────────────────────────┘
```

2. **Search Mode** - Search across all patterns
```
┌─────────────────────────────────────┐
│ Search: [resist_____________]       │
│─────────────────────────────────────│
│ Results:                            │
│ ☐ Physical Resist: +#%              │
│ ☐ Fire Resist +#%                   │
│ ☐ Cold Resist +#%                   │
│ ☐ Lightning Resist +#%              │
│ ☐ All Resistances +#                │
└─────────────────────────────────────┘
```

## Filter Capabilities

| Filter | Description | Implementation |
|--------|-------------|----------------|
| Text Search | Free-text search across all affix text | Match against `affix.rawText` |
| Affix Selector | Pick specific normalized patterns | Match against `affix.pattern` |
| Socket Count | Filter by number of sockets | Exact match or range |
| Item Type | Filter by allowed item types | Array contains match |
| Rune Filter | Filter by which runes are used | Array intersection |

## Search Scope

When searching/filtering, results include matches from:

1. **Runeword's own affixes** - The bonuses the runeword grants
2. **Rune bonuses** - What the individual runes contribute

This is important because a user searching for "defense" should see runewords where:
- The runeword itself gives defense bonuses, OR
- The runes used give defense bonuses

## Data Flow

```
┌─────────────────────────────────────────┐
│  User opens /runewords page             │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Check IndexedDB for fresh data         │
│  (via Core Data feature)                │
└─────────────────────────────────────────┘
                    │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│  Data fresh   │    │  Data stale/missing│
│               │    │  Show loading      │
│               │    │  Trigger parse saga│
└───────────────┘    └────────────────────┘
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Load runewords from IndexedDB          │
│  using useLiveQuery (reactive)          │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Apply filters (Redux state)            │
│  - Text search                          │
│  - Selected affixes                     │
│  - Socket/item type filters             │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Display filtered RunewordCards         │
└─────────────────────────────────────────┘
```

## State Management

### Redux Slice

```typescript
interface RunewordsState {
  filters: {
    searchText: string;
    selectedAffixPatterns: string[];
    socketCount: number | null;
    allowedItemTypes: string[];
    selectedRunes: string[];
  };
  affixSelectorOpen: boolean;
  viewMode: 'grid' | 'list';
}
```

### Data from Dexie

Runewords and runes are read directly from IndexedDB via `useLiveQuery`, not stored in Redux.

```typescript
const runewords = useLiveQuery(() => db.runewords.toArray());
const runes = useLiveQuery(() => db.runes.toArray());
```

## Feature Location

```
src/features/runewords/
├── components/
│   ├── RunewordCard.tsx
│   ├── RunewordFilters.tsx
│   ├── AffixSelector.tsx
│   └── RuneDisplay.tsx
├── containers/
│   └── RunewordListContainer.tsx
├── store/
│   └── runewordsSlice.ts
├── hooks/
│   ├── useRunewordFilters.ts
│   └── useAffixCategories.ts
├── types/
│   └── index.ts
└── screens/
    └── RunewordsScreen.tsx
```

## Future Enhancements

- Save filter presets
- Compare runewords side-by-side
- "Favorites" functionality
- Sort options (by name, sockets, etc.)
- Rune cost calculator (total runes needed)

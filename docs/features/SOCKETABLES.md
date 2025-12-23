# Socketables Feature

Unified view of all socketable items (gems, runes, crystals) with filtering.

## Purpose

- View all socketable items in one place
- Filter by category via checkboxes
- Search across name and bonus text
- Compare socketables across categories

## Data Sources

| Category | Table | Count |
|----------|-------|-------|
| Gems | `gems` | 48 |
| ESR Runes | `esrRunes` | ~46 |
| LoD Runes | `lodRunes` | 33 |
| Kanji Runes | `kanjiRunes` | 14 |
| Crystals | `crystals` | 36 |

**Total:** ~177 socketable items

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Socketables                                                │
├─────────────────────────────────────────────────────────────┤
│  ☑ Gems ☑ ESR Runes ☑ LoD Runes ☑ Kanji ☑ Crystals [All]   │
│  Search: [_______________________________]                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ Perfect Ruby     │  │ Ka Rune    [ESR] │                 │
│  │ Req Level: 35    │  │ Req Level: 1     │                 │
│  │ ─────────────────│  │ ─────────────────│                 │
│  │ Weapons/Gloves:  │  │ Weapons/Gloves:  │                 │
│  │  +40% Enh Damage │  │  +5 to Dexterity │                 │
│  │ Helms/Boots:     │  │ ...              │                 │
│  │  +38 to Life     │  │                  │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Filter Controls

### Checkbox Group
- 5 checkboxes: Gems, ESR Runes, LoD Runes, Kanji Runes, Crystals
- All checked by default
- "All" button resets all checkboxes to checked
- Toggling updates results immediately

### Text Search
- Searches against item **name** and **bonus text**
- Input is split by spaces, trimmed
- All words must match (AND logic)
- Example: `resist life` matches items containing both "resist" AND "life"

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

### Category Badges

| Category | Badge | Color |
|----------|-------|-------|
| Gems | Gem | Purple |
| ESR Runes | ESR | Gold |
| LoD Runes | LoD | Silver |
| Kanji Runes | Kanji | Red |
| Crystals | Crystal | Teal |

### Order
Fixed order: items displayed by category (Gems → ESR → LoD → Kanji → Crystals), then by tier/name within category. No user sorting options.

## State Management

```typescript
interface SocketablesState {
  enabledCategories: {
    gems: boolean;
    esrRunes: boolean;
    lodRunes: boolean;
    kanjiRunes: boolean;
    crystals: boolean;
  };
  searchText: string;
}
```

**Actions:** `toggleCategory`, `setSearchText`, `selectAll`

## Feature Location

```
src/features/socketables/
├── components/
│   ├── SocketableCard.tsx
│   ├── SocketableFilters.tsx
│   └── CategoryBadge.tsx
├── store/
│   └── socketablesSlice.ts
├── hooks/
│   └── useFilteredSocketables.ts
└── screens/
    └── SocketablesScreen.tsx
```

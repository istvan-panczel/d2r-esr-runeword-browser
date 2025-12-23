# Runewords Feature

The primary feature - browse and filter all Eastern Sun Resurrected runewords.

## Purpose

- View all runewords with complete data
- Filter by runes, text search, sockets, and item types
- See runeword bonuses AND rune contributions
- Future: Filter by specific affix patterns with minimum values

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Runewords                                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  Search: [_______________________]   Sockets: [_]   ☑W ☑A ☑S           │
│                                                                         │
│  Runes: [All]                                                           │
│  ┌─ Tier 1 [☑] ─────────────────────────────────────────────────────┐  │
│  │ ☑ I Rune  ☑ Ro Rune  ☑ Ha Rune  ☑ Ni Rune  ☑ Ho Rune  ...       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌─ Tier 2 [☑] ─────────────────────────────────────────────────────┐  │
│  │ ☑ To Rune  ☑ Chi Rune  ☑ Ri Rune  ...                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ... (more tiers)                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ Stone    [2 Sk] │  │ Boar     [1 Sk] │  │ Airship  [5 Sk] │         │
│  │ [Ta] [Ri]       │  │ [I]             │  │ [Hi][Ko]...     │         │
│  │ Items: Armor    │  │ Items: Weapon   │  │ Items: Weapon   │         │
│  │ ───────────────│  │ ────────────────│  │ ────────────────│         │
│  │ +100 Defense   │  │ +50% Enh Damage │  │ ...             │         │
│  │ +30 Strength   │  │ ...             │  │                 │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Filters

### Rune Checkbox Filter
- All runes (ESR, LoD, Kanji) in a single tiered list
- Rune names displayed with colors
- **3-way tier checkbox**: all selected / some selected / none selected
- **Global "All" toggle**: select/deselect all runes
- All runes checked by default
- **Logic**: Runeword hidden if ANY of its runes are unchecked (strict)

### Text Search
- Searches runeword name + affix text
- Split by spaces, trimmed, AND logic (same as Socketables)
- Example: `resist life` matches runewords with both "resist" AND "life"

### Socket Count
- Single-digit number input (1-6)
- Default: empty (shows all runewords)
- If set: only runewords with that exact socket count

### Item Type
- Checkbox group: ☑ Weapon ☑ Armor ☑ Shield
- All checked by default
- Runeword shown if its allowedItems matches ANY checked type

### Affix Pattern Filter (Future)
- Requires populating the `affixes` table
- Users will select patterns and set minimum values
- Example: select "+#% Enhanced Damage" with min value 100

## Filter Capabilities

| Filter | Description | Logic |
|--------|-------------|-------|
| Text Search | Search name + affix text | AND (all words must match) |
| Rune Filter | Checkbox per rune | Hide if ANY rune unchecked |
| Socket Count | Number input | Exact match (empty = all) |
| Item Type | 3 checkboxes | Show if ANY type matches |

## RunewordCard Display

- Runeword name with socket count badge
- Rune sequence (clickable for tooltip)
- Allowed item types
- Runeword bonuses (affixes)
- Rune bonuses (what the runes contribute)

### RuneTooltip

Hover/tap on a rune shows:
- Rune name (in color) with tier badge
- Required level
- Bonuses for each slot type (Weapons/Gloves, Helms/Boots, Armor/Shields/Belts)

## State Management

```typescript
interface RunewordsState {
  filters: {
    searchText: string;
    socketCount: number | null;
    itemTypes: { weapon: boolean; armor: boolean; shield: boolean };
    selectedRunes: Record<string, boolean>;  // rune name → checked
  };
}
```

**Actions:** `setSearchText`, `setSocketCount`, `toggleItemType`, `toggleRune`, `toggleTier`, `selectAllRunes`

## Feature Location

```
src/features/runewords/
├── components/
│   ├── RunewordCard.tsx
│   ├── RunewordFilters.tsx
│   ├── RuneCheckboxGroup.tsx
│   └── RuneTooltip.tsx
├── store/
│   └── runewordsSlice.ts
├── hooks/
│   └── useFilteredRunewords.ts
└── screens/
    └── RunewordsScreen.tsx
```

## Future Enhancements

- Affix pattern selector with minimum values
- Save filter presets
- Compare runewords side-by-side
- Sort options (by name, sockets, etc.)

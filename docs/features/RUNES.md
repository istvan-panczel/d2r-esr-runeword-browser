# Runes Feature

Browse all Eastern Sun Resurrected runes across three categories.

## Purpose

Allow users to:
- View all runes organized by category (ESR, LoD, Kanji)
- Filter/search runes by name
- See rune bonuses for all item types
- Understand rune tiers and progression

## Rune Categories

The runes page has **3 sub-tabs** for different rune types:

### ESR Runes (Default Tab)
Custom runes introduced by Eastern Sun Resurrected.

| Property | Value |
|----------|-------|
| Count | ~50 runes |
| Range | I Rune → Null Rune |
| Levels | 2-60 |
| Tiers | Determined by color (parsed from HTML) |

### LoD Runes
Original Diablo 2: Lord of Destruction runes.

| Property | Value |
|----------|-------|
| Count | 35 runes |
| Range | El Rune → Zod Rune |
| Levels | 11-69 |
| Order | Sequential (El=1, Zod=35) |

### Kanji Runes
Thematic high-level runes with elemental/conceptual names.

| Property | Value |
|----------|-------|
| Count | ~14 runes |
| Range | Moon Rune → God Rune |
| Levels | All level 60 |
| Special | All have "+1 to All Skills" |

## UI Components

### RunesScreen

Main screen with tab navigation between rune categories.

```
┌─────────────────────────────────────────────────────────────┐
│  [ESR Runes]  [LoD Runes]  [Kanji Runes]                   │
├─────────────────────────────────────────────────────────────┤
│  Search: [___________________]                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              (Tab Content - see below)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### ESR Runes Tab

ESR runes grouped by tier (color-based).

```
┌─────────────────────────────────────────────────────────────┐
│  ═══════════════ Tier 1 (White) ═══════════════            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ I Rune   │  │ Ro Rune  │  │ Ha Rune  │  ...             │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  ═══════════════ Tier 2 (Yellow) ═══════════════           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Ni Rune  │  │ Ho Rune  │  │ To Rune  │  ...             │
│  └──────────┘  └──────────┘  └──────────┘                  │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### LoD Runes Tab

LoD runes in sequential order.

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ El Rune  │  │ Eld Rune │  │ Tir Rune │  │ Nef Rune │    │
│  │ Lvl 11   │  │ Lvl 11   │  │ Lvl 13   │  │ Lvl 13   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ...                                                        │
│  ┌──────────┐  ┌──────────┐                                │
│  │ Cham Rune│  │ Zod Rune │                                │
│  │ Lvl 67   │  │ Lvl 69   │                                │
│  └──────────┘  └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

### Kanji Runes Tab

All Kanji runes (same level, thematic grouping).

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Moon Rune │  │Fire Rune │  │Water Rune│  │Wood Rune │    │
│  │ Lvl 60   │  │ Lvl 60   │  │ Lvl 60   │  │ Lvl 60   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### RuneCard

Displays a single rune with all its data.

```
┌─────────────────────────────────────┐
│ Ka Rune                    [Tier 2] │
│ Req Level: 23                       │
│─────────────────────────────────────│
│ Weapons/Gloves:                     │
│   +15% Enhanced Damage              │
│   +5 to Minimum Damage              │
│─────────────────────────────────────│
│ Helms/Boots:                        │
│   +20 Defense                       │
│   +5% Faster Hit Recovery           │
│─────────────────────────────────────│
│ Armor/Shields/Belts:                │
│   +30 Defense                       │
│   Damage Reduced by 3               │
└─────────────────────────────────────┘
```

**Display Notes:**
- Rune name displayed in its color (from parsed `color` property)
- Tier badge (for ESR runes) or order number (for LoD)
- Required level prominently shown
- All three bonus categories always visible

## URL Structure

```
/runes           → ESR Runes (default)
/runes/esr       → ESR Runes
/runes/lod       → LoD Runes
/runes/kanji     → Kanji Runes
```

Alternatively, use query params or tab state instead of nested routes.

## Data Flow

```
┌─────────────────────────────────────────┐
│  User navigates to /runes               │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Load runes from appropriate table      │
│  based on selected tab                  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Group/sort based on rune type:         │
│  - ESR: Group by tier (color)           │
│  - LoD: Sort by order                   │
│  - Kanji: Display all                   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Apply search filter if active          │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Display RuneCards                      │
└─────────────────────────────────────────┘
```

## State Management

### Redux Slice

```typescript
interface RunesState {
  activeTab: 'esr' | 'lod' | 'kanji';
  searchText: string;
}
```

### Data from Dexie

```typescript
// Each rune type has its own table
const esrRunes = useLiveQuery(() => db.esrRunes.orderBy('tier').toArray());
const lodRunes = useLiveQuery(() => db.lodRunes.orderBy('order').toArray());
const kanjiRunes = useLiveQuery(() => db.kanjiRunes.toArray());
```

## ESR Rune Tier Derivation

Tiers are determined by parsing the `color` attribute from HTML:

```typescript
// During parsing
const fontElement = runeRow.querySelector('font[color]');
const color = fontElement?.getAttribute('color') || 'WHITE';

// Map colors to tiers
const colorToTier: Record<string, number> = {
  'WHITE': 1,
  'YELLOW': 2,
  'ORANGE': 3,
  // ... determined during implementation
};
```

## Feature Location

```
src/features/runes/
├── components/
│   ├── RuneCard.tsx
│   ├── RuneSearch.tsx
│   ├── RuneTabs.tsx
│   ├── EsrRuneList.tsx
│   ├── LodRuneList.tsx
│   ├── KanjiRuneList.tsx
│   └── TierSection.tsx
├── containers/
│   └── RuneListContainer.tsx
├── store/
│   └── runesSlice.ts
├── hooks/
│   ├── useRuneSearch.ts
│   └── useRunesByTab.ts
├── types/
│   └── index.ts
└── screens/
    └── RunesScreen.tsx
```

## Shared Components

The `RuneCard` component is reused for the rune tooltip feature on the Runewords page. The same component renders in:
- Full card view (Runes page)
- Tooltip/popover view (Runewords page hover)

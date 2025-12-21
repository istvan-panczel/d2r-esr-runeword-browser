# Gems Feature

Browse all Eastern Sun Resurrected gems.

## Purpose

Allow users to:
- View all gems organized by type and quality
- Filter/search gems
- See gem bonuses for different item types

## Gem Types

8 gem types, each with 6 quality tiers:

| Type | Description |
|------|-------------|
| Amethyst | Purple gem |
| Sapphire | Blue gem |
| Emerald | Green gem |
| Ruby | Red gem |
| Diamond | White gem |
| Topaz | Yellow gem |
| Skull | Bone-colored |
| Obsidian | Black gem |

## Quality Tiers

| Quality | Req Level |
|---------|-----------|
| Chipped | 1 |
| Flawed | 7 |
| Standard | 14 |
| Flawless | 21 |
| Blemished | 28 |
| Perfect | 35 |

**Total gems:** 8 types × 6 tiers = 48 gems

## UI Components

### GemList

Main container displaying gems, grouped by type with quality progression.

```
┌─────────────────────────────────────────────────────────────┐
│  Search: [___________]  Type: [All ▼]  Quality: [All ▼]    │
├─────────────────────────────────────────────────────────────┤
│  ═══════════════ Amethyst ═══════════════                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ...             │
│  │ Chipped  │  │ Flawed   │  │ Standard │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  ═══════════════ Sapphire ═══════════════                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ...             │
│  │ Chipped  │  │ Flawed   │  │ Standard │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### GemCard

Displays a single gem with all bonuses.

```
┌─────────────────────────────────────┐
│ Perfect Ruby              [Perfect] │
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
- Gem type indicator (color/icon)
- Quality badge
- All three bonus categories visible

### GemFilters

```
┌─────────────────────────────────────────────────────────────┐
│ Search: [___________]                                       │
│ Type: [All ▼]  Quality: [All ▼]                            │
└─────────────────────────────────────────────────────────────┘
```

- **Search**: Filter by name
- **Type**: Filter by gem type (Amethyst, Sapphire, etc.)
- **Quality**: Filter by quality tier (Chipped → Perfect)

## Data Flow

```
┌─────────────────────────────────────────┐
│  User navigates to /gems                │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Load gems from IndexedDB               │
│  using useLiveQuery                     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Group by type, sort by quality         │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Apply filters (type, quality, search)  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Display GemCards in type sections      │
└─────────────────────────────────────────┘
```

## State Management

### Redux Slice

```typescript
interface GemsState {
  searchText: string;
  selectedType: GemType | null;      // null = all types
  selectedQuality: GemQuality | null; // null = all qualities
}
```

### Data from Dexie

```typescript
const gems = useLiveQuery(() => db.gems.toArray());
```

## Feature Location

```
src/features/gems/
├── components/
│   ├── GemCard.tsx
│   ├── GemFilters.tsx
│   ├── GemTypeSection.tsx
│   └── QualityBadge.tsx
├── containers/
│   └── GemListContainer.tsx
├── store/
│   └── gemsSlice.ts
├── hooks/
│   └── useGemFilters.ts
├── types/
│   └── index.ts
└── screens/
    └── GemsScreen.tsx
```

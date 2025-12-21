# Crystals Feature

Browse all Eastern Sun Resurrected crystals.

## Purpose

Allow users to:
- View all crystals organized by type and quality
- Filter/search crystals
- See crystal bonuses for different item types

## Crystal Types

12 crystal types, each with 3 quality tiers:

| Type | Description |
|------|-------------|
| Shadow Quartz | Dark crystal |
| Frozen Soul | Ice crystal |
| Bleeding Stone | Blood-red crystal |
| Burning Sulphur | Fire crystal |
| Dark Azurite | Deep blue crystal |
| Bitter Peridot | Green crystal |
| Pulsing Opal | Iridescent crystal |
| Enigmatic Cinnabar | Red-orange crystal |
| Tomb Jade | Pale green crystal |
| Solid Mercury | Metallic crystal |
| Storm Amber | Yellow crystal |
| Tainted Tourmaline | Multi-colored crystal |

## Quality Tiers

| Quality | Req Level |
|---------|-----------|
| Chipped | 6 |
| Flawed | 24 |
| Standard | 42 |

**Total crystals:** 12 types × 3 tiers = 36 crystals

## UI Components

### CrystalList

Main container displaying crystals, grouped by type with quality progression.

```
┌─────────────────────────────────────────────────────────────┐
│  Search: [___________]  Type: [All ▼]  Quality: [All ▼]    │
├─────────────────────────────────────────────────────────────┤
│  ═══════════════ Shadow Quartz ═══════════════             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Chipped  │  │ Flawed   │  │ Standard │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  ═══════════════ Frozen Soul ═══════════════               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Chipped  │  │ Flawed   │  │ Standard │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### CrystalCard

Displays a single crystal with all bonuses.

```
┌─────────────────────────────────────┐
│ Burning Sulphur           [Flawed] │
│ Req Level: 24                       │
│─────────────────────────────────────│
│ Weapons/Gloves:                     │
│   +15% Fire Damage                  │
│─────────────────────────────────────│
│ Helms/Boots:                        │
│   +20% Fire Resist                  │
│─────────────────────────────────────│
│ Armor/Shields/Belts:                │
│   +25% Fire Resist                  │
└─────────────────────────────────────┘
```

**Display Notes:**
- Crystal type indicator (each has unique color)
- Quality badge
- All three bonus categories visible

### CrystalFilters

```
┌─────────────────────────────────────────────────────────────┐
│ Search: [___________]                                       │
│ Type: [All ▼]  Quality: [All ▼]                            │
└─────────────────────────────────────────────────────────────┘
```

- **Search**: Filter by name
- **Type**: Filter by crystal type
- **Quality**: Filter by quality tier (Chipped, Flawed, Standard)

## Data Flow

```
┌─────────────────────────────────────────┐
│  User navigates to /crystals            │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Load crystals from IndexedDB           │
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
│  Display CrystalCards in type sections  │
└─────────────────────────────────────────┘
```

## State Management

### Redux Slice

```typescript
interface CrystalsState {
  searchText: string;
  selectedType: CrystalType | null;      // null = all types
  selectedQuality: CrystalQuality | null; // null = all qualities
}
```

### Data from Dexie

```typescript
const crystals = useLiveQuery(() => db.crystals.toArray());
```

## Feature Location

```
src/features/crystals/
├── components/
│   ├── CrystalCard.tsx
│   ├── CrystalFilters.tsx
│   ├── CrystalTypeSection.tsx
│   └── QualityBadge.tsx
├── containers/
│   └── CrystalListContainer.tsx
├── store/
│   └── crystalsSlice.ts
├── hooks/
│   └── useCrystalFilters.ts
├── types/
│   └── index.ts
└── screens/
    └── CrystalsScreen.tsx
```

## Comparison to Gems

Crystals are similar to gems but with key differences:

| Aspect | Gems | Crystals |
|--------|------|----------|
| Types | 8 | 12 |
| Tiers | 6 | 3 |
| Level range | 1-35 | 6-42 |
| Color source | Fixed per type | Unique per type (from HTML) |

Both share the same bonus structure (Weapons/Gloves, Helms/Boots, Armor/Shields/Belts).

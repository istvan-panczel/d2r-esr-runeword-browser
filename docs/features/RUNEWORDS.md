# Runewords Feature

The primary feature - browse and filter all Eastern Sun Resurrected runewords.

## Purpose

- View all runewords with complete data
- Filter by runes, text search, sockets, item types, required level, and tier points
- See runeword bonuses (per-column: weapon/helm/armor) AND rune contributions
- Share filtered views via URL

## Filters

### Text Search
- Searches runeword name + affix text
- Split by spaces, trimmed, AND logic
- Supports quoted phrases: `"exact phrase"`
- Example: `resist life` matches runewords with both "resist" AND "life"

### Socket Count
- Single-digit number input (1-6)
- Default: empty (shows all runewords)
- If set: only runewords with that exact socket count

### Max Required Level
- Number input to cap the required level of shown runewords
- Default: empty (no cap)

### Item Type Filter
- Data-driven checkboxes organized into categories (Weapons, Armors, Shields, etc.)
- Group-level toggles (`toggleItemTypeGroup`) to select/deselect entire categories
- All checked by default
- Runeword shown if its `allowedItems` matches ANY checked type

### Rune Checkbox Filter
- All runes (ESR, LoD, Kanji) in a tiered list
- Rune names displayed with colors
- **3-way tier checkbox**: all selected / some selected / none selected
- **Group toggle** (`toggleRuneGroup`): select/deselect all runes in a tier
- **Global "All" toggle**: select/deselect all runes
- All runes checked by default
- **Logic**: Runeword hidden if ANY of its runes are unchecked (strict)

### Tier Points Filter
- Filter by maximum tier points per rune category (ESR/LoD)
- "Clear All" button (`clearAllTierPoints`) to reset all tier point filters

## Runeword Model

```typescript
type RuneCategory = 'esrRunes' | 'lodRunes';

interface TierPointTotal {
  readonly tier: number;
  readonly category: RuneCategory;
  readonly totalPoints: number;
}

interface Runeword {
  readonly name: string;
  readonly variant: number;                     // 1, 2, 3... for multi-variant runewords
  readonly sockets: number;
  readonly reqLevel: number;                    // Highest required level among all runes and gems
  readonly sortKey: number;                     // Pre-calculated sort key
  readonly runes: readonly string[];            // Rune names in order
  readonly gems: readonly string[];             // Gem names (e.g. ["Perfect Topaz"])
  readonly ingredients: readonly string[];      // All items in original order (runes + gems interleaved)
  readonly allowedItems: readonly string[];
  readonly excludedItems: readonly string[];    // Items excluded from this variant
  readonly affixes: readonly Affix[];           // Backward compat: bonuses from first non-empty column
  readonly columnAffixes: SocketableBonuses;    // Per-column bonuses (weapon/helm/armor)
  readonly tierPointTotals: readonly TierPointTotal[];
  readonly jewelInfo?: string;                  // Optional jewel info for Kanji runewords
}
```

**Key model details:**
- **Compound primary key**: `[name+variant]` - some runewords have multiple variants with different recipes
- **gems**: Runewords can require gems in addition to runes (added in v1.4.0)
- **ingredients**: The original order of runes + gems interleaved in the recipe
- **columnAffixes**: Per-column bonuses displayed as split cards (weapon/helm/armor)
- **sortKey**: Pre-calculated for sorting: ESR/Kanji (0-9999) or LoD (10000+) combined with reqLevel
- **jewelInfo**: e.g. "(0-3) Jewels" for Kanji runewords

## RunewordCard Display

- Runeword name with socket count badge
- Item count displayed in page title
- Rune and gem sequence (with tooltips for hover info)
- Allowed item types
- **Per-column bonuses** (split card layout): Shows bonuses specific to weapon/helm/armor columns
- Tier point totals per category
- Optional jewel info

## State Management

```typescript
interface RunewordsState {
  readonly searchText: string;
  readonly socketCount: number | null;
  readonly maxReqLevel: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
  readonly selectedRunes: Record<string, boolean>;  // "category:runeName" → checked
  readonly maxTierPoints: Record<string, number | null>;
}
```

**Actions:** `setSearchText`, `setSocketCount`, `setMaxReqLevel`, `toggleItemType`, `setAllItemTypes`, `selectAllItemTypes`, `deselectAllItemTypes`, `toggleRune`, `setAllRunes`, `selectAllRunes`, `deselectAllRunes`, `toggleRuneGroup`, `toggleItemTypeGroup`, `setMaxTierPoints`, `clearAllTierPoints`

## Hooks

- `useFilteredRunewords()` - Applies all filters (search, sockets, req level, item types, runes, tier points)
- `useRuneGroups()` - Groups runes by category/tier for the filter UI
- `useRuneBonuses()` - Gets bonuses for runes in a runeword
- `useAvailableItemTypes()` - Lists valid item types from DB
- `useShareUrl()` - Generates shareable URLs with current filter state
- `useUrlInitialize()` - Initializes filters from URL params, cleans URL after load

## Feature Location

```
src/features/runewords/
├── components/
│   ├── GemBadge.tsx             # Gem display badge
│   ├── GemTooltip.tsx           # Gem hover tooltip
│   ├── ItemTypeFilter.tsx       # Item type checkbox filter
│   ├── RuneBadge.tsx            # Rune display badge
│   ├── RuneCheckboxGroup.tsx    # Tiered rune checkbox group
│   ├── RuneTooltip.tsx          # Rune hover tooltip
│   ├── RunewordCard.tsx         # Main runeword card display
│   ├── RunewordFilters.tsx      # All filter controls
│   ├── RunewordPointsDisplay.tsx # Tier point totals display
│   └── TierPointsFilter.tsx     # Tier points filter controls
├── constants/
│   ├── itemTypeCategories.ts    # Item type category definitions
│   └── tierColors.ts            # Tier color mappings
├── hooks/
│   ├── useAvailableItemTypes.ts
│   ├── useFilteredRunewords.ts
│   ├── useRuneBonuses.ts
│   ├── useRuneGroups.ts
│   ├── useShareUrl.ts
│   └── useUrlInitialize.ts
├── screens/
│   └── RunewordsScreen.tsx
├── store/
│   └── runewordsSlice.ts
├── types/
│   └── index.ts
└── utils/
    ├── filteringHelpers.ts
    └── itemCategoryMapping.ts
```

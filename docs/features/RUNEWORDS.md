# Runewords Feature

The primary feature - browse and filter all Eastern Sun Resurrected runewords.

## Purpose

- View all runewords with complete data
- Filter by runes, text search, sockets (exact count or range), item types, required level, and tier points
- See runeword bonuses (per-column: weapon/helm/armor) AND rune contributions
- Share filtered views via URL

## List Order

One list for ESR, Kanji and LoD runewords: ascending required level, ties by name A→Z
(case-insensitive, regardless of ESR/Kanji/LoD), then variant. There is no sort control.
The order comes from `compareRunewordsByLevel` (`utils/filteringHelpers.ts`), applied in the
hook's query (`queryRunewordsInDisplayOrder`) rather than by a Dexie index, because IndexedDB
compares names by code unit (the source's lowercase "hand of Justice" would land after "Pride").

## Filters

### Text Search

- Searches runeword name + affix text
- Split by spaces, trimmed, AND logic
- Supports quoted phrases: `"exact phrase"`
- Example: `resist life` matches runewords with both "resist" AND "life"

### Sockets

- Text input taking an exact count or a range of socket counts (1-6): `4`, `2-4`, `-4` (up to 4),
  `4-` (4 or more); a help popover lists the forms (`src/core/utils/socketRange.ts`)
- Default: empty (shows all runewords); malformed text keeps the previous filter and is marked invalid
- If set: only runewords that can be made with a socket count inside the range
- Runewords without a range match when their exact `sockets` count is inside it; recipes with optional jewels
  (shown as "3-6 Socket") match when `[sockets, socketsMax]` overlaps it
- Share URL: `?sockets=4` or `?sockets=2-4` (old exact-count links keep working)

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
- **Logic** (default, strict): runeword hidden if ANY of its runes are unchecked, i.e. it shows words you can make
  from the checked runes
- **"Any of these runes"** checkbox next to All/None (with a help popover): shows runewords that contain AT LEAST ONE
  checked rune. "Which words use Ber?" = None, check Ber, tick "Any of these runes". With every rune checked (the
  default) both modes show everything. A rune counts as checked when it is checked in any of its categories (Ko is in
  ESR and LoD). Entries without runes are never hidden by the rune filter.
- `matchesRunes(runeword, selectedRunes, runeCategoryMap, mode)` with `mode: 'all' | 'any'` (`SocketableMatchMode`)
- URL: `runemode=any` (omitted when strict), via `appendMatchModeParam` / `parseMatchModeParam` in `filterUrlParams.ts`
- Gemwords have their own `GemCheckboxGroup` and filter helpers and do not have this mode yet; the shared helpers
  are ready for a `gems` equivalent

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
  readonly variant: number; // 1, 2, 3... for multi-variant runewords
  readonly sockets: number; // Base/minimum socket count (= ingredients + required jewels)
  readonly socketsMax?: number; // Only set when the source shows a range, e.g. "(2-3 Socket)"
  readonly reqLevel: number; // Highest required level among all runes and gems
  readonly sortKey: number; // = reqLevel (old cached rows: LoD = 10000 + reqLevel)
  readonly isLod: boolean; // Has a LoD-exclusive rune
  readonly runes: readonly string[]; // Rune names in order
  readonly gems: readonly string[]; // Gem names (e.g. ["Perfect Topaz"])
  readonly ingredients: readonly string[]; // All items in original order (runes + gems interleaved)
  readonly allowedItems: readonly string[];
  readonly excludedItems: readonly string[]; // Items excluded from this variant
  readonly affixes: readonly Affix[]; // Backward compat: bonuses from first non-empty column
  readonly columnAffixes: SocketableBonuses; // Per-column bonuses (weapon/helm/armor)
  readonly tierPointTotals: readonly TierPointTotal[];
  readonly jewelInfo?: string; // Jewel info, e.g. "(0-3) Jewels" (optional) or "(2) Jewels" (required)
}
```

**Key model details:**

- **Compound primary key**: `[name+variant]` - some runewords have multiple variants with different recipes
- **gems**: Runewords can require gems in addition to runes (added in v1.4.0)
- **ingredients**: The original order of runes + gems interleaved in the recipe
- **columnAffixes**: Per-column bonuses displayed as split cards (weapon/helm/armor)
- **sortKey**: `= reqLevel` for every runeword (same as gemwords). Up to v1.44.0 LoD runewords
  stored `10000 + reqLevel` so they sorted after ESR/Kanji; the list now sorts by `reqLevel`, so
  rows still cached in that format sort the same way.
- **isLod**: `true` when the recipe has a LoD-exclusive rune (`isLodRuneword` in the parser). Shared
  runes like Ko (in both ESR and LoD) do not count on their own. Picks which rune variant the card
  shows (badges, rune bonuses) and the tier-point category. Old cached rows lack it; the card then
  reads it from the legacy sort key (`runewordIsLod`).
- **jewelInfo**: e.g. "(0-3) Jewels" — recipes that accept optional jewels on top of their runes.
  Since ESR 3.2 the source also lists each socket count of such a recipe as its own row with plain
  "Jewel" lines; those rows get e.g. "(2) Jewels" and `sockets` = runes + gems + jewels.
- **socketsMax**: Set only for the optional-jewel recipes, which the source shows as a range,
  e.g. Moonlight `(3-6 Socket)`. `sockets` stays the base count; the socket filter matches when
  its range overlaps `[sockets, socketsMax]` and the card shows "3-6 Socket".

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
  readonly socketRange: SocketRange | null; // { min, max }, exact counts have min === max
  readonly maxReqLevel: number | null;
  readonly selectedItemTypes: Record<string, boolean>;
  readonly selectedRunes: Record<string, boolean>; // "category:runeName" → checked
  readonly runeMatchMode: 'all' | 'any'; // 'all' = strict (default)
  readonly maxTierPoints: Record<string, number | null>;
}
```

**Actions:** `setSearchText`, `setSocketRange`, `setMaxReqLevel`, `toggleItemType`, `setAllItemTypes`, `selectAllItemTypes`, `deselectAllItemTypes`, `toggleRune`, `setAllRunes`, `selectAllRunes`, `deselectAllRunes`, `toggleRuneGroup`, `setRuneMatchMode`, `toggleItemTypeGroup`, `setMaxTierPoints`, `clearAllTierPoints`

## Hooks

- `useFilteredRunewords()` - Applies all filters (search, sockets, req level, item types, runes, tier points) to the list in screen order (see [List Order](#list-order))
- `useRuneGroups()` - Groups runes by category/tier for the filter UI
- `useSocketableLookup()` (`src/core/hooks/useSocketableLookup.ts`) - Rune/gem lookup (built by `src/core/utils/socketableLookup.ts`) used for badges, tooltips and bonuses; `RunewordsScreen` loads it once (`useSocketableLookupQuery`) and provides it via `SocketableLookupContext`
- `useAvailableItemTypes()` - Lists valid item types from DB (thin wrapper over `src/core/hooks/useAvailableItemTypes.ts`)
- `useShareUrl()` - Generates shareable URLs with current filter state
- `useUrlInitialize()` - Initializes filters from URL params, cleans URL after load

## Feature Location

```
src/features/runewords/
├── components/
│   ├── RuneBadge.tsx            # Rune display badge
│   ├── RuneCheckboxGroup.tsx    # Tiered rune checkbox group
│   ├── RuneTooltip.tsx          # Rune hover tooltip
│   ├── RunewordCard.tsx         # Main runeword card display
│   ├── RunewordFilters.tsx      # All filter controls
│   ├── RunewordPointsDisplay.tsx # Tier point totals display
│   └── TierPointsFilter.tsx     # Tier points filter controls
├── constants/
│   └── tierColors.ts            # Tier color mappings
├── hooks/
│   ├── useAvailableItemTypes.ts
│   ├── useFilteredRunewords.ts
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
    └── filteringHelpers.ts
```

Shared with gemwords (in `src/core/`): `components/RecipeCommonFilters.tsx` (search, sockets, req level, item types via `ItemTypeFilter.tsx`), `components/RecipeBonuses.tsx`, `components/GemBadge.tsx` / `GemTooltip.tsx`, `constants/itemTypeCategories.ts`, `utils/itemCategoryMapping.ts`, `utils/columnAffixes.ts`.

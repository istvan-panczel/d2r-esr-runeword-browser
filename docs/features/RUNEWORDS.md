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

## Jewel Recipes (folded on the list)

The game has no optional sockets, so ESR adds one runes.txt row per jewel count, jewels first and either plain
Jewels (`jew`) or Mythical Jewels (`mjw`), never mixed. Dragon Master: `r93 r33 r43`, `jew r93 r33 r43`,
`jew jew …`, `jew jew jew …`, then the same three with `mjw`. The site (our source) shows a range row
("(3-6 Socket)", "(0-3) Jewels", the no-jewel recipe) followed by one row per jewel count ("(4 Socket)" with a
"Jewel" line, "(5 Socket)" with two, …); it lists no `mjw` rows. The parser and the database keep every row (builds and
guide refs, favourites and the Best Base finder use `[name, variant]`).

The Runewords list folds them (`foldJewelVariants`, `utils/foldJewelVariants.ts`, in `useFilteredRunewords` on the
sorted rows, before the column expansion and the filters; order kept): rows of the same runeword with the same content
(runes, gems, ingredients, allowed / excluded items, affixes, column affixes; everything except `variant`, `sockets`,
`socketsMax`, `jewelInfo`) become one entry. It is the lowest variant (so the favourite id stays), with the socket range
min `sockets` … max covered count of the group and a regenerated `jewelInfo` in the parser's formats (`formatJewelInfo`:
"(0-3) Jewels", "(1-2) Jewels", "(1) Jewel"). A range row only covers the counts no per-count row of its recipe lists,
so its own `socketsMax` does not leak into an entry those rows are not part of. ESR 3.2.24 fixture: 409 rows → 386
entries; most jewel runewords become one card (Dragon Master, Moonlight, Storm Earth and Fire 3-6 "(0-3) Jewels";
Gold Scarab 4-6; Sunlight 3-4; Might of the Earth and Work of God 5-6). Two differ by jewel count:

- **Tourbillion**: "4 Socket" without jewels (Bleed 250-500) and "5-6 Socket" "(1-2) Jewels" (Inner Sight on hit
  instead)
- **Wooden Colossus**: "5 Socket" (+300 Strength) and "6 Socket" "(1) Jewel" (+150 Strength)

Shinigami's rows differ by item type (two-handed vs other melee), not by jewel count: two cards, each "2-6 Socket"
"(0-4) Jewels". The socket filter reads the folded range (a 5-socket filter finds Dragon Master and Tourbillion 5-6).
Cards with any jewel socket add a muted line: "Jewels or Mythical Jewels (not mixed); jewels go in the first sockets."

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
- Rune names displayed with colors (no icons; those are on the cards' socket row)
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
  "Jewel" lines; those rows get e.g. "(2) Jewels" and `sockets` = runes + gems + jewels. The database keeps
  the rows as the site lists them; the list folds them (see [Jewel Recipes](#jewel-recipes-folded-on-the-list)).
- **socketsMax**: Set only for the optional-jewel recipes, which the source shows as a range,
  e.g. Moonlight `(3-6 Socket)`. `sockets` stays the base count; the socket filter matches when
  its range overlaps `[sockets, socketsMax]` and the card shows "3-6 Socket".

## RunewordCard Display

- Runeword name with socket count badge
- Item count displayed in page title
- **Socket row** (`RunewordSocketRow`, above the badges; on every `RunewordCard`, so also on the runeword cards the
  Builds and Guide pages embed): one round dark socket per socket of the item (36 px, the row adds about 42 px to the
  card), from `buildSocketSlots(runeword)` (`utils/socketSlots.ts`):
  - first the required jewel sockets (empty, with the filled sockets' ring), then the optional ones (dimmed, dashed
    outline), as runes.txt and the site put the jewels first; the row is as long as the (maximum) socket count. No
    jewel art yet (plain jewels use the itemtypes InvGfx invjw1–6, which the icon extraction does not cover). Counts
    come from the numbers, not the `jewelInfo` text: required = `sockets − ingredients`, optional =
    `socketsMax − sockets` (Moonlight `3-6`: 3 optional + 3 runes; Tourbillion's folded `5-6`: 1 required + 1
    optional + 4 runes). The fixture test checks every row gets `socketsMax ?? sockets` slots and that the counts
    agree with every `jewelInfo` text
  - then the ingredients in recipe order (runes and gems interleaved) with their 30 px HD icon (`ItemIcon`); runes
    through `runeIconRef` (the rune as `resolveRune` picks it for the card's `isLod`, so Ko gets the LoD art in a LoD
    runeword); a click / tap opens the same popover as the badge (`RuneTooltip` / `GemTooltip`), `aria-label` = name,
    no hover `title` (details come from the popover only, like the badges)
  - jewel sockets are not interactive (`role="img"`, `aria-label` "Jewel socket" / "Optional jewel socket"); while
    icons.json loads (`useItemIcons`, one shared load) and for a missing icon a socket stays an empty circle of the
    same size
- Badge sequence: the jewel info badge first (as the site lists it), then the rune and gem badges (tier / gem
  coloured, with tooltips)
- On cards with jewel sockets (`hasJewelSlots`): the muted Mythical Jewel note (see [Jewel Recipes](#jewel-recipes-folded-on-the-list))
- Allowed item types
- **Per-column bonuses** (split card layout): Shows bonuses specific to weapon/helm/armor columns
- Tier point totals per category

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

- `useFilteredRunewords()` - Folds the per-jewel-count rows (`foldJewelVariants`), then applies all filters (search, sockets, req level, item types, runes, tier points) to the list in screen order (see [List Order](#list-order))
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
│   ├── RunewordSocketRow.tsx    # Socket row with rune / gem icons and jewel sockets
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
    ├── filteringHelpers.ts
    ├── foldJewelVariants.ts     # one list entry per jewel recipe content
    └── socketSlots.ts           # buildSocketSlots, hasJewelSlots, runeIconRef
```

Shared with gemwords (in `src/core/`): `components/RecipeCommonFilters.tsx` (search, sockets, req level, item types via `ItemTypeFilter.tsx`), `components/RecipeBonuses.tsx`, `components/GemBadge.tsx` / `GemTooltip.tsx`, `constants/itemTypeCategories.ts`, `utils/itemCategoryMapping.ts`, `utils/columnAffixes.ts`.

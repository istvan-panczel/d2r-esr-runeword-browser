# Runewords Feature

The primary feature - browse and filter all Eastern Sun Resurrected runewords.

## Purpose

- View all runewords with complete data
- Filter by runes, text search, sockets (exact count or range), item types, required level, and tier points
- See runeword bonuses AND the rune contributions per item-type group (the site's "Socketable Bonuses" column, ESR 3.3+)
- Share filtered views via URL

## List Order

One list for ESR, Kanji and LoD runewords: ascending required level, ties by name A→Z
(case-insensitive, regardless of ESR/Kanji/LoD), then variant. There is no sort control.
The order comes from `compareRunewordsByLevel` (`utils/filteringHelpers.ts`), applied in the
hook's query (`queryRunewordsInDisplayOrder`) rather than by a Dexie index, because IndexedDB
compares names by code unit (the source's lowercase "hand of Justice" would land after "Pride").

## Jewel Recipes (folded on the list)

The game has no optional sockets, so ESR adds one runes.txt row per jewel combination, jewels first: plain Jewels
(`jew`) or Mythical Jewels (`mjw`). Since ESR 3.3 they mix ("Fixed a bug where certain kanji runewords could not be made
with certain jewels"): Moonlight has 14 rows, `jew r84 r19 r02`, `mjw …`, `jew mjw …`, `mjw jew …`, …, `mjw mjw mjw …`.
The site (our source) shows a range row ("(3-6 Socket)", "(0-3) Jewels", the no-jewel recipe) followed by one row
per required jewel count. ESR 3.3: "(4-6 Socket)" with "(0-2) Jewels" and one "Jewel" line, "(5-6 Socket)" with
"(0-1) Jewels" and two, "(6 Socket)" with three; the parser reads them as "(1-3) Jewels", "(2-3) Jewels", "(3) Jewels"
(required … required + optional). ESR 3.2 listed "(4 Socket)" with one "Jewel" line, "(5 Socket)" with two, … It lists
no `mjw` rows. The parser and the database keep every row (builds and guide refs, favourites and the Best Base finder use
`[name, variant]`).

The Runewords list folds them (`foldJewelVariants`, `utils/foldJewelVariants.ts`, in `useFilteredRunewords` on the
sorted rows, before the column expansion and the filters; order kept): rows of the same runeword with the same content
(runes, gems, ingredients, allowed / excluded items, affixes, column affixes, socketable bonus texts; everything except
`variant`, `sockets`, `socketsMax`, `jewelInfo` and the socketable bonus group labels, which narrow as the socket count
grows: no 4-socket wands, so Storm, Earth and Fire's "Staff / Wand" group is "Staff" on its 4-6 row) become one entry.
It is the lowest variant (so the favourite id and its group labels stay), with the socket range min `sockets` … max
covered count of the group and a regenerated `jewelInfo` in the parser's formats (`formatJewelInfo`: "(0-3) Jewels",
"(1-2) Jewels", "(1) Jewel"). A row only covers the counts no higher row of its recipe lists, so its own `socketsMax`
does not leak into an entry those rows are not part of. ESR 3.3 fixture: 409 rows → 387 entries; most jewel runewords
become one card (Dragon Master, Moonlight, Storm Earth and Fire 3-6 "(0-3) Jewels"; Sunlight 3-4; Might of the Earth and
Work of God 5-6). Three differ by jewel count:

- **Tourbillion**: "4 Socket" without jewels (Bleed 250-500) and "5-6 Socket" "(1-2) Jewels" (Inner Sight on hit
  instead)
- **Wooden Colossus**: "5 Socket" (+300 Strength) and "6 Socket" "(1) Jewel" (+150 Strength)
- **Gold Scarab** (ESR 3.3): "4 Socket" (+25% item quantity) and "5-6 Socket" "(1-2) Jewels" (+50%)

Shinigami's rows differ by item type (two-handed vs other melee), not by jewel count: two cards, each "2-6 Socket"
"(0-4) Jewels". The socket filter reads the folded range (a 5-socket filter finds Dragon Master and Tourbillion 5-6).
Cards with any jewel socket add a muted line: "Each jewel socket takes a Jewel or a Mythical Jewel; jewels go in the
first sockets."

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
  readonly reqLevel: number; // The page's "Req Lvl" (ESR 3.3+), else the highest among the runes and gems
  readonly sortKey: number; // = reqLevel (old cached rows: LoD = 10000 + reqLevel)
  readonly isLod: boolean; // Has a LoD-exclusive rune
  readonly runes: readonly string[]; // Rune names in order
  readonly gems: readonly string[]; // Gem names (e.g. ["Perfect Topaz"])
  readonly ingredients: readonly string[]; // All items in original order (runes + gems interleaved)
  readonly allowedItems: readonly string[];
  readonly excludedItems: readonly string[]; // Items excluded from this variant
  readonly affixes: readonly Affix[]; // The runeword's own bonuses (old layout: first non-empty column)
  readonly columnAffixes: SocketableBonuses; // Per-column bonuses (weapon/helm/armor)
  readonly tierPointTotals: readonly TierPointTotal[];
  readonly jewelInfo?: string; // Jewel info, e.g. "(0-3) Jewels", "(1-3) Jewels" or "(2) Jewels" (required)
  readonly socketableBonuses?: readonly SocketableBonusGroup[]; // The site's rune bonuses per item-type group (ESR 3.3+)
}

interface SocketableBonusGroup {
  readonly label: string; // "Weapon (except Orb, Staff, Wand) / Missile / Mythical Arcane Staff"; '' = every allowed base
  readonly itemTypes: readonly { readonly name: string; readonly except: readonly string[] }[];
  readonly affixes: readonly Affix[];
}
```

**Key model details:**

- **Compound primary key**: `[name+variant]` - some runewords have multiple variants with different recipes
- **gems**: Runewords can require gems in addition to runes (added in v1.4.0)
- **ingredients**: The original order of runes + gems interleaved in the recipe
- **Source layout** (`parsers/shared/recipeRowBonuses.ts`, `recipeRowLayout` by cell count): since ESR 3.3
  runewords.htm (and gemwords.htm) has 5 cells per row: name (with "Req Lvl: N"), ingredients, allowed items,
  **Bonuses** (the runeword's own bonuses, one list for every base; every `<br><br>` group is kept, e.g. Able's
  "Requirements -100%") and **Socketable Bonuses** (the combined rune bonuses: one plain list, or one
  `<div class="rws-group">` per item-type label). Before 3.3 it had 6: one bonus column per item category
  ("Weapons / Gloves", "Helms / Boots", "Armor / Shields / Belts"), each [runeword bonuses]<br><br>[rune bonuses].
  Both layouts are parsed (a cached or lagging page may still serve the old one); rows, order and variants are the
  same in both (fixtures: `test-fixtures/runewords.htm` = 3.3, `test-fixtures/previous/runewords.htm` = 3.2.24).
- **columnAffixes**: Per-column bonuses (weapon/helm/armor). In the 3.3 layout the one Bonuses list goes into every
  column the row's bases use (the categories of its socketable bonus group types, else of its allowed items) and the
  others stay empty, which reproduces the old columns on every 3.2.24 row, so builds whose snapshots hold the columns
  do not all read as changed. No runeword's bonuses differ between columns since ESR 3.12.
- **socketableBonuses**: the Socketable Bonuses groups. A label's item types each carry their own exceptions
  (`parseSocketableGroupLabel`): in "Weapon (except Orb, Staff, Wand) / Mythical Arcane Staff" the exceptions apply
  to Weapon only, so the Mythical Arcane Staff (a staff) still belongs to the group. Undefined on rows cached from the
  old layout; the card then shows the bonuses computed from the gems.htm rune tables. Stored in IndexedDB as a plain
  field (no index, no Dexie version bump).
- **reqLevel**: the page's "Req Lvl" when present (ESR 3.3+), else the highest rune / gem level. They agree except
  for runewords with Ko: the saga's name-keyed level lookup holds the LoD Ko (39), ESR Ko is 27 (Fortune, Faith,
  Journey, … read 39 before 3.3).
- **sortKey**: `= reqLevel` for every runeword (same as gemwords). Up to v1.44.0 LoD runewords
  stored `10000 + reqLevel` so they sorted after ESR/Kanji; the list now sorts by `reqLevel`, so
  rows still cached in that format sort the same way.
- **isLod**: `true` when the recipe has a LoD-exclusive rune (`isLodRuneword` in the parser). Shared
  runes like Ko (in both ESR and LoD) do not count on their own. Picks which rune variant the card
  shows (badges, rune bonuses) and the tier-point category. Old cached rows lack it; the card then
  reads it from the legacy sort key (`runewordIsLod`).
- **jewelInfo**: the row's jewel range: "(0-3) Jewels" — recipes that accept optional jewels on top of their runes.
  Since ESR 3.2 the source also lists each required jewel count of such a recipe as its own row with plain
  "Jewel" lines (3.3: plus the remaining optional "(0-K) Jewels"); those rows get "(1-3) Jewels" (1 required, up to 3)
  or "(2) Jewels" (required only), and `sockets` = runes + gems + required jewels. The database keeps the rows as the
  site lists them; the list folds them (see [Jewel Recipes](#jewel-recipes-folded-on-the-list)).
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
- **Bonuses**: one list, or one column per category when the runeword's own bonuses differ between them (none since
  ESR 3.12)
- **Socketable Bonuses** (`SocketableBonusGroupsSection` in `core/components/RecipeBonuses.tsx`): the page's groups,
  one centred list for a single group, else a two-column grid with one list per group under its label (Stone: "Any
  Shield / Body Armor / Belt", "Helm / Boots", "Gloves"). Rows cached before ESR 3.3 (no `socketableBonuses`) show the
  rune / gem bonuses computed from the gems.htm tables per relevant category instead (`SocketableBonusesSection`). On
  the Builds pages the card shows only the groups of the chosen base, else of the slot
  (`builds/utils/socketableGroups.ts`: a base fits a label item type by its bases.json name or one of its type
  ancestors, minus the type's exceptions; naming the base beats naming its type, so the Mythical Arcane Staff gets
  Boar's weapon group, not "Staff / Wand / Orb"; slots use `typeSlots`; all groups when nothing narrows)
- Gemword cards (`GemwordCard`) show the page's groups the same way under "Gem Bonuses:" (their Bonuses cell also
  holds the random "N-M of the following:" pools, all kept as `columnBonusPools`)
- Text search reads the page's socketable bonuses when present, else the computed rune / gem bonuses
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

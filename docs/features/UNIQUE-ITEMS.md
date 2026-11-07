# Unique Items Feature

Browse and filter unique items from the D2R ESR mod.

## Overview

The Unique Items feature displays all unique items parsed from three HTM pages on the ESR documentation site: `unique_weapons.htm`, `unique_armors.htm`, and `unique_others.htm`. Items are categorized by their parsed category and grouped into filter groups for the UI.

## Data Flow

```
unique_weapons.htm ─┐
unique_armors.htm  ─┼─→ htmUniqueItemsParser → HtmUniqueItem[] → IndexedDB → UI
unique_others.htm  ─┘
```

Each HTML page contains tables of unique items organized by category headers. The parser extracts item name, base item, category, level, properties, notes, and coupon status.

### Source HTML structure

All three pages share the same table layout:

- Each category starts with `<a name="CategoryName">` followed by a `<table>`.
- Category header row: `<td colspan="4" bgcolor="#402040"><b>CategoryName</b></td>`.
- Column header row: `Name | Stats | Properties | Notes`.
- Data rows have 4 cells: name cell | stats cell | properties cell | notes cell.

The **Notes** column was introduced in ESR 3.12; before that the tables had 3 columns and the
category header used `colspan="3"`. The parser accepts both layouts (it matches category headers with
`colspan` 3 **or** 4), and items parsed from the legacy 3-column layout get an empty `notes` value.

## Data Model

```typescript
type HtmUniqueItemPage = 'weapons' | 'armors' | 'other';

interface HtmUniqueItem {
  readonly id?: number; // Auto-increment primary key
  readonly name: string; // "Titan's Revenge", "Windforce"
  readonly baseItem: string; // "Ceremonial Javelin", "Hydra Bow"
  readonly baseItemCode: string; // Item code for resolution
  readonly page: HtmUniqueItemPage; // Which page it came from
  readonly category: string; // "Amazon Javelin", "Bow", etc.
  readonly itemLevel: number; // Item level
  readonly reqLevel: number; // Required level
  readonly properties: readonly string[]; // Human-readable property strings
  readonly isAncientCoupon: boolean; // True if coupon-only item
  readonly gambleItem: string; // Gamble item identifier
  readonly notes: string; // "Notes" column (ESR 3.12+); '' for almost every item
}
```

`notes` is not indexed, so adding it did not require a Dexie schema version bump. It is empty for the
vast majority of items and is only rendered when non-empty. ESR 3.12–3.2 put the weapon mastery variant of the 15
mastery uniques there ("Blessed Edge Variant", with a "Weapon Mastery Applied" property line); since ESR 3.3 the
property line names it instead ("Weapon Mastery (Blessed Edge Variant)", "Weapon Mastery (Sorceress Orb: Tripled
Cooldowns)"; 17 weapons) and the Notes cell is empty for them. The parser keeps the line as a property, as the site
shows it (search and the card show it; no duplicate note), so in 3.3 only one item (others page) has a note.

## Category System

### Filter Groups

Categories are organized into groups defined in `src/features/htm-unique-items/constants/htmCategoryGroups.ts`:

| Group             | Label           | Example Categories                               |
| ----------------- | --------------- | ------------------------------------------------ |
| `missile-weapons` | Missile Weapons | Bow, Crossbow, Javelin, Throwing Knife, etc.     |
| `class-weapons`   | Class Specific  | Amazon Bow, Assassin 2H Katana, Orb, etc.        |
| `weapons`         | Weapons         | Axe, Sword, Mace, Polearm, Staff, etc.           |
| `armors`          | Armors          | Belt, Body Armor, Boots, Helm, Shield, etc.      |
| `class-armors`    | Class Specific  | Auric Shields, Pelt, Spirit Crown, etc.          |
| `rings`           | Rings           | Ring, Ama Ring, Bar Ring, Coupon Rings, etc.     |
| `amulets`         | Amulets         | Amulet, Ama Amulet, Coupon Amulets, etc.         |
| `charms`          | Charms          | Grand Charm, Large Charm, Odd Charm, Small Charm |
| `jewels`          | Jewels          | Jewel                                            |

Any new category not in the known list is placed in a "New" group so that newly added categories are never silently hidden.

```typescript
interface HtmFilterGroup {
  readonly id: string; // 'weapons', 'rings', etc.
  readonly label: string; // 'Weapons', 'Rings', etc.
  readonly categories: readonly string[];
}
```

## Filters

### Text Search

- Searches item name, base item, category, properties, and notes
- AND logic: all words must match
- Supports quoted phrases: `"exact phrase"`

### Max Required Level

- Number input to cap the required level of shown items (`MaxReqLevelInput`, shared with Mythical Uniques)
- URL: `maxlvl=<1-999>`

### Category Filters

- Grouped checkboxes organized by filter groups
- Group-level toggle (all/none within a group)
- "All" / "None" buttons for selecting/deselecting all categories
- `__none__` sentinel value represents "no categories selected"

### Acquisition Chips

Single-select chip group `Acquisition: All | Coupon only | Gambleable | Drop only | No coupon` (with a help popover). It
replaced the exclude-only "Include Coupon Items" checkbox. The logic is in `utils/acquisition.ts`
(`matchesAcquisition`) and reads two parsed fields:

| Chip        | Shows                                                                         | ESR 3.3 count |
| ----------- | ----------------------------------------------------------------------------- | ------------- |
| All         | everything                                                                    | 1065          |
| Coupon only | `isAncientCoupon` ("Ancient Coupon Unique": cubed from a coupon, never drops) | 383           |
| Gambleable  | `gambleItem` is a real base, i.e. not empty and not `N/A`                     | 658           |
| Drop only   | neither of the two (the "Gamble Item: N/A" uniques)                           | 24            |
| No coupon   | `!isAncientCoupon`, the old checkbox switched off (Gambleable + Drop only)    | 682           |

- Every non-coupon unique on the HTM pages has a "Gamble Item:" line; 24 of them say `N/A`. Treating any non-empty
  line as gambleable would leave "Drop only" empty, so `N/A` (also `none`, `-`, empty) counts as not gambleable.
- Coupon and gambleable are tested independently: an item that were both would show under both chips (none is today).
  "Drop only" is the complement, so every item is reachable from Coupon only, Gambleable or Drop only.
- "No coupon" is kept so the old `coupon=0` links still have an exact equivalent.
- When the list is empty and a chip other than All is active, the empty state names the chip.
- URL: `acq=coupon|gamble|drop|nocoupon` (omitted for All). The legacy `coupon=0` is still read and maps to
  `nocoupon` (`acq` wins when both are present). Copy Link only writes `acq`.

### Base Tier

Checkbox row `Base tier: Normal | Exceptional | Elite` (`components/TierFilter.tsx`, the Bases page tier
filter), and a tier badge next to the base name on every card (`TierBadge` from game-data, the Bases / Best Base badge).

- The tier comes from the game-data `tiers` bundle (`useBaseTiers()`, see GAME-DATA.md → Tiers), looked up by
  `baseItemCode` (lowercased; `utils/tierFilter.ts`: `uniqueBaseTier`, `matchesTiers`). bases.json is not enough:
  many unique bases are non-spawnable rows (`p01` Hand Axe, `q00`, `7ha`, `2ap` Cap) it leaves out.
- None checked = every item. With any tier checked only items whose base has one of the checked tiers are shown, so
  rings, amulets, charms, jewels, stones and quivers (no tier, no badge) are hidden; the row then shows a "Clear"
  button and a hint saying so. Checking all three is therefore not the same as none.
- The screen loads `tiers.json` once and passes the index to the cards and to `useFilteredHtmUniqueItems`. Cards show
  no badge until it has loaded; with a tier filter active the list shows the spinner meanwhile, and if the bundle fails
  to load the tier filter is ignored. Other users of the card (guide, builds) pass no index and show no badge.
- ESR 3.3 counts (of 1065): Normal 310, Exceptional 325, Elite 303, Mythical 0 (the mythical uniques are on their
  own page, so the row has no Mythical checkbox), 127 without a tier.
- URL: `tier=normal,elite` (the Bases page format, Normal → Mythical order, unknown values dropped; omitted when none
  is checked).

## Redux State

```typescript
interface HtmUniqueItemsState {
  readonly searchText: string;
  readonly maxReqLevel: number | null;
  readonly selectedCategories: readonly string[]; // Empty = all selected
  readonly acquisition: AcquisitionFilter; // 'all' | 'coupon' | 'gamble' | 'drop' | 'nocoupon'
  readonly exactName: string | null; // `?name=` focus
  readonly tiers: readonly BaseTier[]; // Empty = all tiers; kept in Normal → Mythical order
}
```

### Selection Logic

- Empty array (`[]`) = all categories selected (show everything)
- `['__none__']` = no categories selected (show nothing)
- `['Bow', 'Sword', 'Ring']` = only show items in these categories

**Actions:** `setSearchText`, `setMaxReqLevel`, `toggleCategory`, `toggleGroup`, `selectAllCategories`, `deselectAllCategories`, `setAcquisition`, `toggleTier`, `setTiers`

## Mythical Uniques Filters

The Mythical Uniques screen (`src/features/mythical-uniques`) has a search box, the same **Max Req Lvl** input as Unique
Items (`MaxReqLevelInput`, same `maxlvl` URL key, same 1-999 range and debounce) and category checkboxes (`cats`).

- `matchesMaxReqLevel` (`utils/filtering.ts`) keeps items at or below the cap.
- Every mythical currently has a "Required Level" (40 at 90, one jewel at 60). An item without one is parsed as
  `reqLevel: 0` and is always visible, so a missing value never hides it.
- URL encode/decode is in `utils/urlParams.ts` (`buildMythicalShareParams` / `parseMythicalUrlParams`).

## Ancient Coupon Detection

Some unique items cannot be obtained as drops - they are created using Ancient Coupons via the Horadric Cube. These are identified during parsing and marked with `isAncientCoupon: true`.

**UI Display:** Ancient Coupon items show a distinct visual indicator on the card.

## Source Line

The Unique Items and Mythical Uniques screens each load the game-data `sources` bundle once (`useItemSources()`)
and pass the name index (`sourceIndex`) to their cards. At the bottom of the card, the shared `ItemSourceLine`
shows `Source: <labels joined by " · ">` (e.g. "Cube: Ancient Coupon · Gamble"), looked up by item name with the
`unique` kind preferred (`findItemSource(index, name, 'unique')`; names are compared after `normaliseItemName`:
trim, collapsed whitespace, unified apostrophes/quotes/dashes, case-folded). Nothing is shown while the bundle loads,
when it fails, or when the name is not found; an entry whose only label is `Unknown` shows "Source: Unknown". The prop
is optional, so other users of the cards (builds) render them without a source line. Same-named uniques are merged
in the bundle, so the base item is not used to disambiguate. See GAME-DATA.md → Sources.

## Hooks

### useCategoryFilters

Builds filter groups from the available categories in IndexedDB:

```typescript
function useCategoryFilters(): readonly HtmFilterGroup[] | undefined;
```

### useFilteredHtmUniqueItems

Returns filtered and sorted unique items based on current Redux state and the base tier index (`useBaseTiers()`);
undefined while loading, including while `tiers.json` loads with a tier filter active:

```typescript
function useFilteredHtmUniqueItems(baseTiers: BaseTiersState): readonly HtmUniqueItem[] | undefined;
```

### useShareUrl / useUrlInitialize

Generate shareable URLs with current filter state and initialize filters from URL parameters.

## File Structure

```
src/features/htm-unique-items/
├── components/
│   ├── AcquisitionFilter.tsx        # Acquisition chips + help popover
│   ├── HtmCategoryFilter.tsx        # Grouped checkbox filter UI
│   ├── HtmUniqueItemCard.tsx        # Item display card
│   ├── HtmUniqueItemFilters.tsx     # All filter controls
│   ├── MaxReqLevelInput.tsx         # Max Req Lvl input (also used by Mythical Uniques)
│   └── TierFilter.tsx               # Base tier checkboxes
├── constants/
│   └── htmCategoryGroups.ts         # Category → group mapping
├── hooks/
│   ├── index.ts
│   ├── useCategoryFilters.ts        # Build filter groups from DB
│   ├── useFilteredHtmUniqueItems.ts # Filter and sort items
│   ├── useShareUrl.ts               # Generate shareable URL
│   └── useUrlInitialize.ts          # Init filters from URL
├── screens/
│   └── HtmUniqueItemsScreen.tsx     # Main screen component
├── store/
│   └── htmUniqueItemsSlice.ts       # Redux state and actions
├── types/
│   └── index.ts                     # HtmFilterGroup interface
├── utils/
│   ├── acquisition.ts               # Acquisition chip logic (matchesAcquisition)
│   ├── htmUniqueItemFavorites.ts    # Favourite ids
│   ├── tierFilter.ts                # Base tier lookup + filter (uniqueBaseTier, matchesTiers)
│   └── urlParams.ts                 # Share URL build/parse (acq, legacy coupon, tier)
└── index.ts
```

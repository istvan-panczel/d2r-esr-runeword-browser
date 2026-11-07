# My Stash: All Items

Status: **shipped** in v1.50.0 (2026-11-03). Plan and owner decisions: [STASH-ROADMAP.md](./STASH-ROADMAP.md). Shared stash basics (upload,
storage, file format): [STASH.md](./STASH.md).

`/stash/items` (`StashItemsScreen`): every item on stash pages 1–1000, socketed items inside their parent; the
materials tab is left out. Search, stat filters, filters and sort; a table or tooltip-style cards.

## Page

Engine: `engine/items/allItems.ts`; UI: `screens/StashItemsScreen.tsx`, `hooks/useItemPeek.ts` and
`components/items/` (`ItemTable`, `ItemCards`, `StatConditions`, `ItemParts`, `itemClasses`).

**Rows** (`itemRows(stash, catalog, text)`): one per item listed on a page (`walkStashItems`, `tabs: 'pages'`), in stash
order. Socketed items are no rows: their names (`itemDisplayName`) and jewel lines sit in the parent's `socketed`. Each
row holds the description (`describeStashItem`), the name, `renderItemText`, the `statValues` by key and a precomputed
lower-cased search text. Rows are built once per stash, catalog and text context (module cache, the last two per
stash), so typing in the search only filters. Fixture: 2189 rows (16 socketed items inside them), built in < 10 ms
without stat text.

**Names** (`itemDisplayName`, `engine/items/itemNames.ts`): unique / set item / runeword (gemword) name from stashnames.json,
rare / crafted / tempered "first second", magic "prefix base suffix", "Superior X", inferior "Cracked X", personalized
"Name's X"; the base name wherever a name table has no entry (and while the text context is the placeholder).
`itemQuantityLabel` ("×350", nothing for a count of 0 such as the Dragon Stones' saved stack size) is shown next to the
name of stacks in the table, kept out of the name so the copy button copies what the in-game stash search finds; the
cards show the tooltip's "Quantity: N" line instead.

**Table** (default): icon (`ItemIcon`), name in its quality colour (`itemClasses.ts`: the app's unique amber, set green,
runeword yellow, gemword sky, magic blue; rare dark yellow, crafted / tempered orange, inferior muted) as a link to the
unique / set / runeword / gemword page (`?name=`) plus the copy button, base · type, quality, tier badge, item level,
ethereal, sockets ("3 sockets", "1/2 filled", "2 sockets, empty") with the socketed names, location. A **Stats** column
appears with stat conditions or a stat sort: the row's value of each in the stat's label (`fillStatLabel`: "+20% Faster
Cast Rate"; a negative value replaces the `+`, "-20% Increased Attack Speed"; a label without `#` is a flag shown as is
for ±1, "Indestructible", else "Tinkering Points: 30"; per-level values add "(per character level)").
Below `md` the extra columns become lines under the name (quality · ilvl, tier, ethereal, sockets, stats, location):
no sideways scrolling on phones. 100 rows, then "Show more".

**Peek** (table only; `hooks/useItemPeek.ts`, the shared `PeekPopover` / `useHoverPopover` like the campaign map's
area peek): hovering a row with the mouse, focusing its name link or copy button with the keyboard (`:focus-visible`),
or tapping its name on touch shows the row's whole tooltip card (`ItemCard`, the same as the details view: stat,
runeword, socketed and set bonus lines) in one popover per table, above the row (below it when there is no room; the
card scrolls inside the space left, so it never covers its row). Event delegation on the table: rows carry
`data-item-row` (the row key), the name `data-item-peek`. The usual delays (300 ms to open, 150 ms to close; the
pointer can move into the peek, whose links work); while a peek is open, another row takes over after the pointer
rests on it for 100 ms, so crossing the row above on the way into the peek does not swap it, and moving down the
table swaps it without closing. The peeked row is shaded. On touch the first tap on a name opens the peek (a linked
name does not navigate), a second tap on the same name follows its link, tapping elsewhere closes it; the copy button
copies as before. Esc and a click outside close it; focus stays in the table (no focus trap, no Tab into the peek).
The peek is supplementary, as on the campaign map (no `aria-describedby`): "Show all item information" lists the same
cards for every item, and the peek never shows in that view.

**Details** (`details=1`, "Show all item information"): one tooltip-style card per item, 30 per "Show more": icon,
name, base · type, set name, then the `ItemTextGroups` top to bottom: base lines, stats (blue), runeword lines (blue),
"Socketed with" (runes / gems by name, jewels with their lines), set bonuses (green, "(N items)"); footer quality, item
level, tier, ethereal, location. While the stat text is loading or missing the cards show the base lines only.

**Search** (debounced, `search`): words and "quoted phrases", every term must match (`engine/search.ts`). Any term
matches as text in: name, base, type name, quality label, tier label, code, set name, "ethereal", socketed names and
every tooltip line (base, stats, runeword, set bonuses, socketed jewel lines). An item type word (belt, helm, ring,
rune, orb, jewel…) matches by the type chain **or** as a word (at a word start, so "ring" is not in "Tinkering") of the
row's text without its own base and type fields (`typeWordText`: the name with the base name cut out, set name,
socketed names, tooltip lines). So "ring" finds rings and anything named or socketed with "… Ring …" but not a plain
Ring Mail; "rune" / "Ru Rune" / "topaz" find what is socketed with them; "Milabrega's Orb" finds the set item (Orb is a
type); "Heart of Jewels" finds the unique (first, in stash order; Wraith Heart, a jewel, matches too). Names and item
fields are searchable before the stat text loads.

**Filters** (pills with the count of every value present; the filter panel is always open): quality (`kind`:
Unique, Set, Runeword & gemword, Rare, Crafted, Tempered, Magic, Superior, Inferior, Normal, Coupon, Simple; Coupon =
Ancient Coupons, the Wild Card and blank coupons, which are normal items by quality), category
(weapons, armor, rings & amulets, charms, jewels, other), tier (Normal … Mythical, No tier), ethereal (yes / no),
sockets (socketed, empty sockets, no sockets, runewords & gemwords), stash page. "Reset filters" keeps the view (table / cards).

**Ignore coupons** (checkbox beside "Show all item information", on by default; the coupons have their own page,
`/stash/coupons`, [STASH.md → Ancient Coupons page](./STASH.md#ancient-coupons-page), linked from the hint): the
`coupon` kind rows (Ancient Coupons, the Wild Card, blank coupons) are left out before everything else (`listedItemRows`, and `filterItemRows` with `ignoreCoupons`): the list, every pill
count, the stash page select and the stat picker; the Coupon quality pill only appears while the box is off. The
summary chips still count every item. The results bar reads "Showing X of Y items · N coupons hidden" (Y without the
coupons; `itemsResultSummary`). Turning ignoring back on while the Coupon pill is selected goes back to every quality
(`ignoreCouponsPatch`); a link with `quality=coupon` (from before the checkbox) lists the coupons. Listing them counts
as a filter (`hasItemFilters`), so "Reset filters" ignores them again. A stash whose page items are all coupons shows
a note with a link to the coupons page and a "List the coupons" button instead of an empty page.

**Stat filters** (`StatConditions`): "Add a stat filter" picks a key from the stats present in the uploaded stash
(`statOptions`: distinct `StatValue` keys with their item count and value span, sorted by the label's words; skill /
class params are keys of their own, the picker searches label, stat label and param name) and adds `stat ≥ smallest
value`. A per-level key reads "… (per level)" (`statKeyLabel`: "+# to Strength" vs "+# to Strength (per level)"), and
labels that still collide get "(stat N)" or "(group)". Each condition row: label, ≥ / ≤, value, sort by this stat,
remove; adding, removing and ≥ / ≤ are history entries, value edits replace the current one. Conditions combine with AND; an item
without the stat fails (`matchesCondition`). While the stat text is loading or missing the conditions stay in the URL
but are not applied (they would hide every item), and the page says so.

**Sort**: Where (default: page, row, column), name, quality (unique → simple), item level (high first), and a stat
(high first; items without the stat last in both directions). Column headers and the "Sort by" select (a stat by its
title, `statTitle`: "Faster Cast Rate"); the stat sort from a condition row or the "Sort by a stat" picker.

**URL params** (defaults are not written, invalid values fall back to them):

| Param            | Values                                                                           |
| ---------------- | -------------------------------------------------------------------------------- |
| `search`         | search text                                                                      |
| `quality`        | a kind (`unique`, `set`, `runeword`, `rare`, `crafted`, `tempered`, `magic`, …)  |
| `cat`            | `weapon`, `armor`, `jewelry`, `charm`, `jewel`, `other`                          |
| `tier`           | `normal`, `exceptional`, `elite`, `mythical`, `none`                             |
| `page`           | stash page 1–1000                                                                |
| `eth`            | `yes`, `no`                                                                      |
| `sockets`        | `socketed`, `open`, `none`, `runeword`                                           |
| `stat` (repeats) | `<key>_<min\|max>_<value>`, e.g. `stat=s105_min_20&stat=g.allres_min_15`         |
| `sort`, `dir`    | `location`, `name`, `quality`, `ilvl`, `stat`; `asc` / `desc` (written together) |
| `by`             | the stat key of `sort=stat`                                                      |
| `details`        | `1`: tooltip cards                                                               |
| `coupons`        | `1`: list the coupons (unset: ignored; `quality=coupon` lists them too)          |

**Text states** (`useItemText`): loading → a spinner note, names and item fields searchable; error → a note with Retry;
ready without text (the placeholder) → a note; ready with text → stat lines, stat search and stat filters.

**Home card** (`StashHomeScreen`): "N items: U uniques, S set items, R runewords, G gemwords" (`itemsSummary`, no item text; the
page's chip reads "R + G runewords + gemwords").

Tests: `allItems.test.ts` (rows, names in rows, every filter, conditions, picker options, sort, URL round trip, the
ignored coupons: exclusion, counts, pages, results summary, `coupons` param, `quality=coupon` links, reset; with a fake
text engine), `itemNames.test.ts` (every quality and its fallbacks), `allItems.fixture.integration.test.ts` (row
count, sockets inside parents, search basics).

## Data

- `stashnames.json` (built by `build/bundleStash.ts` with stash.json, [GAME-DATA.md → Stash](./GAME-DATA.md#stash);
  lazy, this page only, ESR 3.3: 297 KB / 49 KB gzip): `bases` (name, `type` / `type2`, tier per code), `uniques` /
  `setItems` by the row a save stores (coupon / unnamed flags, set index), `sets`, `runewords` by the string-table id
  an item's runeword field holds (gemwords flagged). The page joins it to stash.json (`withNames`, one object per pair)
  for the catalog; the summary counts (page chips, home card) need stash.json only (`gemwords`).
- Base names: ESR's belt abbreviations ("\*HP1", "\*Thaw", "+TP") read as the misc.txt `name` column
  ("Minor Healing Potion"; 17 potion / scroll codes).
- `itemtext.json` (built by `build/bundleItemText.ts`, lazy, this page only, ESR 3.3: 495 KB / 60 KB gzip): the
  display columns of every saved stat, their strings, skill / class / monster names, the magic / automagic / rare name
  tables, set bonus pieces. Shape: `ItemTextBundle` in `engine/schema.ts`
  ([GAME-DATA.md → Item text](./GAME-DATA.md#item-text)).
- `types.json`: item type names and ancestors (item type search, category).

## Text

`items/itemText.ts` renders with the generator's renderer (`game-data/engine/stats`: descfunc, renderLines, sprintf),
fed by `items/textData.ts` (saved stats → renderer entries) and `items/statValues.ts` (the stat filter values).

- **Saved stats**: values are raw (a save stores the unshifted value; per-level stats keep their `2^op param`
  fraction). ESR saves 32-bit params. Event skills (descfunc 15): `skill << 6 | level` read from the full param (skill
  ids go above 1023: Delirium's 0x18541 = Delirium Proc 1557, level 1), value = chance; charges (24): the same param,
  value `max << 8 | charges` ("Level 3 Teleport (8/10 Charges)"). The other params are 16-bit layers: random class
  skills (`randclassskill`) leave bits above the skill id (`item_singleskill` 0x277C0164 = skill 356); skill tabs (14):
  `class << 3 | tab`.
- **Lines** like the game's tooltip and the generator: identical stats summed, fixed damage pairs merged ("Adds 20-45
  Fire Damage to Attacks"; cold without its duration, poison as totals over its length), equal enhanced min / max
  damage merged, dgrp sets collapsed only when all members are equal ("All Resists +19"), a class skill + oskill of the
  same skill as "(All Classes)", descfunc 0 hidden, sorted by descpriority. `secondary_mindamage` / `maxdamage`
  (two-hand damage) fold into min / max damage per stat list: a two-hander stores its + damage only there, a list with
  both stores one property twice (the secondary copy is dropped); so a socketed jewel's max damage adds up with a
  two-hander's, in `s22` and `g.dmg-phys`. Multi-line texts (ESR's mythical
  descriptions) are several lines. A stat itemtext.json lacks reads "Unknown stat N: V" (none in the fixture).
- **Socket fillers** (`items/baseLines.ts`): runes, gems and the other gems.txt codes (compact items, no saved stats)
  give the gems.txt column of the parent's gem apply type (weapons.txt / armor.txt / misc.txt `gemapplytype`: 0 weapon,
  1 helm, 2 shield; ESR's docs call the columns "Weapons / Gloves", "Helms / Boots", "Armor / Shields / Belts"; e.g.
  Darkflight Hand's N Rune is "-25% Target Defense", not the "Regenerate Mana +40%" of helms and armor). They are shown
  under the socketed item and count in the stat values, also on runeword and gemword items: the game applies the stats
  of every socketed item (a runeword's total is its own stats plus its runes' bonuses; gemwords the same). A gems.txt
  random pool would have no saved roll (none in ESR 3.3). Jewels give their saved stats.
- **Base lines** (tooltip order): Throw / One-Hand / Two-Hand Damage (weapons.txt `minmisdam` for throwable item
  types only, itemtypes.txt `Throwable`, as ESR fills `maxmisdam` on some wands, orbs and claws; `mindam` / `2handmindam`
  by the one- / two-handed flags; ×1.5 when ethereal, × (100 + enhanced min / max damage %) / 100, + min /
  max damage, a max at or below the min reads min + 1; the + damage of all lines is the folded min / max damage, so the
  hidden throw damage stats are not read; per-level damage is left out, it needs the character level), Defense (saved
  base defense, ethereal included, × (100 + enhanced defense %) / 100 + defense; not per-level defense), Durability /
  Indestructible (max durability as saved: whether the tooltip adds `item_maxdurability_percent`, op 13, is
  unverified, no fixture item has it), Quantity, Required Dexterity / Strength (base × (100 + requirements %) / 100,
  −10 when ethereal), Required Level (the highest of the base, the unique / set item `lvl req`, the magic / rare /
  automagic affixes' `levelreq` (a crafted item's affix level + 10 + 3 per affix, D2's rule, not in the fixture), + the
  item's own `item_levelreq`, against each socketed item's own required level (its `item_levelreq` counted once); class-specific affix levels are not read), Ethereal, Socketed (N). All of the own, runeword and
  socket stats count.
- **Base values**: `b.dmg1` / `b.dmg2` / `b.dmgthrow` (range, value = max), `b.def`, `b.reqdex`, `b.reqstr`,
  `b.reqlvl` (`statId` null, labels "Required Level: #" …), so "Required Level ≤ 60" can be filtered.
- **Groups**: `stats` = the item's own list, `runeword` = the runeword list, `setBonuses` = one per saved bonus list with
  its pieces (2, 3, … or itemtext.json `setBonusPieces`), `socketed` = the item's own socketed objects (same identity)
  with the lines of what each one gives (socket fillers: their gems.txt column; jewels: their stats).
- **Stat values** (`statValues`, contract rules above): one entry per key, summed over own + runeword + socket stats
  (jewels and socket fillers). Keys: `s<id>`, `s<id>.<param>` (param = class for 13, packed tab for 14, skill for 15 / 16 / 24 / 27 / 28,
  monster type for 22), `g.<name>` (`allres`, `allattr`, the other dgrp sets by their dgrpstrpos key, e.g.
  `g.allspeeds`, `g.minelementaldamage`, except ESR's magic damage dgrp, which `g.dmg-magic` covers; `g.dmg-phys` / `-magic` / `-fire` / `-light` / `-cold` / `-pois` with `range`;
  `g.ed`); all match `^[A-Za-z0-9.-]+$`. Labels have one `#` (two for a range: min, max); a per-level label leaves out
  "(Based on Character Level)" (`perLevel` says it). Event skills and charges: value = skill level, the highest when a
  skill repeats. Text-only lines (mythical descriptions, descfunc 23 without a value) have no entry.
- **Approximated / not shown**: per-level damage and defense in the base lines, inferior items' damage / defense
  penalty (unverified, none in the fixture), max durability %, crafted required
  level (D2's rule), class-specific affix required levels, smite / kick damage; set-wide bonuses (sets.json).
- **Fixture** (`itemText.fixture.integration.test.ts`, 2189 page items): no unknown stat or unresolved string; owned
  uniques' lines match the docs pages (unique_*.htm, numbers masked) at 98.8 % (4013 / 4062; the rest: rolled min / max
  ranges the docs write as two lines, dgrp sets with unequal values, "Freezes target" without "+1", random class skills
  the docs name generically, repair wording); runeword lines match runewords.json 9 / 9; set items match sets.json
  99.8 % (own lines), 100 % (bonus lines and their pieces); owned uniques' Required Level matches the docs pages 455 /
  455; every socket filler has lines. The docs pages list no damage, so damage is checked by the unit tests only.
  Rendering the whole stash (lines + stat values): ~100 ms.
- `types.json`: item type names and ancestors (item type search, category).

## Parser fields

`StashItem` (parser/types.ts) carries, besides the coupons-era fields: `prefixIds` / `suffixIds` (1-based
magicprefix / magicsuffix rows, 0 = none; one entry for magic items, three slots for rare / crafted), `rareNameIds`
([first, second], rare / crafted / tempered), `autoAffixId`, `qualityVariant` (superior / inferior row), `gfx`,
`defense` (armor class minus Save Add), `durability` / `maxDurability` (max 0 = indestructible), `personalizedName`
and `runewordId` (the runes.txt key's string id). Fixture-checked: every magic / rare affix id's
magicprefix / magicsuffix row writes a stat the item has (1972 of 1972); rare first names fall in 156–201, second names
in 5–155 (the combined vanilla table: suffixes 1–155, then prefixes); every runeword id of the fixture is a stash.json
runeword (Cow, Ruin, Richesdotcom, Holy).

## Engine (shared, `src/features/stash/engine/`)

| Module               | What                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.ts`         | `stashCatalog(bundle, types?)` (cached per bundle + types index): `base(code)`, `unique(id)`, `setItem(id)`, `set(index)`, `runeword(stringId)`, `coupon(code)`, `typeName(type)`, `typeChain(code)`, `flags(code)` |
| `describeItem.ts`    | `describeStashItem(item, catalog)`: kind, base, type + type chain, category (`ITEM_CATEGORIES`), tier, unique / set item + set / runeword, `icon` (an `ItemIconRef` for `ItemIcon`)                                 |
| `walk.ts`            | `walkStashItems(stash, { tabs: 'pages' \| 'all', socketed })`: items with their location and, for socketed ones, parent + socket index                                                                              |
| `locations.ts`       | `StashLocation`, `pageOf`, `formatLocation`, `compareLocations`, `locationKey`, `pagesOf`                                                                                                                           |
| `search.ts`          | `parseItemSearch(search, types)`, `matchesItemSearch(terms, { text, typeCodes })`, `searchText(fields)`: words and quoted phrases, item type words by type chain (itemTypes.ts)                                     |
| `urlState.ts`        | `readEnum`, `readText`, `readPage`, `readFlag`, `readSortDir`, `setParam`, `setSort`, `SortDir`                                                                                                                     |
| `items/itemText.ts`  | contract, workstream A (below)                                                                                                                                                                                      |
| `items/itemNames.ts` | contract, workstream B (below)                                                                                                                                                                                      |

Kinds: `unique`, `set`, `runeword` (beats the quality; gemword charms too), `rare`, `crafted`, `tempered`, `magic`,
`superior`, `inferior`, `normal`, `simple` (compact items). Fixture: 2205 page items incl. socketed: 731 normal, 95
magic, 474 unique, 427 rare, 360 set, 72 superior, 42 simple, 4 runewords; zero unknown codes, unique ids, set ids or
runeword ids (`describeItem.fixture.integration.test.ts`).

Shared UI (`components/shared/`): `SummaryChips`, `SortHeader`, `SortSelect`, `LocationList`, `PageSelect`, `NameLink`
(link + copy), `ToneBadge`, `EmptyResults`, `ShowMoreList`; hooks `useStashTypes`, `useUrlState`, `useItemText`. The
coupons page uses them. Test helpers: `testing/stashMocks.mock.ts` (`makeItem`, `makeSection`, `makeStash`,
`makeBundle`) and `testing/stashFixture.mock.ts` (`describeWithFixture`, skipped without the fixture).

## Contracts

The two workstreams code against these signatures; changing one needs both sides. Ownership:

| File                                                                                  | Owner | The other side                        |
| ------------------------------------------------------------------------------------- | ----- | ------------------------------------- |
| `src/features/stash/engine/items/itemText.ts` (+ test)                                | A     | B calls, never edits                  |
| `src/features/stash/hooks/useItemText.ts`                                             | A     | B calls, never edits                  |
| `src/features/game-data/engine/schema.ts`, generator registration, `public/game-data` | A     | B never edits                         |
| `src/features/game-data/build/stats` → `engine/stats` move                            | A     | -                                     |
| `src/features/stash/engine/items/itemNames.ts` (+ test), `items/allItems.ts`          | B     | A never edits                         |
| `screens/StashItemsScreen.tsx`, new `components/items/*`, this doc's "Page" section   | B     | A adds only its "Data" / "Text" facts |

Shared foundation files (catalog, describeItem, walk, locations, search, urlState, components/shared, the parser,
stash.json) are not changed by either side without a note in the merge.

### Text context (A)

```ts
// hooks/useItemText.ts: loads itemtext.json (lazy) and builds the context (one object per bundle + catalog)
export type ItemTextState =
  | { readonly status: 'loading'; readonly text: null }
  | { readonly status: 'ready'; readonly text: ItemTextContext }
  | { readonly status: 'error'; readonly text: null; readonly error: unknown; readonly retry: () => void };
export function useItemText(catalog: StashCatalog): ItemTextState;

// engine/items/itemText.ts
export interface ItemTextContext {
  readonly catalog: StashCatalog;
  readonly names: ItemNameTables;
  /** false for the placeholder (no itemtext.json): names null, base lines only, no stat values */
  readonly hasText: boolean;
}
export function createItemTextContext(bundle: ItemTextBundle | null, catalog: StashCatalog): ItemTextContext;

export interface ItemNameTables {
  magicPrefix(id: number): string | null; // 1-based magicprefix.txt row; null for 0 / unknown
  magicSuffix(id: number): string | null;
  autoAffix(id: number): string | null;
  rareName(id: number): string | null; // StashItem.rareNameIds entries
  lowQuality(variant: number): string | null; // "Cracked"
  readonly superior: string; // "Superior"
}
```

### Tooltip lines (A)

```ts
export function renderItemText(item: StashItem, ctx: ItemTextContext): ItemTextGroups;

export interface ItemTextGroups {
  readonly base: readonly string[]; // Defense, damage, Durability / Indestructible, quantity, requirements, Socketed (N), Ethereal
  readonly stats: readonly string[]; // the item's own stats, game order
  readonly runeword: readonly string[]; // runeword / gemword stats
  readonly setBonuses: readonly { readonly pieces: number | null; readonly lines: readonly string[] }[];
  readonly socketed: readonly { readonly item: StashItem; readonly lines: readonly string[] }[]; // runes / gems: no lines
}
```

Lines are plain display text (no colour codes); the page colours them by group. Socketed items are named by
`itemDisplayName`. The text search (B) searches `base` + `stats` + `runeword` + `setBonuses` + socketed lines.

### Stat values for the stat filters (A)

```ts
export function statValues(item: StashItem, ctx: ItemTextContext): StatValue[];

export interface StatValue {
  readonly key: string; // `s<statId>`, `s<statId>.<param>`, `g.<name>`: stable, URL-safe
  readonly statKey: string; // key without the param (picker level 1)
  readonly statId: number | null; // null for a grouped stat
  readonly param: number | null;
  readonly label: string; // "+#% Faster Cast Rate", "+# to Fire Ball (Sorceress Only)": never the item's numbers
  readonly statLabel: string; // "+# to [Skill] ([Class] Only)"
  readonly paramLabel: string | null; // "Fire Ball"
  readonly value: number; // as displayed (ValShift, per-level divisor, ×100/128, poison totals, sign as shown)
  readonly range?: { readonly min: number; readonly max: number }; // range lines; value = max
  readonly perLevel?: true; // value is per character level
}
```

Rules A guarantees:

- **One entry per key per item**, summed over the item's own stats, its runeword stats and the stats of the jewels in
  its sockets (what the game's tooltip adds up). Set bonuses are not included (they need the set worn). Hidden stats
  (descfunc 0) have no entry.
- **Params**: a stat whose line names its param (skills: `item_singleskill`, `item_nonclassskill`, charges, event
  skills; classes: `item_addclassskills`; skill tabs; monster types) has one key per param, `s<id>.<param>`, with
  `paramLabel` and a `statLabel` shared by its params. Stats with a param the line does not name use `s<id>`.
- **Groups**: `g.<name>` entries besides their members, present when every member is: `g.allres` (fire, cold,
  lightning, poison resistance; value = the smallest), `g.allattr` (str, dex, vit, energy), the dgrp sets in general,
  and the damage pairs (`g.dmg-fire` … with `range`). So "All Resistances ≥ 15" and "Fire Resistance ≥ 30" both work.
- **Event skills** (chance to cast): `value` is the skill level; charges: the skill level. The label stays generic
  ("Chance to Cast Level # Fire Bolt on Striking", "Level # Teleport (Charges)"); the key's param is the skill id.
- **Per level**: `perLevel` entries' labels leave out "(Based on Character Level)"; `value` is the per-level amount.
- **Stability**: the same stat on two items has the same key and label; keys are only a function of stat id, param and
  group name.

### Item names (B)

```ts
// engine/items/itemNames.ts
export function itemDisplayName(item: StashItem, catalog: StashCatalog, text?: ItemTextContext | null): string;
```

Unique / set item / runeword names from stashnames.json (always); rare "first second", magic "prefix base suffix",
"Superior X", inferior "Cracked X", personalized "Name's X" from the name tables, each falling back to the base name
while `text` is null or the placeholder. B may extend it (stack sizes, gemword wording) without changing the signature.

### How the page uses them (B)

- `const text = useItemText(catalog)`; the page renders in every state, with stat text, stat filters and affix names
  once `text.status === 'ready' && text.text.hasText`.
- Compute `renderItemText` / `statValues` / `itemDisplayName` once per item per stash (not per render or keystroke).
- Stat filter condition: `{ key, op: 'min' | 'max', value }` (URL-encoded by B); an item matches when it has a
  `StatValue` with that `key` and `value >= min` / `value <= max`; an item without the stat matches neither. Several
  conditions combine with AND. The picker lists the keys present in the stash, grouped by `statKey` (`statLabel`, then
  `paramLabel` per param).
- Sort by a stat: by that key's `value`, items without it last.

# My Stash: All Items

Status: **in progress** (branch `feat/stash-items`). The foundation (data, parser fields, shared engine and UI, route
stub, contracts) is in; the stat text runtime (workstream A) and the page (workstream B) are built in parallel against
the contracts below. Plan and owner decisions: [STASH-ROADMAP.md](./STASH-ROADMAP.md). Shared stash basics (upload,
storage, file format): [STASH.md](./STASH.md).

`/stash/items` (`StashItemsScreen`): every item on stash pages 1–1000, socketed items inside their parent; the
materials tab is left out. Search, stat filters, filters and sort; a table or tooltip-style cards.

## Page

Engine: `engine/items/allItems.ts`; UI: `screens/StashItemsScreen.tsx` and `components/items/` (`ItemTable`,
`ItemCards`, `StatConditions`, `ItemParts`, `itemClasses`).

**Rows** (`itemRows(stash, catalog, text)`): one per item listed on a page (`walkStashItems`, `tabs: 'pages'`), in stash
order. Socketed items are no rows: their names (`itemDisplayName`) and jewel lines sit in the parent's `socketed`. Each
row holds the description (`describeStashItem`), the name, `renderItemText`, the `statValues` by key and a precomputed
lower-cased search text. Rows are built once per stash, catalog and text context (module cache, the last two per
stash), so typing in the search only filters. Fixture: 2189 rows (16 socketed items inside them), built in < 10 ms
without stat text.

**Names** (`itemDisplayName`, `engine/items/itemNames.ts`): unique / set item / runeword (gemword) name from stash.json,
rare / crafted / tempered "first second", magic "prefix base suffix", "Superior X", inferior "Cracked X", personalized
"Name's X"; the base name wherever a name table has no entry (and while the text context is the placeholder).
`itemQuantityLabel` ("×350") is shown next to the name of stacks, kept out of the name so the copy button copies what the
in-game stash search finds.

**Table** (default): icon (`ItemIcon`), name in its quality colour (`itemClasses.ts`: the app's unique amber, set green,
runeword yellow, gemword sky, magic blue; rare dark yellow, crafted / tempered orange, inferior muted) as a link to the
unique / set / runeword / gemword page (`?name=`) plus the copy button, base · type, quality, tier badge, item level,
ethereal, sockets ("3 sockets", "1/2 filled", "2 sockets, empty") with the socketed names, location. A **Stats** column
appears with stat conditions or a stat sort: the row's value of each in the stat's label ("+20% Faster Cast Rate").
Below `md` the extra columns become lines under the name (quality · ilvl, tier, ethereal, sockets, stats, location):
no sideways scrolling on phones. 100 rows, then "Show more".

**Details** (`details=1`, "Show all item information"): one tooltip-style card per item, 30 per "Show more": icon,
name, base · type, set name, then the `ItemTextGroups` top to bottom: base lines, stats (blue), runeword lines (blue),
"Socketed with" (runes / gems by name, jewels with their lines), set bonuses (green, "(N items)"); footer quality, item
level, tier, ethereal, location. While the stat text is loading or missing the cards show the base lines only.

**Search** (debounced, `search`): words and "quoted phrases", every term must match (`engine/search.ts`). An item type
word (belt, helm, ring…) matches by the type chain; any other term as text in: name, base, type name, quality label,
tier label, code, set name, "ethereal", socketed names and every tooltip line (base, stats, runeword, set bonuses,
socketed jewel lines). Names and item fields are searchable before the stat text loads.

**Filters** (pills with the count of every value present; the filter panel is always open): quality (`kind`:
Unique, Set, Runeword incl. gemwords, Rare, Crafted, Tempered, Magic, Superior, Inferior, Normal, Simple), category
(weapons, armor, rings & amulets, charms, jewels, other), tier (Normal … Mythical, No tier), ethereal (yes / no),
sockets (socketed, empty sockets, no sockets, runewords), stash page. "Reset filters" keeps the view (table / cards).

**Stat filters** (`StatConditions`): "Add a stat filter" picks a key from the stats present in the uploaded stash
(`statOptions`: distinct `StatValue` keys with their item count and value span, sorted by the label's words; skill /
class params are keys of their own, the picker searches label, stat label and param name) and adds `stat ≥ smallest
value`. Each condition row: label, ≥ / ≤, value, sort by this stat, remove. Conditions combine with AND; an item
without the stat fails (`matchesCondition`). While the stat text is loading or missing the conditions stay in the URL
but are not applied (they would hide every item), and the page says so.

**Sort**: Where (default: page, row, column), name, quality (unique → simple), item level (high first), and a stat
(high first; items without the stat last in both directions). Column headers and the "Sort by" select; the stat sort
from a condition row or the "Sort by a stat" picker.

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

**Text states** (`useItemText`): loading → a spinner note, names and item fields searchable; error → a note with Retry;
ready without text (the placeholder) → a note; ready with text → stat lines, stat search and stat filters.

**Home card** (`StashHomeScreen`): "N items: U uniques, S set items, R runewords" (`itemsSummary`, no item text).

Tests: `allItems.test.ts` (rows, names in rows, every filter, conditions, picker options, sort, URL round trip, with a
fake text engine), `itemNames.test.ts` (every quality and its fallbacks), `allItems.fixture.integration.test.ts` (row
count, sockets inside parents, search basics).

## Data

- `stash.json` (built by `build/bundleStash.ts`, [GAME-DATA.md → Stash](./GAME-DATA.md#stash)): `bases` (name, `type`
  / `type2`, tier per code), `uniques` / `setItems` by the row a save stores (coupon / unnamed flags, set index),
  `sets`, `runewords` by the string-table id an item's runeword field holds (gemwords flagged).
- `stash.json` base names: ESR's belt abbreviations ("\*HP1", "\*Thaw", "+TP") read as the misc.txt `name` column
  ("Minor Healing Potion"; 17 potion / scroll codes).
- `itemtext.json` (built by `build/bundleItemText.ts`, lazy, this page only, ESR 3.2.24: 212 KB / 38 KB gzip): the
  display columns of every saved stat, their strings, skill / class / monster names, the magic / automagic / rare name
  tables, set bonus pieces. Shape: `ItemTextBundle` in `engine/schema.ts`
  ([GAME-DATA.md → Item text](./GAME-DATA.md#item-text)).
- `types.json`: item type names and ancestors (item type search, category).

## Text

`items/itemText.ts` renders with the generator's renderer (`game-data/engine/stats`: descfunc, renderLines, sprintf),
fed by `items/textData.ts` (saved stats → renderer entries) and `items/statValues.ts` (the stat filter values).

- **Saved stats**: values are raw (a save stores the unshifted value; per-level stats keep their `2^op param`
  fraction). Params are 16-bit layers: ESR saves 32-bit params and random class skills (`randclassskill`) leave bits
  above the skill id (`item_singleskill` 0x277C0164 = skill 356), so only the low 16 bits count. Event skills
  (descfunc 15): `skill << 6 | level`, value = chance; charges (24): the same param, value `max << 8 | charges`
  ("Level 3 Teleport (8/10 Charges)"); skill tabs (14): `class << 3 | tab`.
- **Lines** like the game's tooltip and the generator: identical stats summed, fixed damage pairs merged ("Adds 20-45
  Fire Damage to Attacks"; cold without its duration, poison as totals over its length), equal enhanced min / max
  damage merged, dgrp sets collapsed only when all members are equal ("All Resists +19"), a class skill + oskill of the
  same skill as "(All Classes)", descfunc 0 hidden, sorted by descpriority. `secondary_mindamage` / `maxdamage` (the
  two-hand copy of the same property) are dropped when the primary stat is there. Multi-line texts (ESR's mythical
  descriptions) are several lines. A stat itemtext.json lacks reads "Unknown stat N: V" (none in the fixture).
- **Base lines**: Defense is the tooltip's (saved base defense × (100 + enhanced defense %) / 100 + defense, over own,
  runeword and socketed jewel stats, not per-level defense), then Durability / Indestructible, Quantity, Ethereal,
  Socketed (N). No weapon damage or requirement lines yet (not in the owner's list; base damage would need bases.json).
- **Groups**: `stats` = the item's own list, `runeword` = the runeword list, `setBonuses` = one per saved bonus list with
  its pieces (2, 3, … or itemtext.json `setBonusPieces`), `socketed` = the item's own socketed objects (same identity)
  with no lines for runes and gems (compact items) and the stats of jewels.
- **Stat values** (`statValues`, contract rules above): one entry per key, summed over own + runeword + socketed jewel
  stats. Keys: `s<id>`, `s<id>.<param>` (param = class for 13, packed tab for 14, skill for 15 / 16 / 24 / 27 / 28,
  monster type for 22), `g.<name>` (`allres`, `allattr`, the other dgrp sets by their dgrpstrpos key, e.g.
  `g.allspeeds`, `g.minelementaldamage`; `g.dmg-phys` / `-magic` / `-fire` / `-light` / `-cold` / `-pois` with `range`;
  `g.ed`); all match `^[A-Za-z0-9.-]+$`. Labels have one `#` (two for a range: min, max); a per-level label leaves out
  "(Based on Character Level)" (`perLevel` says it). Event skills and charges: value = skill level, the highest when a
  skill repeats. Text-only lines (mythical descriptions, descfunc 23 without a value) have no entry.
- **Known gaps (v1)**: socketed runes' and gems' bonuses are neither rendered nor summed (they come from gems.txt, not
  from saved stats; the item shows their names); weapon damage and requirement lines; set-wide bonuses (sets.json).
- **Fixture** (`itemText.fixture.integration.test.ts`, 2189 page items): no unknown stat or unresolved string; owned
  uniques' lines match the docs pages (unique_*.htm, numbers masked) at 98.8 % (4013 / 4062; the rest: rolled min / max
  ranges the docs write as two lines, dgrp sets with unequal values, "Freezes target" without "+1", random class skills
  the docs name generically, repair wording); runeword lines match runewords.json 9 / 9; set items match sets.json
  99.8 % (own lines), 100 % (bonus lines and their pieces). Rendering the whole stash (lines + stat values): ~90 ms.
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

Unique / set item / runeword names from stash.json (always); rare "first second", magic "prefix base suffix",
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

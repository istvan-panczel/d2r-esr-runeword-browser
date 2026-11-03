# My Stash: All Items

Status: **in progress** (branch `feat/stash-items`). The foundation (data, parser fields, shared engine and UI, route
stub, contracts) is in; the stat text runtime (workstream A) and the page (workstream B) are built in parallel against
the contracts below. Plan and owner decisions: [STASH-ROADMAP.md](./STASH-ROADMAP.md). Shared stash basics (upload,
storage, file format): [STASH.md](./STASH.md).

`/stash/items` (`StashItemsScreen`): every item on stash pages 1–1000, socketed items inside their parent; the
materials tab is left out. Today a stub with the item counts.

## Page

_To be written with the page (workstream B): columns, details view, search, stat filters, filters, sort, URL params._

## Data

- `stash.json` (built by `build/bundleStash.ts`, [GAME-DATA.md → Stash](./GAME-DATA.md#stash)): `bases` (name, `type`
  / `type2`, tier per code), `uniques` / `setItems` by the row a save stores (coupon / unnamed flags, set index),
  `sets`, `runewords` by the string-table id an item's runeword field holds (gemwords flagged).
- `itemtext.json` (workstream A, lazy, this page only): stat definitions, strings, skill / class / monster names, the
  magic / automagic / rare name tables. Shape: `ItemTextBundle` in `engine/schema.ts` (draft, owned by A).
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
// hooks/useItemText.ts: loads itemtext.json (lazy) and builds the context; STUB: always ready with the placeholder
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
- **Event skills** (chance to cast): `value` is the skill level; charges: the skill level. The label stays generic.
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

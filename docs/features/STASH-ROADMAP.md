# My Stash: All Items roadmap

Status: planned 2026-11-03, after v1.49.0 (Ancient Coupons). Branch `feat/stash-items`; one merge to master and one
release after the owner has tested and we have iterated.

## Scope and owner decisions

One new page, **All items** (`/stash/items`): every gear / page item in the stash, searchable for everything.

- **Rows**: every item on stash pages 1–1000 (socketed children shown inside their parent, not as rows). The
  **materials tab is not included**.
- **Name**: full display name by quality: unique / set / runeword name over the base, rare `first second`, magic
  `prefix base suffix`, superior / inferior ("Superior X", "Cracked X"), personalized ("Name's X"), stack size for
  quantity items.
- **Columns**: icon, name (quality colour), base · type, tier badge, quality, ilvl, ethereal, sockets + socketed names,
  location ("Page N · row R, col C").
- **Details view** (`details=1`, like coupons): tooltip-style cards with all stat lines — base lines (Defense,
  Durability, Socketed (N), Ethereal), item stats, runeword stats, set bonus lists; socketed runes / gems by name only,
  socketed jewels with their stats.
- **Text search** over name, base, type (item-type words as on the coupons page: belt, helm, ring…), quality, code,
  socketed item names and the full stat text (e.g. "faster cast rate").
- **Stat filters**: add one or more "stat ≥ / ≤ value" conditions (e.g. Faster Cast Rate ≥ 20, All Resistances ≥ 15,
  +skill to a given skill), combined with AND. The stat picker lists the stats that occur in the uploaded stash; values
  compare on the displayed value (after ValShift etc.); skill / class params selectable where the stat has one.
- **Filters**: quality, category (weapon / armor / jewelry / charm / jewel / other via type chain), tier, page,
  ethereal, socketed / runeword. Sort by name, quality, ilvl, location, and by a chosen stat. State in the URL.
- **Uniques / set items in my stash** = the quality filter; no separate pages.

Dropped (may come back later): runewords I can make, set tracker with missing pieces, materials page, builds panel,
Chronicle tab, character `.d2s`, sharing, roll-quality %.

## Format facts found while planning (fixture-verified)

- Runeword field (16 bits) = string-table `id` of the runes.txt `Name` key (`item-runes.json`): 63086 = Runeword584
  "Cow", 41022 = Ruin, 10910 = Holy. Gemwords are runes.txt rows too.
- Magic affix ids = 1-based magicprefix / magicsuffix rows; 0 = none.
- Rare name ids index the vanilla combined rare table (suffix block first, then prefixes). **ESR ships no rareprefix /
  raresuffix.txt**: commit the ~200 vanilla name keys as a generator constant (texts in `item-nameaffixes.json`),
  verified by fixture range checks + an in-game spot check.
- Saved stat packing is retail's (event skills `skill<<6|level`, charges `charges|max<<8`, skill tab `class<<3|tab`).
- `uniqueId` / `setId` share the lootfilter.json id space; same-name uniques on other bases (Azurewrath `7cr` / `p30`)
  are separate rows.

## Delivery

```
master ── feat/stash-items ── Foundation (one agent)
                               ├─ A: stat text runtime + itemtext.json   (worktree)
                               └─ B: page engine + UI (names, search, stat filters)  (worktree)
                            merge A → B → review → owner iteration → master → one release
```

### Foundation

1. Generator: `strings.ts` keeps numeric string ids; `stash.json` gains base name / type / tier per item code, unique
   names by id (coupon / unnamed flags), set item names by id, runeword names by string id. Manifest counts, integrity
   test, GAME-DATA.md.
2. Parser keeps the skipped fields: magic affixes, rare name ids + rare affix slots, auto affix, quality variant,
   defense, durability, personalized name. Round-trip tests + fixture checks.
3. Shared engine: `catalog.ts`, `describeStashItem` (kind, base, type chain, tier, unique / set / runeword, icon ref),
   `walk.ts`, `locations.ts`, `search.ts` (type-word search lifted from coupons), `urlState.ts`. Fixture test: zero
   unknown codes / unique ids / set ids / runeword ids.
4. Shared UI extracted from the coupons page (summary chips, sort header / select, location list, page select, name
   link, tone badge, empty results, show-more paging, `useStashTypes`, `useUrlState`); coupons page refactored onto them
   unchanged.
5. Route `/stash/items` stub + registry + nav entry; test helpers (`makeItem` / `makeStash` / `describeWithFixture`);
   docs skeleton (STASH-ITEMS.md, this roadmap).
6. Gate: lint, build, test, game-data:check, compiler:check.

### Workstream A: stat text runtime

Move the pure renderer (`sprintf`, `descfunc`, `renderLines` + types) from `game-data/build/stats` to
`game-data/engine/stats` (existing bundles must not change); new lazy `itemtext.json` (~30–35 KB gz: stat defs, strings,
skill names, magic / rare / automagic names) loaded only on `/stash/items`; `itemText.ts` stat adapter (charges, event
skills, tabs, damage pairs, per-level, hidden stats) returning grouped lines **and** per-stat display values for the
stat filters. Fixture shape test: owned uniques' lines match the HTM docs lines (numbers masked) ≥ 95%; runeword lines
match runewords.json. Only A touches schema / generator registration / `public/game-data`.

### Workstream B: page

`itemNames.ts` (needs A's name tables → build against the agreed interface, wire up after merge), `allItems.ts` (rows,
text search incl. stat text, stat filter conditions, filters, sort, URL), stat picker built from the stats present in
the stash, table + card view, phone layout, home summary.

## Risks and in-game checks

- Rare names decoding order (spot-check 3 rare names in game).
- Crafted / tempered items: widths unverified (none in the fixture); a crafted item in the stash would help.
- Stat text details: charges, life / mana shifts, poison totals, grouped damage lines.
- Performance with ~2500 items and stat text search (measure in the fixture test; compute once per stash).

# Game Data Feature

Static data built from the ESR mod's raw game tables (`data/global/excel/*.txt`) instead of the HTM documentation pages.
A Node script converts the tables into JSON bundles at build time; the pages read them lazily. The original plan and
per-phase implementation notes live in `builds-feature-docs/FEATURE-GAME-DATA.md`.

## Overview

| Route                  | Tab        | Status               |
| ---------------------- | ---------- | -------------------- |
| `/game-data`           | —          | redirects to `bases` |
| `/game-data/bases`     | Bases      | done                 |
| `/game-data/sets`      | Sets       | done                 |
| `/game-data/types`     | Item Types | done                 |
| `/game-data/best-base` | Best Base  | done                 |
| `/game-data/affixes`   | Affixes    | done                 |
| `/game-data/enhance`   | Enhance    | done                 |
| `/game-data/cube`      | Cube       | done                 |
| `/game-data/materials` | Materials  | done                 |
| `/game-data/areas`     | Areas      | done                 |

The game-file data is a second data system next to the HTM pipeline: it is never stored in IndexedDB and never parsed
in the browser. Uniques, gemwords and the runeword list stay on the HTM pipeline (sets come from the game files, see
"Sets").

## Data bundles

A Node script converts a local clone of `CelestialRayOne/Eastern_Sun_Resurrected` into JSON files committed under
`public/game-data/`. The browser never parses txt files and never stores this data in IndexedDB; it fetches the JSON
lazily (`src/features/game-data/engine/browser/loadGameData.ts`).

| File                | Contents                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`     | schema, ESR version / tag / commit, `generatedAt`, sha256 + size per file, counts, warnings                                        |
| `types.json`        | item types (Equiv parents, ancestors, socket caps per ilvl band, class, UI/runeword categories) + 8 classes with skill-tab names   |
| `bases.json`        | spawnable weapons (369) and armors (255) plus 29 equippable accessories (rings, amulets, charms, jewels)                           |
| `runewords.json`    | runes.txt runeword recipes: 391 `Runeword*` keys with 449 rows and rendered stats (see "Runewords")                                |
| `affixes.json`      | 2532 spawnable magic prefixes, suffixes and automods with rendered text (see "Affixes")                                            |
| `sources.json`      | "where does it come from" labels for uniques, set items and crafting-relevant misc items (see "Sources")                           |
| `lootfilter.json`   | loot-filter editor reference data: every item code, stats, areas, sounds, uniques and sets with their ids (see "Loot filter data") |
| `enhance.json`      | corruption, anointment and Vessel of Souls outcomes from cubemain.txt (see "Enhance")                                              |
| `cube.json`         | every other player-facing cubemain.txt recipe, grouped into families by official section (see "Cube recipes")                      |
| `materials.json`    | every misc item worth looking up, with its sources, the cube families using / making it and its Enhance roles (see "Materials")    |
| `sets.json`         | every set with its items, own lines, per-item and set-wide partial bonuses and full-set bonuses (see "Sets")                       |
| `skills.json`       | the class skill trees (tabs, grid position, level and skill requirements) and the level cap, for builds (see "Skills")             |
| `skilldetails.json` | details of every class skill and item-granted skill and the items granting them, for the Skills page ([SKILLS.md](./SKILLS.md))    |
| `crafting.json`     | forging, D-stoning and gem meld options with rendered lines per slot family, for builds (see "Crafting options")                   |
| `tiers.json`        | base tier of every weapons.txt / armor.txt row with one, spawnable or not, for the unique and set item tier badges (see "Tiers")   |
| `areas.json`        | every area of levels.txt: monster level, density and unique packs per difficulty, waypoint, connections, map tiers (see "Areas")   |
| `icons.json`        | item icon index (base code / unique / set item / socketable name → WebP file under `icons/`, size); own generator ("Item icons")   |

Arrays are written one element per line so diffs stay readable. Bundle URLs carry the manifest hash (`?v=<sha256>`);
the manifest itself is always revalidated. The shape is defined in `src/features/game-data/engine/schema.ts`
(`GAME_DATA_SCHEMA`); bump it whenever a bundle shape changes incompatibly.

| Bundle              | ESR 3.2.12 size (raw / gzip)                                                   |
| ------------------- | ------------------------------------------------------------------------------ |
| `types.json`        | 44 KB / 5 KB                                                                   |
| `bases.json`        | 292 KB / 26 KB (ESR 3.2.24 with automods, staffmods and range: 322 KB / 27 KB) |
| `runewords.json`    | 197 KB / 28 KB                                                                 |
| `affixes.json`      | 795 KB / 61 KB (ESR 3.2.24 with `stats`: 852 KB / 67 KB)                       |
| `sources.json`      | 298 KB / 29 KB                                                                 |
| `lootfilter.json`   | ESR 3.2.24: 771 KB / 103 KB (744 / 100 before reqLvl, set, disabled)           |
| `enhance.json`      | ESR 3.2.24: 357 KB / 32 KB                                                     |
| `cube.json`         | ESR 3.2.24: 517 KB / 55 KB                                                     |
| `materials.json`    | ESR 3.2.24: 165 KB / 11 KB                                                     |
| `sets.json`         | ESR 3.2.24: 150 KB / 21 KB                                                     |
| `skills.json`       | ESR 3.2.24: 31 KB / 4 KB                                                       |
| `skilldetails.json` | ESR 3.2.24: 387 KB / 61 KB (+ `icons/skills/`: 325 WebP files, 433 KB)         |
| `crafting.json`     | ESR 3.2.24: 55 KB / 6 KB                                                       |
| `tiers.json`        | ESR 3.2.24: 23 KB / 3 KB                                                       |
| `areas.json`        | ESR 3.2.24: 35 KB / 5 KB                                                       |
| `icons.json`        | ESR 3.2.24: 303 KB / 36 KB (+ `icons/`: 1,361 WebP files, 5.3 MB)              |

### Bases and types

- Weapons/armor: `spawnable == 1` and `quest` blank/0 (ESR has hundreds of non-spawnable shadow bases used by uniques).
- misc: same filter, and only when the type ancestors include `ring`, `amul`, `char`, `jewl`, `bowq` or `xboq`.
- Tier: position of `code` in `normcode` / `ubercode` / `ultracode`. A self-referential family is "mythical" when qlvl ≥ 90
  (ESR mythical bases are qlvl 96/100), otherwise "normal" (rings, charms, jewels, arrows have no tier family).
- Socket caps: `min(gemsockets, MaxSockets1/2/3)` of the base's own `type`, bands `ilvl ≤ 25` / `≤ 40` / above.
- Names: `namestr` resolved through the string tables; mythical bases whose string lacks "Mythical" use the `name` column.
- Exact duplicates (all fields except `code`/`family` equal) are dropped, keeping the first row.
- Durability: `durability`; `indestructible` = `nodurability == 1`. Weapon damage `mindam`/`maxdam` is `dmg1`; on armor
  the same columns are smite damage (shields) or kick damage (boots), also stored in `dmg1`.
- `range`: weapons.txt `rangeadder`, written only when non-zero (armor and misc have no such column).
- `staffMods`: the itemtypes.txt `StaffMods` class of the base's own `type` row (no Equiv walk; no ESR `type2` has one),
  written only when set. The game adds bonuses to random skills of that class; the files define no per-skill list, so
  the bundle and the card only name the class. ESR 3.2.24: 218 bases (staves, wands, scepters, orbs, daggers →
  Warlock, class weapons and armor, robes, spirit crowns, cloaks, class rings and amulets).
- Automods: `autoGroup` = `auto prefix`. After the affixes bundle is built, `attachAutomods` writes `automods` = the ids
  of the kind `a` affixes the base can roll: `group == autoGroup`, an itype among the ancestors and no etype,
  `freq > 0`, the class lock, and an affix level range that overlaps the base's reachable span
  `[affixLevel(1, qlvl, magicLvl), affixLevel(99, qlvl, magicLvl)]` (e.g. Sacred Targe never drops below alvl 29).
  The referenced rows go into the top-level `automods` array (`BaseAutomod`: `id`, `name`, `lvl`, `maxLvl`, `reqLvl`,
  `text`, sorted by id; `text` is the same rendered text as `affixes.json`). `automods` is omitted when empty, e.g. for
  ESR's arrow group 313, whose only row is an invisible `noconsume` placeholder. ESR 3.2.24: 86 rows, 616 bases; group
  320 (455 bases) only adds "Tinkering Points". Counts: `baseAutomods`, `basesWithAutomods`, `basesWithStaffMods`.
  Adding these optional fields did not bump `GAME_DATA_SCHEMA`.
- Type names: itemtypes `ItemType` column. When two types share a name, the type without bases of its own gets
  " (code)" appended (`merc` → "Helm (merc)", `helm` stays "Helm"); when all or none of them have bases, all do
  ("Gem Can 1 (can1)" / "Gem Can 1 (can9)").

### Runewords

`build/bundleRunewords.ts` writes `runewords.json` (`TxtRunewordsBundle`) from `runes.txt`:

- Every row whose `Name` starts with `Runeword` (ESR 3.2.10: 391 keys, 449 rows; 379 rune-based keys, 12 gem-only keys
  such as America or ArchDimeron, which the site lists on gemwords.htm). Other runes.txt rows (Holy, Rainbow, …) are
  charm gemwords and are skipped.
- One `TxtRuneword` per key (file order) with its rows in file order. A key has several rows when the recipe accepts
  extra sockets: one row per socket count and filler, with `jew` (Jewel) or `mjw` (Mythical Jewel) prepended.
- Per row: `codes` = raw `Rune1-6` codes incl. jewels; `ingredients` = display names without jewels; `jewels` = jewel
  count; `sockets` = number of codes; `itypes`/`etypes` as in the file; `reqLvl` = max misc.txt `levelreq` over all codes
  (jewels are 0).
- Names: the runeword name is the `Name` key resolved through strings (the `*Rune Name` column is a comment and is
  unreliable); ingredient names are misc.txt `namestr` → strings, kept raw ("Eth Rune", "Perfect Sapphire") exactly as
  the HTM parser stores them. `r19` and `r68` both resolve to "Ko Rune", so recipes are compared by display name.
- `text`: the runeword's own stats rendered from `T1Code1-7` by the stat renderer (rune bonuses not included).

### Affixes

`affixes.json` (`AffixesBundle`, ~795 KB / 61 KB gzip) holds the spawnable rows of `magicprefix.txt` (kind `p`),
`magicsuffix.txt` (`s`) and `automagic.txt` (`a`): ESR 3.2.20 → 2532 affixes (886 / 1504 / 142). Per affix: `id` (0-based
row index within its file, unique together with `kind`), string-resolved `name`, `lvl`, `maxLvl`, `reqLvl`, `cls`
(`classspecific`), `reqCls` + `clsReqLvl` (`class` / `classlevelreq`), `freq`, `group`, `rare`, `itypes`, `etypes`,
structured `mods` and rendered `text`. Rows with `spawnable != 1` are dropped (`counts.affixesDropped`, 111); automagic
placeholders named "null" are kept with an empty name when a stat is visible, otherwise dropped
(`counts.affixesPlaceholdersDropped`, 4). `runewords.json` rows also carry `text`, rendered from `T1Code1-7`.

Item stats (for the loot filter's affix browser; `build/affixStats.ts`): per affix `stats` = the distinct itemstatcost
ids its mods write, ascending, and a top-level `stats` list `{ id, name, label }` of every stat some affix writes (ESR
3.2.24: 148 stats, 174 distinct per-affix stat sets, 65 of them with more than one stat). A property resolves through its
properties.txt slots: `stat1-7` for the funcs that name a stat; the stat-less funcs as the engine writes them: func 7
(`dmg%`) → `item_maxdamage_percent` (17) + `item_mindamage_percent` (18), func 5 (`dmg-min`) → `mindamage`, func 6
(`dmg-max`) → `maxdamage`, func 20 (`indestruct`) → `item_indesctructible`, func 23 (`ethereal`, an item flag) → none.
Any other stat-less func leaves the property unmapped with a build warning ("affix stats: property … is not mapped").
ESR technical stats are left out: names containing `tinkerflag`, `item_jewelflag`, `item_randomize` and the `_display`
/ `_hidden` / `_cap` companions (the real stat, e.g. `item_aura`, is kept). `label` is the stat's `descstrpos` string
without format tokens, signs, a leading "to" or a trailing "by"/"of" ("+%d%% Enhanced Damage" → "Enhanced Damage"),
a few overrides for per-class or format-only strings (`item_addclassskills` → "Class Skill Levels", `item_aura`,
`item_nonclassskill`, `item_numsockets`, the `*length` stats…), " (per level)" for `perlevel` stats, " %" for the
`_percent` one of two stats with one label (Fire Absorb), else the stat name. Stat ids are itemstatcost row numbers (the
same ids as `lootfilter.json` `stats`).

### Sources

`sources.json` (`SourcesBundle`, built by `build/bundleSources.ts`) answers "where does this item come from" with
qualitative labels derived from the game files. The guide reads it through `::source[...]` (see GUIDE.md). Each entry
has the display `name`, `code` (base code for uniques/sets, item code for misc), `item` (`unique` / `set` / `misc`) and
one or more `labels` (`{ kind, text }`), always in this order:

| kind      | text                            | rule                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cube`    | `Cube: Ancient Coupon` / `Cube` | An enabled `cubemain.txt` row outputs the item (`output`, `output b`, `output c`; unique/set by index, misc by code) and none of its inputs is the item itself (rerolls do not count). Rows with an Ancient Coupon input (misc `name` starting `Coupon `, the Wild Card excluded) → `Cube: Ancient Coupon`, other rows → `Cube` (both labels when both exist).     |
| `boss`    | `Drops from <monsters>`         | The item (unique/set index or misc code) is named in a treasure class reachable from the `TreasureClass*` columns (all difficulties, Champ/Unique/Quest/Desecrated/Herald) of `monstats.txt` or the `TC*` columns of `superuniques.txt` of at most 5 distinct monster display names. Sub-TCs are followed.                                                         |
| `maps`    | `Drops in Endgame Maps`         | Named in the TCs of more than 5 monsters that are all map monsters (one of their TCs leads to an `EGM …` / `Endgame Map …` TC, or is the map-boss extra-loot dummy's `Uber Loot Map Boss`); or a randomly dropping unique/set of level ≥ 100 (only monster level ≥ 100 rolls it, e.g. the mythical bases); or a unique on a misc base that only map monsters drop. |
| `drop`    | `Drops (random)`                | Named in the TCs of more than 5 monsters, not all map monsters. Uniques: not disabled, `spawnable`, `rarity > 0`, base `spawnable` and either a weapon/armor (auto-TCs) or a misc base named in a reachable TC. Set items: `spawnable`.                                                                                                                            |
| `buy`     | `Buy: <NPC>`                    | Misc only: the item row has `<Npc>Min` or `<Npc>Max` > 0 (17 NPC columns, plain items, not the `Magic` columns). One label per NPC.                                                                                                                                                                                                                                |
| `gamble`  | `Gamble`                        | Unique with `rarity > 0` whose base code, `normcode`, `ubercode` or `ultracode` is in `gamble.txt`.                                                                                                                                                                                                                                                                |
| `plugin`  | `Boss drop (launcher plugin)`   | The unique is named in `d2rloader/config/celestialrayone.boss-set-unique-drop.toml` (`unique = "…"` lines; nothing when the file is missing or `enabled = false`).                                                                                                                                                                                                 |
| `unknown` | `Unknown`                       | Nothing above matched.                                                                                                                                                                                                                                                                                                                                             |

Items covered: every `uniqueitems.txt` row with an `index` and `disabled != 1` (the `*Skip Generation` comment column
is ignored: it is set on 96 playable rows such as Mephisto's Will), every `setitems.txt` row, and every `misc.txt` row
that is a cube input or output, sold by a vendor, or named in a monster-reachable TC, except potions, scrolls, tomes,
keys, gold and ammo (`NOISE_TYPES`). Rows with the same `item` kind and display name (the ES and Ancient Coupon LoD
versions of a unique such as Eaglehorn, 47 "Rune Stocker" misc variants, …) merge into one entry: the first row's
`code`, the union of all labels (deduped by kind + text, in the order above; `Unknown` only when nothing else
applies). The same name across kinds stays separate (Worldstone Shard set item vs material; the guide disambiguates
with `{item=…}`). Names come from the string tables; multi-line names are read bottom-up ("Ancient Coupon (Buckler,
Pelta Lunata)"). `diabloclone` is shown as "Diablo Clone" (its name string is plain "Diablo"). Counts: `counts.sourcesUnique`,
`sourcesSet`, `sourcesMisc`, `sourcesMerged` (rows folded into an earlier entry), `sourcesUnknown` (ESR 3.2.12:
1107 / 270 / 795 / 516 / 13). `buildSourcesBundle` also returns `miscLabels(code)`: the misc label rules for any one
code, unmerged and including the `NOISE_TYPES` rows; the materials bundle uses it for the rows sources.json leaves out.

Shown on cards: the Unique Items, Mythical Uniques and Socketables cards show a "Source: …" line
(`components/ItemSourceLine.tsx`). Each screen calls `useItemSources()` once (loads `['sources']`, builds a
name → entries index via `engine/sourceLookup.ts`, cached per bundle object) and passes the index down;
`findItemSource(index, name, kind)` normalises the name (trim, whitespace, quotes/apostrophes/dashes, case) and
prefers the given kind (`unique` for uniques/mythicals, `misc` for socketables) on cross-kind collisions such as Ore
or Worldstone Shard. Coverage against the HTM fixtures (ESR 3.2.12): 1065/1065 uniques, 41/41 mythicals,
178/178 socketables.

Limitations (the help popover says "Derived from the ESR game files (ESR x.y.z); qualitative only, may be incomplete."):

- No percentages or drop rates, no monster → area mapping.
- No replica of the engine auto-TCs (`weapN` / `armoN` level bands) or of `lvl ≤ mlvl`: a random unique drop only
  checks the flags above, and level ≥ 100 is the only level rule (→ maps).
- Only one launcher plugin config is parsed; other plugins (cow set drops, drop caps, shrines) and DLL hard-codes are
  invisible. Items given by `useitem` cube rows (Starter's Pack → Character Augmenter) and drop-only duplicates (the
  `cx1-3` charms) show as `Unknown`.

### Loot filter data

`lootfilter.json` (`LootFilterDataBundle`, built by `build/bundleLootFilter.ts`) feeds the loot-filter editor's pickers
and validator (`src/features/loot-filter/engine/reference.ts` turns it plus `types.json` into a
`LootFilterReference`). It uses the ids the D2RLoader loot-filter plugin reads:

- `items`: every `weapons.txt`, `armor.txt` and `misc.txt` row with a `code`, spawnable or not (uniques sit on
  non-spawnable "shadow" bases and the plugin sees those codes on the ground); first row per code wins. Name =
  `namestr` through the string table, else the `name` column; `type` = the `type` column (an `itemtypes.txt` code).
  `tier` (`normal` / `exceptional` / `elite`) is the item's position in its `normcode`/`ubercode`/`ultracode` family,
  set only for weapons/armor rows whose three family codes differ (shared with `bases.json` through `build/tiers.ts`).
  It is omitted for `misc.txt` rows and for rows without a tier family, whose three family columns hold the item's own
  code (arrows/bolts, quest items, ESR mythical bases; ESR 3.2.24: 76 weapons, 6 armors). The loot-filter Test tab fills
  its base tier from it; an item without a tier matches no `baseTier` condition.
  `spawnable` is the `spawnable` column. `drops` says whether the item can drop: spawnable, or named by a
  `treasureclassex.txt` `Item1`…`Item10` cell (first comma-separated token without quotes, `"01c,qty=3"` → `01c`), or
  the base code of a `uniqueitems.txt` / `setitems.txt` row whose `index` such a cell names (ESR drops non-spawnable
  rows a treasure class names). Every TC row is scanned, so a TC named by another TC needs no expansion. ESR 3.2.24: 56
  non-spawnable items drop (55 misc: the Ancient Scrolls `01b`…`50b` through "Scrolls 1…17", Ore through the
  "Uni Ore N" unique rows, Fake Note, Flask of Renewal, Nirvana Grass, `au9`; one weapon, `dd1`, the base of the
  Frostmourne unique); the Vessel of Souls transform bases (`m44` and 27 more mythical weapons) do not. A spawnable
  item is `drops: true` with one exception: a rune (type `rune`; ESR has no type below it) without a `gems.txt` row is
  an unused row (no socket stats, and no recipe or treasure class makes it), so it never drops; ESR 3.2.24: only `r48`
  "Hu Rune", whose namestr makes it a second "Fu Rune". Misc items only drop through treasure classes (no auto-TCs), but
  332 other spawnable misc rows are named by none (cube results, engine drops such as the essences), so spawnable
  stays enough for those.
- `stats`: every `itemstatcost.txt` row, `id` = 0-based row number (equal to the `*ID` comment column in ESR 3.2.12),
  `name` = `Stat`.
- `areas`: every `levels.txt` row with an `Id` (the `Expansion` marker has none); name = `LevelName` through the string
  table, else the raw `LevelName`, else `Name`; `act` is the 0-based `Act` column. Two rows share a name with their
  neighbour because ESR's `LevelName` keys say so (Jail Level 3 → "Jail Level 2", Catacombs Level 4 → "Catacombs
  Level 3"); the game shows the same names, so they are kept.
- `sounds`: `Sound` of every `sounds.txt` row by 0-based row number, so `sounds[row]` is the name the plugin's numeric
  `sound` refers to (row 0 is the blank "none" row). The `*Index` comment column is not used: it is hand-maintained and
  repeats 11949 for four Leoric taunt rows in ESR 3.2.12, so from row 11950 on it lags the row number by 1–3.
- `uniques` / `sets`: `uniqueitems.txt` / `setitems.txt` rows with a base code, `id` = 0-based data-row number as the
  game loads the table. Every data row counts, including `Expansion` marker rows (parsed with
  `parseTsv(…, { keepExpansionRows: true })`), which are numbered but not listed. ESR 3.2.12 has no marker rows in
  either table and `*ID` equals the row number. Name = `index` through the string table; `code` = `code` / `item`.
  For the loot-filter unique and set browser: `reqLvl` = `lvl req` (0 when blank), `set` (set items only) = the
  `set` column (a `sets.txt` `index`) through the string table, so the three difficulty variants of a hireling set
  share one name, and `disabled: true` when the `disabled` column is 1 (omitted otherwise; ESR 3.2.24: 7 uniques,
  The Perfect Cello #0 and the six Rupture charms #690–695, and no set item). Adding these fields did not bump
  `GAME_DATA_SCHEMA`.
- `coupon: true` on a unique (omitted otherwise) marks a coupon unique: the row an enabled cubemain recipe with an
  Ancient Coupon input (`build/coupons.ts`: a misc row named `Coupon …` but not the Wild Card, shared with the sources
  bundle) outputs. The output names the unique by `index`, resolved per row to the first row with that index (a
  later duplicate is warned about), and a row that rolls as a drop (`rarity` > 0) is not marked (warned about). ESR
  3.2.24: 382 rows (#699–1069 and #1377–1388), all with `rarity` 0. The other three enabled `rarity` 0 rows are no
  coupon uniques: Annihilus #1059 (inside the coupon block, no coupon recipe makes it; it drops from the `ROP (H)`
  treasure class, Diablo Clone), Gheed's Fortune #1118 and Voidforge #1389. The HTM pages also call Annihilus an
  "Ancient Coupon Unique", hence UNIQUE-ITEMS.md's 383 "Coupon only" against 382 here.
  `counts.lootFilterCouponUniques` holds the count. The loot-filter unique browser leaves these rows out.

Counts: `counts.lootFilterItems`, `lootFilterStats`, `lootFilterAreas`, `lootFilterSounds`, `lootFilterUniques`,
`lootFilterSets` (ESR 3.2.12: 2292 / 923 / 215 / 12103 / 1390 / 270). Adding the file did not bump
`GAME_DATA_SCHEMA`: older clients ignore files they do not load.

### Enhance

`enhance.json` (`EnhanceBundle`, built by `build/bundleEnhance.ts` from enabled `cubemain.txt` rows, with
`uniqueitems.txt` for the Vessel's starting souls) feeds the Enhance page. Top-level arrays (one outcome or recipe per
line): `corruption` (reagent, notes) + `corruptionSlots` + `corruptionOutcomes`, `anointment` (reagent, rules, charm
reagents, vessel item) + `anointmentSlots` + `anointmentOutcomes`, `vessel` (item, start souls) + `vesselTiers` +
`vesselRecipes` + `vesselTransforms`. Every outcome and recipe has its visible `mods` (raw cubemain properties, with
`chance` when the `mod N chance` column is below 100) and the `lines` rendered by the stat renderer; a property with a
chance gets its own line ending in "(25% chance)". Mods the renderer warns about are dropped with a warning.

Derivation (rows are classified by their data, not their descriptions):

- **Two-step dummy pattern.** A roll row ("Add … Dummy Stat": `op=16`, `value=0`, output `useitem` with
  `corrupted_dummy` / `anointed_dummy` `min..max`) gives the roll range; the outcome rows (`op=18`, `param` = the dummy
  stat id, `value` = the roll, the item alone as input) add the marker, clear the dummy and add the bonus. The dummy
  stat id is read from the outcome rows (the ones with a negative dummy mod). `void` outputs are blockers.
- **Hidden mods**: `corrupted`, `anointed`, both dummies, `soul-counter`, `mythicaldesc`, `unusable-item`,
  `tinkerflag2`, `craftflag`, `craftflag2`, `item-upgraded`. `trap-limit` is a real Vessel bonus ("+1 to trap limit")
  and stays visible.
- **Corruption** (`wss`): one slot per item type in the fixed slot list (weapon, shield, body, helm, gloves, belt,
  boots, ring, amulet, quiver, unique charm). `qualities` = qualities with outcome rows; `rollOnlyQualities` = a roll
  row but no outcome rows (Low/Normal/Superior rings and amulets); Magic has no rows at all. The outcome list is
  deduplicated across qualities by roll position; a quality whose row at that roll has other values becomes a
  `variant` of that outcome (ESR 3.2.24: Low/Normal/Superior body armor roll 15 and belt roll 18). `successRate` =
  outcomes / rollRange, `brick.rate` = brick rows / rollRange, brick `results` per quality plus more specific subtype
  rows (Odd Charm → Grand Charm, Square Charm → Large Charm; `isA` follows item types and item codes). Notes: a named
  item with its own roll and an `op=15` "already corrupted N times" blocker is repeatable (The Triune's Harbinger, 10
  times, same list as weapons); a non-`wss` row whose `corrupted` mod is negative removes the marker (Astrogha's
  Petrified Heart); a `void` Vessel + `wss` row on the soul counter means the Vessel cannot be corrupted with souls.
- **Anointment**: equipment slots from the `um7` roll rows (`<slot>,nru`), `socketedRollRange` from the `,sock` roll
  rows (one shorter, so the last outcome, "(Sockets)", cannot roll on socketed items); `blockedQualities` from the
  `void` "<slot>,uni + um7" rows; `noRunewords` when every roll row has `nru`. Pools: `weapon` … `amulet`, `charm`
  (unique charm + three organs) and `vessel` (rows on the Vessel alone, rolled by the tier 4 anointment recipe).
  `roll` is the row's `value`, not the number in the description; `label` is the description's last `(…)`.
- **Vessel of Souls**: the Vessel is input 1 of the conditional rows with a negative `soul-counter` mod; its `param` is
  the soul counter stat. Tier gates are the `void` "Vessel + any" rows (`op=15` on the soul counter, 260/42/6 in ESR
  3.2.24): a recipe's tier = 1 + the number of gates above its condition value. Each bonus has an `op=15` (at least N
  souls) and an `op=18` (exactly N, the last use, adds the "tier exhausted" marker) row; they are deduplicated on tier
  - materials + visible mods + cost. A tier ends at `value − cost` of its `op=18` rows; it starts where the previous
    ended (tier 1: the `soul-counter` property of the Vessel's unique row). Caps: a `void` row with the same materials
    whose condition stat is one of the recipe's stats (property → stat ids via properties.txt and itemstatcost row
    numbers) sets `maxTimes` from its description ("max 2 trap"). The "Anoint Trap" rows of the transforms are skipped.
    Disabled rows are skipped; traps are found by `void` output, never by name (the real recipes "trap-limit" and
    "oskill shuriken trap" contain the word). Completion: `op=18`, value 0 rows whose output is an item (`m21,mod`, the
    `,mod` qualifier = `keepsMods`).

Counts (`enhance*` in the manifest), ESR 3.2.24: 11 corruption slots with 272 outcomes (weapon and quiver 30 of 40
rolls, unique charm 20 of 30, the others 24 of 32: 75 % success, unique charm 66.7 %); 790 equipment anointments
(weapon 179, body 85, helm 96, shield 58, gloves 59, belt 48, boots 48, ring 101, amulet 116), 30 unique charm and 178
Vessel anointments; 380 Vessel recipes (tier 1: 200 × 350 + 17 × 700 souls, tier 2: 36 × 42, tier 3: 23 × 7, tier 4:
6 × 1, 74 × 2, 4 × 3, 20 × 5 including the anointment recipe), 63 with a cap, and 29 transforms. Adding the file did
not bump `GAME_DATA_SCHEMA`.

### Cube recipes

`cube.json` (`CubeBundle`, built by `build/bundleCube.ts` from the enabled `cubemain.txt` rows, with `levels.txt` for the
maps a Red Portal opens and `itemstatcost.txt` row numbers for the conditions) feeds the Cube Recipes page. The cube
code lives in `build/cube/` and is shared with the guide (the guide imports it, game-data never imports the guide):
`cubeRows.ts` (CubeRow reader, item / item type / string names, the mod renderer), `cubeText.ts` (readable cells,
output bonuses, variant merging), `cubeFamilies.ts` (the guide's `::recipes` families, `groupFamily`) and
`cubeCatalog.ts` (hide rules, cube-only families, fallback, sections).

**Hidden rows** (`hidden`, counted by reason, first match): `enhance` = corruption, anointment and Vessel tier rows
with their roll rows and blockers, matched by description (`Corruption[ Brick] - `, `Add Corruption|Anointment Dummy
Stat`, `Anointment - `, `Vessel of Souls Tier N - `, `Check if already Corrupted|Anointed`, `Prevent Vessel of Souls
Corrupt`; the Enhance page shows them); `traps` = `void` outputs and descriptions with the word "Trap"; `old` = "OLD
(Delete later)"; `stockers` = descriptions with Stocker / Gem Can / Xtal Can / Rerolling Orb, or an input that is a
stocker or can item (the Crystal Can rows are labelled "Moon Rune" … "God Rune"; the Rerolling Orb is an input of the
real custom ring rerolls and is not a can); `dummy` = other "Add … Dummy Stat" rows. A row a guide family claims (the
Anvil Stone's Multi Stocker row, the Sanctification roll) is never stocker or dummy bookkeeping. ESR 3.2.24: 9,121 of
17,776 enabled rows are listed; hidden 4,007 enhance, 401 traps, 80 old, 4,167 stockers, 0 dummy.

**Families** (first match wins): the 33 guide families (`CUBE_FAMILIES`, sections in `GUIDE_FAMILY_SECTIONS`), then 20
cube-only families (`EXTRA_FAMILIES`: unique rerolls, set conversions / cycles / rerolls, rune forging on the other
slots, legacy crafts, base upgrades, normal items, magic/rare rerolls and starter weapons, ring and amulet recipes,
jewels, quivers, materials, potions, repair, map portals, D-stoning, Tyrael's Might boon, Primordial Soulstones, quest
items, Blemished gems / Mi Rune, secret recipes grouped per number), then a fallback `other:<prefix>` per description
prefix (numbers as `#`, cut at `:`, `-` or `(`). ESR 3.2.24: 62 families, 9 fallback families with 41 rows
(Introductory Book Cycle 9, Weapons Crate 8, Negative MF Charm 8, Opener Size Change 6, Anya's Gift 6 + 1 + 1,
Randomize Stone 1, Morph Charm Refund 1); the integrity test fails past 60 fallback rows or 12 fallback families, and
when a defined family has no row.

**Shape.** Top-level arrays: `sections` (official Cube Recipes page anchors in page order, then the Ascendancies, Kill
Ledger, Weapon Mastery and Vessel of Souls pages, then `other`; only sections with families), `families` (`id`,
`label`, `section`, `order`, `rowCount`, `raw`), `groups` (one recipe shape of a family: the family's `collapse` key;
`label` = the first row's description with numbers as `#`, or "Secret Recipe N"; `conditions` every row shares;
`inputNames` / `outputNames` = the unique / set names its rows take / give, only for families without raw rows, for the
ingredient / result searches), `rows` (the merged rows of `groupFamily(…, 'full')`: the guide's text, uncapped, always
with the output bonuses unless the family hides them, `variants` = the cubemain rows merged into it, `outputLevel`,
`qualities`) and `recipes` (every row of the families with at most 40 rows: `id` = cubemain line, `description`, parsed
`inputs` (`text`, `code`, `qty`, `quals`, `kind` item / type / unique / any), `outputs` (`text`, `code` or null for
useitem/usetype/cloneitem, `bonus` lines, `details` such as "socketed items come out" for `rem`, "item level N" or "to
<map>" for the `lvl=` qualifier, `level`), `conditions`, `qualities`).

**Bonus lines** (`bonus` on recipe outputs, the parenthesis of a merged row's output) leave out the markers and
counters of `isHiddenMod` (`cubeText.ts`: forging, tinkering and merc flags, dummies, soul and stocker counters, tier
markers, caps). Mythical description lines (`mythicaldesc`, the param names a monstats `NameStr` string) are shown,
as the item gains them in game: Tyrael's Might "You get strength bonuses from dexterity instead of strength", the
Kill Ledger's next-milestone hint ("Transmute with 2 Perfect Gems and at least 50.000 kills for a bonus"); a negative
one (-1) removes the line it names and is left out. ESR 3.2.24: 18 merged rows (12 Tyrael's Might, 6 Kill Ledger
tiers) gain a line. The Enhance bundle keeps its own list (`bundleEnhance.ts`), which hides them.

**Output item level** (`outputLevel` on merged rows, `level` on recipe outputs; `describeOutputLevel` in
`cubeText.ts`): the `lvl` / `plvl` / `ilvl` columns (`b lvl` … and `c lvl` … for outputs b and c), not the `lvl=`
qualifier: "Item level 99" (fixed), "Item level 60% of character level" (`plvl`), "Item level 100% of input item
level" (`ilvl`), both added: "Item level 60% of character level + 60% of input item level". It is a separate field so
it does not split the merged rows (they cluster on the output text; `clusterVariantsCounted` returns the indices of the
variants each merged row stands for). A merged row lists the distinct levels of its variants joined with " / "
(variants without one do not count). ESR 3.2.24: 500 of 1,364 merged rows have a level, none disagree. The guide's
`::recipes` blocks do not show it (their rows are built by `collectFamily`, a separate path without this field).

**Qualities** (`qualities`, the page's quality filter, order unique / set / rare / magic / crafted): from the outputs a
row gives (an output equal to an input left out, as the output text): the quality qualifiers `uni` / `set` / `rar` /
`mag` / `crf` and named outputs (a setitems.txt `index` → set, a uniqueitems.txt `index` → unique). `useitem` without
a qualifier has none. ESR 3.2.24 merged rows: unique 109, magic 107, set 61, rare 53, crafted 44 (374 rows with one). Cube-only rewrites: a named unique or set
item cubed into itself reads "The same item, rerolled"; "Unique: 3 Sets" / "Set: 3 Uniques" read "3× Set items of one
base → A unique item of that base".

**Conditions** shown: "<Class> only" (`class`), "Hell only" / "Nightmare or Hell" (`min diff` 2 / 1), "Needs a
recorded <boss> kill" (`kill_check`, op 6, the boss named after the Kill Ledger row with the same value; unknown values
"(#N)") and every other stat check (`op` / `param` = itemstatcost row / `value`, `statConditionText` in
`bundleCube.ts`). The ops as ESR uses them: 3 and 15 "≥", 16 "≤", 17 "≠", 18 "=" ("Unsocket" needs sockets ≥ 1,
"Adds Socket(4)" sockets ≤ 3, tinkering needs points ≥ 2 before the row takes 2); op 28 (no stat) and unknown ops are
skipped. Named checks: `item_craftflag` "No forging mod" / "Has a forging mod", `item_craftflag2` "No jewel forging" /
"Has a jewel forging", `item_mercflag` "Not merc-only" / "Merc-only item", `weaponmastery` "No weapon mastery token
applied" / "Weapon mastery token applied" (= 0 / nonzero), `item_upgraded` ≠ 1 "Not upgraded yet", `item_levelreq` = 0
"Only items without an added level requirement", `kill_base` op 3 "Kill count ≥ N", `soul_counter` = 0 "No souls
remaining", `item_sanctification_dummy` ≤ 0 "Not marked for sanctification"; the rest read "{stat} {op} {value}" with
a short label ("Sockets", "Tinkering points", "Faster cast rate", "Stocker count junk*09") or the stat name without
`item*`. Groups show the conditions all their rows share: ESR 3.2.24, 155 of 511 groups (14 before the stat checks). Counts (`cube\*` in the manifest): recipes, families,
fallback families / rows, merged rows, raw recipes and each hidden reason.

### Materials

`materials.json` (`MaterialsBundle`, built by `build/bundleMaterials.ts` after the sources, enhance and cube bundles)
answers "what is this item, how do I get it, what is it used in" for the misc items. Inputs: misc.txt, `types.json`
ancestry, the bases, the enabled cubemain rows (all of them for the inclusion, the listed rows per family from
`assignCubeRows` for the uses), sources.json, `buildSourcesBundle(…).miscLabels` and enhance.json.

- **Items**: misc.txt rows (first row per code) that are spawnable or appear in an enabled cubemain input or output,
  by code or through a material item type (below). Excluded, counted in the manifest (`materialsExcluded*`, ESR
  3.2.24): bases (bases.json codes, and rows with the name and type of a base such as the drop-only `cx1`-`cx3`
  charms; 37), gold (1), rows neither spawnable nor in any cube row (111), quest rows (`quest` set or the `ques` group)
  that no listed recipe uses (15) and the Fake Note / Magic Eraser rows no listed recipe uses (8).
- **Group / block**: the item type's chain up `parents[0]` to the topmost type below `misc` is the group, the type
  right below it the block (the loot filter misc browser's rule, `src/features/loot-filter/utils/miscBrowser.ts`).
  Groups are ordered like the browser (`sock`, `cube`, `poti`, `ques`, `mmap`, then by label); common groups get a
  plural heading (Socket Fillers, Body Parts (Organs), Ancient Scrolls, Coupons and Decals …). `grade` is the gem
  ladder grade (the `type2` type name minus the word all grades share: Chipped … Perfect).
- **Collapsing** (`variants` = the rows folded in; `materialsCollapsed`, 654): container types (a type whose rows all
  share one name: Rune Stocker ×47, Gem Can, Crystal Can, Rerolling Orb, Multi Stocker, Decal Stocker) become one row
  each in a last "Stockers and cans" group; same-named rows of a block merge (Introductory Book ×9, the 50
  unidentified Ancient Scrolls, Can Opener, Awakened Weapon Mastery Token …); the coupon types `cpn1`/`cpn2`/`cpn3`
  become one row per tier ("Ancient Coupons (normal tier)", rings and amulets included) and the decals one "Ancient
  Decal" row, while the Wild Card stays. A merged row takes the first row's code, the lowest levels and the union of
  sources, uses and roles.
- **usedIn / madeBy** (`{ family, recipes }`): the listed cube.json families (hidden stocker, trap and enhance rows do
  not count) whose rows take / give the item, with the number of those rows (a merged row counts each cubemain row
  once). A cell matches by item code, or through an item type that covers no base: `rune`, `gem5`, `scrl`, `body`
  match their items, while `any`, `misc` and the equipment, ring, amulet, charm and jewel types never do. An output
  that is also one of the row's inputs (rerolls, the returned Ancient Scroll) does not make the item. Sorted curated
  families first (fallback `other:*` last), then by recipes, then cube.json order. `families` lists the labels of the
  referenced families.
- **sources**: sources.json by code, else by name (misc entries only), else `miscLabels(code)` (the same cube /
  named-drop / vendor rules for the potions, scrolls, tomes and keys sources.json leaves out, e.g. Thawing Potion →
  six "Buy:" labels). A `cube` label is dropped when no listed family makes the item (it then comes from taking the
  item out of a stocker). 38 rows end up `Unknown` (unreleased elixirs, Khalim's parts, the cans …).
- **enhance**: `Corruption reagent` (`corruption.reagent`), `Anointment reagent` (`anointment.reagent`), `Unique charm
anointment` (the charm reagents, slot `charm`) and `Vessel of Souls material` (every Vessel recipe and transform
  material).
- **Guide notes** are not in the bundle: the guide build reads the game-data bundles, so game-data reading guide.json
  would be a cycle (`game-data:update` regenerates game data first). The page joins guide.json's `itemNotes` and
  `familyNotes` in the browser (GUIDE.md "Bundle shape"). For the same reason cube.json families carry no guide notes.

Counts: `materialsItems` 395, `materialsGroups` 16, `materialsUsedInCube` 364, `materialsMadeByCube` 296,
`materialsUnknownSource` 38 (ESR 3.2.24; 177 socket fillers, 53 cube materials, 52 Ancient Scrolls, 37 potions, 21
maps, 17 quest items, 14 organs, 5 coupon rows, 6 containers and a few small groups). Adding the file did not bump
`GAME_DATA_SCHEMA`.

### Sets

`sets.json` (`SetsBundle`, built by `build/bundleSets.ts` from sets.txt and setitems.txt, after the bases and types)
holds every set with its items and the rendered bonus lines (`renderMods`, the same renderer as runewords and affixes).

- **Set**: `id` (sets.txt `index`), `name` (strings table: "Arcanna's Tricks-Sor" → "Arcanna's Tricks"; the 12
  hireling sets share their name across the -N / -NM / -H difficulties), `classCode` / `className` from `UIClass`
  through types.json's classes (blank = any class), `reqLevel` = min / max of the items' `lvl req`.
- **Item** (setitems.txt order): name, base `code`, `baseName`, `category` (the base type's name: Staff, Belt …),
  `lvl`, `lvl req`, `lines` (prop1..9) and `partial`: aprop{N}a and aprop{N}b merged into one group needing **N + 1**
  items (every ESR row has `add func` 2, which counts the set's items worn; another value is a build warning).
- **Set-wide**: `partial` from PCode{N}a/b (needs **N** items, a and b merged), `full` from FCode1..8. Empty groups are
  left out.
- **Hidden** (`setsHidden`, `setItemsHidden`): sets whose index ends in `_old` (Tyrael's Sanctuary_old) or without
  items, and the items of a hidden or unknown set (the three Tyrael's \*\_old items and Malek's Defense, which ESR keeps
  on a "Malek's Charge_old" set that sets.txt does not have), and disabled rows.
- The renderer sums identical stats (as the game does), so it can differ from docs/sets.htm, which lists them one by
  one: Naj's Mastery 2 items "+1500 Defense" (docs: +500 and +1000), Bane's Garments "All Resists +40" (docs +20),
  Ihsan's Shade "+80 to Strength" plus +20 to the other attributes (docs "+20 to All Attributes"). Two renderer gaps
  remain against the docs: "Freezes target" / "Hit Blinds Target" without the "+1", and `rep-dur` 100 reads "Repairs
  100 durability per second" (docs "Repairs 1 durability in 1 seconds").

Counts: `sets` 76, `setItems` 266, `setsHidden` 1, `setItemsHidden` 4 (ESR 3.2.24; 43 sets of 3 items, 28 of 4, 5 of
5; 55 class sets, 21 for any class). Adding the file did not bump `GAME_DATA_SCHEMA`.

Building it uncovered a parser bug: monstats.txt and sets.txt mark their Expansion row with `*eol` 0, so `parseTsv`
kept the marker and every monster id after it was off by one. Mythical descriptions (`mythicaldesc`, descfunc 23,
which reads monstats NameStr as a text holder) past row 410 showed the next row's text: 49 runeword rows (Wealth,
Enlightenment, Thirst …) and Harbinger of Ruin's full-set line. The marker check now ignores comment columns.

### Tiers

`tiers.json` (`TiersBundle`, built by `build/bundleTiers.ts` from the weapons.txt and armor.txt rows) is
`{ codes: Record<code, 'normal' | 'exceptional' | 'elite' | 'mythical'> }` for the Normal / Exceptional / Elite /
Mythical badges of the Unique Items and Sets pages and the Unique Items tier filter (`hooks/useBaseTiers.ts`, one
`ReadonlyMap` per loaded bundle). bases.json cannot serve them: many unique bases are non-spawnable rows (`p01` Hand
Axe, `q00`, `7ha`, `2ap` Cap) it leaves out, and lootfilter.json (which has `tier` for those rows but not the
mythicals) is 700 KB.

- Tier (`gearTier` in `build/tiers.ts`): the row's place in a family of three distinct codes (the loot filter's
  `distinctFamilyTier`), or `mythical` for a self-referential family at qlvl ≥ 90 (`MYTHICAL_MIN_QLVL`, shared with
  bases.json). Spawnable and non-spawnable rows alike; the first row of a repeated code wins.
- No entry: misc.txt rows (rings, amulets, charms, jewels, stones), self-referential rows below qlvl 90 (Magic Arrows
  / Bolts `aq2` / `cq2`), quest rows and malformed families (`hst`, `q86`, `qdf`, the throwing potions). Unlike
  bases.json there is no fallback to `normal`, so those 10 spawnable bases (normal on the Bases page) have no badge.
- Consistency (bundleIntegrity.test.ts): every bases.json weapon / armor with an entry has the same tier, every
  lootfilter.json `tier` matches, 246 of the 266 set items and 963 of the 998 distinct unique base codes have one (the
  rest are misc bases and quivers).

Counts: `tierCodes` 1067 (`tierCodesNormal` 321, `tierCodesExceptional` 331, `tierCodesElite` 354,
`tierCodesMythical` 61; ESR 3.2.24). Adding the file did not bump `GAME_DATA_SCHEMA`.

### Areas

`areas.json` (`AreasBundle`, built by `build/bundleAreas.ts` from the raw levels.txt text) is `{ areas: Area[] }` in
levels.txt row order, for the Areas page. Per area: `id` (`Id`), `name` (`LevelName` through the string table, else
`Name` without its "Act N - " prefix: only id 137 ColossalSummit lacks a string), `act` (0-based), `waypoint`
(`Waypoint` ≠ 255), `level` / `density` (`[n, nm, h]`), `uniques` (`[[min, max] × 3]`), `connections` (ids) and, when
set, `group`, `tier`, `uniqueMap`, `boss`, `preventTownPortal`.

- **Monster level** is `MonLvlEx`, `MonLvlEx(N)`, `MonLvlEx(H)` (the expansion level the game uses; `MonLvl*` is the
  classic one, lower in Nightmare / Hell, e.g. Blood Moor 1 / 26 / 51 vs 2 / 38 / 68). `null` in towns (no
  `MonLvlEx`) and in areas without any monster: no `mon*` / `nmon*` / `umon*` column, no density, no unique packs and
  no boss (Forgotten Tower, Harem Level 1, Dimensional Gate, the two Tier 5 entrance-like rows 200 / 204).
- **Density** (`MonDen*`) and **unique packs** (`MonUMin*` / `MonUMax*`, read by column name) are `null` when 0 in
  every difficulty. The game reads the six values as the header pairs them, and the ESR map rows fit that (`30 40 30 40
30 40`), but 61 older rows have an inverted Nightmare pair (Blood Moor `2 4 6 5 8 10`); their values are the mod
  author's, not Blizzard's (vanilla Blood Moor is 4–5 / 7–9), so the inversion is most likely a data-entry slip. The
  builder (`readUniquePacks`) reads each row pairwise and, only when a pair has min > max, re-reads it as three mins
  then three maxes (Blood Moor 2–5, 4–8, 6–10), which is the one reading that makes those rows consistent. A warning
  fires when both readings are inverted; `areasUniquesMinsThenMaxes` counts the re-read rows.
- **Maps**: `Name` "Tier N Map - …" → `tier` N; `group` = `LevelGroup` without its "Tier N Map - " prefix (the zone, 2–11
  levels each, 4 zones per tier). "Unique Map - Goblin Realm" (id 213, The Hidden Vault) has `uniqueMap` and group
  "Goblin Realm", no tier. `boss` is the `*Map Boss` comment column (read from the raw text: the TSV parser drops
  comment columns). Build warnings (manifest): a tier whose level is not the fixed ladder 100 / 102 / 104 / 106 / 108
  (`mapTierLevel`), a `LevelGroup` tier that differs from the `Name` tier, a `Vis*` naming an unknown level.
- **Left out**: the null row (id 0), the Expansion marker (dropped by the parser) and the map entrances (`Name` contains
  "Prep Zone": 17 rows). Towns, boss arenas and id 214 (a second Naraku Level 2 row) stay.
- **Connections**: `Vis0`–`Vis7`, 0, the area itself, repeats and left-out rows dropped; the page resolves the names
  from the same bundle.

Counts (ESR 3.2.24): `areas` 197, `areasMaps` 57 (tier 1: 7, 2: 9, 3: 15, 4: 8, 5: 18), `areasMapZones` 20,
`areasUniqueMaps` 1, `areasWithoutMonsters` 10 (5 towns + 5), `areasWithWaypoint` 39, `areasHiddenPrepZones` 17,
`areasHiddenOther` 1, `areasUniquesMinsThenMaxes` 61. levels.txt is also read by bundleLootFilter.ts (lootfilter areas) and generateBundles.ts (the cube's
level names); those reads were left as they were.

### Skills

`skills.json` (`SkillsBundle`, built by `build/bundleSkills.ts` from skills.txt, skilldesc.txt and experience.txt, after
the types) holds the class skill trees for the builds feature's skill allocation and the Skills page's tree layout
(the page's details come from `skilldetails.json`, see [SKILLS.md](./SKILLS.md)).

- **Classes**: the 8 classes of types.json in its order (`code`, `name`), each with tabs 1..3. A tab `name` is the
  types.json tab name (charstats.txt `StrSkillTab1..3`, "+%d to " already stripped) without a trailing " Skills"
  ("Demon Skills" → "Demon"; "Curses", "Offensive Auras", "Martial Arts" stay as they are).
- **Skill**: a skills.txt row whose `charclass` is one of the 8 codes, placed by its skilldesc.txt row: `SkillPage` is the
  tab, `SkillRow` (1..6) / `SkillColumn` (1..3) the grid cell. `id` is the skills.txt `skill` column (stable, and what
  `reqSkills` reference), `name` the skilldesc `str name` string (the id when missing), `reqLevel` / `maxLevel` from
  `reqlevel` / `maxlvl`, `reqSkills` from `reqskill1..3` (blank entries dropped). Skills are sorted by row, then column.
- **Level cap**: `maxLevel` is experience.txt's `MaxLvl` row (110 for every class; the highest value with a warning if
  the classes differ, 99 with a warning if the row is missing).
- **Skipped** (`skillsSkipped`, warned): class skills without a skilldesc row or with `SkillPage` 0. Also warned: a name
  key missing from the strings, a `reqskill` naming a skill the class does not have, two skills in one tab cell.

Counts: `skillClasses` 8, `skills` 280 (35 per class: the vanilla 30 + 5), `skillsSkipped` 0 (ESR 3.2.24). Adding the
file did not bump `GAME_DATA_SCHEMA`; experience.txt joined the tables `esrSources.ts` reads.

### Crafting options

`crafting.json` (`CraftingBundle`, built by `build/bundleCrafting.ts` from the cubemain rows of `readCube`, after the
bases and types) lists what an equipped item of a build can be annotated with: ids plus rendered lines (`renderMods`),
never text the UI has to parse. Corruption and anointment outcomes are in enhance.json, not here. No page shows it.

- **Rows**: the guide's cube families decide which rows count (their `match` patterns, `build/cube/cubeFamilies.ts` and
  `cubeCatalog.ts`): `skill-forging`, `all-skill-forging`, `stat-forging`, `rune-forging` + `rune-forging-slots`,
  `aura-forging`, `dstoning` and `gem-meld`.
- **Slot families** (`CraftingSlot`: weapon, shield, helmet, armor, gloves, boots, belt, amulet, ring; ring 1/2 and the
  weapon swap share one): from the first input's item type. `weap`, `shld`, `helm`, `tors`, `glov`, `boot`, `belt`,
  `amul`, `ring` are one slot each, `armo` is the six armour slots, `any` every slot. Like the game (first matching row
  wins), each slot takes the **first row in file order** that accepts it: the `_weap` row of a stat forging beats its
  `any` row, the glove rune forging row (the weapon bonus) beats the `armo` row, the D-stoning torso / helm / shield rows
  beat "Any Armor". Quality variants (`low`, `nor`, `uni`, `mag` …) of one forging repeat the same bonus; a variant with
  another bonus on the same item type is a warning.
- **Markers dropped**: `craftflag*`, `item_craftflag*`, `meldflag` and every `*-cap` / `*-cap-group` mod. `levelreq`
  becomes the `levelReq` of a stacking craft.
- **Forgings** (`ForgingOption`): `skill` (key = the class code of the bonus mod, so the chipped gem → class pairing
  comes from the data), `all` (key `all`), `stat` / `rune` / `aura` (key = the ingredient that differs between the
  family's rows: the chipped gem, the rune, the aura stone; label from the item name). `bySlot` lists the lines per
  slot; a slot without a row is left out (the forging cannot go there). Skill forgings sort by class order, runes by
  code, the others by file order.
- **Stacking crafts** (`StackingCraftOption`): one option per (material, switch item) for D-stoning and per perfect
  gem for melding. D-stoning rows with the same item type, ingredients and bonus stats are one group: `lines` and
  `levelReq` come from its first row, `steps` are the amounts of its rows in file order (the `op 16` cap condition picks
  the row as the cap stat grows: Dragon Stone on a weapon is 5, 4, 3, 2, 1). Rows repeating the same bonus under
  another cap condition count once (Holy Symbol on a weapon has one row per cap stat). Steps that do not decrease are a
  warning. Meld options have no `steps`. Options without a switch item come first.
- **Skipped** (`craftingRowsSkipped`; not warned unless said): jewel and charm rows (not equipment slots); rows for a
  weapon subtype, which the builds slot cannot tell apart from other weapons: the wand and staff rune forging rows, the
  wand / staff / orb gem meld rows and the two-handed (`2hsw`) D-stoning rows; tiered D-stoning variants (`weap,exc`,
  `weap,eli`, `2hsw,eli`: the untiered row is used for the slot); blocker rows (`void` output); a D-stoning group whose
  (material, switch, slot) an earlier group already took (warned). An item type that maps to no slot and is not a known
  subtype, jewel or charm is a warning.
- **Known limitations**: the wand / staff / orb overrides and the per-tier summon and elemental D-stoning amounts are
  not represented. The cap a D-stoning stops at (the `op 16` value, e.g. 500 for Spider's Silk on a weapon) is not
  stored, only the per-use amounts. ESR has no rune forging rows for the LoD runes (only the ES runes I … Wo, r01–r46,
  and the Kanji runes Moon … God, r84–r97). Switch item labels are the misc.txt names: `vps` reads "Stamina Potion"
  (the descriptions say "+ vps"), `yps` "Antidote Potion".

Counts (ESR 3.2.24): `craftingForgings` 84 (8 skill, 1 all, 7 stat, 60 rune, 8 aura), `craftingStacking` 31 (23
D-stoning, 8 gem meld), `craftingRowsUsed` 717, `craftingRowsSkipped` 245. One expected warning: cubemain line 11716 "VS
\+ Any Weapon + vps" (Forging Hammer + Stamina Potion → elemental damage) is shadowed by the earlier "FH + Any Weapon +
vps" row with the same ingredients (the VS rows name `hh2`, not the Void Shard). Adding the file did not bump
`GAME_DATA_SCHEMA`.

### Item icons

`scripts/generate-item-icons.ts` (`npm run game-data:icons`) extracts item icons from the HD item art the ESR clone
ships, with the vanilla D2R art as the second source for the items whose art the mod takes from the base game; logic
in `build/itemIcons.ts`, sprite decoding by the loot filter's `src/features/loot-filter/engine/sprite.ts`
(`decodeSprite`).

- **Vanilla art folder**: `--vanilla <dir>` | `D2R_VANILLA_ART_DIR` | `../d2r-vanilla-art` (relative to the repo root,
  a sibling of the ESR clone; `resolveVanillaArtDir` in `scripts/lib/esrClone.ts`). It is not in git (Blizzard's
  files): `data/hd/global/ui/items/{armor,misc,weapon}/**.sprite` (444 sprites plus their `.lowend.sprite` halves, which
  are ignored), `data/hd/items/items.json` / `uniques.json` / `sets.json` (same shapes as the mod's),
  `steam-build.config`, and for the colour transforms `data/global/palette/act1/pal.dat`,
  `data/global/items/palette/{grey,grey2,greybrown,invgrey,invgrey2,invgreybrown}.dat` and
  `data/global/excel/colors.txt` (its code order is checked against the hard-coded block order; ESR ships none of
  these files, the game's are used). It was extracted from the Steam D2R install's CASC storage with the `casc-cli` tool built
  against current CascLib. To
  set it up on another machine, extract the same paths into a folder with that layout and point the env var at it.
  The vanilla sprites use the same format (`SpA1`); all decode.

- **Sources**: `Eastern_Sun_Resurrected.mpq/data/hd/items/items.json` (an array of single-key objects
  `{"hax":{"asset":"axe/hand_axe"}}`), `hd/items/uniques.json` / `sets.json` (unique and set items' own art,
  `{"the_gnasher":{"normal":"axe/the_gnasher","uber":…,"ultra":…}}`) and the sprites
  `…/data/hd/global/ui/items/{weapon,armor,misc}/<asset>.sprite`. Sprites are raw RGBA with a 40-byte header and one
  frame; about 40 % carry the magic `SPa1` instead of `SpA1` (same layout, both accepted), a few carry more pixel data
  than the header declares (only `w × h × 4` bytes are read).
- **Resolution**: the asset is looked up in `weapon`, `armor`, `misc` (in that order) through a lowercase index of the
  sprite directory, because 17 asset paths differ from the file name in letter case (`rune/Moon_rune` →
  `moon_rune.sprite`) and Linux file systems are case-sensitive. Exceptional / elite bases share the normal base's asset.
  The first entry of a repeated code or key wins.
- **Two sources** (`resolveArt`): the clone's sprite wins whenever it ships the asset; otherwise the vanilla folder's
  sprite with the same asset path (same case-insensitive index). The vanilla items.json fills codes the mod's items.json
  lacks (none of the 653 bases need it in 3.2.24); the mod's entry wins for a code both list. A unique / set item whose
  key the mod's uniques.json / sets.json lacks may use the vanilla file's entry, but only when its asset folder (first
  path segment) equals the base's: ESR reuses a few vanilla names for other items (its Guardian Angel is a shield,
  vanilla's an armor). File names stay one WebP per asset slug whichever source it came from, so ESR icons keep their
  bytes.
- **Unique / set item art**: the uniques.json / sets.json key is the txt `index` slugged (`artKey`: lowercase, runs of
  spaces and hyphens → `_`, other characters dropped; applied to both sides, which also absorbs irregular keys such as
  `BlackKnights_Holy_Signet` and `scourge of_the_twin_seas`). A txt index also tries itself without `_lod`
  (`Stormshield_lod`) and with trailing digits split off (`Cutthroat1` → `cutthroat_1`); a key ending in `_new`
  (`hellfire_torch_new`) is also registered without it. The asset is `normal`, else `uber`, else `ultra`. Every
  uniqueitems.txt / setitems.txt row with a base (`readUniqueOrSetRows` in `build/itemNames.ts`, shared with the loot
  filter bundle, names through the same string table) resolves to one icon: its own art when the entry's asset differs
  from the base's and a source has it, else the base's art (via items.json, so shadow bases outside bases.json work
  too), else none. One icon per display name: enabled rows first; a later enabled row with the same name replaces an
  earlier one only when it ranks higher (own > base > none; within a rank the clone's art beats vanilla art, so the
  mythical Buriza-Do Kyanon's ESR art wins over the vanilla Hellcast art of the older Buriza row with the same name).
  Files are shared by asset slug across bases, uniques and set items.
- **Misc items** (socket fillers): the scope is `MISC_ICON_TYPES` in `build/itemIcons.ts`, a list of itemtypes.txt
  codes: `gem` (parent of every gem type, `gema` … `gemk` and the quality types `gem0` … `gem5`) and `rune` (the LoD,
  ESR and Kanji runes, and ESR's crystals, which misc.txt also types `rune`). The rows are the committed
  lootfilter.json `items` (misc.txt, names through the string table) whose `type` or `type2` has one of these codes in
  its types.json ancestry (`selectMiscIconRows`); jewels (`jewl` / `cjwl`, also under `sock`), charms and the other
  misc items are left out for now to keep the folder small (add a code to the list to widen it). Each row gets its
  code's items.json art (mod first, vanilla fallback, as for bases). One icon per display name from the spawnable rows
  (misc.txt has no `disabled` column; all rows when none is spawnable), rows without art skipped: "Fu Rune" is r32
  (art) and r48 (ESR's unused "Hu Rune" row, namestr r32, no items.json entry anywhere), so r32's art. A name whose
  rows with art differ in art is keyed per row as `name#code` instead of by the plain name, so neither row shows the
  other's art: in 3.2.24 only Ko Rune (`Ko Rune#r19`, the ESR rune; `Ko Rune#r68`, the LoD rune, art `ko_lod_rune`).
  Counts (3.2.24): 179 rows → 177 names, 110 from ESR art, 67 from vanilla art (the LoD runes and the vanilla gems), 0
  without art; 178 entries, 177 new files (Perfect Diamond's file was already there: the Jewel bases use that art; +0.42 MB), icons.json +19 KB.
  No colour transforms (misc rows have `InvTrans` 0).
- **Scope and counts** (ESR 3.2.24, vanilla root `06a0ca43…` extracted 2026-10-25; the generator prints them per
  section): bases: 653 codes, 356 from ESR art, 297 from vanilla art (Jewel, Boots, Leather Armor, Short Spear, …),
  0 without art. Uniques: 1,390 rows → 1,114 names; 695 from ESR art, 419 from vanilla art, 0 without art (392 own art,
  722 base art only). Two own entries of the mod's uniques.json point at art neither source has
  (`armor/deflective_spikes`, `amulet/BlackKnights_Holy_Signet`, ESR art missing from the repo); those items show
  their base's art. 14 names use the vanilla uniques.json (the Warlock-era vanilla uniques the mod lists without an
  art entry: Measured Wrath, Dreadfang, …); Guardian Angel's vanilla entry is ignored (folder mismatch). 8 mod
  uniques.json keys match no row (vanilla quest items ESR dropped such as `staff_of_kings`, `khalim_flail`,
  `amulet_of_the_viper`, `rainbow_facet`, and `gotterdamerung`, a typo of ESR's "Gotterdammerung"). Set items: 270
  names; 153 from ESR art, 117 from vanilla art, 0 without art (83 own art; 3 from the vanilla sets.json: Bane's
  Oathmaker, Wraithskin, Authority); 108 mod sets.json keys match no row — all vanilla sets ESR replaced (Civerb's,
  Isenhart's, Tal Rasha's, …). 2182 items.json entries, 993 sprites in the clone, 444 in the vanilla folder; 492
  untinted files (138 from vanilla sprites; 2.0 MB WebP) plus 692 recoloured ones (see "Colour transforms"), 0 decode
  failures. Vanilla art also replaced the base art of 25 names whose own entry pointed at vanilla art (Twinkle →
  Blood Crescent's art, Stormguild, Athena's Wrath, …).
- **Colour transforms**: the game recolours a unique / set item's inventory art at draw time with the legacy palette
  system (D2R has no HD colour data; the owner saw Alaziel's Abstraction red in game while the base art is not). The
  row's `invtransform` (uniqueitems.txt / setitems.txt) names a colors.txt colour (`whit` … `bwht` = block 0 … 20);
  the base row's `InvTrans` (weapons / armor / misc.txt, every row incl. shadow bases; `readInvTrans`) picks the
  colour-map file: 1 `grey`, 2 `grey2`, 5 `greybrown`, 6 `invgrey`, 7 `invgrey2`, 8 `invgreybrown`; 0, 3, 4 never
  recolour. A map is 21 blocks of 256 bytes; a pixel of palette index `i` is drawn as `pal[map[colour × 256 + i]]`
  (`pal.dat` is 256 × BGR). HD sprites are true colour, so `build/itemTint.ts` (`buildTint`) **approximates** the
  renderer: per pixel the 8 nearest palette entries (RGB distance, index 0 excluded), weighted by
  `(1 − d / d₉)²` (d₉ = distance of the 9th nearest, so the result is continuous and does not posterise); entries the
  block maps to the same colour, or farther than 64, keep the pixel; the others contribute their destination colour
  scaled by the pixel's luminance over the entry's (shading survives). Alpha is kept, results are cached per colour
  (about 10 s for the whole run). k = 4 left speckle on saturated parts (gems), k = 8 / 64 tinted mid-tone leather more
  fully; tuned on a comparison sheet. Applied to base art always and to own art only when the sprite is greyscale
  (alpha-weighted mean `max − min` ≤ 5, `meanChroma`): ESR ships about 60 own sprites in pure greyscale, evidently
  drawn for the transform (Alaziel's Buckler), while tinting coloured own art wipes out its design (Divada's Screen
  turned all blue), though the game would tint it. Output: `<asset slug>__<map>-<colour>.webp`, shared by every item
  with the same triple; the entry gets `tint: { map, color }`. The untinted file is still written for every planned
  asset (24 are then used only through their variants), so the reduced check produces a subset of the files. Limits:
  the colour maps were made for the 8-bit inventory art, so a light grey under `cred` turns brick red rather than a
  saturated red, some colours (`lgrn`, `dgrn`, `lpur`, `dpur` on greys) barely change, and partially coloured own art
  (5 < chroma) stays untinted. ESR 3.2.24: 869 entries recoloured (668 uniques, 40 of them own art; 201 set items,
  19 own art), 692 files (2.9 MB); with a colour code but a base that never recolours: 12 uniques, 4 set items; own
  art left untinted because it is coloured: 130 uniques, 45 set items; no unknown codes. Without the vanilla folder no
  entry is recoloured ("no palette data" count).
- **Pipeline** per distinct asset: decode, crop to the pixels with any alpha (`opaqueBounds` / `cropRgba`), fit inside
  128 × 128 keeping the aspect ratio, never enlarged (`fitInside`; a 1 × 3 item becomes ~43 × 128), encode WebP with
  `sharp` (devDependency, script only: lanczos3, quality 80, alpha quality 100, effort 4; effort 6 was 50× slower for
  4 % smaller files; a recoloured variant is tinted on the full-size cropped pixels before the resize). Output: `public/game-data/icons/<slug>.webp` (slug = asset path lowercased, `/` → `_`) and
  `icons.json` (`IconsBundle`: `esrVersion`, `esrTag`, `vanilla` (only when vanilla art was used: `rootHash` = the
  `root` line of `steam-build.config`, which identifies the game build and has no readable version number;
  `extractedAt` = that file's modification date, YYYY-MM-DD; `files` = the sorted icon files made from vanilla
  sprites), `bases: { [code]: info }`, `uniques: { [name]: info }`, `sets: { [name]: info }`,
  `misc: { [name or name#code]: info }`, `info` =
  `{ file, w, h, tint? }`, only entries with an image). Unique names are the lootfilter.json
  `uniques[].name` (mythicals included), set item names the sets.json `items[].name`, misc names the lootfilter.json
  `items[].name`. Stale `.webp` files in `icons/`
  are deleted.
- **Manifest**: `generate-game-data.ts` does not build icons.json; it lists the committed file in the manifest as is
  (hash, bytes, `counts.itemIcons` / `uniqueIcons` / `setIcons` / `miscIcons` (178), plus `vanillaIcons` = entries
  (all sections) pointing at a vanilla file, recoloured ones through their untinted file (900), `vanillaIconFiles`
  (204), `tintedIcons` (869) and
  `tintedIconFiles` (692)) so `loadGameDataFile('icons')` works like every other
  bundle. Hence `game-data:icons` runs the icon generator, then `generate-game-data.ts`; `game-data:update` runs
  generate → icons → generate (the icons follow the fresh bases.json).
- **Check**: `--check` regenerates in memory and compares icons.json and every WebP byte for byte (plus orphans).
  The output is deterministic on one machine; a `sharp` / libwebp upgrade may change the bytes, then regenerate
  (so may touching `steam-build.config`, which changes `extractedAt`). `game-data:check` runs both checks.
- **Without the vanilla folder** (other machines; CI does not run the game-data checks): `--check` prints "vanilla art
  folder not found, vanilla-derived icons not verified", regenerates from the clone alone and verifies what it can
  (`compareWithoutVanilla`): every clone-derived entry and WebP must match, every other committed entry must point at
  a file listed in `vanilla.files`, a recoloured entry is compared through its untinted file (file name and size; the
  colour maps are in the vanilla folder), those files and the recoloured ones must exist, no orphans; exit 0 when that holds. Writing without the
  folder is refused (exit 1), since it would drop the vanilla-derived icons; `game-data:update` then skips the icon
  step with a warning (and `--vanilla <dir>` is passed through), and its icons check runs in this reduced mode. An
  existing but incomplete folder is an error.
- **Runtime**: `hooks/useItemIcons.ts` shares one `useSyncExternalStore` store for all icons (the families table renders
  ~600; one `useGameData` effect each would be wasteful) and indexes the bundle once (`buildItemIconIndex`: unique and
  set names through `normaliseItemName`, so HTM and build-ref spellings with other apostrophes, casing or spacing match);
  null while loading or after a failed load (a warning, no error card). `findItemIcon` takes a ref
  `{ kind: 'base', code }` or `{ kind: 'unique' | 'set', name, code? }`: the name, then the name without a trailing
  parenthetical (the mythicals page lists "Tathamet's Awakening (Fire Variant)" and its siblings), then the optional base
  `code`. `{ kind: 'misc', name, code? }` looks up `name#code` when a code is given, then the plain name (a trailing
  parenthetical dropped; the socketable parsers already strip the rune "(N points)" suffix); a split name without a
  matching code finds nothing. The Socketables page builds the ref with `socketableIconRef`
  (`src/features/socketables/utils/socketableIcon.ts`): the name, plus a code from `SHARED_NAME_CODES` for the names
  two categories share (Ko Rune: `esrRunes` → r19, `lodRunes` → r68). `components/ItemIcon.tsx` (`item`, `size`, `className`) reserves a `size` × `size` box while icons.json
  loads, so names do not shift when it arrives; once loaded (or after a failed load, `useItemIcons().failed`) an item
  without an icon renders nothing, and the call sites' flex gaps collapse with it; the `<img>` (lazy, async decoding, `alt=""`, URL through
  `gameDataUrl` so `BASE_URL` applies) gets width / height from icons.json scaled to fit the box. Image URLs carry no
  content hash (cached by name).
- **Name matching** (`itemIconMatching.integration.test.ts`, fixtures): all 1,065 HTM unique names and all 41 mythical
  names are txt unique names (after the variant fallback); all 1,065 unique cards and 41 mythical names get an icon.
  `socketableIconMatching.integration.test.ts` parses gems.htm with the five socketable parsers: all 178 socketables
  (48 gems, 46 ESR runes, 33 LoD runes, 15 Kanji runes, 36 crystals) get an icon, the two Ko Runes different ones;
  it also checks every code a ref carries names a misc row of that name and that every `name#code` key of a listed
  name is reached (so a new shared name fails until `SHARED_NAME_CODES` covers it).
- **Shown**: base cards (48 px, leading, muted box) and the families table (32 px before the name; hidden below `sm` in
  the three tier columns); Sets page item rows (36 px before the name, own art else base); unique item cards (48 px
  beside the name; name, then `baseItemCode` fallback); mythical cards only when the card has no picture from the site
  (all 41 currently have one, which already shows the same art); builds: the set item card (48 px), the unique /
  mythical cards (the browse cards above), the snapshot fallback (`ItemRefDisplay`, 32 px for unique / mythical / set)
  and the runeword's chosen base in the choices box (24 px); Socketables page cards (44 px, muted box, before the name
  and the level line). Not on the Runewords page (too crowded), and the builds' socket fillers stay names (jewels have
  no misc icon yet, and a filler name alone cannot tell the two Ko Runes apart).
- **Credits**: the home footer credits the item art to Blizzard Entertainment and the ESR team (used with permission).

Next steps (not built): more misc items (jewels, charms; widen `MISC_ICON_TYPES`); icon tiles in the pickers
(loot filter, builds, best base); the families table draws long weapons (spears, staves) as 6–8 px slivers in its
32 px box (height-bound, so a wider box would not help).

## Regenerating

Recommended: one command after an ESR release.

```bash
npm run game-data:update                       # clone/pull ESR main, generate, fixtures, tests, check, summary
npm run game-data:update -- --tag 3.2.10       # pin a specific release tag (detached HEAD)
npm run game-data:update -- --no-fixtures      # skip re-downloading the HTM test fixtures
npm run game-data:update -- --esr <dir>        # use another clone directory
```

`scripts/update-game-data.ts` steps:

1. **ESR clone**: when the directory is missing it creates a shallow, blobless, sparse clone (excel tables, strings,
   `d2rloader/metadata.json`, `docs/weapons.htm`, `docs/armors.htm`, the HD item art `data/hd/items/` and
   `data/hd/global/ui/items/`, the HD skill icon sheets `data/hd/global/ui/spells/`). Otherwise it aborts if the clone is dirty or on a
   branch other than `main`, fetches `main` and fast-forwards (a detached HEAD from an earlier `--tag` run goes back
   to `main`); with `--tag` it fetches that tag and checks it out detached. It does not run `git fetch --tags`: on a
   shallow clone that downloads the full history of every old release; the tag pointing at the new HEAD is fetched
   instead. Works with plain (non-sparse) clones too.
2. Records the previous `manifest.json`.
3. Runs `generate-game-data.ts --esr <dir>`, then `generate-item-icons.ts` and `generate-game-data.ts` again (so the
   manifest lists the new icons.json), then `generate-skill-icons.ts` (the cels of the fresh skilldetails.json). A
   failure skips the verify step and exits 1.
4. Runs `fetch-test-fixtures.js` (skippable with `--no-fixtures`). A download failure is only a warning; tests that
   need a missing fixture skip themselves.
5. Runs `npx vitest run src/features/game-data` (with `ESR_SOURCE_DIR` set to the clone) and `--check` (game data,
   item icons and skill icons).
6. Prints a summary: version/tag/commit before → after, changed counts (incl. warnings), generator warnings, step
   results and changed files under `public/game-data/`, then the commit command to run. It never runs `git add`/`commit`.

**After an ESR release** the `/esr-update` Claude Code skill (`.claude/skills/esr-update/SKILL.md`) runs this command
plus the release diff, explains the count changes, proposes guide note edits and asks the owner before committing.

Manual fallback:

```bash
npm run game-data:generate   # writes public/game-data/*.json
npm run game-data:icons      # writes public/game-data/icons/*.webp + icons.json, then the manifest
npm run game-data:check      # exits 1 when the committed files (bundles and icons) are stale
```

Source directory: `--esr <dir>`, else `ESR_SOURCE_DIR`, else `../Eastern_Sun_Resurrected` (relative to the repo root).
The script reads `d2rloader/metadata.json` (mod version), the commit (`git rev-parse HEAD`) and the exact tag
(`git describe --tags --exact-match`, `null` when HEAD is not tagged). `generatedAt` only changes when a file hash
changes, so regenerating unchanged data produces no diff.

A minimal clone only needs (this is what `game-data:update` creates):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/CelestialRayOne/Eastern_Sun_Resurrected.git
git -C Eastern_Sun_Resurrected sparse-checkout set --no-cone /Eastern_Sun_Resurrected.mpq/data/global/excel/ \
  /Eastern_Sun_Resurrected.mpq/data/local/lng/strings/ /d2rloader/metadata.json /docs/weapons.htm /docs/armors.htm \
  /Eastern_Sun_Resurrected.mpq/data/hd/items/ /Eastern_Sun_Resurrected.mpq/data/hd/global/ui/items/
```

(`docs` is only needed for the clone-dependent name oracle test.)

### Release diff

`npm run esr:diff` (`scripts/esr-release-diff.ts`) prints what changed in the ESR repository between the revision the
committed game data was built from and the clone's HEAD. It is read-only and the input for reviewing a release.

```bash
npm run esr:diff                                 # from esrCommit of manifest.json in git HEAD → clone HEAD
npm run esr:diff -- --from 3.2.10 --to 3.2.12    # any revisions (tags, commits)
npm run esr:diff -- --json                       # the same facts as one JSON object (sections as keys)
npm run esr:diff -- --esr <dir>                  # another clone directory
```

`--from` defaults to the `esrCommit` of `public/game-data/manifest.json` **as committed in HEAD** (after
`game-data:update` the working-tree manifest already holds the new commit), falling back to the working-tree file.
When `--from` is missing from a shallow clone the script tries `git fetch --depth 1 origin <rev>` once and exits 2 if
that fails. Sections, in order:

1. **Patch notes**: added `patchnotes/*.md` in full, a unified diff for changed ones.
2. **Changelog page**: new entries of `docs/changelogs.html` (version, date, label, Google Doc link).
3. **Game tables**: per changed `excel/*.txt` (`excel/base/` is a duplicate and only counted): row counts before →
   after, added/removed/changed rows (rows paired by first column + occurrence), added/removed row keys (20 shown),
   column changes.
4. **Strings**: added/removed/changed keys per file and up to 20 `Key: old → new` enUS changes.
5. **Official docs pages**: byte-size delta per changed `docs/` file, hand-written pages flagged `[HAND-WRITTEN]`.
6. **Launcher configs**: changed `d2rloader/` files, with a unified diff for text files up to 200 lines.
7. **Everything else**: the remaining changed files with line counts.

Exit codes: 0 (also when nothing changed), 1 (missing clone, bad `--to`, git failure), 2 (`--from` not available).
Helpers and tests: `scripts/lib/releaseDiff.ts`, `scripts/lib/releaseDiff.test.ts`.

### Bumping the ESR version (manual)

1. `git -C ../Eastern_Sun_Resurrected fetch --tags && git -C ../Eastern_Sun_Resurrected checkout <tag>` (tags have no `v` prefix, e.g. `3.2.10`)
2. `npm run game-data:generate` and read the printed counts and warnings
3. `npm run test` (the bundle integrity test expects 369 weapons / 255 armors; update the numbers if ESR changed them on purpose)
4. Commit `public/game-data/` together with any code changes

The script warns when the clone has uncommitted changes, because the output would then not match the recorded commit.

## Pages

### Routes, layout and loading

| Route                  | Screen            | Notes                                                             |
| ---------------------- | ----------------- | ----------------------------------------------------------------- |
| `/game-data`           | `GameDataLayout`  | Redirects to `bases`. Title, version banner, sub-tabs, `<Outlet>` |
| `/game-data/bases`     | `BasesScreen`     | Base item browser                                                 |
| `/game-data/sets`      | `SetsScreen`      | Sets: items, per-item and set-wide partial bonuses, full set      |
| `/game-data/best-base` | `BestBaseScreen`  | Best base finder                                                  |
| `/game-data/affixes`   | `AffixesScreen`   | Affix browser and what-can-roll                                   |
| `/game-data/types`     | `ItemTypesScreen` | Item type tree and socket-cap table                               |
| `/game-data/enhance`   | `EnhanceScreen`   | Corruption, anointment and Vessel of Souls outcomes               |
| `/game-data/cube`      | `CubeScreen`      | Every cube recipe, grouped by family                              |
| `/game-data/materials` | `MaterialsScreen` | Misc items: sources, cube families, Enhance roles, guide notes    |
| `/game-data/areas`     | `AreasScreen`     | Area levels, density, unique packs, waypoints, map tiers          |

One header entry ("Game Data", `end: false`). All screens are lazy-loaded from `@/features/game-data` (the route
code-splitting guard test covers it). The child routes are in `public/sitemap.xml`.

**Version banner** (`components/GameDataVersionBanner.tsx`): "Game files: ESR {esrVersion} (tag {esrTag} @ {commit7},
generated {YYYY-MM-DD})" from `loadManifest()`, then "Docs data: ESR X (site updated D Mon YYYY)" from Dexie metadata
(`esrVersion`, `docsLastModified`; the line is left out while the docs version is unknown). When the docs version differs
from the manifest's, an amber note says "Docs data is ESR X; game-file data is ESR Y — some details may differ." Both
normally come from `metadata.modVersion` of `d2rloader/metadata.json` (the clone's copy vs the live GitHub copy), so they
compare like with like; the docs side may fall back to the changelog page, so the note never says which is newer.

`hooks/useGameData(files)` returns `{ status: 'loading' | 'ready' | 'error', data, error, retry }` on top of
`loadGameDataFile` (module-level promise cache; failed promises are evicted so `retry` refetches). Loading shows the same
spinner as the route fallback (`GameDataLoading`). Errors show `GameDataError`: a Card with the message and Retry; a
`GameDataSchemaError` shows "Game data out of date" with a "Reload page" button instead. The Bases and Item Types pages
load `types` + `bases`; Best Base also loads `runewords`.

### State

`store/gameDataSlice.ts`, registered statically as `gameData` (no saga). Bases filters (`bases: BaseFilters`):

| Field             | Meaning (empty list / null = no filter)                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`          | Debounced (300 ms) text; `parseSearchTerms` AND semantics over name, type name, type2 name, code                                                                                                              |
| `kinds`           | `weapon` / `armor` / `misc` (multi)                                                                                                                                                                           |
| `tiers`           | `normal` / `exceptional` / `elite` / `mythical` (multi)                                                                                                                                                       |
| `types`           | Item-type codes (multi); a base matches when any selected code is in `base.ancestors`, so a parent type (e.g. `mele`) matches all subtypes                                                                    |
| `minSockets`      | `max(socketCaps) ≥ n` (1–6)                                                                                                                                                                                   |
| `maxReqLvl`       | `reqLvl ≤ n`                                                                                                                                                                                                  |
| `classOnly`       | `any` (no filter), `none` (only bases without a class restriction), or a class code (only that class's bases)                                                                                                 |
| `sort`, `sortDir` | `name`, `qlvl` (default, ascending), `reqLvl`, `dmg` (average of 2H, else 1H, else throw), `def` (max defense), `speed`. Ties break by name; bases without the metric (e.g. damage on armor) always sort last |
| `view`            | `cards` (default) or `families` (`setBaseView`); Reset filters keeps it, and the sort is kept (unused) while the families view is on                                                                          |

The Item Types page `?type=` focus is URL-only.

Best Base fields:

`gameData` slice additions:

| Field                      | Meaning                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `character`                | `{ cls: ClassCode \| 'any'; level; str; dex }`, default `{ any, 99, 100, 100 }`    |
| `bestBase.includeUnusable` | List bases the character cannot use yet (with deficits)                            |
| `bestBase.ethereal`        | Ethereal estimate (vanilla: −10 Str/Dex, ×1.5 damage/defense; not for accessories) |
| `bestBase.selected`        | `{ name, variant }` of the HTM runeword                                            |
| `bestBase.txtKeyOverride`  | Manually picked txt key; reset by `setBestBaseRuneword` when the selection changes |

`character` is restored with `readPersistentJson('gameData.character', isCharacter)` in the initial state and written
with `writePersistentJson` inside `updateCharacter`, which merges a partial update and clamps the numbers
(`store/character.ts`). The toggles and selection are not persisted.

### Bases page

Filter panel (`FilterPanel`): a filters row (search, min sockets, max req level, Copy Link), a second row (kind and tier checkboxes, class select, a
Cards | Families view toggle (shadcn `Tabs`), sort select + direction toggle (disabled in the families view), Reset),
and an item-type picker built from the shared `FilterGroup` rows (like the runeword `ItemTypeFilter`). The picker lists every
type that is some base's primary `type`, grouped into Weapons / Class weapons / Armor / Class armor / Accessories / Class
accessories; nothing selected means all types. Codes selected via a link that are not in the picker (parent types such as
`mele`) appear as removable chips.

Each base is a Card (grid like the runewords page): name, tier badge, type (and type2) name and code, class-only /
indestructible badges, damage 1H / 2H / throw (armor: "Smite" for shields, "Kick" for boots), defense, block, speed
(weapons), range (`+rangeadder`, when set), durability (when > 0 and not indestructible), requirements, str/dex damage
bonus, socket caps as "N (ilvl ≤ t1) / N (≤ t2) / N" using the thresholds of the base's own type (one number when
all bands are equal), quality level, "Staffmods: + to random <Class> skills" (when `staffMods` is set), and the N/X/E
family where other members are clickable and set the search to `"<name>"`.

Below the stats, the automods (`utils/baseAutomods.ts` → `baseAutomodView`): a single option shows its lines with
name, affix level range and required level. Several options read "Automod: one of N, picked by item level" (the game
picks one row of the group per item, among the rows whose level range fits the affix level, weighted by frequency); each
option shows its own lines plus name · `lvl a–b` · `req lvl r`, and lines every option has (ESR's "Tinkering Points")
are pulled out into "Every option also: …". More than 5 options start collapsed in a `<details>`. A base whose group
has no visible rows keeps the "Automod N" badge instead. The first 100 results render; "Show more" adds 100 at a time (reset when filters change).

#### Families view

`view=families` (`components/BaseFamilyTable.tsx`) replaces the cards with one table, columns Normal | Exceptional |
Elite, one row per family. The family model is `utils/baseFamilies.ts` (`buildBaseFamilies`, shared with the loot-filter
base browser): type groups and types as in the type picker (`buildTypeGroups`; a type in two groups shows in the first),
rows ordered by the lowest member's qlvl. A base sits in its family's row when it is its family's member for its own tier;
a row belongs to its lowest member's type, so the 7 claw families whose tiers span `h2h1`/`h2h2` stay one row under
`h2h1`. ESR 3.2.24: 194 families, all complete triples. Bases without a family (single-member rows: rings, amulets,
charms, jewels, arrows, throwing potions, the odd `q86` Scissors Suwayyah and `qdf` Hunter's Guise; plus the 35 mythical
bases; 71 in all) are listed last under "Without a family", each with its tier badge and type name. Each cell shows the
name and the `baseStatParts` line (damage or defense, block, speed for weapons, required level/str/dex, max sockets as
`N os`, qlvl). Clicking a name switches to the cards view with the search set to `"<name>"` (like the card's Family links).

Filter semantics (`utils/familyView.ts` → `buildFamilyView`, pure): the tier filter hides columns (`visibleFamilyTiers`;
none selected = all three) and the loose bases of unselected tiers; every other filter (`baseMatchesFilters` from
`utils/filterBases.ts` without the tiers) keeps a family when at least one member in a visible column matches and dims
the others (muted, half opacity); a loose base shows only when it matches. Sorting does not apply. The count line reads
"Showing F of T families (M of N bases matching the filters) and L bases without a family". At phone width the three
columns stay (`table-fixed`), stats wrap under the name; the table only scrolls horizontally below 20rem.

#### URL params

Read once on mount by `hooks/useBasesUrlState.ts` (same pattern as runewords `useUrlInitialize`): when any bases param is
present, the decoded params replace the whole filter state (missing ones fall back to defaults) and are removed from the
URL. The Copy Link button builds the URL from the current filters (`encodeBaseFilters`, only non-default values).

| Param     | Field          | Format                                           |
| --------- | -------------- | ------------------------------------------------ |
| `search`  | search         | text (shared key)                                |
| `sockets` | minSockets     | 1–6 (shared key)                                 |
| `maxlvl`  | maxReqLvl      | 1–999 (shared key)                               |
| `kind`    | kinds          | comma list                                       |
| `tier`    | tiers          | comma list                                       |
| `type`    | types          | comma list of type codes (unknown codes dropped) |
| `cls`     | classOnly      | `none` or a class code                           |
| `sort`    | sort + sortDir | `dmg` ascending, `-dmg` descending               |
| `view`    | view           | `families` (cards, the default, is omitted)      |

Keys are per page (`constants/urlParams.ts`; `search`, `sockets` and `maxlvl` are the app-wide shared keys; `sockets` is a plain
minimum here, while the recipe screens accept a range), so `cls`, `type`
and `sort` mean the same kind of filter on Bases and Affixes.

### Item Types page

A collapsible tree of the Equiv graph: roots are types without parents; a type with two parents appears under both
(expansion is keyed by code, so it opens in both places). Each node shows name, code, class, UICategory, runeword
categories, max sockets per band with thresholds, and a link to the Bases page with `?type=<code>` labelled with the number
of bases of exactly that type (`type` or `type2`) plus the count including subtypes when different. Expand all / Collapse all.
`?type=<code>` expands the type's ancestors, highlights the node and scrolls to it. Below the tree, a "Socket caps" table
lists every type that has at least one base.

### Best Base page

`/game-data/best-base` (`screens/BestBaseScreen.tsx`) loads the `types`, `bases` and `runewords` bundles via `useGameData`
and the HTM runewords from Dexie (`useLiveQuery(() => db.runewords.toArray())`). Gemwords are not loaded: the docs list
734 gemword rows, almost none of which are txt runewords, so they would flood the consistency list; the 12 gem-only txt
recipes therefore show up as "unmatched txt".

Top row: a cmdk **runeword picker** (`components/ComboPicker.tsx`, every query term must appear in name, recipe or
allowed items; variant number shown for multi-variant names; first 100 hits) and the Copy Link button. Second row: the
**character form** (`components/CharacterForm.tsx`): class (Any + the 8 classes from `types.json`), level 1–99,
Strength and Dexterity 0–999, and the toggles "Include bases I can't use yet" and "Ethereal (estimate)".

For the selected runeword the page shows the name, socket badge, recipe and allowed/excluded items, a "Game files:
RunewordNNN (exact match) · 2–6 sockets" line, a collapsible **Game-file stats** block (`TxtRunewordRow.text` of the
used rows; rows with identical lines merged by `gameFileStats`, one block per distinct line set labelled
with its socket counts; rune bonuses not included), then the results:

1. `resolveTxtSource` picks the txt rows: a manual pick (`txtKeyOverride`) wins, else the match; rows are narrowed to
   the HTM socket range with `rowsForSockets` (all rows when none fall in the range).
2. `findEligibleBases` with the character and toggles, then `buildBaseGroups`: `rankBases` per kind (weapons, armor,
   accessories) and `groupByType`; groups are ordered by their best base.
3. Each group shows "Type name (count)" and the best 3 bases; "Only showing the best 3, show all N" expands it.

`components/EligibleBaseCard.tsx`: name, tier badge, "Eth estimate" badge, class-only badge, damage (1H/2H/throw) or
defense/block after the ethereal estimate, speed, requirements (effective level = max(base, runeword), Str/Dex after
the ethereal −10) with deficits in red "(+12)", sockets as one line per socket count — rows for Jewel and Mythical
Jewel are collapsed (`collapseRowsBySockets`: "4 sockets (1 Jewel or 1 Mythical Jewel)") with "needs ilvl ≥ N for N"
when the base needs a higher item level — and "Upgrade: <next tier>" linking to `/game-data/bases?search="<name>"`.
Unusable bases (only listed with the toggle) are dimmed.

A red banner appears when the runeword's level requirement (lowest of the used rows) exceeds the character level.
When nothing qualifies, the empty state explains the funnel (`summariseRejections`): of N bases, X have a fitting item
type, Y of those can have enough sockets, Z are allowed for the class, W meet level/Str/Dex.

#### URL params

Read once on mount by `hooks/useBestBaseUrlState.ts`, dispatched to the slice, then removed from the URL.

Read once on mount by `hooks/useBestBaseUrlState.ts`, dispatched to the slice, then removed from the URL. Unlike the
Bases page, missing params do not reset anything: the character fields present override (and persist) the stored
character, the rest is kept.

| Param | Field            | Format                                |
| ----- | ---------------- | ------------------------------------- |
| `rw`  | selected.name    | HTM runeword name                     |
| `v`   | selected.variant | number (default 1)                    |
| `cls` | character.cls    | `any` or a class code (`ama` … `war`) |
| `lvl` | character.level  | 1–99                                  |
| `str` | character.str    | 0–999                                 |
| `dex` | character.dex    | 0–999                                 |

Copy Link writes `rw` + `v` and the character fields that differ from the defaults. Every runeword card has a hammer
icon ("Find best base") linking to `/game-data/best-base?rw=<name>&v=<variant>`; it carries no character params, so the
stored character is kept.

### Affixes page

`/game-data/affixes` (`screens/AffixesScreen.tsx`) loads `types`, `bases` and `affixes`. It has two modes, switched by the
selected base (`base` in the slice / URL). Every Bases page card links to `/game-data/affixes?base=<code>`
("What can roll").

State (`gameData.affixes`): `search`, `kinds` (`p`/`s`/`a`, empty = all), `rareOnly`, `minLvl`/`maxLvl` (1–99 or
null), `cls` (`any` / `none` / class code), `types` (item-type codes), `base` (base code or null), `ilvl` (1–99, default
99), `quality` (`magic` default / `rare`), `includeAutomagic` (default true), `sort` (`name` / `lvl` default / `group` /
`freq`), `sortDir`. "Reset filters" resets everything except `base`, `ilvl`, `quality` and `includeAutomagic` (it stays
in the current mode); "Clear base" returns to browse mode.

#### Browse mode (no base)

All filters combine with AND:

- **search**: `parseSearchTerms`; every term must appear in the name or a rendered `text` line.
- **kind**, **rare only**.
- **class**: `none` = affixes without `classspecific`; a class = only that class's affixes.
- **level range**: the affix span `[lvl, maxLvl]` (maxLvl 0 = up to 99) overlaps `[minLvl, maxLvl]`.
- **item types**: a flat picker of the types that occur in any affix's itypes. An affix matches when any selected code is
  in its `itypes` and none is in its `etypes` (codes only, no ancestor walk).
- **sort**: name, affix level, group or frequency, ascending/descending; ties by name.

Cards (`components/AffixCard.tsx`) show name, badges, level / required level / group / frequency, the stat lines and
"Can appear on … except …". Lists page with "Show more" (200 at a time).

#### What-can-roll mode (`base` set)

`eligibleAffixes({ affixes, base, ancestors: base.ancestors, ilvl, quality, includeAutomagic })`; the panel
(`components/AffixRollPanel.tsx`: base picker, item level input + slider, Magic/Rare, automods) shows "Affix level N at
ilvl X on Base (qlvl Q)". Prefixes and suffixes are shown side by side, automods below (or "has no automod pool"). Each
section is sorted by group, then affix level, with a header per group ("Group N · summed % · one affix per group"); every
card shows its weight (`freq / Σfreq` within its kind, over all eligible affixes, before the page filters). Search, kind,
rare-only and class still apply on top; the level range, item types and sort are hidden and ignored. Each section has its
own "Show more".

#### URL params

Read once on mount by `hooks/useAffixesUrlState.ts`, then removed from the URL (like the Bases page); Copy Link encodes
the non-default values. Invalid values fall back to the defaults; unknown type and base codes are dropped.

| Param    | Field            | Format                                        |
| -------- | ---------------- | --------------------------------------------- |
| `search` | search           | text (shared key)                             |
| `aff`    | kinds            | comma list of `p`, `s`, `a`                   |
| `rare`   | rareOnly         | `1`                                           |
| `minlvl` | minLvl           | 1–99                                          |
| `maxlvl` | maxLvl           | 1–99 (shared key)                             |
| `cls`    | cls              | `none` or a class code                        |
| `type`   | types            | comma list of type codes                      |
| `base`   | base             | base code → what-can-roll mode                |
| `ilvl`   | ilvl             | 1–99 (default 99)                             |
| `q`      | quality          | `rare` (default magic)                        |
| `auto`   | includeAutomagic | `0` hides automods (default shown)            |
| `sort`   | sort + sortDir   | `name`/`lvl`/`group`/`freq`, `-` = descending |

### Enhance page

`/game-data/enhance` (`screens/EnhanceScreen.tsx`) loads only `enhance.json`, so it is a static-bundle route that skips
the startup loading gate (`isStaticBundlePath` in `src/core/layouts/staticBundleRoutes.ts`). Three tabs:

- **Corruption** (`components/EnhanceCorruption.tsx`): slot pills with outcome counts; a header "N outcomes · 75%
  success, 25% brick → Rare item of the same type (Crafted, Superior, Normal and Low Quality keep their quality)"
  built by `brickSummary`, the rates with a "Computed from the recipe rows" tooltip; the corruptible qualities, the
  qualities without rows, roll-only qualities and the notes; then the outcome list (roll number, lines, variants as
  "Superior, Normal and Low Quality: …").
- **Anointment** (`components/EnhanceAnointment.tsx`): Equipment pills (weapon … amulet) and Other pools (Unique
  Charm, Vessel of Souls), the rules above the list (not on uniques, not on runewords, socketed range), each outcome
  with its label; the outcomes socketed items cannot roll are marked.
- **Vessel of Souls** (`components/EnhanceVessel.tsx`): tier pills plus Completion; a tier header (start → end souls,
  costs), one row per recipe: soul cost badge, "max N×" badge, materials → bonus lines (the anointment recipe links to
  the Vessel pool on the Anointment tab); Completion lists the 29 transforms.

State lives in the URL (read on every render, written with `replace`), parsed and encoded by `utils/enhance.ts`:

| Param    | Meaning                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- |
| `tab`    | `corruption` (default), `anointment`, `vessel`                                              |
| `slot`   | corruption slot / anointment pool (`weapon` default; `charm`, `vessel` on Anointment)       |
| `tier`   | Vessel tier `1`–`4` (default `1`) or `completion`                                           |
| `search` | text (shared key, debounced 300 ms); AND terms over the lines (and labels / material names) |

Invalid values fall back to the tab's first option; Copy Link encodes only the non-default values the tab uses.

### Cube page

`/game-data/cube` (`screens/CubeScreen.tsx`) loads only `cube.json` and is a static-bundle route like Enhance. Tools
menu entry "Cube Recipes", layout tab "Cube".

- **Filters**: two searches, "Ingredient" (inputs only) and "Result" (the output text, and on raw rows the output
  code, bonus lines and details), and "Result quality" checkboxes (Unique, Set, Rare, Magic, Crafted; any of them).
  All must match. Family and group labels are not searched by them (they are txt descriptions that name both sides);
  a big family's group names per side are (`inputNames` / `outputNames`), a match keeping the group's rows.
- **Family index**: inside the filter panel under the filters (a hairline above it, the chips on the panel's card
  surface like the home page chips), one line per section (its label links to the official page section), the families
  as chips with their row counts (matching rows while searching); a chip focuses the family.
- Two cards (no search, no focus): the corruption / anointment / Vessel rows are on the Enhance page (with their
  count), and the stocker / can bookkeeping rows are left out (count, official page link).
- **Family sections** by official section (`components/CubeFamilySection.tsx`): label (a button that focuses it), row
  count, "Official: <section>" link; per group a header (the recipe shape, a dev label, with its conditions as badges)
  unless one group holds the whole family; the merged rows (inputs → output, the output item level as a muted note,
  "N cubemain rows" when merged). Families
  with raw rows offer "Show all N cubemain rows" (every row with its outputs, bonus lines, conditions, description and
  line number, the item level under an output); a filter that only matches raw rows shows them directly.
- Empty state: "No cube recipe matches the filters", with the official Cube Recipes page link.

URL state (read on every render, `utils/cube.ts`):

| Param    | Meaning                                                                                                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `in`     | Ingredient search, AND terms (quoted phrases), matched against the inputs only (and a big family's group `inputNames`)                                                                                                                                                                  |
| `out`    | Result search, AND terms, matched against the outputs only (and a big family's group `outputNames`)                                                                                                                                                                                     |
| `q`      | Result qualities, comma-separated (`unique,set,rare,magic,crafted`); a row is kept when one of its `qualities` is selected; unknown values are dropped                                                                                                                                  |
| `search` | Legacy (old links; the page has no box for it, a notice with "Clear" shows it): AND terms over either side; a family whose label matches every term stays whole, else a group whose header (shape, names, conditions) matches, else merged rows and raw recipes are filtered one by one |
| `family` | focused family id (unknown ids show all); shows only that family, scrolls to it, "← Show all families"                                                                                                                                                                                  |

The guide's `::recipes[family]` and `::secret-recipes` blocks link to `/game-data/cube?family=<id>` ("All N recipes on
the Cube Recipes page", N = the family's rows in cube.json).

### Materials page

`/game-data/materials` (`screens/MaterialsScreen.tsx`) loads only `materials.json` (a static-bundle route like Enhance
and Cube) plus the guide bundle (`useGuide`); the page works without the guide, only the Guide lines are then missing.
Database menu entry "Materials", layout tab "Materials". The home search lists the item names (→ `?name=`) and,
from the same bundle's `families`, the cube family labels as "Cube recipes" (→ `/game-data/cube?family=<id>`).

- Search, Copy Link and the group pills (All + each group with its row count) in the filter panel; with `?name=` the
  pills are hidden and the exact-name chip sits in the "Showing N of M items" line under the panel.
- One section per group, a small heading per block when the group has several, and one compact row per item
  (`components/MaterialRow.tsx`): name, code (muted), "N variants" for merged rows, levels ("lvl 11 · req 11"); **How
  to get**: one "Cube: <family> N" chip per madeBy family (→ `/game-data/cube?family=`), then the other source labels;
  **Used in**: amber Enhance chips (→ `/game-data/enhance?tab=…&slot=…`) and family chips with recipe counts (the first
  6, then "+N more"); **Guide**: the notes of `itemNotes[code]` plus the notes of the first madeBy family
  (`familyNotes`), linking to `/guide/<slug>`.
- Empty state: "No item matches." with a button that clears the search, group and name.

URL state (read on every render, written with `replace`; `utils/materials.ts`):

| Param    | Meaning                                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search` | AND terms (quoted phrases): a group whose label matches stays whole, else a block whose label matches, else items by name, code, grade, sources, family labels and Enhance roles |
| `group`  | group code (`sock`, `cube`, `body` …; unknown codes show all)                                                                                                                    |
| `name`   | exact-name focus (`normaliseItemName`), ignores the other filters; the chip's × clears it                                                                                        |

### Areas page

`/game-data/areas` (`screens/AreasScreen.tsx`) loads only `areas.json` (a static-bundle route). Database menu entry
"Areas", layout tab "Areas". The home search lists the area names and links to `?search="<name>"` (the page has no
exact-name focus; the two duplicated names, Jail Level 2 and Catacombs Level 3, show both rows).

- Filter panel: search, min / max monster level (an area matches when its Normal, Nightmare or Hell level is inside the
  range; towns and areas without monsters never match a set bound; the hint under the inputs says so) and Copy Link.
  "Showing N of M areas" under it.
- One table per section: "Act I" … "Act V" (non-map rows by `act`), "Maps · Tier 1" … "Tier 5" (a sub-heading row per
  zone, zones in order of first appearance) and "Unique maps". Columns: Area (boss as a muted second line, a "No town
  portal" badge), Monster level, Density, Unique packs (each N / NM / H; packs as min–max), Waypoint (check or —),
  Connects to (names). The table scrolls sideways inside its card on phones with the Area column sticky.
- Empty state: "No area matches." with a button that clears every filter.

URL state (read on every render, written with `replace`; `utils/areas.ts`):

| Param    | Meaning                                                                  |
| -------- | ------------------------------------------------------------------------ |
| `search` | AND terms (quoted phrases) over the area name, map zone and boss         |
| `minlvl` | lowest monster level (1–150; shared key with the Affixes page)           |
| `maxlvl` | highest monster level (1–150; shared `FILTER_URL_PARAM_KEYS.MAXLVL` key) |

### Sets page

`/game-data/sets` (`screens/SetsScreen.tsx`) loads only `sets.json` (a static-bundle route like Enhance, Cube and
Materials) plus sources.json through `useItemSources` and tiers.json through `useBaseTiers` (the source lines and
tier badges are a bonus: missing while their bundle loads or when it fails). Database menu entry "Sets" (after Mythicals), layout tab "Sets" (after Bases). The home search lists set names
("Sets") and set item names ("Set items"), both linking to `/game-data/sets?name=`.

- Search, "Max required level" input, Copy Link; Pieces pills (All + each item count with its set count) and Class
  pills (All, Any class, then the classes by name), all in the filter panel; with `?name=` the pills are hidden and the
  exact-name chip sits in the "Showing N of M sets" line under the panel; sets sorted by their highest required level,
  then name.
- One card per set (`components/SetCard.tsx`): green name, class badge ("Any class" when none), "N pieces", a base
  tier summary (`TierRangeBadge`: the tier when every tiered item shares it, "Normal → Elite" from the lowest to the
  highest otherwise; `setTierRange` in `utils/sets.ts` skips rings and amulets, no badge when no item has a tier), "Req Lvl
  a–b", an "Official page" link (docs/sets.htm at the class anchor, the page top for classless sets) and a Copy Link
  of `?name=<set>`. The 12 hireling sets also get a Normal / Nightmare / Hell badge from their id suffix (`-N`, `-NM`,
  `-H`; `setDifficulty`), which the search reads too. Items as rows: name, "base [tier badge] · category · Lvl N · Req Lvl N" (the Bases page badge via `TierBadge`; none for rings and amulets), own lines (blue), the source line,
  and the per-item partial bonuses under green "2 items" pills (a second column from `sm`). Set-wide amber boxes "2
  items" … and "Full set" sit right of the items from `lg`, below them on narrow screens.
- Highlighted items (amber background and left bar): the items matching the search on their own, or the item named by
  `?name=`.
- Empty state: "No set matches." with a button that clears every filter.

URL state (read on every render, written with `replace`; `utils/sets.ts`):

| Param    | Meaning                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `search` | AND terms (quoted phrases) over the set name, class, item names, bases, categories and every bonus line; whole sets are kept |
| `maxlvl` | the whole set is wearable: the set's highest item required level ≤ the value                                                 |
| `pieces` | number of items in the set (unknown counts show all)                                                                         |
| `cls`    | class code, or `any` for the sets without a class (unknown codes show all)                                                   |
| `name`   | exact-name focus on a set name or a set item name (that item highlighted); ignores the other filters; the chip's × clears it |

## Runeword matching

`engine/matchRunewords.ts` maps each HTM runeword (`name::variant`) to a txt key. Names are normalised on both sides
(colour codes stripped, NFKD without diacritics, apostrophes unified, lowercase, whitespace collapsed); ingredients
additionally lose a trailing " rune" / " gem". Passes: 1 exact ordered recipe, 2 same multiset, 3 name unique on both
sides ("recipe differs"). Jewels are on neither side, so every per-socket HTM row of a recipe matches the same key;
`rowsForSockets` picks the rows inside the HTM `sockets`–`socketsMax` range.

29 names (Rain, Dream, Shinigami, …) have several txt keys with the same recipe that differ only in item types. When
`typeNames` (type code → name from `types.json`) is passed, such ties are narrowed to the key whose itype/etype names
equal the HTM allowed/excluded items (`tors` reads "Body Armor" on the site, and " (code)" suffixes are ignored);
otherwise the match carries all tied keys and their rows.

Against the 2026-10 fixture: 409/409 HTM rows match exactly, no ties remain, and the 12 unmatched txt keys are the
gem-only recipes, all found on gemwords.htm.

### In the Best Base page

`matchRunewords(htm, txtBundle, { typeNames })` runs on every render of the finder (React Compiler memoises it; ~400
HTM rows). `typeNames` is built from `types.json` so ties between txt keys (Rain, Shinigami, …) are narrowed by allowed
items.

- **No match**: amber notice "Not in game files (ESR {manifest version}); docs are ESR {Dexie version}" and a second
  cmdk picker over all txt runewords (name, key, recipe, socket range). The pick is stored as `txtKeyOverride` and
  cleared when another runeword is selected; "Clear manual pick" removes it.
- **Match quality `multiset` / `name-only`**: blue info badge "recipe differs in game files".
- **Data consistency** (collapsible `<details>` at the bottom): matched count, unmatched HTM rows (name, variant,
  recipe) and unmatched txt keys.

### Best base engine

`engine/bestBase.ts` (pure): `findEligibleBases({ rows, bases, types, character, options })` keeps a base when its
ancestors hit an itype and no etype, `max(socketCaps) ≥ row.sockets` (reports `minIlvlForSockets` from the base's own
type thresholds), and the class lock allows the character (`cls: 'any'` disables it). Each base appears once with the
fewest-socket qualifying row (`rows` lists all). `effectiveReqLvl = max(base.reqLvl, row.reqLvl)`; bases above the
character's level/str/dex are dropped unless `includeUnusable`, which returns them with `deficits`. `ethereal` lowers
str/dex by 10 (min 0) and scales damage/defense ×1.5 rounded down (`estimate: true`; misc bases are unaffected).
`rankBases(results, kind)`: weapons by the higher of 1H/2H average damage (throw damage as fallback), then speed (lower
first), then str + dex; armor by max defense, then block, then str; accessories by required level; ties by name.
`groupByType` groups by the immediate `type`; `upgradePath` returns the next family tier when it is a known base.

## Stat renderer

The renderer lives in `build/stats/` and runs at build time only:

| Module              | Role                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `tables.ts`         | Typed rows of properties, itemstatcost, propertygroups, skills, skilldesc, charstats, monstats, montype                        |
| `expandProperty.ts` | Property code + param/min/max → stat entries via properties `func1-7` (unsupported funcs → `code param min-max` + warning)     |
| `descfunc.ts`       | One stat → text by itemstatcost `descfunc` (descstrpos/neg by sign, descstr2, descval placement; printf strings via `sprintf`) |
| `renderLines.ts`    | Sums identical stats, merges damage pairs, collapses `dgrp` sets, hides descfunc 0, sorts by `descpriority`                    |
| `propertyGroups.ts` | propertygroups.txt pools → "One of:" / "N-M of the following:" + options with their chance                                     |
| `skills.ts`         | Skill name/id → display name (skilldesc `str name`), owning class; class strings from charstats                                |
| `sprintf.ts`        | `%d %+d %i %s %%`, positional `%0`-`%9`; ranges like the docs pages: `+(10 to 20)`, `(10 to 20)%`, `-(10 to 20)`               |
| `statRenderer.ts`   | `createStatRenderer(tables, strings).renderMods(mods) → { lines, warnings }`                                                   |

Rules taken from the docs pages (`statRenderer.oracle.test.ts`) rather than vanilla D2:

- Ranges read "+(10 to 20)" (prefixes.htm / suffixes.htm style).
- Fixed fire/lightning/cold/poison/bleed min+max merge into "Adds X-Y … Damage" (rolled ranges stay separate minimum /
  maximum lines, as on the affix pages); min = max reads "Adds 75 …"; cold adds
  " over N Seconds" (length / 25); poison shows `value × length / 256`. Physical and magic min/max stay two lines.
- A `skill` and an `oskill` of the same skill read "+N to Skill (All Classes)" with N the sum.
- Per-level stats (`op` 2/4/5) show `value / 2^op param` (e.g. "+0.625 to Strength (Based on Character Level)").
- Multi-line strings (`\n`) are drawn bottom-up, so their lines are reversed. ESR's mythical descriptions
  (`item_mythicaldesc`, descfunc 23, format `.%1%0` with the text in monstats `NameStr`) drop the value and the leading dot.
- A `dgrp` set is the stats sharing `dgrp` + `dgrpstrpos` (ESR puts min and max elemental damage into one dgrp).

### Affix eligibility

`engine/affixEligibility.ts`: `affixLevel(ilvl, qlvl, magicLvl)` (vanilla formula) and `eligibleAffixes({ affixes, base,
ancestors, ilvl, quality, includeAutomagic })` → `{ alvl, prefixes, suffixes, automagic }` with `weight = freq / Σfreq`
per kind. Rules: `lvl ≤ alvl`, `maxLvl == 0 || alvl ≤ maxLvl`, an itype among the ancestors and no etype, `rare` for rare
items, `freq > 0`, class lock (base without class, affix without class, or the same class); automods by
`group == base.autoGroup` on any quality.

### Oracle

`statRenderer.oracle.test.ts` renders the runeword stats of every matched HTM runeword (and gem-only recipes via
gemwords.htm) and looks each line up in the HTM bonus lines (union of the three columns; both sides lowercased,
whitespace collapsed, colour codes, dashes, apostrophes and a trailing period normalised; the txt lines get the docs
parser's wrapped-line merge). It prints the identical share and the 40 most frequent mismatches. 2026-10-09: 96.5 %
(2882/2985); the floor is 94.5 %. Remaining differences: rolled runeword ranges (the docs show only the maximum), docs vs game
file version drift (docs 3.2.02, game files 3.2.10: changed values and mythical texts), and lines the docs parser puts
in the rune-bonus group.

## Warnings

Warnings are printed and stored in `manifest.warnings`; string conflicts are printed only (their number is in
`counts.stringConflicts`). Warnings do not fail the build.

| Warning                                                  | Meaning                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string "<key>": kept … ignored …` (console only)        | The same string key exists in several `strings/*.json` files with different English text. The kept value comes from the higher-priority file: `item-runes` > `item-nameaffixes` > `item-modifiers` > `item-names` > `skills` > other files alphabetically > `chinese-overlay` (the censored names of the Chinese release). Expected: ~85, almost all from `chinese-overlay`. |
| `bases: <code> … is not in its own tier family`          | The base's code is not listed in its `normcode/ubercode/ultracode`; treated as normal tier. ESR 3.2.10: `q86` Scissors Suwayyah, `qdf` Hunter's Guise.                                                                                                                                                                                                                       |
| `bases: <code> is mythical but its name string is …`     | Mythical accessories `mam`/`mrn`/`mjw` reuse the plain amu/rin/jew name strings; the `name` column ("Mythical Amulet") is used instead.                                                                                                                                                                                                                                      |
| `bases: dropped X (duplicate of Y)`                      | A base identical to an earlier one in every field except `code`/`family` is dropped (first in file order wins; count in `counts.duplicateBases`). ESR 3.2.10: `cx1`-`cx3` (copies of the `cm1`-`cm3` charms). `cm8`/`c11` Noob's Charms differ in reqLvl and are both kept.                                                                                                  |
| `bases: <code> name string … not found`                  | `namestr` has no string; the internal `name` column is used instead.                                                                                                                                                                                                                                                                                                         |
| `bases: … family code … does not exist` / `unknown type` | Broken references in the txt files; check the ESR data.                                                                                                                                                                                                                                                                                                                      |
| `itemtypes: … unknown parent / duplicate code`           | Broken Equiv references in itemtypes.txt.                                                                                                                                                                                                                                                                                                                                    |

## Code layout

```
scripts/generate-game-data.ts            CLI: arguments, git, file I/O
scripts/generate-item-icons.ts           CLI: item icons (sharp WebP encoding, file I/O)
scripts/generate-skill-icons.ts          CLI: skill icons (cels of the HD skill icon sheets, see SKILLS.md)
src/features/game-data/
  engine/      runtime + build time: schema.ts, itemTypes.ts, sockets.ts, matchRunewords.ts, bestBase.ts,
               affixEligibility.ts
  engine/browser/loadGameData.ts         browser-only loader (fetch, import.meta.env)
  build/       build only: tsv.ts, strings.ts, model.ts, esrSources.ts, bundleTypes.ts, bundleBases.ts,
               bundleRunewords.ts, bundleAffixes.ts, bundleSources.ts (+ treasureClasses.ts, pluginUniques.ts,
               itemNames.ts), bundleLootFilter.ts, bundleEnhance.ts, bundleCube.ts, bundleMaterials.ts, bundleSets.ts,
               bundleSkills.ts, bundleSkillDetails.ts, skillIcons.ts, bundleCrafting.ts, bundleTiers.ts (+ tiers.ts), bundleAreas.ts, itemIcons.ts,
               generateBundles.ts,
               writeBundle.ts
  build/cube/  cubemain rows and texts shared with the guide: cubeRows.ts, cubeText.ts, cubeFamilies.ts, cubeCatalog.ts
  build/stats/ stat renderer (see "Stat renderer")
```

`engine/` and `build/` are shared with the Node script, so they use relative imports ending in `.ts`, no `@/` aliases,
and no DOM/React. They are type-checked by `tsconfig.scripts.json`; `build/` is excluded from the app project.
The script runs with Node's built-in type stripping (Node ≥ 22.18).

UI files (Bases, Item Types):

```
src/features/game-data/
  index.ts                         route screen exports
  constants/{bases,urlParams}.ts
  store/gameDataSlice.ts           + gameDataSlice.test.ts (reducers + URL helpers)
  store/baseFiltersUrl.ts          encode/decode/hasBaseFilterParams
  hooks/{useGameData,useBasesUrlState,useItemIcons,useBaseTiers}.ts
  components/TierBadge.tsx         TierBadge / TierRangeBadge (unique and set item cards)
  utils/filterBases.ts             filterBases + baseMatchesFilters (+ test)
  utils/baseFamilies.ts            family model + stat line, shared with the loot-filter base browser (+ test on the bundles)
  utils/familyView.ts              families view: visible columns, kept rows, dimmed members, counts (+ test; fixtures in testBases.mock.ts)
  utils/baseAutomods.ts            automod options + shared lines, smite/kick label for base cards (+ test)
  utils/{typeGroups,typeTree,format}.ts + typeTree.test.ts
  components/{GameDataVersionBanner,GameDataError,GameDataLoading,ComingSoon,BaseFilters,BaseCard,BaseFamilyTable,ItemIcon}.tsx
  screens/{GameDataLayout,BasesScreen,BestBaseScreen,AffixesScreen,ItemTypesScreen}.tsx
```

UI files (Best Base):

```
store/character.ts            defaults, ranges, isCharacter validator, patchCharacter
store/bestBaseUrl.ts          encode/decode/hasBestBaseParams      (tests: store/bestBaseState.test.ts)
hooks/useBestBaseUrlState.ts  URL → slice on mount, share URL
hooks/useManifest.ts          manifest for the version notice (also used by GameDataVersionBanner)
utils/bestBaseResults.ts      collapseRowsBySockets, gameFileStats, summariseRejections, buildBaseGroups, resolveTxtSource, labels (+ test)
components/{CharacterForm,ComboPicker,EligibleBaseCard}.tsx
screens/BestBaseScreen.tsx
```

`TIER_BADGE_CLASS` moved from `BaseCard.tsx` to `constants/bases.ts` (shared by both cards).

UI files (Affixes):

```
screens/AffixesScreen.tsx         loader, mode switch, browse results
components/AffixRollPanel.tsx     base picker (ComboPicker), item level, Magic/Rare, automods
components/AffixFilters.tsx       search, kind, rare-only, class, level range, sort, item types, reset, share link
components/AffixRollResults.tsx   what-can-roll sections, grouped
components/AffixCard.tsx          one affix
components/AffixList.tsx          "Show more" paging (200 per page)
utils/filterAffixes.ts            filtering, sorting, grouping, formatting (+ test)
store/affixFiltersUrl.ts          URL encode/decode (tests: store/affixFilters.test.ts)
hooks/useAffixesUrlState.ts       URL → slice on mount, share URL
constants/affixes.ts              kinds, sort keys, labels, level range, page size
```

UI files (Enhance):

```
screens/EnhanceScreen.tsx              loader, tabs, search, Copy Link (URL state)
components/EnhanceCorruption.tsx       slot pills, rates, qualities, notes, outcome list
components/EnhanceAnointment.tsx       pool pills, rules, outcome list
components/EnhanceVessel.tsx           tier pills, recipes, completion
components/EnhanceParts.tsx            Pills, EnhanceSearch, BonusLines, ComputedRate
utils/enhance.ts                       URL state, search, brickSummary, texts (+ test)
```

UI files (Cube):

```
screens/CubeScreen.tsx                 loader, family index, hidden-rows cards, search, focus, Copy Link
components/CubeFamilySection.tsx       one family: groups, merged rows, raw rows expander, DocsLink
utils/cube.ts                          URL state, tree, search rule, docs URLs (+ test)
```

UI files (Materials):

```
screens/MaterialsScreen.tsx            loader, group pills, exact-name chip, search, sections, Copy Link
components/MaterialRow.tsx             one item: how to get, used in, guide notes
utils/materials.ts                     URL state, tree, search rule, cube / enhance links, guide join (+ test)
```

UI files (Areas):

```
screens/AreasScreen.tsx                loader, search, min / max level, section tables, Copy Link
utils/areas.ts                         URL state, sections (acts, map tiers by zone, unique maps), filters (+ test)
```

UI files (Sets):

```
screens/SetsScreen.tsx                 loader, search, max level, pieces / class pills, exact-name chip, Copy Link
components/SetCard.tsx                 one set: header, item rows with partial bonuses and sources, set-wide boxes
utils/sets.ts                          URL state, options, order, search / focus rule, docs and focus links (+ test)
```

## Tests

- Build: `build/tsv.test.ts`, `build/strings.test.ts`, `build/bundleEnhance.test.ts` (two-step dummy pattern, dedupe
  across qualities with variants, rates, chance lines, subtype bricks, repeatable note, anointment labels and rules,
  Vessel op=15/op=18 dedupe, tiers from gates, cap join, trap/disabled-row exclusion, transforms), `build/bundleCube.test.ts`
  (hide rules, family precedence, fallback grouping, raw vs merged rows, rem / lvl=, readable conditions),
  `build/bundleMaterials.test.ts` (inclusion and exclusion rules, container / same-name / coupon collapsing, uses via
  item types but not `any` or base types, returned inputs, source joins and the dropped stocker Cube label, enhance
  roles), `build/bundleSets.test.ts` (hidden `_old`, itemless and unknown-set rows, group N → pieces, a/b merge, class
  resolution, level range, warnings), `build/bundleSkills.test.ts` (class / page filter, row-column order, tab names,
  level cap, missing desc / name / required skill / shared cell warnings), `build/bundleCrafting.test.ts` (first row per
  slot, class from the bonus, the differing ingredient as key, glove over armo, wand / jewel / charm / tier / void skips,
  D-stoning steps and cap-duplicate rows, shadowed groups, gem meld without steps, row counts),
  `build/cube/cubeText.test.ts` (rem, lvl=, counted merging), `build/bundleBases.test.ts` (staffmods, range, smite/kick,
  automod eligibility and attachment on inline TSV), `build/bundleRunewords.test.ts`, `build/bundleAffixes.test.ts`,
  `build/bundleSources.test.ts` (each label rule on inline TSV; with the ESR clone, the verified examples Pelta Lunata,
  Krok's Basher, Mephisto's Will, Frostmourne, Annihilus, Hellfire Torch, Kill Ledger, Orb of Anointment, Forging Hammer),
  `build/stats/*.test.ts` (sprintf, expandProperty, descfunc, renderLines, propertyGroups), `build/bundleAreas.test.ts`
  (left-out rows, MonLvlEx / density / unique packs per difficulty, towns and areas without monsters, name fallback,
  map tier / zone / boss, connections to left-out rows, tier ladder / LevelGroup / unknown Vis warnings)
- Engine: `engine/itemTypes.test.ts`, `engine/sockets.test.ts`, `engine/matchRunewords.test.ts`,
  `engine/bestBase.test.ts`, `engine/affixEligibility.test.ts`, `engine/browser/loadGameData.test.ts`
- UI: `store/gameDataSlice.test.ts`, `store/bestBaseState.test.ts`, `utils/filterBases.test.ts`,
  `utils/typeTree.test.ts`, `utils/bestBaseResults.test.ts`, `utils/filterAffixes.test.ts`, `store/affixFilters.test.ts`,
  `utils/baseAutomods.test.ts`, `utils/enhance.test.ts`, `utils/cube.test.ts`, `utils/materials.test.ts`,
  `utils/sets.test.ts`, `utils/areas.test.ts`
- `bundleIntegrity.test.ts`: reads the committed JSON (counts, hashes, schema, type references, affix text, the enhance
  counts and rates listed under "Enhance", the cube families, fallback limits and hidden enhance rows listed under "Cube
  recipes", and for materials.json: every used-in / made-by family exists in cube.json with at most its row count,
  every Enhance role is a real reagent, no base code, row-count range, spot checks of a rune, gem, organ, Dragon Stone
  and the coupon tiers; for sets.json: 76 sets, unique ids, no `_old`, level ranges, piece counts, every item in
  sources.json, and Arcanna's Tricks / Harbinger of Ruin checked against docs/sets.htm; for skills.json: 8 classes × 3
  tabs, 280 skills, level cap 110, unique cells, required skills within the class, the Warlock tabs and Summon Tainted;
  for crafting.json: one skill forging per class on every slot, all-skills, the 7 stat forgings (Chipped Amethyst
  checked), 60 rune forgings (46 ES + 14 Kanji), 8 amulet-only aura forgings, Dragon Stone weapon steps, 8 gem melds;
  for areas.json: unique ids, resolvable connections, 5 tiers × 4 zones on the level ladder, the unique map, the five
  towns with a waypoint and no level).
  When the
  ESR clone is present it also regenerates the bundles in memory, checks they equal the committed files, and compares
  base names with the clone's `docs/weapons.htm` / `docs/armors.htm` (≥ 95 % overlap; misses are printed).
- `runewordMatching.integration.test.ts`: skips without `test-fixtures/runewords.htm`, `runewords.json` or `types.json`;
  prints the match histogram and unmatched lists, asserts ≥ 95 %.
- `itemIconMatching.integration.test.ts`: skips without the unique / mythical HTM fixtures, `icons.json` or
  `lootfilter.json`; asserts ≥ 99 % of the HTM unique and mythical names are txt unique names (unmatched names are
  logged, visible when a test fails).
- `statRenderer.oracle.test.ts`: see "Oracle"; skips without the fixtures or bundles.
- `scripts/lib/updateSummary.test.ts`: summary formatting of `game-data:update` (count diffs, porcelain parsing).

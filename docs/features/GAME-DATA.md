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

| File                | Contents                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`     | schema, ESR version / tag / commit, `generatedAt`, sha256 + size per file, counts, warnings                                                                            |
| `types.json`        | item types (Equiv parents, ancestors, socket caps per ilvl band, class, UI/runeword categories) + 8 classes with skill-tab names                                       |
| `bases.json`        | spawnable weapons (369) and armors (255) plus 29 equippable accessories (rings, amulets, charms, jewels); superior affix rows with their weights and pools             |
| `runewords.json`    | runes.txt runeword recipes: 391 `Runeword*` keys with 449 rows and rendered stats (see "Runewords")                                                                    |
| `affixes.json`      | 2532 spawnable magic prefixes, suffixes and automods with rendered text (see "Affixes")                                                                                |
| `sources.json`      | "where does it come from" labels for uniques, set items and crafting-relevant misc items (see "Sources")                                                               |
| `lootfilter.json`   | loot-filter editor reference data: every item code, stats, areas, sounds, uniques and sets with their ids (see "Loot filter data")                                     |
| `enhance.json`      | corruption, anointment, jewel sanctification and Vessel of Souls outcomes from cubemain.txt (see "Enhance")                                                            |
| `cube.json`         | every other player-facing cubemain.txt recipe, grouped into families by official section (see "Cube recipes")                                                          |
| `materials.json`    | every misc item worth looking up, with its sources, the cube families using / making it and its Enhance roles (see "Materials")                                        |
| `sets.json`         | every set with its items, own lines, per-item and set-wide partial bonuses and full-set bonuses (see "Sets")                                                           |
| `skills.json`       | the class skill trees (tabs, grid position, level and skill requirements) and the level cap, for builds (see "Skills")                                                 |
| `skilldetails.json` | details of every class and item-granted skill, the items granting it, the official skill information page's texts and mercenaries ([SKILLS.md](./SKILLS.md))           |
| `skillcalc.json`    | per-level skill values: each skilldetails skill's tooltip lines with the formulas and skills.txt / missiles.txt columns they read ([SKILLS.md](./SKILLS.md))           |
| `crafting.json`     | forging, D-stoning and gem meld options with rendered lines per slot family, for builds (see "Crafting options")                                                       |
| `tiers.json`        | base tier of every weapons.txt / armor.txt row with one, spawnable or not, for the unique and set item tier badges (see "Tiers")                                       |
| `areas.json`        | every area of levels.txt: monster level, density and unique packs per difficulty, waypoint, terrain, connections, map tiers and items (see "Areas")                    |
| `stash.json`        | shared stash (.d2i) parser data: stat widths, item kinds and sizes, page grid; Ancient Coupon recipes; gemword ids (see "Stash")                                       |
| `stashnames.json`   | item, unique, set item and runeword names by the ids a save stores (lazy, /stash/items only; see "Stash")                                                              |
| `itemtext.json`     | stash item text (lazy, /stash/items only): saved stats' display columns, their strings, skill / class / monster names, magic / rare names (see "Item text")            |
| `terrorzones.json`  | the offline terror zone rotation of `hd/global/excel/desecratedzones.json`: config, seed, zone groups in file order, boosts ([TERROR-ZONES.md](./TERROR-ZONES.md))     |
| `modifiers.json`    | what item modifiers do: every stat ESR items carry, modifier kinds, numbers with provenance from the tables and ESR's plugin configs ([MODIFIERS.md](./MODIFIERS.md))  |
| `masteries.json`    | weapon mastery specialisations: bases, token and ingredients from cubemain.txt, effects from the awakened tokens' descriptions, affected skills (see "Weapon mastery") |
| `icons.json`        | item icon index (base / quest / item code, unique / set item / socketable name, item type → WebP file under `icons/`, size); own generator ("Item icons")              |

Arrays are written one element per line so diffs stay readable. Bundle URLs carry the manifest hash (`?v=<sha256>`);
the manifest itself is always revalidated. The shape is defined in `src/features/game-data/engine/schema.ts`
(`GAME_DATA_SCHEMA`); bump it whenever a bundle shape changes incompatibly. The manifest carries it and
`loadGameData` rejects another value with "Reload the page" (`GameDataSchemaError`): bundle URLs are hash-busted, so new
code never reads old cached bundles; the bump stops a tab still running old code from reading new bundles it would
misread. Schema 2 came with ESR 3.3 (`WeaponMastery.property` replaced `value`; anointment pools became item types).

| Bundle              | ESR 3.2.12 size (raw / gzip)                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `types.json`        | 44 KB / 5 KB                                                                                                    |
| `bases.json`        | 292 KB / 26 KB (ESR 3.2.24 with automods, staffmods and range: 322 KB / 27 KB; + superior: 340 KB / 31 KB)      |
| `runewords.json`    | 197 KB / 28 KB                                                                                                  |
| `affixes.json`      | 795 KB / 61 KB (ESR 3.2.24 with `stats`: 852 KB / 67 KB, + `layers`: 894 / 72)                                  |
| `sources.json`      | 298 KB / 29 KB                                                                                                  |
| `lootfilter.json`   | ESR 3.2.24: 829 KB / 118 KB (825 / 117 before labels, 771 / 103 before skills)                                  |
| `enhance.json`      | ESR 3.2.24: 416 KB / 35 KB (357 KB / 32 KB before sanctification)                                               |
| `cube.json`         | ESR 3.2.24: 742 KB / 77 KB (before the audit fixes: 647 KB / 68 KB + `icons` 46 KB / 10 KB)                     |
| `materials.json`    | ESR 3.2.24: 165 KB / 11 KB                                                                                      |
| `sets.json`         | ESR 3.2.24: 150 KB / 21 KB                                                                                      |
| `skills.json`       | ESR 3.2.24: 31 KB / 4 KB                                                                                        |
| `skilldetails.json` | ESR 3.2.24: 406 KB / 64 KB (+ `icons/skills/`: 325 WebP files, 433 KB)                                          |
| `skillcalc.json`    | ESR 3.2.24: 380 KB / 52 KB (skills + lines 186 KB, rows 143 KB, texts 32 KB, missiles 9 KB)                     |
| `crafting.json`     | ESR 3.2.24: 63 KB / 7 KB (55 KB / 6 KB before the caps)                                                         |
| `tiers.json`        | ESR 3.2.24: 23 KB / 3 KB                                                                                        |
| `areas.json`        | ESR 3.2.24: 51 KB / 7 KB (map bosses: +13 KB raw, +1.4 KB gzip)                                                 |
| `stash.json`        | ESR 3.2.24: 143 KB / 21 KB (437 KB / 71 KB while it carried the names; 88 KB / 14 KB before the coupon recipes) |
| `stashnames.json`   | ESR 3.2.24: 294 KB / 49 KB                                                                                      |
| `itemtext.json`     | ESR 3.2.24: 484 KB / 58 KB (monsters, i.e. ESR's mythical texts: 13 KB, bases 10 KB, sockets + levels 5 KB)     |
| `terrorzones.json`  | ESR 3.2.24: 9 KB / 2 KB                                                                                         |
| `modifiers.json`    | ESR 3.2.24: 293 KB / 50 KB (stats 251 KB, of which example items 113 KB; kinds 51 KB; facts 19 KB)              |
| `masteries.json`    | ESR 3.2.24: 14 KB / 4 KB                                                                                        |
| `icons.json`        | ESR 3.2.24: 451 KB / 52 KB (+ `icons/`: 1,842 WebP, 7.0 MB; before `items`: 318 / 39, 1,434, 5.6 MB)            |

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
- Superior affixes: see "Superior affixes" below.
- Type names: itemtypes `ItemType` column. When two types share a name, the type without bases of its own gets
  " (code)" appended (`merc` → "Helm (merc)", `helm` stays "Helm"); when all or none of them have bases, all do
  ("Gem Can 1 (can1)" / "Gem Can 1 (can9)").

#### Superior affixes

When an item rolls Superior, the server picks ONE `qualityitems.txt` row the item may use and applies its mod1 and mod2
(mod2 only when mod1code is set); each value is rolled once and stays on the item as an ordinary stat, so a superior
white base keeps it when a runeword is made in it. ESR's D2RLoader plugin
(`d2rloader/config/celestialrayone.superior-affixes.toml`) replaces the stock equal odds with a weight per row and
removes the stock 10-row limit. Since ESR 3.3 the weight is the row's `frequency` column in qualityitems.txt (a whole
number 0-65535, like magicprefix frequency; 0 or an empty cell: never rolls; anything else never rolls and is a
`superior:` warning); without that column the generator falls back to the 3.2 toml table (`[superior_affixes.weights]`,
`row = weight`, rows numbered from 0 = the first line under the header; unlisted rows weigh `default_weight`).
`build/bundleSuperior.ts` writes three top-level keys
into `bases.json` (separate keys so the rows serialize one per line; `engine/superiorAffixes.ts` →
`readSuperiorAffixes(bundle)` joins them into a `SuperiorAffixes`):

- `superior` (`SuperiorRules`): `enabled`, `weightSource` (`frequency` / `config` / `equal`), `defaultWeight` (0 for
  `frequency`: an empty cell; the toml's `default_weight` for `config`), and `firstFourRowBases` (only when the plugin's
  `first_four_rows_for_throwing_and_nodurability` is true: the gear whose own type is `Throwable` or that has
  `nodurability`, which then only use rows 0-3; ESR 3.2.24: false, omitted). Without the config file, or with
  `enabled = false`, every row weighs 100 (stock equal odds) and a warning says so.
- `superiorRows` (`SuperiorRow[]`, file order): `row`, `weight`, `mods` (`{ prop, param, min, max }`), `text` (the
  stat renderer, as affixes.json), `columns` (the stock `armor` … `belt` columns set to 1), `itypes` (`itype1-7`),
  `etypes` (`etype1-5`).
- `superiorPools` (`SuperiorPool[]`): weapon and armor bases grouped by the exact set of rows they roll, in bases.json
  order of their first base: `label`, own `types`, `bases` (count), `rows`, `total` (summed weights; a row's chance on
  a base of the pool = weight / total). `label` = the deepest item type all the pool's own types descend from, plus
  " (other types)" when bases of other pools descend from it too ("Weapon (other types)" next to "Wand").

Eligibility (`engine/superiorAffixes.ts`, shared by the generator and the pages, from the toml's comments): misc items
never roll Superior; `etype` always excludes; a row with any `itype` rolls only on items whose type or type2 is one of
them or below one (Equiv walk, `BaseItem.ancestors`), ignoring its stock columns; a row without itypes uses the stock
columns, tested against the item's OWN type: `weapon` = every weapon except own type scep, wand, staf, bow, xbow (so
Amazon bows, orbs and claws use it), `armor` = every armor except own type shie, boot, glov, belt (Paladin shields,
heads, helms, circlets, pelts), `bow` = own type bow or xbow (not abow), the other columns own type exactly. The pages
compute a base's rows in the browser with `superiorRollsForBase`.

ESR 3.3: 150 rows, every one with itypes (the stock columns are blank, so the own-type exceptions play no part: an
Amazon bow matches `bow` and `weap` rows through its ancestors), every row with a frequency (125 ×40, 25 ×29, 5 ×27,
500 ×17, 15 ×14, 1 ×12, 250 ×7, 50 ×4); 15 pools: Weapon (other types) 37 rows / total 5362, Wand 39 / 5005, Staff
40 / 5010, Bow 40 / 5517, Crossbow 43 / 5520, Claw 38 / 5367, Orb 34 / 4785, Druid Club 34 / 4930, Necromancer Dagger
35 / 4945, Helm 52 / 7242, Armor 53 / 7075, Any Shield 53 / 6576, Gloves 55 / 6922, Boots 50 / 6721, Belt 49 / 6716.
Arrows and Bolts (weapons.txt `arrm` / `boqm`) roll no row. +1 to All Skills (row 29, frequency 5) is 0.093% on a
sword, 0.071% on body armor, 0.10% on an orb. (ESR 3.2.24: 83 rows, 12 pools, weights in the toml.) Other `superior:`
warnings: unknown item type codes, a row no base rolls, an unreadable weight line or frequency cell. Counts:
`superiorRows`, `superiorPools`, `superiorWeightedRows` (rows whose weight is not `defaultWeight`).
`bundleIntegrity.test.ts` checks every row's itypes, etypes and text against the "Grouped" view of
`docs/quality_affixes.htm` and the rows of all 52 item type sections of its "Expanded" view against `superiorRollsFor`
(the page shows the Enhanced Defense rows with their max only, orders the -enemy resist lines differently and prints
the bleed duration as a literal `%.2f`; all normalised). Not the weights: the 3.3 page's Rarity column still prints the
3.2.24 toml weights by row number on the new 150-row table (e.g. +1 to All Skills: 100, frequency 5), an upstream page
issue. Adding the keys did not bump `GAME_DATA_SCHEMA`.

#### Weapon mastery

`build/bundleMasteries.ts` → `masteries.json` (`MasteriesBundle`). Since ESR 3.3 every apply row sets its own
property `weapon-mastery-<weapon>` to 1 (properties.txt 757-776: stats `weapon_mastery_<weapon>` 991-1010 plus
`weapon_mastery_flag` 1011); the rows are grouped by that property, one per specialisation, in cubemain order (the 3.2
`weapon-mastery` values 1-60: 1-14 one per base family, Orb + Chipped Ruby / Skull, Claw + Chipped Ruby / Skull, Void
Blade + Chipped Obsidian / Sapphire). The "Remove Weapon Mastery - X" rows (any weapon, the property −1) are the remove
recipes; the legacy "Remove Awaken …" rows (`weapon-mastery` −N, for weapons mastered before 3.3) are not read. "True
Master - Apply …" rows take any weapon (`weap`): they give no bases, and the bundle's `anyWeaponPerk` names the perk
their trap rows check (Blacksmith "True Master", cube/perks.ts); the Bases and skill cards say any weapon takes any
specialisation with it. Per `WeaponMastery`:
`property`, `label` (the row description after " - ", trailing number dropped), `cls`, `type` (orb, claw, wswd: the rows take
any item of the type), `bases` (input 1 codes, an item type expanded to its bases; codes that are not spawnable bases,
ESR's LoD `q..` copies and some mythicals, are skipped), `token` (input 2), `inputs` (the rest, Anvil Stone included),
`remove` (the Remove row's inputs after the weapon: the Dragon Stone form + 3 Thawing Potions), `noRemove` / `noAwaken`
(bases no Remove row / no Awaken row (weapon + unawakened token → that token) takes), `mods` (the apply rows' other mods,
rendered one at a time; Orb 1: "+20% Total Spell Damage"; a mod the renderer gives no text, such as the Scythe's
`total-magic-resist` -100 (no descfunc), is written out from `HIDDEN_MOD_LABELS` or as its code, with a warning) and
`effects`.

Effects come from the awakened token's `<token>desc` string (u24-u39, u41). Item descriptions render bottom-up, so
`parseMasteryDescription` reverses the lines: each block is "Transmute this with a <weapon> variant, a <ingredient>" /
"and an Anvil Stone …", then after every blank line a skills line and its effect lines (the game colours the skills
line; the string table strips colours). `joinEffectLines` joins wrapped lines (a capital letter starts a sentence).
Tokens with two specialisations have two blocks, paired with their rows by the ingredients the recipe line names.
`resolveEffectSkills` maps a skills line to class skill ids: every part a skill name or id ("Poison, Immolation,
Freezing, Lightning Arrow" shares "Arrow"; "Wolves" → the skills with the word Wolf), else a `GROUP_RULES` entry
(Magic Spells, Spells, Sorceress Exclusives, Elemental Charge-up Skills; skills.txt EType, aurastate, itypea1; "Spells"
(ESR 3.3 Orb + Chipped Ruby, "direct damage dealing spells") = the class skills whose skills.txt formulas read the
specialisation's stat `weapon_mastery_orb_1`, the cooldown ×3 in calc6: Conflagrate, Rain of Fire, Lightning Hydra,
Storm Nexus, Time Stop, Blizzard, Orb of Winter, Permafrost), else the class tab of that name (Curses); plus the class skills the effect text names, capitalised
("Fire and Magic Skills": Hellfire Lance … Abyss), and `LOWER_CASE_MENTIONS` (Oak Branch: "contagion").
`skillNames` carries the display names. Warnings (`masteries:`): a recipe line naming another weapon or other ingredients
than the rows (ESR 3.3: u39desc's Chipped Skull block says Crushed Gem, the rows take a Dragon Stone; 3.2.24's u28desc
slip is fixed), the Celestial Blade Awaken row taking `0bs` (so `0be` has no awaken recipe; the 3.2.24 remove-row slip
is fixed), a mod without item text (Wretched Scythe), a skills line naming no skill. Counts: `masteries`,
`masteryBases`, `masteryEffects`, `masterySkills`. Shown on the Bases page cards and on the Skills page cards
([SKILLS.md](./SKILLS.md)).

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
`item_nonclassskill`, `item_numsockets`, the `*length` stats…), " (per level)" for `perlevel` stats, else the stat
name. A percent twin of a flat stat gets " %" (`markPercentLabels`): a stat whose `descstrpos` string shows a percent
(`%%`) and whose label is, or ends with, the label of a listed stat whose string does not, comparing without
" (per level)", which stays last. ESR 3.2.24: "Bonus to Strength %" / Dexterity / Vitality / Energy (255–258, the
"of All Attributes" suffixes, next to the flat 0–3), "Increase Maximum Life %" / "Mana %", "Enhanced Defense %",
"Bonus to Attack Rating %" (and its per-level stat), "Regenerate Mana %", "Physical Damage Leeched as Life %" /
"Mana %", "Damage Taken Goes To Mana %", "Target Defense %" and, as before, the "Fire / Lightning / Cold Absorb %"
stats. Percent stats without a flat twin (Faster Cast Rate, the resists) keep their label. Stat ids are itemstatcost
row numbers (the same ids as `lootfilter.json` `stats`, which carries these labels too).

`layers` (optional, omitted when empty): the params of the affix's layered stats, `{ stat, param }` by stat then param,
resolved by `createPropertyLayerResolver` (see "Stat layers" under "Loot filter data"); only stats in `stats`, so the
`_display` / `_hidden` companions never appear. ESR 3.2.24: 968 affixes, mostly `item_singleskill` (the Skillful
prefixes: 35 random skill ids each), `item_addskill_tab` and the event stats. ESR reuses the Necromancer prefix names
for the Warlock tabs ("Apprentice's" p892 = +1-2 to Demon Skills, stat 188 param 56), so the params tell them apart.
Adding the field did not bump `GAME_DATA_SCHEMA`.

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
Pelta Lunata)"). `diabloclone` is shown as "Diablo Clone" and `extralucionloot` (the loot dummy uber Lucion's death
skill spawns on players 8; it drops Lucion's Essence) as "Uber Lucion (players 8)": both reuse the plain "Diablo" name
string (`NAME_OVERRIDES` in treasureClasses.ts). Counts: `counts.sourcesUnique`,
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
  `name` = `Stat`, and `label` = the affixes.json label ("Bonus to Strength %") for the 144 stats an affix writes whose
  label is not just the name. Other stats get none: many ESR rows have descriptions unrelated to the stat (placeholder
  rows describing set bonuses, control stats named "Enemy Cold Resist"). The stat picker shows and searches the label.
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

- `skills` (optional; `build/bundleLootFilterSkills.ts`): `{ id, name, cls? }` by id, for the skill pickers, so the
  loot filter does not load skills.json (it reads these, `knownLayers` and types.json `classes` through
  `src/features/loot-filter/utils/statParams.ts`; see LOOT-FILTER.md "Stat params"). Every class tree skill (a class `charclass` and a skilldesc `SkillPage` 1-3,
  the 280 skills of skills.json) plus every skill a `knownLayers` param names; `id` = skills.txt row index (equal to
  the `*Id` column in ESR 3.2.24), `name` = skilldesc `str name` through the strings, else the `skill` column, `cls`
  only for class skills. ESR 3.2.24: 752 skills (472 without a class: item skills and procs; 25 names occur twice,
  e.g. a class skill and its item copy, so pickers show the id).
- `knownLayers` (optional): `{ stat, layers }` per skill stat (`item_nonclassskill` 97, `item_singleskill` 107,
  `item_aura` 151) and event / charged stat, the distinct params the game data puts on items, ascending (skill ids
  for skill stats, `skill << 6 | level` for the others). Sources: the affixes of affixes.json, uniques (not disabled),
  set items (own and partial bonuses), sets.txt set bonuses (PCode2a–5b, FCode1–8; not the retired `_old` sets),
  runes.txt recipes, cube outputs and every propertygroups.txt entry (a numeric
  ParMin–ParMax range = one entry per param). Tab and class stats are left out (every tab and class is listed anyway).
  ESR 3.2.24: 11 stats, 2790 params, at most 30 levels per stat and skill; 59004 is the highest.
- `skillNames` (optional): the skills.txt `skill` column of every row, by row (`skillNames[id]`, `''` for a blank
  one), the names a loot filter formula takes (`stat('item_nonclassskill', 'Teleport')`, plugin 1.8.2,
  LOOT-FILTER.md "Formula condition"). Unlike the display names of `skills` they are unique (84 of the 752 listed skills show another
  name in game, e.g. `Hex Bane` / "Hex: Bane"). ESR 3.2.24: 1566 rows; ESR 3.3: 1628; Teleport = 479.

#### Stat layers

The params ("layers") of the skill, skill tab, class, event and charged stats are encoded once, in
`src/features/game-data/engine/statLayers.ts` (`STAT_LAYER_KINDS`, `skillTabLayer`, `decodeTabLayer`,
`skillLevelLayer`, `decodeSkillLevelLayer`, `chargedValue`; shared by the generator and the app). In short: tab =
`class << 3 | tab` (properties.txt numbers the tabs `class × 3 + tab`, so Assassin Martial Arts 20 → 50, Warlock Demon
Skills 21 → 56); class = class id (ama 0 … war 7, the properties.txt `val`); skill = skills.txt row index; event and
charged = `skill << 6 | level`; charged value = `max charges << 8 | charges left`. The loot-filter plugin reads tab
params the same way (verified in game on 2026-11-01: an item with +4 to Fire Skills, Sorceress, showed 4 for
`{stat:188,8}`; properties.txt numbering would be 3). `createPropertyLayerResolver`
(`build/bundleLootFilterSkills.ts`) maps a property to its layers: func 10 tab (param, else the slot `val`, as ESR's
unused `war-tab-rand`), func 21 class (`val`), func 36 random class (every class id of min–max: Hellfire Torch), func
22/24 skill (param), func 12 random skill (every id of min–max when the range spans at most 64 ids; the "any class
skill" range 418–697 of The Stone of Jordan, Robes of Power, Skin of the Vipermagi and Ormus' Robes is left out without
a warning), func 11 / 19 event / charged (`skill << 6 | max`). The `_display` and `_hidden` companions are skipped.

In memory a stat is assumed to be `layer << 16 | stat id` (D2's 32-bit stat id), so a param is 16 bits and an event or
charged layer cannot name a skill id above 1023 (the save-file param bits are a separate limit). ESR saves 18 param bits for
these stats and gives several hidden procs (Iris of End Times, Icing Death, Delirium, Doombringer, …) skill ids
1526–1557; whether the game or the loot-filter plugin can read such a layer is not verified. The generator warns for
the visible ones and skips them.

Build warnings (`lootfilter skills: <source>: "<property>" <param>: …`): an unknown skill (ESR 3.2.24: Ember of
Creation's oskill "Axe Swarm", also a skilldetails warning), a level outside 1–63 (the Fortune runeword's level 0 Time
Lapse on getting hit), a skill id above 1023 (the Airship runeword's Long Shot 1555, propertygroup
`nature-rule-full-set` att-skill 1541), a func the resolver does not read on a layered stat, and an itemstatcost row
with `Encode` 2/3 or descfunc 13/14/15/16/24/27/28 that is missing from `STAT_LAYER_KINDS` (none in ESR 3.2.24).

Counts: `counts.lootFilterItems`, `lootFilterStats`, `lootFilterAreas`, `lootFilterSounds`, `lootFilterUniques`,
`lootFilterSets` (ESR 3.2.12: 2292 / 923 / 215 / 12103 / 1390 / 270), `lootFilterSkills`, `lootFilterKnownLayers`
(params summed over the stats; ESR 3.2.24: 752 / 2790), `lootFilterSkillNames` (non-blank rows; 1566, ESR 3.3: 1628). Adding the
file did not bump `GAME_DATA_SCHEMA`: older clients ignore files they do not load; neither did adding `skills`,
`knownLayers` and `skillNames`.

### Enhance

`enhance.json` (`EnhanceBundle`, built by `build/bundleEnhance.ts` from enabled `cubemain.txt` rows, with
`uniqueitems.txt` for the Vessel's starting souls) feeds the Enhance page. Top-level arrays (one outcome or recipe per
line): `corruption` (reagent, notes) + `corruptionSlots` + `corruptionOutcomes`, `anointment` (reagent, rules, charm
reagents, vessel item) + `anointmentSlots` + `anointmentOutcomes`, `sanctification` (reagent, item, roll range, once) +
`sanctificationOutcomes` + `sanctificationBonuses`, `vessel` (item, start souls) + `vesselTiers` + `vesselRecipes` +
`vesselTransforms`. Every outcome and recipe has its visible `mods` (raw cubemain properties, with
`chance` when the `mod N chance` column is below 100) and the `lines` rendered by the stat renderer; a property with a
chance gets its own line ending in "(25% chance)". Mods the renderer warns about are dropped with a warning.

Derivation (rows are classified by their data, not their descriptions):

- **Two-step dummy pattern.** A roll row ("Add … Dummy Stat": `op=16`, `value=0`, output `useitem` with
  `corrupted_dummy` / `anointed_dummy` / `sanctified-dummy` `min..max`) gives the roll range; the outcome rows (`op=18`, `param` = the dummy
  stat id, `value` = the roll, the item alone as input) add the marker, clear the dummy and add the bonus. The dummy
  stat id is read from the outcome rows (the ones with a negative dummy mod). `void` outputs are blockers.
- **Hidden mods**: `corrupted`, `anointed`, `sanctified`, the three dummies, `soul-counter`, `mythicaldesc`, `unusable-item`,
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
- **Anointment**: since ESR 3.3 one pool per item type ("Orb of Anointment now respects the item type it anoints"):
  every `um7` roll row `<type>,nru` + `um7` whose type is equipment is a pool, keyed by the type code (`ajav`, `axe`,
  `circ`, `zrin` …), in cubemain order (class types before their generic types: the game takes the first row an item
  matches, so an item's pool is the first one its type descends from), with `group` = its slot (weapon, helm, shield,
  body, gloves, belt, boots, ring, amulet: the first of weap, helm, shld, tors, glov, belt, boot, ring, amul it is),
  `label` = the type's name; `socketedRollRange` from the `,sock` roll rows (one shorter, so the last outcome,
  "(Sockets)", cannot roll on socketed items); `secondPerk` from the "… - Sanctimonious" roll rows (`op 3`, a perk stat
  ≥ 1: the Blacksmith perk allows a second anointment of weapons and armor); `blockedQualities` from the `void`
  "<slot>,uni + um7" rows; `noRunewords` when every roll row has `nru`. Other pools: `charm` (unique charm + three
  organs) and `vessel` (rows on the Vessel alone, rolled by the tier 4 anointment recipe). `roll` is the row's `value`,
  not the number in the description; `label` is the description's last `(…)`. The 3.2 slot ids (`weapon`, `helm` …)
  are gone, so saved builds' 3.2 anointments no longer resolve (owner decision: no migration).
- **Sanctification** (Lucion's Relic, `u18`): the `sanctified-dummy` roll row "item + reagent" without a perk trap (a
  `void` row with the same item and reagent and an `op 4` / `op 6` perk stat = 0 before it) gives the `item` (`jewl`),
  the `reagent` and `rollRange`; the perk-gated roll rows with the same outcomes are `perkItems` (ESR 3.3: Amulet and
  Ring, Jeweler perk Hallowed Accessories; other perk or outcome sets are a warning); the outcome rows are the `op=18` rows on the dummy
  stat with that item alone (`roll` = `value`), sorted by roll. Every roll is one outcome, so each is equally likely
  (1 / `rollRange`; the rows carry no weight). `once`: a `void` "item + reagent" row checking a stat `= 1` (the
  "already sanctified" blocker). `sanctificationBonuses` = each distinct bonus (property, param and range) rendered on
  its own with the number of outcomes carrying it, ordered by its column in the rows (max resist, attribute, other),
  so the page can show how often each comes up. A count other than the roll range is a warning; no roll row means an
  empty list.
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

Counts (`enhance*` in the manifest), ESR 3.3: 11 corruption slots with 272 outcomes (weapon and quiver 30 of 40
rolls, unique charm 20 of 30, the others 24 of 32: 75 % success, unique charm 66.7 %); 4,793 equipment anointments in
63 item type pools (33 weapon types, 4 helm, 4 shield, 9 ring and 9 amulet types, body, gloves, belt, boots; e.g. axe
63, circlet 96, helm 74, body armor 85, ring 101, amulet 116; ESR 3.2.24: 790 in 9 slot pools), 30 unique charm and 178
Vessel anointments; 217 jewel sanctifications (rolls 1–217, three bonuses each: a maximum resist or Physical
Resist, an attribute bonus and one other; `+1 to All Skills` in 7, each single maximum resist in 36; the same 217 for
amulets and rings with the perk); 382 Vessel recipes (tier 1: 202 × 350 + 17 × 700 souls, tier 2: 36 × 42, tier 3: 23 × 7, tier 4:
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
Corrupt`; the Enhance page shows them); `traps` = `void` outputs and descriptions with the word "Trap" (not "Starter
Weapon for Trap Assassin", a real recipe); `old` = "OLD (Delete later)"; `stockers` = descriptions with Stocker / Gem
Can / Xtal Can / Rerolling Orb, or an input that is a stocker or can item (the Crystal Can rows are labelled "Moon Rune"
… "God Rune"; the Rerolling Orb is an input of the real custom ring rerolls and is not a can); `dummy` = other "Add …
Dummy Stat" rows. A row a guide family or a stocker family (`STOCKER_FAMILIES`, below) claims (the Anvil Stone's Multi
Stocker row, the Sanctification roll, the Rune Stocker upgrades) is never stocker or dummy bookkeeping. ESR 3.2.24:
9,747 of 17,776 enabled rows are listed; hidden 4,007 enhance, 400 traps, 80 old, 3,542 stockers (storing, taking out,
cycling the selected item), 0 dummy.

**Stocker families** (`STOCKER_FAMILIES` in `cubeCatalog.ts`, first in `EXTRA_FAMILIES`): the stocker rows a player
uses on purpose, worded in points through `CubeTables.counterName` (the stocker stat's `descstrpos` string, keyed by
stat and property code; `stockerCounterNames` in `cubeRows.ts`; the Rerolling Orb's "Ring Point" gets "Magic" / "Rare"
from the quality of the item its first storing row takes): `stocker-upgrades` (Rune / Decal Stocker + Scroll of
Identify: 2 points of the selected rune → 1 of the next, one row per stocker), `crystal-can` (Kanji runes into 50
crystal points, the Null Rune back), `multi-stocker` (Decipherer / coupon / Wild Card / Heart and Soul point
conversions, the stocker shown with the item it is set to, the one its "… Output" row takes out, so the rows of one rate
merge into one row listing the items; Maple Leaf points; Wirt's Leg → Cookbook; the "Multi Stocker Input" rows that
convert: `isStockerConversion` = a set, crafted or unique item, a named item, or other points than items),
`rerolling-orb` (the orb's outputs: its setting picks the points it spends and the quality it makes, "Rerolling Orb
(set to Magic Ring Points → rare ring) + Key, or a Dragon Stone form for a class ring"; its converting inputs: Devil's
Food points per unique, Jewel and quiver points from set, crafted and unique items) and `gem-can-rerolls` (charm, jewel
and quiver rerolls for the points of the can's gem). ESR 3.2.24: 625 rows in 5 families, 119 merged rows.

**Families** (first match wins): a numbered secret recipe (`[SECRETnn]`) always goes to `secret` (Secret Recipes 26,
27, 28 and 40 also match `maple-leaf` / `charm-reroll`, which keep them for the guide), except the ESR 3.3
"[SECRETnn] Crucible - …" forgings; then the 33 guide families
(`CUBE_FAMILIES`, sections in `GUIDE_FAMILY_SECTIONS`; `CUBE_FAMILY_OVERRIDES` changes `class-craft` for the cube page
only: every slot's bonuses, one group per class), then 25 cube-only families (`EXTRA_FAMILIES`: the 5 stocker families,
unique rerolls, set conversions / cycles / rerolls, rune forging on the other
slots, legacy crafts, base upgrades, normal items, magic/rare rerolls and starter weapons, ring and amulet recipes,
jewels, quivers, materials, potions, repair, map portals, D-stoning, Tyrael's Might boon, Primordial Soulstones, quest
items, Blemished gems / Mi Rune, secret recipes grouped per number), then a fallback `other:<prefix>` per description
prefix (numbers as `#`, cut at `:`, `-` or `(`). ESR 3.3 additions: `crucible` (section Forging: the 884 "Crucible - …"
rows and the 4 "[SECRET08/09] Crucible - …" rows of the Blacksmith perk The Secret Crucible, a second forging, worded
by the matching forging family's rewrite, bonuses hidden), `specializations` (Mystical Tesseract), the Alchemist Gem
Infusion rows in `potions`, the Orb of Anointment recycle to Dragon Stones in `materials`, True Master and "Remove Weapon
Mastery" rows in `weapon-mastery`, the "… - Jeweler 15 Special" / "… - Archaeology 13 Special" perk rows as their own
groups of `unsocket` / `socket`, amulet and ring sanctification in `legendary-consumables`. ESR 3.3 (as 3.2.24): 9
fallback families with 41 rows (Introductory Book Cycle 9, Weapons Crate 8, Negative MF Charm 8, Opener Size Change 6,
Anya's Gift 6 + 1 + 1, Randomize Stone 1, Morph Charm Refund 1); the integrity test fails past 60 fallback rows or 12
fallback families, and when a defined family has no row (except `maple-leaf`: since 3.3 its rows, the unique charm
recycle and Secret Recipes 26 / 40, are all claimed earlier; the guide still lists it).

**Shape.** Top-level arrays: `sections` (official Cube Recipes page anchors in page order, then the Ascendancies, Kill
Ledger, Weapon Mastery and Vessel of Souls pages, then `other`; only sections with families; `notes` = short rewrites of
the official page's footnotes for the section, `guide` = guide note slugs, both hand-written in `CUBE_SECTIONS`, the
slugs checked against `content/guide/notes` by the integrity test), `families` (`id`, `label`, `section`, `order`,
`rowCount`, `raw`, `notes`: `FAMILY_NOTES` plus the notes read from the rows, below), `groups` (one recipe shape of a
family: the family's `collapse` key; `label` (below); `conditions` every row shares;
`inputNames` / `outputNames` = the unique / set names its rows take / give, only for families without raw rows, for the
ingredient / result searches), `rows` (the merged rows of `groupFamily(…, 'full')`: the guide's text, uncapped, always
with the output bonuses unless the family hides them, `variants` = the cubemain rows merged into it, `outputLevel`,
`dstoneCaps`, `enhanceTab`, `conditions`, `returned`, `odds`, `qualities`) and `recipes` (every row of the families with at most 40 rows: `id` = cubemain line, `description`, parsed
`inputs` (`text`, `code`, `qty`, `quals`, `kind` item / type / unique / any), `outputs` (`text`, `code` or null for
useitem/usetype/cloneitem, `bonus` lines, `details` such as "socketed items come out" for `rem`, "item level N" or "to
<map>" for the `lvl=` qualifier, `level`), `conditions`, `qualities`).

**D-stoning caps** (`dstoneCaps` on the merged rows of the `dstoning` family): the family's rows with the same inputs
and bonus stats are one D-stoning; `dstoneCap` (`build/cube/dstoneCaps.ts`, as in crafting.json "Caps") applies them
from zero and the summed bonus is rendered ("+121% Increased Attack Speed"); a merged row lists the distinct caps of
the D-stonings it merges (the tiered weapon rows share +300%). Rows without a cap condition, or with the elemental
half-point counter (`op 18`), get none. ESR 3.2.24: 151 of 152 merged rows have one (not the weapon Forging Hammer).

**Group labels**: "Secret Recipe N"; the family's `groupLabel` (class crafts "Amazon craft", legacy crafts "Caster craft",
D-stoning by slot, the stocker families); for `skill-forging`, `stat-forging`, `rune-forging-slots` and `tinkering` the
ingredients that tell the groups apart ("Chipped Emerald", "3× Heart"); the shared ingredients of the group when the
description names a gem colour or grade or a potion the rows do not take (`labelDisagrees`: "Belt Upgrade: Sash +
Thawing Potion" → "Sash + Stamina Potion"; "… perfect amethyst -> caster helm" takes a Perfect Sapphire); else the first
row's description shape.

**Merged-row extras**: `conditions` = the conditions of the row that its group does not show (all its cubemain rows
share them; one only some have reads "… (some variants)", left out past 3 such values, which are per-variant selectors
the row text already names; random rolls and a D-stoning's cap condition are left out); `returned` = ingredients handed
back unchanged (`returnedOutputs` in `cubeFamilies.ts`: an output equal to an input that is a plain item code without a
quality, so `cx1,mag` out of `cx1,mag` is a reroll, not a return), options joined with " / " ("Key", "Ancient Scroll
38"); `odds` = `rollOdds`: when every row of a merged row rolls `item_randomize ≤ N` (the game tries the rows in file
order), one line per band, "50%: Ore Shards" (Secret Recipe 25: ≤ 254 / 407 / 511 → 50 / 30 / 20%), only with 2 to 4
bands and a top threshold of 2^n − 1 (the coupon, map and scroll rerolls have more bands and stay pools). ESR 3.2.24:
148 rows with conditions, 573 with a returned ingredient, 1 with odds.

**Notes read from the rows**: the fail-safe of the hidden "Too High Req Lvl" `void` blockers (`op 15` on
`item_levelreq`; `failSafeNotes`: reagent type `dstn` → `dstoning`, `gem5` → `gem-meld`): "does nothing once the item's
added level requirement is at least 58 (elite), 79 (exceptional) or 99 (normal tier, rings, amulets)" (gem melding 55
/ 78 / 99), and the Gem Can's points per gem grade (`gemCanNote`: Chipped 1, Flawed 3, Standard 9, Flawless 27,
Blemished 81, Perfect 243). `FAMILY_NOTES` adds the hand-written ones (the uncapped weapon Forging Hammer row, how to
cycle a stocker).

**Enhance link** (`enhanceTab`): a merged row whose cubemain rows are all sanctification outcomes (`op 18` on
`item_sanctification_dummy`) is `sanctification`; the page links it to `/game-data/enhance?tab=sanctification` ("All
217 outcomes on the Enhance page"). The roll row ("Add Sanctification Dummy Stat", whose "Not marked for sanctification"
condition `statConditionText` names) stays a plain row.

**Socket counts**: an output `sock` mod reads "N sockets", or its range ("1-2 sockets": the starter weapons, Set +
Socket Donut) when min and max differ (`socketText`).

**Removals**: a negative output mod that takes something off reads "Removes {its positive line}" (`bonusLines`): a flag
(its positive line has no number: "Removes Knockback", "Removes Slain Monsters Rest in Peace"), and every negative bonus
of an output that also takes a forging marker off (`craftflag` / `craftflag2` < 0: Secret Recipe 8 "Removes +25% to
Experience Gained"); `corrupted` −1 (Astrogha's Petrified Heart) reads "Removes the corruption status, so the item can
be corrupted again". Other negative bonuses stay maluses ("-2 to Light Radius").

**Item types as ingredients** (`formatInput`, `CubeNames.anyType`): a type that reads like an item ("Helm", "Healing
Potion", "Club", "Boots"; a type whose items all share one name, such as the Multi Stocker's, keeps that name), a
renamed one (`tors` "Body Armor", itemtypes.txt's "Armor") or "Any Armor" reads "Any …" with the qualities after "Any":
"Any Magic Helm", "Any Ethereal Rare Armor", "Any Set item". The D-stoning "Any Armor" rows come after the body armor,
helm and shield rows with the same reagents, so they read "Gloves, Belt or Boots (the Any Armor rows)". The icon map
keys follow (`cubeIconMap` keys `formatInput`'s text), so "Any Helm" gets the `helm` type and "Helm" the item.

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
(variants without one do not count). ESR 3.2.24: 619 of 1,556 merged rows have a level, none disagree. The guide's
`::recipes` blocks do not show it (their rows are built by `collectFamily`, a separate path without this field).

**Qualities** (`qualities`, the page's quality filter, order unique / set / rare / magic / crafted): from the outputs a
row gives (an output equal to an input left out, as the output text): the quality qualifiers `uni` / `set` / `rar` /
`mag` / `crf` and named outputs (a setitems.txt `index` → set, a uniqueitems.txt `index` → unique). `useitem` without
a qualifier has none. ESR 3.2.24 merged rows: magic 124, unique 116, crafted 116, rare 76, set 61 (493 rows with one). Cube-only rewrites: a named unique or set
item cubed into itself reads "The same item, rerolled"; "Unique: 3 Sets" / "Set: 3 Uniques" read "3× Set items of one
base → A unique item of that base".

**Conditions** shown: "<Class> only" (`class`), "Hell only" / "Nightmare or Hell" (`min diff` 2 / 1), "Needs a
recorded <boss> kill" (`kill_check`, op 6, the boss named after the Kill Ledger row with the same value; unknown values
"(#N)") and every other stat check (`op` / `param` = itemstatcost row / `value`, `statConditionText` in
`bundleCube.ts`). The ops as ESR uses them: 3 and 15 "≥", 16 "≤", 17 "≠", 18 "=" ("Unsocket" needs sockets ≥ 1,
"Adds Socket(4)" sockets ≤ 3, tinkering needs points ≥ 2 before the row takes 2); op 28 (no stat: the vanilla quest and portal recipes, Horadric
Staff, Khalim's Will, Cow Portal and the Pandemonium portals) reads "Game rules of the original recipe apply (quest
state, act or difficulty)"; unknown ops are skipped. Specialisation perks (ESR 3.3, `cube/perks.ts`): a perk stat
(`alchemy_n`, `blacksmithing_n`, `jeweler_n`, `archaeology_n`; perk n = row ⌈n/3⌉, column (n−1) mod 3 + 1, named by
`Specializations<Tree><row>_<col>Title`, the numbering the d2rloader configs name) with op 6 / op 3 and value ≥ 1
reads "Needs the <Tree> perk <Title>", op 6 / op 4 with value 0 "Only without the <Tree> perk <Title>" (op 4 only
appears with 0, on the Alchemist rows; the only reading under which the Gem Infusion trap lets anyone use the recipe;
not checked in game). A row also needs the perk an earlier row takes away when that earlier row catches all its items
(same inputs, each with the same token and quantity, the earlier row's qualifiers a subset; item type trees are not
walked): the "Crucible Trap" / "True Master Trap" `void` rows before the perk recipes, Gem Infusion (No Excellence)
before Alchemical Excellence. The guide's `::recipes` rows note the perk a merged row needs; `::secret-recipes` skips
`void` rows and the Crucible rows and notes the perk rows (Secret Recipes 47 / 48, Jeweler perk Perfect Form). Named
checks: `item_craftflag` "No forging mod" / "Has a forging mod", `craftflag_crucible` "No crucible forging" / "Has a
crucible forging", `item_craftflag2` "No jewel forging" /
"Has a jewel forging", `item_mercflag` "Not merc-only" / "Merc-only item", `weaponmastery` "No weapon mastery token
applied" / "Weapon mastery token applied" (= 0 / nonzero), `item_upgraded` ≠ 1 "Not upgraded yet", `item_levelreq` = 0
"Only items without an added level requirement", `kill_base` op 3 "Kill count ≥ N", `soul_counter` = 0 "No souls
remaining", `item_sanctification_dummy` ≤ 0 "Not marked for sanctification"; the rest read "{stat} {op} {value}" with
a short label ("Sockets", "Tinkering points", "Faster cast rate") or the stat name without `item_`. A stocker counter
reads "Stored Devil's Food Points ≥ 25" / "Stored Ancient Decipherer points ≥ 32" (`counterName`; its capacity check,
≤ 65,000 / 4,000, is left out); `item_randomize` reads "Not used yet" (= 0), "Use counter = 9" (Anya's Gift) and, for
the random pools, "Random roll ≤ N (of 0 to 511)" (raw rows only; merged rows show `odds`); `stancedancecontrol` = 0
"Not applied to this stone yet". Groups show the conditions all their rows share: ESR 3.2.24, 160 of 536 groups. Counts (`cube\*` in the manifest): recipes, families,
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
anointment` (the charm reagents, slot `charm`), `Sanctification reagent` (`sanctification.reagent`, Lucion's Relic) and
  `Vessel of Souls material` (every Vessel recipe and transform material).
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
  remains against the docs: "Freezes target" / "Hit Blinds Target" without the "+1" (`rep-dur` 100 reads "Repairs 1
  durability in 1 seconds" like the docs since descfunc 11 was fixed).

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

`areas.json` (`AreasBundle`, built by `build/bundleAreas.ts` from the raw levels.txt and cubemain.txt text) is
`{ areas: Area[], mapBosses: MapBoss[] }` (areas in levels.txt row order), for the Areas page and the campaign map. Per area: `id` (`Id`), `name`
(`LevelName` through the string table, else `Name` without its "Act N - " prefix: only id 137 ColossalSummit lacks a
string), `act` (0-based), `waypoint` (`Waypoint` ≠ 255, never on a map row), `level` / `density` (`[n, nm, h]`),
`uniques` (`[[min, max] × 3]`), `connections` (ids), `terrain` and, when set, `group`, `tier`, `uniqueMap`, `boss`,
`mapItem`, `mapItemName`, `mapBosses`, `mapBossPick`, `preventTownPortal`, `teleport`, `questGate`, `endgameZone`.

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
  (`mapTierLevel`), a `LevelGroup` tier that differs from the `Name` tier, a `Vis*` naming an unknown level, a header
  without the `*Map Boss` or `*IsInside` column (read as empty: no map bosses, every outdoor-type level outdoor).
- **Map items**: `mapItem` is the item code (z01 … z20, z99) whose cubemain recipe outputs `Red Portal,lvl=N`, put on
  the level the portal enters: the map entrance N's first Vis target (Chasm of Horrors Level 1, Infernal Nexus 212, The
  Icecrown Citadel 201, …), or N itself when it is listed (Cursed Ossuary 191 and The Hidden Vault 213 have no entrance
  row). One map item per zone (21 in 3.2.24: 20 tier zones and the unique map); a portal that leads to no listed level
  and two items entering the same level are warnings.
- **Map bosses** (`build/bundleMapBosses.ts`, tested; the odds in `build/treasureClassOdds.ts`, tested): each boss
  arena's `*Map Boss` comment is matched to the monstats row with that in-game name (case and spacing ignored) and a
  `TreasureClass(H)`; "Guardians of Time" expands to Talic, Madawc and Korlic, and "Double T<n> Bosses" (Chaos Rift 159)
  to every tier-n boss with `mapBossPick` 2. The arena gets `mapBosses` (monstats ids); the map entry level gets
  `mapItemName`. Per boss (`MapBoss`): `name` (in game: "Herald Of Doom"), `arenas`, `tier` (its own arena's),
  `treasureClass`, `rewards`, `otherRolls`, `terrorShards`, and when they apply `terrorMissing`, `sameTableAs`,
  `setDrop`. The boss TC is split into its rolls (the leaves of its negative-picks tree, `X Boss Main` → `X Boss`):
  a roll that can give gold is the generic loot (`otherRolls`, counted with its Prob); the others become rewards by the
  items they reach: `orb` (um7), `map` (map items; `tiers` from areas.json), `key` (pk1–pk3), `token` (u23),
  `soulstone` (u19, with its `ConditionCalc`), else `item`, one reward per distinct name (Frostmourne and the six Lich
  King's Essences are two rewards). `chance` is the chance of at least one at players 1 and 8; `expected` only when a
  drop can be more than one item (a whole key set). The odds: positive Picks = independent picks, NoDrop shrunk by the
  `/players` rule (n = floor((players + 1) / 2), the new weight truncated; an explicit `Nothing` entry is not shrunk),
  single-pick sub-TCs followed, a multi-pick sub-TC kept as one branch; negative Picks roll each entry Prob times;
  memoised, and a TC that leads back to itself throws. Not modelled: monster-level TC upgrades, quality, the item
  cap. `terrorShards` = expected Worldstone Shards of `TreasureClassDesecrated(H)` (null when blank: Lucion);
  `terrorMissing` = rewards that table never reaches (the terrorized Lich King points at `The Lich King Boss`, skipping
  his Frostmourne/Essence roll). `sameTableAs` = map bosses of another zone with the same TC (Herald of Doom ↔ Avatar of
  the Night: Herald drops tier 3 maps). `setDrop` = a boss-set-unique-drop plugin rule (`readBossSetRules`) whose
  monsters (hcIdx = monstats row without Expansion rows) are all map bosses: the Eternal Hourglass from the last of the
  three Ancients. Warnings: a comment matching no monster, a "Double" comment finding too few bosses, a boss TC without a
  generic roll, a set-drop unique that is not a uniqueitems index. The hand-written fight notes and the official page's
  figures live in the campaign map (`src/features/campaign-map/data/mapBosses.ts`); the guide's `::map-bosses[tier]`
  renders the rewards. 3.2.24: 19 bosses, 18 arenas (`areasMapBosses`, `areasMapBossArenas`).
- **Waypoint**: a map row's `Waypoint` slot is a copy from the row it was made from (the in-game waypoint menu has act
  tabs only), so map rows never have one (Twisted Maze 164 has slot 26, Durance of Hate Level 2's). Act rows keep
  theirs, ESR's own changes included (Moo Moo Farm has slot 6, vanilla's Jail Level 1 slot).
- **Terrain**: `LevelType` (the vanilla lvltypes.txt ids, stable across releases) through `TERRAIN_BY_LEVEL_TYPE`,
  split by the `*IsInside` comment column (read from the raw text like `*Map Boss`): town 1 / 12 / 20 / 26 / 29;
  outdoor 2, 5, 6, 11, 16, 21, 22, 27, 28, 30, 31, 35 outside; tower 2 inside (the Forgotten Tower); cave 3 / 18 / 23
  / 33; tomb 4 / 10 / 17; dungeon 7 / 8 / 13 / 14 / 15 / 24 / 25; temple 9 / 32 / 34 and 22 / 31 inside (the Kurast
  temples, the Durance, the Dimensional Gate); special 19 (Arcane Sanctuary). An unknown type is a warning and reads as
  dungeon inside, outdoor outside. 3.2.24: town 5, outdoor 46, cave 32, tomb 34, tower 1, dungeon 37, temple 37,
  special 1.
- **Teleport** (`Teleport`): 0 → `'off'` (Frozen Wastes North / South 180 / 181 and The Crepuscular Basilica 206, the
  map arenas of the endgame page's "Disrupt" aura), 2 → `'restricted'` (Duriel's Lair 73); the default 1 is left out.
  The Maps page's "no teleport" list (Flayer Jungle L5 …) is not in the tables (they have 1).
- **Quest gate**: `questGate` = `QuestFlagEx`, else `QuestFlag`, when non-zero (the quest that must be done to enter;
  the UI labels the number): 11 Tainted Sun (Harem, Palace Cellar, Arcane, Underground Maze), 13 The Summoner (Canyon,
  Tal Rasha's Tombs, Duriel's Lair), 18 Khalim's Will (Durance), 39 Rite of Passage (Worldstone Keep, Throne), 40 game
  completed (Moo Moo Farm; its classic `QuestFlag` is 26).
- **Endgame zones**: `endgameZone: true` when the name ends in " (Endgame Zone)" (15 ESR special zones in 3.2.24; the
  suffix stays in `name`).
- **Left out** (`hidden`): the null row (id 0, `other`), the Expansion marker (dropped by the parser), the map entrances
  (`prepZones`: `Name` contains "Prep Zone", or a tier map row without monsters: The Icecrown Citadel 200 and The Sanctum
  of the Dead 204 lack the suffix; 19 rows) and the levels ESR removed (`removed`: `REMOVED_LEVELS`, Jail Level 2 30 and
  Catacombs Level 3 36: no row links to them and rows 31 / 37 took over their names; the official Maps page lists three
  Jail and three Catacombs levels). A warning fires when a removed id gains an incoming Vis link or its row disappears.
  Towns, boss arenas and id 214 (a second Naraku Level 2 row) stay.
- **Connections**: `Vis0`–`Vis7`, 0, the area itself and repeats dropped, kept only when **both rows list each other**
  (ESR's copied rows keep stale Vis entries) and the target is listed; the page resolves the names from the same bundle.
  `oneWayVis` (`areasOneWayVis`) counts the one-way links dropped: 2 in 3.2.24, both in `EXPECTED_ONE_WAY_VIS` (Matron's
  Den 133 → Burial Grounds 17, Crypt of Damnation 143 → the Necropolis entrance 144); any other one-way link is dropped
  with a warning. Outdoor borders, quest and red portals and act travel are not in any table (the campaign map curates
  them).

Counts (ESR 3.2.24): `areas` 193, `areasMaps` 55 (tier 1: 7, 2: 9, 3: 15, 4: 8, 5: 16), `areasMapZones` 20,
`areasUniqueMaps` 1, `areasWithoutMonsters` 8 (5 towns, Forgotten Tower, Harem Level 1, Dimensional Gate),
`areasWithWaypoint` 38, `areasHiddenPrepZones` 19, `areasHiddenRemoved` 2, `areasHiddenOther` 1, `areasOneWayVis` 2,
`areasWithMapItem` 21, `areasUniquesMinsThenMaxes` 59, `areasMapBosses` 19, `areasMapBossArenas` 18. levels.txt is also read by bundleLootFilter.ts (lootfilter
areas, every row) and generateBundles.ts (the cube's level names); those reads were left as they were.

### Terror zones

`terrorzones.json` (`TerrorZonesBundle`, built by `build/bundleTerrorZones.ts`) is the only bundle not read from
`data/global/excel/`: its source is `data/hd/global/excel/desecratedzones.json` (`ESR_DESECRATED_ZONES_FILE`), plus
levels.txt, levelgroups.txt and areas.json for the names. The seed (above 2^53) is quoted before `JSON.parse` and kept
as a decimal string. The app schedules one config: more than one fails the generator (a warning when it has an end time); a
duplicate zone id is left out like the game does. See [TERROR-ZONES.md](./TERROR-ZONES.md) for the shape, the names and
the schedule. Counts (ESR 3.2.24): `terrorZoneGroups` 22, `terrorZoneAreas` 127, `terrorZoneUnlistedLevels` 20 (map
entrances and the removed Catacombs level 36), `terrorZoneBoosts` 6. Warnings start with `terrorzones:`.

### Stash

`stash.json` (`StashBundle`, built by `build/bundleStash.ts`) feeds the shared stash parser
(`src/features/stash/parser/`) and the My Stash pages ([STASH.md](./STASH.md)). A save stores items as a bit stream
without length prefixes, so the parser needs every width:

- `stats`: by itemstatcost.txt row (row-numbered, the stat id): `[Save Bits, Save Add, has Save Param Bits]`, `null`
  when the stat is never saved (Save Bits 0).
- `items`: `[code, STASH_ITEM_FLAGS, invwidth, invheight]` for every weapons / armor / misc code (first row of a code
  wins); the flags say which optional fields the item carries (armor, weapon, gold, charm, monster part, scroll /
  tome, quest difficulty), from the `type` column through the itemtypes.txt Equiv hierarchy.
- `grid`: the shared stash page (inventory.txt "Big Bank Page 1": 16 × 13).
- `coupons`: every misc.txt "Coupon …" row (385 Ancient Coupons + the Wild Card `99j`) with its string-table name and
  type. `build/coupons.ts` (`readCouponRecipes`) reads their enabled cubemain.txt recipes: a row whose inputs are one
  coupon code (`"01c,qty=3"`) makes `unique` (`{ id, name }`: the first uniqueitems.txt row of the output `index`,
  row-numbered, and its display name; a unique without a string, ESR 3.2.24's `Azurewrath_old` (the Crystal Sword
  Azurewrath of coupon `24f`), is named after the unique in its coupon's name, with a warning) and gives `qty`; a row with the same code plus Wild Cards (`"01c,qty=2"` +
  `99j` / `"99j,qty=2"` / `"99j,qty=4"`) gives `withWildCards: { qty, wildCards }`, plus `suspect: true` when the row's
  `numinputs` differs from its item count (the game would most likely never match it). Rerolls (a `rnd` input) and rows
  whose output is an input are skipped. The three blank coupons (`96j`–`98j`) have no recipe and no `unique`. With
  `unique` comes `base: { code, name, type }`: the unique's base item (uniqueitems.txt `code`), its string-table name
  and its weapons / armor / misc `type`; the page resolves the type's name and ancestors from types.json (the item
  type search: "belt" finds the Sash and the Mithril Coil).
- `couponTiers`: one entry per coupon type (`cpn1`, `cpn2`, `cpn3`) with its itemtypes.txt `name` ("Coupon norm"),
  `tier`, the most common base tier of the uniques its coupons make (the tiers.json rule, `gearTier`: normal /
  exceptional / elite, null for a type whose bases have none), and `wildCardFrom`, the coupons of that tier (any
  codes) the cube turns into one Wild Card (8 / 4 / 2). ESR 3.2.24: one elite coupon is on an exceptional base, `44e`
  Measured Wrath (Burnt Text), the same coupon that takes 2 Wild Cards instead of 4 (a warning).
- `gemwords`: the runeword field values of the charm gemwords (the counts of the home card need no names).

`stashnames.json` (`StashNamesBundle`, the same generator) holds the names, loaded by the All items page only, so the
Overview and Ancient Coupons pages load the small stash.json alone:

- `bases`: for every code of stash.json `items`, in the same order, `{ code, name, type, type2?, tier? }`: the string-table name,
  the `type` / `type2` item types (their names and ancestors are in types.json) and the tiers.json tier of a weapons /
  armor row (`gearTier`: normal / exceptional / elite / mythical; none for misc items and tierless gear).
- `uniques`: every uniqueitems.txt row with a base code, by the row number a save stores (Expansion rows counted):
  `{ id, name, code, coupon?, unnamed? }`. `coupon` is the Ancient Coupon whose recipe makes the row (382 in ESR
  3.2.24, the first row of each output `index`); `unnamed` marks an index without a string (the name is then the
  coupon's unique name, `Azurewrath_old` → "Azurewrath", else the raw index, e.g. the disabled `The Perfect Cello`).
- `setItems`: every setitems.txt row with a base code, by row number: `{ id, name, code, set }`, `set` being the
  sets.txt `index` (sets.json `SetInfo.id`; an `_old` set may be missing from sets.txt). `sets`: every sets.txt row,
  `{ id: index, name }`.
- `runewords`: one entry per runes.txt `Name` key, `{ id, key, name, gemword? }`. An item's 16-bit runeword field holds
  the numeric string-table `id` of its key (strings.ts keeps the `id` of the entry each key resolved to): 63086 =
  `Runeword584` "Cow", 10910 = Holy. Keys not named `Runeword…` are the charm gemwords (`gemword: true`, 9 in ESR
  3.2.24; not in runewords.json). A key without a string id is left out with a warning; two keys sharing an id warn
  too.

Warnings: no Wild Card row, a coupon with two coupon-only recipes, an output that is no unique, an unknown base, a coupon
whose base tier differs from its type's, and a recipe whose
`numinputs` differs from its item count (ESR 3.2.24: `06j`, Bul-Kathos' Wedding Band, line 8194: `numinputs` 4 for 2
coupons + 4 Wild Cards, so the Wild Card recipe may not work in game).

Base names: ESR abbreviates potion and scroll names for the belt (`hp1` "\*HP1", `wms` "\*Thaw", `tsc` "+TP"); a name
starting with `*` or `+` reads as the misc.txt `name` column ("Minor Healing Potion"), as the cube names do
(`cube/cubeRows.ts`). 17 codes in ESR 3.2.24 (hp1–hp5, mp1–mp5, vps, yps, rvs, rvl, wms, tsc, isc; `hp5` keeps ESR's
"Supeer Healing Potion"). lootfilter.json keeps the in-game abbreviations (what a filter author sees on the ground).

Counts (ESR 3.2.24): `stashItemCodes` 2309, `stashSavedStats` 666, `stashCoupons` 385, `stashCouponRecipes` 382,
`stashCouponWildCardRecipes` 382, `stashUniques` 1390, `stashSetItems` 270, `stashRunewords` 391, `stashGemwords` 9. Wild Card costs per recipe: Normal 1, Exceptional 2, Elite 4 (one Elite coupon,
`44e` Measured Wrath, takes 2).

### Item text

`itemtext.json` (`ItemTextBundle`, built by `build/bundleItemText.ts`) is what the My Stash All items page
([STASH-ITEMS.md](./STASH-ITEMS.md)) needs to write an item's tooltip lines and name from its saved stats. Only that page
loads it (`useItemText`). The browser side (`src/features/stash/engine/items/itemText.ts`) renders with the generator's
own text renderer (`engine/stats`: descfunc, renderLines, sprintf).

- `stats`: by stat id (itemstatcost.txt row), the display columns (`StatDef`) of every stat a save can hold (Save Bits >
  0, the same rows as stash.json `stats`), null for the others. Blank / zero columns are left out, and `descstrneg` /
  `dgrpstrneg` when equal to the positive string (the renderer falls back to it). ValShift is not needed: a save stores
  the unshifted value (+52 life is saved as 52).
- `strings`: the texts of every description key of those stats, renderLines' own keys (damage ranges, enhanced
  damage, descfunc 11's `ModStre9u`) and the physical / magic range labels of the stat filters. ESR 3.2.24 references four keys no string table
  has (`MaxMagDmgPerLvl`, `ModStr3kSum`, `ModStr3u2`, `ModStrMagMastery`; warnings), drawn as the key.
- `skills`: `{ id, name, cls? }` for the lootfilter.json skills (the class trees and the skills a property names),
  every class skill, and every skill a skill / event / charged property or a random class skill range names, read from
  the property lists directly: lootfilter.json leaves out ids above 1023 (the plugin's layer encoding cannot hold them),
  a save stores them (Long Shot 1555, Delirium Proc 1557); `classes`: the charstats.txt class strings (all skills, tabs, "(X Only)").
- `monsters`: monstats.txt `NameStr` texts by monster id (the row without the Expansion row, = `hcIdx`), only for the
  ids a descfunc 23 property names (ESR's mythical descriptions, reanimate), collected from the same property lists as
  the loot-filter skills (affixes, uniques, set items, runewords, cube outputs, set bonuses, property groups); null
  elsewhere. `monTypes`: montype.txt `strplur` texts (descfunc 22).
- `magicPrefixes` / `magicSuffixes` / `autoAffixes`: names by the 1-based id a save stores (index 0 null; affixes.json
  ids are the same rows, 0-based), the string or else the raw name like affixes.json, null for blank / "null" rows.
- `rareNames`: the combined vanilla rare name table, index 0 null, 1–155 raresuffix.txt, 156–201 rareprefix.txt. ESR
  ships neither table (the game falls back to the vanilla ones), so the key order is a generator constant
  (`RARE_SUFFIX_KEYS`, `RARE_PREFIX_KEYS`, from the vanilla D2R files); every key resolves in ESR's strings. Fixture:
  first names 156–201, second names 1–155.
- `lowQuality` (vanilla lowqualityitems.txt: Crude, Cracked, Damaged, Low Quality), `superior` (`Hiquality`).
- `setBonusPieces`: set items whose aprop groups are not 2, 3, 4… pieces, by setitems.txt row: the pieces of each
  bonus list a save stores (the k-th list is the k-th non-empty group). ESR 3.2.24: one (row 17: 2, 4).
- `bases` (`build/itemTextBases.ts`): per item code with any of them, `d1` / `d2` / `dt` (one-hand, two-hand, throw
  damage as the tooltip shows them: one-hand unless two-handed only, two-hand when two-handed or one-or-two-handed,
  throw only for throwable item types, itemtypes.txt `Throwable` through the Equiv chain: ESR fills `maxmisdam` on 16
  wands, orbs and claws),
  `str` / `dex` / `lvl` requirements and `gem`, the `gemapplytype` when not 0 (1 = gems give their helm column, 2 =
  their shield column; ESR sets it per item: body armor and belts 2, boots 1, gloves 0, wands and caster staves 1).
- `socketables`: per gems.txt code (gems, runes …) its weapon / helm / shield columns as saved stats
  (`[stat id, param, value]`, the layered stats packed like a save), property groups resolved (ESR's gem columns
  name groups such as `chipped-amethyst-weap`).
- `levels`: required levels by the ids a save stores: uniqueitems / setitems `lvl req`, magicprefix / magicsuffix /
  automagic `levelreq` (1-based like the names).

Counts (ESR 3.2.24): `itemTextStats` 666, `itemTextStrings` 388, `itemTextSkills` 897, `itemTextMonsters` 393,
`itemTextMagicPrefixes` 920, `itemTextMagicSuffixes` 1597, `itemTextAutoAffixes` 126, `itemTextRareNames` 201.

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

### Skill levels

`skillcalc.json` (`SkillCalcBundle`, built by `build/bundleSkillCalc.ts` from skills.txt, skilldesc.txt, missiles.txt and
the strings, after skilldetails.json) is what the calculator in `engine/skillCalc/` needs to evaluate every
skilldetails.json skill's tooltip lines at any level: `skills` (one per skilldetails skill, same order: the shown line
definitions, synergy ids, flags), `rows` / `missiles` (skills.txt / missiles.txt rows cut to the columns the shown lines
can reach) and `texts` (each line text once). Rules, assumptions and the evaluator: [SKILLS.md](./SKILLS.md) "Skill
levels". missiles.txt joined the tables `esrSources.ts` reads; the file is a new sibling, so `GAME_DATA_SCHEMA` stays.

Counts (ESR 3.2.24): `skillCalcSkills` 461, `skillCalcSkillsWithLevelLines` 369 (every class skill; the 92 others are
item skills with description text only), `skillCalcLines` 2694 (`skillCalcLevelLines` 1245, `skillCalcFixedLines` 482,
`skillCalcSynergyLines` 967), hidden lines by reason `skillCalcHiddenGated` 80, `skillCalcHiddenEngine` 22,
`skillCalcHiddenStat` 10, `skillCalcHiddenUnsupported` 10, `skillCalcHiddenString` 2, `skillCalcHiddenParse` /
`…Random` / `…Type` / `…Format` 0; `skillCalcCharLevelSkills` 3, `skillCalcHardPointSkills` 28, `skillCalcSynergyInputs`
587 (listed; plus 235 unlisted on 73 skills), `skillCalcItemEffect` 328, `skillCalcRows` 520, `skillCalcMissiles` 31. Warnings start with `skillcalc:`: a token
the calculator refuses with the lines it hides (`skillcalc: code:clc0 in 2 lines (Frenzy dsc2-1, …)`), a missing
string, an unsupported line function, a text with more placeholders than its function fills, and `the cut rows change …`
(the row cutting lost a column: a generator bug).

### Modifiers

`modifiers.json` (`ModifiersBundle`, built by `build/bundleModifiers.ts` after the cube rows) explains the item
modifiers: `stats` (every itemstatcost.txt stat an ESR item list carries, with display strings, op formula, item
events, the properties setting it, the vanilla D2R comparison, usage per item list and up to 12 example items),
`kinds` (58 reviewed key kinds, then generated ones) and `facts` (difficultylevels.txt, charstats.txt, monstats.txt,
ESR's D2RLoader plugin configs and patches, vanilla engine constants, each with its source). The plugin configs and
patches it reads are `ESR_MODIFIER_CONFIGS` / `ESR_MODIFIER_PATCHES` in `build/esrSources.ts` (also in the sparse clone
paths); `build/toml.ts` reads the TOML. Vanilla reference values: `build/data/vanillaReference.ts`. difficultylevels.txt
and qualityitems.txt joined the tables `esrSources.ts` reads; the file is a new sibling, so `GAME_DATA_SCHEMA` stays.
Details, facts and open questions: [MODIFIERS.md](./MODIFIERS.md).

Counts (ESR 3.2.24): `modifierStats` 486, `modifierStatsUsed` 473, `modifierStatsEsrOnly` 314, `modifierStatsChanged` 9,
`modifierKinds` 395, `modifierKeyKinds` 58, `modifierFacts` 59, `modifierConfigFacts` 27, `modifierSources` 18271.
Warnings start with `modifiers:`.

### Crafting options

`crafting.json` (`CraftingBundle`, built by `build/bundleCrafting.ts` from the cubemain rows of `readCube`, after the
bases and types) lists what an equipped item of a build can be annotated with: ids plus rendered lines (`renderMods`),
never text the UI has to parse. Corruption and anointment outcomes are in enhance.json, not here. The builds crafting
picker and the guide's `::dstone-caps` table read it.

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
- **Caps** (`cap`, `capLines`; `build/cube/dstoneCaps.ts`, shared with cube.json): each D-stoning row checks a cap
  stat (`op 16`, at most `value`; the light radius reduction `op 15`, at least a negative value) and raises it by the
  same amount as its bonus (the `*-cap` mod, or a `*-cap-group` property group whose PickMode 0 entries raise several
  cap stats: `str-dex-enr-cap-group` raises the strength, dexterity, energy and shared caps). Only D-stoning raises
  these stats, so a cap counts only what D-stoning added, as the official page says. The cap is found by applying the
  group's rows from zero like the game (each use takes the first row whose condition holds) until none applies: `cap`
  is the summed amount of the first bonus stat, `capLines` the bonus lines at that total ("+121% Increased Attack
  Speed"). Property → stat ids come from properties.txt / propertygroups.txt and the itemstatcost row numbers; a cap
  mod without known stats raises the row's condition stat. The total can pass the condition value by up to one step,
  so it can differ a little from the page's round number (Spider's Silk on a weapon: +12% while at most 500, so 504;
  Dragon Stone on a weapon: 121, page 120). No cap: a row without a condition (Forging Hammer on a weapon), a
  condition other than op 15 / 16 (the elemental half-point counter) or no stop within 1,000 uses (warned). The
  integrity test reads the page's "(Capped at N)" per D-Stoning row (75 rows in four sections) and allows one step of
  difference; the known disagreements (ESR 3.2.24) are listed there: weapon Forging Hammer (no cap condition, page
  500%), Blackmoor + Key on a weapon (60 mana after each kill, page 150), Holy Symbol on armour (100 all resists, page
  150), Forging Hammer + Stamina Potion on jewelry (300% gold, page 400%) and Void Shard + Stamina Potion on a weapon
  (no such option: the rows name the Forging Hammer, see below).
- **Skipped** (`craftingRowsSkipped`; not warned unless said): jewel and charm rows (not equipment slots); rows for a
  weapon subtype, which the builds slot cannot tell apart from other weapons: the wand and staff rune forging rows, the
  wand / staff / orb gem meld rows and the two-handed (`2hsw`) D-stoning rows; tiered D-stoning variants (`weap,exc`,
  `weap,eli`, `2hsw,eli`: the untiered row is used for the slot); blocker rows (`void` output); a D-stoning group whose
  (material, switch, slot) an earlier group already took (warned). An item type that maps to no slot and is not a known
  subtype, jewel or charm is a warning.
- **Known limitations**: the wand / staff / orb overrides and the per-tier summon and elemental D-stoning amounts are
  not represented. ESR has no rune forging rows for the LoD runes (only the ES runes I … Wo, r01–r46,
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
- **Quest items** (by code, for the campaign map): `selectQuestIconCodes` takes the misc / weapons / armor.txt rows
  with a `quest` number (the campaign quest items: Horadric Staff and its parts, Khalim's organs and flails, The Gidbinn,
  Horadric Malus, Hellforge Hammer, Wirt's Leg, Lam Esen's Tome, Malah's potion, the scrolls, …, plus ESR's quest-flagged
  Ascendancy Stone, Kill Ledger and Primordial Soulstone) or a `QUEST_ICON_TYPES` type (`ques`: the portal keys,
  organs, essences, Standard of Heroes and ESR's other quest-typed items; `mmap`: the endgame map items, areas.json
  `mapItem`). Each code gets its items.json art (mod first, vanilla fallback, as for bases), keyed by code, with the
  item's display name (`readItemNames`: `namestr`, else `name`, the way stashnames.json `bases` names a code; the
  campaign map shows it without loading stashnames.json). Counts (3.2.24): 78 codes, 46 from ESR art, 31 from vanilla art (the vanilla quest
  items), 1 without art (ek2, no items.json entry); 77 entries, 73 new files (+0.32 MB), icons.json +8 KB.
- **Every other item by code** (`items`, for the Cube, Materials and Enhance pages and the loot filter item browser):
  `selectItemCodeRows` takes every lootfilter.json row (misc.txt, and the weapons / armor.txt rows bases.json leaves
  out: ESR's non-spawnable shadow bases such as Armet `ulm` and the mythical weapons `m21`…, which cube recipes and
  the Vessel of Souls name by code), without the codes `bases` or `quest` already key. Each code gets its items.json
  art (mod first, vanilla fallback). A "(6 Pack)" row (type `or6p`) without art of its own uses the single item's
  (`sixPackSingleCode`: the code without its leading `6`, `6hrt` → `hrt`, `6ppp` → `ppp` Dragon Stone, `699j` → `99j`
  Wild Card; misc.txt has no column linking the two, and 7 of the 22 names differ from the single item's, "DragonStone",
  "Anvil", "Decipherer"), so it points at the same file. A gem's or rune's code entry points at the same file as its
  name entry in `misc` (same asset slug). Counts (3.2.24): 1,579 codes, 1,134 from ESR art, 338 from vanilla art, 107
  without art (22 "(6 Pack)" rows on the single item's art); 1,472 entries.
- **Item types** (`types`, for type ingredients such as "Ring" or "5× Perfect Gem"): the art every spawnable item of
  the type (by `type` / `type2` ancestry) shares (`mcha` Large Charm, `jewl` Jewel, `ocha`, the class rings and
  amulets: 42 types), else the item of `TYPE_ICON_REPRESENTATIVES` (15): `ring` Ring, `amul` Amulet, `char` / `scha`
  Small Charm, `mcha` / `lcha` Large / Grand Charm, the gem grades `gem0` … `gem5` the Diamond of the grade (a neutral
  white gem), `gm6p` the Perfect Diamond 6-pack, the coupon tiers `cpn1` … `cpn3` the blank coupon of the tier. Broad
  equipment types (Weapon, Any Armor, Helm, Two-Handed Melee Weapon …) have none on purpose: one base would read as
  "this base only". The pages title a type icon "Example art: any item of this type works".
- **No duplicate art**: files are shared by asset slug, and byte-identical images of different slugs share one file
  too (`duplicateImageAliases`: the alphabetically first slug's file; the arrow / bolt quivers equal `bow/arrows2` /
  `bolts2`, Robe equals Cape, the deciphered bark scroll the bark scroll, two Large Charm colour variants). Images merge
  only within their source (`esr`, `vanilla`) or among the recoloured variants, so a run without the vanilla folder
  makes the same choices for the clone's art; the recoloured variants are planned from the shared untinted files, so a
  variant's untinted file always exists. The integrity test fails on two files with the same bytes. Adding `items`
  and `types` wrote 408 files (+1.43 MB: 5,829,142 → 7,324,296 bytes) and merged 5 pre-existing duplicates; icons.json
  +140 KB raw / +13 KB gzip.
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
  untinted files (138 from vanilla sprites; 2.0 MB WebP) plus 692 recoloured ones (690 files since byte-identical images share one) (see "Colour transforms"), 0 decode
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
  19 own art), 692 variants in 690 files (2.9 MB; two byte-identical pairs share a file); with a colour code but a base that never recolours: 12 uniques, 4 set items; own
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
  `misc: { [name or name#code]: info }`, `quest: { [code]: info & { name } }`, `info` =
  `{ file, w, h, tint? }`, only entries with an image). Unique names are the lootfilter.json
  `uniques[].name` (mythicals included), set item names the sets.json `items[].name`, misc names the lootfilter.json
  `items[].name`. Stale `.webp` files in `icons/`
  are deleted.
- **Manifest**: `generate-game-data.ts` does not build icons.json; it lists the committed file in the manifest as is
  (hash, bytes, `counts.itemIcons` / `uniqueIcons` / `setIcons` / `miscIcons` (178) / `questIcons` (77) /
  `itemCodeIcons` (1,472) / `typeIcons` (57), plus
  `vanillaIcons` = entries (all sections) pointing at a vanilla file, recoloured ones through their untinted file (1,281),
  `vanillaIconFiles` (267), `tintedIcons` (869) and
  `tintedIconFiles` (690)) so `loadGameDataFile('icons')` works like every other
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
  `code`. `{ kind: 'quest', code }` looks up the quest section by code. `{ kind: 'item', code }` looks up any item by
  code: `bases`, then `quest`, then `items`. `{ kind: 'type', code }` looks up `types` (none for broad types). `{ kind: 'misc', name, code? }` looks up `name#code` when a code is given, then the plain name (a trailing
  parenthetical dropped; the socketable parsers already strip the rune "(N points)" suffix); a split name without a
  matching code finds nothing. The Socketables page and the runeword cards build the ref with `socketableIconRef`
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
  and the level line); runeword cards: the socket row only (30 px icons in 36 px socket circles, on the Runewords page
  and the runeword cards the Guide and Builds embed; the rune filter has no icons), runes through `socketableIconRef`
  with the category the card resolves (`runeIconRef` in `features/runewords/utils/socketSlots.ts`, Ko by the
  runeword); jewel sockets stay empty (no jewel art yet). The builds' socket fillers stay names (jewels have no misc
  icon yet, and a filler name alone cannot tell the two Ko Runes apart). Cube page: 28 px before every ingredient and
  result that names an item (`components/CellIcon.tsx`, see "Cube page"); Materials page: 28 px before each name;
  Enhance page: the ingredients' icons in each card title (slot type when it has one, the reagent), 22 px before each
  Vessel of Souls material and 28 px before each mythical weapon of the Completion list; the loot filter item browser
  (bases and misc tabs): 24 px in each cell. All through `ItemIcon` (decorative `alt=""`, width / height set, lazy).
- **Credits**: the home footer credits the item art to Blizzard Entertainment and the ESR team (used with permission).

Next steps (not built): icon tiles in the other pickers (builds, best base); the builds crafting picker (its options
are crafts, not items: the material behind a D-stoning or forging is not in crafting.json); icons in the guide's
`::recipes` blocks (their texts are the cube texts, but the guide would have to load cube.json for the `icons` map); the families table draws long weapons (spears, staves) as 6–8 px slivers in its
32 px box (height-bound, so a wider box would not help).

## Regenerating

Recommended: one command after an ESR release.

```bash
npm run game-data:update                       # clone/pull ESR main, generate, fixtures, tests, check, summary
npm run game-data:update -- --tag 3.2.10       # pin a specific release tag (detached HEAD)
npm run game-data:update -- --no-fixtures      # skip re-downloading the HTM test fixtures
npm run game-data:update -- --no-pull          # use the clone as it is (no fetch or checkout)
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
4. Copies the current HTM fixtures to `test-fixtures/previous/`, then runs `fetch-test-fixtures.js` (both skipped with
   `--no-fixtures`). A download failure is only a warning; tests that need a missing fixture skip themselves.
5. Runs `--check` (game data, item icons and skill icons), `guide:generate` and `guide:check`, then the **full** test
   suite (`npx vitest run`, `ESR_SOURCE_DIR` set to the clone): parsers, loot filter, stash, builds and guide tests read
   the regenerated bundles and fixtures too. Failing test files are listed in the summary.
6. Prints a summary: version/tag/commit before → after, changed counts (incl. warnings), generator warnings, step
   results, notes (e.g. icons.json kept the old version because the vanilla art folder is missing, or the stash `.d2i`
   fixture is absent) and changed files under `public/game-data/`, `public/guide/` and `public/sitemap.xml`, then the
   commit command to run. It never runs `git add`/`commit`.

**After an ESR release** the `/esr-update` Claude Code skill (`.claude/skills/esr-update/SKILL.md`, details in
`reference.md` next to it) runs this command, the release diff, the [update review](#update-review) and the user-data
scan, starts parallel review agents, applies guide, doc, template and link edits, and asks the owner before
committing. It also proposes updates to itself when the review reports data or feature commits it does not cover.

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
  /docs/skill_information.htm \
  /Eastern_Sun_Resurrected.mpq/data/hd/items/ /Eastern_Sun_Resurrected.mpq/data/hd/global/ui/items/
```

(`docs/skill_information.htm` feeds skilldetails.json's `infoPage` / `mercenaries`, a warning when it is missing;
the rest of `docs` is only needed for the clone-dependent name oracle test. `game-data:update`'s sparse clone includes
all of `docs/`.)

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
5. **Official docs pages**: byte-size delta per changed page, listed once with the locales it changed in;
   hand-written pages flagged `[HAND-WRITTEN]`.
6. **Launcher configs**: changed `d2rloader/` files, with a unified diff for text files up to 200 lines.
7. **Loot filters**: added/removed filters under `LootFilters/` and the diff of small text files (`sources.json`).
8. **Everything else**: the remaining changed files with line counts.

A launcher-versions line under the header shows `modVersion`, D2RLoader, game version/build, the save mode and the
loot-filter plugin DLL version, old → new; tables the generators read are marked "(read by the app)", and docs pages,
launcher configs and other files the app follows get an `app [kind]: …` line naming what depends on them
(`ESR_REFERENCES` in `scripts/lib/esrReferences.ts`: `hand-kept` = hand-written app data such as the map boss page
figures, the mastery group rules, the cube section notes, the orb spots or the modifier prose; `generated`; `tested`;
`runtime`). `--out <file>` writes the text (or the JSON with `--json`).

Exit codes: 0 (also when nothing changed), 1 (missing clone, bad `--to`, git failure), 2 (`--from` not available).
Helpers and tests: `scripts/lib/releaseDiff.ts`, `scripts/lib/esrGit.ts`, `scripts/lib/launcherInfo.ts` and their tests.

### Update review

`npm run esr:review` (`scripts/esr-update-review.ts`) reviews the regenerated working tree after `game-data:update`.
It is read-only and compares the working tree with `git HEAD` (the previous version), the clone at the new and the old
revision (fetched on demand) and, unless `--offline`, the live sites. Every baseline comes from HEAD, so it needs no
hand-kept numbers.

```bash
npm run esr:review                              # text report
npm run esr:review -- --out review.md           # Markdown + review.json
npm run esr:review -- --offline                 # skip the network checks
```

Checks (ids as in the report): versions (manifest, clone tag, `metadata.json` modVersion vs tag, D2RLoader and game
build), manifest counts and warnings, changed entries per bundle by key, skill ids, unknown sources, id shifts
(lootfilter, stashnames, itemtext, stash save widths), build crafts (`slot:roll` / `kind:key`), cube fallback rows and
ops, map boss rewards vs the Endgame Maps page figures in `campaign-map/data/mapBosses.ts` (`mapbosses.page`: new
differences), guide `::recipes` blocks and notes whose data changed, icons (missing, cube.json `icons` tokens that
resolve to no icon, vanilla art folder, inputs), runeword and
gemword `name:variant` shifts (old vs new docs pages), loot filter (plugin DLL version vs `LOOT_FILTER_PLUGIN_VERSION`,
`LootFilters/sources.json`, Sully's upstream template and assets, bundled filters validated against old and new
data), tables vs the generated docs pages the app parses (`runes.txt`, `gems.txt` and `uniqueitems.txt` changed but
their pages were not regenerated), changed docs pages and D2RLoader configs the app follows (`refs.followed`:
`ESR_REFERENCES` plus the files `content/` cites by file name; a finding when hand-written data or a note follows
one), the docs site vs the clone's `docs/`, external links and the Discord invite, docs quoting the old version, and
a self-check: bundle files, count keys or warning classes it does not know, and feature commits since the skill or
the review script last changed. Exit 0 when it ran (findings are not a failure), 2 when it cannot run. Logic and
tests: `scripts/lib/esrReview/`; `scripts/lib/srcImport.ts` loads app modules (the `@/` alias) from Node.

`npm run esr:user-data` (`scripts/check-user-data.ts`) scans PROD's public builds, favourite counts and shared loot
filters (GET only, the publishable key from `.env.production`) and lists the references that no longer resolve in the
current data: unique, set and runeword names and variants, skill ids, crafts, favourite ids, loot filter codes and ids.
It shows counts and public names only. Logic and tests: `scripts/lib/userData/`.

### Bumping the ESR version (manual)

1. `git -C ../Eastern_Sun_Resurrected fetch --tags && git -C ../Eastern_Sun_Resurrected checkout <tag>` (tags have no `v` prefix, e.g. `3.2.10`)
2. `npm run game-data:generate` and read the printed counts and warnings
3. `npm run test` (the bundle integrity test pins counts such as 369 weapons / 255 armors; update the numbers if ESR
   changed them on purpose) and `npm run esr:review`
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
| `/game-data/enhance`   | `EnhanceScreen`   | Corruption, anointment, sanctification and Vessel outcomes        |
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
has no visible rows keeps the "Automod N" badge instead. Then a collapsed "Superior rolls: one of N, kept in runewords" (`components/SuperiorRollsSection.tsx`, also on the
Best Base cards): the superior rows this base rolls (`superiorRollsForBase`), each with its chance (rows under 1% in
amber; weight and row number in the tooltip) and the rendered lines, and an "All superior rows" link to
`/game-data/affixes?view=superior&stype=<own type>`. Hidden for bases that roll no row (misc, Arrows, Bolts). Class
weapons that take a weapon mastery get a collapsed "Weapon mastery: <skills lines>" ("one of 2 (…)" for Orb, Claw, Void
Blade; `components/WeaponMasterySection.tsx`, masteries.json loads with the page): per specialisation the recipe with
icons (Weapon + Awakened token + ingredients), the skills lines with the skill names linked (skill peek, ref kind
`mention`), the effect sentences and the other mods, then one note (one per weapon, no runeword, drops, the remove
recipe, the guide link; a base in `noAwaken` / `noRemove` reads "The game files have no awaken or remove recipe for this
base (likely a data slip)" instead of those steps). The first 100 results render; "Show more" adds 100 at a time (reset when filters change).

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

| Param     | Field          | Format                                                                                                         |
| --------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| `search`  | search         | text (shared key)                                                                                              |
| `sockets` | minSockets     | 1–6 (shared key)                                                                                               |
| `maxlvl`  | maxReqLvl      | 1–999 (shared key)                                                                                             |
| `kind`    | kinds          | comma list                                                                                                     |
| `tier`    | tiers          | comma list                                                                                                     |
| `type`    | types          | comma list of type codes (unknown codes dropped)                                                               |
| `codes`   | codes          | comma list of base codes (no picker; a chip under the search clears it; the skill cards' weapon mastery links) |
| `cls`     | classOnly      | `none` or a class code                                                                                         |
| `sort`    | sort + sortDir | `dmg` ascending, `-dmg` descending                                                                             |
| `view`    | view           | `families` (cards, the default, is omitted)                                                                    |

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
**character form** (`components/CharacterForm.tsx`): class (Any + the 8 classes from `types.json`), level 1–110 (the ESR cap, `maxLevel` of skills.json),
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
when the base needs a higher item level — "Upgrade: <next tier>" linking to `/game-data/bases?search="<name>"`, and
the collapsed "Superior rolls" panel of the Bases page (a superior base's bonus stays in the runeword).
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
| `lvl` | character.level  | 1–110                                 |
| `str` | character.str    | 0–999                                 |
| `dex` | character.dex    | 0–999                                 |

Copy Link writes `rw` + `v` and the character fields that differ from the defaults. Every runeword card has a hammer
icon ("Find best base") linking to `/game-data/best-base?rw=<name>&v=<variant>`; it carries no character params, so the
stored character is kept.

### Affixes page

`/game-data/affixes` (`screens/AffixesScreen.tsx`) loads `types`, `bases` and `affixes`. Sub-tabs at the top (`view`)
switch between **Magic & rare** (the affix lists below) and **Superior** (see "Superior view"). The Magic & rare view
has two modes, switched by the selected base (`base` in the slice / URL). Every Bases page card links to
`/game-data/affixes?base=<code>` ("What can roll").

State (`gameData.affixes`): `view` (`affixes` default / `superior`), `superiorType` (own type code or null), `search` (shared by both views), `kinds` (`p`/`s`/`a`, empty = all), `rareOnly`, `minLvl`/`maxLvl` (1–99 or
null), `cls` (`any` / `none` / class code), `types` (item-type codes), `base` (base code or null), `ilvl` (1–99, default
99), `quality` (`magic` default / `rare`), `includeAutomagic` (default true), `sort` (`name` / `lvl` default / `group` /
`freq`), `sortDir`. "Reset filters" resets everything except `view`, `base`, `ilvl`, `quality` and `includeAutomagic` (it stays
in the current view and mode); "Clear base" returns to browse mode.

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

#### Superior view (`view=superior`)

`components/SuperiorAffixesView.tsx`, from the `superior*` keys of bases.json (the tab is hidden for a bundle without
them). A filter panel (search, **Item type** select of every own type in some pool, Copy Link, Reset filters), a short
explanation (one row per Superior weapon or armor, picked by weight; chance = weight / summed weights of the rows the
base may use; values rolled once and kept in runewords; and, depending on the data, that every row names item types
matched through the type tree so the stock columns where Amazon bows use the weapon column play no part, or how the
stock columns treat Amazon bows, Paladin shields and circlets), "Showing R of 83 superior rows in P of 12 item groups",
then one card per pool (`utils/superiorView.ts` → `filterSuperiorPools`): label, rows · total weight · bases, the own
type names, and its rows in file order (`components/SuperiorRollList.tsx`: chance, `w <weight> · #<row>`, the rendered
lines; under 1% in amber). Search terms must all appear in a row's text or the pool's label / type names ("orb
skills"); the item type keeps the pools containing that type. Chances always use the pool's full total. Cards sit in
a grid (2 columns from `lg`, 3 / 4 on wider pages).

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
| `view`   | view             | `superior` (default `affixes` is omitted)     |
| `stype`  | superiorType     | own item type code (unknown codes dropped)    |

### Enhance page

`/game-data/enhance` (`screens/EnhanceScreen.tsx`) loads only `enhance.json`, so it is a static-bundle route that skips
the startup loading gate (`isStaticBundlePath` in `src/core/layouts/staticBundleRoutes.ts`). Four tabs (`SUBTAB_*`
`aria-pressed` buttons, the first row of the filter panel above the search and Copy Link; the slot / pool / tier pills stay
under the panel, with each tab's content):

- **Corruption** (`components/EnhanceCorruption.tsx`): slot pills with outcome counts; a header "N outcomes · 75%
  success, 25% brick → Rare item of the same type (Crafted, Superior, Normal and Low Quality keep their quality)"
  built by `brickSummary`, the rates with a "Computed from the recipe rows" tooltip; the corruptible qualities, the
  qualities without rows, roll-only qualities and the notes; then the outcome list (roll number, lines, variants as
  "Superior, Normal and Low Quality: …").
- **Anointment** (`components/EnhanceAnointment.tsx`): Equipment pills by slot (Weapons … Amulets,
  `utils/enhance.ts` `anointmentGroups`; picking one opens its first pool), then the slot's item type pills when it has
  more than one (Amazon Javelin … Hand to Hand 2, Circlet …, Amazonian Loop … Ring), and Other pools (Unique Charm,
  Vessel of Souls); the rules above the list (not on uniques, not on runewords, socketed range, an item rolls the first
  pool its type belongs to, the second-anointment perk), each outcome with its label; the outcomes socketed items cannot
  roll are marked.
- **Sanctification** (`components/EnhanceSanctification.tsx`): no pills; a header "Jewel + Lucion's Relic of
  Sanctification", "217 outcomes, one per roll of 217: 0.5% chance each" (computed, as the corruption rates), the
  two-step recipe and "sanctified once" rule, the perk items ("With the Jeweler perk Hallowed Accessories, you can also
  sanctify amulets and rings …"), and "How often each bonus comes up" (`sanctificationBonuses`: each
  bonus with its share of the outcomes and count); then the outcome list (roll number, lines). The cube page's folded
  sanctification row links here.
- **Vessel of Souls** (`components/EnhanceVessel.tsx`): tier pills plus Completion; a tier header (start → end souls,
  costs), one row per recipe: soul cost badge, "max N×" badge, materials (each with its 22 px icon) → bonus lines (the
  anointment recipe links to the Vessel pool on the Anointment tab); Completion lists the 29 transforms (Blemished gem
  icons → the mythical weapon's icon).
- **Icons in the card titles** (`IngredientIcons`): the slot's type icon when it has one (Ring, Amulet, Charm, Jewel;
  not Weapon, Body Armor …) and the reagent's (Worldstone Shard, Orb of Anointment, the three Demonic organs, Lucion's
  Relic); the Vessel pool shows the Vessel of Souls (a unique, by name).

State lives in the URL (read on every render, written with `replace`), parsed and encoded by `utils/enhance.ts`:

| Param    | Meaning                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tab`    | `corruption` (default), `anointment`, `sanctification`, `vessel`                                                            |
| `slot`   | corruption slot / anointment pool (an item type code, the first pool by default; `charm`, `vessel`); none on Sanctification |
| `tier`   | Vessel tier `1`–`4` (default `1`) or `completion`                                                                           |
| `search` | text (shared key, debounced 300 ms); AND terms over the lines (and labels / material names)                                 |

Invalid values fall back to the tab's first option; Copy Link encodes only the non-default values the tab uses.

### Cube page

`/game-data/cube` (`screens/CubeScreen.tsx`) loads only `cube.json` and is a static-bundle route like Enhance. Tools
menu entry "Cube Recipes", layout tab "Cube".

- **Filters**: two searches, "Ingredient" (inputs only) and "Result" (the output text and a merged row's `odds`, and on
  raw rows the output code, bonus lines and details), and "Result quality" checkboxes (Unique, Set, Rare, Magic, Crafted; any of them).
  All must match. Family and group labels are not searched by them (they are txt descriptions that name both sides);
  a big family's group names per side are (`inputNames` / `outputNames`), a match keeping the group's rows.
- **Family index**: inside the filter panel under the filters (a hairline above it, the chips on the panel's card
  surface like the home page chips), one line per section (its label links to the official page section), the families
  as chips with their row counts (matching rows while searching); a chip focuses the family.
- Two cards (no search, no focus): the corruption / anointment / Vessel rows are on the Enhance page (with their
  count), and the stocker / can bookkeeping rows (storing, taking out, cycling) are left out while their upgrades,
  conversions and rerolls are listed (count, official page link).
- **Section notes** under each section header: the section's `notes` (the official page's footnotes) as a muted list
  and "Guide:" links to its `guide` notes (titles from guide.json; none while the guide bundle loads or fails, the page
  works without it, `useGuide`).
- **Family sections** by official section (`components/CubeFamilySection.tsx`): label (a button that focuses it), row
  count, "Official: <section>" link, the family's `notes` and "Guide:" links to the notes guide.json's `familyNotes`
  lists for it (minus the section's, `familyGuideNotes` in `utils/cube.ts`); per group a header (its label, with its
  conditions as badges) unless one group holds the whole family; the merged rows (inputs → output, the output item level
  as a muted note, "Cap: …" on D-stoning rows (`dstoneCaps`), the `odds` lines, "Given back: …" (`returned`), the row's
  own `conditions` as badges (they wrap on phones), "N cubemain rows" when merged, and for `enhanceTab` rows a link "All
  N outcomes on the Enhance page" in the Enhance page link style). Families
  with raw rows offer "Show all N cubemain rows" (every row with its outputs, bonus lines, conditions, description and
  line number, the item level under an output); a filter that only matches raw rows shows them directly.
- **Icons** (28 px, `components/CellIcon.tsx` around `ItemIcon`): each ingredient and result of a merged or raw row
  gets the icon of what it names, through cube.json `icons` (`engine/cubeIcons.ts`). The build
  (`bundleCube.ts` `cubeIconMap`) keys the cell texts of every listed row, without their count (inputs as
  `formatInput` writes them, outputs by name), to `i:<item code>` / `t:<item type code>` / `u:<unique name>` /
  `s:<set item name>`, keeping only the keys the shown texts are looked up by (1,290 in 3.2.24); the first row naming a
  text wins, an item over an item type. The page splits a cell into its options ("A / B / … (7 variants)", counts
  dropped) and looks each up by its text, then without a trailing parenthetical ("Assassin's Choker (Unique)"); the
  cell gets an icon only when every option resolves to the same token, so "Normal Weapon (elite tier) / Superior
  Weapon (elite tier)" shows the Weapon type's (none: a broad type) and "Bul-Kathos' Wedding Band / Nature's Peace / …"
  none rather than the first one's; a cell with several outputs ("A + B") and the special outputs ("The same item",
  "Magic item of the same type", Red Portal) have none. Type ingredients use the `types` art (shared art or a
  representative, titled "Example art: any item of this type works"); broad equipment types have none. A list
  reserves the 28 px slot on every line when any of its cells has an icon, so names line up; the lines under a result
  with an icon are indented to its name.
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
  (`components/MaterialRow.tsx`): the item's icon (28 px, by code: `{ kind: 'item', code }`; an empty slot without
  art), name, code (muted), "N variants" for merged rows, levels ("lvl 11 · req 11"); **How
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

The property side lives in `build/stats/` (build time only); the pure text side (`descfunc`, `renderLines`, `sprintf`
and their types) in `engine/stats/`, shared with the browser (the My Stash item text, which renders saved stats):

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
- Descfunc 11 (`item_replenish_durability`, `rep-dur`) repairs 1 durability every 100 / value seconds and reads like the
  game: "Repairs 1 durability in 20 seconds" (`ModStre9u`, value 5; 100 / 3 rounds down to 33), "in 1 seconds" at 100
  (the docs pages), "Repairs N durability per second" (`ModStre9t`, the stat's own string) only from 200 up. The stat's
  label (affixes.json / lootfilter.json `label`, the modifiers kind title) is "Repairs Durability" instead of its
  misleading string, and the My Stash value filter reads "Repairs durability (rate #)".

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

| Warning                                                  | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `string "<key>": kept … ignored …` (console only)        | The same string key exists in several `strings/*.json` files with different English text. The kept value comes from the higher-priority file: `item-runes` > `item-nameaffixes` > `item-modifiers` > `item-names` > `skills` > other files alphabetically > `chinese-overlay` (the censored names of the Chinese release). Expected: ~85, almost all from `chinese-overlay`.                                                                   |
| `bases: <code> … is not in its own tier family`          | The base's code is not listed in its `normcode/ubercode/ultracode`; treated as normal tier. ESR 3.2.10: `q86` Scissors Suwayyah, `qdf` Hunter's Guise.                                                                                                                                                                                                                                                                                         |
| `bases: <code> is mythical but its name string is …`     | Mythical accessories `mam`/`mrn`/`mjw` reuse the plain amu/rin/jew name strings; the `name` column ("Mythical Amulet") is used instead.                                                                                                                                                                                                                                                                                                        |
| `bases: dropped X (duplicate of Y)`                      | A base identical to an earlier one in every field except `code`/`family` is dropped (first in file order wins; count in `counts.duplicateBases`). ESR 3.2.10: `cx1`-`cx3` (copies of the `cm1`-`cm3` charms). `cm8`/`c11` Noob's Charms differ in reqLvl and are both kept.                                                                                                                                                                    |
| `bases: <code> name string … not found`                  | `namestr` has no string; the internal `name` column is used instead.                                                                                                                                                                                                                                                                                                                                                                           |
| `bases: … family code … does not exist` / `unknown type` | Broken references in the txt files; check the ESR data.                                                                                                                                                                                                                                                                                                                                                                                        |
| `superior: superior-affixes.toml has weights for rows …` | Without a qualityitems.txt `frequency` column (ESR ≤ 3.2), the superior-affixes plugin config weighs rows qualityitems.txt does not have (ESR 3.2.24: rows 83-86; the plugin ignores them); ESR 3.3 has the column, so the toml is not read for weights. Other `superior:` warnings: a missing config (stock equal odds), an unreadable weight line or frequency cell, an unknown item type code, a row no base rolls. See "Superior affixes". |
| `itemtypes: … unknown parent / duplicate code`           | Broken Equiv references in itemtypes.txt.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `modifiers: crushing-blow.toml unique = 25 gives …`      | A plugin config comment ("50 -> 12.5 %") disagrees with the value the plugin reads; the fact keeps the value and notes the comment. ESR 3.2.24: `unique = 25` (6.25 % of current life, the comment says 12.5 %). Other `modifiers:` warnings: a key kind naming a stat itemstatcost.txt lacks, an unknown item event function, a missing config file or key. See [MODIFIERS.md](./MODIFIERS.md).                                               |
| `skillcalc: <token> in N lines (<skill> <line>, …)`      | A skill formula uses a code, function, skill or missile the calculator refuses (unknown, broken in the data, or ambiguous in the engine); those tooltip lines are not shown. ESR 3.2.24: `clc0`, `ln43`, `m1nm`/`m1xm`, missile `rad`, `m2eo`/`m2ey`/`me3o`/`me3y`, mastery `mael`, Plague Javelin's missing descmissile. See [SKILLS.md](./SKILLS.md) "Skill levels".                                                                         |

## Code layout

```
scripts/generate-game-data.ts            CLI: arguments, git, file I/O
scripts/generate-item-icons.ts           CLI: item icons (sharp WebP encoding, file I/O)
scripts/generate-skill-icons.ts          CLI: skill icons (cels of the HD skill icon sheets, see SKILLS.md)
src/features/game-data/
  engine/      runtime + build time: schema.ts, itemTypes.ts, sockets.ts, matchRunewords.ts, bestBase.ts,
               affixEligibility.ts, statLayers.ts, superiorAffixes.ts
  engine/skillCalc/ skill-level calculator (parse.ts, evaluate.ts, lines.ts, text.ts, index.ts; also in the browser)
  engine/browser/loadGameData.ts         browser-only loader (fetch, import.meta.env)
  build/       build only: tsv.ts, strings.ts, model.ts, esrSources.ts, bundleTypes.ts, bundleBases.ts,
               bundleRunewords.ts, bundleAffixes.ts, bundleSources.ts (+ treasureClasses.ts, pluginUniques.ts,
               itemNames.ts), bundleLootFilter.ts (+ bundleLootFilterSkills.ts), bundleEnhance.ts, bundleCube.ts, bundleMaterials.ts, bundleSets.ts,
               bundleSkills.ts, bundleSkillDetails.ts, bundleSkillCalc.ts, skillIcons.ts, bundleCrafting.ts, bundleTiers.ts (+ tiers.ts), bundleAreas.ts (+ bundleMapBosses.ts, treasureClassOdds.ts), itemIcons.ts,
               bundleModifiers.ts (+ toml.ts, data/vanillaReference.ts), bundleSuperior.ts,
               generateBundles.ts,
               writeBundle.ts
  build/cube/  cubemain rows and texts shared with the guide: cubeRows.ts, cubeText.ts, cubeFamilies.ts, cubeCatalog.ts
  build/stats/ stat renderer, property side (see "Stat renderer")
  engine/stats/ stat renderer, text side: descfunc.ts, renderLines.ts, sprintf.ts, types.ts (also used in the browser)
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
constants/affixes.ts              views, kinds, sort keys, labels, level range, page size
components/SuperiorAffixesView.tsx  Superior view: filters, explanation, pool cards
components/SuperiorRollList.tsx   superior rows with chance / weight / row (also the base panels)
components/SuperiorRollsSection.tsx  "Superior rolls" panel of BaseCard and EligibleBaseCard
utils/superiorView.ts             type options, filterSuperiorPools, superiorAffixesPath (+ test)
```

UI files (Enhance):

```
screens/EnhanceScreen.tsx              loader, tabs, search, Copy Link (URL state)
components/EnhanceCorruption.tsx       slot pills, rates, qualities, notes, outcome list
components/EnhanceAnointment.tsx       pool pills, rules, outcome list
components/EnhanceSanctification.tsx   recipe, per-bonus shares, outcome list
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
  Vessel op=15/op=18 dedupe, tiers from gates, cap join, trap/disabled-row exclusion, transforms, sanctification roll
  range, outcomes, bonus counts and the once blocker), `build/bundleCube.test.ts`
  (hide rules, family precedence, fallback grouping, raw vs merged rows, rem / lvl=, readable conditions, D-stoning
  caps, the sanctification Enhance link), `build/cube/dstoneCaps.test.ts` (op 16 / op 15 caps, two condition stats,
  cap mods without stats, no cap: no condition, op 18, endless),
  `build/bundleMaterials.test.ts` (inclusion and exclusion rules, container / same-name / coupon collapsing, uses via
  item types but not `any` or base types, returned inputs, source joins and the dropped stocker Cube label, enhance
  roles), `build/bundleSets.test.ts` (hidden `_old`, itemless and unknown-set rows, group N → pieces, a/b merge, class
  resolution, level range, warnings), `build/bundleSkills.test.ts` (class / page filter, row-column order, tab names,
  level cap, missing desc / name / required skill / shared cell warnings), `build/bundleCrafting.test.ts` (first row per
  slot, class from the bonus, the differing ingredient as key, glove over armo, wand / jewel / charm / tier / void skips,
  D-stoning steps and cap-duplicate rows, caps (and none without a condition), shadowed groups, gem meld without steps,
  row counts),
  `build/cube/cubeText.test.ts` (rem, lvl=, counted merging), `build/bundleBases.test.ts` (staffmods, range, smite/kick,
  automod eligibility and attachment on inline TSV), `build/bundleSuperior.test.ts` (toml weights, defaults, disabled /
  missing config, orphan weights, mod2 without mod1, pools, totals, labels, the rows 0-3 rule),
  `build/bundleRunewords.test.ts`, `build/bundleAffixes.test.ts`,
  `build/bundleSources.test.ts` (each label rule on inline TSV; with the ESR clone, the verified examples Pelta Lunata,
  Krok's Basher, Mephisto's Will, Frostmourne, Annihilus, Hellfire Torch, Kill Ledger, Orb of Anointment, Forging Hammer),
  `build/stats/*.test.ts` (expandProperty, renderLines, propertyGroups), `engine/stats/*.test.ts` (sprintf, descfunc),
  `build/bundleLootFilterSkills.test.ts` (layer resolver per func, property group entries, skills list, known layers,
  warnings, `skillId`), `build/affixStats.test.ts` (stats, labels, layers), `build/bundleAreas.test.ts`
  (left-out rows, MonLvlEx / density / unique packs per difficulty, towns and areas without monsters, name fallback,
  map tier / zone / boss, map items on the entry level, no waypoint on map rows, mutual links only, terrain / teleport /
  quest gate / endgame zone, removed and unnamed-entrance rows, tier ladder / LevelGroup / unknown Vis / LevelType /
  one-way link warnings)
- Engine: `engine/itemTypes.test.ts`, `engine/sockets.test.ts`, `engine/matchRunewords.test.ts`, `engine/statLayers.test.ts`,
  `engine/bestBase.test.ts`, `engine/affixEligibility.test.ts`, `engine/browser/loadGameData.test.ts`,
  `engine/superiorAffixes.test.ts` (stock columns with an Amazon bow, crossbow, Paladin shield, circlet and orb;
  itype / etype through ancestors; weights, chances, the rows 0-3 limit, formatting)
- UI: `store/gameDataSlice.test.ts`, `store/bestBaseState.test.ts`, `utils/filterBases.test.ts`,
  `utils/typeTree.test.ts`, `utils/bestBaseResults.test.ts`, `utils/filterAffixes.test.ts`, `store/affixFilters.test.ts`,
  `utils/baseAutomods.test.ts`, `utils/superiorView.test.ts`, `utils/enhance.test.ts`, `utils/cube.test.ts`, `utils/materials.test.ts`,
  `utils/sets.test.ts`, `utils/areas.test.ts`
- `bundleIntegrity.test.ts`: reads the committed JSON (counts, hashes, schema, type references, affix text, the enhance
  counts and rates listed under "Enhance", the cube families, fallback limits and hidden enhance rows listed under "Cube
  recipes", and for materials.json: every used-in / made-by family exists in cube.json with at most its row count,
  every Enhance role is a real reagent, no base code, row-count range, spot checks of a rune, gem, organ, Dragon Stone
  and the coupon tiers; for sets.json: 76 sets, unique ids, no `_old`, level ranges, piece counts, every item in
  sources.json, and Arcanna's Tricks / Harbinger of Ruin checked against docs/sets.htm; for skills.json: 8 classes × 3
  tabs, 280 skills, level cap 110, unique cells, required skills within the class, the Warlock tabs and Summon Tainted;
  for crafting.json: one skill forging per class on every slot, all-skills, the 7 stat forgings (Chipped Amethyst
  checked), 60 rune forgings (46 ES + 14 Kanji), 8 amulet-only aura forgings, Dragon Stone weapon steps, 8 gem melds,
  the D-stoning caps of known groups (only the weapon Forging Hammer uncapped) and, with the ESR clone, every cap
  against the official page's D-Stoning section (one step of tolerance, the known disagreements listed); for
  enhance.json: the 217 sanctification outcomes, their bonus counts and the cube page's link;
  for areas.json: unique ids, resolvable and mutual connections, 5 tiers × 4 zones on the level ladder, the unique map,
  the five towns with a waypoint, no level and town terrain, no removed level, one map item per zone (each with a
  quest icon), no waypoint on map rows; for the lootfilter.json skills: every skills.json tree skill with its class, 472
  = Orb of Winter, tab layer 50 = Assassin Martial Arts, every known layer ≤ 65535 and naming a listed skill, every
  affix layer on one of the affix's stats and decodable).
  When the
  ESR clone is present it also regenerates the bundles in memory, checks they equal the committed files, and compares
  base names with the clone's `docs/weapons.htm` / `docs/armors.htm` (≥ 95 % overlap; misses are printed).
- `runewordMatching.integration.test.ts`: skips without `test-fixtures/runewords.htm`, `runewords.json` or `types.json`;
  prints the match histogram and unmatched lists, asserts ≥ 95 %.
- `itemIconMatching.integration.test.ts`: skips without the unique / mythical HTM fixtures, `icons.json` or
  `lootfilter.json`; asserts ≥ 99 % of the HTM unique and mythical names are txt unique names (unmatched names are
  logged, visible when a test fails).
- `statRenderer.oracle.test.ts`: see "Oracle"; skips without the fixtures or bundles.
- `scripts/lib/updateSummary.test.ts`: summary formatting of `game-data:update` (count diffs, porcelain parsing), step notes such as the stale-icons hint).
- `runtimeConstants.test.ts`: pins the stat ids, paired stats, descfuncs, `STAT_QUIRKS` and `STAT_SCALES` that the
  stash parser, the stat text runtime and the loot filter hard-code to the committed bundles, by name.
- `scripts/lib/esrReview/*.test.ts`, `scripts/lib/launcherInfo.test.ts`, `scripts/lib/userData/resolve.test.ts`: the
  pure comparison logic of `esr:review`, the launcher/DLL version reader and the `esr:user-data` resolver, on synthetic
  inputs.

# esr-update reference

Read by the `/esr-update` skill before step 4. Background docs: `docs/features/GAME-DATA.md` (Regenerating),
`docs/features/GUIDE.md` (Body syntax, Staleness), `docs/features/LOOT-FILTER.md`, `docs/features/STASH.md`.

## Tools

| Command                           | What it does                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run game-data:update`        | Pull the clone (`--tag`, `--no-pull`), keep `test-fixtures/previous/`, generate bundles + icons + guide + sitemap, refresh fixtures (`--no-fixtures`), `game-data --check`, `guide:check`, full test suite, summary. Never commits.                                                                                             |
| `npm run esr:diff`                | What changed in the clone between two revisions: launcher versions, patch notes, changelog, tables (marked "read by the app"), strings, docs (once per page with its locales), launcher configs, `LootFilters/`, everything else; files the app follows get an `app [kind]: …` line. `--from/--to`, `--json`, `--out`.          |
| `npm run esr:review`              | Read-only review of the regenerated working tree against `HEAD` (the previous version), the clone and the live sites; every check below. `--out x.md` (+ `x.json`), `--json`, `--offline`, `--from <rev>`. Exit 0 when it ran (findings included), 2 when it cannot run.                                                        |
| `npm run esr:user-data`           | Read-only GET scan of PROD (publishable key from `.env.production`): public builds (every variant and alternative item), `favorite_counts`, public loot filters; lists references that no longer resolve in the new data. `--review <review.json>` also lists ids the review's findings mention. Exit 2 without env or network. |
| `npm run esr:changelog`           | The shareable PDF: every patch-note line against what the files show. `--init --diff <esr:diff json> --out <json>` writes the file to fill in; `--in <json> --diff <esr:diff json> --out <pdf>` validates and renders it (headless Chrome, `CHROME_PATH`; HTML only without Chrome). See "Patch-note check".                    |
| `npm run guide:report` / `:check` | Guide freshness report / the committed guide is current.                                                                                                                                                                                                                                                                        |

The review derives every baseline from `HEAD`, so this file holds no counts to keep in sync. The integrity test
(`src/features/game-data/bundleIntegrity.test.ts`) and `src/features/game-data/runtimeConstants.test.ts` pin the
numbers and ids that matter.

## Review checks: what a finding means and what to do

| Check id                                             | A finding means                                                                                                                                                                                                               | Action                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `versions.manifest`                                  | the working tree is not at the new tag                                                                                                                                                                                        | rerun step 1 with `--tag`                                                                                                                                                                                       |
| `versions.clone-tag`                                 | the clone's HEAD is untagged                                                                                                                                                                                                  | update to a tag unless the owner asked for `main`                                                                                                                                                               |
| `versions.mod-version`                               | `d2rloader/metadata.json` `modVersion` ≠ tag; the app labels data (and builds, filters, `guide:verify`) with it                                                                                                               | **stop and ask** (SKILL step 3.3)                                                                                                                                                                               |
| `versions.launcher`                                  | D2RLoader / game version / game build / save mode changed: the stash `.d2i` parser's format constants may be stale                                                                                                            | ask the owner for a fresh `ModernSharedStashSoftCoreV2.d2i` in `test-fixtures/stash/`, run `npx vitest run src/features/stash`; otherwise report "stash format unverified"                                      |
| `manifest.counts`, `manifest.warnings`               | counts moved / warnings appeared                                                                                                                                                                                              | explain each with the release diff (e.g. "+2 runewords: patch note adds X, Y"); a new warning class is a red flag; unexplained → investigate the table diff, report                                             |
| `bundle.<file>`                                      | entries added / removed / changed by name                                                                                                                                                                                     | spot-check against the patch notes; renamed names break guide directives and saved builds                                                                                                                       |
| `skills.ids`                                         | skill ids renamed or removed                                                                                                                                                                                                  | builds store points by id and `/skills?skill=<id>` links break: report with the user-data scan's numbers                                                                                                        |
| `sources.unknown`                                    | new items with no known source                                                                                                                                                                                                | report; the Drop Finder / guide may need a note                                                                                                                                                                 |
| `ids.lootfilter`, `ids.stashnames`, `ids.itemtext`   | an id now names another row (a row inserted mid-table)                                                                                                                                                                        | players' saved filters and old stash files silently point at other items: report as high priority with the user-data scan                                                                                       |
| `ids.stash`                                          | a stat's save width changed                                                                                                                                                                                                   | old stash files parse differently: the stash fixture test must still pass; ask for a fresh save                                                                                                                 |
| `builds.crafts`                                      | a corruption / anointment / forging outcome changed at the same `slot:roll` / `kind:key`                                                                                                                                      | saved builds silently show another outcome: report with the user-data scan                                                                                                                                      |
| `cube.fallback`                                      | rows no cube family regex matched grew                                                                                                                                                                                        | a cubemain `description` changed shape: follow-up for `src/features/game-data/build/cube/cubeFamilies.ts`                                                                                                       |
| `cube.ops`                                           | a cube condition `op` the app does not know (ESR 3.3 added `op 4`; ops 3 / 4 / 6 on a specialisation perk stat are worded "Needs / Only without the <Tree> perk <Title>", `cube/perks.ts`)                                    | the Cube page skips it silently: follow-up (`STAT_OPS` in `bundleCube.ts`); a perk stat outside `alchemy_` / `blacksmithing_` / `jeweler_` / `archaeology_` 1–15 is a new tree                                  |
| `mapbosses.page`                                     | the files' map boss rewards newly differ from the Endgame Maps page figures kept in `campaign-map/data/mapBosses.ts` (`page`)                                                                                                 | if `docs/endgame_maps.htm` changed too (`refs.followed`): update `page` and the fight notes from it; else the files moved: a question for the mod author. Gone differences: check `endgame-bosses.md`           |
| `icons.cube`                                         | a cube.json `icons` token (item code, unique or set name) newly resolves to no icons.json entry                                                                                                                               | a renamed item or art the icon generator missed: rerun `game-data:icons`; otherwise list it for the owner                                                                                                       |
| `guide.recipes`                                      | a `::recipes` block newly hit its cap or lost rows                                                                                                                                                                            | a finding to report, never to hide; check the expected shapes below                                                                                                                                             |
| `guide.data-blocks`, `guide.patch-notes`             | notes whose data changed / notes naming patch-note terms                                                                                                                                                                      | the guide agent rereads them                                                                                                                                                                                    |
| `icons.missing`, `icons.vanilla-art`, `icons.inputs` | items without an icon / no vanilla art folder / changed art inputs                                                                                                                                                            | list names so the owner can ask the mod author for art; without the folder see SKILL step 1                                                                                                                     |
| `variants.runewords`, `variants.gemwords`            | a `name:variant` now has another recipe or vanished (variants are page order)                                                                                                                                                 | favourites (`runeword:Name:N`) and build slots point elsewhere: report with the user-data scan                                                                                                                  |
| `lootfilter.plugin`                                  | the loot-filter DLL version ≠ `LOOT_FILTER_PLUGIN_VERSION` (`src/features/loot-filter/utils/template.ts`)                                                                                                                     | propose the bump (SKILL question 3) and list what to re-verify in game: the evaluator rules, `STAT_QUIRKS`, JSONC parsing; also re-read the changed DLL toml / PDF guide in the release diff                    |
| `lootfilter.sources`                                 | `LootFilters/sources.json` changed (the filters the launcher pulls live)                                                                                                                                                      | report; a new or replaced template repo is a follow-up                                                                                                                                                          |
| `lootfilter.template`, `lootfilter.assets`           | Sully's upstream QoL filter is newer / its icon or sound names differ                                                                                                                                                         | refresh (below)                                                                                                                                                                                                 |
| `lootfilter.validate`                                | the bundled template or example filter gained diagnostics against the new data                                                                                                                                                | a rule's code, id or stat is gone or (after an id shift) means another item: report; never edit Sully's copy by hand                                                                                            |
| `docs.lag`                                           | a table behind the parsed docs pages (`runes.txt`, `gems.txt`, `uniqueitems.txt`) changed but none of the pages the app parses did (finding), or only that table's pages did not (info: maybe columns the page does not show) | the docs were probably not regenerated: the runeword, gemword, socketable and unique pages show old data next to new bundle pages; ask the mod author to regenerate the docs                                    |
| `refs.followed`                                      | a docs page or D2RLoader config that hand-written app data follows (`ESR_REFERENCES` in `scripts/lib/esrReferences.ts`) or a `content/` note cites by file name changed                                                       | re-read its diff (esr:diff sections 5 and 6, under `app [hand-kept]`) and update or confirm each item ("Hand-kept data" below); info only: generator, test or runtime readers, the bundle diffs show the effect |
| `net.docs-site`                                      | a live HTM page differs from the clone's `docs/` (the site lags or was regenerated later)                                                                                                                                     | report; if the docs change after the version bump, recommend a patch release so cached users refetch                                                                                                            |
| `net.links`, `net.discord`                           | an official or community URL is not 200 / the invite expired                                                                                                                                                                  | fix official URLs (below); report community tools and the invite                                                                                                                                                |
| `docs.old-version`                                   | files quoting the old version                                                                                                                                                                                                 | update them (below)                                                                                                                                                                                             |
| `self.coverage`, `self.commits`                      | data the review does not know / feature commits since the skill changed                                                                                                                                                       | SKILL step 8                                                                                                                                                                                                    |

**Terror zones**: `terrorzones.json` regenerates from `data/hd/global/excel/desecratedzones.json` (not a `.txt` table,
so `esr:diff` lists it under "other files"; names from levels.txt / levelgroups.txt / areas.json). A changed seed, start,
duration, zone list or zone order (`bundle.terrorzones.json` `config` / `zones`) changes **every** slot of the schedule:
say so in the release summary, check the ESR ground truth in `src/features/terror-zones/engine/schedule.test.ts`
(it fails then: re-check the zones in game and replace the dated ESR slots) and note that players' watched groups
(`terrorZones.watched`, zone ids in localStorage) are ignored for ids that no longer exist; since ESR 3.3 a stored
`zoneSetFingerprint` clears every star once when any group's areas change, because ESR reuses ids (3.3: 22 → 20 groups,
every zone in a group with one Endgame Map each, `ESR-Zone19` / `ESR-Zone20` reused for Act 1 groups; the dated ESR
slots in `schedule.test.ts` are the owner's 3.3 in-game observations). **More than one config** in
desecratedzones.json makes `game-data:generate` fail (`terrorzones: … configs, the app schedules only one`): the app
schedules only one. Ask the owner; supporting it means choosing the config covering each time (the game uses the first
in file order with `start <= t < end`) in `src/features/terror-zones/engine/schedule.ts` and the bundle shape. An
unreadable `start_time_utc` / `end_time_utc` (not `YYYY-MM-DD HH:MM:SS`) fails it too. The rotation itself is a port
of d2r-arcane-tracker (`engine/rotation.ts`, recovered from the game executable): when zones seen in game disagree
with the schedule although desecratedzones.json did not change, the game's algorithm changed (a game build in
`versions.launcher`); check d2r-arcane-tracker upstream and report, never tune the port by guess. See
`docs/features/TERROR-ZONES.md`.

**Skill levels**: `skillcalc.json` regenerates from skills.txt, skilldesc.txt and missiles.txt (the formulas behind the
Skills page's per-level values, `docs/features/SKILLS.md` "Skill levels"). Explain changes of the `skillCalc*` counts:
`skillCalcHidden*` going up means lines the calculator now refuses. A `skillcalc: <token> in N lines` warning names a
formula code, function, skill or missile it cannot evaluate (ESR 3.3: `clc0` in 4 lines (Tornado Shot and Legendary
Arrow joined Frenzy and Mirrored Blades), `ln43`, `ps10` / `ps11` (Bind Demon), `m1nm`/`m1xm`, `rad`, the ambiguous
`m2eo`/`m2ey`/`me3o`/`me3y` codes, the mastery code `mael`, Plague Javelin's missing descmissile `m1en`/`m1ex`; plus the
missing strings `shurikennumber`, `StrSkillManaCostPerSecond`, `physicaldamagewhilewwdesc`): a new one is a follow-up
for the owner, never a code mapped by guess. `skillcalc: the cut rows change …` means the row cutting lost a column: a generator bug, report it.
The integrity test pins Fire Ball, Blizzard, Fanaticism, Might, Raise Skeleton, Whirlwind, Hellfire Lance, Rift Shot,
Cloak of Shadows and Sharpened Focus (compiler quirks), Weaken and Werewolf (unlisted synergies, ESR 3.3: 72 skills /
234 inputs) and `skillcalc.json` < 450 KB (ESR 3.3: 396,951 bytes). A changed value needs the release diff's formula
change as its source. data-review: in the `skillcalc.json` entry diff, list every skill whose `hiddenOtherLines` /
`hiddenStatLines` rose or that lost a `desc*` line (a class skill must keep per-level lines), and every new
`skillcalc:` warning token (incl. `mastery:`); never map a token by guess. Near 450 KB: report, do not raise the cap.

**Modifiers**: `modifiers.json` regenerates from itemstatcost.txt, properties.txt, propertygroups.txt, every item list
(uniques, set items and bonuses, runewords, gemwords, affixes, qualityitems.txt, gems.txt, cubemain.txt),
difficultylevels.txt, charstats.txt, monstats.txt, misc.txt (the utility potion `len` / `calc1` formulas), skills.txt (the
Attack row's crossbow reload `calc4`) and the D2RLoader plugin configs / patches listed in
`ESR_MODIFIER_CONFIGS` / `ESR_MODIFIER_PATCHES` (`build/esrSources.ts`; `esr:diff` section 6 shows their diffs). The
`facts` are what the /modifiers explanations, the guide's difficulty-penalties table and the calculators quote: **a
changed `facts` entry (a difficultylevels.txt value such as LifeStealDivisor / ResistPenalty, or a TOML value such as
crushing-blow `[targets]`, `cast-rate-cap` `fcr_cap`, `dodge-avoid-evade-cap`, `magic-find-soft-tail`, the
`attack-rating` curve, `crossbow-charges` `damage_base` / `standing_reload_bonus`, the `jeweler` `[[gem_effect]]` stats) means every explanation text quoting it must be re-checked** (`content/modifiers/modifiers.md`:
its `{placeholders}` show the new value on their own, but the prose around them, hard-coded numbers in `facts:` lines
and `open-questions.md` may now be wrong; and the guide notes; list them for the owner). `modifierContent.test.ts`
fails when a placeholder no longer resolves, a content key has no `CONTENT_KINDS` entry or a key kind has no text
(`src/features/modifiers/utils/modifierContentKinds.ts`) and the pinned values in `bundleIntegrity.test.ts` ("committed modifiers
bundle") updated with the release diff as the source. A new `modifiers:` warning is a finding: a key kind naming a stat
ESR removed, an unknown item event function, a missing or changed config key, or a config comment that disagrees with
its value (the value wins; when ESR fixes either side the warning disappears, say which). Expected at 3.3: none (ESR
3.3 corrected the crushing-blow.toml comment to "25 -> 6.25 %", which ended the one 3.2.24 warning). A changed `attack-rating.toml` table or curve
must still pass `modifierMath.test.ts` (it reproduces the table). data-review: in the `modifiers.json` entry diff, list
changed facts with old → new values and the kinds whose stats or item counts changed a lot. The modifier peek's
templates (`src/features/modifiers/data/modifierRefs.json`) regenerate from modifiers.json and modifiers.md with
`game-data:update` / `npm run modifiers:refs`; `modifierRefs.test.ts` fails when they are stale, and
`modifierRefs.integration.test.ts` when an ESR rewording drops a page's linked lines below its bound or links prose (a
new string for a key kind: check the "Modifier peek" coverage). See `docs/features/MODIFIERS.md`.

**Skill information page**: `docs/skill_information.htm` (the official "Mercenary and Oskill Information" page) feeds
skilldetails.json's `infoPage` (hand-written oskill descriptions) and `mercenaries` (`build/skillInfoPage.ts`,
`docs/features/SKILLS.md` "ESR skill information page"). Explain changes of the `skillInfo*` counts (Entries, Names, Skills,
OnlyDescription, MercenaryRows / Skills / Links, Unmatched) with the page's diff (`esr:diff` docs section). A `skilldetails: skill_information.htm … names "<name>": no such skill` warning is a
renamed skill or a new entry whose name differs from the game's: find the skill in skills.txt / the strings and, only
when the match is certain, add it to `NAME_ALIASES` (otherwise report it to the owner); `skillInfoUnmatched` is 0 at
3.3 and the integrity test pins it. "a skills.txt skill not in skilldetails.json" means no item grants that skill
any more: report, no fix.

**Superior affixes**: `bases.json` `superior` / `superiorRows` / `superiorPools` regenerate from qualityitems.txt
(since ESR 3.3 the weights are its `frequency` column; `d2rloader/config/celestialrayone.superior-affixes.toml` keeps the
rules, and its weights table is only the fallback without the column; `build/bundleSuperior.ts`,
`docs/features/GAME-DATA.md` "Superior affixes"). The integrity test checks every row's text and item types and every
item type section against `docs/quality_affixes.htm` (`refs.followed` lists it as `tested`) and pins the 3.3 pools (15,
e.g. Weapon (other types) 37 rows / total 5362). It does not compare the weights: the 3.3 page's Rarity column still
prints the 3.2.24 toml weights by row number (an upstream page issue, asked of the mod author). When ESR fixes the page,
compare the weights again.

**Icons** (`questIcons`, `itemCodeIcons`, `typeIcons`): icons.json `quest` (campaign map quest items), `items` (every
other item by code: Cube, Materials and Enhance cells, the loot filter item browser) and `types` (type ingredients;
broad types have no art by design) grow with new items. A drop means items lost their art: `icons.missing` and
`icons.cube` name them. cube.json `icons` maps each cell text to a token (`i:` code, `t:` type, `u:` / `s:` names).

**Sanctification and D-stoning caps**: enhance.json `sanctification` / `sanctificationOutcomes` /
`sanctificationBonuses` come from cubemain (the `sanctified-dummy` roll row and its `op 18` outcome rows, Lucion's
Relic `u18` on a jewel, since ESR 3.3 also on amulets and rings with the Jeweler perk Hallowed Accessories as
`perkItems`, compared without the marker mods because amulets and rings set `sanctified-jewelry` since 3.3.02;
`build/bundleEnhance.ts`); an `enhance:` warning that the outcome count differs from the roll range, or
another perk / outcome set, is a finding. Anointments are pooled per item type since ESR 3.3 (63 pools, 4,793
equipment outcomes; the 3.2 per-slot pools are gone and saved builds' 3.2 anointments show as outdated, owner decision:
no migration): a new or vanished pool shows in `bundle.enhance` and `builds.crafts`. Since ESR 3.3.03 the Vessel of Souls has no pool of its
own: its tier 4 row sets a fixed `anointed_dummy` (200, enhance.json `storesAnointment`), the "Transform to Mythical … - Anointed" rows turn that into the
weapon's own pool range. Corruption since 3.3.03: one roll row per slot group without a quality (`weap,nru`, `armo,nru`, …) shared by all 8 qualities,
one `op 15` brick row per slot, Body Armor 15 / Belts 18 keep a Low/Normal/Superior variant; `Corruption Legacy Roll` rows are maintenance, hidden. Builds do not store sanctifications. The D-stoning caps (crafting.json `stacking` `cap` /
`capLines`, cube.json rows `dstoneCaps`, the `::dstone-caps` directive) are applied from the rows' `op 16` cap
conditions (`op 15` for light radius) and the earlier `void` `op 15` blockers with the same first input and ingredients (the elemental
Void Shard stops at 300 on those, its own condition reads a stat nothing raises; since 3.3.03 a chain can end on blockers with a last row without a condition,
Blackmoor + Key on armor; `build/cube/dstoneCaps.ts`): a changed cap shows in `bundle.crafting` and
`builds.crafts` (saved builds show the cap next to their D-stoning). A cap condition with another op, or one that
never stops, leaves the D-stoning uncapped with a `crafting: D-stoning "…": …` warning (a finding to explain). The official `docs/special_crafting_outcomes.htm` (corruptions, anointments,
sanctifications) is a cross-check only.

**Standard of Heroes**: enhance.json `standardOfHeroes` / `standardOfHeroesOutcomes` come from the two-input cubemain
rows with output `useitem` adding the hidden `item-upgraded` (`std` plus a unique charm, 12 rows). An `enhance:` warning
about another reagent or a row no longer gated on `item_upgraded` (`op 17`) is a finding; so is a new charm upgrade
outside that shape (Tyrael's Might's four-input rows set the same marker on purpose and are not listed).

Known genuine data, not findings: Sully's template (v0.9.2) validates with 1 warning at 3.3, for the stat-based hide at `rules/99`, which cannot reach unidentified items (`docs/features/LOOT-FILTER.md`; up to v0.7.0 also 6 for `item_addskill_tab` on rules 31–33, gone since its `statMax` formulas), plus the parser's single-number `activeInLevels` warning at `rules/77`; the official `changelogs.html` stopped at 3.2.02 (patch notes live in the
repo's `patchnotes/`); `modinfo.json` in the clone is stale upstream (3.2.09), ignore it.

### Hand-kept data (SKILL step 5.8)

`refs.followed` lists the changed files below; `mapbosses.page` and the integrity tests catch most data moves. Data
files (`src/features/*/data/*.ts`, `content/`) may be edited in step 5; generator constants (under `build/`) only after
the owner's OK.

- **Map bosses** (`docs/endgame_maps.htm`): areas.json `mapBosses` come from levels.txt bosses, monstats and the
  treasure classes (`build/bundleMapBosses.ts`, `build/treasureClassOdds.ts`; `NAME_OVERRIDES` in
  `build/treasureClasses.ts` names ids without a string, such as `diabloclone`), the set drop from
  `celestialrayone.boss-set-unique-drop.toml`. Hand-written in `src/features/campaign-map/data/mapBosses.ts`: fight,
  damage and uber notes and the page's `page` figures. A new or renamed boss fails `campaignMapIntegrity.test.ts`; an
  `areas:` map boss warning (no monstats row, no generic loot roll, a set-drop unique not in uniqueitems.txt) is a
  finding. ESR 3.3.03: 30 known differences (3.3: 49; 3.2.24: 32, owner-checks questions 24–28; 3.3 added the 19 "Alien Artefact
  2% in the files, page: Archaeologist perk only" lines and fixed Herald of Doom's orb and map and Lucion's missing
  terrorized table; 3.3.03 moved the Tier 2–4 key chances and Rathma's and Lucion's map chance in the files). The page's terror
  paragraph is gone since 3.3.03, so the app no longer quotes it: tier 5 shows the files' shards and `terrorUnconfirmed`
  only marks a boss with no terrorized table.
- **Weapon masteries** (`docs/weapon_mastery.html`): masteries.json comes from the cubemain "Apply Awaken Weapon Mastery
  Token" / "Remove Weapon Mastery" rows (grouped by their `weapon-mastery-<weapon>` property since ESR 3.3; "True
  Master" any-weapon rows give the bundle's `anyWeaponPerk`) and the awakened tokens' `u24desc` … `u41desc` strings
  (`build/bundleMasteries.ts`); the Bases page (`codes`), the skill cards and the skill peek read it. Hand-kept:
  `GROUP_RULES` (skills lines naming a group), `LOWER_CASE_MENTIONS`, `HIDDEN_MOD_LABELS` (mods without item text). New
  `masteries:` warnings: "names no <class> skill" → a new group heading (propose a rule); "has no item text" → a label
  (propose); "takes <code>, which cannot get this mastery", "no awaken / remove row takes", a description naming other
  weapons or ingredients → genuine data, a question for the mod author. `bundleIntegrity.test.ts` pins the 20
  specialisations of the page (ESR 3.3 lists the Warlock Void Blade too), the Orb "Spells" skills (the skills whose
  formulas read `weapon_mastery_orb_1`), the 17 families, the knuckle gap and the 6 warnings of 3.3.03. The
  `/weapon-masteries` page reads the same bundle; `build/masteryPage.ts` parses the official page into `pageRules`
  (drop odds), `pageNotes` (footnotes) and `pageDiffs` (the files win; 3 in 3.3.02: Stag Bow, Fend, Orb heading), so a
  reworded page shows in the bundle diff and on the cards: re-read each new difference. Warnings "the formulas of …
  read <stat>, the text does not name them" / "the text names …, whose formulas do not read <stat>" are the mastery's
  skills.txt formulas disagreeing with its text (the page shows the text): a question for the mod author, not a fix here.
  A new page row or heading the parser cannot pair is a `Row "…"` difference. New class weapons without apply rows land
  in `noMasteryBases` (the page's knuckle note).
- **Kill Ledger** (`docs/kill_ledger.htm`): killledger.json comes from cubemain (tiers, the boss rows by `kill-ledger-*`
  marker), monprop `death-skill` rows and the `Just Killed …` skills (which monster sets which `kill_check` value, the
  60 second `auralencalc`), areas.json `mapBosses` and the `leddesc` string (`build/bundleKillLedger.ts`). The page is
  parsed and compared: `pageDiffs` lists every difference (a question for the mod author; the files win).
  `killledger:` warnings: "matches no monster", "unknown boss label", "not in the areas.json map bosses", a page row
  with no boss → a renamed, moved or new boss; check the rows and add it to `bundleIntegrity.test.ts`.
- **Specializations** (`docs/specializations.htm`): specializations.json comes from
  `celestialrayone.specializations.toml` (rules, perk stats and string keys per tree), the strings, misc.txt / cubemain
  (Tesseract, Token of Absolution), the treasure classes (shard drops, perk-gated drops) and the perk plugin configs
  (`celestialrayone.alchemy` / `blacksmith` / `jeweler` / `archaeology.toml`, sections by `perk_stat`)
  (`build/bundleSpecializations.ts`); the perk icons come from `hd/global/ui/specializations/<tree>.sprite`
  (`npm run game-data:icons`). The page is parsed and compared: `bundle.specializations.json` `pageDiffs` lists every
  difference (a question for the mod author; the files win). `PERK_ITEMS` is hand-kept (perks promising an item).
  `specializations:` warnings: "no table or launcher config reads it", "no cubemain row makes", "drop from N monsters
  with no perk condition", "the description says N %, the files …" → genuine data, a question for the mod author; a
  missing config, string or icon sheet → a rename to follow. `bundleIntegrity.test.ts` pins 4 trees × 15 perks, the
  rules, the 9 cube-linked perks, no `pageDiffs` (`docs/specializations.htm` caught up in 3.3.03; a new difference fails the pin: a
  question for the mod author) and no warnings (3.3.02 fixed the
  Elixir of Reincarnation recipe and the Alien Artefacts gate; `PERK_DROPS` stays, because the map boss table prints the
  2% for everyone: the gate sits one treasure class down). Deep Pockets is read by nothing in the files but
  granted by the plugin (mod author), so its `plugin` answer keeps it from warning. The `?tree=&perk=` slugs are linked from the guide and other pages: a renamed perk changes
  its slug (check `content/guide` for `page:/specializations` links).
- **Mercenaries** (`docs/skill_information.htm`, `excel/hireling.txt`): mercenaries.json joins the page's Mercenaries
  table (variants, names) to the Version 100 rows (`build/bundleMercenaries.ts`). Hand-kept: `HIRE_DESC` (page type
  label → `HireDesc`), `FILE_HIRELING` ("Sorcerer" / "Sorceror"), `SUSPECT_DEXTERITY`, the aliases `conduit hireling` /
  `whirlpool hireling` in `NAME_ALIASES`, and in the page's `mercenariesView.ts` `VANILLA_WEAPONS` and `HIRELING_SETS`.
  `mercenaries:` warnings: "only on the page / only in hireling.txt" → a genuine difference, a question for the mod
  author; "unknown type label", "no hireling.txt row", "is on no row of the page", "matches no skill" → a rename to
  follow; "differs between difficulties" → the file stopped repeating a band's stats, so the merge in `buildVariant`
  needs a look; "the suspect dexterity … is gone" → ESR fixed it, drop the `SUSPECT_DEXTERITY` entry.
  `bundleIntegrity.test.ts` pins the 16 variants, hirelings, acts and types, and no warnings. Slugs (`desert-mercenary`,
  `combat`) are linked from the skill cards and the guide.
- **Elixirs** (`docs/specializations.htm` Alchemist perks): elixirs.json comes from misc.txt type `upot`, the
  `Utility Elixir` treasure classes, the Gem Infusion cube rows and `celestialrayone.alchemy.toml`
  (`build/bundleElixirs.ts`; `ESR_ALCHEMY_FILE`, `shrines` in `TABLES`). A changed formula, drop chance or perk fact
  shows in the `elixirs.json` diff; re-read the guide's `elixirs` note and docs/features/ELIXIRS.md against it. New
  `elixirs:` warnings: a line that renders without its value (a stat whose descfunc divides or hides it), a
  ConditionCalc that is no perk check, a missing root class or config → read the change, then propose a rule.
- **Cube page** (`docs/Eastern Sun Resurrected Cube Recipes.html`): `CUBE_SECTIONS` in `build/cube/cubeCatalog.ts` (the
  page's anchors, `notes` rewritten from its footnotes, guide slugs) and `FAMILY_NOTES`. A renamed anchor breaks the
  "Official: <section>" links. The page lagged the files in about 31 places at 3.2.24 (cube audit 2026-11-07), so read
  a page change against the cubemain diff before editing the notes.
- **Modifiers**: `ESR_MODIFIER_CONFIGS` / `ESR_MODIFIER_PATCHES` are `hand-kept` (the prose quotes them); configs that
  `content/modifiers/modifiers.md` cites without the generator reading them (damage-overflow-fix, immunity-dot-clear,
  summon-resist-cap, skill-line-merge, …) show up through the citations.
- **Campaign Maps page, ascendancies**: SKILL steps 5.6 and 5.7.

A new feature that follows an official page or launcher config adds it to `ESR_REFERENCES` (SKILL step 8).

**Questions for the mod author**: page-vs-files differences (`mapbosses.page`, the cube page), genuine data warnings
(`masteries:`, `superior:`, `modifiers:`) and other upstream data bugs are not fixed in the app. The owner keeps them in
"Questions for the mod author" of the latest `owner-notes/owner-checks-*.md` (gitignored) (the owner's file: do not edit it). In the
final report, list new questions ready to paste and the existing ones this release answers (the difference or warning
is gone).

## Review agents (SKILL step 4)

Spawn all three in one message, `model: opus`, `subagent_type: general-purpose`. Each brief starts with: "READ-ONLY
review for the /esr-update of the D2R ESR Runeword Browser at <repo path>, ESR <old> → <new>. Do not edit, stage or
commit anything in the repo or the ESR clone at <clone path>. Write your result to <$S>/<file>. Return findings as
`severity | claim | evidence (file:line, command output) | proposed action`, most severe first; say what you could
not check." Then:

1. **data-review** → `data-review.md`. Read `$S/summary.md`, `$S/diff.txt`, `$S/review.md`, `$S/update.log`,
   `$S/user-data.txt`. Explain every count change, warning, bundle change, id shift, variant shift, craft change and
   test failure with the release diff (table rows, patch notes), and every `refs.followed` and `mapbosses.page` line:
   which hand-kept item needs an edit (file, old → new, the page or config line it comes from). Name what breaks for
   players or saved data and how many public builds / favourites / filters the scan found. Propose the exact integrity-test pin changes and the
   doc-count updates (file, old → new, source of the new number).
2. **guide-review** → `guide-edits.md` plus a unified diff `guide-edits.patch` against `content/guide/`. Read
   `$S/summary.md`, the review's `guide.*` checks, `npm run guide:report`, and every note named there or touching a
   changed system (`grep -rn -i '<term>' content/guide`). Follow "Guide rules" below. Number every edit with a
   one-line description. Do not apply the patch.
3. **external-review** → `external-review.md`. Read the review's `lootfilter.*`, `net.*` and `versions.launcher`
   checks and the release diff's launcher and `LootFilters/` sections. For a newer Sully template: list the upstream
   version, changed rules, new or removed icons and sounds. For dead or moved official URLs: find the new URL on the
   official site (its navigation, `docs/` in the clone) and propose the edit. For a plugin version change: read the
   changed toml / PDF guide and list the evaluator or quirk rules to re-verify in game.

## Applying edits (SKILL step 5)

- **Guide**: `git apply "$S/guide-edits.patch"`, then fix build errors in `content/guide` (never by loosening the
  generator). Keep notes ≤ ~250 words (build warns above 400); new stubs are drafts (no `verified:`), slugs must not be
  reserved (`RESERVED_SLUGS` in `src/features/guide/build/parseNote.ts`: `map`).
- **Pins**: edit the expected numbers in `bundleIntegrity.test.ts` (and other pinned tests the full suite flagged) only
  where the data agent explained them.
- **Docs quoting the old version**: in the files `docs.old-version` lists, replace the version and update the counts
  that come straight from the new manifest or bundles; leave historical statements ("added in 3.2.20") alone; list
  what you could not derive.
- **Sully's template**: download the upstream `Sullys-QoL-Filter.json` verbatim to
  `public/loot-filters/sullys-qol-filter.json`, add or remove the icons / sounds under `public/loot-filters/` to match
  upstream, update `SULLYS_QOL_TEMPLATE.version` / `.credit` in `src/features/loot-filter/utils/template.ts` and the
  version in `docs/features/LOOT-FILTER.md`, then rerun `npm run esr:review -- --offline` (`lootfilter.validate` must
  not gain diagnostics) and `npx vitest run src/features/loot-filter`.
- **Loot filter agent pack** (`public/loot-filters/agent/`: README.md plus the AI help page's FORMAT.md, examples.md,
  assets.md and full game data tables, for AI agents writing filters; `docs/features/LOOT-FILTER.md` "AI help"):
  `game-data:generate` rewrites it from the new `lootfilter.json` / `types.json` and the manifest's ESR version, and
  `game-data --check` and `scripts/lib/lootFilterAgentPack.test.ts` fail when it is stale. After a template, plugin
  version or prompt change run `npm run loot-filter:agent-pack`; commit the pack with the bundles (it carries the ESR
  version, so every release changes it).
- **Official links**: `OFFICIAL_LINKS` / URL constants in `src/core/navigation/navConfig.ts`, `OFFICIAL_REFERENCES` in
  `src/features/guide/utils/guideHome.ts`, `docs:` links in `content/guide`. Community tools: report only.

### Guide rules

- Every fact comes from the release diff, the game files or an existing `_sources.yml` source; no invention.
- Never type a number a directive can provide (`::recipes`, `::source`, `::vendor`, `::secret-recipes`,
  `::difficulty-penalties`, `::dstone-caps`, `::card`); link to the data instead.
- Prose telling the player to farm or find an item may carry one `[label](<dropfinder:Item Name>)` link per paragraph.
- Launcher facts: notes cite launcher plugins and patches (`esr-loader` in `_sources.yml`, e.g.
  `d2rloader/patches/auto-collect-corpse.json`); a changed patch/config changes the note
  (`grep -ln esr-loader content/guide/notes/*.md`).
- Leave `verified:` and `content/guide/.verify-lock.json` untouched.
- Expected `::recipes` shapes: `rune-conversion` (rune-families) has one "Ancient Decal (X -> Y) + X Rune → Y Rune"
  row and one "An LoD rune … → The ES rune and the Ancient Decal" row; `rune-forging` (forging) 3 rows;
  `legendary-consumables` (enhancement-order) shows the Halo as "The same item + A copy of the item (Branded)". At
  3.3 the coupons, noobs-charm, rune-families and socketing (`socket`, 10 → 12 rows with the Archaeologist perk rows)
  blocks sit at the 12-row cap.

## Patch-note check (SKILL step 9)

One entry per line of the release's patch notes (`--init` lists them; the renderer refuses a file that leaves one out).
The output is meant to be passed on, including to the mod author, so write it for someone without this repo: file names
and values, no app internals, no player or account names.

| Verdict         | Use it when                                                                             |
| --------------- | --------------------------------------------------------------------------------------- |
| `confirmed`     | the tables, strings or configs show the change (name the file, row and old → new value) |
| `partial`       | something changed, but less, more or other than the line says                           |
| `differs`       | the files show something else                                                           |
| `not-found`     | the files that should carry it did not change                                           |
| `not-checkable` | it lives in plugin binaries or the game client, or the line cannot be read; say why     |

Compare file hashes before calling a plugin fix unverifiable or confirmed (`git diff --stat <old> <new> -- 'd2rloader/plugins/*.dll'`).
`unlisted`: player-relevant table, string or config changes no line explains, from the data review; skip disabled rows.
`docsLag`: official pages still showing old values (`docs.lag`, `pageDiffs`, `mapbosses.page`). `notChecked`: at least
"not tested in game" and any changed binaries. Never resolve a patch note ambiguity by guessing; report it.

## Commits (SKILL step 7)

1. `chore(game-data): update to ESR <version>`: `public/game-data/`, `public/guide/`, `public/sitemap.xml`, the
   integrity-test and other pin updates, the doc version/count updates.
2. `docs(guide): <what changed> for ESR <version>`: `content/guide/` and the regenerated `public/guide/`.
3. `chore(loot-filter): refresh Sully's QoL template to v<x>`: the template, its assets, `template.ts`, the docs.
4. `fix(nav): update moved official ESR links`: link fixes.
5. `chore(loot-filter): bump the loot filter plugin version to <x>`: only after approval.
6. `chore(esr-update): …`: skill or review-script edits, only after approval.

The game-data commit stages ~1,700 icon files at most; the hooks skip `public/game-data` for Prettier, the size guard
and gitleaks, and the exiftool check takes a few seconds.

## When things go wrong

- **ESR clone dirty or on another branch**: the update aborts. Show `git -C <clone> status`; ask before cleaning or
  checking out. Untracked `.DS_Store` files are ignored.
- **Tag not found**: confirm the name (`git ls-remote --tags origin` in the clone; no `v` prefix).
- **Release diff empty or a revision missing**: the clone is shallow; esr:diff and esr:review fetch the old revision
  on demand. If that fails, ask before `git fetch --unshallow`.
- **Vanilla art folder missing**: icons.json keeps the old `esrVersion`, so `game-data --check`, the icon check and
  `bundleIntegrity.test.ts` fail. Only `npm run game-data:icons` with the folder fixes it; never hand-edit icons.json.
- **New generator warnings** (string conflicts, duplicate bases, unresolved stats, `affix stats: property … is not
mapped`, `lootfilter skills:`, `stash:`, `itemtext:`, `skillcalc:` missing strings, `skilldetails: skill_information.htm`): find the rows in the table diff and explain
  them; a parser gap is a follow-up, not a silent code fix.
- **Integrity test fails**: if the release diff explains the new count, update the pin (step 5); otherwise
  investigate. It also pins `r48` Fu Rune as the only spawnable item that never drops, disabled uniques 0 and 690–695,
  the five map tiers at 4 zones on the 100–108 ladder, The Hidden Vault, the five towns, and every cube family keeping
  a row; it compares all bundles with a fresh build.
- **runtimeConstants.test.ts fails**: a stat id or descfunc the stash parser, stat text or loot filter hard-codes
  moved: report it with the release diff; the fix is app code (ask).
- **Other tests fail** (data-sync parsers on the new HTM fixtures, loot filter, builds, stash, guide): compare with
  `test-fixtures/previous/` (the pre-3.3 layout tests read the frozen `test-fixtures/layout-3.2.24/` instead, which
  `npm run test:fixtures` writes once and the update never rotates); a renamed item in the docs vs the tables is a data mismatch to report, not to hide. Stash
  fixture tests skip without the owner's `.d2i` in `test-fixtures/stash/`: say so.
- **`game-data --check` / `guide:check` fails after a rerun**: non-deterministic output; report it.
- **Guide build errors**: unknown `rw:`/`unique:`/`socketable:`/`base:`/`dropfinder:` target or `::source` name → use
  the new name from the strings diff (add `{item=…}` when ambiguous); unknown `::recipes` family → the cubemain
  description changed, report it; dead `docs:` anchor → find the new anchor in the changed docs page; unknown `:term`
  → add it to `_glossary.yml` or fix the spelling.
- **A pre-commit hook fails**: fix the cause (formatting, a flagged secret, metadata, a file over 2 MB outside
  `public/game-data`); never `--no-verify`.
- **esr:user-data exits 2**: no network or `.env.production`; say "user-data impact not checked".

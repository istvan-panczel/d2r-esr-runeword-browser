# Feature research: loot filter editor

Status: **building** (unblocked 2026-10-11 by the author's guide, section 4). Branch `feat/loot-filter`.
ESR at the time of research: 3.2.12 (loot filters exist since 3.2.09).

> **2026-10-11:** the mod author supplied the "ESR Loot Filter Guide" ([PDF in the ESR repository](https://github.com/CelestialRayOne/Eastern_Sun_Resurrected/blob/main/LootFilters/ESR%20Loot%20Filter%20Guide.pdf),
> Markdown copy in `builds-feature-docs/loot-filter/`), an updated `sullys-qol.json` (302 rules, 12 named styles), the sound files and
> the `goldstar` minimap sprite. The guide is the authoritative schema and supersedes sections 2.3, 3 and 3.1 below,
> which are kept as history. Section 4 records which questions it answers; section 5 holds the updated decisions.

## 1. The question

ESR supports its own loot filters (beyond the native D2R one that came with the Warlock update). The owner wants a
page where a player can create a filter from scratch or upload an existing one, edit it with real item names and
colours, keep several filters in the browser and download the result for the ESR Launcher.

## 2. What exists today

### 2.1 ESR's loot filter (since 3.2.09)

- A D2RLoader plugin (`d2rloader/plugins/d2rl-celestialrayone-loot-filter.dll`, author Celestialray) reads JSON filters.
  The launcher's **Loot Filter** tab imports a `.json`, copies the mod's filters to the player's folder, and keeps the
  selection in `selection.json`. Edits apply while the game runs. Patch note 3.2.09: "Added loot filter support in the
  ESRLauncher. I took the liberty to convert Sully's filter."
- Folders: shipped filters in `<game>\mods\<mod>\LootFilters\`; the player's own in
  `<Saved Games>\Diablo II Resurrected\mods\<mod>\LootFilters\`; sounds in a `sounds` folder next to the filter.
- Keys (Options > Controls > Loot Filter): _Next Filter Level_, _Show Hidden Items_. Console: `lootfilter`,
  `lootfilter reload`. Hidden items keep no ground label but stay on the ground and can be picked up.
- Config `d2rloader/config/celestialrayone.loot-filter.toml`: `enabled`, `default_filter`, `user_folder`,
  `file_sound_volume`, `announce`, `hidden_marker`.
- **There is no published schema.** Everything below is inferred from the one shipped filter
  (`LootFilters/sullys-qol.json`, 353 rules, 242 KB) and the comment block in the toml. The plugin DLL is closed.
- The file is JSON **with `//` comment lines** at the top (JSONC); a strict `JSON.parse` fails on it.

### 2.2 The Chinese fork (`AreChen/d2r-esr-runeword-browser-zh`, `/loot-filter`)

- Edits the **D2RLAN Lua format** (`lootfilter_config.lua`: `filter_titles`, `audioPlayback`, `notify`, `prefix`,
  `{gold}` colour tags), not the ESR JSON. Its parser is a Lua-table scanner that keeps the source text and patches
  the edited values back in; it downloads Lua again.
- UI worth borrowing: one rule list with per-rule edit panel, style presets, label preview rendering the colour codes,
  optional mp3 upload to preview sounds, filter source persisted in `localStorage`.
- Not reusable as code for our target format, but a good UX reference.

### 2.3 The D2RLAN loot filter guide and engine (the ancestor of ESR's format)

Owner-supplied link: https://locbones.github.io/D2RLAN-LootFilterGuide/ (Lua format; "not guaranteed to be 100%
accurate or complete"). Engine source: `lootfilter.lua` in https://github.com/locbones/D2RLAN-Filters (1449 lines,
read 2026-10-10). ESR's JSON is the mod author's conversion of Sully's Lua filter for this engine, so the guide
documents the **semantics** and the engine confirms them; it does not name ESR's JSON keys.

Engine facts that matter for the editor (from `lootfilter.lua`):

- Rules run **in order; every matching rule applies**. Name edits accumulate: `name_override` replaces the name built
  so far, `prefix`/`suffix` wrap it, so a later rule can add a suffix to an earlier override. Background, border and
  styles are last-wins. `hide` sticks once set. A rule with conditions only is a no-op (apart from debug output).
- Missing `filter_levels` = active in every level. Missing `location` = `onground` only; the four values are
  `onground`, `onplayer` (= stored), `equipped`, `atvendor`. Actions apply only when the item is in a listed location.
- Quality is 1–9 (Low, Normal, Superior, Magic, Set, Rare, Unique, Crafted, Tempered); rarity 0–2 (normal,
  exceptional, elite). Numeric conditions accept a number, a list, `"3+"` / `"3-"` strings, `NOT{}`, `OR{}` and
  `between` for stats.
- Stat conditions are `{index, op, value, param?}`; `pstat` reads the player (index 12 = level). A list is AND;
  `OR { ... }` is any-of.
- `audio`: a file name ending in .mp3/.flac/.wav is played, any other text is spoken by TTS. Only when
  `audioPlayback` is on.
- Placeholders: `{code}`, `{ilvl}`, `{rarity}`, `{quality}`, `{name}`, `{ethereal}`, `{sockets}`, `{index}`,
  `{itype}`, `{maxsock}`, `{stat=(id,param)}`, `{pstat=(id)}`, `{link}` (notify only). Colour tags `{gold}` etc. map
  to `ÿc?` codes. `$` is **not** special in this engine.
- Conditions the engine has beyond Sully's usage: `ilvl`, `index` (unique/set id), `itype`, `ethereal`,
  `identified`, `grail`, `difficulty`, `area` (positive and `NOT`), `maxsock` with operators.

### 2.4 What our app already has

- `public/game-data/bases.json`: every weapon/armor base with its 3-letter `code`, type ancestors and tier.
- `public/game-data/sources.json`: unique / set / misc items with `code` (the base code for uniques and sets).
- ESR clone tables not yet bundled but available: `misc.txt` (runes, gems, charms, materials, scrolls, maps),
  `itemstatcost.txt` (stat ids such as 96 FRW, 93 IAS, 105 FCR, 14 gold, 188 skill tab), `levels.txt` (area ids such as
  1, 40, 75, 103, 109 = the towns), `itemtypes.txt`.
- `usePersistentState` for browser storage; Supabase builds feature as a model for later cloud sharing.

## 3. The format as observed (Sully's QoL, formatVersion 1)

Top level: `formatVersion` (1), `title`, `author`, `version`, `description`, `filterLevels` (`[{id, name}]`, four
levels: Leveling, Strict, Very-Strict, Uber-Strict), `defaultLevel`, `rules[]`.

Rule matchers (all optional; a rule with none matches everything, one such rule exists):

| Key                             | Shape seen                                                                      | Note                                    |
| ------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| `itemCodes`                     | `string[]`                                                                      | base codes from weapons/armor/misc      |
| `quality`                       | `"unique"\|"set"\|"rare"\|"magic"\|"superior"\|"normal"\|"inferior"` or `{max}` | `{min}` presumably also works           |
| `baseTier`                      | `0\|1\|2` or `{max}`                                                            | 0 normal, 1 exceptional, 2 elite        |
| `sockets`                       | number or `{min}`/`{max}`                                                       |                                         |
| `isRuneword`, `isFullySocketed` | boolean                                                                         |                                         |
| `itemStats`                     | `[{stat, op, value, param?}]`                                                   | all must hold; `op` is `>=`, `<=`, `==` |
| `itemStatsAnyOf`                | same                                                                            | any may hold                            |
| `playerStats`                   | `[{stat, op, value}]`                                                           | stat 12 = character level               |
| `location`                      | subset of `stored`, `atVendor`, `equipped`, `onGround`                          |                                         |
| `excludeAreas`                  | `number[]`                                                                      | level ids                               |
| `activeInLevels`                | `number[]`                                                                      | filter level ids; absent = all levels   |

Rule actions (57 rules have matchers only, so an action-less rule is legal; it probably stops lower rules or is a no-op):

| Key                                       | Shape seen                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `hide`                                    | `true`                                                                                                                         |
| `replaceName`, `namePrefix`, `nameSuffix` | string with `ÿc?` colour codes, `\n` line breaks, placeholders                                                                 |
| `chatMessage`                             | string                                                                                                                         |
| `sound`                                   | file name in `sounds/` (`gong.mp3`, `map.mp3`, `mid.mp3`, `mythical.mp3`, `other.mp3`, `t5_map.mp3`, `tink.mp3`, `unique.mp3`) |
| `labelBackground`                         | `[r, g, b, a]`                                                                                                                 |
| `labelBorder`                             | `{color: [r, g, b, a], width}`                                                                                                 |

Placeholders seen: `{name}`, `{sockets}`, `{baseTier}`, `{stat:N}`. Colour codes seen: `ÿc0`–`ÿc6`, `ÿc8`, `ÿc9`,
`ÿc;`, `ÿcA`, `ÿcP` (the D2 colour-code set). A name of `$$` appears in `replaceName` (meaning unknown; it may stand
for "the original name" in the converter's output).

### 3.1 Lua → ESR JSON mapping (derived by comparing the guide with Sully's converted file)

| D2RLAN Lua                                                                     | ESR JSON                                                        | Note                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ |
| `code` / `codes`                                                               | `itemCodes`                                                     | `"allitems"` → rule without `itemCodes`                |
| `quality` 1–9                                                                  | `quality` name or `{max}`                                       | crafted/tempered never appear in the sample            |
| `rarity` 0–2                                                                   | `baseTier` or `{max}`                                           |                                                        |
| `sockets`                                                                      | `sockets` or `{min}`/`{max}`                                    |                                                        |
| `runeword`, `maxsock`                                                          | `isRuneword`, `isFullySocketed`                                 |                                                        |
| `stat` list / `OR{}`                                                           | `itemStats` / `itemStatsAnyOf` with `{stat, op, value, param?}` | `index` → `stat`                                       |
| `pstat`                                                                        | `playerStats`                                                   |                                                        |
| `filter_levels`                                                                | `activeInLevels`                                                | absent = all                                           |
| `location`                                                                     | `location` (`stored`, `atVendor`, `equipped`, `onGround`)       | `onplayer` → `stored`                                  |
| `NOT area{}`                                                                   | `excludeAreas` (ids)                                            | names → level ids                                      |
| `name_override`, `prefix`, `suffix`                                            | `replaceName`, `namePrefix`, `nameSuffix`                       | colour tags → raw `ÿc?`                                |
| `notify`                                                                       | `chatMessage`                                                   |                                                        |
| `audio`                                                                        | `sound`                                                         | file names only in the sample                          |
| `background` `{r,g,b,a}`                                                       | `labelBackground` `[r,g,b,a]`                                   |                                                        |
| `border` `{r,g,b,a,width}`                                                     | `labelBorder` `{color:[r,g,b,a], width}`                        |                                                        |
| `hide`                                                                         | `hide`                                                          |                                                        |
| `{stat=(96)}`, `{rarity}`                                                      | `{stat:96}`, `{baseTier}`                                       | placeholder spellings differ                           |
| `name_style`, `prefix_desc`, `suffix_desc`, `background_style`                 | dropped                                                         | "rainbow names and tooltip lines are not carried over" |
| `filter_titles`, `filter_level`                                                | `filterLevels` `[{id, name}]`, `defaultLevel`                   |                                                        |
| `reload`, `debug`, `allowOverrides`, `language`, `audioPlayback`, `audioVoice` | none                                                            | launcher config instead                                |

Still unknown for the **ESR plugin** specifically (the engine above is the Lua one, ESR's DLL is a reimplementation):
whether it keeps the "all matching rules apply, in order" semantics; whether `{min}` works on `quality` and
`baseTier`; whether JSON equivalents exist for `ilvl`, `index`, `itype`, `ethereal`, `identified`,
`difficulty`, positive `area`, `between` and `NOT`; what `$` means in `replaceName` (not special in D2RLAN, so
likely a converter artefact or an ESR addition); whether the leading `//` comments and unknown keys are tolerated;
whether `sound` also accepts `sounds.txt` entries or TTS text.

## 4. Questions for the mod author (to send)

> Hi, I'm building a loot-filter editor into the ESR Runeword Browser (web app) so players can create or upload a
> filter and edit it with item names, colour pickers and a label preview, then download the JSON for the launcher.
> I only have `sullys-qol.json` and the toml comment to go on. Could you share, or point me at, the plugin's filter
> schema? Specifically:
>
> I know the D2RLAN guide (locbones) and its `lootfilter.lua`, and I see your JSON is a conversion of it. Could you
> confirm or correct these points for your plugin?
>
> 1. Does it keep D2RLAN's semantics: rules run in order, every matching rule applies, name edits accumulate,
>    background/border last-wins, `hide` sticks, missing `location` = on ground only?
> 2. Which JSON keys exist beyond Sully's file? In particular equivalents of `ilvl`, `index` (unique/set id),
>    `itype`, `ethereal`, `identified`, `difficulty`, a positive `areas` list, `between` and `NOT`.
> 3. Do `{min}` / `{max}` objects work on every numeric matcher (`quality`, `baseTier`, `sockets`, stats)?
> 4. Placeholders: `{name}`, `{sockets}`, `{baseTier}`, `{stat:N}` are in Sully's file. Are `{code}`, `{ilvl}`,
>    `{quality}`, `{ethereal}`, `{index}`, `{stat:N:param}` supported, and what does `$` mean in `replaceName`?
> 5. `sound`: only files from `sounds/`, or also `sounds.txt` entries or TTS text?
> 6. Are the leading `//` comment lines part of the format, are unknown keys ignored or rejected, and will
>    `formatVersion` 1 stay stable?
> 7. Is it okay to offer Sully's filter and the shipped mp3 files as templates inside the app, with credit?
>    Happy to share the editor for testing before release.

Where to ask: the ESR Discord (linked from easternsunresurrected.com) or a GitHub issue on
`CelestialRayOne/Eastern_Sun_Resurrected`.

### 4.1 Answers (the guide of 2026-10-11)

1. Semantics: every matching rule applies, top to bottom, until one hides the item. Later wins for background, border,
   name change, icon and droplight; chat lines and sounds add up; `hide` stops; `hideIfOtherConditionsFail` hides when
   codes/types/location match but another condition fails; missing `location` = `onGround`; styles hold actions only
   and the rule's own actions win over `useStyle`. A rule with an error is switched off and logged.
2. Keys beyond Sully's file: `itemTypes`/`excludeItemTypes`, `itemLevel`, `maxSockets`, `isEthereal`, `isIdentified`,
   `uniqueOrSetIds`/`excludeUniqueOrSetIds`, `playerStatsAnyOf`, `difficulty`, `areas`, `excludeItemCodes`; ops `!=`,
   `>`, `<` and `between` (`value: [low, high]`); actions `chatMessageWhenHidden`, `notify`, `soundVolume`, `icon`,
   `droplight`, `useStyle`, `comment`; top level `updateUrl`, `hideUnmatchedItems`, `soundVolume`, `notifications`,
   `qualityColors`, `styles`.
3. Numbers take one value, a list or `{ "min", "max" }`; named values take the name or its number.
4. Placeholders: `{name}`, `{code}`, `{quality}`, `{baseTier}`, `{itemLevel}`, `{sockets}`, `{maxSockets}`,
   `{ethereal}`, `{uniqueOrSetId}`, `{qualityColor}`, `{stat:ID[,PARAM]}`, `{playerStat:ID[,PARAM]}`, `{string:KEY}`,
   `{link}` (chat only), `{level}`/`{filter}` (level change line). `$$` is not special: Sully's file renames gold to
   the literal text `$$`.
5. `sound`: a sounds.txt name or row number, or a .wav/.mp3/.flac file in the filter's `sounds` folder.
6. `//` comments are allowed anywhere; `formatVersion` is always 1. Whether unknown keys are ignored or rejected is
   not stated; the editor preserves them and reports them as warnings.
7. Bundling Sully's filter, the sounds and the goldstar icon: okay given (owner, 2026-10-11).

Still implicit in the guide: the editor implements these as assumptions (engine file headers in `engine/evaluate.ts`,
`engine/parse.ts`, `engine/validate.ts`). The full list to check in game is kept in one place:
[LOOT-FILTER.md, "Verify in game"](../docs/features/LOOT-FILTER.md#verify-in-game).

## 5. Decisions (owner, 2026-10-10)

| Topic           | Decision                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Format          | ESR launcher JSON only. No D2RLAN Lua (a converter may come later).                                           |
| Storage         | Browser only (`localStorage`) plus download/upload. Cloud sharing not now.                                    |
| Editor          | Rule builder with pickers and a label preview, plus a synced raw JSON tab.                                    |
| Starting points | Blank filter, or upload. Nothing bundled (no Sully's, no presets).                                            |
| Rule scope      | Every key seen in Sully's filter, in phase 1.                                                                 |
| Sounds          | File-name field with the 9 known names as suggestions; optional local mp3 upload to preview. Nothing bundled. |
| Spec risk       | ~~Ask the mod author first; the build waits for the answer.~~ Answered 2026-10-11 (section 4.1).              |
| Library         | Several named filters per browser: create, upload, duplicate, rename, delete.                                 |

### 5.1 Updated decisions (owner, 2026-10-11)

| Topic           | Decision                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Rule scope      | Form controls for **everything in the guide** (conditions, actions, styles, settings, notifications...).     |
| Starting points | Blank, upload, or **Sully's QoL as a bundled template** (credited; author's okay given).                     |
| Sounds          | The 9 mp3 files ship under `public/loot-filters/sounds/` for in-browser preview; sounds.txt names listed.    |
| Icons           | `.sprite` files are decoded in the browser for preview; `goldstar` ships under `public/loot-filters/icons/`. |
| Languages       | Forms edit plain strings (or enUS); per-language objects are preserved and edited in the JSON tab.           |
| Tester          | A "test item" evaluator with a rule trace ships in phase 1 (engine `evaluate.ts`).                           |
| Cadence         | Engine → data bundle → library/shell → rule builder/preview → tester → docs; commit per phase after review.  |

## 6. Design sketch (for when the answers arrive)

- Route `/loot-filters` (library) and `/loot-filters/:id` (editor), header entry "Loot filters". Uses only the static
  bundles, so it bypasses the HTM loading gate like `/guide`.
- Feature folder `src/features/loot-filter/`: `engine/` (schema types, JSONC parse that keeps unknown keys and reports
  them, serialize with stable key order, validation with per-rule diagnostics), `build/` (new bundles generated from
  the ESR clone: misc item codes with names, stat ids with names, area ids with names; added to `game-data:generate`),
  `components/` (rule list, matcher editors with item pickers by name, action editors, colour picker, label preview
  rendering `ÿc` codes, sound field), `screens/` (library, editor), `hooks/` (persistent library).
- Unknown keys travel untouched from upload to download and show as "not editable here".
- Tests: parser round-trip on Sully's filter (byte-stable apart from comments), validation cases, preview rendering.
- Phase 2 candidates: Lua import, cloud save and sharing, presets, bundled sounds (needs the author's okay).

## 7. How to resume (for whoever picks this up)

> Superseded on 2026-10-11: the build is under way. Current state and the phase table live in
> `docs/features/LOOT-FILTER.md`; the steps below are the pre-build checklist, kept for history.

1. `git checkout feat/loot-filter` (branched from master at v1.16.0, commit 50cffbd). Rebase or merge master first if
   releases happened meanwhile; the branch holds only this document so far.
2. Read this file top to bottom, then the mod author's answer (paste it into section 4 below the questions, with the
   date). Update section 3 and 3.1 with confirmed keys and semantics; move anything still unknown into a short
   "assumed" list.
3. Re-check the ESR clone for format changes: `grep -n -i 'loot' ../Eastern_Sun_Resurrected/patchnotes/*.md`,
   `git -C ../Eastern_Sun_Resurrected log --oneline -- LootFilters d2rloader/config/celestialrayone.loot-filter.toml`,
   and whether `formatVersion` in `LootFilters/sullys-qol.json` is still 1.
4. Reference material is not committed (external code): the D2RLAN engine is
   `https://raw.githubusercontent.com/locbones/D2RLAN-Filters/main/lootfilter.lua` (rule loop around lines 980–1440,
   placeholders around 620–660); the guide is https://locbones.github.io/D2RLAN-LootFilterGuide/.
5. Build per section 6 under the decisions in section 5, with opus agents for implementation and review as on the
   guide feature. Start with the engine (JSONC parse with pass-through, serialize, validate) and its round-trip test on
   Sully's file, then the data bundles, then the library screen, then the rule builder and preview.
6. The owner tests the downloaded JSON in-game through the ESR Launcher's Loot Filter tab (Import filter) and can use
   the `lootfilter` console command to see problems the plugin reports.

## 8. Sources

- ESR repo: `LootFilters/sullys-qol.json`, `d2rloader/config/celestialrayone.loot-filter.toml`, `patchnotes/3.2.09.md`,
  `d2rloader/metadata.json` (D2RLoader 1.3.1).
- Fork: `../d2r-esr-runeword-browser-zh/src/features/loot-filter/` (parser, presets, preview, screen).
- D2RLAN guide https://locbones.github.io/D2RLAN-LootFilterGuide/ and engine
  https://github.com/locbones/D2RLAN-Filters (`lootfilter.lua`, `lootfilter_template.lua`); Sully's original Lua filter
  is not in that repo and not findable publicly.
- Web searches for a D2RLoader filter spec found nothing relevant (only Median XL, PD2, PoD and native D2R filter pages).

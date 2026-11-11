# ESR loot filter format

The JSON file format of ESR's loot filter plugin (1.8.2), as the D2R ESR Runeword Browser reads and checks it. Game data: ESR 3.3.04. A filter is one JSON object: a few settings, optional styles, then the rules.

## A complete file

```json
// My ESR filter, written with an AI assistant and checked in the D2R ESR Runeword Browser.
{
  "formatVersion": 1,
  "title": "My ESR filter",
  "author": "Me",
  "version": "1.0.0",
  "description": "Highlights high runes; hides potions at Strict.",
  "filterLevels": [
    {"id": 1, "name": "Leveling"},
    {"id": 2, "name": "Strict"}
  ],
  "defaultLevel": 1,
  "soundVolume": 50,
  "notifications": {"dropFormat": "ÿc4Drop: {qualityColor}{name}"},
  "styles": {
    "Valuable": {
      "labelBorder": {"color": [255, 0, 0, 255], "width": 2},
      "sound": "tink.mp3",
      "icon": {"iconName": "goldstar", "iconSize": 40},
      "droplight": {"color": [255, 128, 0]}
    }
  },
  "rules": [
    // ==== Show ====
    // Label rules first: later rules change the looks of earlier ones.
    // ---- Runes
    {
      "itemCodes": ["r76", "r77", "r78", "r79", "r80", "r81", "r82", "r83"],
      "chatMessage": "ÿc8High rune: {name}",
      "useStyle": "Valuable",
      "comment": "High runes (Vex to Zod): Valuable style and a chat line"
    },

    // ==== Hide ====
    // Narrow hide rules last, each with its own exceptions.
    {"itemTypes": ["hpot", "mpot"], "activeInLevels": [2], "hide": true, "comment": "Hide health and mana potions (Strict only)"}
  ]
}
```

## Top-level keys

| Key | What it is |
| --- | --- |
| `formatVersion` | Always 1. Required. |
| `title` | The filter name the launcher shows. |
| `author` | Shown in the launcher. |
| `version` | Shown in the launcher, e.g. "1.0.0". |
| `description` | One or two sentences the launcher shows. |
| `updateUrl` | Where newer copies are published. Leave it out. |
| `filterLevels` | Strictness levels, `[{ "id": 1, "name": "Leveling" }, { "id": 2, "name": "Strict" }]`; whole-number ids, unique. A name is a string or a per-language object like any text. |
| `defaultLevel` | The level id a new player starts on; must be one of the filterLevels ids. |
| `hideUnmatchedItems` | `true` hides every ground item no rule matched. Very strict; leave it out unless the user wants it. |
| `soundVolume` | 0 to 100: the volume for rules that set none. |
| `notifications` | `{ "dropFormat": text, "levelChangeFormat": text }`: the drop line `notify` prints and the level change line. |
| `qualityColors` | Name colour per quality, `{ "magic": "ÿc3" }`; keys `inferior`, `normal`, `superior`, `magic`, `set`, `rare`, `unique`, `crafted`, `tempered`, values one colour code. |
| `styles` | Named sets of actions, `{ "Valuable": { …actions… } }`; rules pull one in with `useStyle`. Styles hold actions only. |
| `rules` | The list of rules, applied top to bottom. Required. |
| `disabledRules` | The app keeps switched-off rules here as `[{ "at": <index>, "rule": {…} }]`; the plugin ignores it. Do not write it unless the user asks. |

## How rules combine

- Every rule whose conditions all hold applies, top to bottom, until one hides the item.
- All conditions of a rule must hold (AND); values inside one list are alternatives (OR): `"itemCodes": ["r30", "r31"]` matches either.
- `itemCodes` and `itemTypes` both apply: a code that is not of a listed type never matches.
- Later wins: a later rule's name change, background, border, icon or droplight replaces an earlier one's. Chat lines and sounds add up.
- `hide` stops: nothing after the hiding rule runs, and the highlights of the rules above it are gone too.
- `show` protects: after a rule with `"show": true` matches, later rules cannot hide the item (`hide`, `hideIfOtherConditionsFail`, `hideUnmatchedItems`); their colours, names, sounds and chat lines still apply. Put the show rules for what must never be hidden (high runes, uniques) first, then the broad hide rules. A rule cannot both show and hide.
- Order matters for the looks too: put broad looks first and the specific ones after them (later wins).
- A rule with an error is switched off by the game (logged with its number); the rest of the filter works.
- Rules look at ground items unless `location` says otherwise. Labels, icons and droplights show on ground items only.
- Styles: `useStyle` pulls in a style's actions; the rule's own actions win key by key. Styles cannot hold conditions or use another style.
- Levels: the player steps through `filterLevels` with a key in game. `activeInLevels` limits a rule to some levels: a hide rule at `[2, 3]` hides only at the stricter levels. Typical levels: 1 Leveling (shows most), 2 Strict, 3 Very strict, each hiding more.

## Conditions

Numbers take one value (`5`), a list of alternatives (`[1, 2]`) or an inclusive range (`{ "min": 3, "max": 5 }`, either end optional); named values take the name or its number in the same three shapes.

| Key | Value | Holds when |
| --- | --- | --- |
| `itemCodes` | item codes, e.g. `["r51", "uap"]` (items.csv, bases.csv) | the item's code is listed |
| `excludeItemCodes` | item codes | the item's code is not listed |
| `itemTypes` | item type codes, e.g. `["rune", "weap"]` (item-types.csv) | the item is of a listed type or of a child type of one |
| `excludeItemTypes` | item type codes | the item is of none of them (child types included) |
| `quality` | `inferior`, `normal`, `superior`, `magic`, `set`, `rare`, `unique`, `crafted`, `tempered` (1 to 9); the name or its number; one, a list or { "min", "max" } | the item's quality matches |
| `baseTier` | `normal`, `exceptional`, `elite` (0 to 2); the name or its number; one, a list or { "min", "max" } | the base tier matches; items without a tier family (rings, amulets, charms, jewels, misc) may not match, not verified |
| `itemLevel` | 0 to 999; one number, a list of alternatives or { "min", "max" } | the item level matches |
| `sockets` | 0 to 99; one number, a list of alternatives or { "min", "max" } | the sockets the item has now match |
| `maxSockets` | 0 to 99; one number, a list of alternatives or { "min", "max" } | the most sockets its base can have matches (for bases the player sockets later) |
| `isFullySocketed` | true or false | the item is (not) fully socketed |
| `isEthereal` | true or false | the item is (not) ethereal |
| `isIdentified` | true or false | the item is (not) identified |
| `isRuneword` | true or false | the item is (not) a runeword |
| `uniqueOrSetIds` | unique or set row ids, e.g. `[418, 973]` (uniques-sets.csv) | the unique or set item is listed |
| `excludeUniqueOrSetIds` | unique or set row ids | the unique or set item is not listed |
| `itemStats` | stat checks | every check holds for the item (AND) |
| `itemStatsAnyOf` | stat checks | at least one check holds for the item (OR) |
| `playerStats` | stat checks | every check holds for the player's character |
| `playerStatsAnyOf` | stat checks | at least one check holds for the player's character |
| `formula` | a formula text (see "Formulas"), e.g. `"stat('item_fastercastrate') >= 10"` | the formula is not 0 |
| `location` | a list of `onGround`, `stored`, `equipped`, `atVendor` | the item is there; without the key a rule looks at onGround only |
| `difficulty` | `normal`, `nightmare`, `hell` (0 to 2); the name or its number; one, a list or { "min", "max" } | the game's difficulty matches |
| `areas` | area ids, e.g. `[39]` (areas.csv) | the player is in one of those areas |
| `excludeAreas` | area ids | the player is in none of those areas |
| `activeInLevels` | filter level ids, e.g. `[2, 3]` | the filter is at one of those levels; without the key the rule works at every level |

## Stat checks

A stat check is `{ "stat": "item_fastercastrate", "param": 0, "op": ">=", "value": 10 }`.

- `stat`: an itemstatcost name (stats.csv `name`) or its id as a number (never a quoted number).
- `op`: `==`, `!=`, `>`, `>=`, `<`, `<=`, `between`; `>=` when left out. `between` takes `"value": [low, high]`, every other op one number.
- `param`: only for stats with one entry per skill, skill tab or class (stats.csv `param` column). Without it the plugin reads the entry with param 0, not "any".
- An item without the stat reads 0 (verified in game), so `"op": "<", "value": 1` means "does not have it".
- `itemStats` needs every check (AND), `itemStatsAnyOf` any one (OR). For "A or B, and C" put C in `itemStats` and A, B in `itemStatsAnyOf`: both lists must hold.
- `playerStats` / `playerStatsAnyOf` check the character (e.g. `{ "stat": "level", "op": "<", "value": 30 }`).

Stats whose param names a skill, skill tab or class:

- `item_addskill_tab`: param = the skill tab, class × 8 + tab (skill-tabs.csv; Amazon Bow and Crossbow Skills = 0, Sorceress Fire Skills = 8, Assassin Martial Arts = 50). Not the properties.txt numbering (class × 3 + tab).
- `item_addclassskills`: param = the class id 0 to 7 (classes.csv).
- `item_singleskill`, `item_nonclassskill`, `item_nonclassskill_display`, `item_aura`, `item_aura_display`: param = the skill id (skills.csv).
- `item_skillonattack`, `item_skillonkill`, `item_skillondeath`, `item_skillonhit`, `item_skillonlevelup`, `item_skillongethit`, `item_skilloncast`, `item_skillontakedmg`, `item_skillonattack_hidden`, `item_skillonkill_hidden`, `item_skillonhit_hidden`, `item_skillongethit_hidden`, `item_skilloncast_hidden`, `item_skillontakedmg_hidden`: param = skill id × 64 + skill level (skill 54 level 10 = 3466).
- `item_charged_skill`: param = skill id × 64 + skill level; its value is the skill level of the charges: check `>= 1` for "has charges".

## Formulas

`formula` is a condition that holds when its formula is not 0, written like a txt calc and checked when the filter loads. A bad name or bad syntax switches the rule off.

```json
{ "itemTypes": ["ring"], "quality": "magic", "formula": "((stat('item_fastercastrate')>=10)&&((stat('fireresist')+stat('coldresist')+stat('lightresist'))>=40))", "hideIfOtherConditionsFail": true }
```

| Part | What it gives |
| --- | --- |
| `stat('name')` | The item's stat: a stats.csv `name` in single quotes, or its id. Without a param it reads param 0, like a stat check. |
| `stat('name', param)` | One param of it: a number, or a skills.txt skill name in single quotes such as `'Teleport'` (skills.csv `formulaName`). On chance-to-cast and charge stats a skill name matches that skill at any level. |
| `playerStat('name')`, `playerStat('name', param)` | The character's stat. |
| `statMax('name')`, `statSum('name')` | The highest value, or the total, over every param of the item's stat (any skill, tab or class). |
| `+ - * /` | Whole numbers; division rounds toward 0, division by 0 gives 0. |
| `== != < <= > >=` | Comparisons give 1 or 0. |
| `&& \|\| !` | And, or, not. |
| `a ? b : c` | b when a is not 0, else c. |

- Names go in single quotes (no escaping inside the JSON string); double quotes are most likely rejected.
- A formula is one more condition: the rule still needs its other conditions, and `hideIfOtherConditionsFail` counts a formula that gives 0 as a failed "other condition".
- Prefer a formula over several stat checks when the rule adds stats up ("total resists >= 40") or mixes AND and OR.

## Actions

| Key | Value | Effect |
| --- | --- | --- |
| `hide` | true | Hides the ground label (the item cannot be picked up by clicking its label); no later rule runs for the item. |
| `hideIfOtherConditionsFail` | true | When the codes, types and location match but any other condition fails, the item is hidden (see "Hide rules"). |
| `show` | true | Keeps the item visible: no later rule can hide it (hide, hideIfOtherConditionsFail, hideUnmatchedItems); later rules still change its looks, chat lines and sounds. A rule cannot both show and hide. |
| `replaceName` | text | A new name. `{name}` is the game name. |
| `namePrefix` | text | Text before the name. |
| `nameSuffix` | text | Text after the name. |
| `labelBackground` | `[r, g, b]` or `[r, g, b, a]`, whole numbers 0 to 255 | Fills the ground label; alpha defaults to 242. |
| `labelBorder` | `{ "color": [r, g, b] or [r, g, b, a], whole numbers 0 to 255, "width": 2 }` | Outlines the ground label; width is a whole number from 1 to 8, and 1 to 3 reads well. |
| `chatMessage` | text | A chat line when the item drops, once per item (replaces the notify line). |
| `chatMessageWhenHidden` | text | A chat line when this rule hides the item. |
| `notify` | true | Prints the filter's drop line (notifications.dropFormat, default "{qualityColor}{name}"). |
| `sound` | a bundled sound file (assets.md), e.g. `"tink.mp3"`; or a sounds.txt name or row (only one the user names: not in the reference) | Plays when the item drops. Sounds of several matching rules add up. |
| `soundVolume` | 0 to 100 | This rule's sound volume. |
| `icon` | `{ "iconName": "rune", "iconSize": 40, "color": [r, g, b] }` | A minimap icon (HD only). iconName: a bundled icon (assets.md); iconSize 4 to 256 minimap pixels; color optional. |
| `droplight` | `{ "color": [r, g, b] }` or `{}` (white) | A light beam on the item while it lies on the ground (HD only). |
| `useStyle` | a style name | Pulls in that style's actions; the rule's own actions win over the style's. |
| `comment` | text | Ignored by the game. Say what the rule does in plain words: the app shows it as the rule title. |

## Hide rules and exceptions

- A hidden item loses its ground label for good, so keep hide rules narrow: one item type or group and quality per rule, and the exceptions inside the rule.
- Exceptions are negated conditions in the same rule: except lists (`excludeItemCodes`, `excludeItemTypes`, `excludeUniqueOrSetIds`, `excludeAreas`), a quality list without the kept qualities, `sockets: 0`, and stat checks written as `< 1` ("hide the ones without this stat").
- "Hide magic weapons except those with +skills or FCR": `itemStats` with `item_allskills < 1` and `item_fastercastrate < 1` (every check must hold to hide, so either stat keeps the label). Use `itemStatsAnyOf` with `< 1` checks to keep only items with all the stats.
- `hideIfOtherConditionsFail` is the other way round: the codes or types match but another condition does not, so the item is hidden. Every other condition counts, `quality` included: type `weap`, quality magic, a stat check and this flag also hides unique and rare weapons. Use it for "show this base only with sockets"; prefer `hide` with exceptions otherwise.

Example:

```json
{
  "itemCodes": ["gld"],
  "itemStats": [{"stat":"gold","op":"<","value":100}],
  "playerStats": [{"stat":"level","op":">=","value":20}],
  "excludeAreas": [1,40,75,103,109],
  "hide": true
}
```

## Item codes, types, uniques and sets

- ESR codes differ from the classic game: the classic runes are `r51` (El) to `r83` (Zod), and ESR adds runes of its own (`r01` and up, `r84` and up). Check every code in the tables; never guess one.
- A rule on a parent type matches its children: `weap` all weapons, `armo` all armour, `swor` swords. item-types.csv lists each type's parents.
- Uniques and sets are matched by row id with `uniqueOrSetIds`. ESR has two rows for many uniques: the one that drops and one cubed from an Ancient Coupon; list both ids. Add `"quality": "unique"` (or `"set"`) so a set item with the same number does not match.
- `sockets` is what the item has now; `maxSockets` is what its base can get (for bases the player sockets with the cube or Larzuk).
- Normal (white) and superior items take runewords: `"quality": ["normal", "superior"]` for runeword bases.

## Texts, placeholders and colours

- Any text is one string or one string per language, `{ "enUS": "Rune", "deDE": "Rune" }`; a missing language falls back to enUS. Languages: `enUS`, `deDE`, `esES`, `frFR`, `itIT`, `koKR`, `plPL`, `ruRU`, `zhCN`, `zhTW`, `esMX`, `jaJP`, `ptBR`. Write enUS always; add other languages only when the user asks.
- `{string:KEY}` shows a game string in the player's language, e.g. `{string:r01}`.
- Colours: `ÿc` plus one character; the text after it keeps that colour until the next code. In JSON `\u00ffc` works too. D2RLAN tags like `{red}` are not supported.

| Placeholder | Works in | Shows |
| --- | --- | --- |
| `{name}` | names, chat lines, dropFormat | The item's name, translated by the game |
| `{code}` | names, chat lines, dropFormat | The item's code |
| `{quality}` | names, chat lines, dropFormat | The item's quality |
| `{baseTier}` | names, chat lines, dropFormat | The item's base tier |
| `{itemLevel}` | names, chat lines, dropFormat | The item's level |
| `{sockets}` | names, chat lines, dropFormat | Its sockets |
| `{maxSockets}` | names, chat lines, dropFormat | The most sockets its base can have |
| `{ethereal}` | names, chat lines, dropFormat | Its ethereal flag |
| `{uniqueOrSetId}` | names, chat lines, dropFormat | Its uniqueitems.txt or setitems.txt row |
| `{qualityColor}` | names, chat lines, dropFormat | The colour code of the item's name, after qualityColors |
| `{stat:ID}` | names, chat lines, dropFormat | One of the item's stats ({stat:ID} or {stat:ID,PARAM}) |
| `{playerStat:ID}` | names, chat lines, dropFormat | One of your character's stats ({playerStat:ID} or {playerStat:ID,PARAM}) |
| `{string:KEY}` | names, chat lines, dropFormat, levelChangeFormat | A game string in the player's language, e.g. {string:r01} |
| `{link}` | chat lines, dropFormat | Chat lines only: the item's name |
| `{level}` | levelChangeFormat | The filter level's name |
| `{filter}` | levelChangeFormat | The filter's title |

| Code | Colour | The game uses it for |
| --- | --- | --- |
| `ÿc0` | white | plain text, normal items |
| `ÿc1` | red | broken items, warnings |
| `ÿc2` | green | set items (tooltips) |
| `ÿc3` | blue | magic items (tooltips) |
| `ÿc4` | gold | unique items (tooltips) |
| `ÿc5` | gray | socketed and ethereal items (tooltips) |
| `ÿc6` | black |  |
| `ÿc7` | tan |  |
| `ÿc8` | orange | crafted items (tooltips) |
| `ÿc9` | yellow | rare items (tooltips) |
| `ÿc:` | dark green | tempered items (tooltips) |
| `ÿc;` | purple |  |
| `ÿc<` | green |  |
| `ÿc=` | white | plain item labels |
| `ÿc>` | gold | quest item labels |
| `ÿc?` | yellow | rare labels |
| `ÿc@` | orange | crafted labels |
| `ÿcA` | dark green | tempered labels |
| `ÿcB` | blue | magic labels |
| `ÿcC` | green | set labels |
| `ÿcD` | gold | unique labels |
| `ÿcE` | white | health potion labels |
| `ÿcF` | white | mana potion labels |
| `ÿcG` | white | rejuvenation potion labels |
| `ÿcH` | white | gold labels |
| `ÿcI` | gray | ethereal labels |
| `ÿcJ` | orange | rune labels |
| `ÿcK` | gray | socketed labels |
| `ÿcL` | orange | event item labels |
| `ÿcM` | light purple | desecrated labels |
| `ÿcN` | turquoise |  |
| `ÿcO` | pink |  |
| `ÿcP` | light blue |  |
| `ÿcQ` | green |  |
| `ÿcR` | yellow |  |
| `ÿcS` | dark red |  |
| `ÿcT` | sky blue |  |
| `ÿcU` | red |  |
| `ÿcV` | red |  |

## Known plugin limits (plugin 1.8.2)

- `item_armor_percent` (16): Does not work on armour, helms and shields (reads 0). The game keeps Enhanced Defense off the stats of armour with defense, so the plugin reads 0 here on armour, helms and shields (confirmed in game). Reported to the mod author.
- `item_maxdamage_percent` (17): Currently only works on jewels and charms (reads 0 on weapons). The game keeps Enhanced Damage off a weapon's stats, so the plugin reads 0 here on weapons (confirmed in game); on jewels and charms it reads correctly (confirmed on a jewel). Reported to the mod author.
- `item_mindamage_percent` (18): Currently only works on jewels and charms (reads 0 on weapons). The game keeps Enhanced Damage off a weapon's stats, so the plugin reads 0 here on weapons (confirmed in game); on jewels and charms it reads correctly (confirmed on a jewel). Reported to the mod author.
- `item_maxdurability_percent` (75): May not work on weapons and armour (likely reads 0; not tested). The game likely keeps Increased Maximum Durability off the stats of items with durability (the same rule as Enhanced Damage and Defense, not tested in game), so the plugin likely reads 0 here on weapons and armour. Reported to the mod author.
- A stat check (or {stat:ID}) without param reads only the entry with param 0: for a skill, skill tab or class stat that is one skill, tab or class, not any of them; an entry without param has param 0.
- Stat values: every stat reads the number the item tooltip prints (stat checks, formulas, `{stat:}`): +40 Life reads 40, `item_howl` and `item_fear` read the percent, charges read the skill level; everything else as stored.
- Per-level stats read the value at the character's level (0.5 per level reads 0 at level 1 and 49 at level 99), so their checks depend on the level: `item_armor_perlevel`, `item_armorpercent_perlevel`, `item_hp_perlevel`, `item_mana_perlevel`, `item_maxdamage_perlevel`, `item_maxdamage_percent_perlevel`, `item_strength_perlevel`, `item_dexterity_perlevel`, `item_energy_perlevel`, `item_vitality_perlevel`, `item_tohit_perlevel`, `item_tohitpercent_perlevel`, `item_cold_damagemax_perlevel`, `item_fire_damagemax_perlevel`, `item_ltng_damagemax_perlevel`, `item_pois_damagemax_perlevel`, `item_resist_cold_perlevel`, `item_resist_fire_perlevel`, `item_resist_ltng_perlevel`, `item_resist_pois_perlevel`, `item_thorns_perlevel`, `item_find_gold_perlevel`, `item_find_magic_perlevel`, `item_stamina_perlevel`, `item_damage_undead_perlevel`, `item_crushingblow_perlevel`, `item_deadlystrike_perlevel`, `item_magic_damagemax_perlevel`, `item_criticaldamage_perlevel`, `item_summmastery_perlevel`, `item_summlife_perlevel`, `item_acvsmissiles_perlevel`, `item_magpierce_perlevel`, `item_extramag_perlevel`, `item_piercefire_perlevel`, `item_piercecold_perlevel`, `item_pierceltng_perlevel`, `item_fasterattackrate_perlevel`, `item_absorb_ltng_perlevel`, `item_damage_demon_perlevel`, `item_maxmana_percent_perlevel`, `item_piercedmg_perlevel`, `rune_effect_current_item_perlevel`, `item_maxhp_percent_perlevel`, `item_piercepois_perlevel`.
- Unidentified items: a rule that checks an item stat (stat lists or a formula) skips an unidentified item entirely: none of its actions run and it cannot hide it. `gold`, `armorclass`, `quantity`, `durability`, `maxdurability`, `item_numsockets` still work. Magic and rare drops are unidentified, so a hide rule with stat exceptions does not hide them until identified.
- Chat lines and sounds play once per item. The launcher's "Enable chat notifications" (selection.json `chatNotifications`) turns every item chat line off, and "Play sounds" every sound.
- Sounds and icons are files next to the filter. Use only the bundled ones in assets.md: the app's .zip download ships them. Icons and droplights need HD graphics.
- The plugin documents no size limit; the app saves filters up to 2 MB.

## Writing the file for the app

- Strict JSON: double quotes, no trailing commas. Comments are whole `//` lines: the plugin skips them anywhere, and the app keeps them on every edit above the opening `{` (the filter's header), above a top-level key, a rule, a disabled rule or a style, and after the last rule. It drops, on its first edit and with a warning, a comment on the same line as a rule, a comment inside a rule or style object and every `/* */` block.
- Sections: `// ==== Title` starts a part and `// ---- Title` a section inside it (four or more `=` or `-` right after `//`; a run of three or more after the title is decoration; a line of markers only is a separator). Other `//` lines right under a heading describe it, up to a blank line; other `//` lines between rules are notes (a blank line ends a description or a note; `//` alone is an empty comment line, not a blank line). A section runs to the next heading of the same or a higher level; the same works between styles. Rule numbers (`R###` in the plugin log) do not change. A file without headings shows no comment rows in the app (its comments are still kept).
- Give every rule a `"comment"` too: a short title the app lists ("R012 | Gold < 1000 | hide at L3", "Hide magic weapons without +skills (Strict)"). Section comments group rules; they do not replace it.
- To switch a rule off, do not comment it out (a commented-out rule is only a note): the app's rule toggle moves it to `disabledRules` (`{ "at": <index>, "rule": {…} }`), which the plugin ignores.
- Keys inside a rule: conditions, then actions, then nothing else. Unknown keys are kept but ignored by the game.
- Reuse styles for repeated looks (a "Valuable" style for top items, "Good" for useful ones, or the style presets in examples.md) instead of copying actions. Every `useStyle` name must be defined under `"styles"`.

## Common mistakes and what the app reports

The app checks every filter against the ESR game data. These are its own messages for typical mistakes; when the user pastes such a message back, fix that spot.

- an item code that does not exist: `{"itemCodes":["r99"],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: Unknown item code "r99"
  - instead: use a code from the tables, or ask the user
- a type name instead of a type code: `{"itemTypes":["weapon"],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: Unknown item type "weapon"
  - instead: write the code from item-types.csv (`weap`)
- a stat label instead of its name: `{"itemStats":[{"stat":"Faster Cast Rate","value":10}],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: Unknown stat "Faster Cast Rate"
  - instead: write the stats.csv name (`item_fastercastrate`) or its id
- a quality the format does not have: `{"quality":"legendary","labelBorder":{"color":[255,0,0],"width":2}}`
  - app: error: "quality": unknown quality 'legendary'
  - instead: use one of `inferior`, `normal`, `superior`, `magic`, `set`, `rare`, `unique`, `crafted`, `tempered`
- Enhanced Damage on weapons: `{"itemTypes":["weap"],"itemStats":[{"stat":"item_maxdamage_percent","op":">=","value":200}],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: The game keeps Enhanced Damage off a weapon's stats, so the plugin reads 0 here on weapons (confirmed in game); on jewels and charms it reads correctly (confirmed on a jewel). Reported to the mod author.
  - instead: it reads 0 on weapons: use other stats, or tell the user
- a skill tab stat without param: `{"itemTypes":["amul"],"itemStats":[{"stat":"item_addskill_tab","op":">=","value":2}],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: "item_addskill_tab" has one entry per skill tab; without "param" the plugin reads only the entry with param 0 (verified in game), not any skill tab. Pick a skill tab to check one
  - instead: one check per tab with its param from skill-tabs.csv, in itemStatsAnyOf
- a properties.txt tab number as param: `{"itemTypes":["amul"],"itemStats":[{"stat":"item_addskill_tab","param":20,"op":">=","value":2}],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: "param" 20 names no skill tab: the plugin numbers tabs class × 8 + tab 0 to 2, as the game does (verified in game); as a properties.txt tab number (class × 3 + tab) 20 is Assassin Martial Arts, which is param 50
  - instead: the param is class × 8 + tab (skill-tabs.csv)
- a per-level stat value check: `{"itemTypes":["ring"],"itemStats":[{"stat":"item_strength_perlevel","op":">=","value":40}],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: "item_strength_perlevel" (Strength per level) reads the value at your character's level, as the tooltip's "(Based on Character Level)" shows: 0.5 per level reads 0 at level 1 and 49 at level 99, so this check depends on the character level (plugin 1.8.2, the guide).
  - instead: it reads the value at the character level; tell the user the check depends on the level, or use a presence check (`>= 1`)
- a level the filter does not have: `{"itemTypes":["hpot"],"activeInLevels":[3],"hide":true}`
  - app: error: There is no filter level with id 3
  - instead: use the ids of filterLevels
- a style that does not exist: `{"itemCodes":["r83"],"useStyle":"Great"}`
  - app: error: There is no style named "Great"
  - instead: define it under "styles" or fix the name
- "between" with one number: `{"itemStats":[{"stat":"item_fastercastrate","op":"between","value":10}],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: error: "between" needs "value": [low, high]
  - instead: `"value": [10, 20]`
- an empty list: `{"itemCodes":[],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: "itemCodes" is an empty list: the game logs "the list is empty" and what it does then is not known; remove the key or add values
  - instead: remove the key or add values
- unique ids with a quality that excludes them: `{"uniqueOrSetIds":[418],"quality":"rare","labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: Unique or set ids need a unique or set item, but the quality allows neither, so the rule never matches
  - instead: quality unique (or set), or no quality
- codes that are not of the listed types: `{"itemCodes":["r51"],"itemTypes":["weap"],"labelBorder":{"color":[255,0,0],"width":2}}`
  - app: warning: None of the item codes is of the item types, so the rule never matches
  - instead: drop one of the two lists
- hideIfOtherConditionsFail with quality: `{"itemTypes":["weap"],"quality":"magic","itemStats":[{"stat":"item_allskills","op":">=","value":1}],"hideIfOtherConditionsFail":true}`
  - app: warning: "hideIfOtherConditionsFail" with "quality" also hides every other quality of these items (uniques included): any other condition failing hides the item
  - app: warning: Does not hide unidentified items: the game skips a rule that checks an item stat until the item is identified
  - instead: a hide rule with `< 1` exceptions
- a hide rule without conditions: `{"hide":true}`
  - app: warning: Hides every ground item; the rule after it never runs for ground items
  - instead: give every hide rule conditions
- a colour out of range: `{"itemCodes":["r83"],"labelBackground":[300,0,0]}`
  - app: error: Colour component 300 is not a whole number from 0 to 255
  - instead: whole numbers 0 to 255
- a key the format does not have: `{"itemCodes":["r83"],"highlight":true}`
  - app: warning: Unknown key "highlight"; it is kept as is
  - app: warning: The rule has conditions but no actions, so it does nothing
  - instead: use only the keys above; remove it
- show and hide in one rule: `{"itemCodes":["r83"],"show":true,"hide":true}`
  - app: error: A rule cannot both show and hide an item: the game switches the rule off
  - instead: a rule either shows or hides; use two rules

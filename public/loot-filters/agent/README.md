# ESR loot filter agent pack

For an AI agent that writes or edits loot filters for Diablo II: Resurrected with the Eastern Sun Resurrected (ESR) mod. The D2R ESR Runeword Browser (https://istvan-panczel.github.io/d2r-esr-runeword-browser/) generates these files from the same code as its loot filter editor and its "Create a filter with AI help" page, so they describe what the editor reads and checks. The game data is from ESR 3.3.04. Loot filter plugin 1.8.2.

Read this file, then FORMAT.md, before you write a rule.

## What ESR loot filters are

Eastern Sun Resurrected (ESR 3.3.04) is a mod for Diablo II: Resurrected. Its loot filter plugin (version 1.8.2) reads one JSON file per filter: a few settings, filter levels the player steps through with a key in game, optional named styles, then the rules, applied top to bottom to every item. A rule's conditions (item codes and types, quality, sockets, stats, areas, levels, a formula) pick items; its actions show, hide, rename or highlight them (label colours and borders, minimap icons, droplights, chat lines, sounds).

Players import a filter in the ESR launcher (Loot Filter tab, Import). Own filters live in `<Saved Games>\Diablo II Resurrected\mods\<mod>\LootFilters\`, with sound files in a `sounds` folder and minimap icons in an `icons` folder next to the filter. A rule with an error is switched off by the game and logged with its number; the rest of the filter works.

## How to work

1. Read FORMAT.md first (the format, how rules combine, the plugin limits, the app's messages for common mistakes), then examples.md for complete rules and style presets to adapt. Look codes, types, stats and ids up in the CSV tables.
2. Write or edit the filter's `.json` file. Keep it valid JSONC the plugin reads: one JSON object, double quotes, no trailing commas, comments only as whole `//` lines where "Section comments" below allows them.
3. Check it in the app: open https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters, tab **My filters**, **Upload**, pick the file. The editor opens it; its **JSON** tab lists every problem (error or warning, the JSON path, the message), and **Copy problems for the AI** copies the list. If you cannot open the site yourself, ask the person you work with to upload the file and paste that list back.
4. Fix exactly the problems listed and keep everything else; repeat until the list is empty or only holds warnings you have a reason to keep (say which and why). A problem that cannot be fixed (a plugin limit) needs another approach: say so.
5. In the game: the launcher's **Loot Filter** tab, **Import**; the console command `lootfilter` shows the plugin's state and problems with rule numbers, `lootfilter reload` reloads the file.

## Rules for writing filters

- Use only item codes, item types, stat names, params and unique or set ids from the tables. Never guess one: the app flags unknown codes. If you cannot find one, say so and ask.
- ESR codes differ from the classic game (the classic runes are `r51` El to `r83` Zod); FORMAT.md "Item codes, types, uniques and sets" says what else differs.
- Sounds and minimap icons: only the bundled files in assets.md (the app's .zip download ships them). A game sound (a name from the mod's sounds.txt) works too but is not listed here: use one only when asked for, with the exact name you are given.
- Styles: every `useStyle` must name a style defined under `"styles"` in the same file. For a ready-made look, copy a style preset from examples.md into `"styles"` under its name.
- Mind the known plugin limits in FORMAT.md: Enhanced Damage and Enhanced Defense read 0 on weapons and armour, a stat check without "param" reads only param 0, stats read the tooltip number (+40 Life = 40), per-level stats read at the character level, and rules with item stat checks skip unidentified items.
- A matching hide rule hides the item whatever the rules before it did (unless a `show` rule protected it), so every hide rule is narrow and carries its own exceptions ("< 1" stat checks, except lists, a quality list).
- Give the filter a short `"title"` and every rule a meaningful `"comment"`: the app shows it as the rule title.
- When you edit an existing filter, change what was asked and keep everything else as it is: rules, their order, comments, sections, styles, levels, title.
- Before a big change, settle what the filter is for: class and build, difficulty and progress (leveling, Hell, maps), the item groups that matter, how strict, how many filter levels and what each level hides, sounds and icons, the languages of chat and name texts.

## Section comments

Group the rules of a filter with ordinary `//` lines. The plugin skips `//` comments anywhere, so sections need no format change and the rule numbers (the `R###` the plugin log reports: the place of a rule in the list) stay the same. The app shows them as foldable headings and notes in its Rules and Styles lists, where a person can also add, rename, move and remove them, so keep to these lines when you write them.

| Line in the file | What it is |
| --- | --- |
| `// ==== Title` | A part (level 1 heading) |
| `// ---- Title` | A section inside a part (level 2 heading) |
| Any other `//` line right under a heading, up to a blank line | That heading's description |
| Any other `//` line between rules | A note, shown in place |
| `// =========` (markers only) | A visual separator |

- A marker is four or more `=` or `-` right after `//`. A run of three or more of them after the title is decoration: `// ==== Runes ====` is the part "Runes".
- A section runs to the next heading of the same or a higher level: a part ends at the next part, a section at the next section or part.
- The same works between styles inside `"styles"`.
- A blank line ends a description or a note: put the first rule's own comment after one. `//` alone is an empty comment line, not a blank line; blank lines between comment lines are kept.
- Comment lines above the opening `{` are the filter's header (the app shows them as "About this filter"). Comments above a top-level key (e.g. above `"styles"`) are kept.
- Kept on every edit in the app: whole-line `//` comments above a top-level key, a rule, a disabled rule or a style, and after the last rule.
- Dropped on the app's first edit (with a warning): a comment on the same line as a rule, a comment inside a rule or style object, and every `/* */` block. Do not write those.
- A file with no heading shows no comment rows in the app's lists (older files look as before); its comments are still kept.
- Every rule still gets a `"comment"`: a short title the app lists, e.g. `"Gold < 1000 | hide at L3"`. Section comments group rules; they do not replace it.
- Do not number rules in the `"comment"`: the editor and the plugin log number rules by their place in the list, and a number in the comment goes stale when rules move.
- The editor's Add rule button puts a new rule at the end of a `// ---- Custom rules` section inside the `// ==== Protection` part (created when missing) with `show: true`; filters without a Protection part get it after the selected rule.
- To switch a rule off, do not comment it out: the app's rule toggle moves it to a top-level `disabledRules` list (`{ "at": <index>, "rule": {…} }`) that the plugin ignores. A commented-out rule is just a note.

Example:

```jsonc
// My ESR filter v1.0.0
{
  "formatVersion": 1,
  "title": "My ESR filter",
  "filterLevels": [{ "id": 1, "name": "Leveling" }, { "id": 2, "name": "Strict" }],
  "defaultLevel": 1,
  "rules": [
    // ==== Show ====
    // Label rules first: later rules change the looks of earlier ones.
    // ---- Runes
    { "comment": "High runes | border", "itemCodes": ["r76", "r77", "r78", "r79", "r80", "r81", "r82", "r83"], "labelBorder": { "color": [255, 0, 0], "width": 2 } },

    // ==== Hide ====
    // Narrow hide rules last, each with its own exceptions.
    { "comment": "Potions | hide at L2", "itemTypes": ["hpot", "mpot"], "activeInLevels": [2], "hide": true }
  ]
}
```

## Files

Every file of this pack, at https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/:

- README.md: this file, the entry point. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/README.md
- FORMAT.md: the filter format: keys, conditions, stat checks, actions, how rules combine, hide rules and exceptions, texts and colours, plugin limits, the mistakes the app reports. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/FORMAT.md
- examples.md: the style presets, then 67 complete example rules in groups (runes, uniques, sets, bases, charms, endgame items, maps, junk hides) with styles, sounds, icons and chat lines. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/examples.md
- assets.md: the bundled sound and icon files, the only ones to use, with when to use each. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/assets.md
- item-types.csv: every itemtypes.txt type: code (for "itemTypes"), name, parent types (a rule on a parent matches its children). https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/item-types.csv
- items.csv: every item code (weapons, armour, misc): code, name, kind, type, second type, base tier, whether it can drop. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/items.csv
- stats.csv: every itemstatcost.txt stat: id, name (write either in "stat"), label, what "param" holds, plugin limits. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/stats.csv
- uniques-sets.csv: every unique and set item row: kind, id (for "uniqueOrSetIds"), name, base code and name, required level, set, notes. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/uniques-sets.csv
- areas.csv: every levels.txt area: id (for "areas"), name, act. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/areas.csv
- skills.csv: every skill a stat param can name: id, name, class (empty: an item or monster skill), formulaName (the skills.txt name a formula takes). https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/skills.csv
- skill-tabs.csv: the skill tabs: param of item_addskill_tab (class × 8 + tab), class, tab. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/skill-tabs.csv
- classes.csv: the classes: param of item_addclassskills (class id), code, name. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/classes.csv

The tables are the full game data: every item code, type, stat, unique and set row, area and skill. They do not list the sounds.txt names.

Complete filters to read (the app offers them as templates):

- Sully's QoL Filter: The filter the ESR launcher gives every player. Start from it to change its rules. The latest: https://raw.githubusercontent.com/Thisisnotsully/QoL-Filter/refs/heads/main/Sullys-QoL-Filter.json (the copy on this site, which can be older: https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/sullys-qol-filter.json)
- Example filter (with explanations): A small filter to learn from: every rule says in its comment what it does and what to change. https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/example-filter.json

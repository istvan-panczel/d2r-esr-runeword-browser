# Loot Filter (editor for ESR's loot filter plugin)

A browser-only editor for the JSON loot filter files that ESR's loot filter plugin reads (since ESR 3.2.09). Filters
are kept in the browser's localStorage and downloaded as files for the ESR launcher. Format reference:
[ESR-LOOT-FILTER-GUIDE.md](../../builds-feature-docs/loot-filter/ESR-LOOT-FILTER-GUIDE.md). Research and owner
decisions: [FEATURE-LOOT-FILTER-RESEARCH.md](../../builds-feature-docs/FEATURE-LOOT-FILTER-RESEARCH.md) §4.1 (the format
answers), §5 and §5.1 (owner decisions).

## Routes

| Path                | Screen                  | Notes                                                                                           |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `/loot-filters`     | LootFilterLayout        | Frame for both pages: an "Under development" notice (like the guide's "Experimental" one)       |
| `/loot-filters`     | LootFilterLibraryScreen | The library: New filter, Upload, Start from Sully's QoL filter; one card per filter             |
| `/loot-filters/:id` | LootFilterEditorScreen  | The editor; `?tab=rules\|styles\|settings\|json\|test` (default `rules`); unknown id: not found |

Both routes skip the HTM "Loading data..." gate (`isStaticBundlePath` in `src/core/layouts/staticBundleRoutes.ts`, see
[NAVIGATION.md](../technical/NAVIGATION.md#startup-loading-gate)): they need only the game-data bundles, the assets in
`public/loot-filters/` and localStorage. Header entry: "Loot Filters", after "Game Data".

## Using a filter in the game

Download a filter, then in the ESR launcher open the **Loot Filter** tab and choose **Import**. Your own filters live in
`<Saved Games>\Diablo II Resurrected\mods\<mod>\LootFilters\`; sound files go in a `sounds` folder and minimap icons in
an `icons` folder next to the filter. In game, the Loot Filter section in Controls holds the level key; the console
command `lootfilter` shows the plugin's state and problems, `lootfilter reload` reloads.

Asset rules: a `sound` ending in `.wav`/`.mp3`/`.flac` is a file in `sounds\` (any other string is a sounds.txt name, a
number its row); `icon.iconName` `goldstar` is the file `icons\goldstar.sprite` (file names are case-insensitive on
Windows: `gemp` loads `gemP.sprite`). The launcher's Import copies only the JSON, so a filter that uses sound or icon
files does not play or draw them until the files sit next to it. The mod shipped the nine mp3s and
`goldstar.sprite`/`goldstar.lowend.sprite` beside its own `esr-default-filter.json` up to ESR 3.2.21; 3.2.22 removed
them and the launcher now pulls curated filters live from their creators' GitHub repositories
(`LootFilters/sources.json`), so players only get such files with a live filter. The app bundles the files of Sully's
QoL filter (github.com/Thisisnotsully/QoL-Filter, the filter every player gets that way), copied from his repository:
the nine mp3s in `public/loot-filters/sounds/` and twelve icons in `public/loot-filters/icons/` (`charm`, `cube`, `gem`,
`gem2`, `gemP`, `goldstar`, `map`, `Myth`, `redD`, `rune`, `scroll`, `star`; 512 px squares, `rune` 1080 px,
`goldstar` 200 px), plus the mod's `goldstar.lowend.sprite`. **Download .zip with sounds and icons** puts the filter
and the bundled files it references into one archive to unzip into `LootFilters\` (see Library screen).

Troubleshooting (also in the library how-to): if a sound or icon does not work, check the `sounds`/`icons` folders next
to the filter; if chat lines do not print, run `lootfilter` in the game console and read
`d2rloader\logs\celestialrayone.loot-filter.log` (set `debug_log = true` in the plugin's TOML to log every chat line).

## Storage model

- **Key** `loot-filters/library` in localStorage, value `{ "version": 1, "entries": [...] }`.
- **Entry** `{ id, name, source: 'blank' | 'upload' | 'template', createdAt, updatedAt, text }`; times are epoch ms,
  ids come from `crypto.randomUUID` (with a fallback). `name` is the library name, not the file's `title`.
- **`text` is the source of truth**: the filter file exactly as it will be downloaded. An upload is stored verbatim
  until the first edit; the editor's model is parsed from `text` when the filter opens and serialized back after edits.
- A stored value that fails the type guard (corrupt, or written by a newer version) is copied once to
  `loot-filters/library.unreadable` before the library starts empty, so the next save cannot destroy it.
- A refused write (quota) shows one toast, "Could not save: browser storage is full", until a write succeeds again;
  editing keeps working in memory.
- Two browser tabs editing the library overwrite each other: each writes its whole library, the last write wins. There is
  no cross-tab sync (no `storage` event listener).

## State (`src/features/loot-filter/store/`)

`lootFilter` slice, registered in `core/store/store.ts`:

- `library`: `{ hydrated, entries }`. Reducers: `hydrate(entries)`, `createBlank(name)`, `importText({ name, text, source })`,
  `duplicate(id)`, `rename({ id, name })`, `remove(id)`, `editorFlushed()`.
- `editor`: `{ id, filter, parseDiagnostics, textNotes, selectedRule, dirty }`. Reducers: `open(id)` (parses the text; a JSONC
  syntax error leaves `filter: null` and one error diagnostic), `close()`, `setHeader(patch)`, `setFilterLevels(levels)`,
  `setNotifications(patch)`, `setQualityColors(patch)`, `addRule({ rule?, at? })`, `updateRule({ index, rule })`,
  `patchRule({ index, patch })`, `setRuleDisabled({ index, disabled })` (see "Disabled rules"), `removeRule(index)`,
  `moveRule({ from, to })` and `duplicateRule(index)` (both keep the `disabled` flag with the rule), `selectRule(index)`,
  `setStyle({ name, style })`, `renameStyle({ from, to })` (also re-points rules' `useStyle`), `removeStyle(name)`,
  `replaceFilter({ filter, diagnostics, notes? })`.
- **Reading is lenient, writing strict**: `engine/jsonc.ts` reads what the ESR loot filter plugin (v1.5.3) reads, so
  besides `//` line comments it accepts `/* */` block comments and a single trailing comma before `]` or `}` (Sully's
  launcher filter ends its rules with `},` + `]`); `[1,,2]`, `[,]` and an unclosed `/*` stay syntax errors. Comments and
  trailing commas are blanked to spaces, so `JSON.parse` offsets are the source's; when the engine's message has no
  position (V8's `Unexpected token ']'`) a small strict scanner finds it, so a syntax error carries its line and column.
  The serializer always writes strict JSON.
- **Text notes** (`textNotes` in `engine/parse.ts`, returned by `parseLootFilter` as `notes`, apart from `diagnostics`):
  root-path warnings about the text itself, one per kind: "Trailing commas were accepted (first at line N); the game
  reads them, but downloads are written without them", "Block comments (/\* _/) were accepted (first at line N); …
  they are not kept", and "N comments inside the file (section notes between rules) are dropped on the first edit; only
  the comment lines before the opening brace are kept" (every `//` or `/_ \*/`after the opening brace).`open`stores
  them in`editor.textNotes`(none for`template`entries: the shipped template's section comments are ours) and`replaceFilter`takes the applied text's. They are not sticky:`flushEditor` clears them when it writes the model back,
  because the written text no longer has what they describe (so after the first edit they go with the debounced save).
- Patches are shallow: an `undefined` value removes the key, and a patched key is also dropped from the object's
  `passthrough` (so a wrong-shaped original does not reappear on download). `setNotifications` and `setQualityColors`
  drop the whole object when it ends up empty.
- Ids and timestamps come from `prepare` callbacks, so every reducer is a pure function of (state, payload).
- Selectors: `selectLibraryEntries`, `selectLibraryEntry(state, id)`, `selectEditor`, `selectEditorFilter`,
  `selectDiagnostics(state, reference?)` (the text notes, then the model's shape diagnostics re-read through `readLootFilter(toPlainJson(filter))`, then `validateLootFilter`; the stored parse diagnostics are used only when the text is not valid JSON).
  The validator's reference holds Sets and Maps, so it stays out of Redux: `useLootFilterReference()` loads the `lootfilter` and
  `types` game-data bundles and passes the reference to the selector (module-level cache keeps its identity stable).
  Besides the known codes, types, stats, areas, sounds and unique/set ids it has `itemCodeTypes` (code → the union of
  the ancestors of its `type` and `type2`) and `typeAncestors` (type → ancestors, itself included).
- "Never matches" warnings (`engine/validate.ts`, per rule): no listed item code (of those the bundle knows) is of a
  listed item type; every item code, unique/set id or area is also in its except list; every listed item type falls
  under an excepted type, or every known listed code is of one; `uniqueOrSetIds` with a `quality` (one, list or range)
  that allows neither set nor unique; a hiding rule (own `hide` or its style's) with no condition but a `location`
  that includes onGround, when rules follow it ("Hides every ground item; the N rules after it never run for ground
  items"). Unknown codes and types are skipped, so without game data only the except-list checks run.
- Other rule warnings: `hideIfOtherConditionsFail` without `itemCodes`/`itemTypes` ("hides every ground item that fails
  …" the listed other conditions, as the plugin warns; without other conditions the older "needs itemCodes or
  itemTypes" message), and with `quality` ("also hides every other quality of these items (uniques included)"); both
  skip rules with passthrough keys. An empty list in any list condition (`itemCodes: []`, `activeInLevels: []`, …):
  the plugin logs "the list is empty" and what it does then is not known. Disabled rules are validated like the
  others but do not count for "hides every ground item"; there is no filter-wide note about `disabledRules` (the
  Enabled checkbox's hint says the game ignores the key).

### Disabled rules (`disabledRules`)

The format has no enable flag (an unknown rule key is ignored and the rule stays active), so the editor writes a
switched-off rule to a sibling top-level list the plugin ignores ("unknown setting, ignored", one log line):

```json
"rules": [ …the enabled rules… ],
"disabledRules": [ { "at": 0, "rule": { "itemCodes": ["r01"], "hide": true } }, { "at": 5, "rule": { … } } ]
```

- `at` is the rule's index in the full list (enabled and disabled rules together), entries in ascending `at`, written
  after `rules`. A filter without disabled rules has no `disabledRules` key, so existing files serialize as before. To
  enable a rule by hand, cut the inner object back into `rules`.
- Model: `filter.rules` keeps every rule in editor order; a disabled one has the editor-only `disabled: true` (never a
  key inside the written rule). Indices, `selectedRule`, move, duplicate, delete and diagnostics stay stable.
- Reading: entries are sorted by `at` and inserted one after the other; a duplicate `at` goes after the previous entry
  and an `at` past the end goes last, each with a warning at `disabledRules/N/at`. An entry that is not exactly
  `{ "at": <whole number ≥ 0>, "rule": {…} }` makes the whole list wrong-shaped: it stays in the top-level passthrough
  with an error and is written back unchanged until a rule is disabled in the editor (the editor's list then wins).
- **Diagnostic paths** are file paths: a rule's own path is `rules/<n>` (n counts enabled rules only) or
  `disabledRules/<n>/rule` (n counts disabled rules), from `ruleFilePaths` in `engine/parse.ts`; the diagnostic's
  `rule` is the index in the full list, which the Rules tab and the JSON tab's "Rule N" links use. `RuleDiagnostics`
  strips either prefix.
- The evaluator skips a disabled rule with the trace outcome `disabled` (it never applies or hides).

`lootFilterSaga` (registered by `src/features/loot-filter/index.ts` when the route chunk first loads):

1. reads the library and dispatches `hydrate`;
2. 400 ms after the last editor edit dispatches `editorFlushed`, which serializes the model into the entry's `text`;
   `open`/`close` flush synchronously, and the editor screen dispatches `editorFlushed` on `pagehide`/`beforeunload`;
3. after every library change writes the library to localStorage.

The reducer is registered statically, and the slice imports the engine's parser and serializer, so they are in the entry
chunk (about 6.5 KB gzip); a documented exception, see [SAGAS.md](../technical/SAGAS.md).

## Library screen

Title, a short how-to (launcher import, `sounds`/`icons` folders, the zip download, the troubleshooting line from
"Using a filter in the game"), and:

- **New filter**: a name dialog ("It also becomes the filter's title (Settings tab), which the launcher shows."), then
  opens the editor on a blank filter (`formatVersion: 1`, `title` = name, one level
  `{ id: 1, name: 'Default' }`, `defaultLevel: 1`, no rules).
- **Upload**: a `.json` file read as UTF-8, as leniently as the game reads it (`//` and `/* */` comments, trailing
  commas). A JSON syntax error shows a toast with the line and column and imports nothing; a file with diagnostics
  (unknown keys, wrong shapes) is imported and the editor lists them. The success toast counts the problems and spells
  out the text notes (accepted trailing commas or block comments, comments between rules that the first edit drops),
  which the editor's problems chip and list show first. The entry name is
  the file's `title`, else the file name. A successful upload opens the editor, like New filter and the template.
- **Start from Sully's QoL filter**: fetches `public/loot-filters/sullys-qol-filter.json` and opens it as a `template`
  entry named "Sully's QoL Filter" (the file's title; the card's byline reads "Sully's QoL Filter by Sully"). The file
  is `Sullys-QoL-Filter.json` v0.6.3 from github.com/Thisisnotsully/QoL-Filter, verbatim (221 rules, 12 styles, 4
  levels, `soundVolume` 25, his `updateUrl` and `//` comments kept), the filter the ESR launcher pulls live since
  3.2.22. Our v0.6.1 copy had patched a trailing comma after the last rule and a `9pm` typo (War Pick is `9mp`); Sully
  fixed both in v0.6.2 on 2026-10-26, so the copy needs no edits; v0.6.3 (2026-10-27) adds a "500k+" gold stack rule
  (`gld` with stat 14 ≥ 500000, chat message, `other.mp3`) and corrects the volume comment to the actual 25. The
  `/esr-update` skill diffs the copy against upstream on every ESR release. Credit line (`TEMPLATE_CREDIT` in
  `utils/template.ts`): "Sully's QoL filter v0.6.3, the filter the ESR launcher ships live from github.com/Thisisnotsully/QoL-Filter; icons and sounds by Sully".
  It replaced the ESR default filter (302 rules, an earlier conversion of the same filter the mod shipped as
  `LootFilters/esr-default-filter.json` up to 3.2.21). The library how-to adds that every player already has Sully's
  filter through the launcher.
- One card per entry (newest first): name, title/author and rule count (a quick JSON read of the text, cached), last
  update, and Open, Download, Duplicate, Rename, Delete (with a confirm dialog). Empty state when the library is empty.
- **Download** (`components/FilterDownloadMenu.tsx`, shared with the editor header): a plain button saving
  `<slug of name>.json` when the filter references no bundled sound or icon (or is not valid JSON); otherwise a menu with
  **Download .json** and **Download .zip with sounds and icons**, plus the hint "Unzip into your LootFilters folder" and,
  when the filter references files the app does not bundle, their paths ("add them yourself"; the first four, then
  "and N more"). The zip (`<slug>.zip`) holds `<slug>.json` (the same text the plain download saves), `sounds/*.mp3` and
  `icons/*.sprite` for the referenced bundled files (`goldstar` brings `goldstar.lowend.sprite` along). The referenced
  files come from `utils/referencedAssets.ts` (rules and styles; `sound` values ending in `.wav`/`.mp3`/`.flac`, every
  `icon.iconName`; matched case-insensitively against `utils/bundledAssets.ts` and written under the bundled file's
  own name, so a rule's `gemp` puts `icons/gemP.sprite` in the zip); the archive from `utils/zip.ts`, a
  dependency-free stored-only ZIP writer (UTF-8 names, CRC-32). A failed fetch shows a toast "Could not download the
  sounds and icons" and saves nothing.

## Editor screen

Header row: back link, the filter name (pencil to rename inline; Enter or Escape returns the focus to the pencil), a
problems chip ("N errors / M warnings", also announced to screen readers through a polite live region) and
**Download**. Clicking the chip opens the JSON tab and bumps a counter the screen passes to `JsonTab`
(`scrollToProblems`); `JsonTab` scrolls to the problems list in an effect once it has rendered (the tab switch runs in a
transition, so scrolling from the click handler could miss the element) and resets the counter. Download saves the
stored `text` (comments and formatting as uploaded) unless edits are not yet written back (`editor.dirty`), then the
serialized model; it is the library's Download menu (see Library screen), so a filter that uses bundled sounds or icons
also offers the zip, with the files the current model references. When the stored text is not valid JSON, every tab but JSON shows a "cannot be read" card; Apply in the
JSON tab recovers the filter.

The tabs are a `role="tablist"` of buttons that set `?tab=`; each tab unmounts when another is shown, so the state that
must outlive a switch lives in the screen: the JSON tab's unapplied draft (reset when another filter opens) and the Test
tab's item form (not saved).

| Tab      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules    | Rule list (summary, badges, problem dot, move up/down, duplicate, delete) with search and Add rule, next to the selected rule's editor: comment, the rule's problems, every condition with game-data pickers, then the actions editor. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Styles   | Style list (name, action count, "used by N rules"), Add style, rename (rules' `useStyle` follow), duplicate ("Name (copy)"), delete (warns how many rules use it); the selected style opens the actions editor. Conditions found in a style are listed read-only ("styles hold actions only").                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Settings | Title, author, version, description, update URL, hide unmatched items, sound volume; filter levels (id + name, add/remove, default level, "used by N rules", ids rules use that are missing); drop line and level change line; one colour-code select per quality.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| JSON     | The serialized file in a textarea: Apply (parse, as leniently as Upload; a syntax error shows line/column and selects the spot; the success toast spells out the text notes), Revert, Copy. The draft survives tab switches; leaving the page with unapplied text asks first (`beforeunload`); when an edit in another editor tab changed the filter meanwhile a note says Apply replaces those changes and Revert loads them. Only the `//` comment lines at the top of the file are kept: comments between rules are not shown here (the text is the serialized model) and are dropped by Apply and by any form edit. Below it every problem with severity, path and message; a rule problem links to its rule (selects it, opens Rules). |
| Test     | Describe an item (presets, item fields, unique/set, stats, location) and the context (difficulty, area, filter level, character level and stats); see the ground label, chat lines, sounds, icon and droplight, and a rule-by-rule trace. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Settings changes dispatch the slice reducers directly; the only local state is what a half-typed number needs
(`NumberInput`: a text input with a numeric keyboard that commits only valid numbers, so "-" or "1." is kept as typed
and does not clear the key). Form rows share `Field` (label, control, hint; `dense` in the Test tab) and `CheckField`
(`components/Field.tsx`); the actions editor and the test result share `actions/Section.tsx`. A per-language text (`{ "enUS": …, "deDE": … }`) is shown read-only with "multi-language text, edit in
the JSON tab". Unknown keys appear in the problems list as warnings: they travel through unchanged, but only the JSON tab
can edit them.

## Rules tab (`components/RulesTab.tsx`, `components/rules/`, `components/pickers/`)

Two panes from `lg` up (list left, sticky; editor right), stacked below (list capped at 45vh, then the editor; picking a
rule scrolls the editor into view).

- **Toolbar**: search box (every term must appear in `ruleSearchText`: summary, codes and their names, types, unique/set
  and area names, stat names, comment, style, name changes and chat lines), **Add rule** (an empty rule after the
  selected one, else at the end; clears the search and selects it), and "N rules (M disabled, K hidden by search)".
  The search text includes `disabled` for a disabled rule, so searching "disabled" lists them.
- **Rows** (`RuleRow`): 1-based number, `ruleSummary` (e.g. `Zod Rune, Cham Rune +2 · unique · ≥3 sockets · → style
Mythical`: items/types/uniques by name when the bundles are in, codes otherwise, then quality, tier, flags, item level,
  sockets, stats, difficulty, areas, and the main action: `hide`, `→ style X`, the stripped replaceName/prefix/suffix or
  chat line), badges for `hide`, `useStyle`, `activeInLevels` (`L1,3`) and a non-default `location`, the comment, and a
  red/amber dot for the rule's worst diagnostic. A disabled rule's row is dimmed and has a dashed "disabled" badge
  first. Move up, move down, disable/enable (`PowerOff`/`Power`, "Disable rule N" / "Enable rule N",
  `aria-pressed`), duplicate and delete (asks first) are icon buttons
  that float over the row on hover/focus with a mouse and are always shown on touch and on the selected row. The
  selected row is scrolled into view when the selection changes elsewhere (the JSON tab's "Rule N" link).
- **Editor** (`RuleEditor`, remounted per rule): "Rule N" (with a "disabled" badge), an **Enabled** checkbox (hint:
  kept in the file under `disabledRules`, which the game ignores; the repo has no Switch component), the `comment` field, the rule's diagnostics (paths relative to
  the rule), a collapsed "How rules combine (AND, OR, hide)" note (`HowRulesCombine`: conditions AND, list values OR,
  codes and types both checked, top to bottom with hide stopping and no "show", exceptions written as negated
  conditions in the hide rule, `hideIfOtherConditionsFail` the other way round, and that it counts every other
  condition, quality included, so "weapon + magic + stat + hide if fail" also hides uniques and rares; the stat
  negated to `< 1` in a plain hide rule keeps only the ones with the stat, relying on the missing-stat-is-0
  assumption; a "Test tab" link sets `?tab=test`),
  then the conditions in sections (Which items, Item properties, Stats, Where and when) and an Actions card
  with `ActionsEditor owner="rule"`. Every change dispatches `patchRule`; an emptied list removes its key. A condition
  whose file value had the wrong shape (kept in `passthrough`) gets a note; every passthrough key is listed read-only in
  a collapsed "Advanced / passthrough" block.
- **Controls**: item, type, unique/set and area pickers (chips with name + code/id; more than 12 chips collapse behind
  "+N more"); named matches (`quality`, `baseTier`, `difficulty`): any / one / several / range, picks stored as names,
  file numbers kept until that part changes (`utils/matchValues.ts`); number matches (`itemLevel`, `sockets`,
  `maxSockets`): any / exactly / list (`1, 2, 3`) / range (min only or max only allowed); flags any / yes / no; stat
  check rows: stat picker, optional param, op (`>=` for new rows), value, two values for `between`
  (`utils/statChecks.ts`). The four stat lists are labelled "Item stats, all of" / "Item stats, any of" (`itemStats`,
  `itemStatsAnyOf`: the item on the ground) and "Character stats, all of" / "Character stats, any of" (`playerStats`,
  `playerStatsAnyOf`: your character, not the item), because users mistook "Item stats, any of" for the player list;
  the rule summary prefixes character checks with `character` (`character any of strength <10`), the Test tab says
  "Character level" and "More character stats". The two item stat lists also have "Browse affixes…" after "Add stat
  check" (the affix browser below), and a line under the Stats section says the game checks item stats, not
  affix names; `location` checkboxes (none = on the ground); `activeInLevels`: "Every level" or a tick per
  filter level, unknown ids listed with a remove button. Unticking every level writes `activeInLevels: []` (the
  validator warns about the empty list); ticking "Every level" removes the key.
- **Pickers** (`components/pickers/index.ts`): `MultiPicker` / `SinglePicker` (Popover + cmdk with our own filter,
  `utils/pickerSearch.ts`: every term in name or code/id, exact and prefix matches first, at most 200 shown with "type
  to narrow"; Enter picks the highlighted option; the "Add code …" entry for typed values comes last) and the wrappers
  `ItemPicker`, `SingleItemPicker`, `ItemTypePicker`, `StatPicker`, `AreaPicker`, `UniqueOrSetPicker`. Non-spawnable
  weapons and armor are greyed with "shadow base" (tooltip: they exist only as a unique's base or as a cube result),
  misc items with `drops: false` with "never drops"; non-spawnable misc items that drop (the Ancient Scrolls, Ore) look
  like any other (`itemMutedState` in `utils/lookup.ts`, shared by the options and the chips). Two or more unmuted
  items sharing a display name get their code in the option label ("Ko Rune (r19)" / "Ko Rune (r68)"; ESR 3.2.24: 24
  names, 277 items, mostly containers and the 50 Ancient Scrolls); a muted twin keeps the plain name and is told apart
  by its hint (Hand Axe `hax` / `p01` "shadow base", Fu Rune `r32` / `r48` "never drops"). The search still matches the
  plain name. Item options show their type (`hax · Axe`) and also match the names and codes of
  every type the base counts as (`type` and `type2` with their ancestors, the option's `searchMore`), ranked after the
  name and code matches, so `helm` lists the helms named Helm first, then Demonhead and the rest. In `MultiPicker` the
  "Add …" button comes before the chips (the popover stays put as chips are added), a pick keeps the search, clicks on
  the picker's own chips do not close the list, and the popover has a fixed height (it does not flip as the matches
  change); the search, the highlighted option and the scroll position survive closing and reopening (the search text is
  selected on open, so typing replaces it). While searching, the item and type pickers offer "Add all N items" /
  "Remove all N items" for every match, not only the 200 shown (`bulkPick`): adding skips the muted options and names them
  by hint ("2 shadow bases, 1 never-drop item skipped", `skippedByHint`), removing applies once every other match is picked, and above 50 values the button asks for a second click
  ("Add N items? Click again"). `SinglePicker` closes on a pick and starts with an empty search. Uniques and sets share
  the id space (a unique and a set item can have the same row), so a chip names both. Without the bundles the pickers
  still take typed codes and ids. `ItemPicker` (item codes and except item codes, not the Test tab's `SingleItemPicker`)
  also has a "Browse items…" button after "Add item" that opens the item browser below; `UniqueOrSetPicker` (unique or
  set items and their except list, not the Test tab's single unique/set picker) has a "Browse uniques and sets…"
  button that opens the unique and set browser.
- **Data**: `useLootFilterData()` → `{ status, data, types, lookup, options }`; `lookup` (`utils/lookup.ts`) has `item`,
  `itemName`, `itemType`, `typeName`, `statName`, `statId`, `areaName`, `uniqueOrSetName` (all `undefined` for unknown
  keys or missing data); the lookup and option lists are built once per loaded bundle pair (module cache). An item
  option's type search leaves out the `merc` type: ESR names that mercenary-equipment umbrella type "Helm" and makes it
  a parent of gloves, boots, belts and more, so `helm` would list them all.

### Item browser (`components/pickers/ItemBrowserDialog.tsx`, `BrowserGroups.tsx`, `utils/browserModel.ts`, `baseBrowser.ts`, `miscBrowser.ts`)

A wide dialog ("Browse items", `sm:max-w-5xl`, at most 85vh, the body scrolls) for ticking item codes by type, tier
or quality, asked for by a filter author ("all axes, then untick one"; "Cap - War Hat - Hood on one line"). Two tabs,
**Bases** and **Misc** (`role="tablist"`; arrow keys, Home and End switch tabs; the dialog opens on Bases). Both tabs
share one draft, one search box, one "N selected" counter and one Apply / Cancel.

- **Data**: `bases.json`, `types.json` and `lootfilter.json`, loaded when the dialog opens (`useGameData`; loading and
  error states as on the Game Data pages; `lootfilter.json` is the bundle the pickers already load, cached per file).
  Each tab's model is built once per loaded bundle set (module caches, `getBaseBrowserModel`, `getMiscBrowserModel`).
  Non-spawnable bases are not listed (they exist only as the base of a unique or as a cube result, Vessel of Souls);
  the dialog's description points to "Add item" for those.
- **Shared model** (`browserModel.ts`, also used by the unique and set browser): groups → types; a type is a `grid`
  (named columns, rows with one cell per column, extras below the rows), `columns` (each column a list of its items
  side by side, extras below) or a `list`. A cell selects its `code`, or its `codes` when it stands for several values
  (merged unique rows); a cell with `disabled` (its reason) is greyed, cannot be ticked and counts toward no checkbox;
  `tag` replaces the monospace code. A column has a key, a label and, for the base tiers, a tier (rendered as
  the tier badge; other columns get a plain label badge). Each column header is a tri-state checkbox for that column;
  group and type headers are tri-state checkboxes with "selected/total". Below `md` the columns stack and each cell
  shows its column badge.
- **Bases tab** (`baseBrowser.ts`, a thin mapper over game-data's `utils/baseFamilies.ts` → `buildBaseFamilies`, which
  the Bases page families view shares; imports only go loot-filter → game-data): every spawnable base, in the type groups of `buildTypeGroups` (Weapons, Class weapons, Armor, Class
  armor, Accessories, Class accessories; collapsible), one block per type. A type with exceptional or elite bases is a
  grid Normal | Exceptional | Elite with one row per family (`family` codes), ordered by the lowest member's qlvl; its
  mythical bases follow under their own "Mythical" checkbox. A base that is not its family's member for its tier
  (ESR's duplicates such as `q86`, `qdf`) gets a row of its own; a family spanning two types (the claws, `h2h1` /
  `h2h2`) sits under its lowest member's type. Types without exceptional or elite bases (accessories, quivers, throwing
  potions) are a plain list. A cell: checkbox, name, code, one stat line (damage or defense, block, speed for weapons,
  required level/str/dex, max sockets as `N os` with the per-ilvl caps in the tooltip, qlvl). The toolbar adds
  tri-state toggles for Normal / Exceptional / Elite / Mythical (this tab only).
- **Misc tab**: every `kind: 'misc'` item with `drops` (spawnable, or non-spawnable but named by a treasure class:
  the Ancient Scrolls, Ore, Fake Note…; no badge, they drop like anything else) of `lootfilter.json` whose code is not in `bases.json` (rings,
  amulets, charms and jewels stay on the Bases tab under Accessories), in bundle (misc.txt) order. Cells show name and
  code only.
  - _Groups_: the item type's chain up `parents[0]` ends at the topmost type below `misc` (or at a type without
    parents, such as `ques`, `mmap`); that type is the group, labelled with its types.txt name. The groups `sock`,
    `cube`, `poti`, `ques`, `mmap` come first in that order (`PREFERRED_MISC_GROUPS`, the only hand-written list), the
    others follow alphabetically by label.
  - _Blocks_: one per type right below the group root on that chain (the root itself for its own items), so the seven
    gem types share one "Gem" block and the rejuvenation potions sit under Healing Potion.
  - _Containers left out_: an item type whose items (more than one) all share one name is a stack of containers
    (Rune Stocker, Rerolling Orb, Decal Stocker…); such types are not listed and the tab's hint names them. The hint also says items that never drop (cube-only
    results, Vessel of Souls transform bases) are not listed and are found with "Add item". They stay
    reachable through "Add item" and the item-type picker.
  - _Quality families_: the ladder is the set of item types the items use as `type2` (`gem0`…`gem5`), ordered by their
    first use; each ladder word is the type name minus the words all of them share ("Chipped Gem" → "Chipped"). An
    item named `<ladder word> X`, where X is the name of another item in the same block, joins family X under that
    word's column; X itself goes to the column of its `type2`, or without one to the grade whose items carry no prefix
    (Standard: the crystals' unprefixed members have no `type2`). Families become grid rows (Chipped, Flawed, Standard,
    Flawless, Blemished, Perfect for the gems; Chipped, Flawed, Standard for the crystals; only the columns in use);
    the block's other items (the runes below the crystals) follow as a flat list. Grouping by `type` or by code pattern
    would be wrong: Obsidian is typed like Amethyst and the Perfect codes are irregular.
- **Search**: every whitespace term must match. A base row matches on its bases' names, codes and type name + code; a
  misc item on its name, code, type and block names + codes, column label and group label (so "perfect" finds the
  Perfect gems, "rune" the runes and crystals). A grid row matches as a whole; empty types and groups hide. The search
  applies to both tabs, the tab labels show the match counts while searching, and the current tab stays. Every bulk
  checkbox acts on the items shown, so while searching only on the matches.
- **Apply**: the dialog edits a draft (the picker's values that either tab lists); Cancel, Escape or the close button
  drop it, and focus returns to the button. Apply keeps every value the browser does not list (shadow bases, container
  items, typed codes) in place, removes the browser's codes the draft no longer has and appends the new ones in display
  order, bases first (`applyBrowserSelection`); nothing is dispatched when the values do not change.

### Unique and set browser (`components/pickers/UniqueSetBrowserDialog.tsx`, `BrowserTabs.tsx`, `utils/uniqueBrowser.ts`)

The item browser's sibling ("Browse uniques and sets", same size and behaviour) for the `uniqueOrSetIds` and
`excludeUniqueOrSetIds` pickers. Two tabs, **Uniques** and **Sets** (the tab list is `BrowserTabs`, shared with the
item browser), one draft of row ids (strings in the draft, numbers in the rule), one search box, one "N selected"
counter and one Apply / Cancel.

- **Data**: `bases.json`, `types.json`, `lootfilter.json` (`uniques` / `sets` with `reqLvl`, `set`, `disabled` and
  `coupon`, see GAME-DATA.md) and `tiers.json`, loaded when the dialog opens; the model is built once per bundle set
  (`getUniqueBrowserModel`). Uniques on non-spawnable shadow bases (about 400) are listed like the others.
- **Coupon uniques are not listed** (`coupon: true` rows, ESR 3.2.24: 382, #699–1069 without Annihilus #1059 and
  #1377–1388): they are cubed from three Ancient Coupons and never drop, so they only clutter the tables. The Uniques
  tab's footer says so ("382 coupon uniques are not listed: they are cubed from Ancient Coupons and never drop. Add one
  by name or id with "Add unique or set item"; ids already in the rule stay on Apply"); the picker still offers them.
  A coupon id already in the rule is not in the browser's codes, so Apply keeps it like any unlisted id. The shared-id
  warning still knows coupon uniques (a set item's id also matches the coupon unique with that id; none in 3.2.24).
- **Cells**: name, base code (tag), then base name · `Lvl N` (required level) · `#id`. Rows of one table with the same
  name, base and disabled flag are one cell that selects all their ids (ESR 3.2.24: Ember of Creation ×230 on the
  Mythical Jewel, Ore ×16, Lich King's Essence ×6, The Ties That Bind ×7, two ×3); a cell of more than 10 rows shows the
  row count and lists the id runs in its tooltip. Disabled rows (`disabled` in the txt: The Perfect Cello #0 and the
  six Rupture charms #690–695) are greyed with "disabled in the game files" and cannot be ticked; an id typed into the
  picker stays (Apply keeps values the browser does not tick).
- **Uniques tab**: the base's item type (`lootfilter.json` `items[].type`, shadow bases included) is the block; blocks
  sit in the type groups of `buildTypeGroups` over `bases.json` (Weapons … Class accessories). A type no spawnable base
  has goes to the group of its nearest listed ancestor type (Odd Charm → Grand Charm → Accessories) after that group's
  listed types, else by kind and class (Weapons / Class weapons / Armor / Class armor) or **Misc** (Ore, Randomizing
  Stone). The base tier comes from `tiers.json` (every weapon and armor row) and, for the mythical accessories, from
  `bases.json`. A weapon or armor type with tiered bases is a `columns` block Normal | Exceptional | Elite, each column
  sorted by required level, then name; its uniques on mythical bases follow under a "Mythical" checkbox (bases without a
  tier would follow without one). Other types (rings, amulets, charms, jewels, quivers, Ore) are a list by required
  level, mythical accessories with their badge.
- **Sets tab**: one "Sets" group with a block per set (`set`, so the three difficulty variants of a hireling set are
  one block), ordered by the lowest required level of its items, then name; items in table order, with the tier badge
  of an exceptional, elite or mythical base.
- **Search**: every whitespace term must match the cell's name, base name, base code, set name, type name or code,
  group label, column label or one of its ids. Tab counts while searching as in the item browser.
- **Shared ids**: unique and set item ids are one id space (`uniqueOrSetIds` matches the row number of either table and
  the plugin ignores the quality when matching; ESR 3.2.24: all 270 set ids are also unique ids), so a ticked id is
  ticked on both tabs. While a ticked id is in both tables and the edited rule's `quality` does not let through exactly
  one of set and unique (`qualityTellsApart`: no quality, `magic` and up, `[set, unique]`…), the footer warns
  "id N is both unique X and set item Y; set the rule's quality to unique or set" (three ids named, then a count). The
  dialog reads that quality from the store (the selected rule), so `RuleEditor` passes nothing extra.
- **Apply**: as in the item browser (`applyBrowserSelection` over the listed ids, uniques first, each id once).

### Affix browser (`components/pickers/AffixBrowserDialog.tsx`, `utils/affixBrowser.ts`)

The plugin matches item stats (itemstatcost names or ids), never affix names, but filter authors think in affixes
(Jagged, Deadly, Cruel… = enhanced damage; "of Mastery" = enhanced damage + IAS). "Browse affixes…" next to "Add stat
check" in `itemStats` (all of) and `itemStatsAnyOf` (any of) opens a dialog of the same size as the item browser
("Browse affixes", one search box, "N stats selected", Apply / Cancel; Escape or the close button drop the draft and
focus returns to the button).

- **Data**: `affixes.json` (`stats` per affix and the top-level `stats` list, see GAME-DATA.md "Affixes"), loaded when
  the dialog opens, with the Game Data loading and error states. The model is built once per loaded bundle.
- **Rows** (`buildAffixBrowserModel`): one per item stat some affix writes, sorted by label: checkbox, label, the stat
  name muted, then the affixes writing it as muted text sorted by affix level ("Jagged, Deadly, … (28 prefixes, 3
  suffixes, 5 automods)"). ESR repeats affix rows per item type and level band; one entry per name, kind and stat set is
  kept (the lowest level). A hybrid names its other stats ("of Mastery (+Increased Attack Speed, +Monster Defense Per
  Hit)"), automods say so ("Sharp (automod, +Attack Rating)"), nameless automods show as "unnamed automod". The first 8
  are shown, "+N more" / "Show less" toggles the rest; a search that matches an affix past the first 8 shows the whole
  list, and matching affix names are emphasised.
- **Enhanced damage**: `dmg%` writes both `item_maxdamage_percent` (17) and `item_mindamage_percent` (18). The browser
  shows one "Enhanced Damage" row on 17 and hides 18 wherever an affix writes both (every ED affix in ESR 3.2.24), so
  a tick writes one check on `item_maxdamage_percent`; an affix writing only one of them would keep it as its own row.
- **Search**: every whitespace term must match the label, the stat name, an affix name, or (digits) the stat id.
- **Apply** (`applyAffixSelection`): the draft starts with the listed stats that already have a check in that list
  (by name or id, any op, value or param). Apply keeps checks on stats the dialog does not list and on stats still
  ticked (unchanged), removes checks on listed stats that were unticked, and appends `{ "stat": <name>, "op": ">=",
"value": 1 }` (a presence check, by name as the stat picker writes it; the user sets the number afterwards) for each
  newly ticked stat in display order; an emptied list removes the key, and nothing is dispatched when nothing changes.
- **Any-of note**: opened from `itemStatsAnyOf`, the footer says "An item matches when ANY ticked stat is present; a
  hybrid affix gives all its stats, tick them in the all-of list to require both."
- Not built: an "Except" (inverted) mode, deferred in the backlog.

## Actions editor (`components/actions/`)

`ActionsEditor` (`actions`, `onChange(patch)`, `filter`, `owner: 'rule' | 'style'`, `styleName?`) is the form for every
action key; the rule editor and the Styles tab both render it. Every control sends a shallow patch (`{ key: undefined }`
removes the key); `passthrough` is never patched. Sections:

- **Label preview** (top): `LabelPreview` of prefix + (`replaceName` or `{name}`) + suffix in enUS, with `{name}` shown
  as "Item Name" and other placeholders as written; background and border from the effective actions. For a rule with
  `useStyle`, the style's actions are underneath and the rule's own win, per key (`utils/effectiveActions.ts`).
- **Style** (rules only, `StyleSection`): `useStyle` select (None, every style, a missing name kept as "(missing)"); a
  collapsed read-only list of the style's actions (`StyleSummary`; its `comment` is shown but not counted). A rule's
  `comment` belongs to the rule editor; a style's is a one-line field under **Notes** ("A note for yourself; the plugin
  ignores it.").
- **Visibility**: `hide` (hint: no later rule runs, and no rule can show it again), `hideIfOtherConditionsFail`
  (checkboxes; unchecked removes the key), `chatMessageWhenHidden`.
- **Name**: `replaceName`, `namePrefix`, `nameSuffix`. **Chat**: `chatMessage`, `notify` (the hint shows the filter's
  effective drop line).
- **Label** (`LabelSection`): `labelBackground` (colour + alpha, default alpha 242), `labelBorder` (colour + alpha, width; "Add border" /
  remove).
- **Sound**: combobox over the 9 bundled files and the sounds.txt names (digits typed free become a row number), play
  button for bundled files (an `Audio` at `soundVolume ?? filter.soundVolume ?? 100`), "preview a local file" input
  (object URL, revoked on change/unmount), `soundVolume` (blank = filter default). The hint says where sounds come
  from: a file in the `sounds` folder next to the filter (the bundled ones from Sully's QoL) or a game sound by its
  sounds.txt name or row, which needs no file (sounds.txt is a table in the mod's game data); such a sound has no
  preview ("a game sound plays from the game's files").
- **Minimap icon**: on/off (turning it on gives `{ iconName: 'goldstar', iconSize: 50 }`; the sprite's own size is
  200 px), `iconName` (suggests every bundled icon, `BUNDLED_ICONS`), `iconSize` (4–256, blank = file size), tint
  (alpha optional), sprite preview.
- **Droplight**: on/off (`{}`), a beam colour or "the game's white beam".

Text fields (`ColorTextField`) take raw `ÿc` codes and have two insert menus: colour codes (swatch grid of `COLOR_CODES`)
and the placeholders of the field's context (`names` for names, `chat` for chat lines, `dropFormat` and
`levelChangeFormat` for the Settings tab's notification lines); the token goes in at the caret
(`utils/insertAtCaret.ts`) and, once the menu has closed, the field gets the focus back with the caret after the token
(the popover's `onCloseAutoFocus` is prevented, else Radix would focus the menu button). Below the field a small preview; a `{...}` token the guide does not know, or one that does
not work in that context, gets a hint. Per-language texts are read-only ("multi-language text, edit in the JSON tab").
`ColorControl` is a native colour input + optional alpha slider + `[r, g, b(, a)]` readout + clear
(`utils/colorValues.ts`).

Previews: bundled assets are listed in `utils/bundledAssets.ts` (the nine `public/loot-filters/sounds/*.mp3` and the
twelve `public/loot-filters/icons/*.sprite`, names in the files' own case because the app's server is case-sensitive;
an `iconName` in any case finds them). `useSoundPreview` plays one `Audio` at a time across the page and stops on
unmount. `useBundledSprite` fetches and decodes a bundled sprite once per name; any other icon name offers a local
`.sprite` picker. The canvas draws the first frame at `iconSize` (longer side) with the tint applied
(`utils/tintSprite.ts`: RGB × colour/255, alpha × colour[3]/255); a decode error shows the decoder's message. A sounds.txt
sound has no preview (it plays from the game files).

## Test tab (`components/TestTab.tsx`, `components/test/`, `utils/testItemForm.ts`)

Runs the engine's `evaluateFilter` against an item the user describes. Two columns from `lg` up (form left, result
right, sticky), stacked below. The form is local state (`TestItemForm`, start value `defaultTestItem()`: no item, Rogue
Encampment, normal difficulty, character level 1, the filter's default level), held by the editor screen so it survives
tab switches; it is not saved.

- **Presets**: Zod rune on the ground (`r83`), Unique bow, 2 sockets (`m01`, unique), Gold pile 1500 (`gld` with
  stat 14 = 1500, the stat Sully's gold rules check), Rare ring (`rin`), and Reset. A preset replaces the item fields
  and keeps the context; names and types fall back to built-in values without the game data. The base tier comes from
  the game data (none for the mythical bow and the ring).
- **Item**: item picker (fills the name, the item type and the base tier from the bundle), name (`{name}`, editable),
  item type (typed when the data is missing; the hint lists the ancestors type conditions match), quality, base tier
  (normal / exceptional / elite from the picked item's `tier` in `lootfilter.json`, or "none" for an item without a
  tier family: rings, amulets, charms, jewels, arrows, mythical bases, unknown codes; it can be changed, and picking
  another item resets it), location,
  item level, sockets, max sockets, identified / ethereal / runeword / fully socketed, a unique or set item (picking one
  switches to its base and name, and sets the quality to unique or set unless the user chose a quality) and item stat
  rows (stat, optional param, value; incomplete rows are ignored).
- **Context**: difficulty, character level (sent as player stat 12), area (with an "in town" hint for 1/40/75/103/109),
  filter level (the filter's levels, default marked) and more character stat rows.
- **Conversion** (`utils/testItemForm.ts`): `toTestItem(form, lookup)` (type ancestors from the `types` bundle via the
  lookup, `typeAncestorsOf`: the union of the item type's ancestors and, while the type is the base's own, its `type2`'s;
  without the data only the typed type), `toTestContext(form, filter, lookup)` (stat ids by name from the lookup), `applyPreset`, `withItem`, `withUniqueOrSet`. The unique/set picker uses the option keys
  (`Unique:12`, `Set:12`) as values because the two tables share ids.
- **Result**: the ground label (`LabelPreview` with the rules' background and border; text before the first colour
  code in the game's quality colour) or "Hidden: no ground label" with a link to the hiding rule; chat lines (each a
  `LabelPreview` with default colour `ÿc0`); sounds with volume (play button for the bundled files); minimap icon and
  droplight. The evaluation runs on every change; above 1500 rules a Run button runs it instead.
- **Rule trace**: one row per rule that ran, in order: number, outcome badge (applied green, hidden and "hidden: other
  conditions" red, skipped muted, disabled muted with a dashed border and the row dimmed), style, `ruleSummary`, and
  the failed condition keys as chips. Skipped and disabled rules are hidden unless "Show skipped rules (N skipped, M
  disabled)" is ticked. A row opens the rule in the Rules tab (`selectRule` + `?tab=rules`).
  After a hiding rule the note says how many rules did not run.
- **Assumptions (verify in game)**: a collapsed, shortened list of the evaluator's assumptions that points here for the
  full list ("Verify in game" below), plus the note that `{string:KEY}` is shown as written.
- While the bundles load (or when they fail) a hint says that typed codes work but item-type conditions only see the
  typed type.

## Phase status

| Phase | Content                                                                                       | Status                                                    |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1     | Engine: model, JSONC parse with passthrough, serializer, validator, evaluator, sprite decoder | done                                                      |
| 2     | `lootfilter.json` reference bundle (items, stats, areas, sounds, uniques, sets)               | done                                                      |
| 3     | Library, routes, editor shell and state, Settings tab, JSON tab                               | done                                                      |
| 4     | Rule builder with pickers, style editor, label preview                                        | done (rule builder, actions editor, Styles tab, previews) |
| 5     | Test-item tab with a rule trace                                                               | done                                                      |

## Verify in game

Assumptions the engine makes where the guide is silent (from the engine file headers). This is the one full list; the
research doc and the Test tab's note link here.

- `activeInLevels` is a precondition: a rule inactive at the current level is skipped and never hides, not even with
  `hideIfOtherConditionsFail`.
- The `hideIfOtherConditionsFail` gate is `itemCodes`, `excludeItemCodes`, `itemTypes`, `excludeItemTypes` and
  `location`; every other condition is an "other condition".
- A hidden item keeps no label colours, border, icon, droplight, chat lines or sounds from earlier rules; its only chat
  line is the hiding rule's `chatMessageWhenHidden`. The hiding rule's other actions do not apply.
- `replaceName`, `namePrefix` and `nameSuffix` are each "later wins" on their own.
- `notify: true` prints the drop line unless the rule's effective actions (style included) have a `chatMessage`.
- `{name}` in every text, the drop line included, is the game's name, not the filter's changed name.
- A stat check without `param` holds when any entry of that stat satisfies it; an entry without param has param 0; a
  missing stat is one entry of value 0.
- `{stat:ID}` without a param shows the first entry of that stat; ID may also be an itemstatcost name.
- `{ethereal}` expands to `Ethereal` for ethereal items and to nothing otherwise.
- `hideUnmatchedItems` hides an on-ground item no rule applied to.
- Colour codes `ÿcN` to `ÿcV` use preview approximations (the guide gives no RGB for them).
- `.sprite` icons: header layout and RGBA pixel order as observed in `goldstar.sprite` (Sully's other eleven icons decode
  the same way); only the first frame is drawn.
- The serializer does not keep comments between rules (only the `//` lines before the object) and writes no trailing
  commas or block comments; the reader accepts both, as the plugin does (v1.5.3, from its disassembly). A warning says
  so when a file has them.
- `disabledRules` is ignored by the plugin with one "unknown setting, ignored" log line (from the plugin's strings,
  not yet seen in a game log); the rules in it never run.
- An empty condition list (`activeInLevels: []`, …) logs "the list is empty"; whether the plugin then drops the key or
  switches the rule off is not known (our evaluator: an empty `activeInLevels` is never active).
- `uniqueOrSetIds` are 0-based row numbers of uniqueitems.txt / setitems.txt (equal to `*ID` in ESR 3.2.12).
- A numeric `sound` is a 0-based data row of sounds.txt (`*Index` is unreliable: it repeats for the Leoric taunt rows).
- An item with a `type2` counts as both types for item-type conditions (the Test tab and the never-matches warnings use
  the union of both types' ancestors).
- An item without a normal/exceptional/elite family (rings, amulets, charms, jewels, arrows/bolts, ESR mythical bases;
  its `normcode`, `ubercode` and `ultracode` are its own code) matches no `baseTier` condition, and `{baseTier}` is
  empty for it. A reported in-game test only shows that a ring is neither normal nor exceptional for the plugin. Verify
  with `debug_log = true`: the plugin's log line prints `tier %d` for each item.

### Troubleshooting in game

- **Chat lines do not print:** run `lootfilter` in the console; its output lists the hooks, "drop alerts" among them.
  Then read `d2rloader\logs\celestialrayone.loot-filter.log`: a feature the plugin switched off after its D2RLoader
  version check is named there. `debug_log = true` in `celestialrayone.loot-filter.toml` logs every chat line printed
  (and every item decision).
- A `notify` / `chatMessage` line prints when the item drops or comes into view.
- A sound or icon the filter names but its folder lacks is logged; the rule keeps working without it.

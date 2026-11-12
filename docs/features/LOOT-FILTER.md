# Loot Filter (editor for ESR's loot filter plugin)

An editor for the JSON loot filter files that ESR's loot filter plugin reads (since ESR 3.2.09). Filters are drafts in
the browser's localStorage until the user saves them to their account (Supabase; public unless marked private, see
[FEATURE-LOOT-FILTER-SHARING.md](../../builds-feature-docs/FEATURE-LOOT-FILTER-SHARING.md)), and are downloaded as
files for the ESR launcher. Format reference:
[ESR-LOOT-FILTER-GUIDE.md](../../builds-feature-docs/loot-filter/ESR-LOOT-FILTER-GUIDE.md). Research and owner
decisions: [FEATURE-LOOT-FILTER-RESEARCH.md](../../builds-feature-docs/FEATURE-LOOT-FILTER-RESEARCH.md) §4.1 (the format
answers), §5 and §5.1 (owner decisions).

## Routes

| Path                           | Screen                  | Notes                                                                                                                                                      |
| ------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/loot-filters`                | LootFilterLayout        | Frame for every loot filter page (the page width only)                                                                                                     |
| `/loot-filters`                | LootFilterLibraryScreen | The library: tabs Shared and My filters (`?tab=shared\|mine`), see Library screen                                                                          |
| `/loot-filters/draft/:draftId` | LootFilterEditorScreen  | A draft in this browser (a new filter, or unsaved edits of a saved one); unknown id: not found                                                             |
| `/loot-filters/:id`            | LootFilterEditorScreen  | A saved filter: its owner edits it, anyone else gets the sandbox; a local draft id redirects to the draft route (old links); not found / load error states |
| `/loot-filters/sully`          | LootFilterEditorScreen  | The sandbox on the bundled Sully filter                                                                                                                    |
| `/loot-filters/example`        | LootFilterEditorScreen  | The sandbox on the bundled example filter                                                                                                                  |
| `/loot-filters/ai`             | LootFilterAiScreen      | Create a filter with AI help: the LLM prompt package and the first Import AI answer (see "AI help")                                                        |

The editor routes share one screen component (the param names, or the path of a template sandbox, tell them apart:
`editorRouteOf(params, pathname)` in `utils/editorRoute.ts` gives `draft`, `saved` or `{ kind: 'template', template }`),
so Save and Copy to my filters replace the route without remounting the editor. All take
`?tab=rules|styles|settings|json|test` (default `rules`); `?save=1` on a draft or saved route opens the Save dialog
(the library's draft cards use it; it is dropped from the URL when the dialog closes or the save moves the route).

The loot filter routes skip the HTM "Loading data..." gate (`isStaticBundlePath` in `src/core/layouts/staticBundleRoutes.ts`, see
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
`gem2`, `gemP`, `goldstar`, `map`, `Myth`, `redD`, `rune`, `scroll`, `star`), plus the mod's `goldstar.lowend.sprite`
(100 px). The icons are shrunk to 128 px squares (2026-11, owner decision): his files are 512 px (`rune` 1080 px,
`goldstar` 200 px) of raw RGBA, 1 to 4.7 MB each (about 16 MB in all), but filters draw them at 27 to 50 minimap
pixels; at 128 px each is 64 KB (0.9 MB in all), still 2.5 times the largest size used, and a pre-shrunk icon avoids the
jagged edges of a huge texture drawn small. Lanczos on premultiplied alpha, same names (a .zip unzipped into
`LootFilters\` replaces Sully's originals there; his filter works the same with them). Next to them sit 25 icons drawn
for this app (`<shape>_<colour>`, e.g. `star_gold`, see [Generated icons](#generated-icons)). **Download .zip with sounds and icons** puts the filter
and the bundled files it references into one archive to unzip into `LootFilters\` (see Library screen).

Troubleshooting (also in the library how-to): if a sound or icon does not work, check the `sounds`/`icons` folders next
to the filter; if chat lines do not print, first check the launcher's chat notifications (Enable chat notifications),
then run `lootfilter` in the game console and read
`d2rloader\logs\celestialrayone.loot-filter.log` (set `debug_log = true` in the plugin's TOML to log every chat line).

## Storage model

- **Key** `loot-filters/library` in localStorage, value `{ "version": 1, "entries": [...] }`.
- **Entry** `{ id, name, source: 'blank' | 'upload' | 'template', createdAt, updatedAt, text }`; times are epoch ms,
  ids come from `crypto.randomUUID` (with a fallback). `name` is the library name, not the file's `title`.
- **Drafts** (sharing, see [FEATURE-LOOT-FILTER-SHARING.md](../../builds-feature-docs/FEATURE-LOOT-FILTER-SHARING.md)):
  the library is the draft store. Optional entry fields `savedId`, `savedOwnerId`, `savedRevision` (a draft holding the
  unsaved edits of a saved filter, and the revision it started from) and
  `basedOn { id?, revision?, template?, version?, label }` (a copy of a shared filter, or a start from a bundled
  template: `{ template: 'sullys-qol' | 'example', version, label: '<name> v<version>' }`, `templateBasedOn(id, version)`
  with the version of the text the start used, live or bundled). The
  guard checks only the required fields, so older tabs still read the library;
  `readLibrary` drops a malformed optional field (`normalizeEntry`) instead of rejecting the library. Old `template`
  entries without `basedOn` (written when only Sully's was bundled) get it from the file (`entryBasedOn` /
  `inferTemplateBasedOn` in `utils/basedOn.ts`): Sully's when its `title` is "Sully's QoL Filter" or its `author`
  "Sully", the example when its `title` is the example's, else none; at the file's `version` when it looks like one.
- **`text` is the source of truth**: the filter file exactly as it will be downloaded. An upload is stored verbatim
  until the first edit; the editor's model is parsed from `text` when the filter opens and serialized back after edits.
- A stored value that fails the type guard (corrupt, or written by a newer version) is copied once to
  `loot-filters/library.unreadable` before the library starts empty, so the next save cannot destroy it.
- A refused write (quota) shows one toast, "Could not save: browser storage is full", until a write succeeds again;
  editing keeps working in memory. The stored library stays as it was at the last good write, so what changed since
  (a new draft, edits) is lost on reload unless saved to the account or downloaded. The whole library is one value:
  Chrome allows 5,242,880 characters per origin (measured 2026-11-10), and a draft of Sully's v0.9.2 takes about 527k
  of them as stored JSON, so about nine such drafts fit; the tenth start fails the write.
- Two browser tabs editing the library overwrite each other: each writes its whole library, the last write wins. There is
  no cross-tab sync (no `storage` event listener).

## State (`src/features/loot-filter/store/`)

`lootFilter` slice, registered in `core/store/store.ts`:

- `library`: `{ hydrated, entries }`. Reducers: `hydrate(entries)`, `createBlank(name)`,
  `importText({ name, text, source, basedOn? })`, `duplicate(id)` (the copy keeps neither `saved*` nor `basedOn`),
  `rename({ id, name })`, `remove(id)`,
  `editorFlushed()`, `flushNow()` (the same flush, sent by Save before it reads the text).
- `editor.target` (`EditorTarget`) says what is open: `draft { entryId }` (a library entry; the flush writes it),
  `saved { savedId, revision, ownerId, name, baseText, baseCanonical, draftId, basedOn }` (the owner's saved filter:
  the flush creates the draft `draftId` on the first edit, updates it, and removes it when the model serializes to
  `baseCanonical = serialize(parse(baseText))` again; null when the content cannot be read) or
  `sandbox { savedId | null, revision, ownerId, name, baseText, basedOn }` (someone else's filter or the bundled template: editable, never
  written; `dirty` then means "edited since opened"). A flush writes only while `dirty`, and Save and Discard leave it
  false, so the 400 ms debounced flush pending from the last edit cannot re-create a draft they removed.
- Sharing reducers: `openSaved({ row, viewerId, authorLabel })` (owner → `saved`, on their newest draft of it if any;
  anyone else → `sandbox`, whose `basedOn` is "name by author" for a public row, none for a private one),
  `openSandbox({ text, name, basedOn })`, `saveSucceeded({ sentText, row, entryId })` (removes the draft if it still
  has the sent text, else re-bases it on the new revision; the target becomes or stays `saved` with the new base, model
  and selection kept), `discardChanges()` (saved: removes the draft and re-parses the content; sandbox: back to the
  original), `copyToMyFilters()` (sandbox → a new draft with the sandbox's `basedOn`, the editor switches to it;
  `payload.id` is the new id), `takeUpdate({ text, basedOn, mode: 'replace' | 'new', name? })` (replace writes the
  draft right away with the new `basedOn`; new adds a draft), `savedFilterRenamed({ savedId, name })` (the Details
  dialog renamed it on the server: the open target and that filter's drafts take the name). `saveSucceeded` also moves
  a `saved` target whose draft was sent (Save as a new filter) to the new row.
- Selectors for the editor: `selectEditorText`, `selectEditorName`, `selectHasUnsavedChanges`, `selectSaveRequest`
  (what Save sends, read after `flushNow`), `selectEditorBasedOn` (the draft's `basedOn`, else the saved row's; what
  the Update available banner compares), `selectVisibleDrafts(viewerId)`.
- `editor`: `{ target, filter, parseDiagnostics, textNotes, selectedRule, dirty }`. Reducers: `open(id)` (a `draft`
  target; parses the text; a JSONC syntax error leaves `filter: null` and one error diagnostic), `close()`, `setHeader(patch)`, `setFilterLevels(levels)`,
  `setNotifications(patch)`, `setQualityColors(patch)`, `addRule({ rule?, at? })`, `addCustomRule({ at? })` (the main Add rule button, see
  "Custom rules in Protection"), `updateRule({ index, rule })`, `patchRule({ index, patch })` (setting the rule's own
  `hide` drops its own `show` and the other way round, see "Show action"), `chooseRuleStyle({ index, patch, addStyle?, removeStyleIfUnused?, ifUseStyle? })` (the
  rule's Style dropdown, see [Style first, then tweak](#style-first-then-tweak)), `setRuleDisabled({ index, disabled })`
  (see "Disabled rules"), `removeRule(index)`,
  `stepRule({ index, direction })` (one step with the rule's own notes, see "Section comments"), `moveRule({ from, to })`
  (steps until index `to`) and `duplicateRule(index)` (all keep the `disabled` flag with the rule), `selectRule(index)`,
  `setStyle({ name, style })`, `renameStyle({ from, to })` (also re-points rules' `useStyle`), `removeStyle(name)`,
  `replaceFilter({ filter, diagnostics, notes? })`.
- **Persistence** (`lootFilterSaga.ts`): every reducer that edits the open filter is in the saga's `isEditorMutation`
  list, which starts the 400 ms debounced flush into the library; one missing there keeps its edit in memory only, until
  another edit flushes it (a reload in between loses it: `addRules` and `chooseRuleStyle` both shipped that way and
  were added on 2026-11-05). `lootFilterSaga.test.ts` fails while a slice action is neither in that list nor in its
  list of known non-edits (library actions, `selectRule`), so a new reducer has to be classified.
- **Reading is lenient, writing strict**: `engine/jsonc.ts` reads what the ESR loot filter plugin (v1.5.3, unchanged in the 1.8.2 guide) reads, so
  besides `//` line comments it accepts `/* */` block comments and a single trailing comma before `]` or `}` (Sully's
  launcher filter ends its rules with `},` + `]`); `[1,,2]`, `[,]` and an unclosed `/*` stay syntax errors. Comments and
  trailing commas are blanked to spaces, so `JSON.parse` offsets are the source's; when the engine's message has no
  position (V8's `Unexpected token ']'`) a small strict scanner finds it, so a syntax error carries its line and column.
  The serializer always writes strict JSON.
- **A single-number level** (`"activeInLevels": 4`): the format wants a list, but the plugin accepts one number (verified in
  game with the Ancient Scroll hide rule of Sully's template), so the parser reads it as `[4]` with a warning at the key ("A single number
  works in game; [4] is the documented form."), not an error. Any other wrong shape (`"4"`, an object) stays a
  wrong-shaped key in `passthrough` with an error. The rule keeps the editor-only `activeInLevelsNumber: 4` (never a
  key in the file), and the serializer writes `4` back while the levels are still exactly `[4]`, so a rule the user did
  not touch is downloaded as it was (the key moves to its canonical place, before the actions); once the levels are
  edited the list is written and the warning goes away. The validator checks the number like a list entry (an unknown
  level is an error at `activeInLevels`).
- **Localised level names** (plugin 1.8.2, ESR 3.3): a `filterLevels` name is a `FilterText` like every other text
  (the guide: "Any text can be one string or one string per language"); Sully's v0.7.0 names its four levels in 11
  languages. Before, the parser accepted only a string, so the whole `filterLevels` went to `passthrough` with an error
  and every `activeInLevels` then errored (96 diagnostics on v0.7.0). `levelName` (`engine/text.ts`) gives the enUS
  name for the level pickers (rule editor, Test tab in its game language, default level) and the library cards; the
  Settings name field edits the language a per-language name shows (`shownLanguage`: enUS, else the file's first) and
  keeps the other languages ("enUS; +10 languages", the rest in the JSON tab). Every other text field (names, chat
  lines, notifications) has a language select instead (`ColorTextField`, `withLanguage`): it edits one language, keeps
  the others and the key order, and "Add <lang>" starts from the enUS text. An emptied language stays in the model as
  `''`, so the field stays on it while typing; the file leaves it out (`pruneEmptyLanguages` in `toPlainJson`), and a
  text whose languages are all empty stays an object (`{ "enUS": "" }`).
  Shared filters keep the object in `loot_filters.levels` (`levelJson`; `readLevels` accepts a string or an object of
  known languages; the 4 KB check counts the nested object's separators as Postgres prints them).
- **Text notes** (`textNotes` in `engine/parse.ts`, returned by `parseLootFilter` as `notes`, apart from `diagnostics`):
  root-path warnings about the text itself, one per kind: "Trailing commas were accepted (first at line N); the game
  reads them, but downloads are written without them", "Block comments (/\* _/) were accepted (first at line N); …
  they are not kept", and "N comments are dropped on the first edit (first at line L); only whole-line // comments above a rule, a style or a setting are kept" (same-line comments, comments inside a rule, block comments; see "Section comments").`open`stores
  them in`editor.textNotes`(none for`template`entries: the shipped template's section comments are ours) and`replaceFilter`takes the applied text's. They are not sticky:`flushEditor` clears them when it writes the model back,
  because the written text no longer has what they describe (so after the first edit they go with the debounced save).
- Patches are shallow: an `undefined` value removes the key, and a patched key is also dropped from the object's
  `passthrough` (so a wrong-shaped original does not reappear on download). `setNotifications` and `setQualityColors`
  drop the whole object when it ends up empty.
- Ids and timestamps come from `prepare` callbacks, so every reducer is a pure function of (state, payload).
- Sharing selectors: `selectEditorTarget`, `selectEditorText` / `selectEditorName` (the open filter's stored text and
  name, whatever the target), `selectHasUnsavedChanges` (draft: always; saved: a draft or pending edits; sandbox:
  edited), `selectSaveRequest` (after `flushNow`:
  `{ kind: 'insert' | 'update', text, name, entryId, savedId, expectedRevision, basedOn }`, null with nothing to save
  or in the sandbox), `selectVisibleDrafts(state, viewerId)`
  (signed in: drafts of another account hidden; signed out: all, `needsSignIn` on those of a saved filter).
- Selectors: `selectLibraryEntries`, `selectLibraryEntry(state, id)`, `selectEditor`, `selectEditorFilter`,
  `selectDiagnostics(state, reference?)` (the text notes, then the model's shape diagnostics re-read through `readLootFilter(toPlainJson(filter))`, then `validateLootFilter`; the stored parse diagnostics are used only when the text is not valid JSON).
  The validator's reference holds Sets and Maps, so it stays out of Redux: `useLootFilterReference()` loads the `lootfilter` and
  `types` game-data bundles and passes the reference to the selector (module-level cache keeps its identity stable).
  Besides the known codes, types, stats, areas, sounds and unique/set ids it has `itemCodeTypes` (code → the union of
  the ancestors of its `type` and `type2`), `typeAncestors` (type → ancestors, itself included), `statNamesById` (to
  know a layered stat written by id) and `skillTabNames` (tab layer → "Assassin Martial Arts", from types.json
  `classes`).
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
  the plugin logs "the list is empty" and what it does then is not known. A check in `itemStats` / `itemStatsAnyOf`
  (by name or id) on a stat the plugin reads as 0 on some items (`engine/statQuirks.ts`, see "Known plugin limits"):
  Enhanced Damage (17, 18) on weapons, Enhanced Defense (16) on armour, Increased Maximum Durability (75) on weapons
  and armour, at `<list>/<n>/stat`; skipped when the bundle shows the rule's item codes and types cannot match such
  an item (a jewel or charm rule), never for the character stat lists. Each quirk also has a short `headline`
  ("Currently only works on jewels and charms (reads 0 on weapons)"; "Does not work on armour, helms and shields
  (reads 0)"; durability, untested: "May not work on weapons and armour (likely reads 0; not tested)") and a
  `confirmed` flag. The rule editor shows the headline under the stat check row (item stat rows and exception rows)
  in red, text-sm, medium weight (amber for the untested durability one) when `ruleStatQuirk` (`utils/statChecks.ts`,
  the validator's exported `mayHitQuirk`, so only when the rule's codes and types can match an affected item; always
  without item data) says so; `RuleDiagnostics` puts the headline in red before a confirmed quirk's warning
  (`quirkOfMessage`) and colours its icon red.
  Stat values (`engine/statScale.ts`, from itemstatcost.txt): plugin 1.8.2 reads every stat as the number the
  tooltip prints (the 3.3 guide, "Stat values"): Life, Mana and Stamina (ids 6 to 11, stored in 256ths) read 40 for
  +40, `item_howl` (112) and `item_fear` (213, stored in 128ths) read the percent, charges read the skill level, and
  the per-level stats (214–233, 238–240, 242, 244, 247, 250, 365: `op` 2, 4 or 5 with `op param` 3 on `level`) read the
  value at the character's level. So only a per-level check whose number matters gets a warning (at
  `<list>/<n>/value`: "… reads the value at your character's level, as the tooltip's "(Based on Character Level)"
  shows: 0.5 per level reads 0 at level 1 and 49 at level 99, so this check depends on the character level"); a
  presence check (`>= 1`, `> 0`, `!= 0`, or their exceptions `< 1`, `<= 0`, `== 0`) gets none, so Sully's template
  (rules 29 and 30, stats 218 and 219 `>= 1`) stays clean. Up to ESR 3.2.24 (plugin 1.5.3) the editor warned about
  the stored ×256 and eighths values, which nobody had checked in game. Disabled rules are validated like the
  others but do not count for "hides every ground item"; there is no filter-wide note about `disabledRules` (the
  Enabled checkbox's hint says the game ignores the key).
- Stat params (`checkStatParam`, every stat list, by name or, with the reference, by id; the layer kinds are
  `STAT_LAYER_KINDS` in `game-data/engine/statLayers.ts`, see GAME-DATA.md "Stat layers"): an error for a `param` that
  is not a whole number from 0; a warning above 65535 (a stat's layer is assumed to be 16 bits in memory, so the check
  likely never matches); warnings for a skill, skill tab, class, event or charged stat without `param` (at
  `<list>/<n>`, also for a hide rule's exceptions: "has one entry per skill tab; without "param" the plugin reads only
  the entry with param 0 (verified in game), not any skill tab. Pick a skill tab to check one"), an event or charged
  param below 64 (skill 0) or with level 0, and an `item_charged_skill` check that can never hold: plugin 1.8.2 reads
  charges as the skill level (the guide), at most 63, so `>=`, `>` or `==` a number above 63 gets a warning (plugin
  1.5.3 read `max charges << 8 | charges left`, 5/5 = 1285).
  - _Skill tab numbering_: the game stores a tab as `class << 3 | tab` (Assassin Martial Arts = 50) and the plugin
    compares `param` with that (verified in game on 2026-11-01: +4 to Fire Skills, Sorceress, showed in
    `{stat:188,8}`); properties.txt numbers them `class × 3 + tab` (Martial Arts = 20, Fire Skills = 3). The warnings
    stay warnings. A list with several tab params up to 23, at least one of which names no tab, gets one warning at
    the list (`<list>`, `propertiesTabNumbers`): "These skill tab params (1–21) look like properties.txt tab numbers
    (class × 3 + tab). The game itself numbers tabs class × 8 + tab …, and so does the plugin (verified in game): 13
    of these checks match no tab and 6 match a different tab than their number suggests" (params 0 to 2 are the same
    tab in both). A single tab param that names no tab gets its own warning at `<list>/<n>/param` ("names no skill
    tab: the plugin numbers tabs class × 8 + tab 0 to 2, as the game does (verified in game)"), naming the tab it
    would be as a properties.txt number ("; as a properties.txt tab number (class × 3 + tab) 21 is Warlock Demon
    Skills, which is param 56"). Sully's template up to v0.7.0 got 6 of these against the ESR 3.3 data: its three +3/4/5
    skill tab rules (rules 31 to 33) each checked stat 188 without param (one warning) and with params 1 to 21 (the list
    warning; 13 of them, 3–7, 11–15 and 19–21, name no tab). Since v0.9.0 they read every tab with
    `statMax('item_addskill_tab')`, and v0.9.2 gets no validator warning at all (the one on its stat-based hide at
    `rules/99`, `rules/73` up to v0.7.0, was the validator missing a `{ "max": "superior" }` range, see the Test tab's
    unidentified items); the parser's single-number `activeInLevels` warning at `rules/77` stays. A test pins this
    against the real bundles.
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
  `rule` is the index in the full list, which the Rules tab and the JSON tab's "Rule N" links use (its "Show in JSON"
  links use the path). `RuleDiagnostics` strips either prefix.
- The evaluator skips a disabled rule with the trace outcome `disabled` (it never applies or hides), and a rule with a
  wrong-shaped key with `wrongShape` (see "Wrong-shaped rules" under Test tab).

### Section comments

A filter author can group rules with ordinary `//` lines. The plugin skips comments, so this needs no format change and
the rule numbers (`R###` in the plugin log) stay the same. The ruleset:

| Line in the file                                          | Shown as                                |
| --------------------------------------------------------- | --------------------------------------- |
| `// ==== Title`                                           | A part: a heading in the Rules list     |
| `// ---- Title`                                           | A section inside a part                 |
| Other `//` right under a heading, up to a blank line      | That heading's description              |
| Other `//` between rules (consecutive lines, up to blank) | A note row, in place                    |
| `// ===========` (markers only)                           | Nothing: a visual separator in the file |

- A marker is four or more `=` or `-` after `//`; a run of three or more of them after the title is decoration.
- **A blank line ends a description and a note**: Sully writes the heading, its one-line description, a blank line, then
  the first rule's own comment, which then shows as a note row above that rule (in v0.9.2 every one of the 50 headings is
  written that way). `//` alone is an empty comment line, not a blank line: it does not end a description.
- A section runs to the next heading of the same or a higher level; a heading folds what it runs over.
- The comment lines above the opening `{` show as "About this filter", and the ones above `"styles"` on the Styles tab.
- **Opt-in:** a file with no heading shows no comment rows, so older files (Sully's QoL template had 242 per-rule comment
  lines up to v0.7.0) look as before. Their comments are still kept. Since v0.9.0 Sully's template is grouped for the
  editor itself: 6 parts, 44 sections, a one-line description under each heading and 102 per-rule notes (see "Start from Sully's
  QoL filter").
- **Kept:** whole-line `//` comments above a top-level key, a rule, a disabled rule or a style, and after the last rule.
  **Dropped on the first edit, with a warning:** a comment on the same line as a rule, inside a rule object, and every
  `/* */` block.
- **Moving a rule** (Move up / Move down, `stepRule` → `stepItem` in `utils/sections.ts`): a rule moves with its own
  notes, the note lines right above it back to a blank line, a heading's description or anything else. A heading and its
  description belong to their place, never to a rule, and a note a blank line away from the rule stays where it is. One
  step passes exactly one neighbour:
  - the rule next to it: they swap, each with its own notes;
  - a heading run (part headings and at most one section heading, the last of them, each with its description, and the
    separators and blank lines among them; so a part and its first section are one run): the rule hops over the whole
    run and becomes the last rule of the section before it (up) or the first rule of the section after it (down, placed
    after the description with a blank line before its notes); no other rule moves. An empty section is a section of
    its own, so a rule stops in it either way (that keeps a step and the step back exact). The first rule can so leave
    the first section and stand above the first heading, and the last rule can go below headings written after it
    (`rulesEndComments`); a section can end up empty;
  - a free-standing note (a note that is not a rule's own, a blank line away from the next rule): the rule passes it and
    the note stays a note row.
  - The step back undoes a step exactly (a move and its inverse give back the same file; the blank lines are tidied by
    `tidyCommentBlock`, so a blank line the file had at the edge of a block is not kept anyway). The selection and its
    folded-away mark follow the moved rule. `moveRule({ from, to })` moves by such steps until the rule reaches index
    `to`. A rule moved into a folded section is still listed under its headings while it is selected.
- Otherwise a comment belongs to its place: deleting a rule hands its comments to the next one (a blank line apart),
  duplicating does not copy them.
- Model: editor-only `commentsBefore` on rules and styles, `keyComments` and `rulesEndComments` on the filter (never keys
  in the file). `parseJsonc` places the comments (`placedComments`), the serializer writes them back after a blank line.
  One or more blank lines between two comment lines of the same block (and of the header above `{`) are kept as an
  empty string (`engine/commentLines.ts`) and written back as one empty line; blank lines at the start or end of a block
  are not kept (the serializer writes the blank line before each block itself), and the section edits drop the ones an
  edit leaves at a block's ends. Deleting a rule or style hands its comments to the next one a blank line apart
  (`joinCommentBlocks`), so they stay that item's notes. A file without blank lines between comments reads and writes
  as before.
- A disabled rule's comments are written above its `disabledRules` entry, so they come back with the rule.
- **The same in the Styles list**: comments above a style inside `"styles"` group and fold the style list by the same
  ruleset. There is nowhere to keep a comment after the last style, so the editor adds headings above a style only.
- **Editing** (Rules and Styles lists): "Add section" under the list header adds a part, section or note above the
  selected rule or style (after the last rule when none is selected); the H button of a rule row (or of the style
  editor's toolbar) adds one right above that rule or style. A heading row folds on click and has, on hover or focus,
  Edit (title, level and description), Add rule (an empty rule as the last rule of the section; Rules list only), Move
  up and Move down (the section with its rules and subsections, past the neighbouring section of the same level inside
  its part; off while searching) and Remove (the heading and its description; the rules stay). A note row has Edit
  (empty removes it) and Remove. The dialog shows the comment lines the file gets. A note added right under a heading,
  its description or another note gets a blank line above it, so it stays a note of its own (a heading needs none).
  Renaming keeps the file's markers and decoration (`// ---- Styles ----------`); a note line that would read as a
  heading or separator is written `// Note: …`. Collapse all folds every heading (only the parts show), Expand all opens every one.
- **Folds** (owner decisions 2026-11-10): a filter opened for the first time in a browser starts fully folded: the part
  rows only, each with its rule count (Sully's v0.9.2: 6 rows); a section outside any part shows as a folded section row,
  and rules and notes above the first heading stay visible. Opening a part shows its sections folded. The browser then
  remembers the folds per filter, across tab switches, route changes and reloads, separately for the Rules and the
  Styles list. What is stored is the set of OPEN headings, so a heading the browser has not seen for that filter (a new
  section, a newer version of the file, a heading typed in the JSON tab) starts folded; a heading made with Add section
  starts open.
  - Storage: localStorage `loot-filters/section-folds`,
    `{ "v": 1, "filters": [{ "id": "draft:<entry id>", "rules": ["1:PART 1", "2:1.1 Gold"], "styles": [] }] }`, the
    most recently changed filter first, at most 30 filters and 500 open headings per list; anything unreadable is
    ignored. The id is `saved:<id>` for a saved or shared filter (the owner's saved filter, a draft holding unsaved edits
    of it, whether opened on the saved route or the draft route, and the sandbox of the same filter share it, so
    Discard keeps the folds), `draft:<library entry id>` for a new draft, or `template:<template id>` (a bundled
    template's sandbox). Saving a new draft, Save as a new filter and Copy to my filters carry the folds to the new id
    (the editor screen's `switching`), only onto an id the screen has not shown yet (`switchFoldsSession`), so going back
    to a filter opened before reads its own folds; renaming a filter does not touch them. Written only when the folds
    change, so a filter that was only looked at is not stored.
  - Rule and style edits (add, move, delete, duplicate, edit, enable or disable) change no fold. A section edit carries
    them: a heading renamed or moved to the other level keeps its fold, and so do the headings a section move, an
    insert or a removal renumbers (`headingKeyChanges` matches the comment lines before and after the edit).
  - **Repeated titles**: a heading is known by its level and title plus `#n` for the nth repeat (`2:Misc#1`). Edits in
    the editor follow each heading exactly, but a change made outside it (the JSON tab, a newer file) is matched by
    title and repeat number only, so adding a heading of the same title above another one shifts the folds of the
    later ones by one.
  - **A rule selected from elsewhere opens its part and section**, the others stay as they are: a problem's rule link
    (header, JSON tab), the Test tab's rule link, Add rule, a heading's Add rule, example rules added, Check in game,
    and clearing a search while a rule is selected. Each of these opens the headings in its handler, after the action (no effect); a
    click on a rule row needs none. The row is then scrolled into view in the list and the window (`block: 'nearest'`,
    after the commit that opens its headings: the screen's `revealCount` drives RuleList's effect, which also runs again
    when the game data arrives, since the rule summaries grow a moment after the Rules tab mounts); a click on a row
    already in view does not scroll. The Styles list does the same for a style added, renamed, duplicated or picked from
    the presets, and scrolls it into view. Nothing restores a selection when the editor opens (`open` and `close` reset it), so that case does
    not occur.
  - Folding the selected rule's heading by hand (or Collapse all) folds the rule away with its section. The editor
    state's `selectionFolded` holds that: it belongs to the selection, so it follows the rule when a rule above it is
    deleted or moved, and ends when another rule is selected, a rule is added or copied, or the selection ends. When a
    rule edit puts the selected rule inside folded headings (moving it into a folded section), it stays listed under its
    own headings, shown folded (a section listed that way inside a folded part reads folded even when it is open
    itself), so it can be moved on. Clicking a heading row shown folded opens it and its part.
- **Search**: matching rules are listed under the headings they sit in (notes left out); a query that matches a
  heading's title lists its whole section. Folds do not apply while searching: the heading rows cannot be folded then,
  and a search never changes the remembered folds.
- **Our files**: the example filter (v2.2.0) has a `// ---- <group>` heading per example group and one for the hide
  rules; the Example rules dialog writes the same headings above the rules it adds, unless the filter already has a
  heading of that title (`withGroupHeadings`, `headingTitles` in `utils/examplePicker.ts`).
- **Custom rules in Protection** (Sully's request, owner decisions 2026-11-12): the main **Add rule** button
  (`addCustomRule` → `addToPartSection` in `utils/sections.ts`, `CUSTOM_RULES_PLACE` in the slice) looks for a part
  (level 1, `// ==== Protection`; the first one, title matched ignoring case and the spaces around it). When the filter
  has one, the new rule is `{ "show": true }` at the end of the section `// ---- Custom rules` inside that part (title
  matched the same way). Without that section, the section is created at the end of the part, after its last section
  and before the next part, with Sully's layout: the heading and one description line, "Your own rules. Show keeps them
  from being hidden by the hide rules below.", written above the new rule (blank lines and separators right above the
  next part stay with it; a Protection part that runs to the end of the list takes the comments after the last rule
  along, so they end up above the new rule). Protection runs before every hide rule, so `show` keeps the user's rule
  from being hidden by a later hide rule; it protects only from hiding, later rules still change its looks, chat lines
  and sounds. Without a Protection part (a blank filter, the example filter's `----` sections, a file without headings,
  or a `// ---- Protection` section, which is not a part) Add rule works as before: an empty rule after the selected one,
  else at the end. Disabled rules keep their place either way (`disabledRules` indexes are written from the model).
  The rule is selected, its part and section open and it is scrolled into view (on the stacked layout the editor too).
  A heading's Add rule, Duplicate, Example rules, Check in game and the AI import / JSON Apply keep their own placement
  and defaults.
- A commented-out rule shows as a note: the rule toggle (`disabledRules`) is the way to switch one off.
- Code: `utils/sections.ts` reads the lines (`readCommentLine`), builds the list rows (`buildSectionRows`) and applies
  every edit on the list as one stream of comment lines and items (`applySectionEdit`, `addToSection`,
  `addToPartSection`); the reducers `editRuleComments`, `addRuleToSection`, `addCustomRule` and `editStyleComments` wrap it, and `removeStyle` hands a deleted style's
  comments to the next style as `removeRule` does. The rows are `components/sections/SectionRows.tsx`, the dialog
  `SectionDialog.tsx`. The folds: `utils/sectionFolds.ts` (storage, the filter id, open-set changes),
  `hooks/useSectionFolds.ts` (held by the editor screen, so they outlive a tab switch), `enclosingHeadingKeys` and
  `headingKeyChanges` in `utils/sections.ts`.

`lootFilterSaga` (registered by `src/features/loot-filter/index.ts` when the route chunk first loads):

1. reads the library and dispatches `hydrate`;
2. 400 ms after the last editor edit dispatches `editorFlushed`, which serializes the model into the entry's `text`;
   `open`/`openSaved`/`openSandbox`/`close`/`flushNow` flush synchronously, and the editor screen dispatches
   `editorFlushed` on `pagehide`/`beforeunload`;
3. after every library change writes the library to localStorage.

The reducer is registered statically, and the slice imports the engine's parser and serializer, so they are in the entry
chunk (about 6.5 KB gzip); a documented exception, see [SAGAS.md](../technical/SAGAS.md).

## Library screen

`screens/LootFilterLibraryScreen.tsx`, `components/library/`. Title and a short how-to (on a card, always shown), then a
toolbar card (`ToolbarCard`) with two tabs (shadcn Tabs, the active trigger filled `bg-primary` like the page sub-tabs,
`?tab=shared|mine`; without the parameter **My filters** when signed in or when this browser has drafts (a returning
signed-out visitor sees their filters at once, even before the sign-in state is known), else **Shared**; without drafts
a spinner while the sign-in state is unknown, for at most 4 seconds, then it goes on as signed out; `resolveLibraryTab`
in `utils/library.ts`). While the sign-in state is unknown My filters holds back its "Sign in to save" prompt. Without the Supabase env vars there are no
tabs: the page is the My filters content without the saved section (the drafts, as before sharing) with the note
"Sharing is off in this build of the site".

**Shared** (`SharedFiltersTab`):

- A pinned card per bundled template first, Sully's QoL filter then the example filter (`BundledTemplateCard`, one per
  `BUNDLED_TEMPLATE_LIST` entry): name, its summary, "by <author>", the version and, for Sully's, where the text came
  from ("v0.9.2 · latest from Sully's GitHub" or "v0.9.2 · the copy bundled with this site", with a line "Could not
  load the latest from github.com/Thisisnotsully/QoL-Filter: <reason>." under the rule count when the live file was not
  used; a skeleton while it loads, so no wrong version flashes), rule count and level names from `filterMetadata` on
  the text in use (`useTemplateSource(id)`, see [Sully's template: live file, bundled
  fallback](#sullys-template-live-file-bundled-fallback); shared with its start button), **Open** (its `sandboxPath`: `/loot-filters/sully` or `/loot-filters/example`), **Download** (the same menu
  as a draft's, with the zip) and **Start from it** (the template start below; every start button waits while one
  loads).
- Search by name (debounced 300 ms like the builds list, server-side `ilike`) and sort **Newest** / **Most liked** /
  **Most downloaded** (`SharedFiltersToolbar`, the sharing slice's `searchText` / `sortMode`; a change refetches). It sits
  on the library's toolbar card next to the Shared / My filters switch, shown while Shared is open, so it is above the
  pinned template cards too (they are not searched).
- The public filters, 50 per page, infinite scroll (the builds' `useInfiniteScroll`, paused while a page loads and
  after a failed page; the builds' `LoadMoreError` retries), skeleton cards while the first page loads, "temporarily
  unavailable" with Try again when it fails, "No shared filters match your search." / "No shared filters yet."
- **Shared filter card** (`SharedFilterCard`, also on My filters, `/user/:userId` and the home page): name (link to
  `/loot-filters/:id`), the description clamped to two lines, the author's avatar and `name#1234` (link to the
  profile), created date, rule count and level names, "Created on ESR x · plugin y · filter v z", "Updated on ESR … ·
  plugin …" after a content save, "Based on <label>", "Latest change: <note>", a Private badge (only owners see
  private filters), the like button (signed out: opens the sign-in dialog; a private filter shows the count only) and
  the download count, **Open** and **Download**. A card does not hold the file (lists never select `content`), so
  Download dispatches `downloadSharedFilterRequested(id)`: the sharing saga fetches `id, name, content`, saves the zip
  with the bundled sounds and icons when the filter uses any, else the `.json` (`downloadFilter` in
  `utils/download.ts`), then `downloadCounted(id)`; the button shows a spinner meanwhile
  (`selectDownloadingFilterIdSet`). A filter that is gone by then gives "This loot filter is no longer shared."

**My filters** (`MyFiltersTab`):

- The start buttons and the tip (below), signed in or not.
- Signed out: "Sign in to save your filters" with a Sign in button; the drafts below stay editable.
- Signed in: **Saved filters**, "N of 50 saved", the viewer's filters (`fetchMyFiltersRequested`, newest change
  first, private ones included) as shared filter cards with badges: **Unsaved changes** (a visible draft has its
  `savedId`), **Update available** (`filterUpdateStatus`: a copy whose source has a newer revision, from one
  `fetchSourceRevisionsRequested` with every `based_on_id`, the source's change note in the tooltip; a filter started
  from a bundled template with `based_on_version` below the version of that template's text in use, live or bundled
  (`useTemplateVersions` loads only the templates the saved filters name; not loaded yet, an unknown
  `based_on_template` or a null version never) and **Original no longer shared** (the source is
  private or deleted; a deleted source has cleared `based_on_id`, the label stays).
- **Unsaved in this browser** (the heading only when signed in): `selectVisibleDrafts(state, viewerId)` as draft cards
  (`LibraryEntryCard`, newest first): name, title/author and rule count, last update, "Based on …", an **Unsaved
  changes** badge on the edits of a saved filter; **Open**, **Save** (`?save=1` on the editor route, which opens the
  Save dialog), Download, Duplicate, Rename (not on the edits of a saved filter: its name is a server field) and
  **Discard** (confirmed: "Discard draft?" for a new filter, "Discard changes?" for the edits of a saved one). A new
  draft opens on `/loot-filters/draft/:id`, the edits of a saved filter on `/loot-filters/:savedId` (`draftLinks`);
  signed out, those (`needsSignIn`) open as plain drafts and Save reads **Sign in to save**; so does a draft that does
  not record its owner (`savedOwnerId` missing or dropped), which the saved route would not find. Without Supabase the card
  has no Save and says Delete.

The how-to above the tabs covers the launcher import, the `sounds`/`icons` folders, the zip download and the
troubleshooting line from "Using a filter in the game". The start buttons (My filters tab) come in this order: **Start from Sully's QoL filter** (the primary button),
**Start from the example**, **Upload**, **New filter**, **Create a filter with AI help** (outline; a link to `/loot-filters/ai`, see "AI help"). A "Tip:" line under them says most players start
from Sully's filter for a full filter, or upload one someone shared, and change what they need; to learn how rules
work, start from the example (a small filter whose every rule explains itself in its comment); a new filter starts
blank; its Rules tab's Example rules button offers some seventy ready rules in groups to tick into a starter set; the Rules tab has them
either way; new players can describe their filter on the AI help page. The templates' credit lines follow. The empty state and the New filter dialog ("A blank filter with no
rules; the Example rules button on the Rules tab offers a starter set to tick. …") say the same in short.

- **New filter**: a name dialog ("It also becomes the filter's title (Settings tab), which the launcher shows."), then
  opens the editor on a blank filter (`formatVersion: 1`, `title` = name, one level
  `{ id: 1, name: 'Default' }`, `defaultLevel: 1`, no rules) on the Rules tab. The example rules dialog does not open
  by itself (owner, 2026-11-05); the Rules tab's Example rules button opens it.
- **Upload**: a `.json` file read as UTF-8, as leniently as the game reads it (`//` and `/* */` comments, trailing
  commas). A JSON syntax error shows a toast with the line and column and imports nothing; a file with diagnostics
  (unknown keys, wrong shapes) is imported and the editor lists them. The success toast counts the problems and spells
  out the text notes (accepted trailing commas or block comments, comments the first edit drops),
  which the editor's problems chip and list show first. The entry name is
  the file's `title`, else the file name. A successful upload opens the editor, like New filter and the template.
- **Start from Sully's QoL filter**: loads Sully's filter (`loadTemplate('sullys-qol')`: his live file, else the
  bundled copy) and opens it as a `template` entry named "Sully's QoL Filter" (the file's title; the card's byline reads
  "Sully's QoL Filter by Sully") with `basedOn` at that text's version. It is `Sullys-QoL-Filter.json` from
  github.com/Thisisnotsully/QoL-Filter verbatim, the filter the ESR launcher pulls live since 3.2.22 (it replaced the
  ESR default filter, an earlier conversion of the same filter the mod shipped as `LootFilters/esr-default-filter.json`
  up to 3.2.21). History in short: up to v0.6.13 it was one long list with per-rule comments; v0.7.0 (2026-11-05, ESR
  3.3) localised names, chat lines and level names (the parser learned per-language level names for it); v0.9.0 to
  v0.9.2 (2026-11-10, "Added compatibility for Mefi's editor") regrouped it into 6 `// ====` parts and 44 `// ----`
  sections with an "R### | what | action" title per rule (689 rules, 22 styles, the same twelve icons and nine sounds).
  Its Ancient Scroll hide rule (rule 77 "R078" in v0.9.2) writes `"activeInLevels": 4`, a number where the format wants
  a list. Verified in game: the rule works, so the editor reads it as `[4]` with one warning ("A single number works in
  game; [4] is the documented form.", see "A single-number level" above), writes the `4` back unchanged, and the Test
  tab hides Ancient Scrolls at level 4 only. Whether the plugin really reads it as `[4]` (and not as "every level") is
  the remaining check in the backlog. Tests that pin facts of his file (rule counts, sections, labels, styles) read a
  frozen copy, `engine/__fixtures__/sullys-qol-filter-0.9.2.json` (Prettier-ignored), so a refresh of the bundled copy
  breaks none of them. Credit line (`SULLYS_QOL_TEMPLATE.credit` in `utils/template.ts`, version-free): "Sully's QoL
  filter, the filter the ESR launcher ships live from github.com/Thisisnotsully/QoL-Filter (this site loads his latest
  too, with a bundled copy as fallback); icons and sounds by Sully". The library how-to adds that every player already
  has Sully's filter through the launcher.
- **Start from the example**: fetches `public/loot-filters/example-filter.json` and opens it as a `template` entry
  named "Example filter (with explanations)" (the file's title) with
  `basedOn { template: 'example', version: '2.3.0', label: 'Example filter (with explanations) v2.3.0' }` (the
  file's version; the example has no live file). Our own
  file (author "D2R ESR Runeword Browser"), a teaching filter over two levels, Leveling (1) and Strict (2), with
  `soundVolume` 50 and the drop line `notifications.dropFormat` "ÿc4Drop: {qualityColor}{name}".
  - _v2.3.0_ (2026-11-10, current) is v2.2.0 with the Mid rune preset renamed `MidRune` → `MidTierRune` (and its copy
    `MidRuneNoIcon` → `MidTierRuneNoIcon`) in the styles, the two rules' `useStyle` and their comments; nothing else
    changed. Drafts started from v2.2.0 or earlier get "Update available"; a draft that keeps its old `MidRune` styles
    works as before (the styles are stored in the filter).
  - _v2.2.0_ (2026-11-09) is v2.1.0 with a `// ---- <group>` section heading above the first rule of each
    example group and `// ---- Hide rules` above the hide rules (12 headings; see "Section comments"), and a header
    line saying what they are. The rules and styles are unchanged.
  - _v2.1.0_ (2026-11-05) is built from the example rules (Rules tab, below): 28 of them, exactly as the
    picker adds them together with their default choices (`buildExampleSet` over the examples with `defaultChoices`:
    the style preset, which now brings its generated icon, Sully's sound, the chat line), plus `notify: true` on the
    unique rule and `activeInLevels: [2]` on four hide rules. Its `styles` are the 13 presets the rules use (HighRune,
    MidRune (MidTierRune since v2.3.0), PerfectGem, UniqueItem, SetItem, MythicalUnique, CouponItem, RunewordBase, ValuableDrop, GoodCharm,
    GoodJewel, UberItem, MapItem), copied as they are with their icons, plus `MidRuneNoIcon` (MidRune without its
    icon) for Hel to Um, which keep no icon as before: a rule cannot remove its style's icon, and the rule's comment
    says so. Only three rules carry an icon of their own, where it differs from the style's: unique rings and amulets
    (`crown_gold` 40), tier 5 maps (`map_white` 40, the style's is 30) and large gold piles (no style). The elite body
    armour bases and the two small charm rules gained their style's icon (`shield_white`, `square_emerald`); the
    other icons are the same as in v2.0.0. The header says a style holds the look and the minimap icon, and that a
    rule's own icon replaces the style's. Each
    `comment` (the rule list's title line) is the example's title, a period, then what the rule teaches; in the file
    the comment is each rule's first key (the editor's serializer writes it last, so the first edit moves it). The
    rules: high runes, ESR elemental runes, Mal/Ist/Gul, mid runes, perfect gems, unique weapons and armour (with the
    drop line), unique rings and amulets, The Oculus by unique id, set items, mythical uniques, elite coupons, the
    socket count tag, elite body armour with 3 or 4 sockets, ethereal elite polearms and spears, superior +All Skills
    bases, small charms any-of (MF or FHR) and all-of (all resistances), rare jewels, Pandemonium keys, tier 5 maps,
    gold piles of 100,000 or more; then the hides: inferior gear (from character level 10), white gear with at most
    one socket (10), minor potions (12) at both levels, and at Strict only chipped and flawed gems (20), gold under
    500 (60), magic and rare weapons except useful ones and magic armour except useful ones (20). The `//` header says
    what the file is, how rules run, the all-of/any-of lists, what a style holds, that a hide stops and needs its own
    exceptions, the two levels and the .zip download.
  - _v2.0.0_ (2026-11-05) had the same rules with the icons on the rules and icon-less presets; _v1.0.0_
    (hand-written, 21 rules, two custom styles Valuable and Good with sounds and Sully's icons in them) came before.
    Drafts started from either get "Update available".
  - _Tests_: `exampleFilter.test.ts` parses and validates it, checks the header at its current version (written in the
    test: bump both), every
    rule against its example (`FROM_EXAMPLES`, the ids in file order with what the file adds, built as one set; a
    changed example fails until the file follows and its version is bumped), the comments, the styles against the
    presets (icons included, the one NoIcon copy, the three rules with an icon of their own), the levels, the sounds
    and the generated icons (the .zip carries them all, no `.lowend.sprite`), and runs it through the evaluator; and
    that an edit keeps every comment. The file is written with the serializer (comments moved first: v2.1.0 was
    regenerated from v2.0.0 with a throwaway script that serializes the parsed file with the new styles, rules and
    comments and moves each `comment` line first, which reproduces v2.0.0 byte for byte when nothing changes) and is
    kept byte-stable: `public/loot-filters/` is Prettier-ignored.
  - Credit line: "Example filter, built for this site from its example rules to show how rules work; sounds by Sully,
    icons generated for this app".
- **Bundled templates** (`utils/template.ts`): a small registry, `BUNDLED_TEMPLATES` keyed by `BundledTemplateId`
  (`'sullys-qol' | 'example'`, the `basedOn.template` / `based_on_template` value) and `BUNDLED_TEMPLATE_LIST` (display
  order, Sully's first). Each `BundledTemplate` has `name` (the file's title), `author`, `file` (the bundled copy),
  optional `liveUrl` and `repoUrl` (Sully's only), `sandboxPath`, `startLabel`, `summary` (card text) and `credit`; no
  version (it is always the version of the text in use). `template.test.ts` checks name and author against each bundled
  file, that each bundled file passes `checkTemplateText`, and that no credit or summary names a version.
  `bundledTemplate(id)` looks one up (null for any other text), `fetchBundledTemplateText(id)` reads the bundled copy,
  `loadTemplate(id)` / `useTemplateSource(id | null)` give the text in use (below), and `templateBasedOn(id, version)` /
  `templateStartInput(source)` (`utils/basedOn.ts`) build what a start records. Adding a template is a file, a registry
  entry and a route line.
- New filter, Upload and the template starts add a draft and open it on `/loot-filters/draft/:id`
  (`hooks/useStartFilter.ts`: `startFromTemplate(id)`, `loadingTemplate` is the id loading or null). Empty state ("No
  filters yet") when there are no drafts and nothing is saved.
- **Download** (`components/FilterDownloadMenu.tsx`, shared with the editor header): a plain button saving
  `<slug of name>.json` when the filter references no sound or icon file (or is not valid JSON); otherwise a menu with
  **Download .json** and (when it uses a bundled one) **Download .zip with sounds and icons** with the hint "Unzip into
  your LootFilters folder", and, when the filter references files the app does not bundle, their paths ("Not bundled,
  add them yourself: …"; the first four, then "and N more") and "Sully's are in his icons and sounds folders on
  GitHub." with links to those two folders of his repository (always, whatever the filter is based on: a file the site
  lacks is most likely a newer asset of his; the site never fetches sprites or sounds from GitHub). The zip (`<slug>.zip`) holds `<slug>.json` (the same text the plain download saves), `sounds/*.mp3` and
  `icons/*.sprite` for the referenced bundled files (`goldstar` brings `goldstar.lowend.sprite` along). The referenced
  files come from `utils/referencedAssets.ts` (rules and styles; `sound` values ending in `.wav`/`.mp3`/`.flac`, every
  `icon.iconName`; matched case-insensitively against `utils/bundledAssets.ts` and written under the bundled file's
  own name, so a rule's `gemp` puts `icons/gemP.sprite` in the zip); the archive from `utils/zip.ts`, a
  dependency-free stored-only ZIP writer (UTF-8 names, CRC-32). A failed fetch shows a toast "Could not download the
  sounds and icons" and saves nothing.

### Sully's template: live file, bundled fallback

Owner decision (2026-11-10): the app always uses Sully's latest filter, as the ESR launcher does (it pulls the same
file every 10 minutes and keeps the last good one), with the copy in `public/loot-filters/` as the fallback.

- **Loading** (`utils/templateSource.ts`, `loadTemplate(id)`): a template with a `liveUrl` (Sully's:
  `https://raw.githubusercontent.com/Thisisnotsully/QoL-Filter/refs/heads/main/Sullys-QoL-Filter.json`) is fetched with
  a plain GET (`fetch(liveUrl, { signal: AbortSignal.timeout(5000), referrerPolicy: 'no-referrer' })`): no custom
  headers, because GitHub answers a CORS preflight with 403, and the default cache mode, so the browser's HTTP cache
  revalidates it (`max-age=300`, about 109 KB gzip on the wire). jsDelivr (12 h branch cache) and api.github.com (60
  requests an hour, base64) do not fit. A valid live text always wins, even when its version is lower than the bundled
  copy's. Any failure (network, timeout, HTTP status, an invalid text) loads the bundled copy instead, with the reason
  in `liveError` and a `console.warn`. A template without a `liveUrl` (the example) loads its bundled copy only.
- **A timed-out live attempt is remembered for the browser session** (`sessionStorage`
  `loot-filters/live-template-failed/<id>`: `{ at, reason }`, every access in try/catch): for the next 10 minutes a
  load (a reload, another tab of the session, a re-check) skips the live request and goes straight to the bundled
  copy, with the reason "timed out after 5 s (tried 3 min ago)" ("under a minute" below one). On a network where
  raw.githubusercontent.com hangs, only the first load waits the 5 s timeout. Only a `TimeoutError` is remembered: every
  other failure (refused, an HTTP status, an invalid text, a request cut short by leaving the page, which reads "Failed
  to fetch") fails fast, so the next load simply tries the live file again. A successful live load removes the memo;
  blocked or full storage only means the next load tries again.
- **Validation** (`checkTemplateText(id, text)`): at most 5 MB (characters); `parseLootFilter` does not throw and
  reports no error diagnostic (warnings are fine: v0.9.2 has one); at least one rule; its title or author names this
  template (`templateOfFile` in `utils/basedOn.ts`); its `version` has a numeric start (`templateVersionOf`: one to
  four numeric parts after an optional "v", or a leading-dot decimal; the rest is ignored, so "0.9.3-beta" reads as
  0.9.3, "1.0.0-rc1" as 1.0.0 and Sully's early ".5" as 0.5, while "latest" or five parts are refused). A pre-release
  therefore compares equal to its release. The result carries the version and rule count.
- **Cache**: one promise per id, so the card, the start button, the sandbox and the update banner share one request.
  The next call after 10 minutes re-checks the live file; a failed re-check keeps the previous source (a live one stays
  live, with a fresh `loadedAt`); a load that fails outright (live and bundled) is forgotten so the next call retries.
  Nothing is written to localStorage (the text is 0.5 MB). `peekTemplateSource(id)` returns the last settled source
  without a request, so a page that opens after another loaded it shows no loading state.
- **Hooks**: `useTemplateSource(id | null)` gives `idle` (null: nothing is fetched) / `loading` / `ready` with the
  `TemplateSource` (`text`, `version`, `origin: 'live' | 'bundled'`, `liveError`, `loadedAt`) / `error`;
  `useTemplateVersions(ids)` the versions for the My filters badges. Only pages that need a template load it: the
  Shared tab's pinned cards, the sandbox route, a start, the update banner of a template-based filter, the AI page's
  template starter, and My filters only when a saved filter is template-based.
- **What the user sees**: the pinned card "v0.9.2 · latest from Sully's GitHub", or "v0.9.2 · the copy bundled with
  this site" plus "Could not load the latest from github.com/Thisisnotsully/QoL-Filter: <reason>." (reasons: "HTTP
  404", "timed out after 5 s", the browser's network error such as "Failed to fetch", or the validation reason such as
  "the file has no rules"); the sandbox banner "You are viewing Sully's QoL Filter v0.9.2, the latest from Sully's
  GitHub — changes are not saved. …" (or ", the copy bundled with this site" with the reason on a line below); the
  update banner "Sully's QoL Filter v<new> is out; this filter started from v<old>." The version always comes from
  the text, so `basedOn`, "Update available" and the AI starter label follow Sully's bumps without a code change.
  "Update available" compares version numbers only: a content change without a version bump (common for Sully) shows
  none, and a live file with a lower version than a draft's shows none either.
- **Assets**: only the JSON is live. Icons and sounds always come from the site; a file the site does not bundle is
  named in the download menu with links to Sully's folders (see Download above) and plays or draws nothing in the
  editor.
- **Refreshing the bundled copy**: `npm run loot-filter:template` (`scripts/update-sully-template.ts`) fetches the live
  file, runs `checkTemplateText` (refuses to write an invalid one), writes it verbatim to
  `public/loot-filters/sullys-qol-filter.json`, and prints the old → new version, size, rules, styles, the parser's and
  the validator's (committed game data) error/warning counts, the files the new text references that the site does not
  bundle, the size raw and as the editor writes it against the saved-filter cap (a warning above 75% of it), any of his
  style names that one of our style presets uses (`presetNameClashes`), and (one call to
  `api.github.com/repos/Thisisnotsully/QoL-Filter/git/trees/main?recursive=1`, derived from `repoUrl` and the branch of
  `liveUrl`, generic User-Agent) his icons and sounds the site does not bundle. The script and the `esr:review` Sully
  checks read the URLs from `SULLYS_QOL_TEMPLATE`, so the review checks the very file the app loads. `-- --check` writes nothing and exits 1 when upstream
  differs (or cannot be fetched or checked). A bump needs no constant, test or agent pack edit; a new icon or sound
  needs bundling (icons shrunk to 128 px, the `bundledAssets.ts` registry), which the bundled-file invariant in
  `referencedAssets.test.ts` enforces. Two more invariants hold for any bundled version: the file fits a saved filter
  as read and as the editor writes it (`template.test.ts`), and no style of his is named like a preset
  (`stylePresets.test.ts`). The pure parts live in `scripts/lib/sullyTemplate.ts` (tested); the
  `/esr-update` review (`esr:review`) still diffs upstream against the bundled copy.
- **Privacy**: `raw.githubusercontent.com` was already contacted for the ESR version check; the privacy policy's GitHub
  row names Sully's live filter as a second purpose.

## Editor screen

Header row: back link, the filter name (a new draft: pencil to rename inline, Enter or Escape returns the focus to the
pencil; a saved filter is renamed through Details), the status line (see "Saving and sharing in the editor"), a
problems chip ("N errors / M warnings", also announced to screen readers through a polite live region), **Import AI
answer** and **Improve with AI** (see "AI help") and **Download**; under it the tab row (Rules, Styles, Settings, JSON,
Test) on a `ToolbarCard` (`SUBTAB_*` classes). Clicking the chip opens the JSON tab and bumps a counter the screen passes to `JsonTab`
(`scrollToProblems`); `JsonTab` scrolls to the problems list in an effect once it has rendered (the tab switch runs in a
transition, so scrolling from the click handler could miss the element) and resets the counter. Download saves the
stored `text` (comments and formatting as uploaded) unless edits are not yet written back (`editor.dirty`), then the
serialized model; it is the library's Download menu (see Library screen), so a filter that uses bundled sounds or icons
also offers the zip, with the files the current model references. When the stored text is not valid JSON, every tab but JSON shows a "cannot be read" card; Apply in the
JSON tab recovers the filter.

The tabs are a `role="tablist"` of buttons that set `?tab=`; each tab unmounts when another is shown, so the state that
must outlive a switch lives in the screen: the JSON tab's unapplied draft (kept per editing session: a new session
starts when another filter opens, not when Save or Copy to my filters moves the open filter to its new route) and the
Test tab's item form (not saved).

### Wide and Full pages

The editor and the library follow the Page width setting through the `page` container of `LootFilterLayout`'s
`PageShell` (steps and rule: [UI-COMPONENTS.md](../technical/UI-COMPONENTS.md#pageshell)). Every change is an
`@8xl/page:` class or higher, so the Standard page (never wider than 1280 px) keeps its layout; checked by comparing
every element box of each tab at 1280, 1920 and 3440 px before and after (only one new, same-size wrapper box). Text
blocks keep a reading width (`@8xl/page:max-w-4xl` on the rule's check hint, How rules combine and the JSON tab's help).

| Tab      | `@8xl` (1536 px)                                                                                                                                                               | `@9xl` (1920 px, the Wide page)                           | `@10xl` (2400 px)                                                 | `@11xl` (2880 px) |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------- | ----------------- |
| Library  | 4 cards per row (bundled templates, shared, saved, drafts; also the profile's loot filters)                                                                                    | 5                                                         | 6                                                                 | 7                 |
| Rules    | list 28rem (24rem below); Enabled and Comment side by side; Item properties and Where and when 3 fields per row (Which items and Stats keep their include / except pairs in 2) | list 32rem                                                | list 36rem; conditions card and actions card side by side (3 : 2) | list 40rem        |
| Actions  | each section a bordered tile in a grid (rule: 2 tiles per row under the conditions; style: 2)                                                                                  | style: 3                                                  | rule: 1 (beside the conditions); style: 4                         | rule: 2; style: 5 |
| Styles   | list 20rem                                                                                                                                                                     |                                                           | list 22rem                                                        |                   |
| Settings | the cards in 2 columns (rows as high as their tallest card), Quality colours over 2 columns with 5 selects per row                                                             |                                                           | 3 columns                                                         |                   |
| JSON     |                                                                                                                                                                                | problems list (32rem) beside the editor                   | problems list 40rem                                               |                   |
| Test     |                                                                                                                                                                                | Item, Context and Result in three columns (Result sticky) |                                                                   |                   |

The actions tiles stay about 480 px or wider (`TILE_COLUMNS` in `ActionsEditor.tsx`): narrower tiles squeeze the
Prefix / Suffix boxes, which is why the rule's actions drop to one tile while they sit beside the conditions at `@10xl`.

### Saving and sharing in the editor

Spec and owner decisions: [FEATURE-LOOT-FILTER-SHARING.md](../../builds-feature-docs/FEATURE-LOOT-FILTER-SHARING.md).

**Opening** (`LootFilterEditorScreen`): once the library is hydrated, an effect opens what the route shows, reading the
store at that moment so a target that already matches (the same filter after Save or Copy moved the route) is left
alone: the draft route dispatches `open(id)`; the saved route redirects a local draft id to `/loot-filters/draft/:id`,
else clears the sharing detail and dispatches `fetchSharedFilterRequested(id)` (without Supabase it only shows "not
found"); a template route (`/loot-filters/sully`, `/loot-filters/example`) loads that template (`loadTemplate`: live or
bundled) and dispatches `openSandbox` with `templateBasedOn(id, version)` (a failed load, live and bundled shows "Could not load <name>" with Try again, only on that
template's route). A sandbox without a saved filter matches the template route its `basedOn.template` names (Sully's
when it names none). A second
effect waits for the auth state and the fetched row, then dispatches `openSaved({ row, viewerId, authorLabel })`
(`authorLabel` "Name#1234"); `targetMatchesRoute` also checks the kind, so signing in or out on a saved route reopens
it as the owner's filter or the sandbox. A change of viewer refetches the row (a private filter that was "not found"
signed out loads once its owner signs in), and a route whose target already matches fetches the row when it is
missing. The owner signing in on their own filter's sandbox with edits keeps the sandbox (`keepsOwnerSandbox`): a note
offers **Open the editable version** (dropping those edits) beside Copy to my filters; without edits it switches by
itself. A missing row shows "Filter not found" (with a link to a local draft of that
saved filter when there is one), a failed fetch "Could not load the filter" with Try again. Unmounting dispatches
`close()` and `resetSaveStatus()`.

**Header** for a draft or the owner's saved filter: Private badge, the status ("Saving…", "Not saved yet: kept in this
browser" for a new draft, "Unsaved changes" / "Saved"), likes and downloads (saved), "Based on X", the latest change
note; **Save** (primary; disabled without unsaved changes; signed out it opens the sign-in dialog), **Discard changes**
(saved filter with a draft, confirmed: `discardChanges()`; a draft of a saved filter opened on its own route is
removed and the saved filter opens), **Details** (saved: name, description, Private, `updateFilterDetailsRequested`),
Download (a saved row's download dispatches `downloadCounted`), and **Delete** (saved, confirmed: "no longer shared;
copies other players made keep working"; on success the draft is discarded and the route goes to `/loot-filters`).
Without the Supabase env vars Save, Details and Delete are hidden and a line says "Saving and sharing are off in this
build".

**Save dialog** (`components/editor/SaveDialog.tsx`): the first save of a new draft asks for the name (prefilled),
an optional description and Private (unticked: public by default); a later save of a public filter asks for an optional
"What changed" note (up to 200 characters, shown to copies; a draft of a saved filter on its own route reads the
privacy from My filters, fetched when needed, and while it is unknown no note is asked); a private filter saves at once without the dialog (it
opens only to show a failure). The dialog shows the validator's counts ("N errors, M warnings: you can still save"),
warns when the JSON tab has unapplied text, and shows the save's error; on a conflict it offers **Overwrite** (row
changed elsewhere) and **Save as a new filter** (always; the only choice when the row is gone or not the user's) with a
Private checkbox (the saved filter's privacy; ticked when unknown).
Signed out it says "Sign in to save" with a Sign in button.

**Save saga** (`sharing/saveSaga.ts`, forked from `lootFilterSharingSaga`): `saveFilterRequested({ details?, changeNote?,
mode: 'normal' | 'overwrite' | 'asNew' })` (`takeLeading`):

1. signed out → `openSignInDialog()`; privacy policy not accepted → an error;
2. `flushNow()`, then `selectSaveRequest` (null → "No changes to save");
3. `checkSaveText`: at most 2 MB (`FILTER_CONTENT_MAX_BYTES`, the `loot_filters_content_size` check of migration 007;
   512 KB up to 2026-11-10, when Sully's v0.9.2 template alone outgrew it), readable by the lenient parser, a filter object with `formatVersion` 1 (validator
   errors and warnings do not block);
4. insert (a new draft, or `asNew`): name, description, Private, the file metadata (`filterMetadata`), `esr_version`
   from `db.metadata` `esrVersion`, `plugin_version` = `LOOT_FILTER_PLUGIN_VERSION`, `based_on_*` from the draft's
   `basedOn` (`basedOnColumns`: label clipped to 200 characters, a version over 50 left out), `change_note` null;
   `.insert(...).select(detail).single()`. A `based_on_id` the source lookup found gone is left out, and a foreign key
   error (`23503`: the source was deleted) retries once without it, keeping the label;
5. update: content, metadata, `esr_version_updated`, `plugin_version_updated`, `change_note` (the note or null), and
   `based_on_revision` / `based_on_version` / `based_on_label` when the draft's `basedOn` moved (`basedOnMoved`); a
   compare-and-swap `.eq('id').eq('revision', expected)` unless `overwrite`. No row back: a lookup decides `changed`
   (still the user's) or `gone`;
6. success: `saveFilterSucceeded({ row, inserted })` (detail, My filters, the newest-first lists) and then
   `saveSucceeded` (the editor target becomes the saved row). The screen sees "target is the row just saved" and
   replaces the route with `/loot-filters/:savedId` (dropping `?save=1`), keeping the screen mounted.

A `loot_filter_limit` error reads "You have 50 loot filters; delete one to save another." `updateFilterDetailsRequested`
writes name / description / is_private at once (no revision bump) and dispatches `savedFilterRenamed`;
`fetchSourceFilterRequested(id)` loads a copy's source with its file into `sourceFilter`.

**Sandbox** (someone else's filter, a signed-out visitor, or a bundled template, which reads "You are viewing <name>
v<version>", for Sully's followed by ", the latest from Sully's GitHub" or ", the copy bundled with this site" and the
reason on a line below, from `peekTemplateSource` when its version is the sandbox's): a banner "You are viewing X by Name#1234 — changes
are not saved. Copy to my filters to keep them." with **Copy to my filters** (signed out with Supabase: the sign-in
dialog; without Supabase it copies directly), **Like** (shared filters; signed out: sign-in), **Undo my changes** when
edited, the author's profile link, the description, "Based on …" and the latest change note. Copy dispatches
`copyToMyFilters()` and replaces the route with `/loot-filters/draft/<payload.id>`. Leaving an edited sandbox asks once
(`hooks/useSandboxLeavePrompt.ts`: a router blocker that reads the store when it fires, so Copy is never blocked, and
`beforeunload`); confirming drops the sandbox edits so a redirect afterwards does not ask again.

**Update available** (`components/editor/UpdateBanner.tsx`, drafts and the owner's saved filters): with a shared
`basedOn.id` it dispatches `fetchSourceRevisionsRequested([id])` on open; `sourceUpdateOf` reads the result: a higher
revision shows the source's name and change note, prefetches its file (`fetchSourceFilterRequested`) and offers
**Replace with the latest** (`takeUpdate` replace, as unsaved changes with the new `basedOn`; asks first when there are
unsaved changes, which a draft always has; Discard changes then goes back to the saved version) and **Add as a new
filter** (`takeUpdate` new, then the new draft's route). A never-saved draft is the only copy of its filter, so it gets
only Add as a new filter (the banner says why, and the reducer refuses `replace` there). A missing source, or a saved copy
that lost its `based_on_id` but keeps a label, reads "The original … is no longer shared" (dismissable, no action). A
template `basedOn` older than the version of that template's text in use (`useTemplateSource`, live or bundled; a
`basedOn` of unknown version counts as older) reads "<name> v<new> is out; this filter started from v<old>." (or
"from an older version") and offers the same two actions with the very text and version the banner announced (`{ kind:
'template', template, fromVersion, toVersion }`; the actions are synchronous, nothing is fetched on click). Nothing
shows while the template loads or when its version is unknown, and a `basedOn.template` the registry does not know
shows nothing.

| Tab      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules    | Rule list (summary, badges, problem dot, move up/down, duplicate, delete) with search and Add rule, next to the selected rule's editor: comment, the rule's problems, every condition with game-data pickers, then the actions editor. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Styles   | Style list (name, action count, "used by N rules", its look as a `StylePreview` with the minimap icon), Add style, Add preset (see [Style presets](#style-presets)), rename (rules' `useStyle` follow), duplicate ("Name (copy)"), delete (warns how many rules use it); the selected style opens the actions editor, with the Basic / Advanced toggle (see the Rules tab). Conditions found in a style are listed read-only ("styles hold actions only").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Settings | Title, author, version, description, update URL, hide unmatched items, sound volume; filter levels (id + name, add/remove, default level, "used by N rules", ids rules use that are missing); drop line and level change line; one colour-code select per quality.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| JSON     | The serialized file in a CodeMirror editor (JSONC highlighting, live syntax lint, folding, search, label chips): Apply (parse, as leniently as Upload; a syntax error shows line/column and selects the spot; the success toast spells out the text notes), Revert, Copy. The draft survives tab switches; leaving the page with unapplied text asks first (`beforeunload`); when an edit in another editor tab changed the filter meanwhile a note says Apply replaces those changes and Revert loads them. Whole-line `//` comments are kept and show here, with the blank lines between them: the header above `{`, comments above a setting, a rule or a style, and after the last rule (see "Section comments"); a comment at the end of a line, inside a rule, a style or another setting, and `/* */` blocks are dropped by Apply and by any form edit, with a warning. The help text under the editor says the same. Below it every problem with severity, path and message; a rule problem links to its rule (selects it, opens Rules), a problem with a path to its place in the text. See below. |
| Test     | Describe an item (presets, item fields, unique/set, stats, location) and the context (difficulty, area, filter level, character level and stats); see the ground label, chat lines, sounds, icon and droplight, and a rule-by-rule trace. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Settings changes dispatch the slice reducers directly; the only local state is what a half-typed number needs
(`NumberInput`: a text input with a numeric keyboard that commits only valid numbers, so "-" or "1." is kept as typed
and does not clear the key). Form rows share `Field` (label, control, hint; `dense` in the Test tab) and `CheckField`
(`components/Field.tsx`); the actions editor and the test result share `actions/Section.tsx`. A per-language text (`{ "enUS": …, "deDE": … }`) gets a language select (see Settings above). Unknown keys appear in the problems list as warnings: they travel through unchanged, but only the JSON tab
can edit them.

## Rules tab (`components/RulesTab.tsx`, `components/rules/`, `components/pickers/`)

Two panes from `lg` up (list left, sticky; editor right), stacked below (list capped at 45vh, then the editor; picking a
rule scrolls the editor into view). Wide and Full pages widen the list and give the editor more columns (see
[Wide and Full pages](#wide-and-full-pages)).

- **Splitter** (`rules/RuleListSplitter.tsx`, `utils/ruleListWidth.ts`): on two-pane layouts, at every page width, a
  vertical handle in the gap between the list and the editor resizes the list. The grid column is
  `clamp(18rem, var(--rule-list-width), 60%)`: the classes set the variable to the per-page-width defaults of the Wide and Full pages table
  (24, 28, 32, 36, 40rem), a moved splitter sets it inline in rem (so it follows the Text size setting), and the
  clamp keeps it between 18rem and 60% of the row when the window shrinks too. The width is remembered per browser
  (`loot-filters/rule-list-width` in localStorage, every access in try/catch; without storage it lasts until the tab
  is left); double-click resets it to the default (and forgets it). Drag with pointer capture (no text selection, a
  `col-resize` cursor while dragging): a drag writes `--rule-list-width` straight on the row element, at most once per
  animation frame, and commits the width (state and localStorage) on release, so the Rules tab does not re-render per
  pointer move; the rule rows use `content-visibility: auto`, so rows outside the list's scroll view skip layout
  (measured on Sully's 225 rules at 1280 px: a width change's layout went from about 24 ms to 7.5 ms, 60 drag steps
  from about 3.4 s to 1.1-1.7 s). The handle is a focusable `role="separator"` (`aria-orientation="vertical"`,
  `aria-valuenow/min/max` in px from a ResizeObserver (paused while dragging, the drag sets the value itself),
  `aria-valuetext` such as "24 rem, 31% of the row" (`ruleListValueText`), `aria-controls` the list) that ArrowLeft / ArrowRight move by
  1rem (Shift: 4rem) and Home / End send to the minimum / maximum. It sits last in the list pane, so the tab order is
  list, splitter, editor. Hidden on the stacked layout.

- **Toolbar**: search box (every term must appear in `ruleSearchText`: summary, codes and their names, types, unique/set
  and area names, stat names and the names of their params (skill, tab, class), comment, the whole formula, style, name
  changes and chat lines), **Add rule** (in a filter with a `// ==== Protection` part, a `show` rule at the end of its
  Custom rules section, created when missing, see "Custom rules in Protection"; otherwise an empty rule after the
  selected one, else at the end; clears the search, selects the rule and, on the stacked layout, scrolls the editor into
  view, as a click on a rule, a heading's Add rule and example rules added do), and "N rules (M disabled, K hidden by search)".
  The search text includes `disabled` for a disabled rule, so searching "disabled" lists them. An empty rule list says
  "No rules yet. …" and points to the example rules and to Sully's QoL filter (a link to the library).
- **Example rules** (`rules/ExampleRulesButton.tsx`, `ExampleRulesDialog.tsx`, `ExampleRulesPicker.tsx`,
  `utils/exampleRules.ts`, `utils/examplePicker.ts`): an **Example rules** button under the toolbar opens a wide,
  scrolling dialog (`sm:max-w-5xl`, 90vh). Its intro says how rules run (top to bottom, every matching rule applies,
  later labels win, a matching hide rule hides the item and stops) and that the sounds and icons come with the .zip;
  a caller can pass its own (`description`; the AI page's speaks of the AI starter, `AI_STARTER_EXAMPLES_INTRO`).
  - _Groups_ (`EXAMPLE_GROUPS`, modelled on the sections of Sully's v0.6.13, rules written for this site), each with a
    one-line intro and a tri-state group checkbox: Runes, Gems, Uniques, Sets, Mythical uniques,
    Coupons, Runeword bases, Charms and jewels, Class items and jewellery, Keys/organs/endgame items, Crafting reagents,
    Maps, Gold and potions, Hide junk. 67 examples, 12 of them hide rules (`EXAMPLE_RULES`; the list is in the code). Each is a checkbox named by its
    title (also the rule's `comment`, the title line in the rule list), the description (with "Hide rule." for a hide
    rule, which also has a visible "hide" badge) linked by `aria-describedby`.
  - _Presentation_: an example is its conditions (plus a fixed name tag or `hide`) and default choices for Style (a
    style preset, see [Style presets](#style-presets)), Sound and Minimap icon (from the asset registry) and Chat
    message (its own line or the plain `{qualityColor}{name}`), each None or a value. Sounds and chat lines are
    defaults only on valuable drops; hide rules have none (a hidden item shows nothing). A ticked example shows the four
    compact selects prefilled with its defaults, a play button for the chosen sound (`useSoundPreview`, at the filter's
    `soundVolume`), a preview of the chosen style with the minimap icon the rule will show beside the label, drawn at
    its size as on the minimap (`PresetPreview` with `icon`; an icon without a style is drawn alone with "Minimap icon
    coin_gold, 30 px, no style."), "With every choice None this rule does nothing." when that is so, and one muted
    line: "After adding, you can change everything in the rule: colours, the icon’s size and tint, the sound, the chat
    line." A select's options mount only while it is open (controlled `open`; the trigger shows the chosen label as
    `SelectValue` children): with every example ticked there are some 200 selects, and Select all took about 850 ms
    with every option rendered, about 150 ms now. Typing a letter on a closed trigger no longer picks an option.
  - _Icons_ (2026-11-05, owner decision: presets carry their icon): every style preset but Low rune and Muted brings
    its paired [generated icon](#generated-icons), so the Minimap icon select of a styled example offers None,
    **Style's icon (star_gold, 30)** (`STYLE_ICON`; it follows the Style select, and reads None for a style
    without an icon), then every bundled icon (Sully's twelve too). A styled example defaults to the style's
    icon; an example names its own (`presentation.icon`, with `iconSize`) only where it differs from its preset's, and
    `icon: null` for none. Picking another icon gives it the example's own size, else the preset icon's, else 40
    (`chosenIcon`). With the defaults, 49 of the 55 label examples show an icon, all generated, at 27 to 50 px
    (`exampleRules.test.ts`):

    | Examples                                                                                                                         | Icon (size)                                               | From          |
    | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------- |
    | Every example with a style preset that has an icon, unless listed below                                                          | the preset's (see [Style presets](#style-presets))        | the style     |
    | Unique rings and amulets                                                                                                         | `crown_gold` (40)                                         | its own       |
    | Exceptional coupons; tier 5 maps                                                                                                 | `scroll_gold` (30); `map_white` (40): another size        | its own       |
    | Ancient Decals (30), unique charms and jewels, legendary materials, hourglass pieces (35)                                        | `cross_red`, smaller than the Valuable preset's 40        | its own       |
    | Wild Card coupon (Valuable look)                                                                                                 | `scroll_gold` (40)                                        | its own       |
    | Uber organs, essences and the Token of Absolution (Uber look, whose icon is the key)                                             | `skull_purple` (35)                                       | its own       |
    | Gold piles of 100,000 or more (no style)                                                                                         | `coin_gold` (30)                                          | its own       |
    | Mid runes Hel to Um                                                                                                              | none (`icon: null`, as in Sully's filter: icons from Mal) | a NoIcon copy |
    | Low runes, ESR kanji I to Mo (Low rune has no icon); the socket count and unsocketed tags and the elite set chat line (no style) | none                                                      |               |

    Compared with the per-rule icons before (34 examples), the styled examples that had none now show their
    preset's: blemished gems, The Oculus (the same star the unique rule gives it), the runeword bases and white
    mythical bases, the charm rules, the jewellery rules, Aura Stones and Unique Stones (which never lie on the
    ground, so it never shows), the ancient scrolls, common reagents and ore. Mid runes stay without one.

  - _Bulk_: "No sounds", "No chat messages", "No minimap icons" switch those off for every rule (the selects show
    "None (no sounds)"…; the choices come back when the switch is off), plus **Select all label rules**, Clear and
    "N selected". Bulk selects never tick a hide rule among label rules (owner, 2026-11-05: a hide rule always needs a
    deliberate tick; a line under the switches says "Select all leaves the hide rules out: tick the ones you want
    yourself."): Select all ticks the label rules only (`selectAllLabelRules`); a group checkbox (`setGroupSelected`,
    `groupBulkKind`) reads "Select all in group" in a group without hide rules, "Select label rules in group" in a
    mixed group (Gems, Gold and potions: it ticks the label rules), and "Select all hide rules in group" in Hide junk,
    a group of hide rules only, where the click can mean nothing else. Unticking a group unticks all of it, hide rules
    too, and the checkbox shows "all" once what it ticks is ticked (`groupSelection`), so an unticked hide rule beside
    them does not leave it stuck at partial.
  - _Add selected (N)_: `buildStarterRules(state, existingStyles)` builds the ticked examples as one set
    (`buildExampleSet(entries, existing) → { rules, styles }`: per rule the title as `comment`, the conditions,
    `useStyle`, `sound`, `icon` only where needed, `chatMessage`) in insertion order: label rules first in group and
    list order, hide rules last (a hidden item loses its label whatever comes before or after, so this only keeps the
    list readable). **Every rule gets exactly the icon it chose**, although a rule can only replace its style's icon,
    never remove it:
    - the style a preset's rules use is the filter's own style of that name when it has one (never overwritten),
      else the preset: with its icon, or without it when no rule of that preset wants the preset's icon (every one
      chose None or an icon of its own; the "No minimap icons" switch makes all of them None, so every preset goes in
      without its icon and no copy is made);
    - a rule carries its own `icon` only when the one it wants differs from that style's (another icon or size; the
      preset's icon on a filter style that has another icon or none, e.g. a preset added before presets had icons);
    - a rule that wants no icon while that style has one uses a copy of the style without it, `<Name>NoIcon`
      (`UniqueItemNoIcon`; `<Name>NoIcon2`… when the filter uses the name for something else; a filter style of that
      name with the same content is reused). The copy of a filter's own style keeps the filter's look. A copy is added
      right after its base style when both are added (owner, 2026-11-05), else at the end.

    Example: Unique weapons and armour set to None and The Oculus left on Style's icon add `UniqueItem` (with the
    star) and `UniqueItemNoIcon`; with The Oculus on Gold crown instead (nobody wants the star) only `UniqueItem`
    without the star, the crown on The Oculus's rule. The button merges the styles (`mergeStyles`: a name the filter
    lacks is added; one it has with other content is kept and reused, never overwritten) and dispatches
    `addRules({ rules, styles, at })`, one edit (a debounced editor flush like any other edit; `addRules` was missing
    from the saga's flush list until 2026-11-05, so the added rules reached the library only with the next edit or on
    leaving the editor): the rules go after the selected rule (else at the end) and the first one is selected. The
    toast counts the rules and names the added and the kept styles ("Kept your own style UniqueItem; the new rules use
    it unchanged." also for a preset added before the presets had icons, which now differs from the preset).

  - _Reuse_: `ExampleRulesPicker` (`onConfirm(rules, styles, selection)`, `onCancel`, `confirmLabel`, `previewVolume`,
    `initialState`, `existingStyles`: the Rules tab passes the filter's styles) has no store dependency (the AI page's
    "Pick example rules" starter uses it without `existingStyles`, reopening on the `selection` it got back), and
    `starterRulesFor(ids, existing?)` builds a set without a picker, for starters outside the editor.
  - _Rules_: real ESR 3.3 codes, types and stat names only; no `activeInLevels` (examples apply at every level); no
    Enhanced Damage/Defense check (see "Known plugin limits"); hide rules wait for a character level
    (`playerStats` `level`) and leave the town areas out (`excludeAreas` 1, 40, 75, 103, 109). The level gates are
    the ones of Sully's matching v0.6.13 hides (owner, 2026-11-05): inferior gear 10, white gear with at most one
    socket 10, plain quivers and throwing potions 10 (Sully: plain quivers 10; he hides the Choking Gas and Exploding
    potions at every level), magic and rare weapons and magic armour (the "except useful ones" hides) 20 (Sully's magic
    gear hide; ours keep rare weapons too), chipped and flawed gems 20 (Sully hides chipped gems from 20; flawed ones
    are ours), gold under 100 from 20 and under 500 from 60 (his first two gold steps; he goes on with under 750 from
    80 and under 2,000 from 90), minor potions (hp1, mp1) 12, light (hp2, mp2) 20, hp3/mp3 40 (he hides hp4, hp5,
    mp4, mp5 from 40 too), stamina/antidote/thawing potions at every level outside town (as his). Magic quivers
    stay, though Sully hides them from 20 (ESR has hundreds of quiver affixes). The
    broad weapon/armour hides leave out what Sully's filter leaves out: every mythical base (`MYTHICAL_BASES`, the
    ones that do not drop too) and the quest weapons (`QUEST_ITEMS`: d33 g33 hdm hfh hst leg msf qf1 qf2). The unique
    weapon/armour rule leaves out the mythical bases and the unique jewellery rule the mythical ring and amulets
    (mrn, mam, au9), so mythical uniques get only the mythical rule's sound and chat line. The two "except
    useful ones" hides (magic/rare weapons, magic armour, both from level 20 outside town) also exclude class items
    (`excludeItemTypes: ['clas']`) and keep useful stats as `< 1` exceptions; +class skills and +skill tabs get one
    check per class (8) and per tab (24), since a check without param reads only param 0 (oskills, +skills to one
    skill, are not kept: there is one param per skill). The white-gear hide (normal, at most one socket, from level 10)
    hides white class items and 0-socket bases you could still socket (Larzuk, Socket Donut), as Sully's does, and
    leaves throwing potions to the quiver rule, which hides only inferior to superior quivers and throwing potions
    from level 10 (magic quivers stay: ESR has hundreds of quiver affixes). The seven earlier teaching examples (exceptions on a hide rule, all-of vs any-of,
    an item code list, sockets vs max sockets, unique ids for The Oculus, a narrow inferior hide) are in their groups;
    the rune one now covers Vex to Zod. ESR items added on 2026-11-05: Weapon Mastery Tokens (`u23`, the drop from
    Corrupted Zakarum and map bosses; the awakened tokens u24 to u41 are cube-made and left out) and the Broken
    hourglass with its two shards (`um4` to `um6`, from the Eternal Ancients' tier 5 map, cubed into the Eternal
    Hourglass) in Keys/organs/endgame with the valuable look, the tink, an icon and a chat line; Unique Stones (`an0`
    to `an2`, cube outputs of an Ancient's Gift that turn a white base of their tier into a unique) in Crafting with the
    valuable look only (they never lie on the ground); Ore and Fake Notes (`ore`, `fkn`, both sold for gold) in Gold
    and potions with Sully's gold pile treatment: the gold plate and `$$` name parts, no sound.
  - _Tests_: `exampleRules.test.ts` writes, reads and validates every example against the real game data with its
    default presentation and with every choice None (then only "does nothing" for rules without a fixed action),
    checks that every code drops, the rune/material names, the 24 skill tab params and the presets, sounds and icons,
    and runs the hide (skill items, quest weapons, mythical bases, quivers), mythical vs unique, all-of/any-of, gold
    steps, Ore/Fake Note name parts and +3 class item examples through the evaluator; a table of every hide rule's
    level gate (`LEVEL_GATES`, a new hide rule must be added to it) checks each one hides a sample item at its level,
    not one level before and never in town.
    `examplePicker.test.ts` covers the selection model (Select all and the group checkboxes leaving hide rules out),
    the order and the style merge; `lootFilterSlice.test.ts` the
    `addRules` reducer.
- **Rows** (`RuleRow`): 1-based number, `ruleSummary` (e.g. `Zod Rune, Cham Rune +2 · unique · ≥3 sockets · → style
Mythical`: items/types/uniques by name when the bundles are in, codes otherwise, then quality, tier, flags, item level,
  sockets, stats, difficulty, areas, and the main action: `hide`, `→ style X`, the stripped replaceName/prefix/suffix or
  chat line), badges for `hide`, `useStyle`, `activeInLevels` (`L1,3`) and a non-default `location`, and a
  red/amber dot for the rule's worst diagnostic. **Comment first**: a rule with a (non-blank) comment shows the comment
  as the main line (`text-sm`) and the summary as a thin grey line under it (`text-xs`, truncated, the full text as
  its tooltip); without one the summary is the main line. The search matches both. A disabled rule's row is dimmed
  and has a dashed "disabled" badge first. Move up, move down, disable/enable (`PowerOff`/`Power`, "Disable rule N" /
  "Enable rule N", `aria-pressed`), duplicate and delete (asks first, the dialog showing the comment over the
  summary, as the row does) are icon buttons
  that float over the row on hover/focus with a mouse and are always shown on the selected row; on touch (no fine
  pointer) they are always shown, on their own right-aligned line under the text, so the comment keeps the row's
  full width (at 390 px they used to take about 150 px of it). The
  selected row is scrolled into view when the selection changes elsewhere (the JSON tab's "Rule N" link).
- **Editor** (`RuleEditor`, remounted per rule): "Rule N" (with a "disabled" badge), an **Enabled** checkbox (hint:
  kept in the file under `disabledRules`, which the game ignores; the repo has no Switch component), the `comment` field, the rule's diagnostics (paths relative to
  the rule), a collapsed "How rules combine (AND, OR, hide)" note (`HowRulesCombine`: conditions AND, list values OR,
  codes and types both checked, top to bottom with hide stopping, Show protecting the item from later hides (plugin
  1.8.2), a "Tip:" that anything a hide rule matches (and no Show rule above protects) loses its ground label for good (whether earlier rules' sounds and chat
  lines still fire is one of the "Verify in game" assumptions, so the tip does not say), so several narrow hide rules
  (one item type and quality each) beat one broad one, to be tried in the Test tab, exceptions written as negated
  conditions in the hide rule, `hideIfOtherConditionsFail` the other way round, and that it counts every other
  condition, quality included, so "weapon + magic + stat + hide if fail" also hides uniques and rares; the stat
  under "Except items with…" in a plain hide rule (written as `< 1`) keeps only the ones with the stat, since a
  missing stat counts as 0 (verified in game); a "Test tab" link sets `?tab=test`),
  then the conditions in sections (Which items, Item properties, Stats, Where and when) and an Actions card
  with `ActionsEditor owner="rule"`. Every change dispatches `patchRule`; an emptied list removes its key. A condition
  whose file value had the wrong shape (kept in `passthrough`) gets a note (the plugin most likely switches the whole
  rule off, not verified; the Test tab skips it); every passthrough key is listed read-only in a collapsed "Advanced /
  passthrough" block.
- **Basic / Advanced view** (`utils/ruleView.ts`, the segmented toggle `ViewToggle` in `components/rules/ViewToggle.tsx`
  at the top right of the rule editor, before Check in game; on a page narrower than 36rem both drop under the
  description). The Styles tab's style editor has the same toggle and split (see below). A per-browser setting in the settings
  feature (`ruleView`, `setRuleView` / `selectRuleView`, localStorage `lootFilterRuleView`, reads and writes in
  try/catch), default **Basic**, existing users included. Advanced is the full editor described here. Basic shows:
  Enabled, Comment, the diagnostics, How rules combine (collapsed), Item codes, Item types, Unique or set items,
  Quality, Sockets, Ethereal, Item stats (all of) and, on a hide rule, Except items with…; in the actions the label
  preview, **Use style** (every example rule uses one, so it is chosen like the sound or icon), Hide, Show (since
  2026-11-12: the main Add rule button's rules in Protection carry it), a **Name
  colour** select (Basic only: "None (no name colour from this rule)" or a colour code, written as
  `replaceName: "ÿc<code>{name}"`, a whole new name that a later rule's replaceName overrides, as the hint says;
  disabled with a pointer to Replace name when replaceName holds other text), label background and border, chat
  line, sound (with its volume) and minimap icon. **Style values in the fields**: on a rule with a style, every
  field the style sets shows the style's value (see [Style first, then tweak](#style-first-then-tweak)); a key the
  style sets counts as set for the gate, so an Advanced field the style sets (a prefix, a droplight) shows in Basic
  with the "advanced" badge, and a style's name colour belongs to Name colour (`ruleFieldGate({ …, style })`, where
  `style` is `findStyle(rule, filter)`). Everything else is Advanced: the
  except lists, base tier, item level, max sockets, the other three flags, Item stats any of, both character stat
  lists, a hide rule's "Advanced: hide only items with these stats" box, areas, location, filter levels, difficulty,
  Hide if other conditions fail, Chat line when hidden, Replace name, Prefix, Suffix, Notify and
  Droplight. The tables `BASIC_CONDITIONS` / `BASIC_ACTIONS` classify every condition and action key (`satisfies`
  over the types, so a new key must pick a side); `ruleFieldGate({ view, rule, hides, diagnostics })` gives each
  field `shown`, `advanced` or `hidden`. **A set field always shows**: in Basic an Advanced field with a value, a
  wrong-shaped value (passthrough) or a diagnostic on its key shows with a small "advanced" badge (the hide-only box
  counts its plain checks only, and a replaceName that only recolours the name belongs to Name colour), so nothing
  set is hidden and every diagnostic's field is reachable. Field ids and order do not change. The hidden ones are
  counted in a quiet "N more conditions / actions in the Advanced view." line at the end of each card, with a "Show
  Advanced view" button (`MoreInAdvanced`; focus moves to the toggle).
- **Basic / Advanced on the Styles tab**: the same per-browser setting, so one view for the whole editor (switching
  it on either tab switches both). The toggle (`aria-label` "Style view") sits at the top right of the style editor,
  before Rename / Duplicate / Delete (on a phone the row wraps under the description). In Basic a style shows the
  same Basic actions as a rule (`BASIC_ACTIONS`; a style has no Use style, it cannot use another): label preview,
  Hide, Show, Name colour (wording "from this style"), label background and border, chat line, sound with its volume,
  minimap icon and the style's Notes comment. The rule's action gate is `actionFieldGate({ view, actions,
diagnostics })`, which `ruleFieldGate` builds on (its conditions on top), so a set Advanced field (a value, a
  passthrough key or a diagnostic) shows with the "advanced" badge (its title says "this style sets it"), e.g.
  Sully's PurpleRune droplight, and the "N more actions in the Advanced view." line ends the card. A style's
  diagnostics carry `style` and a `styles/<name>/<key>` path; `diagnosticKeys` cuts the path by that name (a name
  with a slash works), and the Styles tab gets the filter's diagnostics for it. The rest of the tab (the list, Add
  style, Add preset, rename / duplicate / delete, the stray-conditions note) is the same in both views.
- **Check in game** (`utils/inGameCheck.ts`, the button at the top right of the rule editor). One way to verify
  what the plugin reads is to print it in the name (`"namePrefix": "[ED {stat:17} | Def {stat:16} | …] "`); that is
  how Enhanced Damage on weapons was found to read 0. The button inserts such a test rule right before the selected
  rule (so the rule becomes N + 1), below the comments above it (`addRule` with `belowComments`: the test rule takes
  them, so it sits in the rule's section, not at the end of the previous one), selects it and opens its headings in the
  rule list; a toast says so, and keyboard focus moves to the new editor's title
  ("Rule N", `tabIndex=-1`), since the test rule's editor has no Check button. The editor is keyed by the selected
  index and the rule count (rules have no ids), so it remounts although the test rule takes the source's index. The
  test rule (`inGameCheckRule`):
  - copies every condition of the rule except the four stat lists and the `formula` (codes, types, quality, tier,
    flags, ids, location, difficulty, areas, `activeInLevels`), so it shows the values whether the checks pass or not,
    and no action (no `hide`, `hideIfOtherConditionsFail`, style, sound…);
  - prints each stat the four lists check (exceptions included), once per stat and param, in list order:
    `Label {stat:ID}`, `Label:param {stat:ID,param}` for a check with a param, `Char Label {playerStat:ID}` for a
    character stat (`checkedStats`, `checkText`): `[ED {stat:17} | Tab:8 {stat:188,8}] `. Then the stats the formula
    reads (`formulaStat`), so a formula-only rule gets a check too: a number param as is, a skill name as the skill's
    id; where the formula reads any entry (`statMax`, `statSum`, a skill name on a chance-to-cast or charge stat) the
    placeholder prints param 0 and the comment says so. Labels are short
    (`SHORT_LABELS`: ED, Def%, FCR, MF, Tab, Sock…; other stats their name without `item_`, `#ID` for an id without
    data); ids come from the bundle, a name the bundle does not know stays a name. The guide documents no length
    limit for names;
  - Name parts are "later wins", so the text goes into the first of `namePrefix`, `nameSuffix` that the rule's
    effective actions (style included) leave free, else into a `chatMessage` `{name} [ … ]` (chat lines add up).
  - _Why before the rule_: a rule after it would never run for items the rule hides; before it, the test rule has no
    `hide`, so it changes nothing but the name (a unit test runs the evaluator with and without it). Trade-offs, said
    in the docs here and in the hint: a later matching rule that sets the same name part replaces the text, and an
    item the rule (or an earlier rule) hides shows no label; disable a hide rule while testing to see every item.
  - has the comment "In-game check for the rule below: compare these numbers with the item tooltip, then delete this
    rule. ED = item_maxdamage_percent (17); Tab:8 = item_addskill_tab (188) param 8 Fire Skills (Sorceress)"
    (`IN_GAME_CHECK_MARK`; no rule number, which would go stale when rules move), so searching "in-game check" lists
    every test rule; such a rule's row and editor carry an "in-game check" badge (`isInGameCheckRule`, by the comment's
    start, so test rules from the earlier "In-game check for rule N + 1 (the rule below)" wording count too) and the
    editor explains it instead of the button.
  - A rule without stat checks gets a disabled button and the reason under the title ("This rule checks no stats; …").
    So does a rule with wrong-shaped keys (`wrongShapedKeys`, `wrongShapeReason`: "This rule has a wrong-shaped key
    (sockets); fix it first."): the copy would leave those keys out and apply while the rule itself is skipped. A
    single-number `"activeInLevels": 4` is not wrong-shaped: the button works and the test rule keeps the level (as
    `[4]`).
    Otherwise the line under the title explains the button and ends "If a number differs from the tooltip, the plugin
    reads that stat differently; tell us" (a new GitHub issue, `REPORT_STAT_URL`).
- **Controls**: item, type, unique/set and area pickers (chips with name + code/id; more than 12 chips collapse behind
  "+N more"); named matches (`quality`, `baseTier`, `difficulty`): any / one / several / range, picks stored as names,
  file numbers kept until that part changes (`utils/matchValues.ts`); number matches (`itemLevel`, `sockets`,
  `maxSockets`): any / exactly / list (`1, 2, 3`) / range (min only or max only allowed); flags any / yes / no; stat
  check rows: stat picker, param, op (`>=` for new rows), value, two values for `between`
  (`utils/statChecks.ts`); the param is described under "Stat params" below. The stat picker lists itemstatcost names
  with the in-game label and id as detail ("strengthpercent · Bonus to Strength % · 255", lootfilter.json
  `stats[].label`) and searches the label too, so "strength" shows the flat and the percent stat apart and "faster
  cast" finds `item_fastercastrate`. The four stat lists are labelled "Item stats, all of" / "Item stats, any of" (`itemStats`,
  `itemStatsAnyOf`: the item on the ground) and "Character stats, all of" / "Character stats, any of" (`playerStats`,
  `playerStatsAnyOf`: your character, not the item), because users mistook "Item stats, any of" for the player list;
  the rule summary prefixes character checks with `character` (`character any of strength <10`), the Test tab says
  "Character level" and "More character stats". The two item stat lists also have "Browse affixes…" after "Add stat
  check" (the affix browser below; not on a hide rule, see "Except items with…"), and a line under the Stats section
  says the game checks item stats, not affix names; `location` checkboxes (none = on the ground); `activeInLevels`: "Every level" or a tick per
  filter level, unknown ids listed with a remove button. Unticking every level writes `activeInLevels: []` (the
  validator warns about the empty list); ticking "Every level" removes the key.
- **Except items with…** (`conditions/ExceptionsControl.tsx`, hide rules only: own or style `hide`, first field of
  the Stats section). Request: "hide all magic weapons except those with Demon Damage". The format has no exception
  key, so an exception is stored as its opposite check (`invertStatCheck` in `utils/statChecks.ts`: `>=`↔`<`,
  `>`↔`<=`, `==`↔`!=`; `between` has no single opposite) in an item stat list: "Keep items with any of these" →
  `itemStats` (every check must hold to hide, so one exception keeps the item), "Keep items with all of these" →
  `itemStatsAnyOf` (one failing exception hides it). The control **owns those rows** (decided because, before that,
  switching the mode did not move existing exceptions, they showed negated in the regular lists,
  the exceptions' Browse affixes saw only one side, and the regular Browse affixes added `>= 1` checks on hide rules):
  - The `<`, `<=` and `!=` checks of both lists (`isExceptionCheck`, `exceptionOf`) are listed here as `StatCheckRow`s
    in their natural form: the row shows `invertStatCheck(stored)` and writes back `storedException(edited)`, edits go
    to the row's index in the full list (`statCheckRows`). Ops offered: `>=`, `>`, `==` (`EXCEPTION_ROW_OPS`); the
    param field, value and remove ("Remove exception") work as in the other lists. "Any known level" stays where it
    was valid (one exception per level is "keep items with the skill at any of these levels" only in `itemStats`):
    the row passes `anyOf` = "any of these" mode, so the option is offered there and disabled in the "all of these"
    mode ("only with “Keep items with any of these”").
  - The mode is where the exceptions are (`exceptionPlacement`: `any`, `all`, `both` or none); with none, the toggle
    only picks where new ones go (component state, starting from the file). Switching moves every exception of the
    other list to the end of the picked one, in order (`moveExceptions`; the other list keeps its plain checks, an
    emptied list is removed), so only one side holds them. "Add exception" appends `{ stat, op: "<", value: 1 }` and
    "Browse affixes for exceptions…" (the affix browser's inverted mode) edits the side holding them.
  - Edge cases: a hand-written file with exceptions in both lists shows both groups, labelled ("… (stored in Item
    stats, all of)"), with no mode pressed, an amber note, and no add controls until a mode is picked, which gathers
    them all into that list. When `itemStatsAnyOf` holds plain checks, "Keep items with all of these" is disabled
    with a line saying why (exceptions there would be ORed with the plain checks), unless the exceptions are already
    there (then the amber note says they are ORed and not in "Kept", and "any of these" moves them out). With
    `hideIfOtherConditionsFail` in the effective actions, exceptions keep nothing, so the "Kept" line gives way to an
    amber note ("With "hide if other conditions fail" these exceptions keep nothing … Turn it off to use
    exceptions."); `readsExceptions(actions)` decides, for the control and the rule summary.
  - Below the rows, "Kept: items with A ≥1 or B ≥1; or items with C ≥1 and D ≥1." reads the exceptions back
    (`ruleExceptions`). The field hint says how they are stored, that switching moves them and that turning Hide off
    leaves them as plain `< 1` conditions; a non-hide rule holding `<`, `<=` or `!=` item stat checks gets a line in
    its Stats section that they are plain conditions there.
  - **Advanced box**: on a hide rule the regular `itemStats` / `itemStatsAnyOf` lists sit in a collapsed
    "Advanced: hide only items with these stats" `<details>` (open at first when they hold plain checks), show only
    the plain checks (`StatCheckList`'s `shows`, indices mapped back to the full list), offer the ops `>=`, `>`, `==`,
    `between` (`PLAIN_HIDE_ROW_OPS`, so a row cannot turn into an exception) and have no Browse affixes (the plain
    "Add stat check" stays). Their hints say what a plain check does there. Player stat lists and non-hide rules are
    unchanged.
  - The file format and the stored checks do not change; nothing is rewritten unless the user edits. The rule
    summary still reads a hide rule's `item_demondamage_percent < 1` as "unless item_demondamage_percent ≥1"
    (`ruleSummary`: several in `itemStats` join with "or", an all-exception `itemStatsAnyOf` with "and", a mixed
    `itemStatsAnyOf` stays "any of …"). Both the summary and the control use the effective actions (a style can
    hide): the Rules tab and the Test tab's trace pass `readsExceptions(effectiveActions(rule, filter))` to
    `ruleSummary`, whose default reads the rule's own actions.
- **Stat params** (`conditions/StatParamField.tsx`, `utils/statParams.ts`). The skill, skill tab, class, event and
  charged stats keep one entry per skill, tab or class, told apart by `param` (encodings in
  `game-data/engine/statLayers.ts`), so the param field picks it by name: a skill tab picker (24 tabs grouped by
  class, value `class << 3 | tab`: "Martial Arts (Assassin)" = 50; the search also matches the class name and code),
  a class picker (class id, ama 0 … war 7), a skill picker for `item_singleskill`, `item_nonclassskill` and
  `item_aura` (the class skills by class, then "On items": the non-class skills the game data puts on items for that
  stat, from lootfilter.json `knownLayers`, then "Other skills"; detail `#id · class`, plus "on items" for a known
  class skill; the data puts nearly every class skill on items for these stats, all 280 for `item_singleskill`, so an
  "On items" group first would swallow the class groups; `item_singleskill` lists class skills only), and for the
  event stats (chance to cast on hit, attack, kill, death, level up, getting hit,
  casting, taking damage) and `item_charged_skill` a skill picker plus a level select (`skill << 6 | level`): the
  levels the game data puts on items for that skill (the skill picker lists the skills on items first here, with their levels: "#472 · Sorceress · lvl 15,
  20, 30, 60"), "Other level…" (a 1–63 field), and "Any known level (N)", which replaces the row with one check per
  known level (`anyKnownLevelChecks`, `replaceStatCheckWithMany`). The level field shows while the level is not a known one or after "Other level…" for that skill (a skill change hides it again). Once a param is set, each picker starts with "No param", which removes it (the level select goes with it). Picking a skill keeps the level when the skill
  has it (or has no known level), else takes its lowest known level, 1 without one. The triggers show the name and
  the raw param muted; typed digits are taken as a raw param ("Use param 50", "Use skill id 1200"), and a param that
  does not decode (level 0) stays a number field. Without the bundles the pickers take typed numbers only. Changing
  a row's stat to one whose param means something else drops the param (`sameParamEncoding`; event and charged
  share theirs). Charged rows say "Value = max charges × 256 + charges left (5/5 = 1285): ≥ 1 = has the charges, ≥
  1280 = at least 5 max charges." (no charges control: decided against for now).
  - _Any known level_: one check per level is "the skill at any of these levels" only for a `>=`, `>`, `==` or
    `between` check in an any-of list, and for a `<`, `<=` or `!=` check (on a hide rule an exception: "none of the
    levels") in an all-of list (`expandsAcrossLevels`); elsewhere the option is shown disabled with the reason ("only
    in an any-of list; a rule has one any-of list" / "for a <, <= or != check only in an all-of list"). There is no
    "move to the any-of list" button and no collapsed display of the expanded rows (kept simple).
  - Names (`statParamLabel`, `LootFilterLookup.statParamLabel`): "Martial Arts (Assassin)", "Sorceress", "Fire
    Ball", "Orb of Winter lvl 25"; a skill name that several skills share (25 in ESR 3.3, a class skill and its
    item copy) carries the id ("Chain Lightning #124"). `formatStatCheck` uses them, so the rule summary, the
    "unless" part and the Except control's "Kept:" line read `item_addskill_tab[Martial Arts (Assassin)] ≥1`; an
    unknown or undecodable param stays a number.
  - Data: everything comes from lootfilter.json (`stats`, `skills`, `knownLayers`) and types.json (`classes[].tabs`,
    tab index = layer & 7); the loot filter never loads skills.json. `buildStatParamData` runs once per bundle pair
    in `useLootFilterData` (`LootFilterData.params`); the skill option lists are cached per stat.
- **Pickers** (`components/pickers/index.ts`): `MultiPicker` / `SinglePicker` (Popover + cmdk with our own filter,
  `utils/pickerSearch.ts`: every term in name or code/id, exact and prefix matches first, at most 200 shown with "type
  to narrow"; Enter picks the highlighted option; the "Add code …" entry for typed values comes last) and the wrappers
  `ItemPicker`, `SingleItemPicker`, `ItemTypePicker`, `StatPicker`, `AreaPicker`, `UniqueOrSetPicker`. Non-spawnable
  weapons and armor are greyed with "shadow base" (tooltip: they exist only as a unique's base or as a cube result),
  misc items with `drops: false` with "never drops"; non-spawnable misc items that drop (the Ancient Scrolls, Ore) look
  like any other (`itemMutedState` in `utils/lookup.ts`, shared by the options and the chips). Two or more unmuted
  items sharing a display name get their code in the option label ("Ko Rune (r19)" / "Ko Rune (r68)"; ESR 3.3: 25
  names, 282 items, mostly containers and the 50 Ancient Scrolls; 3.3 added the 5 Alien Artefacts); a muted twin keeps the plain name and is told apart
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
- **Data**: `useLootFilterData()` → `{ status, data, types, lookup, options, params, reference }`; `lookup`
  (`utils/lookup.ts`) has `item`, `itemName`, `itemType`, `typeName`, `statName`, `statId`, `statParamLabel`,
  `areaName`, `uniqueOrSetName`, `skillName` (the skills.txt name of a skill id, for formulas) (all `undefined` for
  unknown keys or missing data), and the `statIds` / `skillIds` maps the evaluator's context takes; the lookup and option lists are built once per loaded bundle pair (module cache). An item
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
  potions) are a plain list. A cell: checkbox, the item's icon (24 px, `ItemIcon` by code, both tabs; the
  uniques / sets browser has none: its cells are row ids), name, code, one stat line (damage or defense, block, speed for weapons,
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
- **Coupon uniques are not listed** (`coupon: true` rows, ESR 3.3: 382, #699–1069 without Annihilus #1059 and
  #1377–1388): they are cubed from three Ancient Coupons and never drop, so they only clutter the tables. The Uniques
  tab's footer says so ("382 coupon uniques are not listed: they are cubed from Ancient Coupons and never drop. Add one
  by name or id with "Add unique or set item"; ids already in the rule stay on Apply"); the picker still offers them.
  A coupon id already in the rule is not in the browser's codes, so Apply keeps it like any unlisted id. The shared-id
  warning still knows coupon uniques (a set item's id also matches the coupon unique with that id; none in 3.3).
- **Cells**: name, base code (tag), then base name · `Lvl N` (required level) · `#id`. Rows of one table with the same
  name, base and disabled flag are one cell that selects all their ids (ESR 3.3: Ember of Creation ×230 on the
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
  the plugin ignores the quality when matching; ESR 3.3: all 270 set ids are also unique ids), so a ticked id is
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
  shows one "Enhanced Damage" row on 17 and hides 18 wherever an affix writes both (every ED affix in ESR 3.3, 44), so
  a tick writes one check on `item_maxdamage_percent`; an affix writing only one of them would keep it as its own row.
- **Stats the plugin reads as 0**: the Enhanced Damage and Enhanced Defense rows carry their quirk from `STAT_QUIRKS`
  in red, text-sm, medium weight, headline first ("Currently only works on jewels and charms (reads 0 on weapons).
  Reads 0 on weapons (the game keeps it off their stats; confirmed in game); works on jewels and charms (confirmed on
  a jewel)."); a durability row, if one were listed, keeps the amber note (untested); see "Known plugin limits".
- **Search**: every whitespace term must match the label, the stat name, an affix name, an affix text line, a param
  name (below), or (digits) the stat id. An affix is emphasised when the search names it: at least one term is in its
  name, text lines or param names and every term is there or in the row's label or stat name. The text lines matter
  because ESR names affixes after themes: the flat "+X to All Attributes" suffixes are "of the Sky / Stars / Heavens /
  Zodiac" (stats 0–3), while the suffix named "of All Attributes" writes the percent stats 255–258. Searching "all
  attributes" by name alone found only the percent rows, and a user ticked "Bonus to Strength" for +Strength; now it
  lists Strength, Energy, Dexterity, Vitality and the four "Bonus to … %" rows. An affix's text lines count for a row
  when the affix writes only that stat or has a single line ("+(10 to 15) to All Attributes" describes all four
  stats); a hybrid with one line per stat ("Sharp": Enhanced Damage and Attack Rating) adds none, so "attack rating"
  does not list its Enhanced Damage row. The lines are the affix's tooltip in the list. They are never used to name
  params (`matchingParams`, `autoPickedParams` and the chip search still read param and affix names only), so a broad
  search does not pre-pick more.
- **Labels**: from affixes.json `stats[].label`; the percent twin of a flat stat ends in " %" ("Bonus to Strength %"
  next to "Strength", "Increase Maximum Life %" next to "Life"; GAME-DATA.md "Affixes" has the rule and the list).
- **Skill, tab and class params** (`Affix.layers` of affixes.json, named through `LootFilterData.params`): a layered
  row (`layerKind`; the skill, skill tab, class, event and charged stats whose affixes name params) lists the union
  of its affixes' params, and each affix names its own in brackets ("Apprentice's [Demon Skills (Warlock)]": ESR
  reuses the Necromancer prefix names for the Warlock tabs; "of Bone Wave [lvl 15, 25, 35]" for an event affix named
  after its skill, "Skillful [280 skills]" past three). Param names are part of the row's search, so "martial",
  "demon" or "orb of winter" find Skill Tab Levels and the chance-to-cast rows. A ticked layered row shows its params
  as toggle chips (`aria-pressed`): the ones the search names (`matchingParams`: like the affix emphasis, over the
  param's name and the names of the affixes writing it) plus the picked ones, else all of them; a picked param no
  affix writes (a check the list already had) is shown too, by name or "param N", so it can be unpicked
  (`shownParams`). A row with more than 12 params gets its own search box above the chips ("Skill, class or
  affix…"): while it holds text, the chips are every param of the row whose name, skill class (`className`: a skill,
  event or charged param's skill's class; tab names already say the class) or writing affix names hold every term,
  or whose param is the typed number, independent of the main search and of what is picked ("Showing 31 of 280.").
  Above the chips (rows with more than one param): "Select all shown (N)" picks every shown chip (`pickShownParams`),
  offered only where several picks mean "any of them" (the any-of list and "keep items with any of these",
  `paramsAreAlternatives`), and "Clear" removes every pick of the row. Ticking a row pre-picks its only param or the
  one param the main search names (`autoPickedParams`), else nothing: a broad search names many ("skill" names all
  280 params of Single Class Skill, since the "Skillful" prefix writes each of them), and pre-picking all of them made
  a user's clicks on two chips un-pick them. A line under the chips says what is
  picked ("2 picked: one check each."; "This list needs every check, so an item needs all 2 of these" in the all-of
  modes; an event or charged row there adds "For any of these levels, use the any-of list (Item stats, any of)." or
  "… use “Keep items with any of these”."). Apply waits ("Pick a
  skill tab for Skill Tab Levels (or untick it).") while a ticked layered row has neither a picked param nor a check
  without param (`rowsMissingParams`).
- **Apply** (`applyAffixSelection`): the draft starts with the listed stats that already have a check in that list
  (by name or id, any value or param; `<`, `<=` and `!=` checks are exceptions, which only the inverted mode below
  owns, so the plain mode neither ticks nor removes them). Apply keeps checks on stats the dialog does not list and on stats still
  ticked (unchanged), removes checks on listed stats that were unticked, and appends `{ "stat": <name>, "op": ">=",
"value": 1 }` (a presence check, by name as the stat picker writes it; the user sets the number afterwards) for each
  newly ticked stat in display order; an emptied list removes the key, and nothing is dispatched when nothing changes.
  A layered row writes one check per picked param instead (`initialAffixParams` starts from the params already
  checked): a check whose param was unpicked goes, a check without param stays, each newly picked param appends
  `{ stat, op: ">=", value: 1, param }` (`< 1` in the inverted mode), by row then param.
- **Any-of note**: opened from `itemStatsAnyOf`, the footer says "An item matches when ANY ticked stat is present; a
  hybrid affix gives all its stats, tick them in the all-of list to require both."
- **Inverted mode** (`except-any` / `except-all`, from "Except items with…"): only the exception checks (`<`, `<=`,
  `!=`) of the list are the browser's, so the draft starts from them and plain checks on the same stat are kept; a new
  tick appends `{ stat, op: "<", value: 1 }`. The title says "Browse affixes: except items with…" and the footer
  where the ticks go ("…the rule hides only items with none of them" / "…keeps only items with all of them"). The
  Except control opens it on the one list holding the exceptions (switching its mode moves them), so every exception
  shows ticked.

## Actions editor (`components/actions/`)

`ActionsEditor` (`actions`, `onChange(patch)`, `filter`, `owner: 'rule' | 'style'`, `styleName?`, `gate?`: the Basic /
Advanced `ActionFieldGate`, every action when undefined) is the form for every
action key; the rule editor and the Styles tab both render it. Every control sends a shallow patch (`{ key: undefined }`
removes the key); `passthrough` is never patched. Sections:

- **Label preview** (top): `LabelPreview` of prefix + (`replaceName` or `{name}`) + suffix in enUS, with `{name}` shown
  as "Item Name" and other placeholders as written; background and border from the effective actions, and the
  effective minimap icon beside it (`MinimapIconPreview`, at its size up to 64 px; none while the rule hides). For a rule with
  `useStyle`, the style's actions are underneath and the rule's own win, per key (`utils/effectiveActions.ts`).
- **Style** (rules only, `StyleSection`): `useStyle` as a searchable picker (a button with the style's `StylePreview`
  and name, opening a cmdk list): None, **In this filter** (the filter's styles, each drawn with `StylePreview`:
  "Item Name" in its label look and its minimap icon beside it; a `<Name>NoIcon` copy the example picker added shows
  the same label without the icon; a missing name kept as "(missing)") and **Presets (added to the filter when
  picked)** (`STYLE_PRESETS` with the Styles tab's `PresetPreview`, label and description; a preset whose name the
  filter already has is listed once, as the filter's own). The icons in the list and the button are capped at 40 px
  (`maxIconSize`) so a 128 px icon keeps the rows even; the tooltip gives the real size. Picking goes through `onChooseStyle` (see
  [Style first, then tweak](#style-first-then-tweak)); below it a collapsed read-only list of the style's actions
  (`StyleSummary`; its `comment` is shown but not counted). A rule's
  `comment` belongs to the rule editor; a style's is a one-line field under **Notes** ("A note for yourself; the plugin
  ignores it.").
- **Visibility**: `hide` (hint: the item cannot be picked up; no later rule runs; a Show rule above protects the item),
  `show` (Basic since the main Add rule button's rules in Protection carry it; plugin 1.8.2: "no later rule can hide it; later rules still change its looks, chat lines and
  sounds. Not with Hide."), `hideIfOtherConditionsFail` (checkboxes; unchecked removes the key), `chatMessageWhenHidden`.
- **Name**: `replaceName`, `namePrefix`, `nameSuffix`. **Chat**: `chatMessage`, `notify` (the hint shows the filter's
  effective drop line).
- **Label** (`LabelSection`): `labelBackground` (colour + alpha, default alpha 242), `labelBorder` (colour + alpha, width 1 to 8 as the
  plugin requires, clamped, emptying keeps it; the validator errors outside that; "Add border" / remove). Texts are checked in the
  validator too (`checkText`: placeholders per context, `ÿc` codes, `qualityColors`), so uploads, JSON edits and AI imports get the
  same warnings as the field.
- **Sound**: combobox in two groups: **Bundled sounds** (all 9 files, each with its label and use and its own play /
  stop button, which plays without picking, by click or by Enter / Space on the focused button: the button keeps those
  keys from the list, whose own Enter would pick the highlighted sound) and **Game sounds** (the sounds.txt names, at most 100 shown); the
  search matches anywhere in the text (a bundled file also by its label and use), so the chosen sound never narrows
  the list, and the current one has a check mark; "Use as typed" takes any other name (digits become a row number).
  Closing the list stops a preview started from it. A play button for the chosen bundled file (an `Audio` at
  `soundVolume ?? filter.soundVolume ?? 100`), "preview a local file" input
  (object URL, revoked on change/unmount), `soundVolume` (blank = filter default). The hint says where sounds come
  from: a file in the `sounds` folder next to the filter (the bundled ones from Sully's QoL) or a game sound by its
  sounds.txt name or row, which needs no file (sounds.txt is a table in the mod's game data); such a sound has no
  preview ("a game sound plays from the game's files").
- **Minimap icon**: on/off (turning it on gives `DEFAULT_ICON`, `{ iconName: 'star_white', iconSize: 40 }`: the white
  star takes any tint; the sprite's own size is 128 px, as every bundled icon; on a rule whose style has an icon the
  box is already ticked with the style's icon), the **icon picker** (`IconPicker`, below), `iconSize` (4–256, blank =
  file size), tint (alpha optional), sprite preview.
  - _Icon picker_: a button with the current icon (a tinted `IconThumb`, the name and its label, or "Your own .sprite
    file") that opens a popover: a search box (`filterIcons` in `utils/iconPicker.ts`: every word anywhere in the
    name, label or use, any case; an empty search lists all), a 4-column grid of every bundled icon
    (`ICON_PICKER_ICONS`: the 25 generated ones first, then Sully's 12; each tile its picture and name, the current one
    outlined with a check; a tile's accessible name is the file name and its label, "star_gold, Gold star (shape)"),
    arrow keys (`gridMove`: left / right by one, up / down by a row) and Enter in the search
    box, and **Custom file name…** (a text box + Use) for the user's own `.sprite` (`.sprite` may be left off); a search
    that matches nothing offers "Use “…” as the file name". The thumbnails decode through `useBundledSprite`, once per
    name for the page, and only while the grid is open. The datalist it replaces only suggested names starting with
    the current one, so once a rule had `goldstar` no other icon was offered.
- **Droplight**: on/off (`{}`), a beam colour or "the game's white beam".

Text fields (`ColorTextField`) take raw `ÿc` codes and have two insert menus: colour codes (swatch grid of `COLOR_CODES`)
and the placeholders of the field's context (`names` for names, `chat` for chat lines, `dropFormat` and
`levelChangeFormat` for the Settings tab's notification lines); the token goes in at the caret
(`utils/insertAtCaret.ts`) and, once the menu has closed, the field gets the focus back with the caret after the token
(the popover's `onCloseAutoFocus` is prevented, else Radix would focus the menu button). Below the field a small preview; a `{...}` token the guide does not know, or one that does
not work in that context, gets a hint. Per-language texts get a language select.
`ColorControl` is a native colour input + optional alpha slider + `[r, g, b(, a)]` readout + clear
(`utils/colorValues.ts`).

Previews: bundled assets are listed in the asset registry, `utils/bundledAssets.ts` (see below; names in the files'
own case because the app's server is case-sensitive; an `iconName` in any case finds them). `useSoundPreview` plays one `Audio` at a time across the page and stops on
unmount. `useBundledSprite` fetches and decodes a bundled sprite once per name; any other icon name offers a local
`.sprite` picker. The canvas draws the first frame at `iconSize` (longer side) with the tint applied
(`utils/tintSprite.ts`: RGB × colour/255, alpha × colour[3]/255); a decode error shows the decoder's message. A sounds.txt
sound has no preview (it plays from the game files).

### Style first, then tweak

Owner decision after testing a filter from scratch: a rule's own action wins over its style's, per key (the format's
rule, `engine/actions.ts` `mergeActions`; kept as is), so a rule that already set a background, border and name colour
kept them when it picked a style, and the style seemed not to work. The editor now follows "pick the style, it sets
everything; then change a few things":

- **Picking a style clears the rule's own values for the keys the style sets** (`utils/styleChoice.ts`):
  `applyStyleChoice(rule, style)` gives `{ patch, cleared }` (every `STYLE_KEYS` key, the effect keys but `useStyle`,
  that both set; keys the style leaves free stay; a wrong-shaped own value kept in `passthrough` counts as set, since it
  is written back to the file and would still win there while the field shows the style's value). `planStyleChoice(rule, filter, target)` (target None, a filter
  style or a preset) builds one `chooseRuleStyle` edit (`useStyle` + the clearing patch + `addStyle` for a preset the
  filter lacks) and its exact undo (the removed values and the old `useStyle` back, a wrong-shaped original in
  `passthrough` too; `removeStyleIfUnused` for an added preset, kept when another rule uses it by then; `ifUseStyle`
  makes the undo a no-op once the rule's style has changed again). The rule editor dispatches it and shows a toast
  (`styleChoiceMessage`): "Cleared this rule's own name colour, background and border so the style shows." (titled
  "Added the style UniqueItem" when a preset was added) with **Undo** (10 s). Nothing cleared and nothing added: no
  toast.
- **Presets in the dropdown**: picking a preset adds it to `styles` with the Styles tab's rule (`presetStyleStatus`:
  a missing one is copied in; a style of that name is never overwritten, the filter's own is used, "The filter
  already has a style named …"), sets `useStyle` and clears as above, all one store edit.
- **Fields show the style's values** (`components/actions/styleValues.tsx`, one helper for every field, and
  `StyleValueMark`): with a style, each field the style sets (name colour / Replace name, prefix, suffix, background,
  border, chat lines, hide flags, notify, sound and volume, minimap icon, droplight) shows the style's value with a
  muted "from style X" tag after its label; editing it writes the rule's own override, tagged "changed from style X"
  with **Reset to style** (removes the own key). `actionOrigin(own, style, key)` tells `own` / `style` / `changed` /
  `none` apart. An edit back to exactly the style's value removes the own key (`collapseToStyle`), so no redundant
  override is left. A rule cannot remove a style's value (the format has no "unset"): over a style's value the
  remove buttons are gone (background clear, border remove, sound remove), the Minimap icon and Droplight boxes stay
  ticked (disabled, hint "pick another style to drop it"), and the Name colour select has no None; the Hide, Hide if
  other conditions fail and Notify boxes write the rule's own `false` when unticked over a style's `true` (own wins
  per key; not checked in game). Fields the style does not set behave as before. The Styles tab edits a style
  itself, so it has no style values (same pickers, no tags).

### Bundled sounds and icons (`utils/bundledAssets.ts`)

The asset registry lists every sound and minimap icon the app bundles under `public/loot-filters/sounds/` and
`public/loot-filters/icons/`: `BUNDLED_SOUND_ASSETS` (`file`, `label`, `use`, `credit`) and `BUNDLED_ICON_ASSETS`
(`name` without `.sprite`, `label`, `use`, `credit`, `lowend` when a `<name>.lowend.sprite` variant sits next to it).
`BUNDLED_SOUNDS` / `BUNDLED_ICONS` (the names), `findBundledSound(Asset)` / `findBundledIcon(Asset)` and
`isGeneratedIcon(asset)` derive from it; `DEFAULT_ICON` is what ticking Minimap icon gives. Everything that offers or
ships the files reads it: the sound combobox and its play buttons, the icon picker, the sprite preview, the example rules dialog's
Sound and Icon selects, the Test tab's play button, and the .zip download (`collectReferencedAssets`, which adds the
`.lowend.sprite` of a `lowend` icon). All nine sounds and the first twelve icons are Sully's (the `use` lines say where
his filter uses each one; `tinkLOUD.mp3` is bundled but unused by him); the other 25 icons are generated (credit
"Generated for this app", see below). The `credit` is not shown in the UI today; the pickers show `label` and `use`.

**Adding a sound or icon**: put the file into `public/loot-filters/sounds/` (`.mp3`, `.wav` or `.flac`) or
`public/loot-filters/icons/` (`.sprite`), then add one line to the registry, e.g.
`sound('chime.mp3', 'Chime', 'Rare drops you want a soft cue for.')` (the `sound` / `icon` helpers fill in the credit;
pass a full object for another author). Icons are bundled at 128 px on the longer side (Lanczos on premultiplied
alpha, see [Using a filter in the game](#using-a-filter-in-the-game); the repo has no script for shrinking, so shrink a
new sprite with your sprite tool first). A generated icon is added in the generator instead (below). `bundledAssets.test.ts`
fails while the folders and the registry disagree, and decodes every icon.

#### Generated icons

25 minimap icons are drawn in code in the style presets' colours, so every preset has a matching icon:
`scripts/lib/lootFilterIcons.ts` (shapes, colours, the list), `scripts/generate-loot-filter-icons.ts` (writes them),
`engine/spriteEncode.ts` (the `.sprite` encoder). Names are `<shape>_<colour>`; none clashes with Sully's in any case.

| Icon                                          | Pairs with (preset)                                                 |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `star_gold`, `crown_gold`                     | Unique (`crown_gold` for the best ones)                             |
| `star_green`                                  | Set                                                                 |
| `star_purple`, `crown_purple`                 | Mythical unique                                                     |
| `diamond_red`                                 | High rune                                                           |
| `diamond_orange`                              | Mid rune                                                            |
| `triangle_orange`                             | Low rune (points down at the drop)                                  |
| `cross_red`                                   | Valuable                                                            |
| `shield_white` (three sockets)                | Runeword base                                                       |
| `square_emerald`                              | Good charm                                                          |
| `hexagon_teal`, `hexagon_yellow`              | Good jewel (its teal border, its yellow name)                       |
| `ring_blue`                                   | Good jewellery                                                      |
| `skull_purple`, `key_purple`                  | Uber key or organ (organs and essences, keys)                       |
| `gem_gold`                                    | Perfect gem                                                         |
| `flame_orange`                                | Crafting reagent                                                    |
| `coin_gold`                                   | Rare reagent (gold plate), large gold piles                         |
| `scroll_gold`                                 | Coupon                                                              |
| `map_white`                                   | Map                                                                 |
| `circle_grey`                                 | Muted                                                               |
| `star_white`, `diamond_white`, `circle_white` | any colour through the icon's tint (`color` multiplies the colours) |

The style presets carry them (see [Style presets](#style-presets)), the example rules show them through their presets
(_Icons_ under the Rules tab's example rules), and so the example filter (since v2.1.0) has them in its styles; Sully's filter keeps his own.

Drawing: every shape is a signed distance function on the 128 px canvas; a pixel's distance gives the fill, a dark
outline 6 px wide (about 2 px at the usual 40 minimap pixels; the colour × 0.16) and the transparent outside, each edge
anti-aliased over one pixel from the exact distance (the result of heavy supersampling, without its cost, and
deterministic). The fill is the colour shaded lighter at the top and darker at the bottom, with bevelled facets lit from
the top left, shine spots and dark detail marks (skull eyes, scroll lines, shield sockets). Straight (not premultiplied)
alpha, fully transparent pixels `0, 0, 0, 0`, as in Sully's files. 64 KB each, 1.56 MB in all.

**Regenerate** after changing a shape, colour or the list: `npm run loot-filter:icons` (writes the files and removes a
`<shape>_<colour>.sprite` no longer listed; `-- --check` only compares and exits 1 when one is stale; `-- --sheet
<file.png>` also writes a contact sheet of every icon decoded back with the app's decoder at 128, 48 and 32 px, Sully's
below for comparison). Then list a new one in `bundledAssets.ts` with the `generated(name, label, use)` helper.
`scripts/lib/lootFilterIcons.test.ts` fails while a committed file differs from a fresh render, the registry and the list
disagree, or an icon loses its transparent border.

**Format and verification** (no in-game check, owner decision; by structure and bytes):

- The header (40 bytes, little-endian): `SpA1`, u16 version 31, u16 frame width (= width), u32 width, u32 height, u32 0,
  u32 frame count 1, u32 0, u32 0, u32 pixel byte count (width × height × 4), u32 4 (bytes per pixel); then the RGBA
  rows from the top and nothing after them. The encoder writes exactly this.
- Round trip (`engine/spriteEncode.test.ts`): decoding and re-encoding each of Sully's twelve bundled icons gives the
  file byte for byte; the same holds for his eleven original 512 / 1080 px files (checked once from his repository, not
  committed). The mod's `goldstar.lowend.sprite` (and its original 200 px `goldstar.sprite`) differ only in the last two
  header fields, which they leave 0. Of the ESR clone's and the vanilla art's 2,150 single-frame `SpA1` sprites, 721
  re-encode byte for byte, 1,234 differ only in those two fields (0) and 195 only in the u32 at 28 (an unknown value in
  some item sprites); the pixels and every other byte always match.
- Every generated file has the very same 40 header bytes as Sully's 128 px icons, decodes with `engine/sprite.ts`, and
  passes the plugin's own file check (below).
- The plugin (v1.5.3 disassembly, `d2rl-celestialrayone-loot-filter.dll`) reads `icons/<iconName>.sprite` and accepts it
  when it is at least 40 bytes, starts with `SpA1` (not `SPa1`, which the decoder also takes for the game's item
  sprites), has version 31, a width, height and frame count other than 0, a width divisible by the frame count, a width
  up to 8192 and a height up to 4096, and all the pixels ("it is not a D2R sprite (SpA1, version 31)", "its header does
  not match its pixels"). It reads no other header field and takes the first frame. It then writes its own copy for the
  game, with the header above (the same last two fields), and registers it under `data/hd/global/ui/d2rloader/
celestialrayone.loot-filter/icons/<name>-<w>x<h>-<hash>` as both `.sprite` and `.lowend.sprite`: **a filter needs no
  `.lowend.sprite`**, so none is generated (the mod's `goldstar.lowend.sprite` stays bundled but is not read).
- Residual risk: none of the 25 has been seen in the game. What the game itself does with the plugin's copy is the same
  as for Sully's icons, whose header ours copies field for field.

### Style presets (`utils/stylePresets.ts`, `components/StylePresetMenu.tsx`, `components/PresetPreview.tsx`)

`STYLE_PRESETS`: 18 ready-made styles in the spirit of Sully's PoE-like labels, each `{ id, name, label, description,
sample, style }`. A preset holds the look (a `ÿc` colour before `{name}` in `replaceName`, `labelBackground`,
`labelBorder`, a `droplight` on the two top ones) and, since 2026-11-05 (owner decision), the minimap icon drawn for it
([Generated icons](#generated-icons), the pairing the registry notes name), at a size in Sully's 27 to 50 range, the
size the example rules used. Sound and chat line stay on the rule. Low rune and Muted have no icon (judgement call:
they are the quiet looks, and low runes drop by the hundred), so `triangle_orange` and `circle_grey` stay in the Icon
select only. Where a preset has two candidates, the one its sample and its examples use won:

| Preset            | Name              | Icon (size)                                           |
| ----------------- | ----------------- | ----------------------------------------------------- |
| High rune         | `HighRune`        | `diamond_red` (50)                                    |
| Mid rune          | `MidTierRune`     | `diamond_orange` (40)                                 |
| Low rune          | `LowRune`         | none                                                  |
| Unique            | `UniqueItem`      | `star_gold` (30); `crown_gold` stays a rule's choice  |
| Set               | `SetItem`         | `star_green` (30)                                     |
| Mythical unique   | `MythicalUnique`  | `star_purple` (50)                                    |
| Runeword base     | `RunewordBase`    | `shield_white` (30)                                   |
| Good charm        | `GoodCharm`       | `square_emerald` (35)                                 |
| Good jewel        | `GoodJewel`       | `hexagon_yellow` (27), the rare jewel example's       |
| Good jewellery    | `GoodJewellery`   | `ring_blue` (35)                                      |
| Uber key or organ | `UberItem`        | `key_purple` (35), its sample; organs carry the skull |
| Perfect gem       | `PerfectGem`      | `gem_gold` (27)                                       |
| Crafting reagent  | `CraftingReagent` | `flame_orange` (27)                                   |
| Rare reagent      | `RareReagent`     | `coin_gold` (27)                                      |
| Coupon            | `CouponItem`      | `scroll_gold` (40), the elite coupons'                |
| Map               | `MapItem`         | `map_white` (30)                                      |
| Valuable          | `ValuableDrop`    | `cross_red` (40), the most common example size        |
| Muted             | `MutedJunk`       | none                                                  |

A rule's own `icon` overrides its style's, but no rule can remove it: the example picker handles a rule that wants
none with a `<Name>NoIcon` copy of the style (see _Add selected_ under the Rules tab's example rules). Names are
PascalCase without spaces like Sully's, none equal (in any case) to one of his style names: picking a preset whose name
his filter already uses would keep his style (`styleChoice.ts` never overwrites one; the pick's toast says "The filter
already has a style named X", the Styles tab's and the example rules' toasts say the same), so `stylePresets.test.ts`
checks the names and their `NoIcon` copies (`presetNameClashes`) against his v0.9.2 styles (22, the frozen fixture) and
against the bundled copy, `npm run loot-filter:template` prints any clash, and the Mid rune preset, `MidRune` until 2026-11-10, became
`MidTierRune` when his v0.9.0 added a `MidRune` of his own. Filters that already hold a `MidRune` style keep it. The Styles tab's **Add preset** menu shows
each with a `PresetPreview` and its description; the menu says the preset is copied "minimap icon included".

**Previews** (reusable, pure presentation): `StylePreview({ style, sample, icon?, maxIconSize?, className? })`
(`components/StylePreview.tsx`) draws a ground label with the style's text (`stylePreviewText`: prefix + `replaceName`
or `{name}` + suffix in enUS with the sample in place of `{name}`, the label text the actions editor shows; empty, so
"(empty label)", for a style that hides), background and border, and the minimap icon beside it on the same dark ground
at its `iconSize` as on the minimap; `icon` overrides the style's (a rule's own), `null` draws none; `maxIconSize` caps
the drawn icon in a list row. `PresetPreview({ preset, icon?,
className? })` is it for a preset and its sample. The icon is `MinimapIconPreview({ icon })`
(`components/MinimapIconPreview.tsx`): a bundled icon decoded once per name (`useBundledSprite`, cached for the page's
life), the first frame on a canvas at `iconSize` (longer side, 4 to 256; absent = the file's size) with the tint
applied (`tintSprite`); a name that is not bundled is a dashed box of about that size with the name in its tooltip.
`LabelPreview` has a `trailing` slot for it. The Add preset menu, the example rules picker, the rule editor's style
dropdown (filter styles and presets alike) and the Styles tab's style list (each style with its look under its name)
use them.

**One drawing routine**: every minimap icon preview draws through `SpriteCanvas` (`components/SpriteCanvas.tsx`: the
decoded first frame, tinted with `tintSprite`, scaled onto a canvas of the given CSS size; `density` 2 keeps a small
thumbnail sharp), with the sizes from `utils/spriteSize.ts` (`spriteDrawSize(sprite, iconSize, max?)`: the minimap size,
4 to 256, absent = the file's size, optionally capped; `spriteFitSize(sprite, side)`: fitted into a square). Its users:
`MinimapIconPreview` (minimap size), `IconThumb` (the icon picker's tiles and button: fitted into a dark tile) and the
icon field's `SpritePreview` (minimap size with the pixel sizes under it, also for a local `.sprite`).

Picking a preset copies it into `styles` under its name and selects it (toast "Added the style …");
`presetStyleStatus` compares by content (key order ignored): an identical style of that name is just selected
("already in the filter"), a different one is kept and selected ("Your style is kept as it is. Rename it first to add
the preset."), never overwritten. A filter that added a preset before the presets had icons holds it without its icon,
which now counts as different: Add preset keeps it with that toast, and the example picker reuses it, giving a rule that
wants the preset's icon that icon as its own. `stylePresets.test.ts` checks the colour codes, that no preset has a
sound, chat line or hide, the icon of each (generated, the registry note naming the preset, 27 to 50 px), and validates
all of them in one filter.

The rule editor's Style dropdown lists the presets the filter lacks too, with the same `PresetPreview`, and adds the
picked one (see [Style first, then tweak](#style-first-then-tweak)).

## JSON tab (`components/JsonTab.tsx`, `components/json-editor/`)

- **Editor**: CodeMirror 6 (`JsonCodeEditor`, a controlled component: a new `value` replaces the text without an undo
  step and without `onChange`; the ref handle has `select(from, to)` and `focus()`). `JsonTab` loads it with
  `React.lazy`, so CodeMirror is a chunk of its own (about 117 kB gzip) that only this tab fetches; a same-size
  "Loading editor…" box holds its place meanwhile. The language is a small stream tokenizer (`jsoncLanguage.ts`):
  `@codemirror/lang-json` is not used because its Lezer grammar has no comments, and the files have `//`, block comments
  and trailing commas. Line numbers, bracket folding, bracket matching, search (Ctrl/Cmd+F), undo history and soft wrap
  with a hanging indent (`hangingIndent.ts`: a wrapped line continues under its own indentation + 2 columns). The
  stream parser stops at the viewport after an edit, so folding finds the closing bracket with its own string- and
  comment-aware text scan (`findClosingBracket`), and bracket matching marks matched pairs only (no red "unmatched"
  mark for a partner beyond the parsed part; the lint reports real mismatches);
  the VS Code light or dark theme (`@uiw/codemirror-theme-vscode`) follows the app theme (`selectTheme`).
- **Syntax lint**: 500 ms after the last keystroke the text is parsed as Apply would (`findJsoncSyntaxProblem` in
  `engine/jsoncProblem.ts`, the same `parseJsonc`) and the first error is underlined with a gutter marker and the reason.
  A failed Apply still shows its message ("Not applied: … (line L, column C)") under the editor and selects the spot;
  the next keystroke clears it, the live marker takes over.
- **Label chips** (`utils/labelChips.ts`, `json-editor/labelChipGutter.ts`): a gutter between the line numbers and the
  fold markers shows a tiny "Aa" swatch on the line where each rule (`rules` and `disabledRules`) and each style starts,
  drawn like the ground label: the first `ÿc` colour of the label text, the background (with the plugin's default
  alpha, over an opaque dark chip base so translucent backgrounds look the same in both themes) and the border
  (capped at 2 px); without an `ÿc` colour the "Aa" is near-black or near-white, whichever contrasts with the
  background. A rule's chip uses its effective actions, so colours from its `useStyle` show (the hover text then names
  the style); a `hide` rule has no text colour ("hidden" in the hover text) and only
  gets a chip when it sets a background or border; a rule or style that sets no label colour gets none. Hover shows
  e.g. "Rule 12 · text ÿc1 red · background 255,255,255 · border 240,0,0 (2 px) · style Jackpot". The chips are
  recomputed from the whole text 500 ms after the last edit (at once after an outside change such as Revert or an
  edit in another tab); between recomputes and while the text does not parse, the previous chips stay, moved with the
  edits.
- **Show in JSON**: the problems list below gets a "Show in JSON" link next to "Rule N" for every problem with a path.
  `locateJsoncPath` (`engine/jsoncLocate.ts`, a forgiving scanner that walks only the containers on the path) finds the
  deepest part of the path in the current text (the draft when there is one) and the editor selects it and scrolls it,
  and the page, to the centre; a path that is not in the text any more toasts "Not found in the current text".

## Show action (plugin 1.8.2)

The 3.3 guide: "show protects: after a rule with `"show": true` matches, later rules cannot hide the item, by hide,
hideIfOtherConditionsFail or hideUnmatchedItems. Their colors, names, sounds and chat lines still apply." and "A rule
cannot both show and hide." Up to ESR 3.2.24 (plugin 1.5.3) the key did not exist.

- **Model**: `show?: boolean` is an action (`RuleActions`, after `hideIfOtherConditionsFail` in the canonical key order),
  so styles can hold it too and it counts as an effect (a rule with only `show` has actions).
- **Validator** (`checkShowAndHide`): an error when a rule's effective actions (its own over its style's) or a style both
  show and hide ("A rule cannot both show and hide an item: the game switches the rule off", at the rule's own `show`,
  else `hide`, else `useStyle`, with "(with its style)" when the style brings one of them).
- **Evaluator**: `EvaluationResult.shownBy` is the first applied rule with `show`. After it, a matching `hide` rule
  applies like a rule without `hide` (its looks, chat line and sound; the trace entry carries `hideBlockedBy`), a
  `hideIfOtherConditionsFail` rule whose gate holds is skipped (`hideBlockedBy` too) and `hideUnmatchedItems` does not
  hide. A rule that both shows and hides is `switchedOff` (`SHOW_AND_HIDE`). Where the guide is silent: whether the rules
  after a blocked `hide` still run (assumed yes) and whether its `chatMessageWhenHidden` prints (assumed no; the item is
  not hidden).
- **Show and Hide exclude each other in the editor** (`patchRule` → `patchedRule` in the slice): ticking the rule's own
  Hide drops its own Show, ticking Show drops its own Hide (a patch that sets both keys itself is left alone). Only the
  rule's own keys change: a style that shows or hides is not touched (its conflict stays a validator error), and a rule
  with neither key stays as it is.
- **Editor**: a Show checkbox next to Hide (Basic and Advanced; Basic until 2026-11-12 showed it only when set), a green "show" badge in the
  rule list, `show` in the rule summary, How rules combine and the AI format reference ("show protects").
- **Test tab**: "Shown by rule N: no later rule can hide it." under the label; trace rows "Would hide the item, but rule
  N shows it" and "switched off: error".

## Formula condition (`engine/formula.ts`, plugin 1.8.2)

Plugin 1.8.2 (ESR 3.3) has the `formula` condition; the code was first built as a preview on `feat/loot-filter-formulas`
(2026-10-31, from a guide excerpt) and ported to the 3.3 guide. The guide: "formula is a condition that holds when its
formula is not 0. It is written like a txt calc and checked when the filter loads", e.g. `{ "itemTypes": ["ring"],
"quality": "magic", "formula":
"((stat('item_fastercastrate')>=10)&&((stat('fireresist')+stat('coldresist')+stat('lightresist'))>=40))",
"hideIfOtherConditionsFail": true }`. Parts: `stat('name')` (an itemstatcost `Stat` or its row number),
`stat('name', param)` (a number or a skills.txt skill name such as `'Teleport'`), `playerStat('name')` /
`playerStat('name', param)`, `statMax('name')` / `statSum('name')` (highest value / total over every param of the item's
stat), `+ - * /` on whole numbers (division rounds toward 0, division by 0 gives 0), `== != < <= > >=` (1 or 0),
`&& || !`, `a ? b : c`. "Skill names on chance-to-cast and charges: these stats keep the skill and its level in the
param, so a skill name matches that skill at any level, e.g. `stat('item_charged_skill', 'Teleport')` gives the level of
its Teleport charges." "Mistakes: a bad name or bad syntax switches the rule off, and the log gives the rule number,
line and character." Stats read the tooltip number and an unidentified item skips a rule that reads an item stat (see
"Stat values" in the Test tab section).

- **Engine** (`engine/formula.ts`): a tokenizer and a precedence-climbing parser to a syntax tree with source offsets
  (`parseFormula` → `{ ok, ast }` or `{ ok: false, error: { message, offset } }`; messages name look-alikes: `=`, `&`,
  `|`, decimals, a function name in the wrong case), `formulaReferences` (the calls in source order, for the validator)
  and `evaluateFormula` (signed 32-bit integers). Editor limits of 512 parts and 64 nesting levels keep huge formulas
  from overflowing the stack (the plugin has its own: "the formula is too long", "the formula nests too deep").
- **Model**: `formula?: string` is a rule condition (`RuleConditions`, after the stat lists in the canonical key order);
  another shape stays in `passthrough` with an error like any other condition.
- **Validator** (`checkFormula` in `engine/validate.ts`, all at `rules/N/formula`, positions as "character N"): a
  syntax error is an **error** ("…The game switches a rule with a bad formula off when the filter loads"); warnings (as
  for the stat lists, since the game data may lag) for unknown stat names (naming a case-only match) and ids, unknown
  skill names (an in-game name such as 'Hex: Bane' names its skills.txt name 'Hex Bane'), each saying the game switches
  the rule off for a name the mod lacks; `stat('name')` without a param on a skill, tab, class, event or charged stat
  (reads param 0 only: use `statMax` / `statSum` or a param), a skill name on a stat without a skill param, a param
  above 65535, a tab param that names no tab, an event/charged number param naming skill 0 or level 0, a quoted number,
  double quotes (the plugin's log says "names go in single quotes"), and the Enhanced Damage / Defense / durability
  quirk on item stats (as the stat lists). The preview's "plugin 1.5.3 ignores formula" warning, the "any level is
  assumed" warning and the "hideIfOtherConditionsFail would hide unidentified items" warning are gone.
- **Evaluator** (`engine/evaluate.ts`): the formula is ANDed with the other conditions and is an "other condition" for
  `hideIfOtherConditionsFail` (assumed). It reads the test item's stat entries (`stat`, `statMax`, `statSum`) and the
  character's (`playerStat`, character level = stat 12) like the stat lists; skill names resolve through
  `TestContext.skillIds` (lootfilter.json `skillNames`, `buildSkillIds`). A syntax error, or a stat or skill name the
  loaded game data lacks (the validator's "switches the rule off in game" warnings; not checked before the data loads),
  makes the rule `switchedOff` ("its formula has an error"; it never runs, nor hides). Load-time switches (formula
  error, wrong shape, show + hide) come before the per-item unidentified skip. On an unidentified item a formula that
  reads an item stat other than `STATS_WHILE_UNIDENTIFIED` gives `{ status: 'unidentified' }` and the whole rule is
  skipped; those stats are known by name and by their itemstatcost row before the game data loads. Each trace
  entry carries `formula`: its value, `unidentified` or the error; the Test tab trace prints it ("formula = 1, holds").
- **Rule editor** (`components/rules/conditions/FormulaField.tsx`): "Formula" (Advanced view; Basic shows it when set)
  spans the Stats section after the stat lists. A monospace text area (an emptied one removes the key), the live syntax
  check ("Character N: message" and the text around it with the character marked, or "Syntax OK"), an insert helper
  (function select, `StatPicker`, `StatParamField` for `stat` / `playerStat`, Insert: `formulaCallText` in
  `utils/formulaText.ts` writes `stat('name')`, `stat(39)`, `stat('item_nonclassskill', 'Teleport')` (a skill stat's
  param by its skills.txt name), `stat('item_skillonhit', 30233)` (event and charged stats keep the exact skill and
  level; the hint says a quoted skill name matches any level) or `statMax('name')` at the caret), and a collapsed
  "Formula parts and assumptions" block (the guide's table and `FORMULA_ASSUMPTIONS`). The rule summary shows
  `formula: …` cut at 40 characters (`formulaSummary`); the Test tab's assumptions note lists the formula assumptions.
- **AI help**: the format reference has a `formula` condition row, a "Formulas" section (the guide's parts table, the
  example, single quotes, when to prefer a formula) and skills.csv a `formulaName` column (the skills.txt name).
- **Data**: lootfilter.json `skillNames` (the skills.txt `skill` column by row, GAME-DATA.md), because the guide names
  skills by skills.txt name; the display names of `skills` differ for 84 skills and 25 of them are shared, the
  skills.txt names are unique (1566 rows in ESR 3.2.24, 1628 in 3.3).

**Assumptions** where the guide is silent (`FORMULA_ASSUMPTIONS` and the constants beside it in `engine/formula.ts` are
the one source: the field's help and the Test tab show that list):

- Operators bind like C (`BINARY_PRECEDENCE`): unary `!` and `-`, then `* /`, then `+ -`, then `< <= > >=`, then
  `== !=`, then `&&`, then `||`, then `a ? b : c` (right-associative); the binary operators are left-associative.
- Numbers are whole, non-negative literals; a `-` in front negates. Values are signed 32-bit integers (`| 0`,
  `Math.imul`); a literal above 2147483647 is a syntax error; `-2147483648 / -1` wraps.
- Names in single quotes (`FORMULA_QUOTE`); double quotes are read with a warning. Quotes have no escapes.
- Function names are case-sensitive (`FORMULA_FUNCTIONS`; the DLL has lowercase copies of the names, so the plugin may
  accept other cases); stat names must match exactly; skill names ignore case (`SKILL_NAMES_IGNORE_CASE`).
- `stat('name')` without a param reads the entry with param 0, as the stat lists do; `statMax` and `statSum` read every
  param. A stat the item or character lacks is 0.
- A skill name on an event or charged stat reads the highest of the entries for that skill; on any other stat that is not
  a skill stat it is read as the skill id.
- Enhanced Damage, Enhanced Defense and Increased Maximum Durability are taken to read 0 where the stat lists do.

## Test tab (`components/TestTab.tsx`, `components/test/`, `utils/testItemForm.ts`)

Runs the engine's `evaluateFilter` against an item the user describes. Two columns from `lg` up (form left, result
right, sticky), stacked below; three (Item, Context, Result) on pages of 1920 px and up. The form is local state (`TestItemForm`, start value `defaultTestItem()`: no item, Rogue
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
  rows (stat, param, value; incomplete rows are ignored; the param is the rule rows' `StatParamField` without "Any
  known level", and charged rows show the same value hint; a layered row without param says the test takes the entry
  as param 0, as the evaluator does). A hint above the rows asks for the tooltip numbers and says what an unidentified
  item skips.
- **Stat values** (plugin 1.8.2, the guide): every stat reads the number the tooltip prints (+40 Life = 40, per-level
  stats at the character's level, `item_howl` / `item_fear` the percent, charges the skill level). The test compares
  the values as entered, so they are the tooltip numbers. **Unidentified items**: a rule whose item stat lists or
  formula check a stat other than gold, armorclass, quantity, durability, maxdurability or item_numsockets
  (`STATS_WHILE_UNIDENTIFIED`) skips an unidentified item entirely (no actions, cannot hide it); the trace row says so
  ("Skipped: the item is unidentified and the rule checks an item stat…") and is shown without "Show skipped rules".
  A hide or `hideIfOtherConditionsFail` rule of this kind gets a validator warning (`checkHideOfUnidentified`), unless it
  sets `isIdentified` or only matches inferior, normal or superior items (a name or number, a list of them, or a range
  whose `max` is at most superior, like `{ "max": "superior" }`): none of Sully's 689 (up to v0.7.0 the validator missed
  the range form and flagged his `{ "max": "superior" }` hide, rule 73, now rule 99). An identified test item of
  magic quality or above is also evaluated unidentified, and a note above the result says when the filter would then
  hide or show it the other way.
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
  conditions" red, skipped muted, disabled muted with a dashed border and the row dimmed), style, `ruleSummary`, the
  formula's value or why it was not evaluated ("Formula condition" above), the unidentified skip, a hide blocked by a
  Show rule ("Would hide the item, but rule N shows it"), a switched-off rule (a formula error or show + hide: "switched
  off: error" badge), and the failed condition keys as chips. Skipped and disabled rules are hidden unless "Show skipped rules (N skipped, M
  disabled)" is ticked. A row opens the rule in the Rules tab (`selectRule` + `?tab=rules`).
  After a hiding rule the note says how many rules did not run.
- **Wrong-shaped rules**: a rule with a known key (condition or action) whose file value had the wrong shape (kept in
  `passthrough` with a parse error, `wrongShapedKeys` in `engine/evaluate.ts`; e.g. `"sockets": "2"`) is skipped
  with the outcome `wrongShape`: it never applies or hides, not even with `hideIfOtherConditionsFail`. The guide says
  "a rule with an error is switched off and logged", and the plugin's message for such a value is an error; not
  verified in game. Unknown keys sit in `passthrough` too but do not switch a rule off (the plugin logs "unknown
  setting, ignored"), and neither does a wrong-shaped `comment` (the
  guide: "Ignored; notes for the author"). The trace badge reads "skipped: wrong shape"
  (amber) with the line "activeInLevels has the wrong shape; the plugin most likely ignores this rule (not
  verified)." and the failed conditions of the rest of the rule; the row is shown without "Show skipped rules" when
  the rest of the rule holds (it would have applied or hidden), and counted as "N wrong shape" in that checkbox's
  label. The validator's semantic errors (an `activeInLevels` id with no level, an unknown quality number) do not skip
  a rule: whether the plugin treats them as errors is not known. A single-number `"activeInLevels": 4` is not
  wrong-shaped (it reads as `[4]`, see "A single-number level"), so Sully's Ancient Scroll hide rule applies at level 4.
- **Assumptions (verify in game)**: a collapsed, shortened list of the evaluator's assumptions that points here for the
  full list ("Verify in game" below); a "Verified in game" part (a missing stat counts as 0; `OMITTED_PARAM_RULE`: a
  check or `{stat:ID}` without param reads only the param-0 entry; skill tabs are numbered class × 8 + tab; Enhanced
  Damage reads 0 on weapons and Enhanced Defense on armour, Enhanced Damage on a jewel correctly; all with plugin
  1.5.3); a "Not yet verified" part (the 1.8.2 tooltip-number stat values; the unidentified skip; wrong-shaped rules
  skipped; the single-number level); the formula assumptions; how to use Check in game
  ("If a number differs from the tooltip, the plugin reads that stat differently; tell us"); and the note that
  `{string:KEY}` is shown as written.
- While the bundles load (or when they fail) a hint says that typed codes work but item-type conditions only see the
  typed type.

## AI help (`screens/LootFilterAiScreen.tsx`, `components/ai/`, `utils/aiPrompt/`, `utils/aiAnswer.ts`, `utils/aiFollowUp.ts`, `utils/aiStarter.ts`)

New players describe the filter they want; the app builds a prompt package for any LLM; the user talks it through with
the LLM, pastes each JSON answer back, sees the validator's problems and sends them back until the filter is clean.
Nothing is sent anywhere: the page only builds files (the page says so). Owner decisions (2026-11) are the list below.

- **Entry points**: **Create a filter with AI help** next to the library's start buttons (a link to `/loot-filters/ai`,
  `AI_PAGE_PATH`), and **Improve with AI** in the editor header, which opens the same page with the open filter as the
  starter: the router state `{ aiStarter: { name, text } }` (`aiStarterState` / `readAiOpenFilter`) carries the text
  Download would save, so drafts, saved filters and sandboxes all work. Leaving the editor flushes as usual.
- **The page** (a 1-2-3 explanation on top): (1) the request textarea (placeholder example; kept in `sessionStorage`
  `loot-filters/ai-request` so it survives a trip to the editor; storage errors are ignored) and **Start from**
  (`AiStarterPicker`): nothing, the filter from the editor, a bundled template (`BUNDLED_TEMPLATE_LIST`, listed by
  name; the pick loads it with `useTemplateSource`, live or bundled, and the starter is labelled "<name> v<version>"),
  a draft of this browser (`selectVisibleDrafts`, newest first), **My saved filters** when signed in
  (the sharing slice's My filters list, `fetchMyFiltersRequested` on mount and on an account switch; loading, failed and
  empty rows are disabled items; a filter with a local draft says "saved version; a draft has changes"; the list has no
  files, so a pick dispatches the sharing saga's detail fetch `fetchSharedFilterRequested` unless that filter's detail is
  already loaded (`needsSavedFilterFetch`) and `savedFilterStarter` reads the starter from `selectSharedFilterDetail`:
  a spinner while it loads, the reason when it failed (with **Try again**) or is gone; no new query), an uploaded
  `.json` or **Pick example rules**: the button opens the Rules tab's `ExampleRulesDialog` ("Pick example rules for the starter", confirm
  "Use as starter (N)", and its own intro, `AI_STARTER_EXAMPLES_INTRO`: "Tick the rules your filter should start
  from; the AI keeps them and extends them into a full filter. … Sounds and icons come with the app's .zip
  download."); confirm sets `rulesStarter` (`starterFromRules`: the rules plus every style they use, one
  "Default" level, title "AI filter") and the `rules` choice. Like the upload, the picked set stays in the list ("N
  example rules") when another starter is chosen, and the button turns into **Change example rules**, which reopens the
  picker on the previous selection (the picker's `initialState`, from the `selection` its `onConfirm` hands back);
  Cancel changes nothing. The line under the picker gives the rule count and size (a starter over 100 rules adds a note that long answers may be cut off), or why
  the text cannot be used (not valid JSON). Signed out, the hint says saved filters are listed after sign-in or start
  through Improve with AI; signed in, that a saved filter starts from its last saved version. (2) **Game
  data** Compact (default) or Full with the measured size of each (characters and ~tokens = characters / 4, plus the
  total with the request and starter), **Download .md (one file)**, **Download .zip (prompt + files)** and **Copy
  prompt** (the instructions and request only; the toast says to attach the files too), with notes on what each holds
  and that LLMs with file upload or a large context handle Full best. (3) **Import AI answer** (the first import creates
  a new draft, see below).
- **The package** (`utils/aiPrompt/promptPackage.ts`, its own lazy chunk of about 33 KB / 13 KB gzip, imported by the
  page; the reference files are cached per bundle identity and size, about 20 ms to build both): `PROMPT.md`
  (`instructions.ts`: role and goal; reply in the user's language with JSON keys and texts as the format needs; the
  workflow: ask every clarifying question first (class/build, difficulty/progress, item groups, strictness levels,
  sounds/icons, languages), propose a plan, the complete filter as one json block every time (never a diff unless
  asked), a short `title` (it names the draft) and meaningful rule comments (they become the rule titles), after every JSON answer remind the user (in their
  language, button names as written) to Import AI answer (the first time on the AI page, later in the editor) and paste
  the problems from Copy problems for the AI back, fix exactly the pasted problems and keep everything else; the rules for codes
  (only from the reference, ask the user otherwise, the validator flags unknown codes), bundled assets (a sounds.txt
  sound only when asked, by the exact name the user gives: the reference does not list them), styles (every `useStyle` defined under `styles`; copy a preset from examples.md) and the
  plugin limits; the file list with summaries; the request verbatim between `<user_request>` tags (it cannot close them); the
  starter: a filter is kept as it is apart from what the request changes; picked example rules are a skeleton to keep
  and extend, with a fitting title and the agreed levels), then the files: `FORMAT.md`, `examples.md`, `assets.md`, the
  CSV tables and `starter.json`. The single `.md`
  is the prompt for one document ("each reference file follows under a heading File: <name>"), then every file under
  `# File: <name>` (markdown files one heading level down, CSV and JSON in four-backtick fences); the zip
  (`buildPromptZip`, `utils/zip.ts`) holds `PROMPT.md` and the files. Names: `<slug of the starter label (picked
example rules: of the request), else of the request's first line, else "ai-filter">-ai-prompt-<yyyy-mm-dd>.md|.zip`.
- **Generated from the code** (`formatReference.ts`), so it follows the editor: the key tables from `TOP_LEVEL_KEYS`,
  `CONDITION_KEYS` and `ACTION_KEYS` (their descriptions are `Record`s over the model's key types, so a new key does not
  compile without one), the enumerations, `STAT_OPS`, `PLACEHOLDERS`, `COLOR_CODES`, `STAT_QUIRKS` (headline and
  message), `STAT_SCALES`, `STAT_LAYER_KINDS` (what each layered stat's param holds), `OMITTED_PARAM_RULE`,
  `FILTER_CONTENT_MAX_BYTES`, `LOOT_FILTER_PLUGIN_VERSION`, a complete example file (`SKELETON_FILTER`, validated clean
  by a test) and "Common mistakes and what the app reports":
  `MISTAKE_SAMPLES` (unknown code, a type name for a code, a stat label for a name, an unknown quality, Enhanced Damage
  on weapons, a skill tab without param or with a properties.txt number, a Life value, a missing level or style,
  `between` with one number, an empty list, unique ids with a non-unique quality, codes of other types,
  `hideIfOtherConditionsFail` with quality, a hide rule without conditions, a colour out of range, an unknown key) run
  through `readLootFilter` + `validateLootFilter` against the game data, so the LLM sees the app's own messages. Prose
  covers only semantics (how rules combine, hide rules and exceptions, ids, writing the file for the app).
  `examples.md` (`buildExamples`): first the style presets (`DEFAULT_PROMPT_STYLE_PRESETS` from `STYLE_PRESETS`, each
  its name, description and `{ "Name": { … } }` block one key per line, icon included, with the note that a filter must
  copy every preset it uses into `styles` and that a rule's own icon replaces its style's but cannot remove it; a style
  an example uses but the given presets lack is added: with the editor's presets that is `MidTierRuneNoIcon`), then the
  example rules under their group headings and intros, each its title, description and the complete rule the picker
  adds with its default presentation (`examplesWithPresentation`: the examples built as one set with `buildExampleSet`
  against the shown presets, so a rule that wants no icon uses the NoIcon copy and no preset block is ever changed:
  comment, conditions, `useStyle`, sound, an icon only where it differs from the style's, chat line; one key per line).
  `assets.md` lists every registry entry with its "when to use" line (`DEFAULT_PROMPT_ASSETS` from
  `BUNDLED_SOUND_ASSETS` / `BUNDLED_ICON_ASSETS`).
- **Game data sizes** (`gameDataTables.ts`, measured on ESR 3.3 with `referenceSizes`, the single .md without request or
  starter): **Compact** about 227k characters (~57k tokens; it grows with the example rules): every item type (`item-types.csv`), the misc items that drop
  (`items.csv`: runes, gems, charms, jewels, potions, keys, organs, essences, coupons, maps, scrolls; stacks of five or
  more identically named containers (the Rune, Decal and Multi Stockers, Gem and Crystal Cans, Rerolling Orbs)
  collapse to one row "match them by item type"), the weapon and armour bases that drop by item type and tier
  (`bases.csv`, one row per type and tier with `code name` pairs: 15k instead of 19k as one row per code, and the LLM
  can use `itemTypes` + `baseTier`), every stat with label, param kind and the quirk or scale note (`stats.csv`),
  uniques merged by name with the dropped and Ancient Coupon ids, then the set items (`uniques-sets.csv`, disabled rows
  left out), every area (`areas.csv`, 5k), the class skills, the skill tabs (param = class × 8 + tab) and the classes.
  **Full** about 362k characters (~90k tokens): one row per item code with kind, types, tier and drop flag, one row
  per unique and set row with base, level and coupon/disabled notes, and every skill. Neither size lists the sounds.txt
  names (they were 263k, about half of Full, until 2026-11): the prompt and assets.md say game sounds exist and that the
  LLM asks the user for the exact name (the editor's Sound picker lists them; the validator warns on an unknown one), and
  the page says so under the downloads. Sully's template (472k
  characters at v0.9.2; 184k up to v0.7.0) as the starter adds about 473k characters (Full with Sully's: about 835k).
- **Import AI answer** (`ImportAiAnswerDialog`, `extractFilterFromAnswer`): paste the whole reply; the fenced code
  blocks (backticks or tildes, any length, an unclosed last block included) that look like JSON (info `json`, `jsonc`,
  `json5`, `js`, none, or content starting with `{` or `//`) are tried last first and the first complete filter wins (a
  whole filter has `rules` or `formatVersion` at the top); then all blocks joined (an answer continued in a second
  block); without fences, from the first line opening an object (with the `//` lines above it) to the last line that is
  only `}`, then to the last `}`. Parsing is the upload's (`parseLootFilter`, lenient JSONC). The dialog shows what it
  found (title, rules, styles, levels, the problem count with the game data) and the confirm text: in the editor
  "Importing replaces the whole content of the open filter" (**Replace the filter** dispatches `replaceFilter` exactly
  like the JSON tab's Apply, drops unapplied JSON-tab text, toasts the counts and opens the problems list); on the AI
  page "Importing creates the draft <name>" (`importText` with source `upload`, named by `aiFilterName(request, title)`:
  the filter's `title` (colour codes dropped, whitespace collapsed, up to 60 characters cut at a word), else the
  request's first line up to 40 characters, else "AI filter"; the dialog's `create` mode takes `nameOf(filter)`, so it
  shows the name of the filter it read; it opens on `?tab=json` when there are problems). Without a
  readable filter it says why (no JSON: maybe the AI is still asking questions; a syntax error with its position: maybe
  cut off; JSON that is a list or a single rule) and offers **Copy a message asking the AI to resend the filter**
  (`resendMessage`).
- **Copy problems for the AI** (`CopyProblemsButton`, in the Problems heading of the JSON tab's list, so it works on any
  filter; hidden without problems): `problemsMessage` writes the counts, how to read rule numbers (1-based in the file's
  `rules` list; "Disabled rule N" for `disabledRules`) and paths, the errors then the warnings as
  `- Rule 12 "High runes" (rules/11/itemCodes/3): Unknown item code "r99"` (style problems name the style), at most 80
  lines with the rest counted, and ends with "Fix these and keep everything else; reply with the complete filter as one
  json block."
- **Section comments in the prompt**: FORMAT.md "Writing the file for the app" teaches the short form of the ruleset
  (see "Section comments": whole-line `//` comments above a top-level key, rule, disabled rule or style and after the
  last rule are kept; same-line, inside-object and `/* */` comments are dropped on the first edit; `// ====` parts and
  `// ----` sections; every rule still gets its `"comment"`; switch a rule off with `disabledRules`, not by commenting
  it out), PROMPT.md's "Rules for the filter" points there, and `SKELETON_FILTER` shows two parts and a section.
- **Agent pack** (`utils/aiPrompt/agentPack.ts`, `scripts/generate-loot-filter-agent-pack.ts`,
  `scripts/lib/lootFilterAgentPack.ts`): static files for AI agents (e.g. a filter author working with Claude agents)
  in `public/loot-filters/agent/`, served at `https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/<file>`.
  `README.md` is the entry point to hand an agent: what ESR loot filters are, how to work (write or edit the `.json`,
  keep it JSONC the plugin reads, check it by uploading it at `/loot-filters` and reading the JSON tab's problems list,
  or have the person paste Copy problems for the AI back), the PROMPT.md rules for writing filters without the chat
  parts (request, starter, language, attached files, import reminder), the Section comments ruleset in full with an
  example (the test parses and validates it), every file with a one-line summary and its URL, the ESR version, the
  plugin version and the templates' URLs (for Sully's the live raw URL as the latest and the site copy as the
  fallback; no template version, so his bumps do not change the pack). Then `referenceFiles` at the **full** size under the AI page's
  names: `FORMAT.md`, `examples.md`, `assets.md`, `item-types.csv`, `items.csv`, `stats.csv`, `uniques-sets.csv`,
  `areas.csv`, `skills.csv`, `skill-tabs.csv`, `classes.csv` (about 360 KB in all on ESR 3.3.03). The generator loads
  `lootfilter.json`, `types.json` and the manifest's `esrVersion` from `public/game-data/` as the page does (through
  `importSrc`), with `SITE_URL` from `scripts/lib/sitemap.ts`; no dates, so the output is deterministic.
  `npm run loot-filter:agent-pack` writes it (and removes files it no longer makes); `game-data:generate` writes it after the
  bundles, `game-data:generate --check` (so `game-data:check` and `game-data:update`) checks it when the bundles are
  fresh, `node scripts/generate-loot-filter-agent-pack.ts --check` checks it alone (no ESR clone needed), and
  `scripts/lib/lootFilterAgentPack.test.ts` fails when the committed pack differs from a fresh build. Prettier skips
  the folder. A change to the prompt text, the example rules, the presets, the bundled assets or the templates makes
  the pack stale: regenerate and commit it.
- **Inputs with defaults**: `PromptReferenceInput.examples` (default `EXAMPLE_RULES`), `.stylePresets` (default
  `DEFAULT_PROMPT_STYLE_PRESETS`) and `.assets` (default `DEFAULT_PROMPT_ASSETS`); the page passes none of them, so
  the reference cache keys stay stable.
- Tests (logic only): `gameDataTables.test.ts`, `formatReference.test.ts` (every key has a row, the skeleton reads back
  cleanly, every mistake sample yields the validator's messages against the real bundles; examples.md has every preset
  and group, each example reads back as the picker's rule with its default presentation, and the presets plus all the
  rules validate as one clean filter; assets.md has every registry note), `promptPackage.test.ts` (files, layout,
  delimiters, names, zip entries, sizes, the picked example rules starter), `aiAnswer.test.ts`,
  `aiFollowUp.test.ts` (the draft name from the title, the request fallback), `aiStarter.test.ts` (choice values, the
  saved filter starter states and when a pick fetches).

## Phase status

| Phase | Content                                                                                       | Status                                                    |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1     | Engine: model, JSONC parse with passthrough, serializer, validator, evaluator, sprite decoder | done                                                      |
| 2     | `lootfilter.json` reference bundle (items, stats, areas, sounds, uniques, sets)               | done                                                      |
| 3     | Library, routes, editor shell and state, Settings tab, JSON tab                               | done                                                      |
| 4     | Rule builder with pickers, style editor, label preview                                        | done (rule builder, actions editor, Styles tab, previews) |
| 5     | Test-item tab with a rule trace                                                               | done                                                      |
| 6     | Sharing: saved filters in Supabase, library tabs, profile and home blocks                     | built (FEATURE-LOOT-FILTER-SHARING.md)                    |
| 7     | AI help: LLM prompt package, Import AI answer, Copy problems for the AI                       | built (see "AI help")                                     |

## The 3.3 guide against the editor (checklist)

The source of truth for the 3.3 format is `LootFilters/ESR Loot Filter Guide.pdf` in the ESR repository (tag 3.3,
plugin 1.8.2). ESR ships no separate JSON schema: the clone at 3.3 has only the PDF, `LootFilters/sources.json`, the
DLL and `d2rloader/config/celestialrayone.loot-filter.toml`. The PDF text was extracted twice (a zlib + ToUnicode
extractor and macOS PDFKit) and the two agree word for word, tables included (colour RGBs checked line by line).
Transcription: `builds-feature-docs/loot-filter/ESR-LOOT-FILTER-GUIDE.md`. Commits are on `chore/esr-3.3`.

| Guide item                                                                                                                                                                                                              | Support                                                                                                                                       | Where / commit                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Top-level keys: formatVersion, title, author, version, description, updateUrl, filterLevels, defaultLevel, hideUnmatchedItems, soundVolume, notifications, qualityColors, styles, rules                                 | yes                                                                                                                                           | `HEADER_READERS`                              |
| filterLevels `{ id, name }`, name a string or per language                                                                                                                                                              | yes                                                                                                                                           | 6589dad (localised level names)               |
| title, author, version, description as per-language objects ("any text")                                                                                                                                                | partial: read as strings only; an object is a wrong-shaped key (error). No known filter does it, and the launcher, not the plugin, shows them | follow-up (owner question)                    |
| Conditions table (codes, types, quality 1–9, baseTier 0–2, itemLevel 0–999, sockets / maxSockets 0–99, the four flags, unique/set ids, the four stat lists, location, difficulty 0–2, areas, activeInLevels)            | yes                                                                                                                                           | `CONDITION_READERS`, validator ranges         |
| Number shapes: one value, a list, `{ min, max }`; named values by name or number                                                                                                                                        | yes                                                                                                                                           | `readNumberMatch`, `namedMatch`               |
| Stat check `{ stat, param, op, value }`, ops `== != > >= < <= between`                                                                                                                                                  | yes                                                                                                                                           | `readStatCheck`                               |
| `formula` condition, every part of the grammar, skill names, any level on chance-to-cast and charges, bad name or syntax switches the rule off                                                                          | yes (precedence, 32-bit wrap, case rules are assumptions)                                                                                     | 004efc3, 0085482 (skillNames)                 |
| Stat values: tooltip numbers, per-level at the character level, howl/fear percent, charges = skill level                                                                                                                | yes (warnings, hints, AI text; the Test tab takes tooltip numbers as entered)                                                                 | fcd106d, c14d2d3 (16 new 3.3 per-level stats) |
| Unidentified items skip rules that check an item stat (gold, armorclass, quantity, durability, maxdurability, item_numsockets exempt)                                                                                   | yes (evaluator, Test tab)                                                                                                                     | fcd106d                                       |
| Actions table: hide, hideIfOtherConditionsFail, replaceName / namePrefix / nameSuffix, labelBackground, labelBorder, chatMessage, chatMessageWhenHidden, notify, sound, soundVolume, icon, droplight, useStyle, comment | yes                                                                                                                                           | `ACTION_READERS`                              |
| `show` (protects from later hides; not with hide)                                                                                                                                                                       | yes                                                                                                                                           | f52a116                                       |
| hide makes the item unpickable (gold excepted)                                                                                                                                                                          | doc only (nothing to model)                                                                                                                   | e6197ff                                       |
| Texts: one string or per language (13 languages), `{string:KEY}`, `ÿc` codes, `\u00ffc`                                                                                                                                 | yes; per-language texts are editable per language                                                                                             | 313aa57                                       |
| `comment` as a per-language text ("text" in the actions table)                                                                                                                                                          | partial: read as a string only; the plugin ignores comments, so the rule still runs (our Test tab too)                                        | follow-up                                     |
| Placeholders `{name} {code} {quality} {baseTier} {itemLevel} {sockets} {maxSockets} {ethereal} {uniqueOrSetId} {qualityColor} {stat:} {playerStat:} {string:} {link} {level} {filter}`                                  | yes                                                                                                                                           | `PLACEHOLDERS` (`engine/text.ts`)             |
| notifications dropFormat / levelChangeFormat with defaults                                                                                                                                                              | yes                                                                                                                                           | `readNotifications`                           |
| Chat off switch (`chatNotifications` in selection.json), once per item                                                                                                                                                  | doc and help text (the editor writes no selection.json)                                                                                       | 7aa6c64                                       |
| Sounds: sounds.txt name or row, `.wav` `.mp3` `.flac`, volume chain                                                                                                                                                     | yes                                                                                                                                           | validator, Test tab                           |
| Minimap icons: iconName (`.sprite`, first frame), iconSize 4–256, color with fade                                                                                                                                       | yes                                                                                                                                           | `readIcon`, validator                         |
| Droplight `{ color }` or `{}`                                                                                                                                                                                           | yes                                                                                                                                           | `readDroplight`                               |
| qualityColors: the nine qualities, one code each                                                                                                                                                                        | yes                                                                                                                                           | `readQualityColors`                           |
| Colour codes ÿc0 to ÿcV with RGB (ÿc3 110,110,255; ÿcM light purple 192,128,242; N–V exact)                                                                                                                             | yes                                                                                                                                           | 285e6f1                                       |
| JSON with `//` comments                                                                                                                                                                                                 | yes (also block comments and trailing commas, as the 1.5.3 reader did)                                                                        | `engine/jsonc.ts`                             |
| selection.json, TOML settings, other-mod setup                                                                                                                                                                          | doc only (outside the filter file)                                                                                                            | transcription                                 |

## Verify in game

Assumptions the engine makes where the guide is silent (from the engine file headers). This is the one full list; the
research doc and the Test tab's note link here.
The `formula` condition has its own list under "Formula condition" above (`FORMULA_ASSUMPTIONS`).

**Plugin 1.8.2 (ESR 3.3) checks.** `LOOT_FILTER_PLUGIN_VERSION` is 1.8.2 since ESR 3.3.02 and the editor follows the
1.8.2 guide, but these are still open. To verify in game with 1.8.2:

1. Localised level names: Sully's v0.7.0 shows its level names in the game language (level key, launcher).
2. `show`: a show rule above a broad hide keeps the item (also against `hideIfOtherConditionsFail` and
   `hideUnmatchedItems`); the later hide rule's colours, chat line and sound still apply; the rules after it still run
   (assumed); its `chatMessageWhenHidden` does not print (assumed); show + hide in one rule (or through its style) is
   logged as an error and the rule is off.
3. `formula`: the guide example on magic rings; operator precedence (`1+2*3==7`, `!0+1`); skill names (`'Teleport'`,
   case `'teleport'`), any level on `item_charged_skill` / `item_skillonhit`; `statMax` / `statSum` on
   `item_addskill_tab`; double quotes (assumed rejected); `StatMax` in another case (assumed rejected); a bad stat name
   switches the rule off; `hideIfOtherConditionsFail` with a formula giving 0 hides.
4. Stat values: `{stat:7}` on a +40 Life item reads 40; a per-level stat at two character levels; `{stat:112}`
   (howl) the percent; `{stat:204,<layer>}` on charges reads the skill level; `item_replenish_durability` as stored.
5. Whether Enhanced Damage still reads 0 on weapons and Enhanced Defense on armour now that stats read tooltip
   numbers (`STAT_QUIRKS`, verified with 1.5.3 only).
6. A stat check without `param` still reads param 0 (`OMITTED_PARAM`).
7. Unidentified items: a hide rule with stat exceptions does not hide unidentified magic items; a rule on
   `item_numsockets` or `quantity` still works on them; `playerStats` rules still run.
8. Chat lines and sounds once per item (also when the item leaves and re-enters view); the launcher's Enable chat
   notifications off silences item lines but not the level change line.
9. `"activeInLevels": 4` as a bare number; JSONC comments and trailing commas still accepted.
10. The `ÿcM` colour (light purple 192, 128, 242) and N to V as listed.

- `activeInLevels` is a precondition: a rule inactive at the current level is skipped and never hides, not even with
  `hideIfOtherConditionsFail`.
- The `hideIfOtherConditionsFail` gate is `itemCodes`, `excludeItemCodes`, `itemTypes`, `excludeItemTypes` and
  `location`; every other condition is an "other condition".
- A hidden item keeps no label colours, border, icon, droplight, chat lines or sounds from earlier rules; its only chat
  line is the hiding rule's `chatMessageWhenHidden`. The hiding rule's other actions do not apply.
- `replaceName`, `namePrefix` and `nameSuffix` are each "later wins" on their own.
- `notify: true` prints the drop line unless the rule's effective actions (style included) have a `chatMessage`.
- `{name}` in every text, the drop line included, is the game's name, not the filter's changed name.
- The event and charged params are assumed to be the engine's layers too (`skill << 6 | level`,
  `game-data/engine/statLayers.ts`), as for the skill tabs (verified, below).
- **Verified in game (2026-10):** a missing stat compares as 0. A hide rule on magic items with
  `item_demondamage_percent < 1` hid every magic item without demon damage and kept those with it, so "Except items
  with…" (a `< 1` check) works.
- **Verified in game (2026-11-01, plugin 1.5.3)**, with a rule on magic and rare items whose `namePrefix` was
  `[ED {stat:17} | Def {stat:16} | Leech {stat:60} | Tab {stat:188} / {stat:188,8}] `:
  - An Elder Cane of Teleportation with +4 to Fire Skills (Sorceress Only) showed `Tab 0 / 4`. So the plugin numbers
    skill tabs as the game stores them, `class × 8 + tab` (Sorceress = class 1, Fire = tab 0 → 8; the properties.txt
    number would be 3), and a stat check or `{stat:ID}` without `param` reads only the param-0 entry, not any entry.
    The evaluator's `OMITTED_PARAM` is `'layerZero'` (`checkedLayer`; the `'anyLayer'` reading is kept as a mode for
    the unit tests only), for checks and placeholders; the validator warns about every layered check without param,
    and the Test tab lists both under "Verified in game".
  - A Godly Body Shield (+201–300% Enhanced Defense) showed `Def 0`: `item_armor_percent` reads 0 on armour. A rare
    jewel with Enhanced Damage showed `ED 58`, its value: Enhanced Damage on jewels reads correctly (see "Known plugin
    limits").
- In `{stat:ID}`, ID may also be an itemstatcost name.
- `{ethereal}` expands to `Ethereal` for ethereal items and to nothing otherwise.
- `hideUnmatchedItems` hides an on-ground item no rule applied to.
- Colour codes: the RGB values are the 3.3 guide's (`ÿc3` 110, 110, 255; `ÿcM` light purple 192, 128, 242; N to V
  exact); the label preview draws them flat, the game in HD shades.
- `.sprite` icons: header layout and RGBA pixel order as observed in `goldstar.sprite` (Sully's other eleven icons decode
  the same way); only the first frame is drawn. The plugin's reader (v1.5.3 disassembly) confirms the fields it uses
  and takes the first frame of a strip; see [Generated icons](#generated-icons).
- The serializer keeps only whole-line `//` comments (see "Section comments") and writes no trailing
  commas or block comments; the reader accepts both, as the plugin does (v1.5.3, from its disassembly). A warning says
  so when a file has them.
- `disabledRules` is ignored by the plugin with one "unknown setting, ignored" log line (from the plugin's strings,
  not yet seen in a game log); the rules in it never run.
- An empty condition list (`activeInLevels: []`, …) logs "the list is empty"; whether the plugin then drops the key or
  switches the rule off is not known (our evaluator: an empty `activeInLevels` is never active).
- A rule with a wrong-shaped condition or action (`"sockets": "2"`) is switched off (the guide: "a rule with an
  error is switched off and logged"); unknown keys are ignored and the rule runs. The Test tab models both.
- `"activeInLevels": 4` (one number instead of a list) works in game (verified with the template's Ancient Scroll
  hide rule, which hides them at level 4). We read it as `[4]`; still to check: are the scrolls shown at levels 1 to 3, i.e. the plugin
  reads `[4]` rather than ignoring the key (backlog)?
- Stat values (`engine/statScale.ts`): plugin 1.8.2 reads the tooltip number (the 3.3 guide); not yet checked in
  game (item 4 above). Sully's older `{stat:218}/8` labels were written for plugin 1.5.3.
- `uniqueOrSetIds` are 0-based row numbers of uniqueitems.txt / setitems.txt (equal to `*ID` in ESR 3.2.12).
- A numeric `sound` is a 0-based data row of sounds.txt (`*Index` is unreliable: it repeats for the Leoric taunt rows).
- An item with a `type2` counts as both types for item-type conditions (the Test tab and the never-matches warnings use
  the union of both types' ancestors).
- An item without a normal/exceptional/elite family (rings, amulets, charms, jewels, arrows/bolts, ESR mythical bases;
  its `normcode`, `ubercode` and `ultracode` are its own code) matches no `baseTier` condition, and `{baseTier}` is
  empty for it. A reported in-game test only shows that a ring is neither normal nor exceptional for the plugin. Verify
  with `debug_log = true`: the plugin's log line prints `tier %d` for each item.

### Known plugin limits

- **Percent stats of a base stat read 0 on items with that base stat.** The game never writes an op-13 stat (a
  percentage of a base stat) into an item's full stat list when the item has the matching base stat (D2MOO
  `D2StatList`; ESR's own enhanced-damage-fix plugin describes the same rule), and the plugin reads the full list.
  Verified in game: a magic Cruel weapon with +214% Enhanced Damage fails `item_maxdamage_percent >= 1` and matches
  `< 1`. So `item_maxdamage_percent` (17) and `item_mindamage_percent` (18) read 0 on weapons; `item_armor_percent`
  (16) reads 0 on armour with defense (verified in game on 2026-11-01: a Godly Body Shield with +201–300% showed 0);
  `item_maxdurability_percent` (75) likely reads 0 on items with durability (the same mechanism, not tested). On
  jewels (no base damage or defense) Enhanced Damage reads correctly (verified: a rare jewel showed 58), and charms
  should behave the same. The validator warns about
  such checks, the rule editor shows the red headline under the row and the affix browser notes them; the Test tab's evaluator does not model it (a test weapon with stat 17
  still matches). Listed for the mod author in the backlog.

### Troubleshooting in game

- **Chat lines do not print:** first check the launcher's "Enable chat notifications" (selection.json
  `"chatNotifications": false` turns off every chat line about an item; the filter announce, level changes and Show
  Hidden Items still print; with `debug_log = true` the log says "chat line not printed (chat notifications are off in
  the launcher)"). Then run `lootfilter` in the console; its output lists the hooks, "drop alerts" among them.
  Then read `d2rloader\logs\celestialrayone.loot-filter.log`: a feature the plugin switched off after its D2RLoader
  version check is named there. `debug_log = true` in `celestialrayone.loot-filter.toml` logs every chat line printed
  (and every item decision).
- A `notify` / `chatMessage` line prints once per item, when it drops or first comes into view; plugin 1.8.2 does not
  repeat it (or the sound) when the item comes back into view (the 3.3 patch notes and the plugin's TOML; the guide's
  chat paragraph still says "every time").
- A sound or icon the filter names but its folder lacks is logged; the rule keeps working without it.

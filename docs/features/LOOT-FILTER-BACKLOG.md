# Loot Filter: backlog of deferred items

Requests and findings from loot filter users (October 2026) that are **not built yet**, with the reason
each one waits. The rule for this list: a feature goes in only when it depends on plugin behaviour the guide does not
state and no one has verified in game, or when it needs a change outside this app (the plugin, the mod, another tool).
Feature doc: [LOOT-FILTER.md](./LOOT-FILTER.md). Format reference:
[ESR-LOOT-FILTER-GUIDE.md](../../builds-feature-docs/loot-filter/ESR-LOOT-FILTER-GUIDE.md). Plugin version these notes
refer to: 1.5.3 (ESR 3.2.24, `d2rloader/plugins/d2rl-celestialrayone-loot-filter.dll`); the quoted messages are its
own log strings.

## Waiting for an in-game check

### Empty condition lists (`activeInLevels: []`)

The level checkboxes write `activeInLevels: []` when every level is unticked ("no level" badge); our evaluator treats
that as never active. The plugin logs "the list is empty" for an empty list and we do not know whether it then drops
the key (rule active at every level) or switches the rule off. Until known, the validator warns about every empty list
condition ("empty list: the game logs 'the list is empty'…", done) and the UI keeps writing `activeInLevels: []`
("Every level" removes the key). Verify with a one-rule filter and `lootfilter` in the console.

### A single-number level (`"activeInLevels": 4` in Sully's template)

Open question: **with Sully's template v0.9.2, are Ancient Scrolls (`01b`–`50b`) still shown at filter levels 1 to
3?** Rule 77 ("R078", rule 98 up to v0.7.0) hides them with `"activeInLevels": 4` instead of `[4]`. Verified in game: the rule works (the scrolls are
hidden at level 4), so the editor now reads a single number as a one-level list with a warning ("A single
number works in game; [4] is the documented form.") and the Test tab hides them at level 4 only. What is left: if the
plugin read `4` as `[4]`, the scrolls show (gong highlight) at levels 1 to 3; if they are hidden there too, the plugin
ignores the key (rule active at every level), and the warning should say so ("the plugin ignores a single number; the
rule runs at every level") and the evaluator should drop the key instead. `lootfilter` in the console should list the
rule without an error either way.

### Life, Mana and per-level stats: stored or shown value

Answered by the ESR 3.3 guide (plugin 1.8.2, "Stat values"): every stat reads the number the tooltip prints (+40 Life
reads 40, per-level stats at the character's level, howl and fear the percent, charges the skill level). The editor
follows it (`engine/statScale.ts`, LOOT-FILTER.md "Stat values"); still to see in game with 1.8.2:
`"[Life {stat:7} | Mana {stat:9} | Str/lvl {stat:220}] "` on a +40 Life item reads 40.

### Plugin tier of tier-less items

Still open from round 2: the plugin's `tier` for rings, amulets, charms and jewels. `debug_log = true` prints
`tier %d` per item in `d2rloader\logs\celestialrayone.loot-filter.log`.

## Verified in game

### Stat checks without param, and skill tab numbering

Verified in game: a test rule (`namePrefix` `"[… | Tab {stat:188} / {stat:188,8}] "`) on an item with +4 to Fire Skills
(Sorceress Only) showed `Tab 0 / 4`: a check without `param` reads only the param-0 entry (`OMITTED_PARAM =
'layerZero'` now; validator, "No param" option and Test tab say so firmly), and the plugin numbers skill tabs
`class × 8 + tab` (8 = Sorceress Fire; properties.txt would say 3). Note for the template upstream: its three +3/4/5 skill
tab rules (v0.6.7 to v0.6.11, rules 31 to 33, 0-based) list params 0 to 21 in properties.txt numbering. They work in game by chance: the items roll only
Amazon tabs (plugin 0–2) or Sorceress tabs (plugin 8–10), and both ranges are in the list. 13 of the numbers (3–7,
11–15, 19–21) name no tab and the paramless check repeats param 0, so the minimal lists are `[0, 1, 2]` and
`[8, 9, 10]`; the same pattern for Paladin, Barbarian, Druid, Assassin or Warlock items (plugin 24 and up) would
never match. See LOOT-FILTER.md "Verify in game". Resolved upstream: since v0.9.0 the template reads every tab with
`statMax('item_addskill_tab')` instead of the lists. The template's Ancient Scroll hide rule (since v0.6.9; rule 98,
rule 77 since v0.9.0)
writes `4` where the format documents `[4]`; it works in game, so the editor accepts the number with a warning (see
"A single-number level" above).

## Shipped format changes (ESR 3.3, plugin 1.8.2)

`show`, `formula`, localised level names, tooltip-number stat values, the unidentified-item skip, once-per-item chat
and sounds and the launcher's chat switch shipped with ESR 3.3; the editor follows the 3.3 guide (LOOT-FILTER.md "Show
action", "Formula condition", "Localised level names", "Verify in game" → "Plugin 1.8.2 checks"). The formula preview
branch `feat/loot-filter-formulas` was ported onto the 3.3 update. Open: the in-game checks listed there
(`LOOT_FILTER_PLUGIN_VERSION` is already 1.8.2 since ESR 3.3.02).

## Needs the plugin or the mod (requests for the mod author)

Collected to forward together once the current implementation round is done.

- **Per-rule enable flag.** The format has none; the editor now writes disabled rules to a sibling top-level
  `disabledRules` list (`{ "at", "rule" }` entries, see LOOT-FILTER.md "Disabled rules") that the plugin ignores
  ("unknown setting, ignored", one log line). An official `"enabled": false` would remove the workaround.
- **Hide unique/set items already in the Chronicle.** The Chronicle is the game's collection log (saved with the
  shared stash). It is not exposed as player stats (no itemstatcost row), the plugin rejects D2RLAN's grail condition
  ("grail conditions are not supported"), and ESR's chronicle-tracker plugin (3.2.22) already adds a "Not in
  Chronicle" ground-label line. Ask for an `inChronicle: true/false` condition.
- **Droplight on hidden items: planned upstream.** Users hide blue jewels and low runes but still see
  the beam, which is baked into ESR's HD item models (`data/hd/items/**.json`, entity `droplight`: all runes, jewels,
  charms, coupons, maps, keys; 625 item codes), not a filter action; `hide` removes only the label and pickability.
  Planned upstream: a future ESR version removes the hard-coded droplights from every item, so there are no default
  beams and filters add them back with the `droplight` action. To do here when that ships: refresh the template from
  its repo, and say in the Droplight section's hint that items have no beam unless a rule adds one.
- **Treasure goblins on the minimap.** Every condition and action of the plugin is about items; goblins are monsters
  (`monstats.txt` treasuregoblin\*). Needs a monster-marker plugin, not a filter feature.
- **Orphan rune row.** `misc.txt` row 424 "Hu Rune" (`r48`, name string `r32` = Fu Rune) is used by no treasure class,
  cube recipe, runeword or gems.txt row. The app greys it out as "never drops".
- **Enhanced Damage / Defense read as 0.** The plugin reads an item's full stat list, where the game never writes an
  op-13 stat (a percentage of a base stat) when the item has the base stat, so `item_maxdamage_percent` (17) and
  `item_mindamage_percent` (18) read 0 on weapons (verified in game: a magic Cruel weapon with +214% fails `>= 1` and
  matches `< 1`) and `item_armor_percent` (16) on armour (verified in game: a Godly Body Shield with
  +201–300% showed 0), while Enhanced Damage on a jewel reads correctly (verified: 58);
  `item_maxdurability_percent` (75) likely reads 0 on items with durability (not tested). Ask for these stats to be read from the item's own stat list (or for a computed "enhanced
  damage" value). The editor warns about such checks meanwhile (LOOT-FILTER.md "Known plugin limits").
- **Unidentified items.** Whether the plugin sees stats and `uniqueOrSetId` of unidentified ground items decides how
  far stat and unique/set conditions reach for rares and uniques on the ground.

## Planned features on top of the loot filter

Owner requests (2026-11), to start once the editor is mostly done and verified in game. Sharing and the LLM prompt start
are built.

### Loot filter sharing (Supabase)

Built (2026-11): saved filters in Supabase (migration `005_loot_filters.sql`), public unless marked private, drafts in
the browser until Save, the sandbox for others' filters, copies with "Update available", likes and download counts,
the library's Shared and My filters tabs, the author's filters on `/user/:userId` and "Latest loot filters" on the home
page. Spec and owner decisions: [FEATURE-LOOT-FILTER-SHARING.md](../../builds-feature-docs/FEATURE-LOOT-FILTER-SHARING.md);
the screens: [LOOT-FILTER.md](./LOOT-FILTER.md) (Library screen). Decided: the content is saved verbatim (comments
kept), only the bundled sounds and icons ship (no uploads), a filter is updated in place (a `revision` per content
save, a change note), and `updateUrl` is left as the author wrote it.

### LLM prompt start

Built (2026-11) as the AI help page (`/loot-filters/ai`, "Create a filter with AI help" in the library, "Improve with
AI" in the editor): a prompt package for any LLM in a Compact or Full game data size (one .md, a zip, or Copy prompt),
the format text generated from the editor's own sources and validator, "Import AI answer" (fences and prose stripped,
the last complete filter taken, read like an upload) and "Copy problems for the AI". See LOOT-FILTER.md "AI help". Open:
the example-rules starter waits for the example rule picker; style presets and the asset registry are inputs the page
does not pass yet.

## Decided against or parked

- **Listing the Vessel of Souls transform bases** (`m44` and 27 other non-spawnable mythical weapons) on the Bases
  tab with a badge. "Add item" takes them; the dialog hint explains why they are not listed.
- **Affix browser writing the picked affix's minimum roll.** Prefix, suffix and automagic values add up on the item,
  so the generated check uses presence (`>= 1`); the user edits the number.

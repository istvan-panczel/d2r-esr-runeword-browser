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

Open question: **with Sully's template v0.6.13, are Ancient Scrolls (`01b`–`50b`) still shown at filter levels 1 to
3?** Rule 98 hides them with `"activeInLevels": 4` instead of `[4]`. Verified in game: the rule works (the scrolls are
hidden at level 4), so the editor now reads a single number as a one-level list with a warning ("A single
number works in game; [4] is the documented form.") and the Test tab hides them at level 4 only. What is left: if the
plugin read `4` as `[4]`, the scrolls show (gong highlight) at levels 1 to 3; if they are hidden there too, the plugin
ignores the key (rule active at every level), and the warning should say so ("the plugin ignores a single number; the
rule runs at every level") and the evaluator should drop the key instead. `lootfilter` in the console should list the
rule without an error either way.

### Life, Mana and per-level stats: stored or shown value

Open question: **does `{stat:7}` show 40 or 10240 on a +40 Life item?** (Use "Check in game" on a rule
that checks `maxhp`, or a `namePrefix` `"[Life {stat:7} | Mana {stat:9} | Str/lvl {stat:220}] "`.) The game stores
Life, Mana and Stamina ×256 (`ValShift` 8) and the per-level stats in eighths per character level; the validator warns
about every such check that is not a presence check (`engine/statScale.ts`). With the answer: drop the warnings for
what reads as shown, or turn them into firm "write ×256" hints (and maybe let the stat row take the shown number).
Sully's rules 29 and 30 print `{stat:218}/8`, which suggests the stored eighths for the per-level stats.

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
never match. See LOOT-FILTER.md "Verify in game". The template's Ancient Scroll hide rule (rule 98, since v0.6.9)
writes `4` where the format documents `[4]`; it works in game, so the editor accepts the number with a warning (see
"A single-number level" above).

## Planned format changes to watch

### Formula conditions and a show action

A formula/show syntax is planned upstream; revisit when it ships. ESR 3.2.24's plugin (1.5.3) has neither, and the
editor treats such keys like any other unknown key.

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

Owner requests (2026-11), to start once the editor is mostly done and verified in game. Sharing is built; the rest is
not built yet.

### Loot filter sharing (Supabase)

Built (2026-11): saved filters in Supabase (migration `005_loot_filters.sql`), public unless marked private, drafts in
the browser until Save, the sandbox for others' filters, copies with "Update available", likes and download counts,
the library's Shared and My filters tabs, the author's filters on `/user/:userId` and "Latest loot filters" on the home
page. Spec and owner decisions: [FEATURE-LOOT-FILTER-SHARING.md](../../builds-feature-docs/FEATURE-LOOT-FILTER-SHARING.md);
the screens: [LOOT-FILTER.md](./LOOT-FILTER.md) (Library screen). Decided: the content is saved verbatim (comments
kept), only the bundled sounds and icons ship (no uploads), a filter is updated in place (a `revision` per content
save, a change note), and `updateUrl` is left as the author wrote it.

### LLM prompt start

A "Start with an LLM" button opens a textarea where the user describes what they want from the filter ("show runes
from Ist up with a sound, hide magic weapons without +skills, …"). The app builds one prompt to paste into an LLM of the
user's choice: the request, the filter format (keys, value shapes, how conditions and rules combine, hide and
exceptions as `< 1` checks), the plugin's conditions and actions, the game data the rules need (item codes and names,
item types, stat names with labels and which need a param, unique and set ids, bundled sounds and icons) in a compact
form, and the known plugin limits (Enhanced Damage/Defense read 0, params read as param 0 when omitted). The user
imports the LLM's answer like an upload and fixes what the validator reports. Open points:

- Prompt size: the full code and stat lists are large (lootfilter.json is ~830 KB), so pick what to include from the
  request (keyword match against item, type and stat names) or send only the common subsets, and say how to look up
  the rest.
- Validating and importing the answer: strip prose and code fences, read it with the lenient reader, show the
  validator's problems before saving; maybe a second prompt that feeds the problems back.
- Keeping the format text in sync with the editor: generate it from the same sources (types, validator messages,
  `STAT_QUIRKS`, the example rules) rather than a hand-written copy.

## Decided against or parked

- **Preserving `//` comments between rules.** Sully's filter has section comments inside the rules array; the
  serializer keeps only the leading comment block. The editor now warns on upload that they are dropped on the first
  edit. Preserving positions would need the JSONC reader to attach comments to rules (M, fragile with hand edits).
- **Listing the Vessel of Souls transform bases** (`m44` and 27 other non-spawnable mythical weapons) on the Bases
  tab with a badge. "Add item" takes them; the dialog hint explains why they are not listed.
- **Affix browser writing the picked affix's minimum roll.** Prefix, suffix and automagic values add up on the item,
  so the generated check uses presence (`>= 1`); the user edits the number.

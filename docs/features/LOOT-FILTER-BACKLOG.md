# Loot Filter: backlog of deferred items

Requests and findings from the loot filter users (Discord, October 2026) that are **not built yet**, with the reason
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

### Plugin tier of tier-less items

Still open from round 2: the plugin's `tier` for rings, amulets, charms and jewels. `debug_log = true` prints
`tier %d` per item in `d2rloader\logs\celestialrayone.loot-filter.log`.

## Announced format changes to watch

### Stat formulas (announced 2026-10-26, not released)

The mod author announced "mathematical formulas support for stats": rules will filter by stat values through
formulas, which "will not work on unidentified items". No guide, schema or plugin update exists yet (ESR 3.2.24 plugin
1.5.3, guide PDF unchanged). When it ships: read the new guide, extend `StatCheck` (today `value` is a number or
`[low, high]`; a formula is presumably a string) so the parser does not move such checks to `passthrough` with an error,
show them read-only or with a text field, and make the evaluator report "formula: not evaluated" instead of guessing.
Until then a filter with formulas opens with a wrong-shape diagnostic on that condition and the Test tab ignores it.

## Needs the plugin or the mod (requests for the mod author)

Collected to forward together once the current implementation round is done.

- **Per-rule enable flag.** The format has none; the editor now writes disabled rules to a sibling top-level
  `disabledRules` list (`{ "at", "rule" }` entries, see LOOT-FILTER.md "Disabled rules") that the plugin ignores
  ("unknown setting, ignored", one log line). An official `"enabled": false` would remove the workaround.
- **Hide unique/set items already in the Chronicle.** The Chronicle is the game's collection log (saved with the
  shared stash). It is not exposed as player stats (no itemstatcost row), the plugin rejects D2RLAN's grail condition
  ("grail conditions are not supported"), and ESR's chronicle-tracker plugin (3.2.22) already adds a "Not in
  Chronicle" ground-label line. Ask for an `inChronicle: true/false` condition.
- **Droplight on hidden items: answered upstream (2026-10-27).** Users hide blue jewels and low runes but still see
  the beam, which is baked into ESR's HD item models (`data/hd/items/**.json`, entity `droplight`: all runes, jewels,
  charms, coupons, maps, keys; 625 item codes), not a filter action; `hide` removes only the label and pickability.
  The mod author told Sully he will remove the hard-coded droplights from every item, so a future ESR version has no
  default beams and filters add them back with the `droplight` action. Sully plans a droplight pass over his filter
  (jackpot and "tink" items first). To do here when that ships: refresh the template from his repo, and say in the
  Droplight section's hint that items have no beam unless a rule adds one.
- **Treasure goblins on the minimap.** Every condition and action of the plugin is about items; goblins are monsters
  (`monstats.txt` treasuregoblin\*). Needs a monster-marker plugin, not a filter feature.
- **Orphan rune row.** `misc.txt` row 424 "Hu Rune" (`r48`, name string `r32` = Fu Rune) is used by no treasure class,
  cube recipe, runeword or gems.txt row. The app greys it out as "never drops".
- **Enhanced Damage / Defense read as 0.** The plugin reads an item's full stat list, where the game never writes an
  op-13 stat (a percentage of a base stat) when the item has the base stat, so `item_maxdamage_percent` (17) and
  `item_mindamage_percent` (18) read 0 on weapons (user-confirmed: a magic Cruel weapon with +214% fails `>= 1` and
  matches `< 1`), `item_armor_percent` (16) very likely on armour and `item_maxdurability_percent` (75) likely on
  items with durability. Ask for these stats to be read from the item's own stat list (or for a computed "enhanced
  damage" value). The editor warns about such checks meanwhile (LOOT-FILTER.md "Known plugin limits").
- **Unidentified items.** Whether the plugin sees stats and `uniqueOrSetId` of unidentified ground items decides how
  far stat and unique/set conditions reach for rares and uniques on the ground.

## Decided against or parked

- **Preserving `//` comments between rules.** Sully's filter has section comments inside the rules array; the
  serializer keeps only the leading comment block. The editor now warns on upload that they are dropped on the first
  edit. Preserving positions would need the JSONC reader to attach comments to rules (M, fragile with hand edits).
- **Listing the Vessel of Souls transform bases** (`m44` and 27 other non-spawnable mythical weapons) on the Bases
  tab with a badge. "Add item" takes them; the dialog hint explains why they are not listed.
- **Affix browser writing the picked affix's minimum roll.** Prefix, suffix and automagic values add up on the item,
  so the generated check uses presence (`>= 1`); the user edits the number.

# Character save parser

Reads the ESR character save (`.d2s`) and its optional `.d2rl` sidecar in the browser. The **My Character** page
(`/character`, see below) shows what the stored saves hold, and [Start a build from a save](#start-a-build-from-a-save) on
`/builds/new` turns one into a build draft; the parser's exports are listed first.

Code: `src/features/character/parser/`. Data: `stash.json` `characterStats` / `characterClasses`
([GAME-DATA.md → Stash](./GAME-DATA.md#stash)), and `manifest.json` `esrDate` for the old-save hint. Fixtures:
`test-fixtures/character/` (gitignored personal saves, never committed; the integration test is skipped without them).

## Exports

| Export                                                           | File                | Purpose                                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseCharacter(bytes, data)`                                    | `parseCharacter.ts` | Parses a `.d2s` to a `CharacterFile` (`incomplete` set if it stopped early), or throws `CharacterParseError`; also `SAVE_FORMAT_VERSION`, `computeCharacterChecksum` |
| `createCharacterData(bundle)`                                    | `characterData.ts`  | Builds the `CharacterData` lookups from `stash.json` (superset of the stash parser's `StashData`)                                                                    |
| `locationOf`, `toCharacterItem`, `equippedGear`, `NO_UNIQUE_ROW` | `location.ts`       | Item locations, the weapon-swap normalisation, the slot view                                                                                                         |
| `parseD2rl(bytes)`, `d2rlMatchesSave(sidecar, saveBytes)`        | `d2rl.ts`           | The sidecar's ESR version, and a WebCrypto SHA-256 check against a given `.d2s`                                                                                      |
| `assessSaveAge(input)`                                           | `saveAge.ts`        | What the UI needs for an old-save warning                                                                                                                            |
| `readProgress`, `readQuests`                                     | `progress.ts`       | The difficulty / act the character is in and the quest flags the computed sheet reads (`CharacterFile.progress`, `.quests`)                                          |
| `CharacterParseError`, `D2rlParseError`                          | `errors.ts`         | Typed errors with the failure point                                                                                                                                  |

`CharacterFile` holds the name, class id and name (Warlock = 7), level, last-saved time (Unix seconds), active weapon, the raw
`gf` stats (`attributes`, by stat id, including ESR's) and the 16 vanilla ones by name (`baseAttributes`, ValShift applied), hard
skill points by `skills.txt` row (`skills`), the 16 hotkeys and four hand skills, the mercenary header, the item lists
(`items.player`, `items.corpses`, `items.merc`, `items.golem`), the slot views (`gear`, `mercGear`), saved summons, and the
byte ranges of every section walked.

Items are `CharacterItem`: a `StashItem` (the stash `readItem` reads them, so they work with the stash engine's
`describeStashItem` and `renderItemText`) with a `location` and `socketed: CharacterItem[]`. `StashItem` itself gained
`bodyLocation` and `storePage`; the stash parser behaves as before.

Take the base and the slot from the item, never from the unique's row: SpinToWin's belt is a `bmb` carrying unique row 554,
Death's Grip, whose row lists gloves (INFERRED: an ESR cube base conversion).

## Format

Save version `0x44520005` is D2RLoader's extended format; the same revision on every save from ESR 3.2.10 to 3.3.02, so the
file itself does not say which ESR version wrote it. Verified on 11 characters + the swap save (`characterFixture.integration.test.ts`).

### Header (VERIFIED)

| Offset                    | Field                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0x00 / 0x04 / 0x08 / 0x0C | magic `55 AA 55 AA`, version, file size, checksum (rotate-left-1 + byte, bytes 0x0C-0x0F read as 0)                                            |
| 0x10                      | active weapon (0 or 1, see "Weapon swap")                                                                                                      |
| 0x14 / 0x15               | status byte / progression byte (5 per completed difficulty + acts done in the current one; INFERRED, agrees with the quest words on all saves) |
| 0x18 / 0x19 / 0x1A / 0x1B | class / stat count / **skill count** / level                                                                                                   |
| 0x20                      | last saved (Unix seconds)                                                                                                                      |
| 0x28                      | 16 hotkeys (u32): low 15 bits are the `skills.txt` row, low 16 bits all ones means unassigned, bit 15 is the left hand (INFERRED from vanilla) |
| 0x68                      | left, right, swap left, swap right skills, same encoding                                                                                       |
| 0x98 / 0x99 / 0x9A        | one byte per difficulty: bit 7 marks the difficulty the character is in, the low bits are the act (0-4); VERIFIED on the 3 ground-truth saves  |
| 0x9F                      | merc flags (bit 16 dead), 0xA3 seed (merc present iff ≠ 0), 0xA7 name index, 0xA9 hireling id, 0xAB experience                                 |
| 0xF8                      | game version byte                                                                                                                              |
| 0x12B                     | name, UTF-8, up to 96 bytes                                                                                                                    |

### Sections (VERIFIED byte-exact)

| Section                                                  | Layout                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Woo!` quests, `WS` waypoints, NPC (`01 77`)             | Declared sizes; quests: 48 u16 words per difficulty after a 10-byte header (`progress.ts`), the rest not interpreted             |
| `gf` attributes                                          | Bit-packed: 16-bit stat id, the stat's CSvBits value, repeated, then `0xFFFF` and byte padding. Zero-value stats are not written |
| `if` skills                                              | One byte per skill of the class (`header skill count`, 35 for every class), in `skills.txt` row order                            |
| `JM` + count player items                                | Each item via the stash `readItem`                                                                                               |
| `JM` + count corpses                                     | Each: 12 bytes + `JM` item list (never seen)                                                                                     |
| `jf`, then `JM` list when hired                          | Merc items                                                                                                                       |
| `kf` + flag byte                                         | Golem item when the flag is set (never seen)                                                                                     |
| `01 00 'lf'` + hasDemon + padding                        | 6 bytes in every sample                                                                                                          |
| `SUMN`, u16, u16 count, count × (u16 skill, u16 monster) | Optional; INFERRED layout from one sample (PhysMagicBowazo)                                                                      |

### Item locations

- Mode 0 stored: store page 1 inventory (10×8), 4 Horadric Cube, 5 personal stash, **7 the ESR Charm Inventory (8×8, confirmed by
  an in-game screenshot)**.
- Mode 1 equipped: body 1 head, 2 neck, 3 torso, 4/5 weapon hands, 6/7 rings, 8 belt, 9 feet, 10 gloves, 11/12 swap hands.
- Mode 2 belt: `x` is the slot. Mode 6 socketed: children live under their parent. Ground / cursor / dropping are kept but
  never seen. A combination no save has shown becomes `{ kind: 'unknown' }` rather than failing.

### Weapon swap (VERIFIED)

Header u32 at 0x10 is the active weapon. When it is **1** the file physically swaps the hand slots: body 4/5 hold weapon set II
and 11/12 hold set I. `location.weaponSet` and `gear.weaponSets` normalise this for the player; `rawBody` keeps the file's
value. Evidence: `test-fixtures/character/swap/SpinToWin.d2s` (active 1) has Thunder Star (unique row 215, `0fl`) in body 4 and
in game it is on tab II; `SpinToWin.d2s` (active 0) carries the same gear in the normal positions, and the two give the same
set I and set II after normalisation. The merc has no swap; corpse and golem items are not normalised (UNKNOWN whether a
corpse keeps its swap state). The four hand skills at 0x68 are exposed as stored: SpinToWin's two pairs are equal, so whether
they swap with the active weapon is UNKNOWN.

### Sentinels and character totals

Quest items with quality unique carry unique id 65535 ("no row", INFERRED; seen on `hdm`, `hst`); `toCharacterItem` turns it into
`uniqueId: null`, keeping the base and the quality. No final totals exist in a save: `maxhp` etc. are base values and
`hitpoints` are current values, so final life, resists etc. need a rules engine: [Computed sheet](#computed-sheet).

### Sidecar (`.d2rl`)

Header `D2RL`, u16 format 2, u16 header size 44, u32 payload length, payload SHA-256, then at 0x34 the save's checksum and size, at
0x3C its SHA-256, at 0x74 its last-saved time. From 0x154: length-prefixed strings game version, three u32s, mod folder / name /
empty / description / **ESR version**, then the plugin list (not read). The ESR version is exactly the length-prefixed string;
the byte after it is the low byte of the plugin count, which reads as a letter when dumped as text
(110 plugins = `n`, hence `3.3.02n` in a raw `strings` dump).

## What is verified, what is not

| Status        | Topic                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| VERIFIED      | Header layout, section walk, item lists, `gf` widths, `if` row order, weapon swap, Charm Inventory store 7, `.d2rl` fields used here |
| INFERRED      | Hotkey bit 15 (left hand), merc name index meaning, SUMN layout (one sample), quest item sentinel meaning, base-converted uniques    |
| UNKNOWN       | Corpse header bytes, golem/demon/ear bytes under the extended format, whether hand skills swap with the active weapon                |
| Not exercised | Corpses, golem item, bound demon, ears: never seen in any real save (see "Error policy")                                             |

## Error policy

`parseCharacter` returns a boundary-checked result or throws `CharacterParseError` with `reason` and `details` (section, byte
and bit offsets, item path and code). There is no fallback parser. Reasons: `bad-magic`,
`unsupported-version`, `size-mismatch`, `checksum-mismatch`, `truncated`, `section-boundary`, `unknown-stat`, `unknown-class`,
`skill-count-mismatch`, `invalid-value`, `item`, `unsupported-block`, `trailing-bytes`.

Boundary checks are the safety net: a section ending anywhere else than the next marker throws with the section that did not
end. A failure in, or right after, a part no real save has exercised also sets `details.unverified`
(`corpse`, `golem`, `bound-demon`, `ear`) so it can never be mistaken for a good parse or a generic error.

Once the player item list has ended on its verified boundary, a failure with `details.unverified` set no longer throws:
`parseCharacter` returns what it read so far with `incomplete: { section, message, unverified }` (null on a full parse). A part
whose end could not be confirmed stays empty, as does everything after it (merc gear, golem, summons), and the exact end of the
file is not checked; size and checksum were already validated up front. The main case is a bound demon (`hasDemon` ≠ 0): Bind
Demon is an ordinary Warlock skill, its block comes after every section the app uses and its layout under the extended format is
unknown, so the walk stops there with the player and merc items intact.

Still hard errors: any failure before the end of the player list, an ear inside the player list included, and any failure after
it with `unverified` null (real format drift, e.g. a missing `jf`, or trailing bytes after a full walk).

`parseD2rl` throws `D2rlParseError`; callers should drop the sidecar then, never the save.

## Old-save policy

Old saves are never rejected by the parser, as long as they are structurally the extended format. Every ESR version from 3.2.10
to 3.3.02 has the same format revision and section layout. `assessSaveAge` feeds a warning, not a block: with a verified
sidecar it compares its ESR version with the bundle's; without one it compares `lastSavedAt` with the release date in
`manifest.esrDate` (the ESR commit's committer date, day-granular), and says only "saved before this release" (someone still on
an old install after a release is missed). Item stats are stored on the item, so an old item legitimately shows values the
current tables would no longer roll; names and computed text use the current tables. Boundary checks cannot catch a
same-width renumbered row; none happened from 3.2.10 to 3.3.02 (and the loader warns against changing CSvBits).

## My Character page

`/character` (`src/features/character/`: `screens/CharacterScreen.tsx`, `components/` (`tabs/`, `gear/`), `engine/`, `hooks/`, `db/`),
the first page of the My Data menu group, above the stash pages (until 2026-11 it was the My Stash page `/stash/character`, which now
redirects here). Parsed in the browser only, never sent anywhere; no computed totals yet (no final resists or life, no Tier 1
check, no monster data), so base values are labelled as base.

**Tabs** (`engine/characterTabs.ts`, `hooks/useCharacterTab.ts`, `components/CharacterTabBar.tsx`): Overview, Gear, Skills, Combat,
Storage, Progress, a `role="tablist"` of `SUBTAB_*` buttons in a `ToolbarCard`. The tab is `?tab=` (`gear`, `skills`, `combat`,
`storage`, `progress`; none or an unknown value is the Overview), so a tab can be linked and survives a reload; switching
pushes a history entry. The selected character is **not** in the URL (a link must not name someone's character).

**Several characters** (`db/characterDb.ts`, `engine/characterList.ts`, `hooks/CharacterProvider.tsx`): Dexie database
`d2r-esr-character`, table `characters`, one record per **character name** (the key, from the parse) with the raw `.d2s`
bytes and the file meta (file name, size, last modified, uploaded at, the sidecar outcome). Uploading a save of a stored
character replaces it. Every stored save is re-parsed on each visit; one the current parser rejects stays listed with its
error and a "Forget this save" button. Migration: version 1 kept one record (`files`, key `'last'`); version 2 copies it into
`characters` keyed by the name read from the save header at 0x12B (`saveNameOf`; the file name stem when the header has none),
version 3 drops `files` (`characterDb.test.ts` opens a real version 1 database). The shown character is remembered in
localStorage (`myCharacter.selected`, `db/characterSelection.ts`); without it, or once it is removed, the most recently
uploaded one is shown. The provider lives in `CharacterScreen` (the My Stash layout no longer has it).

**Upload** (`CharacterUpload` is the empty state; `CharacterSwitcher` the toolbar once a character is stored): file picker and
drag and drop take any number of `.d2s` at once, each optionally with its `.d2rl` (`pickCharacterFiles`). A sidecar is matched to
its save by the recorded hash among all picked `.d2rl` (`resolveSidecar`); a rejection is reported only for the `.d2rl` named like
the save when several saves came together (`relatedSidecars`; with one save, any `.d2rl` as before). A file that fails gets its own
error panel; the others are still stored, and the first good one is shown. A `.d2rl` alone or a stash file is an error for the
upload as a whole; stored characters never change on a failure. The switcher lists every stored character (name, class, level,
last saved, upload date), and has Upload saves, Remove (the shown one) and Clear all (with two or more), both confirmed.

**Overview** (`components/tabs/OverviewTab.tsx`, `engine/characterSheet.ts` `overviewGroups`): header (name, class, level, last saved)
with **Create a build from this character**; the banners (`engine/notices.ts` `characterNotices`); base attributes; base life, mana
and stamina next to the values **when saved** (the current values the game wrote, gear and buffs included: SpinToWin 10,219 life
on 1,189 base); level, experience, unspent stat and skill points; gold on the character and in the stash; the computed totals
placeholder (`ComputedSheetPanel`, prop `totals`); an "at a glance" line per other tab (`characterGlance`).

**Create a build from this character** (`components/CreateBuildAction.tsx`, `engine/buildHandoff.ts`): navigates to `/builds/new`
with `{ characterSave: { bytes, fileName, sidecarVersion } }` as router state; `CreateBuildScreen` reads it once
(`readSaveHandoff`), hands it to `SaveFileCard` (`initialSave`), which runs the normal "Start from a save file" flow as if the file
had been picked, and clears the history state once the form shows (a reload does not import again). The verified `.d2rl` version
reaches the import panel (`SaveImportReport.sidecarVersion`), which then warns about a different ESR version instead of guessing
from the date. Hidden without the Supabase backend; signed out, it opens the sign-in dialog. `/builds/new` alone is unchanged.

**Gear** (`components/tabs/GearTab.tsx`, `components/gear/`): a paperdoll (`GearDoll`, the in-game arrangement as CSS grid areas) of
`ItemTile`s (icon, name in its quality colour, slot); a Set I / Set II switch (the active set marked and shown first). A tile is a
button: the full All Items tooltip card (`ItemCard`: name links, skill and modifier peeks) shows in a sticky side column on wide
pages and under the section on narrow ones; the active weapon is selected first. Then the Charm Inventory as tiles, the
Ascendancy (the stone in the Charm Inventory, matched to the Ascendancies page by `ascendancyOfStone`, shown with the builds'
`AscendancyDisplay`; a stone elsewhere is named as doing nothing), and the mercenary's doll (head, body armor and hands, other slots
when filled) with a Dead badge.

**Skills** (`components/tabs/SkillsTab.tsx`): the class tree with icons and hard-point badges (the builds' read-only
`BuildSkillTrees`), the hard points as a table, and the mouse-button skills and hotkeys with icons and Skills page links. Saved
`skills.txt` rows map to `skills.json` ids through `lootfilter.json` `skillNames` (`hardSkillPoints`, `hotkeyRows`,
`handSkillRows`), the build draft's table, so no matching by name; lootfilter.json is fetched only on this tab.

**Combat** (`components/tabs/CombatTab.tsx`): an empty state until the monster hit-chance chart arrives.

**Storage** (`components/tabs/StorageTab.tsx`, `engine/characterStorage.ts`): inventory, belt, Horadric Cube, personal stash, then
other / corpse / golem items when present, each a collapsible `<details>` of item cards, with the All Items search
(`parseItemSearch` / `matchesItemSearch`: words, item type words, "phrases") over names and stat text.

**Progress** (`components/tabs/ProgressTab.tsx`, `engine/characterProgress.ts`): counters from the `gf` stats (163 `kill_base`
kills, 237 respec points, 235 Relics of Knowledge used, 926 unspent specialization points), the learned perks of each
specialization tree (stats 927-990 via `specializations.json` `perks[].stat`, linked to `/specializations?tree=&perk=`; unlocked when
a perk is learned or 942 `specializationtokencap` is set, INFERRED from one save), and the Kill Ledger (`led`) and Ascendancy
Stone (`ast`) cards with where they are and links to `/kill-ledger` and `/ascendancies?search=`.

**Seams for the later passes**: `ComputedSheetPanel` `totals?: ReactNode` (Overview, `components/ComputedSheetPanel.tsx`);
`SkillsTab` `itemSkillBonus?: (skillId) => number` (adds From items and Level columns); `CombatTab({ character })` whose body the
chart replaces.

**Banners, never blocks** (`engine/notices.ts`): save age from `assessSaveAge` (the exact version with a matching `.d2rl`, otherwise
"may be older than ESR x" from the date); an unused `.d2rl`; `incomplete !== null` names the part that could not be read and what stays
empty (that part and everything after it); corpses present say the equipped gear may be on the corpse (INFERRED: no real sample).

**Errors**: `CharacterLoadErrorPanel`, the My Stash panel (`LoadErrorPanel`) with the failure point of a `CharacterParseError` (section,
list position, path, item code as on the stash panel, byte / bit offsets; no stats, names or other item contents).

### Item text at the character's level

`renderItemText(item, ctx, { characterLevel })` (stash `engine/items/itemText.ts`): stats whose tooltip says "(Based on Character Level)"
(`isPerLevel`: op 2/4/5 and `descstr2`; `kill_display` is op 2 but counts kills) show `floor(raw × level / 2^op param)`, and per-level
max damage and defense (`item_maxdamage_percent_perlevel`, `item_maxdamage_perlevel`, `item_armorpercent_perlevel`, `item_armor_perlevel`)
go into the damage and defense base lines, their sources summed first. Without the option the output is exactly the stash's. Ground truth
from the in-game tooltip, level 102, Thunder Star (`characterItems.fixture.integration.test.ts`): stored rate 3 → "+306% Enhanced Maximum
Damage (Based on Character Level)", base max 74 × 4.06 + 97 → "One-Hand Damage: 25 to 397".

Player items, including corpse items, use the character's level. Mercenary and golem items stay at the per-level rate: the save holds no
merc level.

Known gaps: the game's "+50% Damage to Undead" line on blunt weapons is not shown (the type data has `blun`, but itemtext.json has no
string for it and how it merges with the item's own undead damage stat is unverified); per-level defense is not confirmed in game the way
Thunder Star's damage is; stat filter values (`statValues`) are not levelled; the page has no stat filters.

## Combat tab

`src/features/character/combat/` (`HitChanceView`, props `{ attackRating?, defense?, characterLevel?, ignoreTargetDefense?,
targetDefenseReductionPercent? }`): the chance to hit monsters and the chance to be hit by them across the areas, endgame maps and
bosses. The game shows these only after you hit a monster type; here they come from the game files (`combat.json`, see
[GAME-DATA.md](./GAME-DATA.md) "Combat"). The view loads the bundle itself; the props only seed its number inputs (attack rating,
defense, −% Target Defense, Ignore Target's Defense), so it works without a character. Pure logic: `combatRows.ts` (rows, the
inverse helpers), `monsterStats.ts` (shared with the generator), `curveChart.ts` (chart geometry); tests in the same folder,
`build/bundleCombat.test.ts` and `bundleIntegrity.test.ts`.

**The formula** (VERIFIED, `d2rloader/config/celestialrayone.attack-rating.toml`): one curve for every attacker and defender,
r = attack rating / defense; up to r = 5 it is 100·r⁵ / (r⁵ + 5⁵), above it 50 + 50·d / (d + 3) with d = r − 5, a late tail
(d + 1) blended in by smoothstep between r = 30 and 100; whole percents, 100 from 99.5, limits 0 and 100, no level term. The app
already had it (`modifiers/utils/modifierMath.ts` `hitChance`); combat.json carries the same `attackRating.curve` fact. The
character level is shown only to say it does not matter.

**Monster numbers** (derivation):

1. Pool: levels.txt `mon1..25` in Normal, `nmon1..25` in Nightmare and Hell (VERIFIED columns; that Nightmare and Hell share `nmon`
   is the vanilla engine rule). Left out: treasure goblins (`MonType` treasuregoblin; the Goblin Realm holds nothing else and is
   not listed), ESR's Corrupted Zakarum special spawns (`corruptedzakarum*`, added to every campaign pool like the goblins; their
   archer would otherwise be the strongest attacker of most Hell areas) and `boss` rows (the "clone" bosses some pools list, e.g.
   Factory Director in the Endgame Zones; the real bosses have their own rows). Endgame map levels are merged per zone.
2. Monster level: Nightmare / Hell the area's `MonLvlEx(N)` / `MonLvlEx(H)`; Normal the monster's own monstats `Level`; bosses their
   own `Level` / `Level(N)` / `Level(H)` (INFERRED: vanilla engine rules). Champions +2, uniques and minions +3 (INFERRED, vanilla).
3. Defense = monstats `AC*` × monlvl `L-AC*`[level] / 100; attack rating = the best of `A1TH*` / `A2TH*` / `S1TH*` × `L-TH*`[level]
   / 100, rounded down (VERIFIED tables; that the game uses the `L-` expansion columns is the vanilla rule). monlvl.txt ends at 110.
   `noRatio` rows would use the raw columns (none in a pool or the boss list).
4. Champion / unique attack rating bonus: monumod.txt constants "Champion Attack Rating % Bonus" 75, "Unique …" 100, "Minion of
   Unique …" 50 (VERIFIED values; that they multiply the attack rating after the level scaling is INFERRED, it moves results by
   under 1 point). No monumod constant changes defense.
5. A row is the area's median regular monster type (lower middle) with the min–max of its types; chance to hit uses the defense
   spread, chance to be hit the attack rating spread. Champion / unique rows re-scale the stored values to the higher level
   (exact in Nightmare / Hell up to a point of rounding; approximate in Normal, where each monster has its own level).

**Modifiers**: −% Target Defense lowers the monster's defense, halved against uniques and superuniques (VERIFIED: attack-rating.toml
`live_monster_defense` comment); the tab also halves it against bosses (INFERRED). Ignore Target's Defense makes every chance to hit
100 %; whether it fails on bosses as in the original game is unknown, so boss rows say "boss: unsure". monprop.txt `monrandombonus`
(Normal 20 % of spawns +20, Nightmare 30 % +40, Hell 40 % +60, maps 20 % +100) also sets `item_tohit_percent`; the panel shows the
chance to be hit by such a spawn (INFERRED that monster "+% attack rating" applies).

**Not counted**: block and Dodge / Avoid / Evade come after the hit roll (the tab says chance to be hit is the roll only); spells and
skills that always hit do not roll (casters-only pools show "spells only"); terror zones raise monster levels in campaign areas
(bounds in `desecratedzones.json`) and are not modelled; auras and curses on monsters are not modelled.

**Worked examples** (test-fixtures ground truth `_hit-chance/`, recomputed by the generator, pinned by the tests): Death Knight
(`blackknight5`) at Worldstone Keep Level 2 Hell, level 88: defense 3,226, attack rating 52,189; Harbinger of Pestilence, Tier 1
map, level 100: 4,685 / 620,520; The Lich King, 110: 10,500 / 2,743,440; Tier 1 map bosses 4,200 / 1,567,680; Baal (Hell) 6,293 /
153,660. Sanity: attack rating 61,474 and defense 73,276 hit a Tier 1 regular 86 % and are hit by it 76 % (champions / uniques
88–90 %), are hit 0 % by the median Hell Act 5 regular (Nosliwyaj's Reign's strongest type 12 %), 95 % by the Lich King; defense
2,430 is hit at least 92 % by the median monster of every Hell Act 5 area and map.

**View**: inputs and the difficulty (default Hell) and Regular / Champion / Unique switches in one row; a table per section
(campaign by act, endgame maps by tier in Hell, bosses: act, Pandemonium, map bosses by tier) with monster level, chance to hit and
chance to be hit as text plus a thin meter (colour is never the only signal), champion / unique medians beside a regular row on
wide screens; selecting a row shows its numbers, the curve with your two positions (dataviz palette slots 1 / 2, validated in both
themes) and the attack rating for 75 / 95 % to hit and the defense for 25 / 5 % to be hit against the typical and toughest
monster type. Checked in headless Chrome (light, dark, 375 px and 1400 px) on a scratch route that is not committed.

## Start a build from a save

`/builds/new` has a "Start from a save file" card: pick or drop a `.d2s` and the normal build form opens pre-filled as an
**editable draft**, character stats included. The file is parsed in the browser and not stored; nothing is saved until the user saves the form. No schema
or database change. A parse failure shows the failure point (no item data) and leaves the form usable.

Code: `src/features/character/engine/buildDraft.ts` (`createBuildDraft`, pure), `buildDraftItems.ts` (the item bridge),
`buildDraftRead.ts` (upload check, never throws); `src/features/builds/hooks/useSaveDraftData.ts`,
`components/SaveFileCard.tsx`, `components/SaveImportPanel.tsx`, `utils/saveImportReview.ts`. The game data is fetched only once
a file is picked (`lootfilter.json` `skillNames` maps a saved skill row to its `skills.json` id).

| Draft field                           | From the save                                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build name, class, level, hard points | Character name (editable), class, level, `skills` (zero entries dropped)                                                                                                                      |
| Skills text                           | One line from the hand skills and hotkeys: `Attack` and duplicates dropped, item-granted skills kept, swap pair only when it differs                                                          |
| Player, Weapon Swap, Mercenary gear   | `gear` (`weaponSets[1]` = swap) and `mercGear`, all included by default. The slot is always the slot the item is in                                                                           |
| Runeword base, socket fillers         | The item's own code and name; fillers are all sockets on uniques, mythicals and sets, jewels only on runewords, none on gemwords                                                              |
| Charms                                | Charm inventory only, one text line with the name and stats at the character's level; only identical rolls merge ("2x …"); Kill Ledger skipped, charms anywhere else are inactive and skipped |
| Ascendancy                            | The Ascendancy Stone in the charm inventory; not a charm line                                                                                                                                 |
| Character stats                       | The [computed sheet](#computed-sheet) for the save's own difficulty, unbuffed, as the variant's `stats` block (`engine/buildDraftStats.ts`); see FEATURE-BUILD-SHARING.md "Character stats"   |

**The bridge** branches on quality first, then matches name + the txt row's base code (never a save id across tables: all 270 set
ids are also unique ids, and a ref's `id` is the local table's). Rares, crafted and tempered items become custom items labelled with
their base ("Havoc Finger (Ring)"); magic names already hold it. An equipped quest item (unique id null) is a custom item.

**A unique row and its base can disagree** (SpinToWin's belt is `bmb` on row 554, Death's Grip, `ymg`): the row is identity only. The
item stays in the slot it is in, gets the note "On Merchant Belt" and an amber review row, because unique refs have no base field.
Same-name variants (Tathamet's Awakening, Ember of Creation, a runeword tie after the socket count) are pre-filled with the closest
one by the item's stats and flagged the same way.

**The review panel** (top of `BuildForm`) lists each unmatched or guessed item with its slot, name, base and rolled stats (session
only, never saved), plus Go to slot, Keep as custom and Clear. A row resolves itself when its slot no longer holds the imported item;
saving is never blocked. Banners, not blocks: a save from before the current ESR release (`assessSaveAge`), `incomplete` naming what
stayed empty, and a corpse being present (equipped gear may be on it; INFERRED, no real sample).

**Character stats.** `createBuildDraft` takes the sheet data (`charsheet.json` + `itemtext.json`; `useSaveDraftData` loads
`charsheet.json` apart from the other bundles, still only once a file is picked) and puts `toStatsSnapshot` of the unbuffed sheet
on the draft's variant, with the character's name, the save time and the sidecar's ESR version when the My Character hand-off
knows it. The stats are the author's to edit or clear before saving (the form marks changed save-derived numbers as edited).
A missing or broken `charsheet.json`, a failing computation or a parse that stopped inside the player items gives a draft
without stats: the import goes on and the panel says the stats could not be computed. The form's "Fill from a save file"
(`statsFromSaveBytes`) uses the same path for the stats alone. The ground-truth SpinToWin save pre-fills every number of its
in-game screen (`buildDraft.fixture.integration.test.ts`).

Measured over the 11 real saves (`buildDraft.fixture.integration.test.ts`): 79 of 99 equipped items match a named item; every unique,
set, runeword and gemword matched, and the 20 others are rares and magics. Not imported: exact rolls, mercenary type and inventory;
there is no field for them.

## Computed sheet

`computeCharacterSheet(character, data, options?)` (`src/features/character/engine/sheet/`, pure: no React, no fetch)
turns a parsed save into the numbers of the in-game character screen and Advanced Stats, each with the sources it adds
up from. Data: `createSheetData(charsheet.json, itemtext.json)` ([GAME-DATA.md → Character sheet](./GAME-DATA.md#character-sheet)).

| Export                                             | Purpose                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `computeCharacterSheet(character, data, opts)`     | `CharacterSheet`: every value a `SheetValue` (`value`, `sources`, `status`, `notes?`), plus `facts`, `warnings` |
| `listAvailableBuffs(character, data)`              | `AvailableBuff[]`: own cast skills and auras, self-buff procs of active items, that would change the sheet      |
| `toStatsSnapshot(sheet, { savedAt, esrVersion? })` | `CharacterStatsSnapshot`: flat numbers with short keys (`v: 1`), about 400 bytes as JSON, for a shared build    |
| `createSheetData(charsheet, itemtext)`             | The lookups (build once per loaded bundle pair)                                                                 |

`options.difficulty` picks the difficulty of the resist penalty (default: the one the save is in); `options.buffs`
(`{ skillId, level? }[]`) counts buffs. A `SheetSource` has a `kind` (`base`, `item`, `set`, `runic`, `quest`, `passive`,
`item-aura`, `buff`, `per-level`, `percent`, `attribute`, `class`, `difficulty`, `cap`), a label, a value, and `item`
(index into `items.player`) or `skill` (skills.txt row) where one applies; the UI names items from the index. Life, mana
and stamina sources are in points with fractions (the pools are 1/256 fixed point), so they add up before the floor.

### Ground truth

Three pairs of in-game screenshots and the save written seconds later, 2026-11-11, ESR 3.3.03
(`test-fixtures/character/ground-truth/*/GROUND-TRUTH.md`, gitignored): Javazon (Amazon 80, Hell act 3), SpinToWin
(Barbarian 102, Hell act 5, dual wield) and Soso (Sorceress 18, Normal act 1, a full set). `sheet.fixture.integration.test.ts`
asserts every number of the character screen and the Advanced Stats the sheet covers: all three match exactly, and on
each the saved current life and mana are at most the computed maximum (less than one point below it; stamina equal).

### Rules

VERIFIED = reproduces the three pairs; INFERRED = follows from the data or D2's rules, not compared with the game.

| Rule                                                                                                                                                                                                                                                                                                                                                                                   | Status                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| What counts: equipped items of the active weapon set, charms in the Charm Inventory (store page 7). A charm-dedup group (`c11` / `c12`) counts its first charm in save order                                                                                                                                                                                                           | VERIFIED (order INFERRED)                                 |
| An item gives its own, runeword and socketed stats (a filler's gems.txt column for the host's gem apply type, a jewel's own) and the set bonus lists it carries by pieces worn; sets.txt partial and full bonuses come from the bundle (the save has none)                                                                                                                             | VERIFIED                                                  |
| Runic Insight (gf `archaeology_3`): the runes' own modifiers pooled per stat and param, 5% once toward zero, split back by host (the pooling gain to the host that lost most); op 13 stats per host                                                                                                                                                                                    | VERIFIED                                                  |
| Dual wield: the off-hand weapon's own IAS, deadly strike, crushing blow, target defense and to-hit stay off the sheet (`offense.offHand`)                                                                                                                                                                                                                                              | VERIFIED                                                  |
| Per-level stats (op 2, base level): floor(Σ value × level / 2^op param), all lists pooled                                                                                                                                                                                                                                                                                              | VERIFIED                                                  |
| Attributes: (gf + flat) × (100 + attribute %) / 100, then + per-level; the % does not multiply per-level attributes                                                                                                                                                                                                                                                                    | VERIFIED                                                  |
| Life: (gf + flat) + trunc(that × life % / 100) + per-level + trunc(per-level × life % / 100) + (vitality above gf) × LifePerVitality / 4. The two truncations are apart: op 11 names both (`maxhp`, `item_hp_perlevel`). Soft-vitality life is not multiplied, except through the Kill Ledger aura's maxhp term (row 852). Mana alike with energy, stamina with `skill_staminapercent` | VERIFIED                                                  |
| Passive skills: `passivestat` columns at the effective level, only with a `passivestate` (Wisdom of Athulua has none: nothing)                                                                                                                                                                                                                                                         | VERIFIED                                                  |
| Item auras (`item_aura`, level = value): `aurastat` columns on the current totals; their `passivestat` columns on the base (gf) attributes and hard skill points (the Kill Ledger's row 827). aurafilter 0x8000 = enemy only (Conviction): nothing for the owner. The same aura on two items: the higher level only                                                                    | numbers VERIFIED, mechanism INFERRED; duplicates INFERRED |
| Skill levels: hard + all + class + tab + single, + oskills; a skill without hard points gets only oskills (a single-skill bonus alone counts as known: INFERRED)                                                                                                                                                                                                                       | VERIFIED                                                  |
| Defense: Σ armour pieces' floor(defense × (100 + own ED% + own per-level ED%) / 100) + flat defense + per-item per-level defense + dexterity / 4, × (100 + `skill_armor_percent` + `armor_override_percent`) / 100                                                                                                                                                                     | VERIFIED                                                  |
| Resists: sum + Anya (+10 per difficulty read) + difficulty penalty (difficultylevels.txt: 0 / −80 / −150), shown capped at min(75 + max resist, 95), floor −1000; no penalty on magic; physical capped at 50                                                                                                                                                                           | VERIFIED                                                  |
| Attack rating: ((dex − 7) × 5 + ToHitFactor + to-hit) × (100 + AR% + the skill's ToHitCalc or ToHit + (level − 1) × LevToHit) / 100. The off-hand line uses the whole to-hit with per-level to-hit pooled over every list (SpinToWin 68,978)                                                                                                                                           | VERIFIED                                                  |
| Speeds: totals; base attack speed 100 − main-hand weapon `speed` + attackrate; base run/walk 100 − worn armour `speed` + velocitypercent                                                                                                                                                                                                                                               | VERIFIED                                                  |
| Dodge / avoid / evade capped by the dodge-avoid-evade-cap plugin (75)                                                                                                                                                                                                                                                                                                                  | cap INFERRED (no character reached it)                    |
| Block (only with a shield): (shield block + `toblock` + charstats BlockFactor) × (dex − 15) / (level × 2), at most 75; weapon block not computed                                                                                                                                                                                                                                       | INFERRED, not on any screenshot                           |
| Other op 11 stats (`total_fire_resist`, `totalmaxhp`, `totalattackspeed` …) are not applied; a sheet whose totals hold one says so in `warnings`                                                                                                                                                                                                                                       | gap                                                       |

`warnings` also lists items whose level, strength or dexterity requirement looks unmet (the sheet still counts them),
charms switched off by the dedup, formula reads the evaluator could not do, and passives that did not settle.

### Facts

`facts`: the difficulty and act the save is in (header), difficulties completed (Eve of Destruction per difficulty;
agrees with the progression byte on every save), level, experience and the experience of the next level (experience.txt;
null at the cap), gold and stash gold, unspent stat and skill points, kills (gf `kill_base`, INFERRED meaning), respec
points, relics learned (`relic_of_knowledge`), learned perks per specialisation tree, the Kill Ledger tier and boss
flags (`kill_ledger_tier_N` / `kill_ledger_<boss>` on an active item), the Ascendancy tier (`ascendancy_tier_N`), Anya's
scroll per difficulty (quest word 37 bit 7: INFERRED bit, the +10s VERIFIED) and the mercenary: hireling.txt type, act
and difficulty from the header's id, level from the experience (the highest L with Exp/Lvl × L² × (L + 1) ≤ experience:
INFERRED D2 formula, no in-game check), dead flag.

### Buffs

Not in the unbuffed sheet: cast buffs and auras, shrines, elixirs and potions, conditional states (charges, a
whirlwinding Barbarian), mercenary auras. `listAvailableBuffs` lists the character's own non-passive skills with a
level (hard points, +skills, oskills) whose aura or passive stats reach it (`affectsOwner`: an aura, or a skill without a
target filter; not a curse, not a summon) and change a number on the sheet, and the self-buff procs of its active items
(`kind: 'proc'`, with the item, level and chance). Shrines are out of scope.

`options.buffs` counts a buff's `aurastat` columns (and the `passivestat` columns of a non-passive skill) at its
effective level, or the given `level` (needed for a proc), on the current totals. The whole sheet is re-evaluated until
it is stable, so Battle Command's +skills raise Battle Orders and itself (the recast rule). A charge skill counts as its
state at that level (INFERRED). Every number a buff changes is `unverified`; a buff the character has no level in and no
`level` was given for is skipped with a warning. Cross-check, not ground truth: Dudu's save was written shapeshifted, and
with Werewolf (+12% life) the computed maximum life equals the saved current life exactly. A Battle Orders save (the old
SpinToWin fixture) is consistent (current ≤ computed maximum) but not full, so not exact.

### Open in-game checks

- Block chance with a shield (no ground truth shows it) and weapon block.
- A buffed screen: Battle Orders + Battle Command + Shout cast in that order, the screenshots and the save, for the
  recast rule and the buff % on life / mana / defense.
- A mercenary's level on its screen (the experience formula), and a character above the dodge cap.
- A single-skill bonus on a skill without hard points; the same aura from two items.

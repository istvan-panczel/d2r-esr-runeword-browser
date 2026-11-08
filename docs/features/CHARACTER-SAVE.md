# Character save parser

Reads the ESR character save (`.d2s`) and its optional `.d2rl` sidecar in the browser. The exports below are used by
[Start a build from a save](#start-a-build-from-a-save) on `/builds/new`.

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
| 0x14 / 0x15               | status byte / progression byte                                                                                                                 |
| 0x18 / 0x19 / 0x1A / 0x1B | class / stat count / **skill count** / level                                                                                                   |
| 0x20                      | last saved (Unix seconds)                                                                                                                      |
| 0x28                      | 16 hotkeys (u32): low 15 bits are the `skills.txt` row, low 16 bits all ones means unassigned, bit 15 is the left hand (INFERRED from vanilla) |
| 0x68                      | left, right, swap left, swap right skills, same encoding                                                                                       |
| 0x9F                      | merc flags (bit 16 dead), 0xA3 seed (merc present iff ≠ 0), 0xA7 name index, 0xA9 hireling id, 0xAB experience                                 |
| 0xF8                      | game version byte                                                                                                                              |
| 0x12B                     | name, UTF-8, up to 96 bytes                                                                                                                    |

### Sections (VERIFIED byte-exact)

| Section                                                  | Layout                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Woo!` quests, `WS` waypoints, NPC (`01 77`)             | Declared sizes; contents not interpreted                                                                                         |
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
`hitpoints` are current values, so final life, resists etc. need a rules engine.

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

## Start a build from a save

`/builds/new` has a "Start from a save file" card: pick or drop a `.d2s` and the normal build form opens pre-filled as an
**editable draft**. The file is parsed in the browser and not stored; nothing is saved until the user saves the form. No schema
or database change. A parse failure shows the failure point (no item data) and leaves the form usable.

Code: `src/features/character/engine/buildDraft.ts` (`createBuildDraft`, pure), `buildDraftItems.ts` (the item bridge),
`buildDraftRead.ts` (upload check, never throws); `src/features/builds/hooks/useSaveDraftData.ts`,
`components/SaveFileCard.tsx`, `components/SaveImportPanel.tsx`, `utils/saveImportReview.ts`. The game data is fetched only once
a file is picked (`lootfilter.json` `skillNames` maps a saved skill row to its `skills.json` id).

| Draft field                           | From the save                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Build name, class, level, hard points | Character name (editable), class, level, `skills` (zero entries dropped)                                                                    |
| Skills text                           | One line from the hand skills and hotkeys: `Attack` and duplicates dropped, item-granted skills kept, swap pair only when it differs        |
| Player, Weapon Swap, Mercenary gear   | `gear` (`weaponSets[1]` = swap) and `mercGear`, all included by default. The slot is always the slot the item is in                         |
| Runeword base, socket fillers         | The item's own code and name; fillers are all sockets on uniques, mythicals and sets, jewels only on runewords, none on gemwords            |
| Charms                                | Charm inventory only, identical names merged ("9x Grand Charm of Vita"); Kill Ledger skipped, charms anywhere else are inactive and skipped |
| Ascendancy                            | The Ascendancy Stone in the charm inventory; not a charm line                                                                               |

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

Measured over the 11 real saves (`buildDraft.fixture.integration.test.ts`): 79 of 99 equipped items match a named item; every unique,
set, runeword and gemword matched, and the 20 others are rares and magics. Not imported: exact rolls, attributes, mercenary type and
inventory; there is no field for them.

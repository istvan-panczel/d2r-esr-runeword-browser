# TXT Files Reference

This document catalogs the D2R game data files in TSV (Tab-Separated Values) format.

**Location**: `public/txt/` (11 primary files used by the app)

## File Format

All TXT files follow the TSV format:
- First row contains column headers
- Subsequent rows contain data
- Columns are separated by tab characters (`\t`)
- Some files have "Expansion" marker rows that should be skipped
- Empty cells are common and should be handled as empty strings

---

## Primary Files (Used by this project)

These files are located in `public/txt/` and are parsed and stored in IndexedDB (`d2r-esr-txt-data`).

| File | Records | Description |
|------|---------|-------------|
| `properties.txt` | 251 | Property code → tooltip mapping |
| `gems.txt` | 178 | Socketable definitions (gems, runes) |
| `runes.txt` | 997 | Runeword/Gemword definitions |
| `uniqueitems.txt` | 1134 | Unique item definitions |
| `sets.txt` | 70 | Set definitions |
| `setitems.txt` | 245 | Set item components |
| `weapons.txt` | ~500 | Base weapon definitions (item code → type mapping) |
| `armor.txt` | ~300 | Base armor definitions (item code → type mapping) |
| `misc.txt` | ~400 | Misc items: charms, rings, amulets (item code → type mapping) |
| `itemtypes.txt` | ~180 | Item type hierarchy (type code → storePage, parent types) |
| `cubemain.txt` | ~1500 | Horadric Cube recipes (Ancient Coupon detection) |

### gems.txt
**Purpose**: Socketable item definitions (gems and runes for socketing)

| Column | Description |
|--------|-------------|
| `name` | Display name (e.g., "Chipped Amethyst") |
| `code` | Unique gem code (e.g., "gcv") |
| `letter` | Single character identifier |
| `transform` | Visual transform ID |
| `weaponMod1-3Code` | Property codes for weapon bonuses |
| `weaponMod1-3Param` | Property parameters |
| `weaponMod1-3Min/Max` | Bonus value range |
| `helmMod1-3Code/Param/Min/Max` | Helm/boot bonuses |
| `shieldMod1-3Code/Param/Min/Max` | Shield/armor bonuses |

**Gem Types**: Amethyst, Sapphire, Emerald, Ruby, Diamond, Topaz, Skull, Obsidian
**Quality Tiers**: Chipped, Flawed, Standard, Flawless, Blemished, Perfect

---

### runes.txt
**Purpose**: Runeword definitions

| Column | Description |
|--------|-------------|
| `Name` | Internal runeword ID (e.g., "Runeword1") |
| `*Rune Name` | Display name (e.g., "Holy") |
| `complete` | 0/1 - whether runeword is enabled |
| `firstLadderSeason` | Ladder season availability |
| `lastLadderSeason` | Ladder season end |
| `itype1-6` | Allowed item type codes |
| `etype1-3` | Excluded item type codes |
| `Rune1-6` | Gem codes for required runes |
| `T1Code1-7` | Property codes |
| `T1Param1-7` | Property parameters (skill names, etc.) |
| `T1Min1-7` | Minimum property values |
| `T1Max1-7` | Maximum property values |

**Note**: Rune slots reference gem codes from gems.txt (e.g., "gcw" = Chipped Diamond)

---

### properties.txt
**Purpose**: Property code definitions and tooltip translations

| Column | Description |
|--------|-------------|
| `code` | Property code (e.g., "ac", "str", "dmg%") |
| `*Enabled` | Whether property is active |
| `func1-7` | Function behavior IDs |
| `stat1-7` | Associated stat names |
| `*Tooltip` | Human-readable text (e.g., "+# Defense") |
| `*Parameter` | Parameter label |
| `*Min` | Minimum value label |
| `*Max` | Maximum value label |
| `*Notes` | Additional notes |

**Common Property Codes**:
- `ac` → "+# Defense"
- `str` → "+# to Strength"
- `dmg%` → "+#% Enhanced Damage"
- `res-all` → "All Resistances +#"
- `allskills` → "+# to All Skills"

---

### uniqueitems.txt
**Purpose**: Unique item definitions

| Column | Description |
|--------|-------------|
| `index` | Display name (e.g., "The Perfect Cello") |
| `*ID` | Unique numeric ID |
| `version` | Game version |
| `enabled` | 0/1 |
| `lvl` | Item level |
| `lvl req` | Level requirement |
| `code` | Base item code (e.g., "cm1" = Small Charm) |
| `*ItemName` | Base item name |
| `prop1-12` | Property codes |
| `par1-12` | Property parameters |
| `min1-12` | Minimum values |
| `max1-12` | Maximum values |
| `chrtransform` | Character display color |
| `invtransform` | Inventory display color |

---

### setitems.txt
**Purpose**: Set item components

| Column | Description |
|--------|-------------|
| `index` | Display name (e.g., "Autolycus' Robes") |
| `*ID` | Numeric ID |
| `set` | Parent set name |
| `item` | Base item code |
| `*item` | Base item display name |
| `lvl` | Item level |
| `lvl req` | Level requirement |
| `prop1-9` | Base properties |
| `par1-9`, `min1-9`, `max1-9` | Property details |
| `aprop1a-5b` | Partial set bonus properties |
| `apar1a-5b`, `amin1a-5b`, `amax1a-5b` | Partial bonus details |

**Partial Bonuses**: Activate when 2+ items from the set are equipped

---

### sets.txt
**Purpose**: Set definitions with full set bonuses

| Column | Description |
|--------|-------------|
| `index` | Row index |
| `name` | Set name (e.g., "Autolycus' Magic Tools") |
| `version` | Game version |
| `PCode2a-5b` | Partial bonus properties (2-5 items) |
| `PParam2a-5b`, `PMin2a-5b`, `PMax2a-5b` | Partial details |
| `FCode1-8` | Full set bonus properties |
| `FParam1-8`, `FMin1-8`, `FMax1-8` | Full bonus details |

---

## Supporting Files (May need for resolution)

### itemtypes.txt
**Purpose**: Item type classifications

| Column | Description |
|--------|-------------|
| `ItemType` | Type name |
| `Code` | Type code (e.g., "shie", "tors", "ring") |
| `Equiv1/2` | Equivalent types |
| `Body` | Can be worn |
| `BodyLoc1/2` | Body slot (rarm, larm, tors, etc.) |
| `MaxSockets1-3` | Socket limits by level |
| `Repair` | Can be repaired |
| `Throwable` | Can be thrown |

**Used to**: Resolve item type codes in runewords (itype1-6)

---

### skills.txt
**Purpose**: Skill definitions

| Column | Description |
|--------|-------------|
| `skill` | Skill name |
| `*Id` | Numeric skill ID |
| `charclass` | Class (ama, bar, nec, pal, dru, sor, ass) |
| `skilldesc` | Description reference |
| `reqlevel` | Level requirement |
| `maxlvl` | Maximum skill level |

**Used to**: Resolve skill names in properties (e.g., "oskill Teleport")

---

### armor.txt
**Purpose**: Base armor definitions

| Column | Description |
|--------|-------------|
| `name` | Armor name |
| `code` | Item code |
| `minac/maxac` | Defense range |
| `reqstr/reqdex` | Requirements |
| `durability` | Durability |
| `level/levelreq` | Levels |
| `gemsockets` | Socket count |
| `type` | Item type |

---

### weapons.txt
**Purpose**: Base weapon definitions

| Column | Description |
|--------|-------------|
| `name` | Weapon name |
| `code` | Item code |
| `type/type2` | Weapon type |
| `mindam/maxdam` | 1H damage |
| `2handmindam/2handmaxdam` | 2H damage |
| `reqstr/reqdex` | Requirements |
| `speed` | Attack speed |
| `gemsockets` | Socket count |

---

### misc.txt
**Purpose**: Miscellaneous items (charms, rings, amulets, potions)

| Column | Description |
|--------|-------------|
| `name` | Item name |
| `code` | Item code |
| `level/levelreq` | Levels |
| `stackable` | Can stack |
| `gemsockets` | Socket support |

---

### itemstatcost.txt
**Purpose**: Stat definitions and display configuration

| Column | Description |
|--------|-------------|
| `Stat` | Stat name (strength, dexterity, etc.) |
| `*ID` | Stat ID |
| `descfunc` | Description function |
| `descval` | Description value type |
| `descpriority` | Display priority |

---

## Reference Files (Future use)

### Magic/Rare Affixes
| File | Description |
|------|-------------|
| `magicprefix.txt` | Magic item prefixes with properties |
| `magicsuffix.txt` | Magic item suffixes with properties |
| `rareprefix.txt` | Rare item prefixes |
| `raresuffix.txt` | Rare item suffixes |
| `automagic.txt` | Auto-magic item modifiers |
| `qualityitems.txt` | Quality modifiers |
| `uniqueprefix.txt` | Unique item prefixes |
| `uniquesuffix.txt` | Unique item suffixes |
| `uniqueappellation.txt` | Unique item appellations |

### cubemain.txt
**Purpose**: Horadric Cube recipes (used for Ancient Coupon detection)

| Column | Description |
|--------|-------------|
| `description` | Recipe type (e.g., "Coupon", "Transmog") |
| `enabled` | 0/1 |
| `numinputs` | Number of input items |
| `input 1-7` | Input item codes/types |
| `output` | Output item name or code |
| `lvl` | Output item level |
| `mod 1-5` | Output modifiers |

**Ancient Coupon Detection**: Recipes where `description === "Coupon"` indicate unique items that can only be obtained via Ancient Coupons (not droppable). The `output` column contains the unique item name.

---

### Crafting (Reference)
| File | Description |
|------|-------------|
| `cubemod.txt` | Cube modifiers |
| `gamble.txt` | Gambling item definitions |

### Drop Tables
| File | Description |
|------|-------------|
| `treasureclassex.txt` | Treasure classes (drop tables) |
| `itemratio.txt` | Item quality ratios |

---

## Game Data Files (Reference only)

### Monster Data
| File | Size | Description |
|------|------|-------------|
| `monstats.txt` | 754KB | Monster statistics |
| `monstats2.txt` | 174KB | Additional monster stats |
| `monai.txt` | 16KB | Monster AI behavior |
| `monequip.txt` | 4KB | Monster equipment |
| `monlvl.txt` | 15KB | Monster levels |
| `monmode.txt` | 238B | Monster modes |
| `monplace.txt` | 658B | Monster placement |
| `monpreset.txt` | 5KB | Monster presets |
| `monprop.txt` | 61KB | Monster properties |
| `monseq.txt` | 29KB | Monster sequences |
| `monsounds.txt` | 27KB | Monster sounds |
| `montype.txt` | 1KB | Monster types |
| `monumod.txt` | 3KB | Monster unique mods |

### Level/Area Data
| File | Size | Description |
|------|------|-------------|
| `levels.txt` | 144KB | Level/area definitions |
| `levelgroups.txt` | 6KB | Level groupings |
| `lvlmaze.txt` | 6KB | Maze level data |
| `lvlprest.txt` | 135KB | Preset level data |
| `lvlsub.txt` | 3KB | Sub-level data |
| `lvltypes.txt` | 11KB | Level types |
| `lvlwarp.txt` | 6KB | Warp points |

### Character Data
| File | Description |
|------|-------------|
| `charstats.txt` | Character starting stats |
| `experience.txt` | Experience tables |
| `playerclass.txt` | Player class definitions |
| `plrmode.txt` | Player modes |
| `plrtype.txt` | Player types |

### Hireling Data
| File | Description |
|------|-------------|
| `hireling.txt` | Mercenary definitions |
| `hirelingdesc.txt` | Mercenary descriptions |

### Visual/Sound Data
| File | Size | Description |
|------|------|-------------|
| `sounds.txt` | 1.9MB | Sound definitions |
| `soundenviron.txt` | 21KB | Sound environments |
| `overlay.txt` | 30KB | Visual overlays |
| `missiles.txt` | 854KB | Missile definitions |
| `composit.txt` | 207B | Composite visuals |
| `compcode.txt` | 2KB | Composite codes |
| `colors.txt` | 374B | Color definitions |

### Object/NPC Data
| File | Size | Description |
|------|------|-------------|
| `objects.txt` | 207KB | Game objects |
| `objgroup.txt` | 10KB | Object groups |
| `objmode.txt` | 114B | Object modes |
| `objpreset.txt` | 13KB | Object presets |
| `objtype.txt` | 9KB | Object types |
| `npc.txt` | 1KB | NPC definitions |
| `superuniques.txt` | 12KB | Super unique monsters |

### Miscellaneous Data
| File | Description |
|------|-------------|
| `actinfo.txt` | Act information |
| `armtype.txt` | Arm types |
| `automap.txt` | Automap settings |
| `belts.txt` | Belt configurations |
| `bodylocs.txt` | Body locations |
| `books.txt` | Book items |
| `difficultylevels.txt` | Difficulty settings |
| `elemtypes.txt` | Element types |
| `events.txt` | Game events |
| `hitclass.txt` | Hit classifications |
| `inventory.txt` | Inventory layout |
| `lowqualityitems.txt` | Low quality items |
| `pettype.txt` | Pet types |
| `shrines.txt` | Shrine definitions |
| `skillcalc.txt` | Skill calculations |
| `skilldesc.txt` | Skill descriptions |
| `states.txt` | Game states |
| `storepage.txt` | Store pages |
| `wanderingmon.txt` | Wandering monsters |
| `misscalc.txt` | Missile calculations |

---

## File Size Summary

| Category | Files | Total Size |
|----------|-------|------------|
| Primary | 6 | ~530KB |
| Supporting | 6 | ~480KB |
| Reference | 9 | ~230KB |
| Game Data | 66 | ~10MB |

**Total**: 87 files, ~11MB

# Modifiers

What the item modifiers do in ESR: deadly strike, crushing blow, leech, resists, procs, speed stats, Magic Find, bleed,
dodge and every other stat ESR items carry. Owner decisions (2026-11-06):

- a `/modifiers` reference page (Items menu) with one card per modifier kind: what it does in ESR, the numbers per
  difficulty / target from the game files and ESR's loader plugin configs, a source badge ("ESR config", "game files" or
  "Vanilla D2 behaviour, not confirmed for ESR") and the items that have it;
- a hover peek on item property lines, like the skill peek ([SKILLS.md](./SKILLS.md) "Skill peek on item lines");
- additions to the guide glossary and the hell-survival `::difficulty-penalties` table;
- calculators: leech per difficulty, the Magic Find curve, hit chance (attack rating vs defense, ESR curve), crushing
  blow per target;
- about 40–60 key kinds get hand-checked explanations; every other stat gets a generated entry.

Status: **all done**: the data (`public/game-data/modifiers.json`, 90d63f8); the calculator formulas, the hand-checked
explanations in `content/modifiers/` and the `/modifiers` page (e6ac2a8); the guide glossary terms and penalties table
additions (423e91e, "Guide" below); the modifier peek on item lines (130b2c9, "Modifier peek" below).

## Data: `modifiers.json`

Built by `src/features/game-data/build/bundleModifiers.ts` (`ModifiersBundle` in `engine/schema.ts`) inside
`generateBundles`, written by `npm run game-data:generate`, checked by `game-data:check` and the bundle integrity test,
loaded with `loadGameDataFile('modifiers')`. ESR 3.3: 334 KB raw / 55 KB gzip (stats 254 KB, of which the example
items 116 KB; kinds 51 KB; facts 24 KB, 80 facts).

### `stats`

Every itemstatcost.txt stat (id = row) that one of these item lists carries, plus the stats of the key kinds even when
nothing carries them (Open Wounds, Prevent Monster Heal, Weapon Block …), in id order:

| List (`ModifierItemKind`)         | Rows                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `unique`                          | uniqueitems.txt, enabled rows, `prop1-12`                                       |
| `set`                             | setitems.txt `prop1-9` and the partial bonuses `aprop1a-5b`                     |
| `setBonus`                        | sets.txt `PCode2a-5b`, `FCode1-8` (not the `_old` sets)                         |
| `runeword` / `gemword`            | runes.txt recipes with a name (a rune among the inputs = runeword), `T1Code1-7` |
| `prefix` / `suffix` / `automagic` | the spawnable affixes of affixes.json                                           |
| `superior`                        | qualityitems.txt `mod1code` / `mod2code` (named after its item types)           |
| `socketable`                      | gems.txt weapon / helm / shield mods (gems, runes and the other socketables)    |
| `cube`                            | cubemain.txt enabled rows, the mods of every output (named by `description`)    |

A property resolves through properties.txt (`affixStats.ts` `propertyStats`: func 5/6/7 damage, 20 indestructible);
a code that is a propertygroups.txt group is expanded through its entries (ascendancy and gem groups). Every item counts
once per stat (`usage` per list, `items` = their sum). Per stat:

- `text` / `textNeg` / `text2` / `group`: descstrpos / descstrneg (when different) / descstr2 / dgrpstrpos through the
  strings (raw, with `%d` / `%+d` / `%%` and colour codes); `descfunc`, `descval`.
- `op`: itemstatcost `op`, `op param`, `op base`, `op stat1-3` and a readable `formula` (`opFormula`): op 2 with
  param 3 is "maxhp += value × character level / 8", op 11 "unit percent", op 13 "% of the item's base value".
- `events`: `itemevent1/2` + `itemeventfunc1/2` with a readable trigger ("on a melee hit") and action ("Crushing
  Blow"; D2MOO SkillItem.cpp event callbacks). An unknown function is a warning.
- `properties`: the properties.txt codes that set the stat.
- `vanilla`: `same` (a vanilla D2R stat with the same mechanic columns), `changed` (`changed` lists the columns, `id`
  when ESR moved it) or `esr` (not in vanilla; `reusesId` names the vanilla stat that had this row id: ESR reuses about
  80 vanilla ids, so **never assume a vanilla id means the vanilla stat**). The compared columns are op, op param, op
  base, op stat1-3, itemevent1/2, itemeventfunc1/2, damagerelated and maxstat.
- `technical`: ESR bookkeeping (`*_cap` tinkering caps, `_display` / `_hidden` companions, tinker flags;
  `isTechnicalStat`), for the page to tuck away.
- `usage`, `items`, `examples`: up to 12 example items, round-robin over the lists in the order runeword, unique,
  set, setBonus, gemword, socketable, superior, prefix, suffix, automagic, cube (file order within a list). A nameless
  source (the automagic / suffix rows of `item_randomize`) counts in `usage` but is no example; the page's `entryExamples`
  skips empty names too.

ESR 3.3.04: 532 stats, 518 carried by an item, 355 not in vanilla, 11 vanilla stats changed: `item_armor_percent`,
`item_maxhp_percent`, `item_maxmana_percent` (extra op stats: per-level defense / life / mana), `item_attackertakesdamage`
(also fires on missile hits), `item_attackertakeslightdamage` (attacked in melee + missiles), `item_openwounds` (no item
events: bleed replaces it), `item_skillonkill` (func 30, the on-death cast), `item_tohit_perlevel` and
`item_tohitpercent_perlevel` (op param), and since 3.3 `item_absorb_ltng_perlevel` (1043) and
`item_damage_demon_perlevel` (1048) (vanilla names at new ids).

### `kinds`

A kind is what one explanation covers. The reviewed key kinds (`KEY_KINDS` in the builder, page order within a
category) come first; a stat may be in one kind only, and a key kind naming a stat itemstatcost.txt lacks is a warning.
Every other stat gets a generated kind (`generated: true`, key `stat-<stat name>`, title from its description via
`labelFromDescription`; the stat name when that has no letter, e.g. `item_mythicaldesc` ".%1%0", or there is no description; category from the stat name, `other` for technical stats). Stats with the same
description text share one generated kind (`strength` + `item_strength_perlevel` = `stat-strength`). `items` counts the
distinct items carrying any of the kind's stats. The explanation text is not in the bundle: it joins on `key`.

Key kinds (ESR 3.3; items = rows of the item lists above):

| Key                     | Title                                     | Category   | Stats (id)                                                                                                                                                                                                                                 | Items |
| ----------------------- | ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `deadly-strike`         | Deadly Strike                             | offense    | `item_deadlystrike` (141), `item_deadlystrike_perlevel` (250)                                                                                                                                                                              | 565   |
| `critical-damage`       | Deadly Strike Damage                      | offense    | `criticaldamage` (434)                                                                                                                                                                                                                     | 39    |
| `crushing-blow`         | Crushing Blow                             | offense    | `item_crushingblow` (136), `item_crushingblow_perlevel` (247)                                                                                                                                                                              | 470   |
| `open-wounds`           | Open Wounds                               | offense    | `item_openwounds` (135)                                                                                                                                                                                                                    | 0     |
| `bleed`                 | Bleed                                     | offense    | `bleedmindam` (435), `bleedmaxdam` (436), `bleedlength` (437)                                                                                                                                                                              | 126   |
| `life-leech`            | Life Leech                                | offense    | `lifedrainmindam` (60), `lifedrainmaxdam` (61)                                                                                                                                                                                             | 355   |
| `mana-leech`            | Mana Leech                                | offense    | `manadrainmindam` (62), `manadrainmaxdam` (63)                                                                                                                                                                                             | 262   |
| `enhanced-damage`       | Enhanced Damage                           | offense    | `item_maxdamage_percent` (17), `item_mindamage_percent` (18), `item_maxdamage_percent_perlevel` (219)                                                                                                                                      | 1299  |
| `attack-rating`         | Attack Rating                             | offense    | `tohit` (19), `item_tohit_percent` (119), `item_tohit_perlevel` (224), `item_tohitpercent_perlevel` (225)                                                                                                                                  | 597   |
| `target-defense`        | -% Target Defense                         | offense    | `item_fractionaltargetac` (116)                                                                                                                                                                                                            | 205   |
| `ignore-target-defense` | Ignore Target's Defense                   | offense    | `item_ignoretargetac` (115)                                                                                                                                                                                                                | 58    |
| `enemy-resist`          | -% Enemy Resistance                       | offense    | `passive_fire_pierce` (333), `passive_ltng_pierce` (334), `passive_cold_pierce` (335), `passive_pois_pierce` (336), `passive_mag_pierce` (358), `passive_dmg_pierce` (366)                                                                 | 806   |
| `elemental-mastery`     | Elemental Spell Damage                    | offense    | `passive_fire_mastery` (329), `passive_ltng_mastery` (330), `passive_cold_mastery` (331), `passive_pois_mastery` (332), `passive_mag_mastery` (357)                                                                                        | 732   |
| `spell-damage`          | Magic and Physical Spell Damage           | offense    | `passive_mag2_mastery` (482), `passive_wind_mastery` (483)                                                                                                                                                                                 | 620   |
| `summon-damage`         | Summon Damage                             | offense    | `passive_summ_mastery` (486)                                                                                                                                                                                                               | 515   |
| `total-spell-damage`    | Total Spell Damage                        | offense    | `generictotalmultiplier` (398)                                                                                                                                                                                                             | 297   |
| `piercing-attack`       | Piercing Attack                           | offense    | `item_pierce` (156)                                                                                                                                                                                                                        | 100   |
| `slow-target`           | Slows Target                              | offense    | `item_slow` (150)                                                                                                                                                                                                                          | 107   |
| `freeze-target`         | Freezes Target                            | offense    | `item_freeze` (134)                                                                                                                                                                                                                        | 90    |
| `knockback`             | Knockback                                 | offense    | `item_knockback` (81)                                                                                                                                                                                                                      | 78    |
| `prevent-heal`          | Prevent Monster Heal                      | offense    | `item_preventheal` (117)                                                                                                                                                                                                                   | 0     |
| `monster-flee`          | Hit Causes Monster to Flee                | offense    | `item_howl` (112)                                                                                                                                                                                                                          | 0     |
| `reanimate`             | Reanimate As                              | offense    | `item_reanimate` (155)                                                                                                                                                                                                                     | 5     |
| `cast-on-strike`        | Chance to Cast on Striking / Attack       | procs      | `item_skillonhit` (198), `item_skillonattack` (195), `item_skillonhit_hidden` (405), `item_skillonattack_hidden` (404)                                                                                                                     | 2862  |
| `cast-when-struck`      | Chance to Cast when Struck                | procs      | `item_skillongethit` (201), `item_skillontakedmg` (376), `item_skillongethit_hidden` (415), `item_skillontakedmg_hidden` (377)                                                                                                             | 898   |
| `cast-on-kill`          | Chance to Cast on Kill / Death / Level-Up | procs      | `item_skillonkill` (196), `item_skillondeath` (197), `item_skillonlevelup` (199), `item_skillonkill_hidden` (378)                                                                                                                          | 677   |
| `cast-on-cast`          | Chance to Cast on Casting a Skill         | procs      | `item_skilloncast` (422), `item_skilloncast_hidden` (423)                                                                                                                                                                                  | 340   |
| `attacker-takes-damage` | Attacker Takes Damage                     | procs      | `item_attackertakesdamage` (78), `item_thorns_perlevel` (238), `item_attackertakeslightdamage` (128), `item_attackertakesfiredamage` (337), `item_attackertakescolddamage` (401), `thorns_percent` (131), `missile_thorns_percent` (208)   | 223   |
| `resist-fire`           | Fire Resist                               | defense    | `fireresist` (39), `item_resist_fire_perlevel` (231), `total_fire_resist` (391)                                                                                                                                                            | 1040  |
| `resist-cold`           | Cold Resist                               | defense    | `coldresist` (43), `item_resist_cold_perlevel` (230), `total_cold_resist` (392)                                                                                                                                                            | 1032  |
| `resist-lightning`      | Lightning Resist                          | defense    | `lightresist` (41), `item_resist_ltng_perlevel` (232), `total_lightning_resist` (393)                                                                                                                                                      | 1030  |
| `resist-poison`         | Poison Resist                             | defense    | `poisonresist` (45), `item_resist_pois_perlevel` (233), `total_poison_resist` (394)                                                                                                                                                        | 947   |
| `max-resist`            | Maximum Resist                            | defense    | `maxfireresist` (40), `maxcoldresist` (44), `maxlightresist` (42), `maxpoisonresist` (46), `maxmagicresist` (38)                                                                                                                           | 1141  |
| `physical-resist`       | Physical Resist                           | defense    | `damageresist` (36), `total_physical_resist` (427)                                                                                                                                                                                         | 559   |
| `magic-resist`          | Magic Resist                              | defense    | `magicresist` (37), `total_magic_resist` (400)                                                                                                                                                                                             | 250   |
| `damage-reduced`        | Damage Reduced                            | defense    | `normal_damage_reduction` (34)                                                                                                                                                                                                             | 582   |
| `magic-damage-reduced`  | Magic Damage Reduced                      | defense    | `magic_damage_reduction` (35)                                                                                                                                                                                                              | 473   |
| `absorb`                | Elemental Absorb                          | defense    | `item_absorbfire_percent` (142), `item_absorbfire` (143), `item_absorblight_percent` (144), `item_absorblight` (145), `item_absorbmagic_percent` (146), `item_absorbmagic` (147), `item_absorbcold_percent` (148), `item_absorbcold` (149) | 328   |
| `block`                 | Chance to Block                           | defense    | `toblock` (20)                                                                                                                                                                                                                             | 148   |
| `dodge`                 | Dodge, Avoid and Evade                    | defense    | `passive_dodge` (338), `passive_avoid` (339), `passive_evade` (340)                                                                                                                                                                        | 57    |
| `weapon-block`          | Weapon Block                              | defense    | `passive_weaponblock` (348)                                                                                                                                                                                                                | 0     |
| `cannot-be-frozen`      | Cannot Be Frozen                          | defense    | `item_cannotbefrozen` (153)                                                                                                                                                                                                                | 195   |
| `half-freeze`           | Half Freeze Duration                      | defense    | `item_halffreezeduration` (118)                                                                                                                                                                                                            | 7     |
| `poison-length`         | Poison Length Reduced                     | defense    | `item_poisonlengthresist` (110)                                                                                                                                                                                                            | 139   |
| `curse-resist`          | Curse Resistance                          | defense    | `curse_resistance` (109)                                                                                                                                                                                                                   | 73    |
| `damage-to-mana`        | Damage Taken Goes to Mana                 | defense    | `item_damagetomana` (114)                                                                                                                                                                                                                  | 47    |
| `ias`                   | Increased Attack Speed                    | speed      | `item_fasterattackrate` (93)                                                                                                                                                                                                               | 1754  |
| `fcr`                   | Faster Cast Rate                          | speed      | `item_fastercastrate` (105)                                                                                                                                                                                                                | 1322  |
| `fhr`                   | Faster Hit Recovery                       | speed      | `item_fastergethitrate` (99)                                                                                                                                                                                                               | 777   |
| `fbr`                   | Faster Block Rate                         | speed      | `item_fasterblockrate` (102)                                                                                                                                                                                                               | 582   |
| `frw`                   | Faster Run/Walk                           | speed      | `item_fastermovevelocity` (96)                                                                                                                                                                                                             | 921   |
| `life-after-kill`       | Life after each Kill                      | resources  | `item_healafterkill` (86), `item_healafterdemonkill` (139)                                                                                                                                                                                 | 318   |
| `mana-after-kill`       | Mana after each Kill                      | resources  | `item_manaafterkill` (138)                                                                                                                                                                                                                 | 331   |
| `on-striking`           | Life and Mana on Striking                 | resources  | `lifeonstriking` (505), `manaonstriking` (506)                                                                                                                                                                                             | 151   |
| `replenish-life`        | Replenish Life                            | resources  | `hpregen` (74)                                                                                                                                                                                                                             | 457   |
| `magic-find`            | Magic Find                                | find       | `item_magicbonus` (80), `item_find_magic_perlevel` (240)                                                                                                                                                                                   | 436   |
| `gold-find`             | Gold Find                                 | find       | `item_goldbonus` (79), `item_find_gold_perlevel` (239)                                                                                                                                                                                     | 328   |
| `extra-items`           | Increased Quantity of Items Found         | find       | `extra_items` (426)                                                                                                                                                                                                                        | 18    |
| `skill-cooldown`        | Skill Cooldown Reduction                  | skills     | `item_skill_cooldown` (371)                                                                                                                                                                                                                | 194   |
| `attribute-percent`     | % Bonus to Attributes                     | attributes | `strengthpercent` (255), `dexteritypercent` (256), `vitalitypercent` (257), `energypercent` (258)                                                                                                                                          | 651   |

ESR 3.3.04: 435 kinds, 60 key kinds, 375 generated.

### `facts`

Numbers with provenance. Each fact: `key`, `label`, `value` (a number, a boolean, a string list, `[Normal, Nightmare,
Hell]` or a record per class / target / setting), `vanilla` in the same shape when known, `unit`, `origin`
(`game-files`, `esr-config` or `vanilla-engine` = vanilla D2 behaviour from D2MOO, not confirmed for ESR), `source`
(`file` and the column or `section.key`) and an optional `note`.

| Key                                                                               | ESR 3.3                                                                                                             | Vanilla                                           | Source                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| `difficulty.ResistPenalty`                                                        | 0 / -80 / -150                                                                                                      | 0 / -40 / -100                                    | difficultylevels.txt                               |
| `difficulty.ResistPenaltyNonExpansion`                                            | 0 / -30 / -50                                                                                                       | 0 / -20 / -50                                     | difficultylevels.txt                               |
| `difficulty.LifeStealDivisor`                                                     | 1 / 25 / 150                                                                                                        | 1 / 2 / 3                                         | difficultylevels.txt                               |
| `difficulty.ManaStealDivisor`                                                     | 1 / 15 / 75                                                                                                         | 1 / 2 / 3                                         | difficultylevels.txt                               |
| `difficulty.DeathExpPenalty`                                                      | 10 / 10 / 10                                                                                                        | 0 / 5 / 10                                        | difficultylevels.txt                               |
| `difficulty.MonsterSkillBonus`                                                    | 0 / 3 / 7                                                                                                           | same                                              | difficultylevels.txt                               |
| `difficulty.MonsterFreezeDivisor`, `…ColdDivisor`, `AiCurseDivisor`               | 1 / 2 / 4                                                                                                           | same                                              | difficultylevels.txt                               |
| `difficulty.UniqueDamageBonus`, `ChampionDamageBonus`                             | 90 / 75 / 66                                                                                                        | same                                              | difficultylevels.txt                               |
| `difficulty.PlayerDamagePercentVSPlayer`                                          | 17                                                                                                                  | same                                              | difficultylevels.txt                               |
| `difficulty.PlayerDamagePercentVSPrimeEvil`                                       | 100 / 50 / 25                                                                                                       | 100                                               | difficultylevels.txt                               |
| `difficulty.MercenaryDamagePercentVSMercenary`                                    | 100 / 50 / 25                                                                                                       | 25                                                | difficultylevels.txt                               |
| `difficulty.MercenaryDamagePercentVSBoss`                                         | 50 / 35 / 25                                                                                                        | same                                              | difficultylevels.txt                               |
| `difficulty.PrimeEvilDamagePercentVSMercenary` / `…VSPet`                         | 100                                                                                                                 | 200 / 400                                         | difficultylevels.txt                               |
| `difficulty.MonsterCEDamagePercent`                                               | 0                                                                                                                   | 50 / 35 / 20                                      | difficultylevels.txt                               |
| `difficulty.MonsterFireEnchantExplosionDamagePercent`                             | 75 / 50 / 13                                                                                                        | same                                              | difficultylevels.txt                               |
| `difficulty.StaticFieldMin`                                                       | 0                                                                                                                   | 0 / 33 / 50                                       | difficultylevels.txt                               |
| `charstats.BlockFactor`                                                           | Ama 5, Sor 4, Nec 4, Pal 6, Bar 5, Dru 4, Ass 5, War 4                                                              | 20–30                                             | charstats.txt                                      |
| `charstats.ToHitFactor` / `WalkVelocity` / `RunVelocity` / `MinimumCastingDelay`  | 20 / 9 / 13 / 0 for every class                                                                                     | 5…−15 / 6 / 9 / 12                                | charstats.txt                                      |
| `monstats.drainZero`                                                              | 658 / 659 / 659 of 1436 enabled monsters cannot be leeched (ESR 3.3)                                                | —                                                 | monstats.txt `Drain`, `Drain(N)`, `Drain(H)`       |
| `monstats.drainPartial`                                                           | 5 / 5 / 5 (Drain 1–99)                                                                                              | —                                                 | monstats.txt                                       |
| `crushingBlow.settings`                                                           | monster 50, champion 50, unique 25, super_unique 16, act_boss 16, minion 50, mercenary 50, player 50 (% of vanilla) | 100                                               | crushing-blow.toml `[targets]`                     |
| `crushingBlow.share`                                                              | 12.5 / 12.5 / 6.25 / 2 / 2 / 12.5 / 5 / 5 % of current life                                                         | 25 / 25 / 25 / 12.5 / 12.5 / 25 / 10 / 10         | derived: vanilla share × setting / 100             |
| `crushingBlow.ranged`, `.enabled`                                                 | 100 (ranged = melee), true                                                                                          | 50                                                | crushing-blow.toml `[attack] ranged`               |
| `crushingBlow.effectivenessStat`                                                  | 1045 (`crushingblow_damage`, ESR 3.3; -1 = off)                                                                     | —                                                 | crushing-blow.toml `[effectiveness] stat_id`       |
| `criticalDamage.stat` / `.basePercent` / `.maxPercent` / `.enabled` / `.missiles` | 434 / 200 / 100000 / true / true                                                                                    | — / 200                                           | critical-strike-damage.toml                        |
| `dodge.cap`                                                                       | dodge 75, avoid 75, evade 75                                                                                        | 100 (no cap)                                      | dodge-avoid-evade-cap.toml (per-stat -1 = inherit) |
| `castRate.cap`, `castRate.maxRate`                                                | 500 FCR, rate 196 (derived: 100 + floor(120 × cap / (cap + 120)))                                                   | 200, 175                                          | cast-rate-cap.toml `fcr_cap`                       |
| `magicFind.tail`                                                                  | unique / set / rare 10 % of raw MF                                                                                  | 0                                                 | magic-find-soft-tail.toml                          |
| `attackRating.curve`                                                              | pivot 5, steepness 5, tail 3, late tail 1 blended 30–100, snap 99.5, min 0, max 100, no level scaling               | pivot 1, steepness 1, tail 2, 5–95, level scaling | attack-rating.toml `[curve]`, `[chance]`           |
| `attackRating.table`                                                              | r 1→0, 2→1, 3→7, 4→24, 5→50, 6→62, 8→75, 10→81, 20→91, 30→94, 40→96, 50→97, 60→98, 80→99, 100→99, 104→100           | —                                                 | attack-rating.toml comment table                   |
| `bleed.stats`, `bleed.enabled`                                                    | min 435, max 436, length 437, state 62; true                                                                        | —                                                 | bleed.toml                                         |
| `weaponBlock.enabled` / `.clawTypes` / `.swordTypes`                              | true / `h2h` / `swor`                                                                                               | Assassin claws only                               | weapon-block-rules.toml                            |
| `summonResistCap.enabled`                                                         | true                                                                                                                | —                                                 | summon-resist-cap.toml                             |
| `poisonImmunity.enabled` / `.state`                                               | true / 25                                                                                                           | —                                                 | poison-immunity.toml                               |
| `enhancedDamageFix.enabled`                                                       | true                                                                                                                | —                                                 | enhanced-damage-fix.toml                           |
| `thorns.killCredit` / `.percentKillCredit`                                        | true / false                                                                                                        | —                                                 | soft-hit-removal.toml                              |
| `extraItems.settings`                                                             | stat 426, percent, prime evils excluded, minion owner credited, no pick limit                                       | —                                                 | item-quantity.toml                                 |
| `crossbow.bolts` / `.damageBase` / `.standingReloadBonus` / `.attackFrames`       | 3 / 100 / 25 / 5 (ESR 3.2.24: damage 150, no standing bonus)                                                        | —                                                 | crossbow-charges.toml `[crossbow_charges]`         |
| `crossbow.stats`                                                                  | max bolts 513, current bolts 514, damage 515, attack frames 517                                                     | —                                                 | crossbow-charges.toml                              |
| `crossbow.reload`                                                                 | base 60 frames (2.4 s; 3.2.24: 75), minimum 25 (1 s)                                                                | —                                                 | skills.txt Attack `calc4`                          |
| `curses.extraStat`, `curses.replace`                                              | 1016, "oldest"                                                                                                      | — (one curse)                                     | extra-curses.toml `[curses]`                       |
| `socketEffect.stats`                                                              | gems 1022, runes 1023, jewels 1041, in this item: gems 1047, runes 1046, jewels 1044                                | —                                                 | jeweler.toml `[[gem_effect]]` (`own_sockets`)      |
| `socketEffect.statCount`                                                          | 209 (the stats a socketed item's effect raises)                                                                     | —                                                 | jeweler.toml `[socketed_gems] stats`               |
| `utilityPotion.duration`                                                          | elixir 1125 frames (45 s), stamina 2250, antidote 1125, thawing 1125                                                | —                                                 | misc.txt `len` of the `upot` rows                  |
| `utilityPotion.greaterPercent`, `.perkPercent`                                    | 125 (Greater Elixirs), 5 (Volatile Concoctions, `alchemy_2`)                                                        | —                                                 | misc.txt `calc1`                                   |
| `resist.floor`                                                                    | -1000 (decoded from the patched `mov ecx, imm32`)                                                                   | -100                                              | patches/esr-resistance-floor-minus-1000.json       |
| `block.noRunPenalty`                                                              | true                                                                                                                | false                                             | patches/no-run-penalties.json (present)            |
| `summons.primeEvilDamage`                                                         | true                                                                                                                | false                                             | patches/pet-damage-vs-prime-evil.json (present)    |
| `magicFind.dim`                                                                   | unique 250, set 500, rare 600                                                                                       | (vanilla-engine)                                  | D2MOO Items.cpp                                    |
| `leech.precision`                                                                 | 64 (leech kept in 1/64 %)                                                                                           | (vanilla-engine)                                  | D2MOO SUnitDmg.cpp                                 |
| `resist.maxBase` / `.hardCap` / `.physicalCap`                                    | 75 / 95 / 50                                                                                                        | (vanilla-engine)                                  | D2MOO SUnitDmg.cpp                                 |
| `absorb.percentCap`, `block.cap`                                                  | 40, 75                                                                                                              | (vanilla-engine)                                  | D2MOO                                              |
| `monster.hpBonusPerPlayer`                                                        | 50 % per extra player                                                                                               | (vanilla-engine)                                  | D2MOO Monster.cpp                                  |
| `speed.breakpointDivisor`                                                         | IAS / FCR / FHR / FBR 120, FRW 150                                                                                  | (vanilla-engine)                                  | D2MOO Units.cpp                                    |

The plugin configs and patches read are `ESR_MODIFIER_CONFIGS` / `ESR_MODIFIER_PATCHES` in `build/esrSources.ts`
(`d2rloader/config/celestialrayone.<name>.toml`, `d2rloader/patches/<name>.json`); they are in the sparse clone paths
(`scripts/lib/esrClone.ts`). A missing file or key is a warning and its facts are left out. `build/toml.ts` is a small
TOML reader (sections, scalars, nested multi-line arrays, arrays of tables) that keeps the comment block above each
key: the crushing-blow comments ("25 -> 6.25 % of current life.") are compared with the values. Arrays of tables
(`[[gem_effect]]`) read as `gem_effect[0].stat_id` …; a switched-off block is left out, a block with more than one item
type is a warning. The two table facts parse one formula each (`utilityPotionFacts` over misc.txt rows of type or
type2 `upot`, the Elixir of Reincarnation's 2000000000-frame `len` skipped; `crossbowReloadFacts` over skills.txt
Attack `calc4`); a formula of another shape is a warning and its facts are left out.

Vanilla reference values (`build/data/vanillaReference.ts`): the vanilla D2R itemstatcost.txt names, ids and mechanic
columns, the difficultylevels.txt columns above and charstats.txt BlockFactor, from blizzhackers/d2data (MIT licence)
`json/` at its 2026-10-21 commit (D2R 3.x tables). Generated once by a script; regenerate by hand only if Blizzard
changes these tables.

## Calculators

`src/features/modifiers/utils/modifierMath.ts`, pure functions reading the `facts` (a missing fact throws), tested in
`modifierMath.test.ts` against the committed bundle:

- `effectiveLeech(leech, difficulty, 'life' | 'mana', facts, drain = 100)`: `exact` = leech / divisor × Drain / 100;
  `engine` = floor(leech × 64 / divisor) / 64 × Drain / 100 (D2MOO's precision).
- `effectiveMagicFind(mf, quality, facts)`: magic = MF, and any MF up to 10 is used in full (the engine applies the
  curve only when 100 + MF > 110, D2MOO Items.cpp:2397); above that unique / set / rare = floor(dim × MF / (MF + dim)) +
  floor(MF × tail / 100) (the tail is assumed to ride on the curve branch only).
- `hitChance(ar, def, facts, { vanilla?, levels? })` / `curveChance(ratio, curve)`: below the pivot 100 × r^s / (r^s +
  pivot^s), above 50 + 50 × d / (d + tail), the late tail blended in with a smoothstep weight between blendStart and
  blendEnd, floored to a whole percent, snapped to 100 at 99.5, then level scaling (vanilla only) and min / max. The test
  reproduces the config's own table; the vanilla curve gives 100 × AR / (AR + DEF) × 2 alvl / (alvl + dlvl), 5–95.
- `crushingBlow({ currentLife, target, ranged?, players?, physicalResist?, crushingBlowDamage? }, facts)`: share =
  `crushingBlow.share` [target] (× ranged / 100 for missiles), × max(0, 100 + "+x% Crushing Blow Damage") / 100 when
  `crushingBlow.effectivenessStat` is not -1 (crushing-blow.toml `[effectiveness]`: "+25 multiplies every share by 1.25",
  "-100 or lower ... does nothing"), divided by 1 + 50 % × (players − 1) against monsters (not mercenaries or players),
  × (100 − physical resist clamped to 0–100) / 100; damage = current life × share / 100, at most the current life.

## Content: `content/modifiers/`

The hand-checked explanations (written 2026-11-06 against ESR 3.2.24, then fact-checked: 28 factual fixes, 22
rewordings) are two markdown files, Prettier-formatted like the rest of the repo:

- `modifiers.md`: one block per explanation, `## <key> — <title>` followed by `stats:` (free text), `summary:`,
  `body:`, `facts:` (bullets, or inline; `facts (intro):` keeps the intro), `caveats:` (bullets or inline; "none…" = no
  caveats) and `sources:` (entries separated by "; "), blocks separated by `---`. Other headings (the file's title)
  are skipped. Inline source tags after a claim: `[ESR config]` (the loader plugin configs and memory patches,
  `d2rloader/config/celestialrayone.*.toml`, `d2rloader/patches/*.json`), `[ESR files]` (game tables, strings, the
  official docs including the Frame Table `docs/ias-calculator.html`, patch notes), `[Vanilla]` (vanilla engine
  behaviour from D2MOO 1.10f / 1.14d or vanilla guides: "Vanilla D2 behaviour, not confirmed for ESR"),
  `[Mod author]` (the mod author's answers to our questions; the card's `sources:` name the date, e.g. "ESR mod author
  (Discord, 2026-11-07)"), `[Community 3.9]` / `[Community 3.10]` (the unofficial wiki and its mod-author Q&A, older than
  the 3.2.x line),
  optionally with a detail after a comma (`[Vanilla, D2MOO SUnitDmg.cpp:1000]`: on hover, and in a popover on click /
  tap). `` `code` ``, `**bold**`, `[text](url)` and bare URLs render too (`[text](/path)`, an app path, is a router link in the same
  tab; anything else opens a new tab); any other `[…]` stays text. Path prefixes in
  facts and sources: `ESR/` = the ESR repository root, `excel/` = `ESR/Eastern_Sun_Resurrected.mpq/data/global/excel/`,
  `strings/` = `ESR/Eastern_Sun_Resurrected.mpq/data/local/lng/strings/`, `D2MOO/` = D2MOO's `source/` at 4a60fca, wiki
  = https://doubleeclipse.github.io/esr-tools/unofficial-wiki/ (archive of the Fandom wiki, mostly ESR 3.9 / 3.10).
  Kinds without their own block: Open Wounds (a note under `bleed`), Prevent Monster Heal, Hit Blinds Target and Hit
  Causes Monster to Flee (`rare-procs`), weapon-mastery crit (in `deadly-strike`), Rest in Peace (in `reanimate`).
- `open-questions.md`: numbered questions `N. **Title (Test)** — \`key\`, \`key\``(an optional`**(new)**` after the
  title is dropped) with indented lines; they show in the "Unconfirmed" note of each card they name.
- **Both files ship whole** (`?raw` in the page chunk): no local paths, research-file references or authoring notes in
  them (the content test fails on `/Users/`, `scratchpad`, `research-`, "research notes" and `factcheck`). Item counts
  are not written in the text: the card shows the bundle's counts.

Numbers are placeholders resolved against `facts` at render time (`utils/modifierPlaceholders.ts`; the summaries also
at `modifiers:refs` time for the peek): `{difficulty.<normal|nightmare|hell|*>.<column>}` → `difficulty.<Column>`;
`{charstats.<class|*>.<Column>}` → `charstats.<Column>`; `{config.crushing-blow.targets.<t>}` →
`crushingBlow.settings`; other `{config.…}`, `{patch.…}`, `{monstats.…}` and `{engine.…}` (vanilla engine constants:
resist caps, absorb and block caps, MF dims, leech precision) paths through `PLACEHOLDER_FACTS`; `{derived.<name>.…}`
through `DERIVED`, computed with the calculators' formulas: `crushing-blow.<t>` (share with "%"),
`leech.<life|mana>.<item %>.<difficulty>` (`effectiveLeech(…).engine` with "%"), `leech-threshold.<life|mana>.<difficulty>`
(divisor / 64), `critical-multiplier.<bonus>` ((base_percent + bonus) / 100), `magic-find.<quality>.<MF>`,
`fcr-rate.<FCR>`, `fcr-frames.<frames>.<FCR>`, `fcr-max-useful`, `fcr-ceiling`, `max-resist-headroom`,
`attack-rating-table`, `utility-potion-seconds.<elixir|stamina|antidote|thawing>`, `crossbow-reload-seconds.<base|min>`,
`crossbow-standing-seconds.<base|min>` (÷ (1 + standing bonus / 100)), `crossbow-damage.<Total Crossbow Damage>`
((100 + damage base + value) %), `greater-elixir-multiplier`; the misc.txt and skills.txt facts are
`{misc.greater-elixir.percent}`, `{misc.utility-potion.perk-percent}`, `{skills.attack.crossbow-reload.<base|min>-frames}`; `{vanilla.<path>}` is any of these with the facts' `vanilla` values (only facts that have one);
`{…key}` continues the previous placeholder's path on the same line. An HTML comment right after a placeholder (the
value when written) is dropped; any other comment's text would render as plain text, so the content test allows none.
The quoted facts also become the card's fact tables.

The page imports both files as text (`src/features/modifiers/content.ts`, `?raw`, in the page chunk: 153 KB raw /
49 KB gzip with the parser and components) and parses them once (`utils/modifierContent.ts`).

**Content keys vs kinds** (`utils/modifierContentKinds.ts`, outside the markdown so a re-checked file replaces the old
one as it is): `CONTENT_KINDS` maps each content key to the bundle kinds it explains (the first gives the category
unless `category` is set); `KEY_KINDS_WITHOUT_TEXT` lists the key kinds that keep a generated entry (`replenish-life`,
`attribute-percent`); `KIND_FACTS` adds facts a kind's card always tabulates; `KIND_CALCULATORS` places the calculators.
52 content keys cover 58 of the 60 key kinds plus 39 generated kinds:

| Content key                                                                                                                                                                                                                                                                           | Kinds                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| same key (deadly-strike, critical-damage, life-leech, mana-leech, on-striking, physical-resist, damage-reduced, magic-damage-reduced, poison-length, enemy-resist, absorb, enhanced-damage, knockback, damage-to-mana, ias, fcr, fhr, fbr, frw, dodge, magic-find, elemental-mastery) | the kind of the same key                                                                                                                                                                         |
| `bleed`                                                                                                                                                                                                                                                                               | bleed, open-wounds                                                                                                                                                                               |
| `crushing-blow` / `gold-find`                                                                                                                                                                                                                                                         | the key kind plus stat-crushingblow-damage (1045) / stat-total-gold-found (1025)                                                                                                                 |
| `crossbows` (category offense)                                                                                                                                                                                                                                                        | stat-item-crossbowpassive, -crossbowreloadspeed, -totalcrossbowbolts, -totalcrossbowdamage, -crossbowreloadspeedlimit                                                                            |
| `extra-curses` (skills) / `utility-potions` (resources)                                                                                                                                                                                                                               | stat-extra-curse / stat-utilitypotionmultiplier, stat-utilitypotionduration                                                                                                                      |
| `socket-effect`                                                                                                                                                                                                                                                                       | stat-gem-effect, -rune-effect, -gem-effect-current-item, -rune-effect-current-item, -jewel-effect-current-item                                                                                   |
| `after-kill`                                                                                                                                                                                                                                                                          | life-after-kill, mana-after-kill                                                                                                                                                                 |
| `resists`                                                                                                                                                                                                                                                                             | resist-fire, resist-cold, resist-lightning, resist-poison, magic-resist                                                                                                                          |
| `max-resists`                                                                                                                                                                                                                                                                         | max-resist                                                                                                                                                                                       |
| `attack-rating`                                                                                                                                                                                                                                                                       | attack-rating, stat-item-demon-tohit, stat-item-undead-tohit                                                                                                                                     |
| `target-defense`                                                                                                                                                                                                                                                                      | target-defense, ignore-target-defense, stat-item-damagetargetac                                                                                                                                  |
| `cannot-be-frozen`                                                                                                                                                                                                                                                                    | cannot-be-frozen, half-freeze                                                                                                                                                                    |
| `slow` / `freeze` / `thorns` / `pierce` / `curse-resistance` / `item-quantity` / `cooldown-reduction`                                                                                                                                                                                 | slow-target / freeze-target / attacker-takes-damage / piercing-attack / curse-resist / extra-items / skill-cooldown                                                                              |
| `chance-to-cast`                                                                                                                                                                                                                                                                      | cast-on-strike, cast-when-struck, cast-on-kill, cast-on-cast                                                                                                                                     |
| `reanimate`                                                                                                                                                                                                                                                                           | reanimate, stat-item-restinpeace                                                                                                                                                                 |
| `block`                                                                                                                                                                                                                                                                               | block, weapon-block                                                                                                                                                                              |
| `spell-damage`                                                                                                                                                                                                                                                                        | spell-damage, total-spell-damage                                                                                                                                                                 |
| `summon-stats` (category skills)                                                                                                                                                                                                                                                      | summon-damage, stat-passive-summ-mastery-total, -summ-life, -summ-elemental-resist, -summ-phys-resist, -summ-limit, stat-summonexceedcap, stat-raven-limit, -spirit-wolf-limit, -dire-wolf-limit |
| `skills`                                                                                                                                                                                                                                                                              | stat-item-allskills, -addclassskills, -addskill-tab, -singleskill, -nonclassskill, -nonclassskill-display                                                                                        |
| `experience` / `light-radius` / `requirements` / `rare-procs`                                                                                                                                                                                                                         | stat-item-addexperience / stat-item-lightradius / stat-item-req-percent, stat-item-levelreq / prevent-heal, stat-item-stupidity, monster-flee                                                    |

`modifierContent.test.ts` fails when the committed content does not parse, a placeholder resolves to nothing, a
content key has no mapping (or a mapping no content), a mapped kind is missing from the bundle or claimed twice, a key
kind has neither text nor a `KEY_KINDS_WITHOUT_TEXT` entry, a block's `stats:` line names a stat (`name (id)`) that
is not in its kinds or leaves out one of their stats (a bare id counts: "hidden twins 377, 378"), `KIND_FACTS` / `KIND_CALCULATORS` name an unknown kind or
fact, an open question names an unknown content key, the shipped text has a local path or research note, an HTML
comment does not follow a placeholder, or a summary types a number that a fact of its card holds (a placeholder
belongs there: the summaries feed the peek too).

**Updating the text** (after an ESR release, or a new fact-check): replace `content/modifiers/modifiers.md` /
`open-questions.md`, run `npx prettier --write content/modifiers` and `npx vitest run src/features/modifiers`. A
renamed or new content key needs its `CONTENT_KINDS` line; a new placeholder path that is not a rule above needs a
`PLACEHOLDER_FACTS` line (and its fact in the builder when the bundle lacks it). A changed fact needs no text edit for
the placeholder itself, but the prose around it and the hard-coded numbers in `facts:` / `open-questions.md` must be
re-read (`.claude/skills/esr-update/reference.md` "Modifiers").

## Page: `/modifiers`

Items menu entry, home Items card chip, lazy route (`src/features/modifiers/`), a static-bundle route (no HTM
gate), in the sitemap and the guide's `page:` targets. The model is `utils/modifiersView.ts` (`buildModifiersView`):
one entry per content block, then one generated entry per remaining kind, ordered by category (offense, defense,
speed, procs, resources "Life and mana", find, skills, attributes, other), hand-written and key entries first, then the
bundle's order. A generated title that is only a stat name or a stray word ("to") falls back to the stat's display text.

- **List**: intro, source-badge legend, search (`EnhanceSearch`; every word or "quoted phrase" must occur in the
  titles, summary, body or the stats' display texts and names, like the Skills search), category pills with counts,
  "Key modifiers" (hand-written and key kinds: 54 entries) / "All stats" (396 entries), Copy Link. A card shows the title, the
  summary (or the stat's display text), the category, "ESR only" / "Changed in ESR" / "Technical (ESR bookkeeping)"
  chips and the item count; "N more in All stats" switches the view. Technical entries (all stats `technical`) stay in
  "All stats", last in their category, with that chip: labelled rather than hidden.
- **Focused card** (`?kind=`): the explanation with an inline source badge after each claim (short label, the full
  meaning and the tag detail on hover; Vanilla is dashed muted amber: "Vanilla D2 behaviour, not confirmed for ESR"),
  an "Unconfirmed" note (caveats and the open questions naming the card), the calculators, **Numbers** (fact tables:
  per difficulty, per class / target / setting, single settings; ESR next to vanilla, the origin badge, file and key,
  the fact note), **Stats** (display texts, stat name and id, vanilla / changed / ESR-only with `reusesId`, op formula,
  item events, usage per item list), **Found on** (up to 12 examples linked to their focused pages: uniques or
  mythicals, sets, runewords, gemwords, socketables `?name=`, affixes `?search="…"`; superior mods and cube recipes are
  plain text), "Technical details" (the `facts:` bullets) and **Sources** (ESR paths → the ESR GitHub repo, D2MOO paths
  → D2MOO at 4a60fca, wiki names → the unofficial wiki, URLs). The focused card is keyed by its entry, so the
  calculators' inputs reset when another entry opens; calculator results are `aria-live="polite"`. A source badge with
  a detail is a button: the detail opens in a popover on click / tap (hover shows it too; 16 px collision padding, so
  it never sits flush at a phone's edge); not inside the list cards' links.
- **URL** (`readModifiersState` / `encodeModifiersState`, defaults omitted): `kind` (an entry key or any kind key, which
  resolves to its entry: `?kind=resist-cold` opens `resists`; an unknown one shows the list with a "No modifier named …"
  note, and the next change of the view drops it), `category`, `search`, `view=all`. The home search lists
  every kind title (not bookkeeping-only kinds or stat-name titles) and links `/modifiers?kind=<kind key>`; it reads
  them from `modifierRefs.json` `searchNames` (`modifierSearchNames` in `utils/modifierRefsBuild.ts`), not from the
  50 KB gzip modifiers.json.
- **Calculators** (`components/Calculators.tsx`, rows from `utils/calculatorViews.ts`, all numbers from the facts; the
  vanilla columns run the same formulas on the facts' `vanilla` values): leech (life / mana, item %, target Drain →
  divisor, exact, engine 1/64 %, per 1000 damage, vanilla; the smallest item leech that is not 0 in Hell; the rounding
  caveat), Magic Find (per quality: ESR effective MF, the tail's part, vanilla, the diminishing constant), hit chance
  (AR and defense → ratio, ESR, vanilla at equal levels, the AR needed for 50 / 75 / 90 / 95 %), Crushing Blow (current
  life, physical resist, /players, +% Crushing Blow Damage (hidden when the config's stat is -1; ESR only, the vanilla
  column ignores it), melee / ranged → share and life removed per target class, vanilla). Local state, not
  in the URL.

Mobile: one column at 375 px without horizontal page scroll; wide tables scroll inside their box.

## Modifier peek

A whole item line that is a modifier ("+20% Deadly Strike", "+8% Physical Damage Leeched as Life", "Fire Resist +30%",
"-15% to Enemy Fire Resist", "Cannot Be Frozen") is a link to `/modifiers?kind=<entry key>` with a peek: the entry's
title and main source badge, its one-line `summary:`, one or two ESR numbers and "Open in Modifiers →". It reuses the
skill peek's machinery ([SKILLS.md](./SKILLS.md) "Skill peek on item lines"): the same line renderer (`SkillRefText`),
the same delegated layer and popover (`data-mod-ref` next to `data-skill-ref`), the same rules (not tab stops,
`aria-haspopup="dialog"`, hover / focus / first tap opens it, a click or a second tap follows it, modifier-key clicks
left to the browser, in-form lines only peek and the card's link opens a new tab, no peek after a navigation). A line
whose skill name links (skill templates) is the skill's; a line is never both. The underline is fainter than a skill
name's (dotted, `decoration-current/25`, stronger on hover): most lines get one.

**Which lines**: only entries with something to tell: the hand-written explanations and the reviewed key kinds (the
"Key modifiers" view, 54 entries; `replenish-life` and `attribute-percent` have no summary and say so). Generated kinds
("+20 to Strength", "+N Defense", Enhanced Defense) and technical stats stay plain text.

**Templates** (`utils/modifierRefsBuild.ts`, at build time): every display string of those entries' stats (`text`,
`textNeg`, the group string `group`; with and without `text2`, e.g. "(Based on Character Level)") becomes a canonical
whole line: lower case, colour codes and footnote `*` marks dropped, every number (`15`, `+15`, `-(5 to 8)`,
`(10 to 20)`, `10-12`, `1.5`) → `#`. Fixed strings of descfuncs 1–14 also get the value before (descval 1: "+3 Life on
Striking") or after it (descval 2: "Freezes target +5"); descfunc 13 / 14 lines name a class or skill tab, so those parts
are wildcards ("+2 to Druid Skill Levels", "+1 to Warlock Skills", "+1 to Summoning Skills (Necromancer Only)"), as is
Reanimate's monster. `EXTRA_TEMPLATES` adds the lines the game prints from a property ("+N% Enhanced Damage"). The skill
templates (descfunc 15 / 16 / 24 / 27 / 28) are left to the skill peek. A key several entries claim goes to the one with
the most stats behind it ("+N% to Spell Damage" → elemental-mastery, 4 of 6; "+N% Total All Resists" → resists); a tie
is left out ("+N% to All Speeds", one stat each of IAS / FRW / FHR / FBR / FCR). A template of an entry with several
kinds also names the kind with the most stats behind it, and the line's reference (`data-mod-ref`) carries it: the
`resists` peek drops the difficulty penalty for `magic-resist` lines. At run time
(`utils/modifierRefs.ts` `findModifierRef`) a line is canonicalised the same way and looked up in a `Map` (the four
wildcard keys are regexes tried after a miss): ~0.9 µs per line. Prose ("Gain 3% Maximum Damage for every 1% Physical
Damage Leeched as Life") never equals a whole template.

**Numbers** (`utils/modifierPeek.ts` `peekNumbers`, from the facts, for the line's value: the roll's larger end with
its sign (a stash item's negative line stays negative: no leech amount, MF counted in full), none for per-level lines):

| Entry                           | Peek number                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| life-leech / mana-leech         | the line's leech in Nightmare and Hell (`effectiveLeech` engine value)                                         |
| magic-find                      | the line alone as unique / set / rare MF (`effectiveMagicFind`, Vanilla badge: the curve)                      |
| crushing-blow                   | the share of current life vs normal monsters, uniques and act bosses                                           |
| deadly-strike / critical-damage | the critical multiplier (×2; Deadly Strike Damage: ×2 → ×(200 + N) / 100)                                      |
| fcr / dodge / block / absorb    | ESR's FCR cap (500, vanilla 200) / the 75% dodge caps / the 75% block cap / the 40% absorb cap                 |
| resists / max-resists / phys.   | the Nightmare and Hell penalty (not on Magic Resist lines), the 75% / 95% caps / the 95% ceiling / the 50% cap |
| attack-rating / target-defense  | 50% hit chance at 5× the target's defense (vanilla 1×)                                                         |
| freeze                          | the freeze length divisors (÷2 Nightmare, ÷4 Hell)                                                             |

A number's badge shows only when its source differs from the title's (the engine constants: "Vanilla D2"). The title's
badge is the source kind the entry's body tags name most (ties: the more ESR-specific), "ESR files" for the two key
kinds without text.

**Data** (`src/features/modifiers/data/modifierRefs.json`, 40 KB raw / 10.4 KB gzip, the test caps it at 45 KB): the
entries (key, title, category, summary with its placeholders filled in, source), 155 templates, 4 wildcard patterns, the 17 facts of
`PEEK_FACT_KEYS` and the home search's kind titles (`searchNames`, [title, kind key], ~12 KB raw). Written by
`npm run modifiers:refs` (`scripts/generate-modifier-refs.ts`, from the committed `public/game-data/modifiers.json` and
`content/modifiers/modifiers.md`); `generate-game-data.ts` writes it too, from the bundle it just generated (so
`game-data:generate`, `game-data:update` and `npm run game-data:generate -- --esr <dir>` do), and checks it with
`--check` (`game-data:check`); both through `scripts/lib/modifierRefsFile.ts`; `modifierRefs.test.ts` fails when it is stale (run `npm run modifiers:refs` after replacing
modifiers.md). It is a separate chunk (dynamic `import()` of the JSON): the first `SkillRefText` starts loading it on
idle like skilldetails.json (`hooks/useModifierRefIndex.ts`), so neither modifiers.json (50 KB gzip) nor the page's
content chunk (49 KB gzip) loads for the peek. The card (`components/ModifierPeekCard.tsx`, 2.3 KB gzip) is its own
lazy chunk inside the shared popover host; the host and both cards are prefetched on idle once a ref index has loaded
(`features/skills/components/peekChunks.ts`), so the first peek opens without a "Loading…" step.

**Coverage** (ESR 3.3; lines that are not skill links): runewords 2,005 of 3,944 lines, uniques 4,771 of 9,786,
mythicals 208 of 412, ascendancies 110 of 226, gemwords 324 of 2,498 + 8,420 of 15,104 random-pool lines, socketables
605 of 958, affixes 1,270 of 3,108, sets 1,117 of 2,404 (items, partial and set bonuses), enhance outcomes (corruption,
anointment, sanctification, Vessel recipes) 2,302 of 7,708 (1,020 distinct lines), cube output bonuses 204 of 303. The unlinked
lines with a modifier word are generated kinds (Enhanced Defense 1,008, Defense 559, "+24% Base Attack Speed"), the
"+N to Curses (Necromancer Only)" tab line (no "Skills" in it), unresolved skill lines ("Lower Resist", "Amplify Damage"
are the skill peek's) and prose. Of 243 distinct prose lines (ESR 3.3, the integration test's filter) that name a modifier (sentences with "you", "gain",
"for every", "per", "while" …) none is linked; `modifierRefs.integration.test.ts` pins that and the coverage per page.

## Guide

The guide ([GUIDE.md](./GUIDE.md)) reads `modifiers.json` at build time:

- **Glossary**: 20 combat terms in `content/guide/_glossary.yml` (Deadly Strike, Crushing Blow, Leech, Resistance
  penalty, Prime evil …) carry `link: page:/modifiers?kind=<kind key>`, shown as "Modifier details" in the glossary
  list and the term peek. Their numbers are `{fact:<fact key>[:<difficulty or field>]}` values filled from `facts`, so
  they follow the game data.
- **Links**: every `page:/modifiers?kind=…` link (notes and glossary) must name a `kinds` key, or the guide build fails.
  A kind key resolves to the entry that explains it (`resolveEntryKey`), e.g. `resist-fire` → the resists entry.
- **Penalties table**: `::difficulty-penalties` (hell-survival note) also shows the leech divisors, player and summon
  damage to prime evils, mercenary damage to bosses and the freeze, chill and AI-curse divisors. It reads
  difficultylevels.txt from the ESR clone like the rest of the guide's tables (the same columns as the
  `difficulty.*` facts).

## ESR updates

`modifiers.json` is in the esr:review bundle specs (kinds by key, stats by id, facts by key) and its warning class /
count prefix in the self-check. A changed fact (a difficultylevels.txt value, a plugin config value) means the
explanation texts quoting it must be re-checked: `.claude/skills/esr-update/reference.md` "Modifiers". The integrity
test ("committed modifiers bundle") pins Hell LifeStealDivisor 150 / ManaStealDivisor 75, the crushing blow shares, stat
434, the dodge cap 75, deadly strike items > 100, Open Wounds without items or events, about 480 used stats, the
expected warning and the size (< 400 KB).

## Open questions

- **Leech rounding under 1 %**: ESR Hell leech is item % / 150 (10 % → 0.067 %). D2MOO keeps 1/64 % precision; some
  guides say anything under 1 % after reductions rounds to 0, which would make all ESR Hell leech under 150 % useless.
  The mod author (2026-11-07) is "pretty sure" D2R keeps fractional leech; not tested in game. The calculator shows
  both `exact` and `engine`.
- **Crushing Blow vs uniques** (answered): crushing-blow.toml had `unique = 25` under the comment "50 -> 12.5 % of
  current life". The mod author (2026-11-07): 6.25 % is right; ESR 3.3 fixed the comment, so the generator's
  comment/value warning is gone.
- **Hit chance blend**: the config only says the late tail is "blended in smoothly". A smoothstep weight reproduces the
  author's table (a linear blend misses r = 80 by one); blending the tail value instead of the chance also fits.
- **Magic Find tail rounding**: the config gives MF × tail / 100; the calculator floors it like the engine's integer
  maths. Unverified.
- **monstats Drain**: 658 of 1436 enabled monsters (ESR 3.3; 647 of 1424 at 3.2.24) have Drain 0 / blank in Normal (the research notes counted 566 with
  another filter); the fact counts enabled rows with an `Id`.
- **Crushing Blow per-player division** uses the vanilla +50 % life per extra player; `player-count-halving-removal.json`
  is about drops, not life, so it is assumed unchanged.
- Vanilla engine facts (`vanilla-engine`) come from D2MOO (1.10f / 1.14d); D2R may differ.
- **Magic Find tail below 10 MF**: the engine uses MF up to 10 in full (no curve); whether ESR's soft tail is added
  there too is unknown (the calculator adds it only on the curve branch).
- **Content follow-ups** (no game needed): the wiki's +32 per-item cap for +all skills / +class skills no longer matches
  the save format (item_allskills 16 bits / SaveAdd 1000), so `skills` leaves it out; about 15 skills have no 20 %
  cooldown floor (Leap Attack, Blade Warp, Sacrificial Offering, Call of the Wild, Death Mark, Mind Blast, Frozen
  Cascade, the teleport family): the page could compute each skill's floor from skills.txt instead of quoting "80 %".
- **Resolved by the fact-check**: −% Enemy Resist below −100 (the floor patch's uncapped negative path is the one
  monsters use, so pierce should reach −1000); −% Enemy Resist for summons (the Valkyrie row copies the owner's pierce
  stats; hirelings unknown, kept as a caveat); the Poison Length Reduced cap (75 % for players in the 1.10 code,
  folded into open question 2).

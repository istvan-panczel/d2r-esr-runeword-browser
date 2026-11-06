# Modifiers

What the item modifiers do in ESR: deadly strike, crushing blow, leech, resists, procs, speed stats, Magic Find, bleed,
dodge and every other stat ESR items carry. Owner decisions (2026-11-06):

- a `/modifiers` reference page (Database menu) with one card per modifier kind: what it does in ESR, the numbers per
  difficulty / target from the game files and ESR's loader plugin configs, a source badge ("ESR config", "game files" or
  "Vanilla D2 behaviour, not confirmed for ESR") and the items that have it;
- a hover peek on item property lines, like the skill peek ([SKILLS.md](./SKILLS.md) "Skill peek on item lines");
- additions to the guide glossary and the hell-survival `::difficulty-penalties` table;
- calculators: leech per difficulty, the Magic Find curve, hit chance (attack rating vs defense, ESR curve), crushing
  blow per target;
- about 40–60 key kinds get hand-checked explanations; every other stat gets a generated entry.

Status: **Phase 1 (data) and Phase 2 (page, content, calculators) done**: `public/game-data/modifiers.json`, the
calculator formulas, the hand-checked explanations in `content/modifiers/` and the `/modifiers` page. The modifier peek
and the guide additions come next.

## Data: `modifiers.json`

Built by `src/features/game-data/build/bundleModifiers.ts` (`ModifiersBundle` in `engine/schema.ts`) inside
`generateBundles`, written by `npm run game-data:generate`, checked by `game-data:check` and the bundle integrity test,
loaded with `loadGameDataFile('modifiers')`. ESR 3.2.24: 293 KB raw / 50 KB gzip (stats 251 KB, of which the example
items 113 KB; kinds 51 KB; facts 19 KB).

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
  set, setBonus, gemword, socketable, superior, prefix, suffix, automagic, cube (file order within a list).

ESR 3.2.24: 486 stats, 473 carried by an item, 314 not in vanilla, 9 vanilla stats changed: `item_armor_percent`,
`item_maxhp_percent`, `item_maxmana_percent` (extra op stats: per-level defense / life / mana), `item_attackertakesdamage`
(also fires on missile hits), `item_attackertakeslightdamage` (attacked in melee + missiles), `item_openwounds` (no item
events: bleed replaces it), `item_skillonkill` (func 30, the on-death cast), `item_tohit_perlevel` and
`item_tohitpercent_perlevel` (op param).

### `kinds`

A kind is what one explanation covers. The reviewed key kinds (`KEY_KINDS` in the builder, page order within a
category) come first; a stat may be in one kind only, and a key kind naming a stat itemstatcost.txt lacks is a warning.
Every other stat gets a generated kind (`generated: true`, key `stat-<stat name>`, title from its description via
`labelFromDescription`, else the stat name; category from the stat name, `other` for technical stats). Stats with the same
description text share one generated kind (`strength` + `item_strength_perlevel` = `stat-strength`). `items` counts the
distinct items carrying any of the kind's stats. The explanation text is not in the bundle: it joins on `key`.

Key kinds (ESR 3.2.24; items = rows of the item lists above):

| Key                     | Title                                     | Category   | Stats (id)                                                                                                                                                                                                                                 | Items |
| ----------------------- | ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `deadly-strike`         | Deadly Strike                             | offense    | `item_deadlystrike` (141), `item_deadlystrike_perlevel` (250)                                                                                                                                                                              | 508   |
| `critical-damage`       | Deadly Strike Damage                      | offense    | `criticaldamage` (434)                                                                                                                                                                                                                     | 13    |
| `crushing-blow`         | Crushing Blow                             | offense    | `item_crushingblow` (136), `item_crushingblow_perlevel` (247)                                                                                                                                                                              | 384   |
| `open-wounds`           | Open Wounds                               | offense    | `item_openwounds` (135)                                                                                                                                                                                                                    | 0     |
| `bleed`                 | Bleed                                     | offense    | `bleedmindam` (435), `bleedmaxdam` (436), `bleedlength` (437)                                                                                                                                                                              | 92    |
| `life-leech`            | Life Leech                                | offense    | `lifedrainmindam` (60), `lifedrainmaxdam` (61)                                                                                                                                                                                             | 296   |
| `mana-leech`            | Mana Leech                                | offense    | `manadrainmindam` (62), `manadrainmaxdam` (63)                                                                                                                                                                                             | 204   |
| `enhanced-damage`       | Enhanced Damage                           | offense    | `item_maxdamage_percent` (17), `item_mindamage_percent` (18), `item_maxdamage_percent_perlevel` (219)                                                                                                                                      | 1122  |
| `attack-rating`         | Attack Rating                             | offense    | `tohit` (19), `item_tohit_percent` (119), `item_tohit_perlevel` (224), `item_tohitpercent_perlevel` (225)                                                                                                                                  | 555   |
| `target-defense`        | -% Target Defense                         | offense    | `item_fractionaltargetac` (116)                                                                                                                                                                                                            | 144   |
| `ignore-target-defense` | Ignore Target's Defense                   | offense    | `item_ignoretargetac` (115)                                                                                                                                                                                                                | 54    |
| `enemy-resist`          | -% Enemy Resistance                       | offense    | `passive_fire_pierce` (333), `passive_ltng_pierce` (334), `passive_cold_pierce` (335), `passive_pois_pierce` (336), `passive_mag_pierce` (358), `passive_dmg_pierce` (366)                                                                 | 632   |
| `elemental-mastery`     | Elemental Spell Damage                    | offense    | `passive_fire_mastery` (329), `passive_ltng_mastery` (330), `passive_cold_mastery` (331), `passive_pois_mastery` (332), `passive_mag_mastery` (357)                                                                                        | 612   |
| `spell-damage`          | Magic, Physical and Summon Spell Damage   | offense    | `passive_mag2_mastery` (482), `passive_wind_mastery` (483), `passive_summ_mastery` (486)                                                                                                                                                   | 680   |
| `total-spell-damage`    | Total Spell Damage                        | offense    | `generictotalmultiplier` (398)                                                                                                                                                                                                             | 295   |
| `piercing-attack`       | Piercing Attack                           | offense    | `item_pierce` (156)                                                                                                                                                                                                                        | 91    |
| `slow-target`           | Slows Target                              | offense    | `item_slow` (150)                                                                                                                                                                                                                          | 104   |
| `freeze-target`         | Freezes Target                            | offense    | `item_freeze` (134)                                                                                                                                                                                                                        | 57    |
| `knockback`             | Knockback                                 | offense    | `item_knockback` (81)                                                                                                                                                                                                                      | 43    |
| `prevent-heal`          | Prevent Monster Heal                      | offense    | `item_preventheal` (117)                                                                                                                                                                                                                   | 0     |
| `reanimate`             | Reanimate As                              | offense    | `item_reanimate` (155)                                                                                                                                                                                                                     | 5     |
| `cast-on-strike`        | Chance to Cast on Striking / Attack       | procs      | `item_skillonhit` (198), `item_skillonattack` (195), `item_skillonhit_hidden` (405), `item_skillonattack_hidden` (404)                                                                                                                     | 2059  |
| `cast-when-struck`      | Chance to Cast when Struck                | procs      | `item_skillongethit` (201), `item_skillontakedmg` (376), `item_skillongethit_hidden` (415), `item_skillontakedmg_hidden` (377)                                                                                                             | 851   |
| `cast-on-kill`          | Chance to Cast on Kill / Death / Level-Up | procs      | `item_skillonkill` (196), `item_skillondeath` (197), `item_skillonlevelup` (199), `item_skillonkill_hidden` (378)                                                                                                                          | 549   |
| `cast-on-cast`          | Chance to Cast on Casting a Skill         | procs      | `item_skilloncast` (422), `item_skilloncast_hidden` (423)                                                                                                                                                                                  | 272   |
| `attacker-takes-damage` | Attacker Takes Damage                     | procs      | `item_attackertakesdamage` (78), `item_thorns_perlevel` (238), `item_attackertakeslightdamage` (128), `item_attackertakesfiredamage` (337), `item_attackertakescolddamage` (401), `thorns_percent` (131), `missile_thorns_percent` (208)   | 204   |
| `resist-fire`           | Fire Resist                               | defense    | `fireresist` (39), `item_resist_fire_perlevel` (231), `total_fire_resist` (391)                                                                                                                                                            | 952   |
| `resist-cold`           | Cold Resist                               | defense    | `coldresist` (43), `item_resist_cold_perlevel` (230), `total_cold_resist` (392)                                                                                                                                                            | 945   |
| `resist-lightning`      | Lightning Resist                          | defense    | `lightresist` (41), `item_resist_ltng_perlevel` (232), `total_lightning_resist` (393)                                                                                                                                                      | 941   |
| `resist-poison`         | Poison Resist                             | defense    | `poisonresist` (45), `item_resist_pois_perlevel` (233), `total_poison_resist` (394)                                                                                                                                                        | 881   |
| `max-resist`            | Maximum Resist                            | defense    | `maxfireresist` (40), `maxcoldresist` (44), `maxlightresist` (42), `maxpoisonresist` (46), `maxmagicresist` (38)                                                                                                                           | 756   |
| `physical-resist`       | Physical Resist                           | defense    | `damageresist` (36), `total_physical_resist` (427)                                                                                                                                                                                         | 472   |
| `magic-resist`          | Magic Resist                              | defense    | `magicresist` (37), `total_magic_resist` (400)                                                                                                                                                                                             | 254   |
| `damage-reduced`        | Damage Reduced                            | defense    | `normal_damage_reduction` (34)                                                                                                                                                                                                             | 566   |
| `magic-damage-reduced`  | Magic Damage Reduced                      | defense    | `magic_damage_reduction` (35)                                                                                                                                                                                                              | 457   |
| `absorb`                | Elemental Absorb                          | defense    | `item_absorbfire_percent` (142), `item_absorbfire` (143), `item_absorblight_percent` (144), `item_absorblight` (145), `item_absorbmagic_percent` (146), `item_absorbmagic` (147), `item_absorbcold_percent` (148), `item_absorbcold` (149) | 311   |
| `block`                 | Chance to Block                           | defense    | `toblock` (20)                                                                                                                                                                                                                             | 143   |
| `dodge`                 | Dodge, Avoid and Evade                    | defense    | `passive_dodge` (338), `passive_avoid` (339), `passive_evade` (340)                                                                                                                                                                        | 49    |
| `weapon-block`          | Weapon Block                              | defense    | `passive_weaponblock` (348)                                                                                                                                                                                                                | 0     |
| `cannot-be-frozen`      | Cannot Be Frozen                          | defense    | `item_cannotbefrozen` (153)                                                                                                                                                                                                                | 150   |
| `half-freeze`           | Half Freeze Duration                      | defense    | `item_halffreezeduration` (118)                                                                                                                                                                                                            | 9     |
| `poison-length`         | Poison Length Reduced                     | defense    | `item_poisonlengthresist` (110)                                                                                                                                                                                                            | 119   |
| `curse-resist`          | Curse Resistance                          | defense    | `curse_resistance` (109)                                                                                                                                                                                                                   | 69    |
| `damage-to-mana`        | Damage Taken Goes to Mana                 | defense    | `item_damagetomana` (114)                                                                                                                                                                                                                  | 43    |
| `ias`                   | Increased Attack Speed                    | speed      | `item_fasterattackrate` (93)                                                                                                                                                                                                               | 1565  |
| `fcr`                   | Faster Cast Rate                          | speed      | `item_fastercastrate` (105)                                                                                                                                                                                                                | 1203  |
| `fhr`                   | Faster Hit Recovery                       | speed      | `item_fastergethitrate` (99)                                                                                                                                                                                                               | 711   |
| `fbr`                   | Faster Block Rate                         | speed      | `item_fasterblockrate` (102)                                                                                                                                                                                                               | 519   |
| `frw`                   | Faster Run/Walk                           | speed      | `item_fastermovevelocity` (96)                                                                                                                                                                                                             | 863   |
| `life-after-kill`       | Life after each Kill                      | resources  | `item_healafterkill` (86), `item_healafterdemonkill` (139)                                                                                                                                                                                 | 317   |
| `mana-after-kill`       | Mana after each Kill                      | resources  | `item_manaafterkill` (138)                                                                                                                                                                                                                 | 328   |
| `on-striking`           | Life and Mana on Striking                 | resources  | `lifeonstriking` (505), `manaonstriking` (506)                                                                                                                                                                                             | 120   |
| `replenish-life`        | Replenish Life                            | resources  | `hpregen` (74)                                                                                                                                                                                                                             | 420   |
| `magic-find`            | Magic Find                                | find       | `item_magicbonus` (80), `item_find_magic_perlevel` (240)                                                                                                                                                                                   | 382   |
| `gold-find`             | Gold Find                                 | find       | `item_goldbonus` (79), `item_find_gold_perlevel` (239)                                                                                                                                                                                     | 296   |
| `extra-items`           | Increased Quantity of Items Found         | find       | `extra_items` (426)                                                                                                                                                                                                                        | 12    |
| `skill-cooldown`        | Skill Cooldown Reduction                  | skills     | `item_skill_cooldown` (371)                                                                                                                                                                                                                | 125   |
| `attribute-percent`     | % Bonus to Attributes                     | attributes | `strengthpercent` (255), `dexteritypercent` (256), `vitalitypercent` (257), `energypercent` (258)                                                                                                                                          | 559   |

ESR 3.2.24: 395 kinds, 58 key kinds, 337 generated.

### `facts`

Numbers with provenance. Each fact: `key`, `label`, `value` (a number, a boolean, a string list, `[Normal, Nightmare,
Hell]` or a record per class / target / setting), `vanilla` in the same shape when known, `unit`, `origin`
(`game-files`, `esr-config` or `vanilla-engine` = vanilla D2 behaviour from D2MOO, not confirmed for ESR), `source`
(`file` and the column or `section.key`) and an optional `note`.

| Key                                                                               | ESR 3.2.24                                                                                                          | Vanilla                                           | Source                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| `difficulty.ResistPenalty`                                                        | 1 / -80 / -150                                                                                                      | 0 / -40 / -100                                    | difficultylevels.txt                               |
| `difficulty.ResistPenaltyNonExpansion`                                            | 1 / -30 / -50                                                                                                       | 0 / -20 / -50                                     | difficultylevels.txt                               |
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
| `monstats.drainZero`                                                              | 647 / 648 / 648 of 1424 enabled monsters cannot be leeched                                                          | —                                                 | monstats.txt `Drain`, `Drain(N)`, `Drain(H)`       |
| `monstats.drainPartial`                                                           | 5 / 5 / 5 (Drain 1–99)                                                                                              | —                                                 | monstats.txt                                       |
| `crushingBlow.settings`                                                           | monster 50, champion 50, unique 25, super_unique 16, act_boss 16, minion 50, mercenary 50, player 50 (% of vanilla) | 100                                               | crushing-blow.toml `[targets]`                     |
| `crushingBlow.share`                                                              | 12.5 / 12.5 / 6.25 / 2 / 2 / 12.5 / 5 / 5 % of current life                                                         | 25 / 25 / 25 / 12.5 / 12.5 / 25 / 10 / 10         | derived: vanilla share × setting / 100             |
| `crushingBlow.ranged`, `.enabled`                                                 | 100 (ranged = melee), true                                                                                          | 50                                                | crushing-blow.toml `[attack] ranged`               |
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
key: the crushing-blow comments ("50 -> 12.5 % of current life.") are compared with the values.

Vanilla reference values (`build/data/vanillaReference.ts`): the vanilla D2R itemstatcost.txt names, ids and mechanic
columns, the difficultylevels.txt columns above and charstats.txt BlockFactor, from blizzhackers/d2data (MIT licence)
`json/` at its 2026-10-21 commit (D2R 3.x tables). Generated once by a script; regenerate by hand only if Blizzard
changes these tables.

## Calculators

`src/features/modifiers/utils/modifierMath.ts`, pure functions reading the `facts` (a missing fact throws), tested in
`modifierMath.test.ts` against the committed bundle:

- `effectiveLeech(leech, difficulty, 'life' | 'mana', facts, drain = 100)`: `exact` = leech / divisor × Drain / 100;
  `engine` = floor(leech × 64 / divisor) / 64 × Drain / 100 (D2MOO's precision).
- `effectiveMagicFind(mf, quality, facts)`: magic = MF; unique / set / rare = floor(dim × MF / (MF + dim)) +
  floor(MF × tail / 100).
- `hitChance(ar, def, facts, { vanilla?, levels? })` / `curveChance(ratio, curve)`: below the pivot 100 × r^s / (r^s +
  pivot^s), above 50 + 50 × d / (d + tail), the late tail blended in with a smoothstep weight between blendStart and
  blendEnd, floored to a whole percent, snapped to 100 at 99.5, then level scaling (vanilla only) and min / max. The test
  reproduces the config's own table; the vanilla curve gives 100 × AR / (AR + DEF) × 2 alvl / (alvl + dlvl), 5–95.
- `crushingBlow({ currentLife, target, ranged?, players?, physicalResist? }, facts)`: share = `crushingBlow.share`
  [target] (× ranged / 100 for missiles), divided by 1 + 50 % × (players − 1) against monsters (not mercenaries or
  players), × (100 − physical resist clamped to 0–100) / 100; damage = current life × share / 100.

## Content: `content/modifiers/`

The hand-checked explanations (written 2026-11-06 against ESR 3.2.24, then fact-checked: 28 factual fixes, 22
rewordings) are two markdown files, Prettier-formatted like the rest of the repo:

- `modifiers.md`: one block per explanation, `## <key> — <title>` followed by `stats:` (free text), `summary:`,
  `body:`, `facts:` (bullets, or inline; `facts (intro):` keeps the intro), `caveats:` (bullets or inline; "none…" = no
  caveats) and `sources:` (entries separated by "; "), blocks separated by `---`. Other headings (the file's "How to
  read" section) are skipped. Inline source tags after a claim: `[ESR config]`, `[ESR files]`, `[Vanilla]`,
  `[Community 3.9]` / `[Community 3.10]`, optionally with a detail after a comma (`[Vanilla, D2MOO SUnitDmg.cpp:1000]`,
  shown on hover). `` `code` ``, `**bold**`, `[text](url)` and bare URLs render too; any other `[…]` stays text.
- `open-questions.md`: numbered questions `N. **Title (Test)** — \`key\`, \`key\``(an optional`**(new)**` after the
  title is dropped) with indented lines; they show in the "Unconfirmed" note of each card they name.

Numbers are placeholders resolved against `facts` at render time (`utils/modifierPlaceholders.ts`):
`{difficulty.<normal|nightmare|hell|*>.<column>}` → `difficulty.<Column>`; `{charstats.<class|*>.<Column>}` →
`charstats.<Column>`; `{config.crushing-blow.targets.<t>}` → `crushingBlow.settings`; `{derived.crushing-blow.<t>}` →
the share with "%"; `{derived.leech.<life|mana>.<item %>.<difficulty>}` → `effectiveLeech(…).engine` with "%"; other
`{config.…}`, `{patch.…}`, `{monstats.…}` paths through `PLACEHOLDER_FACTS`; `{…key}` continues the previous
placeholder's path on the same line. An HTML comment right after a placeholder (the value when written) is dropped; any
other comment's text is kept as plain text. The quoted facts also become the card's fact tables.

The page imports both files as text (`src/features/modifiers/content.ts`, `?raw`, in the page chunk: 166 KB raw /
55 KB gzip with the parser and components) and parses them once (`utils/modifierContent.ts`).

**Content keys vs kinds** (`utils/modifierContentKinds.ts`, outside the markdown so a re-checked file replaces the old
one as it is): `CONTENT_KINDS` maps each content key to the bundle kinds it explains (the first gives the category
unless `category` is set); `KEY_KINDS_WITHOUT_TEXT` lists the key kinds that keep a generated entry (`replenish-life`,
`attribute-percent`); `KIND_FACTS` adds facts a kind's card always tabulates; `KIND_CALCULATORS` places the calculators.
48 content keys cover 56 of the 58 key kinds plus 21 generated kinds:

| Content key                                                                                                                                                                                                                                                                                                     | Kinds                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| same key (deadly-strike, critical-damage, crushing-blow, life-leech, mana-leech, on-striking, physical-resist, damage-reduced, magic-damage-reduced, poison-length, enemy-resist, absorb, enhanced-damage, knockback, damage-to-mana, ias, fcr, fhr, fbr, frw, dodge, magic-find, gold-find, elemental-mastery) | the kind of the same key                                                                                                        |
| `bleed`                                                                                                                                                                                                                                                                                                         | bleed, open-wounds                                                                                                              |
| `after-kill`                                                                                                                                                                                                                                                                                                    | life-after-kill, mana-after-kill                                                                                                |
| `resists`                                                                                                                                                                                                                                                                                                       | resist-fire, resist-cold, resist-lightning, resist-poison, magic-resist                                                         |
| `max-resists`                                                                                                                                                                                                                                                                                                   | max-resist                                                                                                                      |
| `attack-rating`                                                                                                                                                                                                                                                                                                 | attack-rating, stat-item-demon-tohit, stat-item-undead-tohit                                                                    |
| `target-defense`                                                                                                                                                                                                                                                                                                | target-defense, ignore-target-defense, stat-item-damagetargetac                                                                 |
| `cannot-be-frozen`                                                                                                                                                                                                                                                                                              | cannot-be-frozen, half-freeze                                                                                                   |
| `slow` / `freeze` / `thorns` / `pierce` / `curse-resistance` / `item-quantity` / `cooldown-reduction`                                                                                                                                                                                                           | slow-target / freeze-target / attacker-takes-damage / piercing-attack / curse-resist / extra-items / skill-cooldown             |
| `chance-to-cast`                                                                                                                                                                                                                                                                                                | cast-on-strike, cast-when-struck, cast-on-kill, cast-on-cast                                                                    |
| `reanimate`                                                                                                                                                                                                                                                                                                     | reanimate, stat-item-restinpeace                                                                                                |
| `block`                                                                                                                                                                                                                                                                                                         | block, weapon-block                                                                                                             |
| `spell-damage`                                                                                                                                                                                                                                                                                                  | spell-damage, total-spell-damage                                                                                                |
| `summon-stats` (category skills)                                                                                                                                                                                                                                                                                | stat-passive-summ-mastery-total, -summ-life, -summ-elemental-resist, -summ-phys-resist, -summ-limit, stat-summonexceedcap       |
| `skills`                                                                                                                                                                                                                                                                                                        | stat-item-allskills, -addclassskills, -addskill-tab, -singleskill, -nonclassskill, -nonclassskill-display                       |
| `experience` / `light-radius` / `requirements` / `rare-procs`                                                                                                                                                                                                                                                   | stat-item-addexperience / stat-item-lightradius / stat-item-req-percent, stat-item-levelreq / prevent-heal, stat-item-stupidity |

`modifierContent.test.ts` fails when the committed content does not parse, a placeholder resolves to nothing, a
content key has no mapping (or a mapping no content), a mapped kind is missing from the bundle or claimed twice, a key
kind has neither text nor a `KEY_KINDS_WITHOUT_TEXT` entry, `KIND_FACTS` / `KIND_CALCULATORS` name an unknown kind or
fact, or an open question names an unknown content key.

**Updating the text** (after an ESR release, or a new fact-check): replace `content/modifiers/modifiers.md` /
`open-questions.md`, run `npx prettier --write content/modifiers` and `npx vitest run src/features/modifiers`. A
renamed or new content key needs its `CONTENT_KINDS` line; a new placeholder path that is not a rule above needs a
`PLACEHOLDER_FACTS` line (and its fact in the builder when the bundle lacks it). A changed fact needs no text edit for
the placeholder itself, but the prose around it and the hard-coded numbers in `facts:` / `open-questions.md` must be
re-read (`.claude/skills/esr-update/reference.md` "Modifiers").

## Page: `/modifiers`

Database menu entry, home Database card chip, lazy route (`src/features/modifiers/`), a static-bundle route (no HTM
gate), in the sitemap and the guide's `page:` targets. The model is `utils/modifiersView.ts` (`buildModifiersView`):
one entry per content block, then one generated entry per remaining kind, ordered by category (offense, defense,
speed, procs, resources "Life and mana", find, skills, attributes, other), hand-written and key entries first, then the
bundle's order. A generated title that is only a stat name or a stray word ("to") falls back to the stat's display text.

- **List**: intro, source-badge legend, search (`EnhanceSearch`; every word or "quoted phrase" must occur in the
  titles, summary, body or the stats' display texts and names, like the Skills search), category pills with counts,
  "Key modifiers" (hand-written and key kinds: 50 entries) / "All stats" (366), Copy Link. A card shows the title, the
  summary (or the stat's display text), the category, "ESR only" / "Changed in ESR" / "Technical" chips and the item
  count; "N more in All stats" switches the view.
- **Focused card** (`?kind=`): the explanation with an inline source badge after each claim (short label, the full
  meaning and the tag detail on hover; Vanilla is dashed muted amber: "Vanilla D2 behaviour, not confirmed for ESR"),
  an "Unconfirmed" note (caveats and the open questions naming the card), the calculators, **Numbers** (fact tables:
  per difficulty, per class / target / setting, single settings; ESR next to vanilla, the origin badge, file and key,
  the fact note), **Stats** (display texts, stat name and id, vanilla / changed / ESR-only with `reusesId`, op formula,
  item events, usage per item list), **Found on** (up to 12 examples linked to their focused pages: uniques or
  mythicals, sets, runewords, gemwords, socketables `?name=`, affixes `?search="…"`; superior mods and cube recipes are
  plain text), "Technical details" (the `facts:` bullets) and **Sources** (ESR paths → the ESR GitHub repo, D2MOO paths
  → D2MOO at 4a60fca, wiki names → the unofficial wiki, URLs; `scratchpad/` research files are left out).
- **URL** (`readModifiersState` / `encodeModifiersState`, defaults omitted): `kind` (an entry key or any kind key, which
  resolves to its entry: `?kind=resist-cold` opens `resists`), `category`, `search`, `view=all`. The home search lists
  every kind title (not bookkeeping-only kinds or stat-name titles) and links `/modifiers?kind=<kind key>`.
- **Calculators** (`components/Calculators.tsx`, rows from `utils/calculatorViews.ts`, all numbers from the facts; the
  vanilla columns run the same formulas on the facts' `vanilla` values): leech (life / mana, item %, target Drain →
  divisor, exact, engine 1/64 %, per 1000 damage, vanilla; the smallest item leech that is not 0 in Hell; the rounding
  caveat), Magic Find (per quality: ESR effective MF, the tail's part, vanilla, the diminishing constant), hit chance
  (AR and defense → ratio, ESR, vanilla at equal levels, the AR needed for 50 / 75 / 90 / 95 %), Crushing Blow (current
  life, physical resist, /players, melee / ranged → share and life removed per target class, vanilla). Local state, not
  in the URL.

Mobile: one column at 375 px without horizontal page scroll; wide tables scroll inside their box.

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
  Unconfirmed for D2R; verify in game. The calculator shows both `exact` and `engine`.
- **Crushing Blow vs uniques**: crushing-blow.toml says `unique = 25` under the comment "50 -> 12.5 % of current life";
  25 gives 6.25 %. The bundle keeps the value (what the plugin reads), the fact note quotes the comment and the
  generator warns. Ask the mod author which is intended.
- **Hit chance blend**: the config only says the late tail is "blended in smoothly". A smoothstep weight reproduces the
  author's table (a linear blend misses r = 80 by one); blending the tail value instead of the chance also fits.
- **Magic Find tail rounding**: the config gives MF × tail / 100; the calculator floors it like the engine's integer
  maths. Unverified.
- **monstats Drain**: 647 of 1424 enabled monsters have Drain 0 / blank in Normal (the research notes counted 566 with
  another filter); the fact counts enabled rows with an `Id`.
- **Crushing Blow per-player division** uses the vanilla +50 % life per extra player; `player-count-halving-removal.json`
  is about drops, not life, so it is assumed unchanged.
- Vanilla engine facts (`vanilla-engine`) come from D2MOO (1.10f / 1.14d); D2R may differ.

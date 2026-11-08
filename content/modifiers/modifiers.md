# Item modifier explanations (ESR 3.3)

The format, source tags and placeholders are documented in docs/features/MODIFIERS.md "Content".

---

## deadly-strike — Deadly Strike

stats: item_deadlystrike (141), item_deadlystrike_perlevel (250); resolved in one block with the weapon-mastery Critical and the engine's Critical Strike stat (the loader config calls it passive_critical_strike, stat 337, but ESR's itemstatcost.txt row 337 is item_attackertakesfiredamage and no row is named passive_critical_strike)

summary: A chance per hit to multiply the hit's physical damage, ×{derived.critical-multiplier.0} by default and more with Deadly Strike Damage.

body: Each hit rolls against your total Deadly Strike. On success the physical damage is multiplied by {config.critical-strike-damage.critical_strike_damage.base_percent}<!-- 200 -->% plus your Deadly Strike Damage, for melee and missiles alike [ESR config] [Mod author]. Weapon-mastery Critical, Critical Strike and Deadly Strike are resolved in that order and only one can succeed, so they never multiply each other [ESR config]. Fire thorns, which ESR keeps in the vanilla Critical Strike stat's row, give no crit chance [Mod author]. Only physical damage is multiplied [Vanilla]. Physical damage that a skill converts to an element can still crit [Community 3.9]. At 100% every hit crits [Vanilla]. Two unique weapons, Demon Limb and Lacerator, give extra bonuses for each 1% Deadly Strike above 100, so going past 100 pays on those [ESR files]. D-stoning raises Deadly Strike against its own cap, which counts only what the stones added: a 50% Deadly Strike item can be D-stoned to 150% [Mod author] [ESR files]. A few uniques (Voidrend, Dwarf Star, Earthshifter, Gargoyle's Bite, Icing Death, Raven Frost) carry hidden auras that use your Deadly Strike as the chance for one element's damage to crit, boosted by Deadly Strike Damage [ESR files]. Without such an aura, item Deadly Strike does not make spells crit [Mod author].

facts:

- Multiplier = `{config.critical-strike-damage.critical_strike_damage.base_percent}`<!-- 200 --> + Deadly Strike Damage (stat 434), in percent; ceiling `{config.critical-strike-damage.critical_strike_damage.max_percent}`<!-- 100000 -->%. Source: `ESR/d2rloader/config/celestialrayone.critical-strike-damage.toml` `[critical_strike_damage]`.
- `apply_to_deadly_strike`, `apply_to_critical_strike`, `apply_to_weapon_mastery`, `apply_to_missiles` are all `true` (same file).
- Roll order and exclusivity: weapon mastery → critical strike → deadly strike, each only if the previous failed (same file, lines 24–28: "mutually exclusive and resolved in the order weapon mastery -> critical strike -> deadly strike"; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:326–352 [Vanilla]). Combined chance = 1 − (1−a)(1−b)(1−c).
- Roll: `rand % 100 < chance` [Vanilla, D2MOO SUnitDmg.cpp:330, 340, 348].
- Critical Strike (`passive_critical_strike`): the mod author (2026-11-07) says the game gates such hard-coded stats by name and ESR replaced this one with a custom stat, so a fire-thorns item (row 337) gives no crit chance.
- "Over the cap" formulas subtract 100: `excel/skills.txt` "Demon Limb Aura" aurastatcalc1–6 `…max(0,(stat('item_deadlystrike'.accr)+stat('passive_mastery_melee_crit'.accr)-100))…`; "Lacerator Aura" aurastatcalc1 (deadly strike − 100) and aurastatcalc2 (+ throw crit − 100). Since ESR 3.3 both use `max(0, …)` (was `max(1, …)`) and multiply by 1.1 for each of the Blacksmith perks `blacksmithing_1` and `blacksmithing_9` (Tempered Steel and One's Favorite, `docs/specializations.htm`). Both are unique weapons (`excel/uniqueitems.txt` Demonlimb, Lacerator; `docs/unique_weapons.htm`), not mythicals.
- Element crit auras: `excel/skills.txt` "Magic/Fire/Cold/Lightning/Poison Damage Crit" calc1 `stat('randomgenerator'.accr)>(1000-stat('item_deadlystrike'.accr)*10)`; granted as `aura-hidden` by the uniques named above (`excel/uniqueitems.txt`). aurastatcalc1 since ESR 3.3: Fire `(100+stat('total_elemental_min_damage'.accr)+stat('total_fire_damage'.accr))*(100+stat('criticaldamage'.accr))/100` (Cold the same with `total_cold_damage`, Lightning with `total_elemental_min_damage` only, Poison with `total_poison_magic_min_damage`), × 1.1 with the Blacksmith perk `blacksmithing_9`; the element mastery factor `(100+mastery)/100` of ESR 3.2 is gone. Magic keeps `(100+stat('criticaldamage'.accr))*(100+stat('passive_mag2_mastery'.accr))/100`. Patch 3.3: element crits "no longer double dip on spell damage", and every element can crit at any Deadly Strike value (`ESR/patchnotes/3.3.md`, Items).
- `excel/itemstatcost.txt` also has `item_deadlystrike_cap` (605, no tooltip, property `deadly-cap`). The D-stoning rows `excel/cubemain.txt` "HS + Any Weapon + key", "DS + Any Amulet", "DS + Any Ring" add it together with Deadly Strike (+3 each) and apply only while it is at most 99 (op 16). The mod author (2026-11-07): it separates the Deadly Strike already on the item from what D-stoning gives, so a 50% item can be stoned to 150% instead of capping at 100%.
- Tooltip `%+d%% Deadly Strike` (`excel/itemstatcost.txt` row 141 descstrpos ModStr5q, `strings/item-modifiers.json`).

caveats:

- D2MOO is 1.10/1.14 code; the roll order is confirmed for ESR only by the plugin comment, not by a test.
- No ESR skills.txt row grants `passive_mastery_melee_crit` (344) or `passive_mastery_throw_crit` (347) as a passivestat/aurastat; where weapon-mastery crit comes from in ESR is unclear (the question to the mod author needs rephrasing, open-questions.md).

sources: `ESR/d2rloader/config/celestialrayone.critical-strike-damage.toml`; `excel/skills.txt` (Demon Limb Aura, Lacerator Aura, Gimmershred Aura, * Damage Crit); `excel/uniqueitems.txt`; `strings/item-modifiers.json` (demonlimbdesc, laceratordesc); `ESR/patchnotes/3.3.md`; `ESR/docs/specializations.htm`; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp; ESR mod author (Discord, 2026-11-07); wiki "Q&A With the Mod Creator"; https://maxroll.gg/d2/resources/attack-modifiers

---

## critical-damage — Deadly Strike Damage

stats: criticaldamage (434)

summary: Raises the damage multiplier of every crit and Deadly Strike: +50% turns ×{derived.critical-multiplier.0} into ×{derived.critical-multiplier.50}.

body: ESR-only stat. It adds straight to the base crit multiplier of {config.critical-strike-damage.critical_strike_damage.base_percent}<!-- 200 -->%, so +50% Deadly Strike Damage makes each crit deal ×{derived.critical-multiplier.50} physical damage instead of ×{derived.critical-multiplier.0} [ESR config]. The mod author confirmed the addition: with 100% Deadly Strike and +25% Deadly Strike Damage, each crit adds 125% extra physical damage instead of 100%, a ×{derived.critical-multiplier.25} hit [Mod author]. It works for weapon-mastery crits, Critical Strike and Deadly Strike, melee and missiles [ESR config]. It does nothing on its own: you still need a crit chance. It is rare on items [ESR files]. Some skills and auras also read it for their own crit bonuses, for example the "Magic Damage Crit" rows [ESR files].

facts:

- Stat id `{config.critical-strike-damage.critical_strike_damage.stat_id}`<!-- 434 -->; added to `base_percent = {…base_percent}`<!-- 200 -->; cap `max_percent = {…max_percent}`<!-- 100000 -->. Source: `ESR/d2rloader/config/celestialrayone.critical-strike-damage.toml`.
- Missiles: "the bonus is used when any of [the three sources] is enabled", because missiles only carry a yes/no crit flag (same file).
- Tooltip `+%d%% Deadly Strike Damage` (`strings/item-modifiers.json` key `critdamage`).
- The mod author (2026-11-07), asked whether +25% Deadly Strike Damage at 100% Deadly Strike raises the extra double damage to 125%: "125% yes".

caveats:

- Whether skill-side crits (Magic Damage Crit and similar) add the item stat once or twice is a skill-formula question; check per skill.

sources: `ESR/d2rloader/config/celestialrayone.critical-strike-damage.toml`; `excel/itemstatcost.txt` row 434; `excel/skills.txt` ("Magic Damage Crit" aurastatcalc1); `strings/item-modifiers.json`; ESR mod author (Discord, 2026-11-07)

---

## crushing-blow — Crushing Blow

stats: item_crushingblow (136), item_crushingblow_perlevel (247), crushingblow_damage (1045)

summary: A chance on hit to remove a share of the target's current life. ESR halves it against most targets and cuts it hardest against bosses.

body: When a hit lands, Crushing Blow rolls its chance. On success the target loses a share of its current life, not maximum life, so it is best early in a fight [Vanilla]. ESR scales that share per target class. Normal monsters, champions and minions lose {derived.crushing-blow.monster}<!-- 12.5% = 25% x config 50 -->, yellow uniques {derived.crushing-blow.unique}<!-- 6.25% = 25% x config 25 -->, superuniques and act bosses {derived.crushing-blow.super_unique}<!-- 2% = 12.5% x config 16 -->, players and mercenaries {derived.crushing-blow.player}<!-- 5% = 10% x config 50 --> [ESR config]. Vanilla removes {vanilla.derived.crushing-blow.monster}, {vanilla.derived.crushing-blow.super_unique} and {vanilla.derived.crushing-blow.player} for those groups, so every class is at half or less [ESR config]. Since 3.3 heralds count as act bosses [ESR config]. "+% Crushing Blow Damage" raises the share against every class: +25% multiplies each share by 1.25 [ESR config]. Ranged Crushing Blow is as strong as melee; vanilla halves it [ESR config]. The /players setting still weakens it against monsters, and the target's physical resist reduces it [ESR config]. Flat Damage Reduced does not [Vanilla]. Physical resist above 50% helps against monster Crushing Blow [Community 3.9].

facts (share of current life = vanilla share × config percent):

- Normal monster: {vanilla.derived.crushing-blow.monster} × `{config.crushing-blow.targets.monster}`<!-- 50 -->% = {derived.crushing-blow.monster}.
- Champion: {vanilla.derived.crushing-blow.champion} × `{config.crushing-blow.targets.champion}`<!-- 50 -->% = {derived.crushing-blow.champion}.
- Unique (yellow): {vanilla.derived.crushing-blow.unique} × `{config.crushing-blow.targets.unique}`<!-- 25 -->% = **{derived.crushing-blow.unique}**.
- Superunique: {vanilla.derived.crushing-blow.super_unique} × `{config.crushing-blow.targets.super_unique}`<!-- 16 -->% = {derived.crushing-blow.super_unique}.
- Act boss (monstats boss flag): {vanilla.derived.crushing-blow.act_boss} × `{config.crushing-blow.targets.act_boss}`<!-- 16 -->% = {derived.crushing-blow.act_boss}.
- Minion of a pack leader: {vanilla.derived.crushing-blow.minion} × `{config.crushing-blow.targets.minion}`<!-- 50 -->% = {derived.crushing-blow.minion}.
- Mercenary: {vanilla.derived.crushing-blow.mercenary} × `{config.crushing-blow.targets.mercenary}`<!-- 50 -->% = {derived.crushing-blow.mercenary}. Player: {vanilla.derived.crushing-blow.player} × `{config.crushing-blow.targets.player}`<!-- 50 -->% = {derived.crushing-blow.player}.
- Ranged: `{config.crushing-blow.attack.ranged}`<!-- 100 -->% of the melee result (vanilla {vanilla.config.crushing-blow.attack.ranged}).
- Classes do not stack; matched in order mercenary → act_boss → super_unique → unique → champion → minion → monster (same file).
- /players: divisor grows by the monster HP bonus, 0/50/100…350% for 1–8 players, so at /players 8 the share is ÷4.5 [Vanilla, D2MOO D2Game/src/MONSTER/Monster.cpp:431–441; SKILLITEM_EventFunc16 SkillItem.cpp:1399–1440]. Players and hirelings are not divided by /players.
- Physical resist: `loss −= loss × min(damageresist,100)/100`, using the raw stat, not the 50% capped value [Vanilla, SkillItem.cpp:1449–1458]; kept per the config ("Physical damage reduction on the target still reduces the result").
- Effectiveness: `[effectiveness] stat_id = 1045` (`crushingblow_damage`, "+%d%% Crushing Blow Damage"): the share × (100 + value) / 100, read from the unit that landed the hit (a summon or hireling uses its own value); −100 or lower turns Crushing Blow off (same file).
- Heralds: `ESR/d2rloader/config/celestialrayone.herald-bosses.toml` `herald_boss = true` ("Crushing Blow and difficultylevels.txt PetDamagePercentVSBoss treat them as bosses").
- Procs on `domeleedamage` and `domissiledamage`, func 16 (`excel/itemstatcost.txt` row 136).

caveats:

- Whether a Crushing Blow hit can kill a boss outright at low life is not confirmed for ESR.

sources: `ESR/d2rloader/config/celestialrayone.crushing-blow.toml`; `ESR/d2rloader/config/celestialrayone.herald-bosses.toml`; `excel/itemstatcost.txt` rows 136, 1045; D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1399–1482; D2MOO/D2Game/src/MONSTER/Monster.cpp:431; wiki "Physical Resist X% / Damage Reduced by X%"; https://maxroll.gg/d2/resources/attack-modifiers

---

## bleed — Bleed

stats: bleedmindam (435), bleedmaxdam (436), bleedlength (437); item_openwounds (135) note

summary: Physical hits make the target lose a percent of that hit's physical damage over a few seconds, like poison.

body: ESR's own damage-over-time stat, ported from its D2R 2.4 bleed system [ESR config]; it takes the place Open Wounds has in vanilla. The item shows one line: "Adds X%-Y% Bleed Damage over N seconds" [ESR files]. A hit that still deals physical damage after the target's damage reduction and absorb rolls a percent between your minimum and maximum. The target then loses that percent of the hit's physical damage, spread evenly over the bleed length [ESR config]. A stronger bleed replaces a weaker one; an equal one only refreshes it; a weaker one is ignored. Bleed and poison stack [ESR config]. Lengths from several items are averaged, not added [ESR config]. Bleeds end when a monster turns immune to every damage type, such as a boss in an invulnerable phase [ESR config]. Open Wounds is on no spawnable ESR item and has no proc [ESR files].

facts:

- Stats `{config.bleed.bleed.min_damage_stat}`<!-- 435 -->, `{config.bleed.bleed.max_damage_stat}`<!-- 436 -->, `{config.bleed.bleed.length_stat}`<!-- 437 --> (frames, 25 per second). Source `ESR/d2rloader/config/celestialrayone.bleed.toml`.
- Total = physical × percent / 100; per frame = physical × percent / (100 × averaged length), rounded down. Example from the file: 100 physical, 100%, 100 frames = 1 life per frame for 4 seconds.
- Averaged length = total length / number of sources carrying a length ("two items with 100 frames each give an average of 100, not 200").
- Applied as negative life regeneration (stat 74) on state `{config.bleed.bleed.state_id}`<!-- 62, openwounds -->.
- Tooltip `strModBleedDamageRange` = "Adds %d%%-%d%% Bleed Damage over %d seconds" (`strings/item-modifiers.json`); length shown as length / 25.
- Immunity clear: `ESR/d2rloader/config/celestialrayone.immunity-dot-clear.toml`, `immune_to` = all six types.
- Open Wounds: `excel/itemstatcost.txt` row 135 has empty itemevent1/2 and itemeventfunc (vanilla: domeleedamage/domissiledamage func 15).

caveats:

- Bleed counts as physical damage for the hit only; once applied it is life regeneration, so it ignores physical resist after the hit (by the config's own wording). Whether physical resist reduces the base hit used for the bleed: yes, it uses damage after DR and absorb, but check whether "after DR" includes % physical resist.
- Bleed shares state 62 with Open Wounds; harmless while no item has Open Wounds.

sources: `ESR/d2rloader/config/celestialrayone.bleed.toml`; `ESR/d2rloader/config/celestialrayone.immunity-dot-clear.toml`; `excel/itemstatcost.txt` rows 135, 435–437; `strings/item-modifiers.json`

---

## life-leech — Physical Damage Leeched as Life

stats: lifedrainmindam (60), lifedrainmaxdam (61)

summary: Heals you for a percent of the physical damage you deal; divided by {difficulty.nightmare.lifeStealDivisor} in Nightmare and {difficulty.hell.lifeStealDivisor} in Hell.

body: ESR calls Life Steal "Physical Damage Leeched as Life" [ESR files]. Each hit heals you for a percent of the physical damage it dealt after the target's defences, up to the target's remaining life [Vanilla]. Only physical damage that comes through your weapon damage leeches: elemental damage does not, and neither does the damage of skills that do not use your weapon damage [Mod author]. In Nightmare your leech is divided by {difficulty.nightmare.lifeStealDivisor}<!-- 25 -->, in Hell by {difficulty.hell.lifeStealDivisor}<!-- 150 --> [ESR files]. So 20% leech is about {derived.leech.life.20.nightmare}<!-- 0.8% --> in Nightmare and about {derived.leech.life.20.hell}<!-- 0.125% --> in Hell [ESR files] [Vanilla]. The mod author expects D2R to keep such fractions rather than round them to 0 [Mod author]. Some monsters cannot be leeched at all: in Hell {monstats.drainH.blankCount} enabled monster rows have no drain value, most of them skeleton-type monsters, plus constructs, wisps, swarms, wraiths and town NPCs [ESR files]. In Hell, plan on Life on Striking, Life after each Kill and regeneration instead.

facts:

- `{difficulty.normal.lifeStealDivisor}`<!-- 1 --> / `{difficulty.nightmare.lifeStealDivisor}`<!-- 25 --> / `{difficulty.hell.lifeStealDivisor}`<!-- 150 --> (`excel/difficultylevels.txt` LifeStealDivisor; vanilla {vanilla.difficulty.*.lifeStealDivisor}).
- Engine math [Vanilla, D2MOO D2Game/src/UNIT/SUnitDmg.cpp:1163–1243]: `leech64 = (leech << 6) / divisor` (integer), `gain = physDealt × leech64/100 × Drain/100 / 64`. With that precision: 10% → {derived.leech.life.10.nightmare} NM, {derived.leech.life.10.hell} Hell; 20% → {derived.leech.life.20.nightmare} NM, {derived.leech.life.20.hell} Hell; 75% → {derived.leech.life.75.nightmare} NM, {derived.leech.life.75.hell} Hell. Item leech below divisor / 64 = {derived.leech-threshold.life.hell} gives 0 in Hell.
- The divisor is applied only when the attacker is a player (SUnitDmg.cpp:1186–1199); a hireling's leech is not divided in the 1.10 code [Vanilla].
- Monster drain: `excel/monstats.txt` Drain / Drain(N) / Drain(H); players count as 100. In Hell, enabled rows: {monstats.drainH.blankCount} blank (no leech), most of them MonType `skeleton`; {monstats.drainH.partialCount} at 10 (Corrupted Zakarum); the rest at 100.
- ESR's damage-overflow-fix repairs leech that wrapped negative at very high damage (`ESR/d2rloader/config/celestialrayone.damage-overflow-fix.toml`, `leech = true`). That config describes the D2R leech sum as "physical + fire + lightning + cold + magic" (line 325); the mod author (2026-11-07): leech uses only physical damage, and only damage that goes through `srcdam` (weapon damage).
- Precision: the mod author (2026-11-07) is "pretty sure D2R keeps fractional leech, otherwise this would have been a problem in vanilla too", assuming the game divides the heal due after the damage is applied.
- Tooltip `%+d%% Physical Damage Leeched as Life` (`strings/item-modifiers.json` ModStr2z).

caveats:

- Fractional leech in D2R is the mod author's assumption, not a test. Some guides (Maxroll) say leech under 1% after reductions rounds to 0; if D2R did that, all item leech below {difficulty.hell.lifeStealDivisor}% would do nothing in Hell.
- Whether a hireling's leech is divided in Nightmare and Hell is unconfirmed; the mod author did not know (open-questions.md).

sources: `excel/difficultylevels.txt`; `excel/monstats.txt`; `ESR/d2rloader/config/celestialrayone.damage-overflow-fix.toml` ("Life and mana steal (3 sites)"); ESR mod author (Discord, 2026-11-07); D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:560–580, 1163–1296; wiki "Penalties based on Difficulty" (v3.9.15); https://maxroll.gg/d2/resources/attack-modifiers

---

## mana-leech — Physical Damage Leeched as Mana

stats: manadrainmindam (62), manadrainmaxdam (63)

summary: Restores mana from a percent of the physical damage you deal; divided by {difficulty.nightmare.manaStealDivisor} in Nightmare and {difficulty.hell.manaStealDivisor} in Hell.

body: Works like life leech but fills mana [Vanilla]. Only physical damage that comes through your weapon damage leeches [Mod author]. The difficulty divisors are smaller than for life: {difficulty.nightmare.manaStealDivisor}<!-- 15 --> in Nightmare and {difficulty.hell.manaStealDivisor}<!-- 75 --> in Hell [ESR files]. So 10% mana leech is about {derived.leech.mana.10.nightmare}<!-- 0.656% --> in Nightmare and about {derived.leech.mana.10.hell}<!-- 0.125% --> in Hell [ESR files] [Vanilla]. The same monsters that cannot be life-leeched cannot be mana-leeched [ESR files]. Casters who do not hit things get nothing from it. For mana in Hell, Mana on Striking, Mana after each Kill, Damage Taken Goes to Mana and mana regeneration are steadier.

facts:

- `{difficulty.normal.manaStealDivisor}`<!-- 1 --> / `{difficulty.nightmare.manaStealDivisor}`<!-- 15 --> / `{difficulty.hell.manaStealDivisor}`<!-- 75 --> (`excel/difficultylevels.txt` ManaStealDivisor; vanilla {vanilla.difficulty.*.manaStealDivisor}).
- Same 1/64 math as life leech [Vanilla, D2MOO SUnitDmg.cpp:1163–1243]: 10% → floor(640 / divisor) / 64 = {derived.leech.mana.10.nightmare} NM, {derived.leech.mana.10.hell} Hell. Item leech below divisor / 64 = {derived.leech-threshold.mana.hell} gives 0 in Hell.
- Drain columns as in `life-leech`.
- Tooltip `%+d%% Physical Damage Leeched as Mana` (ModStr2y).

caveats:

- Same precision assumption as `life-leech`.

sources: `excel/difficultylevels.txt`; `excel/monstats.txt`; ESR mod author (Discord, 2026-11-07); D2MOO/D2Game/src/UNIT/SUnitDmg.cpp; wiki "Penalties based on Difficulty" (v3.9.15)

---

## on-striking — Life / Mana on Striking

stats: lifeonstriking (505), manaonstriking (506)

summary: A flat amount of life or mana each time your attack hits, melee or ranged. No difficulty penalty.

body: ESR-only stats [ESR files]. Each successful melee or missile hit restores the flat amount shown [ESR files]. Unlike leech, nothing in the difficulty table reduces them [ESR files], and the amount does not depend on how much damage you deal [Vanilla]. They reuse the engine functions of Life and Mana after each Kill, so they are capped at your maximum and need a target [Vanilla]. In that code the mana function only works for players, so Mana on Striking likely does nothing on a mercenary [Vanilla]. That makes them one of the best ways to sustain in Hell for fast attackers: more hits per second means more life.

facts:

- `excel/itemstatcost.txt` row 505 `itemevent1 = domeleedamage`, `itemeventfunc1 = 28`, `itemevent2 = domissiledamage`, `itemeventfunc2 = 28`; row 506 the same with func 17.
- Func 28 = heal after kill, func 17 = mana after kill (D2MOO/D2Game/src/SKILLS/Skills.cpp:4248, 4259 event table; bodies SkillItem.cpp:1486, 1520) [Vanilla]. Func 17 checks `pAttacker->dwUnitType == UNIT_PLAYER`; func 28 has no such check. Both only add while the unit is below its maximum.
- Tooltip "Life on Striking" / "Mana on Striking" with descfunc 1 (number before the text).

caveats:

- Whether a hit on a monster that cannot be leeched (Drain 0) still gives life on striking: by the code it should, since it does not read Drain. Check in game.
- Whether splash or multi-target hits restore once per target.

sources: `excel/itemstatcost.txt` rows 505, 506; D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1486–1550

---

## after-kill — Life / Mana after each Kill

stats: item_healafterkill (86), item_healafterdemonkill (139), item_manaafterkill (138)

summary: Restores a flat amount of life or mana whenever you kill a monster.

body: A flat refill on every kill, capped at your maximum [Vanilla]. It does not scale with difficulty [ESR files]. In ESR, kills by physical thorns (Attacker Takes Damage), Holy Fire, Holy Shock, Holy Freeze and Iron Maiden now count as your kills, so they refill too [ESR config]. Mana after each Kill only works for players in the 1.10 code [Vanilla]. Whether kills by your summons or by damage over time count follows the game's kill credit [Vanilla]. Good on fast-clearing builds; weak against single bosses.

facts:

- `excel/itemstatcost.txt` row 86 `itemevent1 = kill`, func 28; row 138 `kill`, func 17.
- Thorns kill credit: `ESR/d2rloader/config/celestialrayone.soft-hit-removal.toml` `attacker_takes_damage = true` (event function 6 only: stat 78 and the thorns aura); also `holy_fire_and_holy_shock`, `holy_freeze`, `iron_maiden = true`. Lightning thorns (func 10) and fire thorns (func 11) are not listed; `thorns_percent = false`.

caveats:

- Kills by minions and poison: which of them fire the kill event for the owner is not documented for ESR.

sources: `excel/itemstatcost.txt` rows 86, 138; `ESR/d2rloader/config/celestialrayone.soft-hit-removal.toml`; D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1486, 1520

---

## physical-resist — Physical Resist (Damage Reduced by %)

stats: damageresist (36), total_physical_resist (427)

summary: Cuts physical damage you take by a percent, capped at {engine.resist.physical-cap}%. Also shrinks Crushing Blow against you.

body: The ESR tooltip says "Physical Resist: +X%" [ESR files]. It is the same stat as vanilla "Damage Reduced by X%" [ESR files] [Community 3.9, author]. It caps at 50% for players and hirelings [Vanilla], and ESR applies the same cap to your summons [ESR config]. There is no difficulty penalty on it [Vanilla]. Stacking above 50% is not wasted: monster debuffs such as Amplify Damage lower it first [Community 3.9], and Crushing Blow against you is reduced by your uncapped value [Vanilla]. Flat "Damage Reduced by N" is subtracted before this percent [Vanilla].

facts:

- Same stat id 36 (damageresist) as vanilla; ESR only changed the tooltip string (vanilla ModStr2uPercent → ESR `bonusphysicalresist`, `excel/itemstatcost.txt` row 36).
- Cap 50 for players and hirelings [Vanilla, D2MOO D2Game/src/UNIT/SUnitDmg.cpp:996–1009]; the floor patch names "the physical cap operand at 0x4524D6 (50)" as untouched [ESR config].
- Summons: `ESR/d2rloader/config/celestialrayone.summon-resist-cap.toml` "physical = 50"; "The 75 base, the 95 ceiling and the 50 physical cap are the game's own immediates" (not a setting).
- Floor: `{patch.esr-resistance-floor-minus-1000.floor}`<!-- -1000 --> for all units; the physical cap 50 is left untouched (`ESR/d2rloader/patches/esr-resistance-floor-minus-1000.json`).
- Crushing Blow: reduced by `min(damageresist, 100)` (raw stat) [Vanilla, SkillItem.cpp:1399–1482].
- Tooltip `Physical Resist: %+d%%` (row 36).
- Sanctuary: an attacker with Sanctuary treats an undead monster's physical resist as 0 (immunity-dot-clear.toml lines 14–16; D2MOO SUnitDmg.cpp:1012). Not relevant to your own physical resist.

caveats:

- Whether monster curses lower your physical resist from the raw total or from the capped value is assumed vanilla.

sources: `excel/itemstatcost.txt` row 36; `ESR/d2rloader/config/celestialrayone.summon-resist-cap.toml`; `ESR/d2rloader/patches/esr-resistance-floor-minus-1000.json`; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:949–1072; wiki "Physical Resist X% / Damage Reduced by X%", Q&A

---

## damage-reduced — Damage Reduced by N

stats: normal_damage_reduction (34)

summary: Subtracts a flat amount from every physical hit you take, before physical resist.

body: Each physical hit loses this flat amount first, then your Physical Resist percent applies to the rest [Vanilla]. It is strong against many small hits and does little against big ones. It does not reduce Crushing Blow [Vanilla]. It is common on ESR items [ESR files]. No loader config or patch changes it; the only mentions are debug-log wording in damage-overflow-fix.toml [ESR config].

facts:

- Order: `(damage − flatDR) × (100 − resist)/100` [Vanilla, D2MOO D2Game/src/UNIT/SUnitDmg.cpp:1028–1035; DR read at 808–821].
- Tooltip `Damage Reduced by %d` (row 34).

caveats:

- Whether it applies to physical damage over time (bleed) is unknown; by the bleed config, bleed is life regeneration once applied, so likely not.

sources: `excel/itemstatcost.txt` row 34; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:949–1072; https://maxroll.gg/d2/resources/damage-calculation

---

## magic-damage-reduced — Magic Damage Reduced by N

stats: magic_damage_reduction (35)

summary: Subtracts a flat amount from each fire, lightning, cold and magic hit you take. Not poison.

body: Despite the name it covers fire, lightning, cold and magic damage, each one separately, before your resistance applies [Vanilla]. Poison is not reduced [Vanilla]. Like flat physical reduction, it helps most against many small hits [Vanilla]. No loader config changes it [ESR config].

facts:

- Damage-reduction type per element: physical uses stat 34; fire, lightning, cold and magic use stat 35; poison none [Vanilla, D2MOO D2Game/src/UNIT/SUnitDmg.cpp:771–785 table, values set at 808–821].
- Tooltip `Magic Damage Reduced by %d` (row 35).

caveats: none beyond the usual vanilla caveat.

sources: `excel/itemstatcost.txt` row 35; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:771–785, 949–1072

---

## resists — Fire, Cold, Lightning, Poison and Magic Resist

stats: fireresist (39), coldresist (43), lightresist (41), poisonresist (45), magicresist (37); per level item_resist_fire_perlevel (231), item_resist_cold_perlevel (230), item_resist_ltng_perlevel (232), item_resist_pois_perlevel (233); op 11 totals total_fire_resist (391), total_cold_resist (392), total_lightning_resist (393), total_poison_resist (394), total_magic_resist (400)

summary: Cuts elemental damage you take by a percent. Nightmare and Hell subtract a large penalty, so stack well above the cap.

body: Your resistance is everything on your gear and skills plus the difficulty penalty: {difficulty.nightmare.resistPenalty}<!-- -80 --> in Nightmare and {difficulty.hell.resistPenalty}<!-- -150 --> in Hell, for fire, cold, lightning and poison [ESR files]. That is far harsher than vanilla's {vanilla.difficulty.nightmare.resistPenalty} and {vanilla.difficulty.hell.resistPenalty}. Normal adds {difficulty.normal.resistPenalty}<!-- 0 --> [ESR files]. Magic resist gets no penalty [Vanilla]. The result is capped at 75% plus your maximum resist, never above 95% [Vanilla]; ESR's resistance patches leave that ceiling untouched [ESR config]. There is no hard floor at −100 in ESR: resists go down to {patch.esr-resistance-floor-minus-1000.floor}<!-- -1000 -->, and the character screen shows it [ESR config]. Monster maps and bosses can lower your resists, so overcapping helps [Community 3.9]. "Total X Resist" lines raise the stat by a percent of itself [ESR files].

facts:

- ResistPenalty: Normal `{difficulty.normal.resistPenalty}`<!-- 0 -->, Nightmare `{difficulty.nightmare.resistPenalty}`<!-- -80 -->, Hell `{difficulty.hell.resistPenalty}`<!-- -150 --> (`excel/difficultylevels.txt`; vanilla {vanilla.difficulty.*.resistPenalty}). Normal was +1 in the 3.3 file and is 0 since 3.3.02 (`ESR/patchnotes/3.3.02.md`: "Fixed a bug where characters started with a -1% resistance penalty").
- Penalty applies to players and hirelings, to every row of the damage table except damageresist and magicresist [Vanilla, D2MOO SUnitDmg.cpp:976–990]. That includes Poison Length Reduced (confirmed for ESR by the mod author) and the chill/freeze length rows (see `poison-length`). Not applied to allied summons [ESR config, summon-resist-cap.toml: "The nightmare/hell difficulty penalty is never applied to them"].
- Clamp `[−1000, min(75 + max resist, 95)]`: floor from `ESR/d2rloader/patches/esr-resistance-floor-minus-1000.json` ("A target at -1000 resist takes 1100% of that damage type"); display floor from `…-player-display.json`; 75 and 95 [Vanilla, SUnitDmg.cpp:996–1009], "the elemental ceiling at 0x4524DE (95) [is] untouched" by the patch.
- Damage taken: `(damage − flat reduction) × (100 − resist)/100` [Vanilla].
- `total_*_resist` stats use op 11 (percent of the resist stat) (`excel/itemstatcost.txt`, e.g. 393 total_lightning_resist → lightresist).
- Poison length is a separate stat, 110 (see `poison-length`) [Vanilla].

caveats:

- Magic resist cap {engine.resist.max-base} (+ maximum magic resist) is vanilla code; the wiki marks it "[TBC]".

sources: `excel/difficultylevels.txt`; `excel/itemstatcost.txt`; `ESR/d2rloader/patches/esr-resistance-floor-minus-1000.json`, `esr-resistance-floor-minus-1000-player-display.json`; `ESR/d2rloader/config/celestialrayone.summon-resist-cap.toml`; ESR mod author (Discord, 2026-11-07); D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:949–1072; wiki "Tips for Hell difficulty"

---

## max-resists — Maximum Resist

stats: maxfireresist (40), maxcoldresist (44), maxlightresist (42), maxpoisonresist (46), maxmagicresist (38)

summary: Raises the {engine.resist.max-base}% resistance cap for one element, up to a hard ceiling of {engine.resist.hard-cap}%.

body: Each point lifts that element's cap above {engine.resist.max-base}% [Vanilla]. The hard ceiling is {engine.resist.hard-cap}%, so +{derived.max-resist-headroom}% is the most that matters [Vanilla]. ESR leaves both numbers as in vanilla [ESR config]. Maximum resist only helps if your resist after the difficulty penalty is high enough to reach the new cap. Summons use the same caps when they have maximum resist [ESR config]. Maximum magic resist exists in ESR and works the same way for magic [Vanilla]. Patch 3.2.22 removed maximum resists from Thawing and Antidote Potions [ESR files].

facts:

- Cap `min(75 + max resist, 95)` [Vanilla, D2MOO SUnitDmg.cpp:1006]; "the elemental ceiling at 0x4524DE (95) [is] untouched" (`ESR/d2rloader/patches/esr-resistance-floor-minus-1000.json`); summons "cap = 75 + the unit's per-element max-resist stat, hard cap = 95" (`summon-resist-cap.toml`).
- `ESR/patchnotes/3.2.22.md` line 79: "**Thawing and Antidote Potions** - No longer grant maximum resistances."

caveats: none known.

sources: D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:1000–1015; `ESR/d2rloader/patches/esr-resistance-floor-minus-1000.json`; `ESR/d2rloader/config/celestialrayone.summon-resist-cap.toml`; `ESR/patchnotes/3.2.22.md`

---

## poison-length — Poison Length Reduced

stats: item_poisonlengthresist (110)

summary: Shortens how long poison lasts on you, and the poison damage with it. The difficulty resist penalty applies to it too.

body: Poison deals its damage over a set time. This stat cuts that time by the percent shown, and the damage that would have landed in the cut time is lost [Vanilla]. Enemy "−% to poison resist" also lowers this value [Vanilla]. It is separate from Poison Resist, which lowers the damage per second [Vanilla]. The Nightmare and Hell resist penalty is subtracted from it, as from a resistance [Mod author]. With ESR's penalty of {difficulty.nightmare.resistPenalty}<!-- -80 --> and {difficulty.hell.resistPenalty}<!-- -150 --> [ESR files], that leaves little or nothing in Hell. In the 1.10 code it caps at 75%, and a negative value makes poison last longer [Vanilla]. A unit with ESR's poison immunity state gets no poison over time at all [ESR config].

facts:

- The engine treats `item_poisonlengthresist` as the "resist" for poison length and lets `passive_pois_pierce` reduce it (D2MOO SUnitDmg.cpp:778 table row "Plen") [Vanilla].
- Penalty: `nResValue += dwResistPenalty` for every row whose resist stat is not damageresist or magicresist, players and hirelings only (SUnitDmg.cpp:976–981) [Vanilla].
- Cap: rows without a max-resist stat get `nMaxResValue = 75` for players and hirelings (50 only for damageresist) (SUnitDmg.cpp:996–1009) [Vanilla].
- Poison immunity: `ESR/d2rloader/config/celestialrayone.poison-immunity.toml`, state `{config.poison-immunity.poison_immunity.state_id}`<!-- 25 -->.
- Tooltip `Poison Length Reduced by %+d%%` (row 110).

caveats:

- The mod author (2026-11-07) confirms the penalty; the 75% cap and the longer poison at a negative value are 1.10 code, not checked in ESR.

sources: `excel/itemstatcost.txt` row 110; ESR mod author (Discord, 2026-11-07); D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:771–785; `ESR/d2rloader/config/celestialrayone.poison-immunity.toml`

---

## enemy-resist — −% to Enemy Resist

stats: passive_fire_pierce (333), passive_ltng_pierce (334), passive_cold_pierce (335), passive_pois_pierce (336), passive_mag_pierce (358), passive_dmg_pierce (366)

summary: Lowers the target's resistance to your damage of that type. It cannot break an immunity.

body: When you hit, the target's resistance is lowered by this amount for your damage only, with no visible curse [Community 3.9]. It does not work on a monster at 100% or more: it cannot break immunities [Vanilla] [Community 3.9]. ESR judges a hit in this order: the monster's resistance, then your Sunder, then your −% enemy resist, so once a Sunder effect brings an immunity below 100 your −% enemy resist applies on top [ESR config]. To break an immunity you need curses or auras [Community 3.9] or Sunder effects [ESR config] first. ESR has physical and magic versions too [ESR files]. In ESR it also works for your summons and traps; hirelings are unclear [Community 3.9]. Summon skills such as Valkyrie copy your −% enemy resist stats onto the summon [ESR files]. It is not reduced by the 1/5 rule that applies to curses on immune monsters [Community 3.9].

facts:

- Pierce is skipped when the monster's resistance is ≥ 100 [Vanilla, D2MOO SUnitDmg.cpp:967: `nResValue < 100 || !bDefenderIsMonster`].
- Immunity judged "the monster's resistance, then that unit's Sunder, then its −enemy resistance, then the Sanctuary rule" (`ESR/d2rloader/config/celestialrayone.immunity-dot-clear.toml`).
- Floor: `{patch.esr-resistance-floor-minus-1000.floor}`<!-- -1000 --> "for all elements and all unit types" (patch description). The wiki (3.9) says pierce cannot go below −100; that was the old engine floor, which this patch moves.
- Patch 3.2.19: a player's own pierce no longer shows in ally resist display (`ESR/patchnotes/3.2.19.md` line 10).
- Summons: `excel/skills.txt` Valkyrie passivestat6–11 = the six pierce stats with passivecalc `stat('passive_*_pierce'.accr)` (the same row's passivestats give the pet curse immunity and summon resists, so they land on the pet); Raise Kornac passivecalc5 copies `passive_dmg_pierce`. This supports the 3.9 answer for summons.

caveats:

- Physical and magic pierce (358, 366) are D2R-era stats not in D2MOO; their immunity rule is assumed the same.
- Pierce below −100: by the patch (the uncapped negative path is the one patched) it should now reach −1000; a quick in-game look with the monster display would confirm.
- Summons using the owner's pierce: supported by the Valkyrie and Raise Kornac rows; not checked for every summon skill. Hirelings: unknown.

sources: `ESR/d2rloader/config/celestialrayone.immunity-dot-clear.toml`; `ESR/d2rloader/patches/esr-resistance-floor-minus-1000.json`; `ESR/patchnotes/3.2.19.md`; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:949–1072; wiki "Debuffs, Resistances Reduction, Breaking Immunities", "-X% to Enemy Resistances", Q&A

---

## absorb — Elemental and Magic Absorb

stats: item_absorbfire_percent (142), item_absorbfire (143), item_absorblight_percent (144), item_absorblight (145), item_absorbmagic_percent (146), item_absorbmagic (147), item_absorbcold_percent (148), item_absorbcold (149)

summary: Turns part of the elemental damage that gets through your resists into healing. Percent absorb caps at {engine.absorb.percent-cap}%.

body: Absorb works after resistances [Vanilla]. Percent absorb takes up to {engine.absorb.percent-cap}% of what is left and heals you for it; flat absorb then takes a fixed amount per hit [Vanilla]. Both heal rather than just block [Vanilla]. There is no poison or physical item absorb [Vanilla]. ESR's "absorb all damage" plugin only changes certain skill shields, not these item stats [ESR config]. ESR shows grouped lines such as "Elemental Absorb N%" [ESR files].

facts:

- Percent cap 40 [Vanilla, D2MOO SUnitDmg.cpp:1052]; flat absorb applied after percent, as points per hit, both added to the heal (`dwAbsLife`, 1047–1066) [Vanilla].
- `ESR/d2rloader/config/celestialrayone.absorb-all-damage.toml`: "Makes skills.txt auraeventfunc 40 absorb every kind of damage" — skill shields only.
- Grouped line: rows 142, 144, 148 (fire, lightning, cold %) share dgrp 5 `strModAbsorbElemental` = "Elemental Absorb %d%%"; magic % is not in the group.

caveats:

- Whether the {engine.absorb.percent-cap}% cap is per element after summing all sources: yes in the code; check display.

sources: `excel/itemstatcost.txt` rows 142–149; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:1052–1072; `ESR/d2rloader/config/celestialrayone.absorb-all-damage.toml`

---

## attack-rating — Attack Rating and Chance to Hit

stats: tohit (19), item_tohit_percent (119), item_tohit_perlevel (224), item_tohitpercent_perlevel (225), item_demon_tohit (123), item_undead_tohit (124)

summary: Decides whether your attacks hit. ESR uses a much steeper curve: you need about {config.attack-rating.curve.pivot_ratio}× the target's defense for an even chance.

body: ESR replaces the hit formula for everyone: players, hirelings and monsters [ESR config]. The chance depends only on attack rating divided by defense; level no longer matters [ESR config]. At {config.attack-rating.curve.pivot_ratio}<!-- 5 -->× the target's defense you hit 50% of the time; below that it falls fast, above it it climbs slowly towards 100% [ESR config]. There is no 5% minimum or 95% maximum: low attack rating can mean 0%, and very high rating 100% [ESR config]. The character screen shows the real chance, including bonuses against demons and undead and the target's live defense [ESR config]. Running no longer makes monsters auto-hit you [ESR config].

facts:

- Curve (`ESR/d2rloader/config/celestialrayone.attack-rating.toml` `[curve]`): `pivot_ratio = {config.attack-rating.curve.pivot_ratio}`<!-- 5.0 -->, `steepness = {…steepness}`<!-- 5.0 -->, `tail = {…tail}`<!-- 3.0 -->, `late_tail = {…late_tail}`<!-- 1.0 --> blended from `{…blend_start_ratio}`<!-- 30 --> to `{…blend_end_ratio}`<!-- 100 -->, `snap_to_100_at = {…snap_to_100_at}`<!-- 99.5 -->.
- Below pivot `100 × r^s / (r^s + p^s)`; above `50 + 50 × (r − p) / ((r − p) + tail)` (same file).
- Table from the file (r = AR / defense → chance): {derived.attack-rating-table}.
- `[chance] min_chance = {config.attack-rating.chance.min_chance}`<!-- 0 -->, `max_chance = {…max_chance}`<!-- 100 -->, `level_scaling = {…level_scaling}`<!-- false -->. Vanilla (same file): pivot 1, steepness 1, tail 2, late_tail 0, level scaling, 5–95.
- `[character_screen] skip_client_fudge = true`: the screen no longer applies its own Nightmare/Hell 10/12 defense and 10/15 attack rating reductions.
- `charstats.txt` ToHitFactor `{charstats.*.ToHitFactor}`<!-- 20 for all classes -->; the screen no longer counts it twice (`server_accurate_attack_rating`).
- Running: `ESR/d2rloader/patches/no-run-penalties.json` "Do not force attacks to hit a running player".
- Summons get no monlvl.txt attack rating (`ESR/d2rloader/patches/summon-no-monlvl-stats.json`).
- Per-level AR stats use op 2 with param 3: value/8 per character level (`excel/itemstatcost.txt` 224, 225).

caveats:

- Older community summaries say the chance is limited to 5–95%; the config says {config.attack-rating.chance.min_chance} and {…max_chance}. The config is authoritative.

sources: `ESR/d2rloader/config/celestialrayone.attack-rating.toml`; `ESR/d2rloader/patches/no-run-penalties.json`, `summon-no-monlvl-stats.json`; `excel/charstats.txt`; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:2479–2610

---

## target-defense — Ignore Target's Defense, −% Target Defense, −N Monster Defense per Hit

stats: item_ignoretargetac (115), item_fractionaltargetac (116), item_damagetargetac (120)

summary: Lower or skip the target's defense for your hit roll, which matters a lot under ESR's steep hit curve.

body: Because ESR's hit chance depends heavily on attack rating versus defense, cutting the target's defense is valuable [ESR config]. Ignore Target's Defense sets defense to 0 against normal monsters, champions and minions, but not uniques, superuniques, bosses or hirelings [Vanilla]. −% Target Defense lowers defense by that percent, but only half counts against some targets: the loader config names superuniques, uniques and hirelings [ESR config], while the 1.10 code halves it against players, act bosses, superuniques and hirelings [Vanilla]. "−N to Monster Defense per Hit" permanently lowers the struck monster's defense by N each hit [Vanilla]. The character screen includes these effects [ESR config].

facts:

- Halving named in `ESR/d2rloader/config/celestialrayone.attack-rating.toml` `[character_screen] live_monster_defense`: "the halved −% target defense against superuniques, uniques and hirelings".
- Vanilla halving: players, bosses, superuniques, hirelings; clamp 0–100 (D2MOO SUnitDmg.cpp:2516–2526). Ignore: player attackers only, not against unique/superunique/boss/hireling (SUnitDmg.cpp:2511).
- −N per hit: added to the monster's armorclass stat (floored at 0) when a player or an allied unit attacks (SUnitDmg.cpp:270–277) [Vanilla].

caveats:

- The config names "uniques" where D2MOO names "bosses"; who exactly gets the halving in ESR needs an in-game check (character screen against a yellow unique).
- −N per hit mechanics are from the 1.10 code only (no ESR source).

sources: `ESR/d2rloader/config/celestialrayone.attack-rating.toml`; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:2479–2610; https://maxroll.gg/d2/resources/attack-modifiers

---

## enhanced-damage — Enhanced Damage

stats: item_maxdamage_percent (17), item_mindamage_percent (18), item_maxdamage_percent_perlevel (219)

summary: Raises damage by a percent. On weapons it boosts the weapon's base damage; elsewhere it boosts your total weapon damage.

body: On a weapon, Enhanced Damage multiplies that weapon's own base damage [ESR files]. On other gear, jewels and charms it is added to your general damage bonus instead [ESR config]. ESR fixes an old bug: off-weapon Enhanced Damage was lost when the same item, or a jewel in it, also had flat minimum or maximum damage, depending on socketing order [ESR config]. Now every non-weapon item gives its full Enhanced Damage, and existing characters are fixed on load [ESR config]. Enhanced Defense and durability percent are unchanged [ESR config].

facts:

- Op 13 (percent of the item's own base value) on rows 17/18 (`excel/itemstatcost.txt`).
- Fix: `ESR/d2rloader/config/celestialrayone.enhanced-damage-fix.toml` `[enhanced_damage_fix] enabled = {config.enhanced-damage-fix.enhanced_damage_fix.enabled}`<!-- true -->; "the percent stays on the item only when the item has base damage of that kind"; "Existing characters are fixed when they load"; "Enhanced Defense and max durability % also use op 13; they keep the game's own decision".

caveats:

- How off-weapon ED combines with skill damage bonuses (additive with other % damage) is vanilla behaviour; not restated by ESR.

sources: `ESR/d2rloader/config/celestialrayone.enhanced-damage-fix.toml`; `excel/itemstatcost.txt` rows 17, 18

---

## cannot-be-frozen — Cannot Be Frozen / Half Freeze Duration

stats: item_cannotbefrozen (153), item_halffreezeduration (118)

summary: Cannot Be Frozen removes both freeze and chill on you; Half Freeze Duration halves both.

body: Cannot Be Frozen sets both the chill length and the freeze length of incoming hits to zero, so you are neither frozen nor slowed by cold [Vanilla]. Half Freeze Duration halves both instead; it does nothing when you already have Cannot Be Frozen [Vanilla]. Cold damage itself still hits you [Vanilla].

facts:

- D2MOO D2Game/src/UNIT/SUnitDmg.cpp:876–888: CBF → `dwColdLen = dwFrzLen = 0`; else half freeze → both `/= 2` [Vanilla].
- Monsters: chill and freeze on monsters are divided by `{difficulty.nightmare.monsterColdDivisor}`<!-- 2 --> / `{difficulty.hell.monsterColdDivisor}`<!-- 4 --> and `{difficulty.*.monsterFreezeDivisor}`<!-- 1/2/4 --> (`excel/difficultylevels.txt`) — that is about your cold on them, not these stats.

caveats: none.

sources: `excel/itemstatcost.txt` rows 118, 153; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:876–888

---

## slow — Slows Target

stats: item_slow (150)

summary: Each hit slows the target's movement and attack speed by the percent, for about 30 seconds. Bosses are capped at 50%.

body: Every hit applies the slow; there is no chance roll [Vanilla]. The target's movement, attack and animation speed drop by the percent for 30 seconds [Vanilla]. Caps depend on the target: 90% for normal monsters and minions, 75% for superuniques, and 50% for players, champions, uniques, bosses and hirelings [Vanilla]. A new slow replaces the running one [Vanilla]. No loader config changes it [ESR config].

facts:

- Duration 750 frames = 30 s; caps 90 / 75 / 50 (D2MOO D2Game/src/SKILLS/SkillItem.cpp:1588–1650) [Vanilla].
- Procs on `domeleedamage` and `domissiledamage`, func 19 (`excel/itemstatcost.txt` row 150).

caveats:

- "Replaces the running one" is the state-effect behaviour in vanilla; whether a weaker slow can overwrite a stronger one, and how several sources on the same hit combine, is not checked.

sources: `excel/itemstatcost.txt` row 150; D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1588–1650; https://maxroll.gg/d2/resources/attack-modifiers

---

## freeze — Freezes Target

stats: item_freeze (134)

summary: A chance on hit to freeze the target solid for a short time; bosses and uniques are only chilled.

body: The chance rises with the item value and with your level compared with the target's level, and is lower on ranged hits [Vanilla]. Freeze length is shortened in higher difficulties: divided by {difficulty.nightmare.monsterFreezeDivisor}<!-- 2 --> in Nightmare and {difficulty.hell.monsterFreezeDivisor}<!-- 4 --> in Hell, the same as vanilla [ESR files]. Uniques, bosses and hirelings are only chilled, not frozen [Vanilla]. Monsters that cannot be chilled are not affected [Vanilla].

facts:

- Chance `5 × (4 × (value − 1) − targetLevel + yourLevel + 10)`, ÷3 for ranged (your level counts 6 lower), clamped 0–100; length `2 × (chance − roll) + 25`, 25–250 frames (D2MOO D2Game/src/SKILLS/SkillItem.cpp:1261–1315) [Vanilla].
- Chill instead of freeze for bosses, uniques (MonType flag 8) and hirelings; freeze divided by MonsterFreezeDivisor; nothing on monsters with coldeffect ≥ 0 (D2MOO SUnitDmg.cpp:1663–1708) [Vanilla].
- `{difficulty.normal.monsterFreezeDivisor}`<!-- 1 --> / `{difficulty.nightmare.monsterFreezeDivisor}`<!-- 2 --> / `{difficulty.hell.monsterFreezeDivisor}`<!-- 4 --> (`excel/difficultylevels.txt`).
- Chillability: `excel/monstats.txt` coldeffect / coldeffect(N) / coldeffect(H) (0 or higher = cannot be chilled; Holy Freeze config explains this).

caveats:

- Formula untested in ESR.

sources: `excel/itemstatcost.txt` row 134; `excel/difficultylevels.txt`; `excel/monstats.txt`; `ESR/d2rloader/config/celestialrayone.holy-freeze-damage.toml` (coldeffect rule); D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1261

---

## knockback — Knockback

stats: item_knockback (81)

summary: Hits can push the target back a short distance, interrupting it. Large monsters are pushed less often, small ones every time.

body: A successful hit has a chance to push the target back: 50% for normal-size monsters, 25% for large ones and always for small ones [Vanilla]. It interrupts many monster attacks but can also push melee targets out of your reach [Vanilla]. No loader config changes it [ESR config].

facts:

- Roll 64 in 128 for normal size, 32 for large, 128 for small; players and other non-monster targets use 64 (D2MOO SkillItem.cpp:1126–1158, EventFunc07) [Vanilla].
- Procs on `domeleedamage` / `domissiledamage`, func 7 (`excel/itemstatcost.txt` row 81).

caveats: none.

sources: `excel/itemstatcost.txt` row 81; D2MOO/D2Game/src/SKILLS/SkillItem.cpp (EventFunc07)

---

## damage-to-mana — Damage Taken Goes to Mana

stats: item_damagetomana (114)

summary: A percent of the damage you take, after resistances, is added to your mana.

body: When you are hit in melee or by a missile, the percent of the damage that got through is added to your mana [Vanilla]. It does not reduce the damage [Vanilla]. It works for players only, not mercenaries [Vanilla]. The difficulty table has no divisor for it, unlike leech, so it stays useful in Hell [ESR files].

facts:

- `excel/itemstatcost.txt` row 114: `damagedinmelee` func 13 and `damagedbymissile` func 13 (same as vanilla).
- Uses `dwDmgTotal` (physical + elemental + magic + poison after resists and absorb, SUnitDmg.cpp:939); players only; adds only while mana is below maximum (D2MOO SkillItem.cpp:1228–1255) [Vanilla].

caveats:

- Whether damage over time (poison, bleed) triggers it: by the event list it should not.

sources: `excel/itemstatcost.txt` row 114; D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1228

---

## thorns — Attacker Takes Damage

stats: item_attackertakesdamage (78), item_thorns_perlevel (238), item_attackertakeslightdamage (128), item_attackertakesfiredamage (337), item_attackertakescolddamage (401), thorns_percent (131), missile_thorns_percent (208)

summary: Deals flat damage back to anything that attacks you in melee or hits you with a missile. Physical thorns kills count as yours.

body: Each time a monster attacks you in melee or hits you with a missile, it takes the flat damage shown [ESR files]. Vanilla only answers melee; ESR adds missiles [ESR files]. The lightning version uses the same triggers [ESR files]. In ESR, kills by physical thorns count as your kills: you get the kill credit, and "on kill" effects such as Life after each Kill trigger [ESR config]. The loader config does not list lightning thorns, so those kills probably still give no credit [ESR config]. The damage is physical, so the attacker's own damage reduction and physical resist lower it [Vanilla]. The per-level version grows with your level [ESR files].

facts:

- Row 78: `itemevent1 = attackedinmelee`, func 6; `itemevent2 = damagedbymissile`, func 6 (vanilla has no missile event). Row 128: `attackedinmelee` / `damagedbymissile`, func 10 (vanilla: `damagedinmelee` only). Source `excel/itemstatcost.txt` (compared with vanilla D2R's).
- Kill credit: `ESR/d2rloader/config/celestialrayone.soft-hit-removal.toml` `attacker_takes_damage = {config.soft-hit-removal.soft_hit_removal.attacker_takes_damage}`<!-- true --> covers "Event function 6: itemstatcost itemeventfunc 6 (item_attackertakesdamage in vanilla) and skills.txt auraeventfunc 6"; percent reflect `thorns_percent = {…thorns_percent}`<!-- false --> (stats 131/208 stay soft hits, no kill credit). Row 128 uses func 10 and row 337 (fire thorns) func 11; neither is listed.
- D2MOO func 6 and func 10 both mark the reflected hit with result flags 0x4021 (SkillItem.cpp:1025–1065) [Vanilla]; the config calls 0x20 the soft-hit flag ("Stock marks this damage with flags 0x4021; the switch writes 0x0001").
- Per-level: row 238 `op = 2`, `op param = 3`, `op base = level`, `op stat1 = item_attackertakesdamage`, so it adds value × level / 8 to the flat stat.

caveats:

- Whether thorns triggers on a melee attack that misses or is blocked (`attackedinmelee` suggests yes). Check in game.
- Whether lightning thorns kills give kill credit in ESR. Check in game.

sources: `excel/itemstatcost.txt` rows 78, 128, 238; `ESR/d2rloader/config/celestialrayone.soft-hit-removal.toml`; D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1025–1060

---

## chance-to-cast — Chance to Cast

stats: item_skillonhit (198), item_skillonattack (195), item_skillongethit (201), item_skillonkill (196), item_skilloncast (422), item_skillontakedmg (376), item_skillondeath (197), item_skillonlevelup (199); hidden twins 377, 378, 404, 405, 415, 423

summary: A percent chance to cast the listed skill at the given level when the trigger happens: hitting, attacking, being struck, killing, casting or dying.

body: The item picks the skill, level and chance [ESR config]. Triggers: "on Striking" needs a hit that lands, melee or missile [ESR files]. "on Melee Attack" fires on an attack even when it misses [Vanilla]; the table also lists missile attacks, as vanilla's does, but the old wiki (quoting Amazon Basin) says it does not fire for bows and crossbows [ESR files] [Community 3.9]. "when Struck" fires when you are hit in melee or by a missile [ESR files]. "when Taking Damage" fires on every damage instance you take; poison and bleed trigger it only when they are applied [Mod author]. "when you Kill" fires on your kills; ESR moved it to the function without the hit check, so kills by spells may now count too [ESR files]. ESR adds "on Casting a Skill": real casts in the cast animation that pay their cost, never auras or procs, so it cannot chain [ESR config]. Procs fly at the target like a normal cast [ESR config]. They ignore the cooldown of the skill they cast, and there is no internal proc cooldown [Mod author]. Some skills cannot proc while a blocking state is on [ESR config]. Powers that fire "every N attacks" (the mythical and other item powers that say so) count each Whirlwind hit as a third of an attack since 3.3: 15 Whirlwind swings fire three "every 5 attacks" procs [ESR files, patch notes 3.3].

facts:

- Events (`excel/itemstatcost.txt`): 198 domeleedamage/domissiledamage func 20; 195 domeleeattack/domissileattack func 20 (vanilla D2R identical); 201 damagedinmelee/damagedbymissile func 21; 196 kill func **30** (vanilla 20); 422 doactive func 20; 376 absorbdamage func 21; 197 killed func 30.
- Func 20 requires the hit flag (0x20) when there is damage; func 21 requires result flag 0x04 (GETHIT); func 30 has no such check (D2MOO SkillItem.cpp:1664–1780) [Vanilla].
- `absorbdamage` is triggered in SUNITDMG_CalculateTotalDamage before resistances are applied (D2MOO SUnitDmg.cpp:874) [Vanilla].
- Cast on cast: `ESR/d2rloader/config/celestialrayone.cast-on-cast.toml` ("the caster is in the cast animation (mode 10)", "the skill is not an aura", "a real cast that pays its cost"); `server_proc_aim = true` applies to every item proc.
- Restrict: `ESR/d2rloader/config/celestialrayone.restrict-state-block.toml` — item procs are checked only when the skill row has `ItemUseRestrict = 1`.
- Crossbows (`ESR/d2rloader/config/celestialrayone.crossbow-charges.toml`): procs never spend crossbow bolts; what the hits of a crossbow skill trigger (chance to cast on attack, on striking and on kill) also gets the crossbow damage bonus, chance to cast when struck never does.
- The mod author (2026-11-07): item procs do not respect the cast skill's cooldown, there is no internal proc cooldown and none is planned; "when Taking Damage" (376) fires on every damage instance, but for poison and bleed only on application.
- Patch 3.3 (`ESR/patchnotes/3.3.md` line 34): "Fixed a bug where whirlwind would proc “every x attack” procs all the time. Now every attack in whirlwind is counted as a third of a regular attack for the purpose of those procs (so every 15 swings in whirlwind will proc 3 “every 5 attacks” procs)."
- Patch 3.3.02 (`ESR/patchnotes/3.3.02.md`): "Fixed whirlwind proccing 3 times more melee attack procs than intended." `celestialrayone.whirlwind.toml` now lists `hits_per_attack = 3` ("Whirlwind hits that count as one attack").

caveats:

- Whether "when you Kill" now also fires on kills by spells, minions or damage over time (func 30 drops the hit check). Check in game.
- "on Melee Attack" with bows and crossbows: the table says yes, the old wiki says no. Check in game.
- Whether attack skills (attack animation, not cast animation) ever trigger "on Casting a Skill": by the config, no.

sources: `excel/itemstatcost.txt`; `ESR/d2rloader/config/celestialrayone.cast-on-cast.toml`; `ESR/d2rloader/config/celestialrayone.restrict-state-block.toml`; `ESR/d2rloader/config/celestialrayone.whirlwind.toml`; `ESR/patchnotes/3.3.md`; `ESR/patchnotes/3.3.02.md`; ESR mod author (Discord, 2026-11-07); D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1664–1780; `ESR/d2rloader/config/celestialrayone.crossbow-charges.toml`; wiki "Chance to Cast (CtC)" (quotes Amazon Basin)

---

## reanimate — Reanimate As / Slain Monsters Rest in Peace

stats: item_reanimate (155), item_restinpeace (108)

summary: Reanimate: killed monsters may rise as a named monster fighting for you. Rest in Peace: slain monsters cannot be raised.

body: "N% Reanimate as: X" gives a chance on kill to raise the slain monster's corpse as monster X on your side [Vanilla]. It does not work on unique or champion kills [Vanilla]. Few ESR items have it [ESR files]. "Slain Monsters Rest in Peace" marks your kills so their corpses cannot be raised or used, which also blocks corpse skills [Vanilla].

facts:

- Row 155 `kill` func 31; row 108 `kill` func 29 (`excel/itemstatcost.txt`).
- Reanimate skips unique and champion monsters (D2MOO SkillItem.cpp EventFunc31) [Vanilla].
- Tooltip `%0%% Reanimate as: %1` (descfunc 23).

caveats:

- Reanimate's monster level, lifetime and limit are not documented for ESR.
- Rest in Peace on a necromancer's own gear blocks his corpse skills; worth a warning in game.

sources: `excel/itemstatcost.txt` rows 108, 155; D2MOO/D2Game/src/SKILLS/SkillItem.cpp:1765–1800

---

## ias — Increased Attack Speed

stats: item_fasterattackrate (93)

summary: Shortens attack animations. Gains are in whole frames, so only breakpoints matter; the official Frame Table shows them.

body: Attack speed from gear has diminishing returns [ESR files]. The result is added to your weapon's speed and skill bonuses, and the total is clamped between 15% and 175%, or 250% while shapeshifted [ESR files]. Attacks take whole frames at 25 frames per second, so speed only changes at breakpoints [ESR files]. With a weapon in each hand, each hand uses its own weapon's attack speed [ESR files]. ESR fixes every crossbow attack at 5 frames whatever the speed [ESR files]. Whirlwind has its own ESR formula, and Frenzy has a frames bonus stat [ESR files] [ESR config]. Use the official Frame Table, not vanilla calculators [ESR files].

facts:

- `effective = 120 × IAS / (120 + IAS)`, rounded towards zero; base attack speed and weapon speed modifier added at full value; clamp 15–175 (250 shapeshifted); `rate = floor(AnimationSpeed × (100 + total) / 100)`; frames `ceil(256 × BaseFrames / rate) − 1` (`ESR/docs/ias-calculator.html`, "How this is worked out").
- Exactly −120 IAS divides by zero and crashes (same page).
- Whirlwind: interval × 170/100, attack speed in full but base speed, weapon speed and slows at 50%, cap 300, minimum 6 frames (same page; `ESR/d2rloader/config/celestialrayone.whirlwind.toml` `interval_stretch = 170`, `max_rate = 300`; `ESR/patchnotes/3.2.21.md` "The last IAS breakpoint is now 6 frames instead of 4").
- Frenzy frames stat 920: one frame off each of Frenzy's two swings per point, down to a 3-frame double swing (`ESR/d2rloader/config/celestialrayone.frenzy-speed.toml` `frames_stat_id = 920`; Frame Table).

caveats: none beyond in-game confirmation of individual breakpoints.

sources: `ESR/docs/ias-calculator.html` (official Frame Table); `ESR/docs/ias-calculator-data.js`; `ESR/d2rloader/config/celestialrayone.frenzy-speed.toml`, `celestialrayone.whirlwind.toml`; `ESR/patchnotes/3.2.21.md`

---

## fcr — Faster Cast Rate

stats: item_fastercastrate (105)

summary: Shortens cast animations. ESR raises the useful cap from {vanilla.config.cast-rate-cap.cast-rate-cap.fcr_cap} to about {derived.fcr-max-useful} FCR; check breakpoints in the Frame Table.

body: FCR has diminishing returns [ESR config]. In vanilla it stops paying at {vanilla.config.cast-rate-cap.cast-rate-cap.fcr_cap} FCR [ESR config]. ESR moves the cap to {config.cast-rate-cap.cast-rate-cap.fcr_cap}<!-- 500 --> FCR [ESR config]. Because of rounding, nothing above {derived.fcr-max-useful} FCR changes anything [ESR files]. Higher FCR only helps when it crosses a whole-frame breakpoint, and many breakpoints past {vanilla.config.cast-rate-cap.cast-rate-cap.fcr_cap} need very large amounts [ESR config]. ESR also removes the minimum casting delay [ESR files]. Most casting animations differ from vanilla, so vanilla breakpoint tables are wrong for ESR [Community 3.10]. The official Frame Table has every class and form [ESR files]. Monsters with FCR get the same cap [ESR config].

facts:

- `fcr_cap = {config.cast-rate-cap.cast-rate-cap.fcr_cap}`<!-- 500 --> (default {vanilla.config.cast-rate-cap.cast-rate-cap.fcr_cap}) in `ESR/d2rloader/config/celestialrayone.cast-rate-cap.toml`.
- `effective = 120 × FCR / (FCR + 120)`; `rate = min(100 + effective, ceiling)`; the ceiling is the rate at the cap, {derived.fcr-ceiling} (vanilla {vanilla.derived.fcr-ceiling}). Rates: 200 FCR → {derived.fcr-rate.200}, 300 → {derived.fcr-rate.300}, 400 → {derived.fcr-rate.400}, 500 → {derived.fcr-rate.500} (the same file has the table). Frames `ceil(256 × FramesPerDirection / (AnimationSpeed × rate / 100)) − 1`.
- "nothing above 480 faster cast rate changes anything"; between −55 and −119 FCR the cast becomes instant (game arithmetic wrap) (`ESR/docs/ias-calculator.html`).
- `excel/charstats.txt` MinimumCastingDelay `{charstats.*.MinimumCastingDelay}`<!-- 0 for all classes --> (vanilla {vanilla.charstats.*.MinimumCastingDelay}).
- Frames at AnimationSpeed 256 (the config's example): a 14-frame cast takes {derived.fcr-frames.14.200} frames at 200 FCR and still {derived.fcr-frames.14.500} at 500; a 16-frame cast takes {derived.fcr-frames.16.200} at 200, {derived.fcr-frames.16.400} at 400 and {derived.fcr-frames.16.500} at 500. The config: a 14-frame cast gains nothing "under a 600 cap".

caveats:

- Older community summaries say the cap stays at the vanilla {vanilla.config.cast-rate-cap.cast-rate-cap.fcr_cap}; the config value is {config.cast-rate-cap.cast-rate-cap.fcr_cap} and the official Frame Table agrees.

sources: `ESR/d2rloader/config/celestialrayone.cast-rate-cap.toml`; `ESR/docs/ias-calculator.html`; `excel/charstats.txt`; wiki "Breakpoints (FCR, FHR, FBR)" (values from 3.10.11, untested)

---

## fhr — Faster Hit Recovery

stats: item_fastergethitrate (99)

summary: Shortens the stagger animation after a heavy hit, so you act again sooner.

body: When a hit is heavy enough to stagger you, you play a hit-recovery animation; FHR shortens it [Vanilla]. It has the same diminishing returns as attack speed and works in whole-frame breakpoints [Vanilla]. ESR changed some hit-recovery animations, so vanilla breakpoints do not all apply [Community 3.10]: hit recovery is as in vanilla except better for a few classes, for example the Necromancer, and the mod author has no frame tables for it [Mod author]. The official Frame Table covers attack and cast speed only [ESR files]. No ESR plugin changes the FHR cap [ESR config].

facts:

- `effective = 120 × FHR / (FHR + 120)` (D2MOO D2Common/src/Units/Units.cpp:1613; base table 1284–1290) [Vanilla].
- `cast-rate-cap.toml`: "Attack speed, block rate, hit recovery and run speed have their own separate ceilings and are not touched."

caveats:

- The damage threshold that triggers a stagger is not confirmed for D2R (community lore says 1/12 of max life); the mod author has not looked into it ("generally damage that takes a big chunk of life").
- ESR FHR breakpoints: only the wiki's 3.10.11 table, untested; which classes differ from vanilla is not listed.

sources: D2MOO/D2Common/src/Units/Units.cpp; `ESR/d2rloader/config/celestialrayone.cast-rate-cap.toml`; ESR mod author (Discord, 2026-11-07); wiki "Breakpoints (FCR, FHR, FBR)"

---

## block — Chance to Block and Weapon Block

stats: toblock (20), passive_weaponblock (348)

summary: Chance to block attacks with a shield, up to {engine.block.cap}%. Dexterity raises it, level lowers it; ESR has low class base values.

body: Shield block chance uses your class base, your shield and "Increased Chance of Blocking", scaled by Dexterity and divided by your level [Vanilla]. It caps at {engine.block.cap}% [Vanilla]. ESR's class bases are far lower than vanilla's, so shields and block items matter more [ESR files]. In ESR, moving no longer cuts block chance to a third [ESR config]. Weapon block lets any class block with two claws, two swords, or one sword held in both hands with nothing in the other [ESR config]. It is not capped at {engine.block.cap}%, rolls only after shield block fails, and never while moving [ESR config].

facts:

- Formula `(BlockFactor + toblock) × (Dex − 15) / (2 × level)`, cap 75, players with a shield (D2MOO D2Common/src/Units/Units.cpp:2555–2576) [Vanilla]. `toblock` includes the shield's own block value.
- BlockFactor (`excel/charstats.txt`): `{charstats.*.BlockFactor}`<!-- Amazon 5, Sorceress 4, Necromancer 4, Paladin 6, Barbarian 5, Druid 4, Assassin 5, Warlock 4 --> (vanilla `{vanilla.charstats.*.BlockFactor}`).
- `ESR/d2rloader/patches/no-run-penalties.json`: "Do not divide block chance by three while moving".
- `ESR/d2rloader/config/celestialrayone.weapon-block-rules.toml`: `claw_item_types = ["h2h"]`, `sword_item_types = ["swor"]`; "it is not capped at 75 like shield block", "shield block rolls first", "no weapon block while walking or running"; monsters, hirelings and werewolf/werebear forms keep the stock rule; melee skills with `alwayshit = 1` skip the roll.

caveats:

- Whether ESR shields' own block values make up for the low BlockFactor: compare in game.

sources: `excel/charstats.txt`; `ESR/d2rloader/patches/no-run-penalties.json`; `ESR/d2rloader/config/celestialrayone.weapon-block-rules.toml`; D2MOO/D2Common/src/Units/Units.cpp:2540ff

---

## fbr — Faster Block Rate

stats: item_fasterblockrate (102)

summary: Shortens the block animation, so you can block again and act sooner.

body: Same diminishing returns as other speed stats and whole-frame breakpoints [Vanilla]. ESR changed some block animations, so vanilla tables do not all apply [Community 3.10]. No ESR plugin changes its cap [ESR config].

facts:

- `effective = 120 × FBR / (FBR + 120)` [Vanilla, D2MOO Units.cpp:1513].
- Not touched by `cast-rate-cap.toml` (see `fhr`).

caveats: ESR block breakpoints are only in the 3.10.11 wiki table, untested.

sources: D2MOO/D2Common/src/Units/Units.cpp; wiki "Breakpoints (FCR, FHR, FBR)"

---

## frw — Faster Run/Walk

stats: item_fastermovevelocity (96)

summary: Raises walking and running speed, with diminishing returns. ESR characters already run faster than in vanilla.

body: Movement speed from gear has diminishing returns that are gentler than attack speed's [Vanilla]. ESR characters have a higher base run and walk speed than vanilla [ESR files]. Some ESR effects read Faster Run/Walk, for example an ascendancy that gives Dodge Chance per FRW [ESR files].

facts:

- `effective = 150 × FRW / (150 + FRW)` (D2MOO Units.cpp:1289, 1294–1305) [Vanilla].
- `excel/charstats.txt` RunVelocity `{charstats.*.RunVelocity}`<!-- 13 --> (vanilla `{vanilla.charstats.*.RunVelocity}`), WalkVelocity `{charstats.*.WalkVelocity}`<!-- 9 --> (vanilla `{vanilla.charstats.*.WalkVelocity}`).
- `strings/item-modifiers.json` `nomadtiertwo`: "Gain 5% Dodge Chance per 200% Faster Run/Walk or 40% Base Run/Walk Speed"; `excel/skills.txt` has "Nomad Ascendancy" rows, and 11 skills.txt cells read `item_fastermovevelocity`.

caveats: none.

sources: `excel/charstats.txt`; `strings/item-modifiers.json`; D2MOO/D2Common/src/Units/Units.cpp

---

## dodge — Dodge, Avoid and Evade

stats: passive_dodge (338), passive_avoid (339), passive_evade (340)

summary: Chances to dodge melee, avoid missiles while standing, or evade both while moving. Each is capped at {config.dodge-avoid-evade-cap.dodge_avoid_evade_cap.cap_percent}%.

body: Dodge works against melee attacks while you stand still; Avoid works against missiles while you stand still; Evade works against both while you walk or run [ESR config]. ESR items often show the three as one line, "+N% Dodge Chance" [ESR files]. In ESR, Dodge means all three pooled together: Dodge for melee attacks, Avoid for missiles and, as far as the mod author knows, Evade for both while running, so one Dodge line works like a chance to avoid any attack [Mod author]. The Elixir of Quickness, whose tooltip names only Dodge, gives all three the same way [ESR files]. Each is capped at {config.dodge-avoid-evade-cap.dodge_avoid_evade_cap.cap_percent}<!-- 75 -->% for players, hirelings and monsters, and the Advanced Stats panel shows the capped value [ESR config]. Anything above {config.dodge-avoid-evade-cap.dodge_avoid_evade_cap.cap_percent} is wasted [ESR config]. Dodge works on mercenaries, though the animation may not play [Community 3.9].

facts:

- `cap_percent = {config.dodge-avoid-evade-cap.dodge_avoid_evade_cap.cap_percent}`<!-- 75 -->; per-stat overrides −1 (inherit); `cap_gameplay = true`, `cap_display = true` (`ESR/d2rloader/config/celestialrayone.dodge-avoid-evade-cap.toml`).
- Roll 0–99 against the stat (same file).

caveats:

- Whether dodge blocks on-striking procs of the attacker (vanilla: a dodged attack is not "on striking").

sources: `ESR/d2rloader/config/celestialrayone.dodge-avoid-evade-cap.toml`; `excel/itemstatcost.txt` rows 338–340; `excel/misc.txt` (Elixir of Quickness); ESR mod author (Discord, 2026-11-07); wiki Q&A

---

## magic-find — Magic Find

stats: item_magicbonus (80), item_find_magic_perlevel (240)

summary: Better chance that a drop is magic, rare, set or unique. Diminishing returns for rare, set and unique, with an ESR bonus on top.

body: Magic Find upgrades the quality of items that drop; it does not add drops [Vanilla]. Magic items get the full value. Rare, set and unique get diminishing returns [ESR config]. ESR adds {config.magic-find-soft-tail.magic_find_soft_tail.tail_percent}<!-- 10 -->% of your raw MF on top, with no limit, so more MF always helps a little [ESR config]. Patch 3.2.17 fixed MF above about 2000% being ignored [ESR files]. Only items with a rarity are affected: gems, runes, decals, coupons, crystals, organs, keys, maps and Worldstone Shards ignore MF [Community 3.9] [Mod author]. MF raises the rarity of a drop, never the number of drops [Mod author]. Kills by your minions use your MF [ESR config] [Vanilla].

facts:

- `MagicFind = 100 + dim × MF / (MF + dim) + MF × tail / 100` with dim {engine.magic-find.dim.unique} unique, {engine.magic-find.dim.set} set, {engine.magic-find.dim.rare} rare (`ESR/d2rloader/config/celestialrayone.magic-find-soft-tail.toml`). Up to 10 MF the engine skips the curve and uses the full value (100 + MF must be above 110) [Vanilla, D2MOO D2Game/src/ITEMS/Items.cpp:2397].
- `tail_percent = {config.magic-find-soft-tail.magic_find_soft_tail.tail_percent}`<!-- 10 -->; per-quality overrides −1.
- Worked example, unique: 300 MF → {derived.magic-find.unique.300}% effective; 1000 MF → {derived.magic-find.unique.1000}% (curve plus tail).
- Minion kills: `celestialrayone.item-quantity.toml` mentions "the same way the game credits the owner's magic find on those kills"; D2MOO adds the minion owner's MF (D2Game/src/ITEMS/Items.cpp:2383–2388) [Vanilla].
- `ESR/patchnotes/3.2.17.md` line 5: "Fixed a bug where magic find past \~2000% was not being counted at all." Line 10: culling strike kills now count magic find and gold find.
- Exclusions: the 3.9 wiki names gems, runes, decals and coupons; the mod author (2026-11-07) adds crystals, organs, keys, maps and Worldstone Shards: "only items with rarities are affected", and MF raises the rarity (unique / set / rare / magic), never the quantity.

caveats: none known.

sources: `ESR/d2rloader/config/celestialrayone.magic-find-soft-tail.toml`; `ESR/patchnotes/3.2.17.md`; ESR mod author (Discord, 2026-11-07); D2MOO/D2Game/src/ITEMS/Items.cpp:2380–2440; wiki "Magic Find", Q&A; https://www.reddit.com/r/diablo2/comments/13u4tqv/how_does_magic_find_actually_work_an_advanced/

---

## gold-find — Extra Gold from Monsters

stats: item_goldbonus (79), item_find_gold_perlevel (239), total_gold_found (1025)

summary: Raises the gold in each gold drop by the percent.

body: Gold drops are multiplied by 100% plus your Gold Find [Vanilla]. There are no diminishing returns [Vanilla]. A minion's kill adds its owner's Gold Find [Vanilla]. Patch 3.2.17 fixed culling strike kills not counting gold find [ESR files]. No loader config changes Gold Find itself [ESR config]. ESR 3.3 adds "Total Gold from Monsters": every gold pile that drops for you from a kill or an opened container holds that percent more, applied after Gold Find so the two multiply, added up with the Archaeologist perk Gold Find; a minion's kill uses its owner's value, and gold from vendors, quests or the cube is not raised [ESR config].

facts:

- `gold × (100 + GF) / 100`, plus the minion owner's GF (D2MOO D2Game/src/ITEMS/Items.cpp:2596–2605) [Vanilla].
- `ESR/patchnotes/3.2.17.md` L10 (culling strike, gold find and magic find).
- Total Gold from Monsters: `ESR/d2rloader/config/celestialrayone.archaeology.toml` `[total_gold_found]` `stat_id = 1025`: "Every gold pile dropped for the character holds the character's value of this stat in percent more gold. It joins the Gold Find perk above: the two add up and multiply the pile after the game's Gold Find"; "only monster kills and opened containers count, and Sell Value piles are left alone"; at −100% or less a pile holds nothing.

caveats: none.

sources: D2MOO/D2Game/src/ITEMS/Items.cpp:2596–2605; `ESR/patchnotes/3.2.17.md`; `ESR/d2rloader/config/celestialrayone.archaeology.toml`

---

## item-quantity — Increased Quantity of Items Found

stats: extra_items (426)

summary: A chance for each monster you kill to drop extra items from its own drop table. 100% means one extra pick.

body: ESR-only stat [ESR config]. Each 100% gives one guaranteed extra pick from the monster's own treasure class; the rest is a chance of one more. For example 150% means one extra plus a 50% chance of a second [ESR config]. It adds more of what that monster already drops; it does not change what can drop [ESR config]. It does not work on prime evils [ESR config]. Minion kills count with the owner's stat [ESR config]. The game's limit on items per monster still applies [ESR config]. The roll uses the monster's own seed, so it never changes other drops [ESR config].

facts:

- `stat_id = {config.item-quantity.stat_id}`<!-- 426 -->, `percent = {config.item-quantity.percent}`<!-- true -->, `exclude_prime_evils = {config.item-quantity.exclude_prime_evils}`<!-- true -->, `credit_minion_owner = {config.item-quantity.credit_minion_owner}`<!-- true -->, `max_bonus_picks = {config.item-quantity.max_bonus_picks}`<!-- 0 = no limit --> (`ESR/d2rloader/config/celestialrayone.item-quantity.toml`).
- Prime evils = `excel/monstats.txt` primeevil flag (42 rows: act bosses, ubers, endgame map bosses and others).
- Tooltip `%+d%% Increased Quantity of Items Found` (key `itemquantity`).

caveats: none.

sources: `ESR/d2rloader/config/celestialrayone.item-quantity.toml`; `excel/monstats.txt`

---

## cooldown-reduction — Skill Cooldown Reduction

stats: item_skill_cooldown (371)

summary: Shortens skill cooldowns by the percent; each skill has a floor, usually 20% of its base cooldown (an 80% cap).

body: ESR-only stat [ESR files]. It adds up from all sources [Community 3.9]. Each skill's cooldown formula subtracts your reduction from its base and stops at a floor [ESR files]. On most skills the floor is one fifth of the base, so reduction past 80% does nothing [ESR files]. A few have no floor or a lower one, some skills say "ignores cooldown reduction cap", and one uses Strength instead [ESR files]. Crossbow skills fire from a pool of bolts instead, and their reload does not read this stat (see Crossbows) [ESR config] [ESR files].

facts:

- Typical `excel/skills.txt` calc6: `max(30,(150*100-150*stat('item_skill_cooldown'.accr))/100)`. 33 cells use exactly this `max(floor,(base×100−base×CDR)/100)` shape: 10 with base 150 / floor 30, 6 with 200 / 40, 4 with 100 / 20, 4 with 250 / 50, 3 with 375 / 75, 2 with 125 / 25, and single ones at 25 / 5, 75 / 15, 500 / 100 — all 20% of base — plus one 125 / 0. Many more use the same 20% floor inside a longer formula (Rain of Fire, Orb of Winter, Fist of the Heavens, Nightfall, Summon Skeleton King).
- No floor or a level-based one: Leap Attack, Blade Warp, Sacrificial Offering `max(0, …)`; Call of the Wild, Death Mark, Mind Blast, Frozen Cascade (no max on the reduced value); the teleport family (Slow Teleport, Ice Blink, Lightning Warp, Umbral Flight, Flame Rift, Venom Veil, Wind Walk) `max(0, max(25, …) − lvl/2)`.
- 69 skills.txt cells in 68 skills mention the stat; 3 of them grant it rather than read it (Glacial Focus, Eternal Hourglass Power, Ties That Bind Fire).
- Strings: `skills.json` iceblink23, lightningwarp23, umbralflight23 "This spell ignores cooldown reduction cap"; devastatingoverwhelm23 "Cooldown goes down with strength instead".

caveats:

- "Cap 80%" is the wiki's (3.9) wording; in ESR 3.3 (as in 3.2.24) it is per-skill floors, which mostly equal 80%. The app can compute each skill's floor from skills.txt.

sources: `excel/skills.txt` (calc4–7, auralencalc); `strings/skills.json`; `ESR/d2rloader/config/celestialrayone.crossbow-charges.toml`; wiki "+X% Skill Cooldown Reduction"

---

## elemental-mastery — +% to Fire, Cold, Lightning or Poison Spell Damage

stats: passive_fire_mastery (329), passive_cold_mastery (331), passive_ltng_mastery (330), passive_pois_mastery (332); passive_mag_mastery (357), on no ESR item

summary: Raises your damage of that element by the percent, for skills and for that element's damage added to attacks.

body: These raise your damage of one element by the percent [Vanilla]. ESR shows "+N% to Spell Damage" when these four and the magic and physical spell damage stats are all equal [ESR files]. They also apply to that element's "damage to attacks" from items [ESR config], as in the 1.10 code [Vanilla]. Skills that add elemental damage to attacks, such as Venom, divide out the mastery so it is not counted twice [ESR files]. They are separate from "Total Spell Damage", which some skills multiply on top [ESR files].

facts:

- Damage-overflow-fix debug log lists "each element to attacks with its mastery" (`ESR/d2rloader/config/celestialrayone.damage-overflow-fix.toml` line 302, debug_log section). D2MOO rolls attack fire, lightning, cold, magic and poison damage with the matching mastery as a percent bonus (SUnitDmg.cpp:356–486, 603) [Vanilla].
- `excel/skills.txt` Venom aurastatcalc1 `clc1?0:(enms*100/(100+stat('passive_pois_mastery'.accr)))` (aurastatcalc2 the same for max); Blood Boil's EDmgSymPerCalc ends in `*100/(100+stat('passive_fire_mastery'.accr))-100`. Enchant did the same up to ESR 3.2.24 (`enma*100/(100+stat('passive_fire_mastery'.accr))`); since 3.3 its aurastatcalc1/2 are plain `edmn` / `edmx`.
- Grouped line: dgrp 4 `strModSpellDamage` "%+d%% to Spell Damage" has six members: 329–332, 482 (magic) and 483 (physical).

caveats:

- Exact order with skill synergies (additive or multiplicative) per skill: read each skill's EDmgSymPerCalc.
- Whether they boost elemental damage from procs and summons: unknown.

sources: `excel/itemstatcost.txt` rows 329–332; `excel/skills.txt` (Venom, Blood Boil, Enchant); `ESR/d2rloader/config/celestialrayone.damage-overflow-fix.toml`

---

## spell-damage — Magic, Physical and Total Spell Damage

stats: passive_mag2_mastery (482), passive_wind_mastery (483), generictotalmultiplier (398)

summary: ESR stats that raise skill damage: magic spells, physical spells, or a separate total multiplier on some skills.

body: "+% to Magic Spell Damage" is added to the synergy bonus of magic skills [ESR files]. It also raises flat magic damage from items by the same percent [ESR files]. "+% to Physical Spell Damage" is added to the synergy bonus of physical skills [ESR files]. The mod author has said that the D-stoning "+% physical skill damage" only boosts direct spell damage, and on a skill that deals weapon damage only the skill's own flat physical part [Community 3.9]; that answer is assumed to cover this stat. "+% Total Spell Damage" is a separate multiplier that some skill formulas apply after everything else; it is rare on items [ESR files].

facts:

- 482: `op 11` on `magicmindam`/`magicmaxdam` (`excel/itemstatcost.txt`); read in 54 skills.txt `EDmgSymPerCalc`.
- 483: read in 43 skills.txt `DmgSymPerCalc` (49 skills in all).
- 398: read by 9 skills (4 `EDmgSymPerCalc`, 4 calc2, 1 calc3); e.g. skills.txt "Fire Ball Tainted" calc2 `…*(100+stat('passive_summ_mastery'.accr))/100*(100+stat('generictotalmultiplier'.accr))/100-100`.

caveats:

- Which 9 skills read 398: the app's formula engine can list them.
- The physical spell damage limits come from a 3.9 answer about D-stoning, not about this stat by name.

sources: `excel/itemstatcost.txt` rows 398, 482, 483; `excel/skills.txt`; wiki Q&A

---

## summon-stats — Summon Damage, Life, Resists and Limit

stats: passive_summ_mastery (486), passive_summ_mastery_total (303), passive_summ_life (266), item_summlife_perlevel (1032), passive_summ_elemental_resist (265), passive_summ_phys_resist (267), passive_summ_limit (379), summonexceedcap (511), raven_limit (1026), spirit_wolf_limit (1027), dire_wolf_limit (1028)

summary: ESR stats that strengthen your summons: damage, life, resistances and how many non-unique summons you can have.

body: Summon skills read these stats in their formulas [ESR files]. "+% to Summon Damage" counts when the summon is created; re-summon after changing gear [Community 3.9]. Summon resists are capped like a player's: 75% plus maximum resist, 95% at most, physical 50% [ESR config]. Summons get no difficulty resist penalty [ESR config]. One stat lifts the cap for one summon, the Heart of Wolverine spirit [ESR config]. Summons get their attack rating and defense only from their own data and skills, not from monster level [ESR config]. Against prime evils, pets deal the same reduced damage as players [ESR config]. Since 3.3 three stats raise the Raven, Spirit Wolf and Dire Wolf limits; Head of the Cerberus and Ravenlore still hold the wolves at one [ESR files].

facts:

- Formulas: `excel/skills.txt` (e.g. Raise Kornac calc1 `(100+lvl*par8)*(100+stat('passive_summ_life'.accr))/100-100`; Valkyrie aurastatcalc1 with passive_summ_mastery; 14 skills' `petmax` read passive_summ_limit).
- 303 is op 1 on 486: `+X% Total Multiplier to Summon Damage Stat`.
- Cap: `ESR/d2rloader/config/celestialrayone.summon-resist-cap.toml` (Align = 1 monsters: "summons, Valkyrie, golems, Revives, hirelings"; `pairs = [423, 511]`: monstats *hcIdx 423 = heartofwolverine is uncapped while the owner has stat 511 summonexceedcap, which is on a runeword).
- `ESR/d2rloader/patches/summon-no-monlvl-stats.json`; `ESR/d2rloader/patches/pet-damage-vs-prime-evil.json` (`PlayerDamagePercentVSPrimeEvil` `{difficulty.*.playerDamagePercentVSPrimeEvil}`<!-- 100/50/25 -->, vanilla {vanilla.difficulty.*.playerDamagePercentVSPrimeEvil}).
- Druid limits: `excel/skills.txt` `petmax` of Raven (`… + stat('raven_limit'.accr)`), Summon Spirit Wolf and Summon Dire Wolf (`… + stat('spirit_wolf_limit'.accr)` / `dire_wolf_limit`, but 1 while Head of the Cerberus or Ravenlore Passive is on); patch 3.3 fixed those two items not limiting the wolves to 1.
- `ESR/patchnotes/3.2.19.md` line 4: "Fixed a bug where summons would still show up as immune to elements in certain cases, despite their resistances capping at 75% (50% for phys)."

caveats:

- "Only at summoning" is a 3.9 author answer; formulas evaluated in aurastat columns may update live. Check by swapping gear with summons out.

sources: `excel/skills.txt`; `excel/itemstatcost.txt` rows 1026–1028; `ESR/patchnotes/3.3.md`; `ESR/d2rloader/config/celestialrayone.summon-resist-cap.toml`; `ESR/d2rloader/patches/summon-no-monlvl-stats.json`, `pet-damage-vs-prime-evil.json`; `ESR/patchnotes/3.2.19.md`; wiki Q&A

---

## skills — +Skills

stats: item_allskills (127), item_addclassskills (83), item_addskill_tab (188), item_singleskill (107), item_nonclassskill (97), item_nonclassskill_display (370)

summary: Adds levels to skills: all skills, one class's skills, one skill tab, or a single skill. Oskills give a skill to any class.

body: "+N to All Skills" raises every skill you have points in [Vanilla]. Class and tab bonuses only help that class [Vanilla]. "+N to Skill (Class Only)" raises one skill for that class; a plain "+N to Skill" (an oskill) gives the skill to any class [Vanilla]. ESR merges the two lines of the same skill into one tooltip line, "+N to Skill (All Classes)", showing the sum [ESR config]. Most ESR synergy formulas read hard points only (`skill('X'.blvl)`), so +skills do not raise those synergies; a few read the total level (`.lvl`) [ESR files].

facts:

- Merge: `ESR/d2rloader/config/celestialrayone.skill-line-merge.toml` — only rows 97 and 107, same skill, same tooltip block; merged text uses string key `allclasses`.
- Synergy formulas (`excel/skills.txt` DmgSymPerCalc, EDmgSymPerCalc, ELenSymPerCalc): 306 `.blvl` references, 25 `.lvl`.
- The old wiki (3.9) gives a +32 per-item cap for all skills and for class skills. In ESR 3.3 (as in 3.2.24) `excel/itemstatcost.txt` saves item_allskills with 16 bits / SaveAdd 1000 and item_addclassskills with 10 bits / SaveAdd 50, so that cap does not come from the save format; treat it as outdated.

caveats: none.

sources: `ESR/d2rloader/config/celestialrayone.skill-line-merge.toml`; `excel/itemstatcost.txt`; `excel/skills.txt`; wiki "Stats caps on items"

---

## curse-resistance — Curse Duration Reduced

stats: curse_resistance (109)

summary: Shortens curses cast on you by the percent; 100% makes you immune to curses.

body: Curses on you last that much shorter [Vanilla]. At 100% curses cannot be applied to you at all [Vanilla]. Separately, the difficulty table divides the length of curses that change monster behaviour (Terror, Confuse, Attract, Dim Vision) by {difficulty.nightmare.aiCurseDivisor}<!-- 2 --> in Nightmare and {difficulty.hell.aiCurseDivisor}<!-- 4 --> in Hell [ESR files] [Vanilla].

facts:

- `duration −= duration × res / 100`, ≥ 100 refuses the curse; applies to states flagged as curses (D2MOO D2Game/src/SKILLS/Skills.cpp:1311–1323) [Vanilla].
- `{difficulty.*.aiCurseDivisor}`<!-- 1/2/4 --> (`excel/difficultylevels.txt` AiCurseDivisor, same as vanilla). In D2MOO it is read only for Dim Vision and Terror aura states, Attract and Confuse (D2Game/src/SKILLS/SkillNec.cpp:462–478, 532, 608, 694) [Vanilla]. The old wiki (3.9) says monsters stay cursed for 1/2 and 1/4 of the time in general.
- Tooltip `Curse Duration Reduced by %d%%` (row 109).

caveats:

- Whether it also shortens monster auras' debuffs (not curses): by the code, no; only states flagged as curses.
- Whether ESR's AiCurseDivisor covers all curses (old wiki) or only AI curses (1.10 code). Check in game.

sources: `excel/itemstatcost.txt` row 109; `excel/difficultylevels.txt`; D2MOO/D2Game/src/SKILLS/Skills.cpp:1300–1330

---

## pierce — Piercing Attack

stats: item_pierce (156)

summary: A chance for your arrows and other missiles to pass through a target and hit the next one.

body: Each time a missile hits, it may continue on to another target [Vanilla]. Whether a skill's missiles can pierce depends on the skill; ESR skill descriptions say so when it applies [Community 3.9]. Not to be confused with "−% to Enemy Resist", which some guides also call pierce.

facts:

- Tooltip `%+d%% Piercing Attack` (row 156).
- Wiki (3.9): Dance of Death and Fend projectiles pierce by default; Spearstorm does not.

caveats: skill-by-skill support is undocumented in 3.2.

sources: `excel/itemstatcost.txt` row 156; wiki "Pierce"

---

## experience — Experience Gained

stats: item_addexperience (85)

summary: Adds a percent to the experience you get from kills.

body: Kill experience is raised by the percent [Vanilla]. ESR takes {difficulty.normal.deathExpPenalty}<!-- 10 -->% of your current level's experience when you die, in every difficulty, including Normal [ESR files]. Dying in 19 listed endgame map levels, mostly a map's last level, or in the Goblin Realm map costs no experience [ESR config].

facts:

- `{difficulty.*.deathExpPenalty}`<!-- 10/10/10 --> (vanilla {vanilla.difficulty.*.deathExpPenalty}; `excel/difficultylevels.txt`).
- Safe levels: `ESR/d2rloader/config/celestialrayone.death-penalty-safe-levels.toml` `protected_levels` (19 ids, 141 … 213), `protect_experience = true`, `protect_gold = false`. By `excel/levels.txt` they are all endgame map levels, mostly a map's last level (for example "Tier 1 Map - Chasm of Horror Level 2", "Tier 5 Map - The Frozen Throne") and "Unique Map - Goblin Realm".
- The loss is DeathExpPenalty percent "of the experience span of your current level", never below the start of that level (same file).

caveats: none.

sources: `excel/difficultylevels.txt`; `ESR/d2rloader/config/celestialrayone.death-penalty-safe-levels.toml`

---

## light-radius — Light Radius

stats: item_lightradius (89)

summary: Changes how far around you the game lights the area. Mostly cosmetic.

body: More light radius shows more of the dark area around you [Vanilla]. Negative values shrink it. It has no combat effect [Vanilla].

caveats: none.

sources: `excel/itemstatcost.txt` row 89

---

## requirements — Requirements and Level Required

stats: item_req_percent (91), item_levelreq (92)

summary: Changes the Strength, Dexterity or level needed to equip the item.

body: "Requirements −N%" lowers the item's Strength and Dexterity requirements by that percent; positive values raise them [Vanilla]. "+N Level Required" raises the character level needed [ESR files]. ESR recipes such as D-stoning and melding add it, and Mapling lowers it [ESR files].

facts: Level Required is on every unique and on many cube recipes (D-stoning recipes such as "DS + Any Weapon", gem melding, and the negative "[SECRET50] Lvl Req -N" Mapling rows) (`excel/cubemain.txt`).

caveats: none.

sources: `excel/itemstatcost.txt` rows 91, 92; `excel/cubemain.txt`; guide note `dstoning-and-mapling`

---

## rare-procs — Prevent Monster Heal, Hit Blinds Target, Hit Causes Monster to Flee

stats: item_preventheal (117), item_stupidity (113), item_howl (112)

summary: Vanilla on-hit effects that are almost absent from ESR items.

body: Prevent Monster Heal stops a monster you hit from regenerating life [Vanilla]. Hit Blinds Target makes the target lose sight of you [Vanilla]. Hit Causes Monster to Flee makes it run away [Vanilla]. In ESR, no spawnable item has Prevent Monster Heal or Flee, and Hit Blinds Target is only a partial set bonus on one set item, Death's Hand [ESR files]. They are listed here only so the lines can be explained if they show up.

facts:

- Carriers: 117 `noheal` only on the non-spawnable suffix "of Vileness", 112 `howl` only on the non-spawnable prefixes Screaming/Howling/Wailing, 113 `stupidity` only on Death's Hand as a partial set bonus (`excel/magicprefix.txt`, `magicsuffix.txt`, `setitems.txt`).
- Prevent heal: a 120000-frame state on hit, player attackers only, not on ubers (D2MOO SUnitDmg.cpp:2453–2475) [Vanilla].

caveats: none.

sources: `excel/itemstatcost.txt`; `excel/magicprefix.txt`, `magicsuffix.txt`, `setitems.txt`; D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:2454

---

## crossbows — Crossbows: Bolts, Reload and Damage Bonus

stats: item_crossbowpassive (296), crossbowreloadspeed (299), totalcrossbowbolts (513), totalcrossbowdamage (515), crossbowreloadspeedlimit (518)

summary: Crossbow skills fire from a small pool of bolts that reload one at a time, and crossbow hits deal extra damage after resistances.

body: Every crossbow carries a hidden crossbow marker from its automatic modifier, and crossbow uniques carry it too [ESR files]. While you hold one, the basic Attack and every skill whose cooldown reads the crossbow reload (the Amazon bow skills, Strafe, Holy Rain, Mirrored Blades and a few item skills) fire from a pool of {config.crossbow-charges.crossbow_charges.default_max_bolts}<!-- 3 --> bolts instead of going on cooldown [ESR config] [ESR files]. A cast spends one bolt however many projectiles it fires; spent bolts reload one at a time, in the order they were spent; with no bolts left, crossbow skills cannot be cast [ESR config]. Other skills keep their own cooldowns, and procs never spend bolts [ESR config]. "+N to Maximum Crossbow Bolts" adds bolts [ESR config]. Crossbow attacks always take {config.crossbow-charges.crossbow_charges.default_attack_frames}<!-- 5 --> frames: attack speed shortens the reload instead [ESR config] [ESR files]. Without attack speed the reload is {derived.crossbow-reload-seconds.base}<!-- 2.4 --> seconds (the official Weapons page lists each crossbow's own base reload), and it never goes below {derived.crossbow-reload-seconds.min}<!-- 1 --> second [ESR files]. "Faster Crossbow Reload Time" shortens it further, "Crossbow Reload Speed Limit Reduced" lowers that floor, and Skill Cooldown Reduction does not touch it [ESR files]. Since 3.3 bolts reload {config.crossbow-charges.crossbow_charges.standing_reload_bonus}<!-- 25 -->% faster while you stand still, even past the floor: {derived.crossbow-reload-seconds.min} second becomes {derived.crossbow-standing-seconds.min}<!-- 0.8 --> [ESR config]. Moving, attacking, casting or getting hit reloads at the normal speed [ESR config]. The basic Attack skill shows your current reload time [ESR files]. Hits of crossbow skills, and of everything those hits trigger (chance to cast on attack, on striking and on kill), deal {derived.crossbow-damage.0}<!-- 200% --> of their final damage, after resistances and absorb; "+N% Total Crossbow Damage" adds to that [ESR config]. Physical, elemental, magic and poison damage scale; Crushing Blow, Open Wounds and Bleed do not, and neither do when-struck procs or aura pulses [ESR config]. Patch 3.3 lowered the bonus (it was +150%) and the base reload (it was 3 seconds), and fixed the bonus shown on the Weapons page [ESR files].

facts:

- `ESR/d2rloader/config/celestialrayone.crossbow-charges.toml` `[crossbow_charges]`: `default_max_bolts = {config.crossbow-charges.crossbow_charges.default_max_bolts}`, `standing_reload_bonus = {…standing_reload_bonus}`, `default_attack_frames = {…default_attack_frames}`, `damage_base = {…damage_base}`; stat ids max bolts `{…max_bolts_stat_id}`, current bolts `{…current_bolts_stat_id}` (written by the plugin), damage `{…damage_stat_id}`, attack frames `{…attack_frames_stat_id}`. Damage = (100 + `damage_base` + damage stat) % of the final damage. "A skill whose skills.txt `globaldelay` works out above 0 while the player holds a crossbow" is a crossbow skill; "Casts triggered by items (chance to cast) never spend bolts"; the standing bonus "speeds up the reload itself, after `globaldelay` was worked out, so it goes past any limit inside the `globaldelay` formula".
- Reload, `excel/skills.txt` Attack: calc4 `max({skills.attack.crossbow-reload.min-frames}*(100-stat('crossbowreloadspeedlimit'.accr))/100,({…base-frames}-clc5/3+(clc5*clc5)/8000)*(100-stat('crossbowreloadspeed'.accr))/100)` frames (25 a second), calc5 `120 × IAS / (120 + IAS) + (attackrate − 100)`, calc6 (the global delay) is calc4 only while `item_crossbowpassive` is above 0; the other crossbow skills' `globaldelay` is `skill('Attack'.clc6)`. ESR 3.2.24 had a base of 75 frames.
- `excel/automagic.txt`: the `xbow` row adds `crossbow-passive` (`item_crossbowpassive`) and tinkering points to every crossbow.
- `ESR/docs/weapons.htm` (crossbow table note): bolts, "+100%" damage, 5-frame attacks, the 1 second minimum ("lower with the ironbolt ascendancy"), the standing-still bonus; a "Base Reload" column per crossbow. `ESR/docs/skill_information.htm`: the Surge procs "inherit the bonus damage from crossbows".
- Patch 3.3 Crossbows: "reload 25% faster overall while standing still (also goes above the reload cap)", "Fixed a display bug where the damage bonus displayed as 50% instead of 150%", "Reduced total damage granted by crossbows from 150% to 100%", "Reduced minimum base reload speed from 3 seconds to 2.4 seconds".

caveats:

- What the reload's attack rate term includes besides IAS: the Weapons page's base reloads differ per crossbow (2.16 s for the Light Crossbow), so the weapon's speed seems to count. Compare with the Attack skill's tooltip in game.
- The old wiki (3.9) said crossbows put every skill on cooldown; with the bolt plugin only crossbow skills reload.

sources: `ESR/d2rloader/config/celestialrayone.crossbow-charges.toml`; `excel/skills.txt` (Attack calc4–6, `globaldelay`); `excel/automagic.txt`; `excel/itemstatcost.txt` rows 296, 299, 513–518; `ESR/docs/weapons.htm`; `ESR/docs/skill_information.htm`; `ESR/docs/ias-calculator.html`; `ESR/patchnotes/3.3.md`

---

## extra-curses — Maximum Curses

stats: extra_curse (1016)

summary: Each point lets you keep one more of your curses on the same target; without it a new curse replaces the old one.

body: ESR 3.3 stat [ESR files]. A target can carry 1 + your Maximum Curses of your curses at once [ESR config]. Recasting a curse the target already has refreshes it as before and never needs a free slot [ESR config]. A new curse on a full target replaces one curse, the one applied first: refreshing a curse does not make it newer [ESR config]. The replaced curse ends as if it had run out [ESR config]. The count belongs to the caster: hirelings, summons and monsters that have the stat get it too, and a monster without it still keeps a single curse on you [ESR config]. Curse Duration Reduced still shortens every curse and blocks it at 100% [ESR config]. Only the newest curse's graphic shows over the target; the others stay active [ESR config]. It comes on a few uniques and a superior affix [ESR files].

facts:

- `ESR/d2rloader/config/celestialrayone.extra-curses.toml` `[curses]`: `stat_id = {config.extra-curses.curses.stat_id}`<!-- 1016 -->, `replace = "{…replace}"` (the other choice, "shortest_remaining", replaces the curse with the least time left). "curses a caster can keep on one target = 1 + the caster's value of the stat"; "A curse that lands never removes more than one curse"; stat 109 (Curse Duration Reduced) and state 57 still apply.
- The plugin answers the game's one question "which curse does this target already have?" from the caster's stat, so every curse, also from item procs, goes through it (same file, "HOW IT WORKS").
- `excel/properties.txt` `extra-curse`; `excel/qualityitems.txt` (a superior affix); tooltip `+%d to Maximum Curses` (`strings/item-modifiers.json` key `extracurse`).
- Patch 3.3 Stats: "+x to Maximum Curses - allows you to apply more curses".

caveats:

- Monster curses since 3.3 use their own curse skills; which monsters (if any) carry the stat is not documented.

sources: `ESR/d2rloader/config/celestialrayone.extra-curses.toml`; `excel/itemstatcost.txt` row 1016; `excel/properties.txt`; `excel/qualityitems.txt`; `strings/item-modifiers.json`; `ESR/patchnotes/3.3.md`

---

## socket-effect — Increased Effect of Socketed Gems, Runes and Jewels

stats: gem_effect (1022), rune_effect (1023), gem_effect_current_item (1047), rune_effect_current_item (1046), jewel_effect_current_item (1044); also jewel_effect 1041 and the per-level 1055, which no 3.3 item carries

summary: Raises the bonuses of the gems, runes or jewels socketed in your gear by the percent; the "in this Item" stats only those in their own item.

body: ESR 3.3 stats [ESR files]. "Increased Effect of Socketed Gems" raises the modifiers of every gem socketed in your counting gear by your total of the stat, in percent: at +10, a gem's +100 life gives +110 [ESR config]. The rune and jewel stats do the same for runes and jewels [ESR config]. Your total from every source counts, so they work without a Jeweler perk [ESR config]. The "Socketed in this Item" stats raise only the socketables in the item that carries them [ESR files]. What rises is the socketable's own modifiers, from a list of {config.jeweler.socketed_gems.stats.count}<!-- 209 --> stats: attributes, life, resists, damage, skills, procs, speed and more [ESR config]. For the matching perks (Amplification, Runic Insight) the configs say outright that a runeword's or gemword's bonus is not raised; for these stats they only name the socketed items' modifiers [ESR config]. A socketable that matches several of these stats gets their values added up [ESR config]. They add to the Jeweler's Amplification, Prismatic Resonance and Six Peas in a Pod and are pooled with them: the bonus is summed per stat over all items and rounded once, toward zero, so small values are not lost item by item [ESR config]. A negative value lowers the effect; at −100% or less the socketable gives nothing, never the opposite [ESR config]. The rune stats count every socketed item of the rune type, which in misc.txt also covers the crystals; the Runic Insight perk lists its runes by code to leave the crystals out [ESR config].

facts:

- `ESR/d2rloader/config/celestialrayone.jeweler.toml` `[[gem_effect]]`: gems `{config.jeweler.gem_effect.gems}`, runes `{…runes}`, jewels `{…jewels}`; with `own_sockets = true`: gems `{…gemsInItem}`, runes `{…runesInItem}`, jewels `{…jewelsInItem}`. "A gem effect stat raises the modifiers of the socketed items of its types by the character's value of the stat, in percent … as stat('...'.accr) reads it, so it works without any Jeweler perk"; "It raises the stats in Amplification's stats list, never a gem effect stat itself". The comment does not explain `own_sockets`; patch 3.3: "same as the stats above, except those affect only the item the stat spawns on".
- The raised stats: `[socketed_gems] stats` ({config.jeweler.socketed_gems.stats.count} itemstatcost ids, Amplification's list). Amplification: "Only the jewels' and gems' own modifiers count, never the host item's or a gemword's bonus"; `ESR/d2rloader/config/celestialrayone.archaeology.toml` `[socketed_runes]` (Runic Insight): "Only the runes' own modifiers (gems.txt) count, never a runeword's bonus", and its `item_codes` leave out the crystals, which "carry the same misc.txt type rune". The Jeweler perk Steady Pliers is the one that raises gemword bonuses.
- `excel/itemstatcost.txt`: jewel_effect 1041 (no item carries it); rune_effect_current_item_perlevel 1055 (op 4, level-based, on 1046; no item carries it).
- Superior affixes with gem-effect and rune-effect: `excel/qualityitems.txt`. Tooltips: `strings/item-modifiers.json` keys `gemeffect`, `runeeffect`, `jeweleffect`, `gemeffectcurrentitem`, `runeeffectcurrentitem`, `jeweleffectcurrentitem`.

caveats:

- Whether a runeword's own bonus rises with the rune stats (the config names only the socketed items' modifiers). Test with a runeword in an item with "Increased Effect of Runes Socketed in this Item".
- Whether crystals count for the rune stats (by item type they do).
- Whether the rune stats pool with the Archaeologist's Runic Insight, which another plugin applies.

sources: `ESR/d2rloader/config/celestialrayone.jeweler.toml`; `ESR/d2rloader/config/celestialrayone.archaeology.toml`; `excel/itemstatcost.txt` rows 1022, 1023, 1041, 1044, 1046, 1047, 1055; `excel/qualityitems.txt`; `ESR/docs/specializations.htm`; `ESR/patchnotes/3.3.md`

---

## utility-potions — Utility Potion Effectiveness and Duration

stats: utilitypotionmultiplier (925), utilitypotionduration (1019)

summary: Make utility potions (the drinkable elixirs and Stamina, Antidote and Thawing Potions) stronger or last longer by the percent.

body: ESR 3.3 stats [ESR files]. Utility potions are the drinkable elixirs plus the Stamina, Antidote and Thawing Potions [ESR files]. Each one's strength is its base value × (100 + Utility Potion Effectiveness) / 100, and the Alchemist perk Volatile Concoctions adds {misc.utility-potion.perk-percent}<!-- 5 -->% to that sum [ESR files]. Its length is the base length × (100 + Utility Potion Duration) / 100: {derived.utility-potion-seconds.elixir}<!-- 45 --> seconds for elixirs, {derived.utility-potion-seconds.stamina}<!-- 90 --> for a Stamina Potion and {derived.utility-potion-seconds.antidote}<!-- 45 --> for Antidote and Thawing Potions [ESR files]. An elixir's base value also grows with your character level, and a Greater Elixir is ×{derived.greater-elixir-multiplier}<!-- 1.25 --> its regular elixir [ESR files]. The Elixir of Reincarnation lasts until it saves you, so neither stat changes it [ESR files]. Life and Mana Potion Effectiveness is a separate stat for healing and mana potions [ESR files]. Every elixir and its effect: [Elixirs](/elixirs); where they drop and the perks: [the guide's Elixirs note](/guide/elixirs).

facts:

- `excel/misc.txt` utility potions (type or type2 `upot`): `len` `1125*(100+stat('utilitypotionduration'.accr))/100` (frames, 25 a second; the Stamina Potion 2250), every `calcN` `…*(100+stat('utilitypotionmultiplier'.accr)+(stat('alchemy_2'.accr)>0)*5)/100`, e.g. Elixir of Luck `(50+stat('level'.accr)*3)*(100+…)/100` Magic and Gold Find. Greater Elixirs (type2 `gelx`): the same formula `*{misc.greater-elixir.percent}*(…)/10000`. Elixir of Reincarnation `35p`: `len` 2000000000.
- Volatile Concoctions = `alchemy_2` ("Increase the effect of utility potions by 5%", `ESR/docs/specializations.htm`). Other Alchemist perks on utility potions (`ESR/d2rloader/config/celestialrayone.alchemy.toml`): Savvy Elixirs (a chance not to use the potion up), Serendipity (a chance of a shrine effect), Compounded Synergy (stronger per running potion effect).
- `excel/properties.txt` `utility-potion-multiplier`, `utility-potion-duration`; tooltips `%+d%% Utility Potion Effectiveness`, `%+d%% to Utility Potion Duration` (`strings/item-modifiers.json`).
- Patch 3.3 Stats: "increases the effect of utility potions (elixirs)", "increases the duration of utility potions (elixirs)"; Elixirs: "Elixir effects scale with character level and last 45 seconds".

caveats:

- The formulas run when the potion is drunk; whether a running effect changes when you swap gear is not documented. Check by drinking with and without the item.

sources: `excel/misc.txt`; `excel/itemstatcost.txt` rows 925, 1019; `excel/properties.txt`; `ESR/d2rloader/config/celestialrayone.alchemy.toml`; `ESR/docs/specializations.htm`; `strings/item-modifiers.json`; `ESR/patchnotes/3.3.md`

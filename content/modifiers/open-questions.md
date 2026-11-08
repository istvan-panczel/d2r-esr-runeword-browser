# Open questions for the modifier explanations

"Ask" = a question for the mod author (CelestialRay). "Test" = something one person can check in single player. Each item names the explanation keys it affects. Questions the mod author answered on 2026-11-07 are listed at the end; the explanations use the answers.

## Highest impact

1. **Leech in Hell rounds to nothing? (Test)** — `life-leech`, `mana-leech`
   ESR divides life leech by 150 in Hell and mana leech by 75 (`difficultylevels.txt`). In the 1.10 code the reduced value keeps 1/64 precision, so 20% leech becomes 0.125%, and 2% or less becomes 0. Some guides (Maxroll) say D2R rounds any leech below 1% after reductions down to 0, which would make all item leech under 150% useless in Hell. The mod author (2026-11-07) is "pretty sure" D2R keeps fractional leech, as his assumption, not a test.
   Test: Hell, a character with only ~20–40% life leech and no other sustain, hit a normal monster (not a skeleton type) while below full life with regeneration removed. Does the life globe move on hits? Repeat in Nightmare.

2. **Deadly Strike over 100% (Test)** — `deadly-strike`
   Demon Limb and Lacerator (unique weapons) give bonuses for "every 1% deadly strike over 100%" / "over the cap", and their aura formulas subtract 100. (The hidden `item_deadlystrike_cap` stat (605) is a D-stoning cap, mod author 2026-11-07; it does not change this.)
   Test: stack Deadly Strike above 100 with Demon Limb or Lacerator and watch whether the "over the cap" bonus appears.

3. **Weapon-mastery crit chance (Ask, rephrase)** — `deadly-strike`
   The mod author answered that plain item Deadly Strike does not make spells crit without the hidden "<element> Damage Crit" auras, but did not understand our "weapon-mastery crit chance" part. Rephrase it: critical-strike-damage.toml resolves a "weapon-mastery Critical" before Critical Strike and Deadly Strike. That is the engine's `passive_mastery_melee_crit` (344) and `passive_mastery_throw_crit` (347), in vanilla the "Critical Strike" line of the Barbarian's Sword, Axe, Mace, Pole Arm and Spear Mastery (melee) and Throwing Mastery (throw). ESR's Demon Limb, Lacerator, Gimmershred, Thunderstroke, Shuriken and Battlemage Ascendancy formulas read these stats, but no ESR skill passive, item property or cube recipe grants them.
   Ask: "Does anything in ESR still give passive_mastery_melee_crit / passive_mastery_throw_crit (the vanilla Barbarian mastery 'Critical Strike' line), or are they always 0?"

4. **Hireling leech in Nightmare and Hell (Ask)** — `life-leech`, penalties table
   In the 1.10 code the leech divisor is applied only when the attacker is a player, so hireling leech is not reduced. Is that still true in D2R/ESR? The mod author did not know (2026-11-07).

## Mechanics to confirm in game

5. **Lightning thorns kill credit (Test)** — `thorns`, `after-kill`
   The soft-hit-removal config gives kill credit to event function 6 (physical thorns, stat 78/238) but does not list function 10 (lightning thorns, stat 128) or 11 (fire thorns, 337). Test: kill a monster only with "Attacker Takes Lightning Damage" while wearing Life after each Kill; does life refill?

6. **AI curse divisor scope (Test)** — `curse-resistance`, penalties table
   `AiCurseDivisor` (1/2/4) is read in the 1.10 code only for Terror, Confuse, Attract and Dim Vision. The old wiki says all curses last 1/2 and 1/4 as long in Nightmare and Hell. Test: cast Amplify Damage (or any non-AI curse) on the same monster in Normal and Hell and compare the duration.

7. **"on Melee Attack" with bows and crossbows (Test)** — `chance-to-cast`
   Stat 195 lists `domeleeattack` and `domissileattack` (same as vanilla D2R data), but the old wiki quotes Amazon Basin: not applied to ranged attacks. Test with a bow and a chance-to-cast-on-attack item.

8. **Who gets halved −% Target Defense (Test)** — `target-defense`
   The attack-rating config says halved against "superuniques, uniques and hirelings"; the 1.10 code says players, bosses, superuniques and hirelings. Test with the character screen hit chance (it uses the live defense) against a yellow unique, a superunique and an act boss, with and without a −% Target Defense item.

9. **"when you Kill" procs on spell, minion and poison kills (Test)** — `chance-to-cast`
   ESR switched item_skillonkill from function 20 to function 30, which drops the hit-flag check. Does a "chance to cast when you kill" item now fire when a spell, a summon, poison or bleed lands the kill?

10. **Thorns on missed or blocked melee (Test)** — `thorns`
    Item thorns use the `attackedinmelee` event. Does a monster take thorns damage when its melee attack misses or is blocked?

11. **Bleed and physical resist (Test)** — `bleed`
    Bleed uses the hit's physical damage "after damage reduction and absorb". Does that include the target's % physical resist? Test on a monster with high physical resist: is the bleed noticeably smaller?

12. **Life on Striking against undrainable monsters, Mana on Striking on mercenaries (Test)** — `on-striking`
    Skeleton-type monsters have no drain value (no leech). Does Life on Striking still heal when hitting them? It should by the code. In the 1.10 code the mana function only works for players: does Mana on Striking do anything on a mercenary?

13. **Hit recovery threshold and frame tables (Ask)** — `fhr`
    What damage triggers hit recovery in ESR (community lore: 1/12 of max life)? Which classes recover faster than in vanilla, and by how many frames? The mod author (2026-11-07) has not looked into the threshold ("generally damage that takes a big chunk of life") and has no frame tables; hit recovery is unchanged from vanilla except better for a few classes, for example the Necromancer.

14. **Summon Damage only at summoning? (Test)** — `summon-stats`
    The 3.9 author answer says +% Summon Damage counts only when the summon is created. Several summon skills apply it through aurastat formulas, which may update live. Test: summon, then equip a summon damage item; does the summon's damage change, or only after re-summoning?

15. **Elemental mastery on item elemental damage (Test)** — `elemental-mastery`
    The overflow-fix config says elemental damage "to attacks" goes through its mastery, as the 1.10 code does. Test: a melee character with +fire damage to attacks; does +% Fire Spell Damage raise the fire part of the weapon hit on the character screen?

16. **Do the "Increased Effect of Socketed Runes" stats raise runeword bonuses? (Ask)** — `socket-effect`
    jeweler.toml says the gem effect stats raise "the modifiers of the socketed items of its types"; for the Amplification and Runic Insight perks it says outright that a runeword's or gemword's bonus is not raised. Does the same hold for the rune stats (Rune Master, Lenymo, the superior affix)? Do crystals, which share the rune item type, count? Does the stat pool with Runic Insight? And what does `own_sockets` read: the item's own value of the stat, or the character's total?

17. **Crossbow reload and weapon speed (Test)** — `crossbows`
    The Attack skill's reload is (60 − e/3 + e²/8000) frames with e = 120 × IAS / (120 + IAS) + (attack rate − 100). The official Weapons page gives each crossbow its own base reload (Light Crossbow 2.16 seconds, not 2.4). Test: with no IAS, read the reload on the Attack skill with two crossbows of different speed.

18. **Utility potion stats on a running elixir (Test)** — `utility-potions`
    The misc.txt formulas read Utility Potion Effectiveness and Duration; are they read once when you drink, or do they follow gear swaps? Drink an Elixir of Luck, then equip or remove a Utility Potion Effectiveness item and watch the Magic Find on the character screen.

## Answered by the mod author (2026-11-07)

- **Which damage leeches?** (`life-leech`, `mana-leech`): only physical damage, and only damage that goes through `srcdam` (weapon damage). (The damage-overflow-fix config, line 325, describes a "physical + fire + lightning + cold + magic" sum.)
- **Poison Length Reduced and the difficulty penalty** (`poison-length`, `resists`): it does get the difficulty resist penalty.
- **Crushing Blow against yellow uniques** (`crushing-blow`): 6.25% is right; the "50 -> 12.5 %" comment was a mistake, fixed in 3.3 (`crushing-blow.toml` line 34 now reads "25 -> 6.25 % of current life").
- **Fire thorns as Critical Strike?** (`deadly-strike`, `thorns`): no. The game gates hard-coded stats by name, and ESR replaced passive_critical_strike with a custom stat, so a fire-thorns item (row 337) gives no crit.
- **What does item_deadlystrike_cap (605) do?** (`deadly-strike`): it is a D-stoning cap that keeps the Deadly Strike already on the item apart from what Dragon Stones add, so a 50% Deadly Strike item can be stoned to 150% instead of capping at 100%.
- **Resist penalty in Normal was +1** (`resists`): an offset for hidden Kill Ledger effects that cancels when the Kill Ledger is equipped; changed in 3.3, zeroed in 3.3.02.
- **Chance-to-cast and cooldowns** (`chance-to-cast`): item procs do not respect the cooldown of the skill they cast; there is no internal proc cooldown, and none is planned.
- **"when Taking Damage" vs "when Struck"** (`chance-to-cast`): stat 376 fires on every damage instance, but for poison and bleed only when they are applied.
- **Magic Find exclusions** (`magic-find`): crystals, organs, keys, maps and Worldstone Shards ignore MF too. Only items with a rarity are affected; MF raises the rarity (unique, set, rare, magic), never the quantity.
- **Spell crits from items** (`deadly-strike`): plain item Deadly Strike does not make spells crit without the hidden "<element> Damage Crit" auras. The weapon-mastery part is question 3.
- **Dodge on the Elixir of Quickness** (`dodge`): its tooltip names only Dodge, but it gives Dodge, Avoid and Evade. Not a bug: in ESR, Dodge is the three pooled together (Dodge for melee, Avoid for missiles, Evade for both while running, "as far as I know"), so it works like a chance to avoid any attack.

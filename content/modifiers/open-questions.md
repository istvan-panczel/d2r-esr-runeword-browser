# Open questions for the modifier explanations (verified)

Phrased so the owner can test them in game or paste them on the ESR Discord. "Ask" = a question for the mod author (CelestialRay). "Test" = something one person can check in single player. Each item names the draft key it affects. Updated after the fact-check of 2026-11-06: new items are marked **(new)**, resolved items are listed at the end.

## Highest impact

1. **Leech in Hell rounds to nothing? (Test, then ask)** — `life-leech`, `mana-leech`
   ESR divides life leech by 150 in Hell and mana leech by 75 (`difficultylevels.txt`). In the 1.10 code the reduced value keeps 1/64 precision, so 20% leech becomes 0.125%, and 2% or less becomes 0. The research notes cite Maxroll as saying D2R rounds any leech below 1% after reductions down to 0 (not re-checked), which would make all item leech under 150% useless in Hell.
   Test: Hell, a character with only ~20–40% life leech and no other sustain, hit a normal monster (not a skeleton type) while below full life with regeneration removed. Does the life globe move on hits? Repeat in Nightmare.
   Ask: "Is life leech in Hell meant to be near zero for normal gear (20% → 0.13%)? Does D2R keep the fractional precision?"

2. **Poison Length Reduced and the difficulty penalty (Test, then ask)** **(new)** — `poison-length`, `resists`
   In the 1.10 code Poison Length Reduced is handled like a resistance: the difficulty resist penalty is added to it and it caps at 75% (D2MOO SUnitDmg.cpp:976–1009). With ESR's −150 in Hell, 75% from gear would become −75%, which would make poison last longer, not shorter.
   Test: Hell, compare how long a poison lasts on you with 0% and with as much Poison Length Reduced as you can stack. Repeat in Normal.
   Ask: "Does Poison Length Reduced get the −80/−150 resist penalty in Nightmare/Hell?"

3. **Which damage leeches? (Ask)** — `life-leech`
   The tooltip says "Physical Damage Leeched as Life", and the 1.10 code leeches physical only. But the damage-overflow-fix config describes D2R's leech code as summing "physical + fire + lightning + cold + magic" (`celestialrayone.damage-overflow-fix.toml` line 325).
   Ask: "Does leech in ESR 3.2 use only physical damage, or physical plus elemental?"

4. **Crushing Blow against yellow uniques: 12.5% or 6.25%? (Ask)** — `crushing-blow`
   `celestialrayone.crushing-blow.toml` line 35 has `unique = 25`, but the comment above it (line 34) says "50 -> 12.5 % of current life". With 25 the share is 25% × 25% = 6.25%.
   Ask: "In crushing-blow.toml the unique line says 50 → 12.5% but the value is 25 (= 6.25%). Which one is intended?"

5. **Fire thorns as Critical Strike? (Ask)** **(new)** — `deadly-strike`, `thorns`
   The critical-strike-damage config says the engine resolves "passive_critical_strike (stat 337)" in the crit block. In ESR's itemstatcost.txt, row 337 is `item_attackertakesfiredamage` ("Attacker Takes Fire Damage", events attackedinmelee/damagedbymissile func 11); there is no passive_critical_strike row.
   Ask: "Does the engine's Critical Strike roll now read stat 337, which ESR uses for fire thorns? Would a fire-thorns item give that much crit chance?"

6. **Deadly Strike over 100% (Test/Ask)** — `deadly-strike`
   Demon Limb and Lacerator (unique weapons) give bonuses for "every 1% deadly strike over 100%" / "over the cap", and their aura formulas subtract 100. There is also a hidden `item_deadlystrike_cap` stat (605) added by some cube recipes.
   Test: stack Deadly Strike above 100 with Demon Limb or Lacerator and watch whether the "over the cap" bonus appears.
   Ask: "What does item_deadlystrike_cap (605) do? Does it raise a Deadly Strike cap above 100?"

7. **Resist penalty in Normal is +1 (Ask)** — `resists`, penalties table
   `difficultylevels.txt` ResistPenalty Normal = 1 (vanilla 0; the old wiki also says 0). By the engine formula that is +1% to all elemental resists in Normal.
   Ask: "Is the Normal resist penalty of 1 intentional (+1%), or should it read 0?" Test: Normal, naked character, compare the character screen resist with the sum of gear.

## Mechanics to confirm in game

8. **Lightning thorns kill credit (Test)** **(new)** — `thorns`, `after-kill`
   The soft-hit-removal config gives kill credit to event function 6 (physical thorns, stat 78/238) but does not list function 10 (lightning thorns, stat 128) or 11 (fire thorns, 337). Test: kill a monster only with "Attacker Takes Lightning Damage" while wearing Life after each Kill; does life refill?

9. **AI curse divisor scope (Test)** **(new)** — `curse-resistance`, penalties table
   `AiCurseDivisor` (1/2/4) is read in the 1.10 code only for Terror, Confuse, Attract and Dim Vision. The old wiki says all curses last 1/2 and 1/4 as long in Nightmare and Hell. Test: cast Amplify Damage (or any non-AI curse) on the same monster in Normal and Hell and compare the duration.

10. **"on Melee Attack" with bows and crossbows (Test)** **(new)** — `chance-to-cast`
    Stat 195 lists `domeleeattack` and `domissileattack` (same as vanilla D2R data), but the old wiki quotes Amazon Basin: not applied to ranged attacks. Test with a bow and a chance-to-cast-on-attack item.

11. **Who gets halved −% Target Defense (Test)** — `target-defense`
    The attack-rating config says halved against "superuniques, uniques and hirelings"; the 1.10 code says players, bosses, superuniques and hirelings. Test with the character screen hit chance (it uses the live defense) against a yellow unique, a superunique and an act boss, with and without a −% Target Defense item.

12. **"when you Kill" procs on spell, minion and poison kills (Test)** — `chance-to-cast`
    ESR switched item_skillonkill from function 20 to function 30, which drops the hit-flag check. Does a "chance to cast when you kill" item now fire when a spell, a summon, poison or bleed lands the kill?

13. **Chance-to-cast and cooldowns (Ask)** — `chance-to-cast`
    Do procs respect the cooldown of the skill they cast (for example a proc of a skill with a 4 s cooldown)? Is there any internal proc cooldown?

14. **"when Taking Damage" vs "when Struck" (Ask)** — `chance-to-cast`
    Stat 376 uses the `absorbdamage` event, which the 1.10 code fires before resistances for every damage packet. Does it fire on every damage instance, including poison, bleed and spell damage?

15. **Thorns on missed or blocked melee (Test)** — `thorns`
    Item thorns use the `attackedinmelee` event. Does a monster take thorns damage when its melee attack misses or is blocked?

16. **Bleed and physical resist (Test)** — `bleed`
    Bleed uses the hit's physical damage "after damage reduction and absorb". Does that include the target's % physical resist? Test on a monster with high physical resist: is the bleed noticeably smaller?

17. **Life on Striking against undrainable monsters, Mana on Striking on mercenaries (Test)** — `on-striking`
    Skeleton-type monsters have no drain value (no leech). Does Life on Striking still heal when hitting them? It should by the code. **(new)** In the 1.10 code the mana function only works for players: does Mana on Striking do anything on a mercenary?

18. **Hit recovery threshold (Ask)** — `fhr`
    What damage triggers hit recovery in ESR 3.2 (community lore: 1/12 of max life)? Are ESR hit-recovery and block frame tables available like the official Frame Table for attack and cast speed?

19. **Summon Damage only at summoning? (Test)** — `summon-stats`
    The 3.9 author answer says +% Summon Damage counts only when the summon is created. Several summon skills apply it through aurastat formulas, which may update live. Test: summon, then equip a summon damage item; does the summon's damage change, or only after re-summoning?

20. **Magic Find exclusions (Ask)** — `magic-find`
    Old wiki: MF does not affect gems, runes, decals or coupons. Which other ESR item types ignore MF in 3.2 (crystals, organs, keys, maps, Worldstone Shards)?

21. **Spell crits from items (Ask)** — `deadly-strike`
    Six uniques (Voidrend, Dwarf Star, Earthshifter, Gargoyle's Bite, Icing Death, Raven Frost) carry hidden "<element> Damage Crit" auras that use your Deadly Strike as the chance. Does plain item Deadly Strike make spells crit without such an aura? Where do weapon-mastery crit chances come from in ESR (no skill row grants `passive_mastery_melee_crit`)?

22. **Elemental mastery on item elemental damage (Test)** — `elemental-mastery`
    The overflow-fix config says elemental damage "to attacks" goes through its mastery, as the 1.10 code does. Test: a melee character with +fire damage to attacks; does +% Fire Spell Damage raise the fire part of the weapon hit on the character screen?

23. **Hireling leech in Nightmare and Hell (Ask)** **(new)** — `life-leech`, penalties table
    In the 1.10 code the leech divisor is applied only when the attacker is a player, so hireling leech is not reduced. Is that still true in D2R/ESR?

## Data or tooling follow-ups (no game needed)

- The glossary parser only allows `term`, `definition`, `note` (`src/features/guide/build/content.ts:57`); the drafts add `link`.
- `rare-procs`: Prevent Monster Heal, Flee and Hit Blinds are effectively unused (0, 0 and 1 rows, the last a partial set bonus on Death's Hand); keep the entry only if the matcher meets them.
- Two summaries from the earlier research were wrong and are corrected in the drafts: FCR cap is 500, not 200 (`cast-rate-cap.toml`, official Frame Table); hit chance limits are 0–100, not 5–95 (`attack-rating.toml`).
- **(new)** The wiki's +32 per-item cap for +all skills / +class skills no longer matches the save format (item_allskills 16 bits / SaveAdd 1000); dropped from `skills`.
- **(new)** Cooldown floors: about 15 skills have no 20% floor (Leap Attack, Blade Warp, Sacrificial Offering, Call of the Wild, Death Mark, Mind Blast, Frozen Cascade, the teleport family). The app could compute each skill's floor from skills.txt instead of quoting "80% cap".

## Resolved by the fact-check

- **−% Enemy Resist below −100** (was 6): the floor patch lowers the floor "for all elements and all unit types" on the uncapped negative path, which is the one monsters use; pierce should now reach −1000. An in-game look is optional.
- **−% Enemy Resist for summons and mercenaries** (was 7): kept as a 3.9 caveat in `enemy-resist`; no 3.2 source found either way. Moved out of the question list because the Valkyrie row copies the owner's pierce stats to the pet (`skills.txt` Valkyrie passivecalc6–11), which supports "works for summons"; hirelings remain unknown.
- **Poison Length Reduced cap** (was 15): the 1.10 code does cap it at 75% for players (rows without a max-resist stat default to 75); folded into the new question 2.

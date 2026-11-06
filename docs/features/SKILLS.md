# Skills Feature

Every class skill tree and every item-granted skill from the ESR game files, with each skill's description, scalar
fields, synergies and the uniques, set items and runewords that grant it (`/skills`, `src/features/skills/`).

## Purpose

- Browse the 8 class trees (Amazon … Warlock) as the in-game grid: 3 tabs of 6 rows × 3 columns
- See what a skill does (description text, fixed values), its mana cost, level requirements, prerequisites and
  synergies
- Answer "which item gives me this skill?": every unique, set item and runeword that grants it, and how (usable
  skill, +levels, aura, charges, chance to cast on …), linked to that item's page
- Look up skills no class has: procs and item-only spells such as Rift Shot, Fire Surge or Mythical Decrepify
- Search every skill by name; share a view by URL
- Point to the official Frame Table (`FRAME_TABLE_URL` in `navConfig.ts`, `ias-calculator.html`; also an `OFFICIAL_LINKS`
  entry) for IAS and FCR breakpoints in the intro; the app does not compute breakpoints

Per-level values (damage, radius, duration, mana, aura and synergy bonuses at any skill level, with synergy points and a
character level) come from `skillcalc.json` and the calculator in `engine/skillCalc/` (see "Skill levels"). The
skilldetails.json `lines` stay the formula-free fixed lines (see "Text").

## Data

Three bundles under `public/game-data/` (see [Game Data](./GAME-DATA.md)):

| File                | Built by                          | Used for                                                         |
| ------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `skills.json`       | `build/bundleSkills.ts`           | Tree layout (tabs, row / column), also the builds feature        |
| `skilldetails.json` | `build/bundleSkillDetails.ts`     | Details per skill and the granting items (also builds)           |
| `skillcalc.json`    | `build/bundleSkillCalc.ts`        | Per-level values: line definitions, formulas, the rows they read |
| `icons/skills/*`    | `scripts/generate-skill-icons.ts` | 64 px WebP cels cropped from the mod's HD skill icon sheets      |

The details are a sibling bundle so `skills.json` (the trees, level cap and names the builds model validates against)
stays small (31 KB). The three bundles are generated in one run; the first two are joined by skill id in the browser
(`utils/skills.ts` `buildSkillsView`), and `skillcalc.json` loads lazily only where the calculator is shown (a detail
card, the skill peek: `hooks/useSkillCalc.ts`). The builds pages (a build's Skills tab, the create / edit form) load
the first two too, only when they draw a tree (`builds/hooks/useSkillTree.ts`), and reuse this page's tiles, layout and
detail card.

### skilldetails.json

`SkillDetailsBundle` (`engine/schema.ts`): `items` (the granting items, `{ kind, name }`, sorted by kind and name;
same-name rows such as the 20 Ember of Creation variants share one entry) and `skills`:

- **Which skills**: every class skill of the trees (skills.txt `charclass` set, a skilldesc row on page 1..3), in class /
  tab / row / column order, then the **item skills**: skills.txt rows without a `charclass` that have a skilldesc row
  and that at least one item grants. ESR 3.2.24: 280 + 181 = 461.
- **Scalars**: `reqLevel` (`reqlevel`), `maxLevel` (`maxlvl`), `reqSkills` (`reqskill1..3`), `type` (`aura` column = 1 →
  aura, else `passive` = 1 → passive), `element` (`EType` as a label: fire → Fire, ltng → Lightning, …), `mana`
  = `[mana, lvlmana] × 2^manashift / 256` (cost at level 1 and per extra level; Fire Bolt 8 / 2 / shift 6 → 2 + 0.5 per
  level). `minmana` and calc-modified costs (`usmc`) are not applied.
- **Text**: `name` = skilldesc `str name`, `description` = `str long` split into lines (`str short` is identical for
  every ESR row and is not stored). A stub description that only repeats the name (Lightning Flash) is dropped.
  The page joins hand-broken lines into sentences (a line starting in lower case continues the one above).
- **lines**: descline1..6 and dsc2line1..5 entries whose values need no formula: the text (`desctexta*`) resolves, there
  is no second text (`textb`, used for singular / plural pairs and two-part lines), and every placeholder is fed by a
  calc that is an integer, a skill param (`par8`) or `+ - * /` of those. Lines that are a bare label ending in ":" are
  left out ("Attack Rating:" whose value is another line). Multi-line strings of these lines read bottom-up in game
  ("cast rate to a minimum of 0.2 seconds\nTick rate goes down…" is shown reversed); the page keeps the line breaks.
  Mana cost, damage, duration and other formula lines are left out. The lines are in tooltip order, as the calculator
  returns them (see "Line order"): the dsc2 lines bottom-up, then the desc lines bottom-up, so they do not reorder when
  skillcalc.json loads (pinned in `bundleIntegrity.test.ts`).
- **synergies**: dsc3 lines after the `Sksyn` header ("%s Receives Bonuses From:"): textb is the synergy skill's name,
  texta the bonus format ("%s: %+d%% Fire Damage per Level"); `text` is the format without the name, with constants /
  params filled in and `?` for formulas ("+12% Fire Damage per Level", "+?% …"). `id` links to the skill when the name
  resolves (same class first) and differs from the name; the page links `id ?? name` when the bundle has that skill
  ("Any Other Curse" and "All sentries" stay plain text). A dsc3 line that is just a skill name is a synergy without a
  bonus. Other dsc3 texts without placeholders are `notes` (the "If both A and B have 20 levels: …" rules), read
  bottom-up like the lines.
- **icon**: `<class prefix>-<IconCel>` or `gen-<IconCel>` (see "Icons").
- **grantedBy**: `{ item, how, level, chance?, charges?, partial? }` per granting property (deduplicated):

| `how`                                                                                                                 | Columns                      | Shown as                                    |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| `oskill`                                                                                                              | par = skill, min–max = level | "+N levels (any class)" (usable skill)      |
| `skill`                                                                                                               | par = skill, min–max = level | "+N levels (class only)"                    |
| `aura`                                                                                                                | par = skill, min–max = level | "Level N aura when equipped"                |
| `charged`                                                                                                             | min = charges, max = level   | "Level N, C charges"                        |
| `hit-skill`, `att-skill`, `gethit-skill`, `kill-skill`, `death-skill`, `levelup-skill`, `cast-skill`, `takedmg-skill` | min = % chance, max = level  | "C% chance to cast level N on striking / …" |

Sources: uniqueitems.txt `prop1..12` (rows with an `index`, not `disabled`), setitems.txt `prop1..9` and the partial
bonuses `aprop1..5 a/b` (`partial: true`), runes.txt `T1Code1..7` (every recipe with a resolvable name: a recipe with
a rune code is a runeword, otherwise a gemword). The `par` is a skills.txt `skill` name (exact, then case-insensitive,
then a numeric row id). Not followed: the hidden variants (`oskill-hidden`, `aura-hidden`, `hit-skill-hidden`, …:
invisible on the item, mostly internal mechanics), random skills (`skill-rand`, `oskill-rand`), propertygroups.txt
pools and the set-wide bonuses of sets.txt.

Counts (manifest, ESR 3.2.24): `skillDetails` 461, `skillDetailsItemSkills` 181, `skillDetailsWithGrants` 438,
`skillDetailsWithSynergies` 226, `skillDetailsWithoutDescription` 93 (mostly item skills: ESR's surges, masteries,
trophies), `skillGrantItems` 1185, `skillGrants` 3122, `skillGrantsUndescribed` 0 (grants of class-less skills
without a skilldesc row, not listed), `skillIcons` 325. Size: 387 KB / 61 KB gzip.

Warnings (manifest): `skilldetails: unknown skill in <prop> "<par>" (<item>)` (ESR 3.2.24: one, Ember of Creation's
`oskill Axe Swarm`), missing name / description / dsc3 strings, duplicate skills.txt ids.

### Icons

The mod ships each class's skill icons as one horizontal sheet: `data/hd/global/ui/spells/<class>/<xx>skillicon.sprite`
(the sprite header's frame count is the number of 132 × 130 cels; Sorceress 100, Amazon 72, …). skilldesc.txt
`IconCel` is the cel; even cels are the icon, the odd cel after it the pressed variant. Skills without a class use
`spells/submenu/skillicon.sprite` (123 cels: Attack 2, Kick 0, Unsummon 4, Throw 6, and from cel 88 on ESR's
red-framed item skill icons such as Rift Shot 90). The `skillicon2` / `skillicon3` sheets (60 cels each) and the
`.lowend` copies are not used: skilldesc has no sheet column and every class `IconCel` fits the first sheet.

The mapping was checked by rendering cels (Fire Bolt 0 = the comet, Ice Bolt 6, Static Field 12, Teleport 36,
Blizzard 46, Whirlwind 50, Bone Spear 36, Werewolf 20, Summon Goatman 2, Attack / Unsummon / Throw on the generic
sheet). Many item skills share placeholder cels (generic cel 42 for Lightning Flash, Cold Flash, Shackles, …): that is
what the game files reference.

`npm run game-data:skill-icons` (also the last step of `npm run game-data:icons`) reads the icon keys of the committed
`skilldetails.json`, crops each cel, scales it to 64 × 63 and writes `icons/skills/<key>.webp` (WebP quality 80;
ESR 3.2.24: 325 files, 433 KB). The key names the file, so there is no separate index; the manifest count
`skillIcons` is the number of keys. `--check` (part of `npm run game-data:check`) fails on a changed, missing or
orphaned file and on a key whose cel is outside its sheet. No vanilla art is needed.

## Skill levels

The calculator evaluates a skill's tooltip lines at any skill level (1–110, 110 being the owner's "theoretical max")
from the game's own formulas, shipped in `skillcalc.json`. It is pure TypeScript (`src/features/game-data/engine/
skillCalc/`), shared by the bundle builder (Node) and the browser, which loads the bundle lazily where the calculator
is shown.

### skillcalc.json

`SkillCalcBundle` (`engine/schema.ts`), built by `build/bundleSkillCalc.ts`:

- **skills**: one record per skilldetails.json skill, same order. `lines` = the shown skilldesc lines in file order
  (`evaluateSkill` / `skillTable` return them in tooltip order, see "Line order"):
  `desc1..6` (the per-level block), `dsc2-1..5` (pinned lines, may still vary), `dsc3-1..7` (the synergy block), each
  with its line function `type`, texts `a` / `b` (indexes into `texts`), formulas `ca` / `cb` and the flags `ulvl` /
  `blvl`. `maxHardPoints` = skills.txt `maxlvl` for class skills, 0 for item skills (items never give hard points).
  `synergies` = the skills.txt ids of the skills the dsc3 "Receives Bonuses From" lines name (skilldetails.json
  `synergies` that resolve to a skills.txt row other than the skill itself; `*Passive` / `*Control` rows excluded).
  `unlistedSynergies` = other skills of the same class tree whose points the shown lines read without the tooltip
  listing them (Weaken reads every curse's hard points through Attack's `calc1`; Werewolf reads Lycanthropy), kept only
  when that skill alone at its cap (the other inputs at 0, ascendancy gates at 0) changes a shown line at a sample
  level: Fire Ball reads Zap, Conduit, Storm Nexus and Static Focus only behind `skill('Eschuta Temper Passive'.lvl)>0`,
  so it has none. ESR 3.2.24: 73 skills, 235 inputs (104 / 343 before the filter). Other classes' skills are left out
  (only Elemental Nova and Fist of the Heavens read any), as are `*Passive` / `*Control` rows and item skills. Flags: `scalesWithCharLevel`, `scalesWithHardPointsOnly`, `hiddenStatLines`, `hiddenOtherLines`, `itemEffect`.
- **rows** / **missiles**: the skills.txt / missiles.txt rows the shown lines' formulas can read on any branch
  (`collectFormulaRefs`: formula columns, `skill()` / `sklvl()` / `miss()` targets and skilldesc descmissiles,
  transitively), each cut to those columns; numbers as numbers, formulas as text, blank / 0 cells left out. Synergy
  rows (listed and unlisted) also carry `maxlvl` (the input cap). descmissile1..3 are copied from skilldesc onto the skill row.
- **texts**: every line text once (format strings and skill names through the strings).

A self-check at build time evaluates the shown lines again from the cut rows and warns
(`skillcalc: the cut rows change …`) on any difference. The builder also warns on every formula cell in the bundle
where the game's compiler ignores part of the formula (`stopped at "&"`, an unclosed `(`, left-over values) and on
`stat('x'.…)` names that are not in itemstatcost.txt (a trailing space: `'item_demondamage_percent '` on the DEFUNCT
ballistas, not in the bundle; the game resolves an unknown link name to index 0, the calculator reads 0).

### Evaluator

`engine/skillCalc/parse.ts` (a port of the game's Fog compiler that builds a tree, cached per text), `evaluate.ts` (`CalcRun`: the code
tables, damage helpers, reads), `lines.ts` (line functions), `text.ts` (printf with marked numbers, `bottomUp`),
`index.ts` (public API). Semantics follow D2MOO (`SKILLS_GetSpecialParamValue`, `SKILLS_GetMin/MaxElemDamage`,
`SKILLS_GetElementalLength`, `SKILLS_GetManaCosts`, `D2Common_11033`, `MISSILE_GetSpecialParamValue`, Fog `Calc.cpp`) and
the D2R Data Guide's SkillCalc / MissCalc code lists:

- 32-bit integer math, `/` truncates toward 0, `x / 0` = 0, `^` repeated multiply (exponent ≤ 0 → 1), comparisons
  give 1 / 0, `cond ? a : b`, `min` / `max`.
- **Parsing = the game's compiler** (D2MOO `DATATBLS_CompileExpression`, `DATATABLS_CheckPrecendence`,
  `DATATBLS_Evaluate_HandleNewOp`), ported in `parse.ts`, not a conventional grammar. Arithmetic and comparisons bind as
  usual (left-associative, `-2^2` = `(-2)^2`), but the ternary (precedence 22) is pushed above anything pending, `?`
  pops only a previous ternary, `:` pops nothing, and any operator after the else-operand applies the ternary first:
  `a < b ? c : d` = `a < (b ? c : d)`, `-(x) ? 0 : y` = `-(x ? 0 : y)` (Cloak of Shadows: Enemy Physical Resist −10%
  at level 1), `(c ? 5 : 0 + lvl/5)` = `(c ? 5 : 0) + lvl/5` (Sharpened Focus: −14% / −24% at level 20), and the
  Spirit / Dire Wolf `petmax` chain. `-` is a negation only when no value precedes it (`?`, `:`, `,`, `(`, `)` and `^`
  keep that state, so `c ? 1 : -x` subtracts). An operator with too few values on the stack fails the formula (shown
  as `parse`); an unknown character (`&`, `_`, a lone `=`) ends the formula; an unclosed `(` stops the evaluation there.
  Tests pin these cases (`evaluate.test.ts`, `bundleIntegrity.test.ts`); a second independent port agrees on all 1029
  bundle formulas. D2MOO's evaluator has no `break` after `AST_Ternary`, which would return right after the first
  ternary; this is most likely a transcription slip (ESR's formulas would then mostly show the ternary alone), not
  verified, so the calculator evaluates the whole formula.
- Codes: `lvl`, `blvl`, `ulvl`, `par1..par9` / `pa10..pa20`, `ln12/34/56/78/91/21` (`a + (lvl-1)·b`, 0 at level ≤ 0),
  `dm12…` (`a + (b-a)·(110·lvl/(lvl+6))/100`, capped at b, so every dm value stops at level 60), `clc1..10`,
  `ast1..6`, `pst1..14`, `len`, `rng`, `pets`, `skpt`, `toht`, `usmc` / `mana` / `mps`, `edmn` / `edmx` / `edns` /
  `edxs` / `enma` / `exma` / `enms` / `exms`, `edln` / `edma`, `pnma` / `pxma` / `pnms` / `pxms`, `m1en..m3el`,
  `m1rn..m3rn`, `m1eo` / `m1ey`. Mastery codes are refused: `math` / `madm` / `macr` evaluate the skill's own
  passivecalc whose passivestat is a melee / throwing mastery stat (`D2Common_11032`; ESR uses none), `mael` / `mapi` /
  `manc` are D2R codes D2MOO does not cover (`mael`: Meteor Sentry's average fire damage line, hidden). Functions: `skill('X'.code)` (X's code at X's
  level), `sklvl('X'.a.b)` (X's b at this skill's a), `sksrc('X'.lvl)`, `stat('x'.accr|base)`, `miss('m'.code)`
  (missile code at this skill's level), `min`, `max`, `rand`.
- Damage: per-level damage for levels 2-8, 9-16, 17-22, 23-28 and 29+ (`L1..L5`, linear from 29 on); skill elemental
  damage `(EMin + bonus) << HitShift`, then `EDmgSymPerCalc` % (for the minimum only when above 256 or `EMinLev1` ≠ 0);
  missiles apply their synergy % before the shift. Elemental length: `ELevLen1` for 2-8, `ELevLen2` for 9-16,
  `ELevLen3` from 17, + `ELen`, + `ELenSymPerCalc` % (frames, 25 per second). Mana `(mana + (lvl-1)·lvlmana) <<
manashift` in 256ths (minmana applies when casting, not in the tooltip). Skill-only physical damage `pnma` / `pxma`:
  `MinDam` + bonus, + `DmgSymPerCalc` %, `<< HitShift`; skills with `Kick` use strength + dexterity.
- Every read is recorded (stats, `ulvl`, own and other skills' points, `rand`, refused tokens). A refused token gives
  0 and makes the line `unavailable`: the calculator never shows a number it cannot stand behind.

### The character

- `level` = skill level with +skills; own hard points `blvl` default `min(level, maxHardPoints)` (0 for item skills).
- `charLevel` (`ulvl`) default 110.
- Other skills: hard points from the synergy inputs (default 0); their level (`.lvl`) = their hard points (a
  simplification: in game it includes the character's +skills). The base
  skills Attack, Kick, Throw, Unsummon, Left Hand Throw / Swing are at least 1. `skill('X'.clc3)` of a skill the
  character lacks is evaluated at level 0 (params and calcs still evaluate, `ln12` / damage / mana give 0), as in the
  engine.
- Every stat is 0: no items, no ascendancy, no passive masteries, `playermode` 0. ESR uses many stats as 0/1 toggles or
  gear counters (`weaponmastery`, `item_corrupted`, `item_skill_cooldown`, `randomgenerator`, `skillcontrol*`); at 0 the
  value is the bare character's tooltip.

### Which lines are shown

The builder evaluates every line at levels 1..110 in three states: no synergies, every listed synergy at its `maxlvl`,
and every class-tree skill the line reads (of any class, repeated while new reads appear) at its `maxlvl`. ESR's
ascendancy / item passives (`*Passive`), `*Control` rows and item skills stay at 0 in every state, so their gated lines
stay hidden. The third state keeps Fire Claws' and Fury's resist lines, Poison Weapon's and Bone Armor's bonus lines,
Reap Souls' poison resist, and Werewolf / Werebear's Max Life (+96% with Lycanthropy at 20). A line is left out (counted in the manifest, `skillCalcHidden*`, and on the skill) when:

| Reason        | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`      | line function 13 (summon life: monstats.txt life × %), 31 (difficulty divisor), 34 (summon damage), 56 (book quantity)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `type`        | a line function the calculator does not format                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `string`      | texta / textb missing from the strings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `format`      | the text has more placeholders than the line function fills                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `parse`       | a formula it reaches does not parse                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `unsupported` | a formula it reaches uses an unknown code / function / skill / missile, text in a numeric column, a recursion (a formula column read again while it is being evaluated, or 40 levels deep), more than 200,000 formula nodes in one formula (`steps`), or an ambiguous code                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `random`      | it reaches `rand(a, b)` with a < b (the engine rolls; a tooltip value would be one roll). `rand(a, a)` = a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `stat`        | **its value changes when the character stats are set**: strength, dexterity, vitality, energy, life, mana, stamina (pools full), level, experience, defense, attack rating are set to two probe value sets at 14 sample levels; if any value differs from the all-0 state the line is about the character, not the skill (Righteous Fire's damage from max life, Wisdom of Athulua's per-attribute bonuses). Those stats are never 0 on a real character, unlike gear / toggle stats. A stat read that the line does not depend on (Might's `maxhp/25600` behind an ascendancy gate, `hitpoints·3 < maxhp` at full life) keeps the line. `hiddenStatLines` on the skill tells the UI how many lines depend on character stats |
| `gated`       | every number in it is 0 at every level in all three states: ESR's ascendancy / item gates (a 0-second cooldown without the item effect)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Kept lines get `ulvl` when the value differs between character level 1, 55 and 110 at a sample level (only 3 skills:
Venom, Hex Purge, Eldritch Blast), `blvl` when it differs between the default hard points and 1 hard point at a sample
level (ESR passives that scale with hard points only: Lycanthropy, Molten Focus, Critical Strike, …).

### Line functions

`lines.ts` formats the line functions ESR uses: 74 `printf(a, calca)`, 75 `printf(a, calca, calcb)`, 76
`printf(a, b, calca)` (synergy lines), 77 `printf(a, b, calca, calcb)`, 79 `printf(a, b, calca / calcb)`, 36
`calca / calcb` (calcb blank = 1) with texta when the shown value is exactly 1 and textb otherwise (texta when there is
no textb), 40 header `printf(a, b)` with `calca` = colour, 18 text, 78 `printf(a, b)`, 25 `a + b`, the old 3
(`a + value + b`), 4 (`a + "+" value`), 5 (`a + value`), 6 (`"+" value + a`), 63 (`a: +value% b`) and 67
(`a: +value b`). 3-6 and 63 follow the Phrozen Keep SkillDesc.txt File Guide (`4 '%s+%d',desctexta,desccalca`,
`6 '+%d%s',desccalca,desctexta`): types 4 and 6 print no textb, so Vigor of the Ancients shows "+76 to Vitality" (its
textb " percent" is dropped). The guide's 67 (`'%s+%d%s'`) would print "Lycanthropy+1Second per Level", so 67 keeps the
63 layout. Multi-line strings read bottom-up, like skilldetails.json's lines.

### Line order

`evaluateSkill` and `skillTable` return the lines top to bottom as the tooltip draws them: the dsc2 block bottom-up
(the last dsc2line first), the desc block bottom-up (descline1 last), then the dsc3 block top-down. Evidence: the
Phrozen Keep SkillDesc.txt File Guide ("desc and dsc2 add their lines to the description from bottom to top while
dsc3 goes from top to bottom"; layout: name, long description, dsc2 lines, current / next level desc lines, dsc3
lines) and the data: descline1 is the Mana Cost line of most skills, which the game shows last in the level block.
skilldetails.json `lines` (the fallback without the calculator) use the same order.

### Public API (`engine/skillCalc/index.ts`)

```ts
const index = indexSkillCalc(bundle); // cached per bundle object
const skill = index.record('Fire Ball'); // SkillCalcSkill | undefined
defaultContext(skill, { level, hardPoints?, charLevel?, synergyPoints? }); // SkillCalcContext of a bare character
evaluateSkill(skill, index, ctx); // SkillLineResult[]: key, block, type, text, values, before/span/after, color?, unavailable?
skillTable(skill, index, [1, 20, 30, 50, 110], { synergyPoints, charLevel }); // SkillTableRow[]: label, cells, varies
synergyInputs(skill, index); // [{ id, max, listed }]: listed synergies, then unlistedSynergies, once per skill id
maxSynergyPoints(skill, index); // every synergy input (listed and unlisted) at its cap
tooltipOrder(skill.lines); // lines top to bottom as the tooltip draws them
itemTriggerInfo(skill); // { value: 'yes' | 'unknown', reason }
```

`itemTriggerInfo`: skills.txt `ItemEffect` is the server function the game runs when an item event (chance to cast on
striking, when struck, …) triggers the skill (Data Guide). Set → yes (328 of 461). Blank → unknown, not no: ESR grants
Maelstrom Cascade Proc as a chance-to-cast with a blank ItemEffect. Whether _using_ a skill fires on-striking procs has no
column: it depends on the skill's server function and damage path in the engine, so the calculator does not say.

### In-game checks

The calculator's numbers come from the game files and the community's descriptions of the engine; none of the lines
below has been compared with the game yet. The in-game tooltip shows the current and the next level, so a low-level
character (or one with known +skills) can check them. Bare character (no items, no ascendancy), no synergies unless
stated; "Level (hard pts)" gives the skill level and, in brackets, the hard points when they differ. Fill in "Result"
after checking.

| Skill                                        | Level (hard pts)  | Line                              | We show                                                                                         | Look for                               | Result |
| -------------------------------------------- | ----------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- | ------ |
| Blizzard                                     | 1                 | Radius                            | 5.3 yards                                                                                       | type-36 decimals: 5.3 vs 5.33          |        |
| Fire Ball                                    | 2 / 20            | Mana Cost                         | 5.5 / 14.5                                                                                      | half-mana display                      |        |
| Multiple Shot                                | 10                | Mana Cost                         | 3.3                                                                                             | rounding of 3.33                       |        |
| Raise Skeleton                               | 1                 | skeleton count                    | "1 skeleton total"                                                                              | singular text at exactly 1             |        |
| Blizzard                                     | 1                 | Cooldown / Cold and Freeze Length | "1 second" / "1 seconds"                                                                        | the second is ESR data (textb = texta) |        |
| Multiple Shot                                | 10 (next 11 = 14) | Missiles                          | 13                                                                                              | dm integer math: 13 vs 14              |        |
| Fade                                         | 1 (next 2 = 42%)  | curse duration                    | 34%                                                                                             | dm: 34 vs 35                           |        |
| Fire Ball                                    | 1                 | line order                        | text, Radius 4, Resist −10%, Fire Damage 10-20, Mana Cost 5 last                                | bottom-up desc block                   |        |
| Reap Souls                                   | 1                 | dsc2 order                        | "Requires Polearm or Knife", "0% … Magic", "50% Weapon Damage", "Up to -0% Enemy Poison Resist" | dsc2 bottom-up                         |        |
| Cloak of Shadows                             | 1 / 2             | Enemy Physical Resist             | −10% / −11%                                                                                     | a conventional parser would give +10%  |        |
| Sharpened Focus                              | 5 (5) / 8 (5)     | Phys / Elem resists               | −6% / −12%; at 8: −6% / −13%                                                                    | old parse gave −5% / −11%              |        |
| Vigor of the Ancients                        | 1 / 6 (5)         | Vitality                          | "+10 to Vitality" / "+23"; run speed +10% / +14%                                                | no "percent" in the text               |        |
| Feral Rage                                   | any               | synergy                           | "Lycanthropy: +1 Second per Level"                                                              | type-67 layout                         |        |
| Raise Skeleton                               | 1 / 2             | Physical Damage                   | 4-4 / 12-12                                                                                     | min-min as the data says?              |        |
| Raise Skeleton                               | 1                 | Life                              | hidden (type 13)                                                                                | the value the game shows               |        |
| Hellfire Lance                               | 1                 | Cooldown                          | not shown                                                                                       | is a cooldown line shown?              |        |
| Overseer Volley (Shenk's Mask, oskill 10-30) | 10                | Avg Lightning / Cold              | hidden; Fire 225-375, Mana 38                                                                   | the hidden values; the fire value      |        |
| Fire Ball + 5 Fire Bolt                      | 1 / 2             | Fire Damage                       | 13-26 / 15-31 (no synergy 10-20 / 12-24)                                                        | synergy % applied                      |        |

What the rows test: type-36 decimals (one decimal at most, rounded) and the singular text at exactly 1 are from vanilla
memory and the Data Guide; the line functions 5 / 6 / 67 and the line order (dsc2 / desc bottom-up, dsc3 top-down) from
one community guide and the Mana Cost convention; the compiler quirks (ternary, minus) from D2MOO's port of Fog;
Raise Skeleton (and Fire Golem) "Physical Damage" use `pnma` for both values in ESR's skilldesc (shown as the data says:
4-4, 204-204); summon life (type 13) needs monstats.txt and the difficulty and is not computed.

Other assumptions, not checked yet:

- D2R-only codes taken by analogy with the documented ones: `clc5..10`, `pst6..14`, `pa13..pa20`, `ln91` / `dm91` /
  `ln21` / `dm21`, `sksrc('X'.lvl)` read like `skill('X'.lvl)`, `sklvl('X'.a.b)`. missiles.txt `Range` holds formulas in
  ESR ("90+25*lvl", no `LevRange`): evaluated as a missile formula at the skill level.
- The old line functions 3 / 4 / 63 (one community guide, "a first pass") and the D2R 79 (inferred from its texts).
- Refused, left for round 2: `m2eo` / `m2ey` / `me3o` / `me3y` (D2MOO picks descmissile1 / 2 for them, a copy-paste bug
  D2R may have fixed: Overseer Volley), `m1nm` / `m1xm` (not in the Data Guide: Miasma Chains, Abyss), missile `rad`, the
  broken `clc0` (Frenzy, Mirrored Blades), `ln43` (Bind Demon), the mastery code `mael` (Meteor Sentry), Plague
  Javelin's descmissile that is not in missiles.txt, and the two lines whose strings are missing.

## Page

Route `/skills` (`SkillsScreen`, lazy-loaded), nav: Database ▾ → Skills (after Ascendancies), also a chip on the home
page's Database card. The home search lists every skill name (class and item skills from `skilldetails.json`,
same-named variants suffixed like "Amplify Damage (Aura)") and links to `/skills?skill=<id>`.

- **Class pills**: the 8 classes in types.json order plus "Item skills" (with its count).
- **Trees**: each tab is a card with a 6 × 3 CSS grid; a tile (icon, name, required level) sits at its skilldesc row /
  column. From `lg` (1024 px) the three tabs are side by side and the detail card is a sticky column on the right;
  below that one tab is shown at a time (tab pills) and the card follows the tree (a tap scrolls to it).
- **Selection**: the selected tile is ringed; its prerequisites (transitively) are amber, the skills it unlocks
  directly sky blue.
- **Detail card**: icon, name, class · tab (or "Item skill", plus the skills.txt id when it differs from the name),
  fact chips (required level, max level, mana, element, aura / passive) and the calculator's tags (dashed, explained
  on hover: "Scales with character level", "Scales with hard points only" (+skills do not raise that part), "Item procs
  can cast this" / "Unknown whether item procs can cast this" from `itemTriggerInfo`), description, the **values per
  level** (below), Requires / Unlocks links, "Receives bonuses from" (linked; with a hard-points input 0..cap per
  synergy the calculator knows and the computed bonus text instead of `+?%`; a skill listed twice, such as Blizzard's
  two Orb of Winter bonuses, gets the input on its first line only (`synergyLineInputs`); then "Also affected by (not listed in the
  tooltip)": the record's `unlistedSynergies`, linked, with the same hard-points inputs), notes, and **Granted by**,
  grouped into
  Usable skill, +Skill levels, Aura when equipped, Charges and Chance to cast; 8 per group, then "Show all N". Every
  grant except "+N levels (class only)" (a bonus on top of the character's points, not a level) gets a muted line with
  the skill's headline values at the item's level (a range's maximum, no hard points: items never give any): the first
  one or two per-level lines that vary, mana left out, damage lines first, then attack rating / defense / life lines,
  then the others in tooltip order (`headlineKeys`): "Lvl 40 – Fire Damage: 260-348 · Radius: 6.7 yards". The line
  ends in "(no hard points)" when those values differ from the ones at the default hard points (`min(level, max level)`,
  what the calculator below uses): both are evaluated per row (`grantHeadline`; Venom, Lycanthropy, the masteries …,
  34 skills at level 20), not taken from the skill's `scalesWithHardPointsOnly` flag. The values are computed from the
  current synergy points and character level on every render (no cache across renders: the React Compiler would keep
  one). The level is a button that sets the calculator's level and scrolls the values block's top (controls and "At
  level N") into view, also on a phone where the block is taller than the screen (the page scrolls below `lg`, the
  sticky detail column from `lg`; `scrollToTop` in `useDetailScroll.ts`); an open All levels table scrolls the selected
  row into view inside its own box. Builds: a level below the allocated points is plain text, "Below this build's N
  points". Item links: uniques →
  `/uniques?name=`, or `/mythicals?name=` when the HTM mythicals list in IndexedDB has the name; set items →
  `/game-data/sets?name=`; runewords → `/runewords?name=`; gemwords → `/gemwords?name=` (the pages' exact-name focus).
- **Item skills**: the 181 class-less granted skills as a tile grid by name; the subtitle is the number of granting
  items, and same-name skills (Empowered Enchant × 6, Chain Lightning × 2, …) also show the id suffix ("Cold",
  "Djinn").
- **Search**: name search over all class and item skills (every word or "quoted phrase" must occur, case-insensitive); results replace
  the trees, picking one opens its class.
- **Values per level** (`components/SkillLevelValues.tsx`): `skillcalc.json` loads lazily the first time a card
  is shown (`hooks/useSkillCalc.ts`, kept for the page's lifetime); until then (a small "Loading the values per level…"
  line), on a load error and for a skill without a calc record or lines, the card shows skilldetails.json's fixed
  `lines` as before. With the calculator, the fixed lines come from its `fixed` block instead (no duplicates). In order:
  - controls: **Skill level** (number input + slider, 1..110, default 20; quick buttons 1 / 20 / 30 / 50 / 110\*),
    **Character level** (1..110, default 110; only for skills with `scalesWithCharLevel`), **Max synergies** (checkbox;
    every synergy input, listed and unlisted, at its own cap: skills.txt `maxlvl`). Without varying lines the skill level
    controls are hidden (the character level and synergy controls stay). The slider commits its level on release (and
    per keyboard step) and the number inputs after a 250 ms pause, on Enter or on blur, so the URL is not rewritten on
    every tick (browsers throttle `replaceState`: Safari throws after ~100 calls in 10 s).
  - **At level N**: the `level` and `fixed` blocks at that state (blue, tooltip order), then muted notes "N lines
    depend on character stats and are not shown" (`hiddenStatLines`) and "N other lines are not shown: the game engine
    computes them … or the calculator does not support their formulas yet" (`hiddenOtherLines`).
  - the compact table at levels 1 / 20 / 30 / 50 / 110\* (`skillTable`): one label row per line that varies (synergy
    block left out) with the five values under it; the selected level's column is highlighted. A trailing text every
    cell shares moves into the label ("Radius (yards)", "Average Fire Damage (per second)"), "%" stays in the cells
    (`utils/skillLevels.ts` `tableRow`), so a cell on a phone holds one number.
  - **All levels** (`<details>`, closed; computed only while open): rows = levels 1..20, then every 5th to 110, plus
    the selected level; columns = the varying lines; sticky header and level column, scrolls inside its own box
    (max 28rem high), the selected row highlighted.
  - an assumptions note: a character without items or ascendancy bonuses, levels above 20 need +skills, \*110 is the
    theoretical max (player community), formulas from the game files, not all verified in game.

  Every value (at-level lines, both tables, synergy texts, the Granted by values) uses the current synergy points and
  character level. Below `lg` the card is full width under the trees; the controls and the compact table fit 375 px
  (a table wraps a long range at its hyphen rather than scrolling the page).

- **URL state**: `class` (class code or `items`), `tab` (1..3, narrow screens; omitted for 1), `skill` (skills.txt id),
  `search`, and the calculator's `lvl` (skill level, omitted at 20), `clvl` (character level, omitted at 110) and `syn`
  (`max`, or the selected skill's synergy points in `synergyInputs` order, the listed synergies then the unlisted ones,
  joined with "." such as `syn=5.0.20`, trailing zeros cut, at most 40 entries of 0..99; omitted when none). The level and character level stay when another skill is picked (compare skills at the
  same level); synergy points belong to one skill and are reset then, unless `syn=max`. A link with only `skill` opens
  the skill's class and tab. "Copy Link" shares the view.
- **Builds**: a build's Skills tab and the create / edit form reuse the card through `BuildSkillTrees`, which passes a
  `levels` config (`SkillLevelsConfig`: state, hard points, onChange, plus slots for its own level control, a note and
  a synergy action, and `minPickLevel`). Level = the build's allocated points + a "+Skills from gear" input (default 0,
  up to 110 − points, local, not saved);
  hard points = the allocated points; synergy points default to the build's own points in each synergy skill (editable,
  "Reset to build"; reset on another skill unless Max synergies is on). A skill with 0 points shows the normal level
  controls with "Not learned in this build: the level below is not tied to the build." The character level input is
  local too (default 110, not the build's level).

## Skill peek on item lines

Skill names in item property lines are links with a peek (`utils/skillRefs.ts`, `components/SkillRefText.tsx`): hover
(mouse), focus (keyboard) or a first tap (touch) opens a small card with the skill's icon, name (+ the id suffix of
same-name skills), class or "Item skill", what the line gives, the first one or two per-level values that vary (as in
"Granted by": mana left out, no synergies, character level 110) and "Open in Skills →". A click (or a second tap on the
same name) opens `/skills?skill=<id>&lvl=<N>` (`lvl` omitted at 20). The values are picked like "Granted by"'s
(`headlineKeys`: damage lines first).

**Keyboard and screen readers** (decision of 2026-11-06): the names are not tab stops (`tabIndex={-1}`): a uniques
page has ~1,560 of them, which made it ~70% more Tab presses to get through the items. They stay real links (mouse,
touch, screen readers' link lists and their link navigation), marked `aria-haspopup="dialog"`; the peek's popover
(Radix `role="dialog"`) is named by the skill (`aria-label`). Keyboard users reach a skill through the Skills page or
its search instead of the peek.

**Templates** (whole line, case-insensitive, trailing footnote `*` marks allowed; nothing else is matched, so skill names
in prose such as "Your Teleport now automatically casts …" stay plain text):

| Kind      | Template                                                          | Level shown                                                           |
| --------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `chance`  | `C% Chance to Cast Level L <skill> <event>`                       | L                                                                     |
| `aura`    | `Level L <skill> Aura When Equipped` (L may be `(a to b)`)        | L (a range's maximum)                                                 |
| `charges` | `Level L <skill> (C/C Charges)`                                   | L                                                                     |
| `plus`    | `+N to <skill>`, `… (All Classes)`, `… (<Class> Only)` (`To` too) | "+N skill levels": item skills at N, class skills at 20 for reference |

Events: on Striking, on Melee Attack, on Attack, when Struck, when you Kill an Enemy, When you Die, on Casting a Skill,
when Taking Damage, when you Level Up (`hit-skill`, `att-skill`, `gethit-skill`, `kill-skill`, `death-skill`,
`cast-skill`, `takedmg-skill`, `levelup-skill`). The same templates cover the HTM pages and the game-data strings
(descfunc 15 / 16 / 24 / 27 / 28). ESR's HTM pages print `+N to X (All Classes)` as the item's oskill and skill levels
summed (Reason: oskill 3 + skill 17 = "+20 to Soul Shiver"), so a plus line's level is never matched against the grants.

**Names and ambiguity**: the name must equal a skilldetails.json skill name exactly (case-insensitive; a `Map` by
lower-case name). Non-skill targets ("All Skills", "Fire Skills", "Trap Limit", "Random Class Skill", procs without a
skilldesc row such as Annihilation) stay plain text. When several skills share the name (Amplify Damage / Amplify
Damage Aura, Conduit / Conduit Proc, Holy Bolt / Holy Bolt Weapon Damage, Empowered Enchant × 6, …):

1. a `(<Class> Only)` hint keeps that class's skill; a hint naming another class (or a non-class word) gives no link;
2. the line's item (the renderer passes `{ kind, name }`, matched by kind + normalised name against the bundle's
   `items`): the one candidate that item grants the same way (`aura`, `charged`, the event property, `skill` / `oskill`);
   several → no link;
3. without the item (or when it grants none of them, e.g. ESR's random auras): the one candidate any item grants the same
   way at that level (and chance; plus lines: any level);
4. otherwise no link. A wrong link is worse than none.

**Data**: the first `SkillRefText` that renders starts loading skilldetails.json on idle (`requestIdleCallback`,
3 s timeout; 1 s timer without it), cached for the page's lifetime (`hooks/useSkillRefIndex.ts`); lines render as plain
text until then and after a failed load. The popover (Radix Popover, floating-ui), the card, skillcalc.json and the
calculator load only with the first peek (`SkillPeekHost` with `SkillPeekCard` is a lazy chunk; the app shell keeps
only the delegation hook). `skillRefs.ts` imports neither `skills.ts` nor `skillLevels.ts` (they pull in the
calculator); it copies their route, params and default / max level, and the test checks the copies. Matching costs ~1 µs
per line (32k fixture lines in ~22 ms).

**One popover**: `SkillPeekLayer` (mounted once in `AppLayout` around the routed page) delegates pointer / focus / click
events from anchors marked `data-skill-ref` (the reference as JSON, `utils/skillRefData.ts`) and renders one shared
`PeekPopover` (`hooks/useSkillRefPeek.ts`, the stash table's useItemPeek pattern) through the lazy `SkillPeekHost`.
Anchors inside another popover (the stash table's item peek) keep only their link. Inside a `<form>` (the build editor)
a click, tap or Enter opens the peek instead of navigating, so edits are not lost, and the peek's "Open in Skills"
link opens a new tab (`target="_blank"`). Ctrl / Cmd / Shift / Alt clicks and other mouse buttons are never
intercepted (open in a new tab or window). A peek belongs to the page (path + query) its name was picked on: after a
navigation (Enter on a name, a tap on the peek's link) it is not rendered, and Radix `hideWhenDetached` hides it while
its name is scrolled out or removed from the page.

**Surfaces** (item context passed where known):

| Surface                                                                                   | Item context                  |
| ----------------------------------------------------------------------------------------- | ----------------------------- |
| Runewords / gemwords (`RecipeAffixes`: bonuses, gemword random pools; also builds, guide) | runeword / gemword name       |
| Socketable bonuses on runeword / gemword cards, Socketables page                          | none                          |
| Uniques (`HtmUniqueItemCard`: Uniques page, builds, guide, stash coupons), Mythicals      | unique name                   |
| Sets page: item lines and item partial bonuses (`BonusLines`); set-wide boxes             | set item name; set-wide: none |
| Builds: saved snapshots (`ItemRefDisplay`), set item cards, set bonus summaries           | snapshot / set item name      |
| Stash item cards (`ItemCards` Lines, also the item table's peek)                          | none (exact rolled levels)    |
| Ascendancy tier bonuses                                                                   | none                          |
| Affixes (`AffixCard`), Enhance / Cube outputs (`BonusLines`)                              | none                          |

Not covered: base automods (`BaseCard` joins the lines with " · "), the loot filter browsers, the cube's "Magic item of
the same type (…)" and "The same item (Level 10 Blessed Aim Aura When Equipped)" outputs (the skill line is
parenthesised inside another text, not a whole-line template) and guide prose. Fixture numbers (ESR 3.2.24 HTM pages): runewords
924 linked lines, uniques 1561, gemwords 936, mythicals 84, ascendancies 15; every line whose template names a known
skill is linked except Lich King's Essence "+(5 to 15) To Empowered Enchant" (it grants all six variants). Checked
against skilldetails.json grants: every linked chance-to-cast / charges line and all but ESR's random auras (Ars
Tor'Baalos) match a grant of that item with the same property, level and chance.

## Code

```
src/features/game-data/build/bundleSkillDetails.ts   builder (+ readGrantSources, evalSimpleCalc; re-exports bottomUp)
src/features/game-data/build/bundleSkillCalc.ts      skillcalc.json builder: line classification, row cutting, self-check
src/features/game-data/engine/skillCalc/             calculator: parse.ts, evaluate.ts, lines.ts, text.ts, index.ts
src/features/game-data/build/skillIcons.ts           sheet listing, icon keys, cel crop
scripts/generate-skill-icons.ts                      CLI: crop + WebP + --check
src/features/skills/
  screens/SkillsScreen.tsx         loads skills + skilldetails, URL state, search, item skills
  components/SkillTreesLayout.tsx  the two-column layout: trees (or what replaces them) + sticky detail column
  components/SkillClassTrees.tsx   one class: tab pills (below lg) + the three SkillTreeTab cards (side by side from lg)
  components/SkillTreeTab.tsx      one tab grid (optional point count in the title)
  components/SkillTile.tsx         one tile (optional corner badge, dimmed state)
  components/SkillDetailCard.tsx   details + Granted by (optional slot after the header, optional `levels` config)
  components/SkillLevelValues.tsx  the calculator block: level controls, at-level lines, compact + full tables
  components/LevelInput.tsx        compact integer input (levels, synergy points, +skills from gear)
  components/SkillIcon.tsx         icon <img> with a reserved square
  hooks/useDetailScroll.ts         scrolls the card into view after a tap below lg; scrollToTop for the values block
  hooks/useMythicalNames.ts        HTM mythical names from IndexedDB (item links)
  hooks/useSkillCalc.ts            lazy skillcalc.json + index (cached for the page's lifetime)
  hooks/useSkillRefIndex.ts        skill names for item lines (skilldetails.json on idle, cached)
  hooks/useSkillRefPeek.ts         the delegated peek of skill names in item lines
  components/SkillRefText.tsx      an item line with its skill name linked (data-skill-ref)
  components/SkillPeekLayer.tsx    app-shell wrapper: delegation, lazy-loads the popover host with the first peek
  components/SkillPeekHost.tsx     the one shared PeekPopover (lazy chunk: Radix Popover + the card)
  components/SkillPeekCard.tsx     the peek's content (with the calculator)
  utils/skills.ts                  view model, URL state, search, selection marks, grant texts, item links
  utils/skillLevels.ts             calculator state: lvl / clvl / syn params, synergy points, table levels and labels,
                                   synergy texts, grant headline values, builds level (points + gear)
  utils/skillRefs.ts               item line templates → skill references, ambiguity rules, peek texts / level / URL
  utils/skillRefData.ts            the reference type and its data-skill-ref attribute form (no imports)
```

The builds feature imports the components, hooks and utils by deep path (`@/features/skills/components/SkillTile`);
`index.ts` only exports the lazy route screen. The builds-specific parts (point badges, the point controls in the
card's slot, local selection state) live in `src/features/builds/components/BuildSkillTrees.tsx`.

Tests: `build/bundleSkillDetails.test.ts`, `build/bundleSkillCalc.test.ts` and `build/skillIcons.test.ts` (fixture rows),
`engine/skillCalc/evaluate.test.ts` (parser, integer math, codes, damage / length / mana helpers, references) and
`lines.test.ts` (line functions, contexts, table), `bundleIntegrity.test.ts` (committed bundle vs. trees, counts, Fire
Bolt / Teleport / Rift Shot examples, one icon file per key; skillcalc.json: Fire Ball 10-20 / 80-128 / 160-228 /
360-468 and 960-1188 at 110, with synergies 58-116 / … / 2088-2714, mana, radius, resist, Blizzard, Fanaticism, Might,
Raise Skeleton, Whirlwind, Hellfire Lance, Rift Shot; the compiler quirks Cloak of Shadows (−10% / −20%) and Sharpened
Focus (−5% / −14%, −24%); unlisted synergies Weaken (−115% at 20) and Werewolf (+96% at 20), 73 skills / 235 inputs;
the fixed-line order; skillcalc.json < 450,000 bytes),
`features/skills/utils/skills.test.ts` (incl. the `lvl` / `clvl` / `syn` URL state), `skillLevels.test.ts` and
`skillRefs.test.ts` (templates on real lines with the committed skilldetails.json, ambiguity rules on a small bundle,
peek texts / levels / URLs, the attribute round trip, the class names against skills.json).

## Known gaps

- skilldetails.json synergy texts still show `?` for formula bonuses; the page replaces them with the calculator's
  values once skillcalc.json is loaded (a synergy line the calculator hides keeps the `?`).
- Hidden grants, random-skill properties, propertygroups pools and set-wide bonuses are not listed.
- Mercenary (hireable) skills and their sheet `hireables/hrskillicon.sprite` are not covered.
- A unique and a runeword with the same name (Enigma) are separate entries; the unique links to the Uniques page
  unless the HTM mythicals list knows it.

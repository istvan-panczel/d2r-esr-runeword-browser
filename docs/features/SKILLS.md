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
stays small (31 KB). Both are generated in one run and joined by skill id in the browser (`utils/skills.ts`
`buildSkillsView`). The builds pages (a build's Skills tab, the create / edit form) load both too, only when they draw
a tree (`builds/hooks/useSkillTree.ts`), and reuse this page's tiles, layout and detail card.

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
  Mana cost, damage, duration and other formula lines are left out.
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

- **skills**: one record per skilldetails.json skill, same order. `lines` = the shown skilldesc lines in file order:
  `desc1..6` (the per-level block), `dsc2-1..5` (pinned lines, may still vary), `dsc3-1..7` (the synergy block), each
  with its line function `type`, texts `a` / `b` (indexes into `texts`), formulas `ca` / `cb` and the flags `ulvl` /
  `blvl`. `maxHardPoints` = skills.txt `maxlvl` for class skills, 0 for item skills (items never give hard points).
  `synergies` = the skills.txt ids of the skills the dsc3 "Receives Bonuses From" lines name (skilldetails.json
  `synergies` that resolve to a skills.txt row other than the skill itself; `*Passive` / `*Control` rows excluded).
  Flags: `scalesWithCharLevel`, `scalesWithHardPointsOnly`, `hiddenStatLines`, `hiddenOtherLines`, `itemEffect`.
- **rows** / **missiles**: the skills.txt / missiles.txt rows the shown lines' formulas can read on any branch
  (`collectFormulaRefs`: formula columns, `skill()` / `sklvl()` / `miss()` targets and skilldesc descmissiles,
  transitively), each cut to those columns; numbers as numbers, formulas as text, blank / 0 cells left out. Synergy
  rows also carry `maxlvl` (the input cap). descmissile1..3 are copied from skilldesc onto the skill row.
- **texts**: every line text once (format strings and skill names through the strings).

A self-check at build time evaluates the shown lines again from the cut rows and warns
(`skillcalc: the cut rows change …`) on any difference.

### Evaluator

`engine/skillCalc/parse.ts` (tokenizer + precedence parser, ASTs cached per text), `evaluate.ts` (`CalcRun`: the code
tables, damage helpers, reads), `lines.ts` (line functions), `text.ts` (printf with marked numbers, `bottomUp`),
`index.ts` (public API). Semantics follow D2MOO (`SKILLS_GetSpecialParamValue`, `SKILLS_GetMin/MaxElemDamage`,
`SKILLS_GetElementalLength`, `SKILLS_GetManaCosts`, `D2Common_11033`, `MISSILE_GetSpecialParamValue`, Fog `Calc.cpp`) and
the D2R Data Guide's SkillCalc / MissCalc code lists:

- 32-bit integer math, `/` truncates toward 0, `x / 0` = 0, `^` repeated multiply (exponent ≤ 0 → 1), comparisons
  give 1 / 0, `cond ? a : b`, `min` / `max`. Conventional precedence (ternary loosest, then comparisons, `+ -`, `* /`,
  `^`, unary minus); every ESR ternary is parenthesised, so the game's shunting-yard quirks do not matter. A minus right
  after `?`, `:` or `,` is refused: the game's compiler may read it as a subtraction (ESR: Circle of Blades).
- Codes: `lvl`, `blvl`, `ulvl`, `par1..par9` / `pa10..pa20`, `ln12/34/56/78/91/21` (`a + (lvl-1)·b`, 0 at level ≤ 0),
  `dm12…` (`a + (b-a)·(110·lvl/(lvl+6))/100`, capped at b, so every dm value stops at level 60), `clc1..10`,
  `ast1..6`, `pst1..14`, `len`, `rng`, `pets`, `skpt`, `toht`, `usmc` / `mana` / `mps`, `edmn` / `edmx` / `edns` /
  `edxs` / `enma` / `exma` / `enms` / `exms`, `edln` / `edma`, `pnma` / `pxma` / `pnms` / `pxms`, `m1en..m3el`,
  `m1rn..m3rn`, `m1eo` / `m1ey`; masteries (`math`, `mael`, …) are 0. Functions: `skill('X'.code)` (X's code at X's
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
- Other skills: hard points from the synergy inputs (default 0); their level (`.lvl`) = their hard points. The base
  skills Attack, Kick, Throw, Unsummon, Left Hand Throw / Swing are at least 1. `skill('X'.clc3)` of a skill the
  character lacks is evaluated at level 0 (params and calcs still evaluate, `ln12` / damage / mana give 0), as in the
  engine.
- Every stat is 0: no items, no ascendancy, no passive masteries, `playermode` 0. ESR uses many stats as 0/1 toggles or
  gear counters (`weaponmastery`, `item_corrupted`, `item_skill_cooldown`, `randomgenerator`, `skillcontrol*`); at 0 the
  value is the bare character's tooltip.

### Which lines are shown

The builder evaluates every line at levels 1..110 without synergies and with every listed synergy at its `maxlvl` (20).
A line is left out (counted in the manifest, `skillCalcHidden*`, and on the skill) when:

| Reason        | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`      | line function 13 (summon life: monstats.txt life × %), 31 (difficulty divisor), 34 (summon damage), 56 (book quantity)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `type`        | a line function the calculator does not format                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `string`      | texta / textb missing from the strings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `format`      | the text has more placeholders than the line function fills                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `parse`       | a formula it reaches does not parse                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `unsupported` | a formula it reaches uses an unknown code / function / skill / missile, text in a numeric column, a recursion, or an ambiguous code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `random`      | it reaches `rand(a, b)` with a < b (the engine rolls; a tooltip value would be one roll). `rand(a, a)` = a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `stat`        | **its value changes when the character stats are set**: strength, dexterity, vitality, energy, life, mana, stamina (pools full), level, experience, defense, attack rating are set to two probe value sets at 14 sample levels; if any value differs from the all-0 state the line is about the character, not the skill (Righteous Fire's damage from max life, Wisdom of Athulua's per-attribute bonuses). Those stats are never 0 on a real character, unlike gear / toggle stats. A stat read that the line does not depend on (Might's `maxhp/25600` behind an ascendancy gate, `hitpoints·3 < maxhp` at full life) keeps the line. `hiddenStatLines` on the skill tells the UI how many lines depend on character stats |
| `gated`       | every number in it is 0 at every level in both states: ESR's ascendancy / item gates (a 0-second cooldown without the item effect)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Kept lines get `ulvl` when the value differs between character level 1, 55 and 110 at a sample level (only 3 skills:
Venom, Hex Purge, Eldritch Blast), `blvl` when it differs between the default hard points and 1 hard point at a sample
level (ESR passives that scale with hard points only: Lycanthropy, Molten Focus, Critical Strike, …).

### Line functions

`lines.ts` formats the line functions ESR uses: 74 `printf(a, calca)`, 75 `printf(a, calca, calcb)`, 76
`printf(a, b, calca)` (synergy lines), 77 `printf(a, b, calca, calcb)`, 79 `printf(a, b, calca / calcb)`, 36
`calca / calcb` (calcb blank = 1) with texta when the shown value is exactly 1 and textb otherwise (texta when there is
no textb), 40 header `printf(a, b)` with `calca` = colour, 18 text, 78 `printf(a, b)`, 25 `a + b`, the old 3
(`a + value + b`), 4 (`a + signed value + b`), 5 (`a + value`), 6 (`signed value + a + b`), 63 (`a: +value% b`) and 67
(`a: +value b`). Multi-line strings read bottom-up, like skilldetails.json's lines.

### Public API (`engine/skillCalc/index.ts`)

```ts
const index = indexSkillCalc(bundle); // cached per bundle object
const skill = index.record('Fire Ball'); // SkillCalcSkill | undefined
defaultContext(skill, { level, hardPoints?, charLevel?, synergyPoints? }); // SkillCalcContext of a bare character
evaluateSkill(skill, index, ctx); // SkillLineResult[]: key, block, type, text, values, before/span/after, color?, unavailable?
skillTable(skill, index, [1, 20, 30, 50, 110], { synergyPoints, charLevel }); // SkillTableRow[]: label, cells, varies
synergyInputs(skill, index); // [{ id, max }]
maxSynergyPoints(skill, index); // every listed synergy at its cap
itemTriggerInfo(skill); // { value: 'yes' | 'unknown', reason }
```

`itemTriggerInfo`: skills.txt `ItemEffect` is the server function the game runs when an item event (chance to cast on
striking, when struck, …) triggers the skill (Data Guide). Set → yes (328 of 461). Blank → unknown, not no: ESR grants
Maelstrom Cascade Proc as a chance-to-cast with a blank ItemEffect. Whether _using_ a skill fires on-striking procs has no
column: it depends on the skill's server function and damage path in the engine, so the calculator does not say.

### Not verified in game

- Type 36 decimals: one decimal at most, rounded (Fire Ball radius 5.3 yards, mana 14.5); the game's rounding and
  decimal display are from vanilla memory. The singular text at exactly 1 (after rounding) per the Data Guide.
- Raise Skeleton (and Fire Golem) "Physical Damage" use `pnma` for both values in ESR's skilldesc: shown as the data
  says (4-4, 204-204).
- D2R-only codes taken by analogy with the documented ones: `clc5..10`, `pst6..14`, `pa13..pa20`, `ln91` / `dm91` /
  `ln21` / `dm21`, `sksrc('X'.lvl)` read like `skill('X'.lvl)`, `sklvl('X'.a.b)`. missiles.txt `Range` holds formulas in
  ESR ("90+25*lvl", no `LevRange`): evaluated as a missile formula at the skill level.
- The old line functions 3 / 4 / 5 / 6 / 63 / 67 and the D2R 79: formats inferred from their texts.
- Refused, left for round 2: `m2eo` / `m2ey` / `me3o` / `me3y` (D2MOO picks descmissile1 / 2 for them, a copy-paste bug
  D2R may have fixed: Overseer Volley), `m1nm` / `m1xm` (not in the Data Guide: Miasma Chains, Abyss), missile `rad`, the
  broken `clc0` (Frenzy, Mirrored Blades), `ln43` (Bind Demon), Plague Javelin's descmissile that is not in
  missiles.txt, and the two lines whose strings are missing.
- Summon life (type 13) needs monstats.txt and the difficulty; not computed.

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
  synergy the calculator knows and the computed bonus text instead of `+?%`), notes, and **Granted by**, grouped into
  Usable skill, +Skill levels, Aura when equipped, Charges and Chance to cast; 8 per group, then "Show all N". Every
  grant except "+N levels (class only)" (a bonus on top of the character's points, not a level) gets a muted line with
  the skill's first one or two per-level lines that vary (mana left out) at the item's level (a range's maximum,
  no hard points: items never give any): "Lvl 40 – Fire Damage: 1508-2018 · Enemy Fire Resist: -30%". The level is a
  button that sets the calculator's level and scrolls the values into view. Item links: uniques →
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
    every listed synergy at its cap, 20). Without varying lines the level controls are hidden.
  - **At level N**: the `level` and `fixed` blocks at that state (blue, tooltip order), then muted notes "N lines
    depend on character stats and are not shown" (`hiddenStatLines`) and "N other lines are not shown: the game engine
    computes them … or the calculator does not support their formulas yet" (`hiddenOtherLines`).
  - the compact table at levels 1 / 20 / 30 / 50 / 110\* (`skillTable`): one label row per line that varies (synergy
    block left out) with the five values under it; the selected level's column is highlighted. A word unit every cell
    shares moves into the label ("Radius (yards)"), "%" stays in the cells (`utils/skillLevels.ts` `tableRow`).
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
  (`max`, or the selected skill's synergy points in its listed order joined with "." such as `syn=5.0.20`, trailing
  zeros cut; omitted when none). The level and character level stay when another skill is picked (compare skills at the
  same level); synergy points belong to one skill and are reset then, unless `syn=max`. A link with only `skill` opens
  the skill's class and tab. "Copy Link" shares the view.
- **Builds**: a build's Skills tab and the create / edit form reuse the card through `BuildSkillTrees`, which passes a
  `levels` config (`SkillLevelsConfig`: state, hard points, onChange, plus slots for its own level control, a note and
  a synergy action). Level = the build's allocated points + a "+Skills from gear" input (default 0, local, not saved);
  hard points = the allocated points; synergy points default to the build's own points in each synergy skill (editable,
  "Reset to build"; reset on another skill unless Max synergies is on). A skill with 0 points shows the normal level
  controls with "Not learned in this build: the level below is not tied to the build." The character level input is
  local too (default 110, not the build's level).

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
  hooks/useDetailScroll.ts         scrolls the card into view after a tap below lg
  hooks/useMythicalNames.ts        HTM mythical names from IndexedDB (item links)
  hooks/useSkillCalc.ts            lazy skillcalc.json + index (cached for the page's lifetime)
  utils/skills.ts                  view model, URL state, search, selection marks, grant texts, item links
  utils/skillLevels.ts             calculator state: lvl / clvl / syn params, synergy points, table levels and labels,
                                   synergy texts, grant headline values, builds level (points + gear)
```

The builds feature imports the components, hooks and utils by deep path (`@/features/skills/components/SkillTile`);
`index.ts` only exports the lazy route screen. The builds-specific parts (point badges, the point controls in the
card's slot, local selection state) live in `src/features/builds/components/BuildSkillTrees.tsx`.

Tests: `build/bundleSkillDetails.test.ts`, `build/bundleSkillCalc.test.ts` and `build/skillIcons.test.ts` (fixture rows),
`engine/skillCalc/evaluate.test.ts` (parser, integer math, codes, damage / length / mana helpers, references) and
`lines.test.ts` (line functions, contexts, table), `bundleIntegrity.test.ts` (committed bundle vs. trees, counts, Fire
Bolt / Teleport / Rift Shot examples, one icon file per key; skillcalc.json: Fire Ball 10-20 / 80-128 / 160-228 /
360-468 and 960-1188 at 110, with synergies 58-116 / … / 2088-2714, mana, radius, resist, Blizzard, Fanaticism, Might,
Raise Skeleton, Whirlwind, Hellfire Lance, Rift Shot),
`features/skills/utils/skills.test.ts` (incl. the `lvl` / `clvl` / `syn` URL state) and `skillLevels.test.ts`.

## Known gaps

- skilldetails.json synergy texts still show `?` for formula bonuses; the page replaces them with the calculator's
  values once skillcalc.json is loaded (a synergy line the calculator hides keeps the `?`).
- Skill tooltips' line order across description entries (descline1 vs descline2) follows the file, not verified
  in game; only the bottom-up order inside one multi-line string is confirmed by the data.
- Hidden grants, random-skill properties, propertygroups pools and set-wide bonuses are not listed.
- Mercenary (hireable) skills and their sheet `hireables/hrskillicon.sprite` are not covered.
- A unique and a runeword with the same name (Enigma) are separate entries; the unique links to the Uniques page
  unless the HTM mythicals list knows it.

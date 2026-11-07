# Elixirs

The drinkable utility elixirs ESR 3.3 added: what each one gives at a character level, how they drop, which Alchemist
perks change them. Route `/elixirs` (Database menu), data `public/game-data/elixirs.json`, code `src/features/elixirs/`
(page) and `src/features/game-data/build/bundleElixirs.ts` (generator).

## Data facts (ESR 3.3)

- **35 elixirs** (misc.txt type `upot`): 17 regular (`01p`–`17p`, type2 `relx`), 17 greater (`18p`–`34p`, `gelx`) and
  the Elixir of Reincarnation (`35p`, no type2). The patch notes' "17 new elixirs" are the regular ones; "35th" is
  Reincarnation. Each greater elixir uses the same state (states.txt) as its regular one.
- **Effects**: `stat1` … `stat6` with `calc1` … `calc6`. Regular: `base(level) × (100 + E + 5·VC) / 100`; greater:
  `base(level) × 125 × (100 + E + 5·VC) / 10000`, where E is the Utility Potion Effectiveness stat
  (`utilitypotionmultiplier`, shown as "Utility Potion Effectiveness") and VC the Volatile Concoctions perk
  (`alchemy_2`). The game's calc language works on whole numbers, left to right, each division truncated
  (`(25+lvl/3*2)` at level 10 is 25 + 3 × 2 = 31); `engine/elixirs.ts` evaluates the formulas with the skill
  calculator's parser (`parseCalc`, `calcBinary`).
- **Length**: `len = 1125 × (100 + D) / 100` frames (25 per second): 45 s, D = Utility Potion Duration
  (`utilitypotionduration`). Reincarnation: `len` 2,000,000,000 (until it triggers) and a `UsageConditionCalc` (not while
  its effect or cooldown runs).
- **Tooltip**: `spelldescstr` with the value of `calc1` (`spelldesc` 2; the spelldesc-decimals plugin config says the
  value is calc1). Deadly Crits says "Critical Damage", the stat line reads "Deadly Strike Damage". Quickness says
  "Dodge" and gives Dodge, Avoid and Evade: no mismatch, ESR's Dodge is the three pooled together (mod author,
  2026-11-07; the Modifiers page's `dodge` block).
- **Top level**: experience.txt `MaxLvl` (110), so the page shows values at level 1 and 110.
- **Drops**: every elixir drop goes through the treasure class `Utility Elixir` (Regular 3, Greater 1). `Potion N Single`
  picks it instead of a potion: Normal Act 1 1%, Act 2 1%, Act 3 2%, Act 4 3%, Act 5 3%, Nightmare 4%, Hell 5%,
  endgame maps 5% (the patch notes say "1/2/3/4/5%"). Regular: A (7 elixirs) 7, B (6) 6, Hidden (4, needs Hidden
  Elixirs) 4; Greater (needs Alchemical Excellence) has the same split. So without perks each of the 13 elixirs is 1 in
  13 of the elixir drops, with Hidden Elixirs 1 in 17, and with Alchemical Excellence a quarter of the drops are greater.
- **Conditional classes**: a `ConditionCalc` perk check (`stat('alchemy_N'.accr)>0`) on a class is read as "left out of
  the roll when the killer lacks the perk". That is the only reading under which the perk texts' numbers come out
  (Alchemical Excellence "25%" = 1 of 3 + 1, Bountiful Brews "+50%" = Single 1 / Double 1 with 2 picks, Transmutation
  "50%" = 12 of 24), and without it half of every potion drop would vanish for non-alchemists. The ConditionCalc Killer
  plugin makes the check read the player who got the kill (a summon's or hireling's kill reads its owner with
  `credit_minion_owner`).
- **Unstable Mixtures**: `Rejuvenation Regular` / `Full` pick `Unstable Mixtures` 15 of 100, which leads to the elixir
  roll; the alchemy plugin's `[find_potion]` sends Find Potion's rejuvenations through the same classes.
- **Recipes**: Gem Infusion (cubemain 2307–2310): Randomizing Stone + Perfect Gem → a random regular elixir (`relx`);
  with Alchemical Excellence a Randomizing Stone roll ≥ 384 of 0 … 511 (25%) gives a greater one (`gelx`). The cube page
  now words that check "Random roll ≥ 384 (of 0 to 511)" (`statConditionText` `rollInput`; on Anya's Gift the same op
  is a use counter). The output is any item of the type, so the four hidden elixirs can come from it without Hidden
  Elixirs.
- **Elixir of Reincarnation**: the perk of the same name (Alchemist row 5) says it is crafted from 5 Dragon Stones, but
  cubemain.txt has no row making `35p` and no treasure class drops it. The mod author (2026-11-07): "Fixed in next
  patch", so in 3.3 it cannot be had; the perk's facts carry his note while no recipe makes it
  (`build/modAuthorAnswers.ts`). The alchemy plugin's `[[reincarnation]]` gives the effect: full life and mana on a
  fatal hit, 25 frames (1 s) invulnerable, a 300 s cooldown.
- **Plugin perks** (`celestialrayone.alchemy.toml`): Savvy Elixirs (25% not used up), Serendipity (15% one of ten
  shrine effects), Compounded Synergy (+5% per different potion effect running; not in the page's values). Stamina,
  Antidote and Thawing Potions are utility potions too (type2 `upot`; same stats and perks).

## Bundle

`ElixirsBundle` (`engine/schema.ts`): `maxLevel`; `elixirs` (code, name, kebab `slug`, `variant`, `pair`, `state`,
`tooltip` + `tooltipFormula`, `effects` with rendered `lines` holding `{v}`, `formula`, `stats`, `values` at level 1
and `maxLevel`; `duration`, `seconds`, `usageCondition`, `dropPerks` (omitted: never drops), `perk`, `recipes`);
`perks` (every Alchemist perk the formulas, drop classes, recipes or the plugin config read, with `facts` worded from
the files); `drops` (`sources` with area labels from the class names above `Potion N Single`, and `odds` per perk
set); `recipes` (cube.json raw recipes making an elixir or an elixir type); `otherUtilityPotions`.

Effect lines: each formula's stats are rendered together with a marker value (stat renderer `renderStats`), so stats
the game groups (the four maximum resistances, the six spell masteries) read as one line; a line without the marker is
an `elixirs:` warning. Warnings also cover a missing root class or alchemy config, a ConditionCalc that is no perk
check, and an item the root class drops that is not an elixir. Counts: `elixirs*`, `elixirPerks`, `elixirDropSources`,
`elixirRecipes`. ESR 3.3: 35 KB raw, 5 KB gzip.

## Page

- Two info cards: drop chance per area (and Unstable Mixtures), who finds which (everyone / perk-gated groups,
  Reincarnation).
- Filter card: search (names, effects, tooltip, perk titles), Copy link, character level (stepper + 1 / 30 / 60 / 90 /
  110), Utility Potion Effectiveness % and Duration % (0 to 1000), the perk toggles (the perks the formulas or the odds
  read: Volatile Concoctions, Hidden Elixirs, Alchemical Excellence), Drops (everyone / needs a perk) and Variant pills.
- Cards: icon (icons.json `items` by code), name, badges, tooltip and effect lines at the chosen settings with the
  level 1 / top level values beside them, length, the chance among elixir drops with the chosen perks, the perks it
  needs (links to `/specializations?tree=alchemist&perk=<slug>`, the Specializations page), cube recipes, its
  regular / greater pair, a Materials link.
- Perk cards with the facts, the Gem Infusion recipes (link to the Cube page's potions family), a note on the other
  "Elixir" items (Secret Recipe 1's cube ingredient, the starter Elixir of Skill) and a link to the guide's `elixirs`
  note.
- The header links the guide's `elixirs` note (`/guide/elixirs`; the note links back with `page:/elixirs`, listed in
  `APP_PAGES`) and the Modifiers page's `utility-potions` block (`/modifiers?kind=utility-potions`).
- URL: `name` (slug; only that elixir), `search`, `avail`, `variant`, `lvl`, `eff`, `dur`, `perks` (slugs). The route
  skips the HTM startup gate (`staticBundleRoutes.ts`).

## Open questions (in game / mod author)

1. Does a perk-gated treasure class drop out of the roll (as read here) or drop nothing when the killer lacks the perk?
2. Does a greater elixir replace a running regular one of the same kind (shared state), or the other way round?

Answered by the mod author (2026-11-07):

- Elixir of Reincarnation: how is it obtained? The perk text says "transmuting 5 Dragon Stones", cubemain.txt has no
  such row (ESR 3.3). "Fixed in next patch": a bug; the next patch adds the recipe.
- Elixir of Quickness's tooltip names Dodge only; the item gives Dodge, Avoid and Evade. Not a bug: "Dodge in ESR is
  dodge, avoid and evade all pooled together."

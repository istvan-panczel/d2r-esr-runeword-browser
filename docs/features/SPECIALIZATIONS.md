# Specializations

ESR 3.3 added specializations: four perk trees (Alchemist, Blacksmith, Jeweler, Archaeologist), 15 perks each in five
rows of three. A character unlocks them with a Mystical Tesseract (10 Mystical Shards in the cube), gets more points at
levels 45, 60, 75 and 90 (5 at most), learns one perk per row of one tree and unlearns a perk for 5 respec points.

The `/specializations` page shows every tree with its perks and what the game files say about each perk. The data is
the generated bundle `public/game-data/specializations.json`; the official page (`docs/specializations.htm`) is only
compared with it.

## Files

| Path                                                     | What                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/features/game-data/build/bundleSpecializations.ts`  | the generator (`buildSpecializationsBundle`), the PERK_ITEMS checks, `comparePage`  |
| `src/features/game-data/build/specializationsPage.ts`    | parser of the official page (intro numbers, tree summaries, the perk tooltips)      |
| `src/features/game-data/engine/specializationLinks.ts`   | slugs, `specializationHref`, `parsePerkCheck` (shared by generator and browser)     |
| `src/features/game-data/build/skillIcons.ts`             | `parsePerkIconKey`; `scripts/generate-skill-icons.ts` crops the perk icons too      |
| `src/features/specializations/`                          | the page: `SpecializationsScreen`, `PerkCard`, `UnlockPanel`, `specializationsView` |
| `public/game-data/icons/specializations/<tree>-<n>.webp` | 60 perk icons, 64 px, from `hd/global/ui/specializations/<tree>.sprite`             |

## Bundle (`SpecializationsBundle`, schema.ts)

Sources, all in the ESR clone:

- `d2rloader/config/celestialrayone.specializations.toml`: the rules (`point_levels`, `unlock_points`, `max_points`,
  `perks_per_row`, `respec_stat` / `unlearn_cost`, `unlearn_hint`, `unlock_stat`) and one `[[specialization]]` block
  per tab with the perk stats (itemstatcost 927–941, 946–990; 942 `specializationtokencap` and 943–945 are not perks)
  and the `@d2r:` string keys of the titles and descriptions. Perk n of a tree is row ⌈n / 3⌉, column (n − 1) mod 3 + 1.
- strings (`item-modifiers.json`): `Specializations<Tree><row>_<col>Title` / `Desc`, the tree names, the unlearn hint.
- misc.txt: the token is the item whose stat is `unlock_stat` (u43 Mystical Tesseract); its formula gives the late
  points (`token.levels`, compared with `point_levels`: a mismatch is a warning). The respec item is the one whose stat
  is `respec_stat` (Token of Absolution); cubemain gives its recipe (4 Dragon Stones) and the Tesseract's (10 shards,
  family `specializations`).
- treasureclassex.txt / monstats / superuniques / levels: the monsters whose treasure classes roll the shard, with the
  chance per kill (one player, `treasureClassOdds.ts`) and the areas they spawn in (areas.json names); whether the shard
  TC's ConditionCalc limits it to characters without a token (`shardsOnlyBeforeUnlock`).
- Per perk, everything that reads its stat:
  - `plugin`: the section of a perk plugin config (`celestialrayone.alchemy` / `blacksmith` / `jeweler` /
    `archaeology.toml`) whose `perk_stat` is the stat, or the alchemy plugin's `[perks]` table (its numbers in
    `[values]` as `<name>_<setting>`). Numbers, booleans and short text lists are kept.
  - `cube`: cube.json families whose rows check the perk (`cube/perks.ts`), with the row count and `has: false` for rows
    that only work without it.
  - `drops`: treasure classes whose ConditionCalc reads the stat, their items and `shares` (the part of the parent's
    picks that lands on them, siblings behind the same perk added).
  - `items` / `skillRows`: misc.txt items (ESR's short potion names replaced by the name column) and skills.txt rows
    whose formulas read the stat.
  - `enhance`: Sanctimonious (enhance.json `secondPerk` on 45 anointment types), Hallowed Accessories
    (`sanctification.perkItems`); `anyWeaponMastery`: True Master (masteries.json `anyWeaponPerk`).
  - `notes`: a perk nothing reads; the PERK_ITEMS checks (Elixir of Reincarnation must have a cube recipe, the Alien
    Artefacts must drop behind the perk); a description percentage that none of the numbers above gives. The mod
    author's answers (`build/modAuthorAnswers.ts`, 2026-11-07, shared with the Elixirs bundle) add a note while the
    files still show the gap: a `bug` answer after a failed PERK_ITEMS check (the warning stays, so the fixing patch
    shows), a `plugin` answer instead of the "nothing reads it" note and warning.
- The official page: `pageDiffs` lists every difference (tree names, perk count, title, description, unlearn line,
  shards per Tesseract, point levels, the level 63 example, perks per tree / row, maximum points, respec points, Dragon
  Stones per unlearn). The tree summaries ("Specialized in potions.") are the only text taken from the page.

Warnings start with `specializations:`. ESR 3.3.04 has none, pinned in `bundleIntegrity.test.ts`: 3.3.02 fixed the two
of 3.3 (no cubemain row made the Elixir of Reincarnation; Alien Artefacts dropped without the perk).

Deep Pockets (archaeology_4) is read by no table or config either (the archaeology config's comment says the perk
"gives extra_items (426)"), but the mod author says the plugin grants it directly, outside the excel files, so it is
no warning; its note says the perk works.

Every other perk description agrees with the files' numbers, and the official page agrees with the files everywhere
(`pageDiffs` is empty at ESR 3.3.03: the page caught up on Transmutation 25% and Unstable Mixtures 10%).

Counts: `specializationTrees` 4, `specializationPerks` 60, `specializationIcons` 60, `specializationCubePerks` 8,
`specializationDropPerks` 7, `specializationPluginPerks` 42, `specializationShardMonsters` 9, `specializationPageDiffs` 0. Size: 29 KB.

## Page (`/specializations`)

- Intro, then **How to unlock and respec** (collapsible, open by default, remembered per browser): the Tesseract recipe
  (link to the Cube family), points by the level the Tesseract is used at, who drops the shards (chance per kill,
  links to the campaign map areas), the one-tree / one-perk-per-row rules and the unlearn cost in respec points, Tokens
  of Absolution and Dragon Stones; links to the guide note `/guide/specializations` and the official page.
- A toolbar card with one tab per tree (its first perk's icon) and Copy Link.
- The tree: its summary, then the five rows, each with its three perk cards: icon, title (a link to the perk's own
  URL), row and position, description, then the file facts (plugin section and settings, cube families, drops with
  their shares, formulas, skills.txt rows, Enhance and weapon mastery links), the notes and any official page
  difference about the perk.
- Footer: whether the official page agrees with the files, else the differences that are not about one perk.

URL: `/specializations?tree=<tree slug>&perk=<perk slug>`, slugs being the lower-case kebab English names
(`?tree=alchemist&perk=hidden-elixirs`, `looters-rush`, `ones-favorite`). The tree defaults to the first; a perk
without (or with the wrong) tree opens the tree that has it; the focused perk is ringed and scrolled into view; an
unknown slug shows a note. Other pages and the guide link to this format (`specializationHref`), so keep it stable.

Links into the page: the Cube page's perk conditions ("Needs the Jeweler perk [Steady Pliers]"), the Enhance page's
anointment and sanctification perk lines, the guide (`page:/specializations…` is an `APP_PAGES` entry).

## Questions (ESR 3.3)

- Answered by the mod author (2026-11-07):
  - Elixir of Reincarnation: where is the recipe? cubemain.txt had no row that makes 35p. "Fixed in next patch" (ESR
    3.3.02 added it).
  - Deep Pockets: what gives the +10% item quantity? Nothing in the tables or configs reads archaeology_4. "Granted
    directly by the plugin, not in the excel files."
  - Alien Artefacts: is it intended that every player gets them (no "Artefacts" treasure class checks
    archaeology_15)? "No, fixed in next patch": ESR 3.3.02 made them need the perk.
- "Rows are taken in order, one perk per row" (specializations config): must the rows be learned top to bottom? The
  page only says one perk per row.

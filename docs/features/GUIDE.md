# Guide (new-player guide)

A set of small, linked notes for new ESR players, rendered inside the app at `/guide`. Research and decisions:
[FEATURE-GUIDE-RESEARCH.md](../../builds-feature-docs/FEATURE-GUIDE-RESEARCH.md).

Principles: one topic per note, short (target 150–250 words, build warns above 400), every note stamped with the ESR
version it was verified against, numbers that exist in the game files are never typed by hand (they come from
directives that regenerate with the game data), and the official docs stay canonical for reference tables.

## Routes

| Path              | Screen           | Notes                                                                                                                                                                                       |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/guide` (layout) | GuideLayout      | Every guide page shows a small amber "Experimental" notice at the top: the guide is still being written and reviewed                                                                        |
| `/guide`          | GuideSpineScreen | Entry cards, search, "Start here": the five-step journey spine (each step expands to its note cards), an "I found something" row, then the "Official reference" strip (see below)           |
| `/guide/map`      | GuideMapScreen   | Every note on one page: a graph on `lg+` and a list grouped by spine step (see Full map under Note anatomy); linked from the spine screen header and the note screen's "Connections" column |
| `/guide/:slug`    | GuideNoteScreen  | One note (anatomy below); unknown slug shows a "note not found" block with a link back to `/guide`                                                                                          |

Guide routes render **before** the HTM data sync finishes (`AppLayout` skips the "Loading data..." gate for paths
under `/guide`). The guide bundle is static JSON and needs no Dexie data.

Header: `Guide` is the second entry in `INTERNAL_PAGES` (after Runewords) so it stays visible on narrow desktops.

## Note anatomy (GuideNoteScreen)

```
Guide › <title>                                             [Checked on ESR 3.2.12] | [Draft – not yet verified in-game]
<title>
<summary>
KNOW FIRST  [chip] [chip]                 (knowFirst, ≤3)
<body: paragraphs, ###/#### headings, lists, tables, data blocks>
IN THE APP  [icon link] …                 (links of kind "app" collected from the body, deduplicated, ≤4 shown)
OFFICIAL DOCS  <label> ↗                  (officialDocs, usually 1)
RELATED  [chip] …                          (related, ≤5)   ·  Mentioned in (n) ▸ collapsed backlinks
NEXT ON YOUR PATH →  <next note>          (spine order; hidden when null)
Sources: <sourceRefs titles>              (small, muted)
```

Phone: single column; "Next on your path" becomes a sticky bottom bar.

**Local graph** (`lg+` only; `components/LocalGraph.tsx`, layout in `engine/localGraph.ts`): on wide screens the note
sits in a two-column grid (the body plus a sticky 22rem "Connections" column at `lg`, 2/3 + 1/3 from `xl`). `layoutLocalGraph(note, bundle, size)` places
the note in the centre, `knowFirst` on the left arc, `related` then backlinks on the right arc and `next` at the
bottom; each slug appears once (next > knowFirst > related > backlink), at most 8 neighbours (knowFirst, next, related,
then backlinks). Inline SVG with rem labels (truncated to 18 chars, full title in `<title>`): know-first edges have an
arrowhead, the next edge is dashed, the current note is filled with the primary colour, read notes are filled grey.
Nodes are links (keyboard focusable, same hover/focus peek as note links). Below `lg` the graph is hidden; the chips and
the next link carry every edge, so the graph is never the only way to reach a note.

**Full map** (`/guide/map`, `screens/GuideMapScreen.tsx`): every note on one page. The graph (`lg+` only;
`components/FullGraph.tsx`, layout in `engine/fullGraph.ts`) sits in a bordered panel with a fixed aspect ratio (height
0.6 × width). `fullGraphEdges()` collects knowFirst (arrowhead), next (dashed; the notes' `next` plus the spine order)
and related (plain, fainter) edges, one per pair of notes in either direction (knowFirst > next > related).
`layoutFullGraph()` runs a d3-force simulation **synchronously to completion** (`simulation.stop()`, then 400
`tick()`s): link attraction, many-body repulsion, a pull of spine notes towards their step's column (steps read left to
right) and a box-collision force on each node plus its hanging label, so labels do not overlap; each tick clamps the
boxes into the panel and a last pass stretches the layout to fill it. **Deterministic**: initial positions come from
the spine (step column, spine index; off-spine notes start at the centroid of their linked notes, offset by the golden
angle × index), the random source is a seeded LCG and the tick count is fixed, so a bundle and panel width always give
the same picture (recomputed when the width or root font size changes, so rem labels render 1:1 like the local graph).
Outlines are coloured by spine step (legend below), off-spine notes are neutral, read notes are filled grey, labels
are truncated to 22 characters (full title in `<title>`), nodes are links with the note-link peek and take focus in
list order. No pan/zoom. **d3-force** was chosen because it is small and tree-shakes (only `forceSimulation`,
`forceLink`, `forceManyBody`, `forceX`, `forceY`: about 13 kB minified / 5 kB gzip with its quadtree, dispatch and timer
dependencies, in the guide chunk), has no DOM coupling and can be ticked by hand. Fallback if the picture is not
liked: fixed "spine columns" (one column per step, off-spine notes in an extra column), no dependency. The list
(always; alone below `lg`): `groupNotesForMap()` (`utils/guideMap.ts`) gives one card per spine step (title, summary,
notes in spine order) and a final "Other topics" card (alphabetical, glossary last); rows reuse the spine screen's note
cards (title, ✓ when read, freshness marker, summary, tags).

**Spine screen extras** (`utils/guideHome.ts`, `components/GuideStartCards.tsx`, `components/GuideOfficialReference.tsx`):
above the search, `START_CARDS` are four task-shaped entry cards (two columns from `sm`, one below): "I found an item,
what is it?" → `loot-triage`, "What can I make in the cube?" → `cube-basics`, "Where do I go next?" → `start-here`,
"Which base for my runeword?" → `/game-data/best-base`. A card whose note is missing from the bundle is hidden
(`visibleStartCards`). Below "I found something", `OFFICIAL_REFERENCES` lists the official docs pages (Cube Recipes,
Maps, Endgame Maps, Kill Ledger, Weapon Mastery, Skill Information, Ascendancies, Frame Table, Changelog; the Frame Table,
`ias-calculator.html`, has the IAS and FCR breakpoints and is not linked from the official site's nav), each with a one-line
description, opening in a new tab (`ExternalLink`, `rel="noopener noreferrer"`, ↗ icon). The URLs come from
`officialDocsUrl(file)` in `engine/linkSchemes.ts`, the same helper that resolves `docs:` links. Both lists are kept in
code, not in `spine.yml`: the cards mix note and app-page targets, and the docs strip is a fixed list of official pages
with no note behind it, so putting them in content would mean a new bundle field and generator code for nine
constants. `utils/guideHome.test.ts` checks them instead: card slugs against the committed `public/guide/guide.json`,
page cards against `APP_PAGES` (`build/links.ts`), docs files against the ESR clone's `docs/` (skipped without it).

**Visited notes**: `useVisitedNotes()` keeps the slugs the viewer has opened in localStorage (`guide.visited`, string
array, most recent last, capped at 200; pure helpers in `utils/visited.ts`). Opening a note marks it read; chips and
spine cards show a ✓, graph nodes are filled. "Reset progress" at the bottom of `/guide` clears the list (after a
confirm). Per browser only, never synced.

Version badge states (`noteFreshness(verified, manifest.esrVersion, note.staleReasons)` in `engine/freshness.ts`):
`draft` · `fresh` · `review` (amber, reasons in a popover) · `old` (amber); see [Staleness](#staleness).

## Content

```
content/guide/
  spine.yml          journey spine + "I found something" questions
  _glossary.yml      terms for the glossary note and :term[] hovers
  _sources.yml       attribution entries referenced by notes' `sources`
  notes/<slug>.md    one note per file; the slug is the file name (kebab-case, [a-z0-9-])
```

### Frontmatter

```yaml
---
title: Forging # required
kind: note # note | link | hub   (link = stub that mostly points to an official page)
summary: Add one removable bonus to an item with a forging recipe. # required, ≤140 chars, plain text
tags: [crafting] # optional
aliases: [forge, forged] # optional; search + glossary matching
knowFirst: [cube-basics] # optional, ≤3 slugs, validated
related: [d-stoning, enhancement-order] # optional, ≤5 slugs, validated
next: enhancement-order # optional; overrides the spine-derived "next on your path"
verified: 3.2.12 # ESR version the TEXT was checked against in-game; omit (or null) for a draft
volatility: high # low | high (high = mechanics numbers or route advice); default low
mentions: [Thawing Potion, Forging Hammer] # optional; item names the prose relies on, checked against game data (warning only)
officialDocs: # optional
  - label: Cube Recipes – Forging
    href: docs:Eastern Sun Resurrected Cube Recipes.html#for
sources: [official-cube, esru-wiki] # ids from _sources.yml, validated
---
```

The anchors of the official cube page are short: `special`, `uber`, `legendary`, `mis`, `gem`, `rel`, `mat`, `for`,
`dst`, `tin`, `soc`, `sec`. In frontmatter (`officialDocs`) a `docs:` href may contain spaces.

### Body syntax

Markdown (GFM tables and lists) with these additions. Anything else that is not plain markdown (raw HTML, images,
`#`/`##` headings) is a build error.

| Syntax                                                                                                            | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[[slug]]`, `[[slug\|label]]`                                                                                     | Link to another note. Validated; a missing slug fails the build. Inside a table cell escape the label pipe (see below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `[label](rw:Enigma)`                                                                                              | App link to the runewords page focused on that runeword (`/runewords?name=Enigma`: exact name, all its variants). Validated against the runewords bundle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `[label](gw:Name)`, `(unique:Name)`, `(mythical:Name)`, `(socketable:Name)`                                       | App links to the gemwords / uniques / mythicals / socketables pages focused on that name (`?name=Name`). The name must be in `public/game-data/sources.json` (matched like `?name=`: case, whitespace, quotes and dashes are unified; same as `::source`) and on that page: with the ESR clone, `mythical:` takes uniques whose base is a "Mythical …" item, `unique:` the other uniques and `socketable:` misc items of a gem or rune type (crystals are runes); without the clone any unique / misc item passes. Unknown names fail the build. `gw:` is not validated (no bundle has gemword names).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `[label](base:crs)`, `(type:swor)`                                                                                | App links to Game Data bases (by base code → `?search="<name>"`) / item types (`?type=code`). Validated against the bundles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `[label](bestbase:Enigma)`, `(affixes:base=7cr&ilvl=85)`, `(page:/game-data/bases)`                               | App links to Best Base, Affixes, or any raw app path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `[label](docs:gems.htm#anchor)`                                                                                   | Link to the official docs (`https://easternsunresurrected.com/<file>#<anchor>`). When the ESR clone is present the file and anchor are checked offline (warning when missing).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `[label](dropfinder:Hellfire Torch)`                                                                              | External link to the official Drop Finder (`https://easternsunresurrected.com/drop-finder.html`), for prose that tells the player to find an item outside a `::source` block. The name must be an item in `public/game-data/sources.json` (any kind: unique, set or misc; matched like `unique:`), so a typo fails the build, but it is **not** carried in the URL: the Drop Finder's `#i=…` deep links are positional and change with every ESR release. External, so not listed under "In the app".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `[label](https://…)`                                                                                              | External link (a plain `https://easternsunresurrected.com/drop-finder.html` link works too, unvalidated).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `:term[Stocker]`, `:term[Stocker]{label=stockers}`                                                                | Glossary hover; the term must exist in `_glossary.yml`. Renders the label (default: the term).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `::source[Annihilus]`, `::source[Worldstone Shard]{item=misc}`                                                    | **Where it comes from** block for an item (unique, set or misc name) from `public/game-data/sources.json`. Unknown name fails the build; a name shared by several item kinds fails with "ambiguous" until `{item=unique\|set\|misc}` picks one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `::secret-recipes`, `::secret-recipe[50]`                                                                         | Secret recipe rows (`[SECRETnn]` rows of cubemain.txt), all or one. Each output shows its bonus (level requirement, experience, gold, repair …) as in `::recipes`; a recipe whose bonuses would split it past 3 rows (one per organ, #22) is merged without them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `::recipe-output[Adventurer's Pack]`                                                                              | The outputs of the cubemain rows whose description equals the argument (used for the Starter's Pack contents).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `::vendor[Gheed]`                                                                                                 | Items that NPC sells (vendor columns of misc/armor/weapons).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `::difficulty-penalties`                                                                                          | What Nightmare and Hell change (difficultylevels.txt), one row per penalty and one column per difficulty so it stays four columns wide on a phone: resistance penalty, experience lost on death, monster skill bonus, life and mana leech divisors, your and your summons' damage to prime evils, mercenary damage to bosses, and the freeze, chill and AI-curse (Terror, Confuse, Attract, Dim Vision) divisors on monsters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `::dstone-caps`                                                                                                   | The most each D-stoning adds per builds slot family, from crafting.json (`StackingCraftStep.capLines`, worked out from the cubemain cap conditions; see GAME-DATA.md "Crafting options"): one row per ingredients (Dragon Stone form + switch item) and cap, the slots sharing a cap joined (all six armour slots read "Any armor"), so it stays three columns wide on a phone; a D-stoning without a cap check reads "<bonus> per use, no cap". Needs crafting.json (read with the other game-data bundles).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `::glossary`                                                                                                      | All glossary entries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `::recipes[dstone-cycle]`                                                                                         | A curated cube recipe family (`src/features/game-data/build/cube/cubeFamilies.ts`, matched against the cubemain `description`; at most 12 rows unless the family sets maxRows, the caption counts the rest). Variants of one recipe merge only when a single input slot differs and the output is the same; the same inputs with several outputs are one random pool; anything else stays a separate row (at most 3 per recipe, then "… and N more"). Outputs show their bonus: the row's mods (`mod N` with its `param`, `min` and `max`, on output b and c too) rendered through the game-data stat renderer (`statRenderer.ts`, the text of `affixes.json`: "The same item (+5 to Life)", a fixed value without a range). Markers and counters that are not a bonus (forging, tinkering and merc flags, the sanctify roll, Kill Ledger and ascendancy tiers, stocker counters …) are hidden by the list in `cubeText.ts` (`isHiddenMod`); mythical description lines (`mythicaldesc`) are shown, as the item gains them in game (Tyrael's Might "You get strength bonuses from dexterity instead of strength", the Kill Ledger's next-milestone hint), except a negative one, which removes a line; a mod the renderer cannot read is left out. A family can hide its bonuses (`outputBonus: 'hide'`), and a recipe whose bonuses would split it past 3 rows is merged without them. A random pool of more than 6 outputs of one item reads "The same item (one random bonus, N possible)". Rows carry no txt descriptions (dev labels). The caption is the family label; the block links to the family on the Cube Recipes page (`/game-data/cube?family=<id>`, "All N recipes", N = the family's rows in cube.json; `::secret-recipes` links to `secret`). An unknown id fails the build with the list of ids, and so does a family that no longer matches any row. Ids are listed below. |
| `::card[rw:Enigma]`, `::card[gw:Name]`, `::card[unique:Name]`, `::card[mythical:Name]`, `::card[socketable:Name]` | An embedded item card. The name is kept exactly as written (the browser finds the card in the HTM data by name); it is validated like the link of the same scheme, whose app link (`?name=`) is the card's fallback `href`. `gw:` is not validated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Link targets with spaces must be wrapped in angle brackets or use `%20`: `[x](<rw:Breath of the Dying>)`,
`[x](<docs:Eastern Sun Resurrected Cube Recipes.html#sec>)`. A link the parser leaves as text (`](rw:…` or `[[`
remaining in the output) is a build error, as is formatting inside a `[[slug|label]]` label. Inside a GFM table cell
write the label pipe escaped, `[[slug\|label]]`: the generator would escape a bare pipe for the build, but Prettier
formats the notes too and splits the cell at a bare pipe. `page:` only accepts the app's routes (`APP_PAGES` in `build/links.ts`: `/` (the home page),
`/runewords`, `/gemwords`, `/socketables`, `/uniques`, `/mythicals`, `/ascendancies`, `/skills`, `/modifiers`,
`/game-data/{bases,sets,best-base,affixes,types,enhance,cube,materials,areas}`, `/campaign-map`, `/guide`; a query string
is allowed). A `page:/modifiers?kind=<key>` link must name a kind key of `public/game-data/modifiers.json` (the page
resolves a kind key to the entry that explains it, e.g. `resist-fire` → the resists entry).

Leaf directives (`::name[arg]`) must stand alone on a line. Directive arguments are resolved at build time against the
ESR clone and the committed game-data bundles; the browser only renders the resulting data block.

`::recipes` family ids:

| Id                      | Recipes                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dstone-cycle`          | Dragon Stone → Holy Symbol → … → Void Shard → Dragon Stone, one material into the next.                                                                                                                                                                                                                                                                                                                                 |
| `anvil-stone`           | Making an Anvil Stone (4 Dragon Stones + a Perfect Gem; the Multi Stocker variant).                                                                                                                                                                                                                                                                                                                                     |
| `remove-forging`        | Removing a skill, all-skills, stat, rune or aura forging with Thawing Potions. The bonus taken off is not shown (`outputBonus: 'hide'`).                                                                                                                                                                                                                                                                                |
| `skill-forging`         | Class skill forging (Anvil Stones + the class's chipped gem), one row per class with its bonus ("+1 to Amazon Skill Levels"), the slots and the unique jewel merged.                                                                                                                                                                                                                                                    |
| `all-skill-forging`     | All skills forging (Maple Leaf + Anvil Stone + chipped gem): one row, the item qualities and slots merged into "equipment of any quality", with its bonus (+1 to All Skills).                                                                                                                                                                                                                                           |
| `aura-forging`          | Aura forging on amulets, one row per Aura Stone with its aura (the skill from `mod N param`).                                                                                                                                                                                                                                                                                                                           |
| `stat-forging`          | Stat forging (Anvil Stone + chipped gem): one row per gem colour for equipment of any quality and jewels, the output its bonus plus the slots with another one ("on weapons +48% Bonus to Attack Rating; on magic or rare jewels …").                                                                                                                                                                                   |
| `rune-forging`          | Rune forging (2 identical runes + chipped gem): one row per slot group (weapon/armor, ring/amulet, jewel with its scroll), the accepted runes as ranges read from the rows. The rows that only override some runes' bonus on wands, staves, gloves, torsos, shields and belts are left out. Each rune has its own bonus per slot (hundreds of rows), so the output reads "(that rune's bonus)" (`outputBonus: 'hide'`). |
| `socket`                | Socket Donut recipes: N gems → N sockets on normal/superior bases, a fixed count for magic/rare/crafted/set/unique, the gem grade per base tier; quivers, the odd charm, making a donut.                                                                                                                                                                                                                                |
| `coupon-tiers`          | Coupons and Wild Cards: redeeming (3 coupons, or 2 + Wild Cards per tier), tier coupons → Wild Card, Randomizing Stone rerolls, Decipherers.                                                                                                                                                                                                                                                                            |
| `gem-upgrade`           | Gem upgrades (3 → 1 per grade, and the Wild Card shortcuts).                                                                                                                                                                                                                                                                                                                                                            |
| `crystal-upgrade`       | Crystal upgrades (5 Chipped → Flawed, 5 Flawed → normal).                                                                                                                                                                                                                                                                                                                                                               |
| `legendary-consumables` | Inarius' Halo, Astrogha's Heart, Lilith's Tear, Tyrael's Feather, Lucion's Relic. Each with its bonus (Corrupted, +1 to Spell Mastery, Ethereal); Lucion's Relic as two rows: the Relic's hidden roll, then the jewel on its own becomes one of the `Jewel Sanctification N` rows ("one random bonus, 217 possible").                                                                                                   |
| `respec-token`          | Token of Absolution (4 Dragon Stones).                                                                                                                                                                                                                                                                                                                                                                                  |
| `starter-pack`          | Adventurer's Pack: opening it, and making another one.                                                                                                                                                                                                                                                                                                                                                                  |
| `map-upgrade`           | Endgame maps: 3× Tier N map → Tier N+1 map, and Randomizing Stone rerolls within a tier.                                                                                                                                                                                                                                                                                                                                |
| `charm-reroll`          | Charm rerolls and upgrades (magic/rare rerolls, 3 → 1 charm upgrades, odd charm reset).                                                                                                                                                                                                                                                                                                                                 |
| `rune-conversion`       | Rune upgrades (2 → 1, ES and LoD) and ES downgrades, Wo ↔ Null Rune, Decal upgrades, Decal ON/OFF (shown as "Ancient Decal (X -> Y) + X Rune → Y Rune" only after checking every Decal names the runes of its row) and the Kanji runes (Null Rune + crystals; the Crystal Can rows that share their descriptions are filtered out).                                                                                     |
| `tinkering`             | Tinkering with organs: one row per organ with its bonus ("+5 to Life"), weapon and armor merged.                                                                                                                                                                                                                                                                                                                        |
| `uber-keys`             | Pandemonium keys: key conversions (Blemished gem + Thawing or Stamina Potion), Key Set wrap/unwrap, the uber portal and the Tristram portal.                                                                                                                                                                                                                                                                            |
| `merc-only`             | Merc Only Conversion: one row per Perfect Gem colour with its bonus (weapon and armor merged), and one to remove it (Antidote Potions; the Anvil Stone and gem come back). The life drain (`vit-h2`) renders no text and is not shown.                                                                                                                                                                                  |
| `weapon-mastery`        | Weapon mastery, one row per step (awaken, unawaken, apply, apply with a chipped gem, remove; the bases merged into a generic class weapon and its class's Dragon Stone form); removing shows the token is not returned.                                                                                                                                                                                                 |
| `unsocket`              | Removing socketables with a Key: one row, the item types listed.                                                                                                                                                                                                                                                                                                                                                        |
| `lucion-essence`        | Lucion's Essence sockets: one row per socket count, each quality's slots merged; socketed and unsocketed items are one row (anything socketed comes out).                                                                                                                                                                                                                                                               |
| `kill-ledger-tiers`     | Kill Ledger kill bonuses, one row per bonus with the kill count read from the row's condition (`op`/`param`/`value`). The bonus is shown; the tier marker and the book's description lines (`mythicaldesc`) are not.                                                                                                                                                                                                    |
| `kill-ledger-bosses`    | Kill Ledger boss bonuses, one row per boss with its bonus in file order (the crystals pick the boss; boss names are only in the dev labels); trap rows left out. More rows than the block shows (the caption counts the rest).                                                                                                                                                                                          |
| `ancient-scrolls`       | Ancient Scrolls: identify, upgrade, downgrade and the low/high rerolls, one generic row each with the scroll numbers read from the rows.                                                                                                                                                                                                                                                                                |
| `unique-charm-upgrades` | Unique charms: Standard of Heroes upgrades and Perfect Gem rerolls (the charms merged per gem count), the Maple Leaf recycle, the Eternal Hourglass assembly.                                                                                                                                                                                                                                                           |
| `maple-leaf`            | Every way to make a Maple Leaf: unique charm recycle, Orbs of Anointment (the 1 to 3 batches as one row), Secret Recipes 26 and 40.                                                                                                                                                                                                                                                                                     |
| `class-craft`           | Class crafts (Dragon Stone form + Perfect Gem + jewel), one row per class, the magic base of any slot; the Legacy (rune) crafts left out. The bonuses are hidden: they depend on the slot as well as the class (about 80 sets).                                                                                                                                                                                         |
| `gem-meld`              | Gem melding: one row per level requirement added, the bases of that requirement and the gem colours merged.                                                                                                                                                                                                                                                                                                             |
| `ascendancy`            | Orb of Creation; the Ascendancy Stones pooled per gem pattern, each stone with its colours (the per-class rows merged); the tier upgrades for any stone with their Maple Leaf cost; trap rows left out. The stones' mods are hidden (they depend on the class the stone was made for).                                                                                                                                  |
| `vessel-transform`      | Turning the Vessel of Souls into a mythical weapon: one row, the weapons pooled; trap rows left out.                                                                                                                                                                                                                                                                                                                    |

### spine.yml

```yaml
steps:
  - title: Before you leave town
    summary: What the Starter's Pack gives you and the two traps that end runs early.
    notes: [starter-pack, avoid-disasters, death-and-respec]
questions:
  - label: I found an item I don't recognise
    note: loot-triage
```

"Next on your path" = the next note in spine order (within the step, then the next step's first note). Notes that
are not on the spine have no next unless `next:` is set.

### \_glossary.yml / \_sources.yml

```yaml
# _glossary.yml
- term: Stocker
  definition: A container item bought from Gheed that holds many copies of one material as points.
  note: stockers # optional owning note slug
- term: Leech
  definition: … divided by {fact:difficulty.LifeStealDivisor:nightmare} and {fact:difficulty.LifeStealDivisor:hell} in Nightmare and Hell.
  link: page:/modifiers?kind=life-leech # optional app page, any link target that resolves to an app link
# _sources.yml
- id: esru-wiki
  title: ESR Unofficial Wiki (community, CC BY-SA 3.0)
  url: https://esru.fandom.com/wiki/Eastern_Sun_Resurrected_Unofficial_Wiki
  license: CC BY-SA 3.0
  note: Consulted for facts; all text rewritten.
```

Glossary definitions are plain text. A number from the game files is written as `{fact:<key>}` (a number fact) or
`{fact:<key>:<field>}` (`normal`/`nightmare`/`hell` of a per-difficulty fact, or a field of a per-target fact such as
`crushingBlow.share:unique`), filled from the `facts` of `public/game-data/modifiers.json` at build time (negative values
with a typographic minus); an unknown fact or field fails the build (`build/glossaryEntries.ts`). `link:` is resolved
like a body link and must end up an app link; the glossary list and the term peek show it as "Modifier details" (any
other page: "Open in the app"). The combat terms (Deadly Strike, Crushing Blow, Leech, Prime evil …) link to their
`/modifiers` entry ([MODIFIERS.md](./MODIFIERS.md) "Guide").

## Build pipeline

Mirrors game-data. `npm run guide:generate` runs `scripts/generate-guide.ts`, which reads `content/guide/`, the ESR
clone (`../Eastern_Sun_Resurrected`, same resolution as game-data) and `public/game-data/*.json` (runewords, bases, types, sources, modifiers), and writes
`public/guide/manifest.json` + `public/guide/guide.json` (sha256 in the manifest, `?v=<hash>` URLs, `generatedAt`
kept when nothing changed). `--check` exits 1 when the committed files are stale; `--watch` regenerates on content
changes (use next to `npm run dev`; a small Vite plugin reloads the page when `public/guide` changes).
`npm run game-data:update` also regenerates and checks the guide. Flags: `--esr <dir>` (ESR clone), `--content <dir>`
(default `content/guide`), `--sources <file>` (default `public/game-data/sources.json`), `--out <dir>` (default
`public/guide`); the last three let you try the pipeline on scratch content, a draft sources bundle or a scratch output
folder. Sub-commands `verify` and `report`: see [Staleness](#staleness). The same run also writes `public/sitemap.xml` (static routes plus one URL per note, `scripts/lib/sitemap.ts`), and `guide:check` fails when it is stale.

Build errors (exit 1): invalid frontmatter, a glossary `{fact:…}` value or `link:` that does not resolve, unknown `[[slug]]`, `knowFirst`/`related`/`next`/`sources` ids, unknown
`rw:`/`unique:`/`mythical:`/`socketable:`/`dropfinder:`/`base:`/`type:` targets, unknown `:term`, unresolvable directive arguments, unsupported markdown nodes, a note
that is neither on the spine nor linked from anywhere, a note whose `knowFirst`/`related`/`next` names itself, links
left as text, `page:` targets that are not app routes (or a `/modifiers?kind=` that is not a modifiers.json kind), a slug reserved by a guide route (`RESERVED_SLUGS` in `build/parseNote.ts`: `map`), an ambiguous `::source` name. Warnings (manifest `warnings`): body above 400 words, `mentions`
not found in game data, `docs:` file/anchor not found, ESR clone missing (directives cannot resolve → error), a
verified note without a matching `.verify-lock.json` entry. An unreadable `.verify-lock.json` is an error.

Code layout:

```
src/features/guide/
  engine/schema.ts              bundle types (GUIDE_SCHEMA, GuideBundle, GuideNote, GuideBlock, DataBlock …)
  engine/freshness.ts           noteFreshness() (versions compared with core/utils/versionUtils)
  engine/notes.ts               findNote(), noteTitle(), findSourceRef()
  engine/linkSchemes.ts         LINK_SCHEMES, NAME_FOCUS_PAGES, OFFICIAL_SITE, officialDocsUrl(), DROP_FINDER_URL (shared by the generator and the app)
  engine/localGraph.ts          layoutLocalGraph()
  engine/fullGraph.ts           fullGraphEdges(), layoutFullGraph() (d3-force, run synchronously)
  engine/browser/loadGuide.ts   browser loader (promise cache, schema check)
  build/                        generator-only code (excluded from the app tsconfig, included in tsconfig.scripts)
  build/generateGuide.ts        content + game data + ESR tables → bundle (pure; fs reads in readGuideInputs.ts)
  build/parseNote.ts            frontmatter (fields.ts: YAML validators; content.ts: spine, glossary, sources)
  build/glossaryEntries.ts      glossary {fact:…} values and link: (against modifiers.json and the link schemes)
  build/markdown.ts             body → GuideBlock[] (links.ts: link schemes; wikilinks.ts: [[slug]])
  build/graph.ts                backlinks, next, spine step, orphans
  build/noteIndex.ts            familyNotes / itemNotes (which notes show a cube family or a misc item)
  build/directives/             one resolver per leaf directive (index.ts: LEAF_DIRECTIVES)
  build/esrGuideSources.ts      the ESR tables the directives read (vendors, difficulties; cube rows, names and renderMods
                                from the game-data cube code below)
  build/staleness.ts            block hashes, patch-note scan, staleReasons
  build/verifyLock.ts           .verify-lock.json, the guide:verify frontmatter edit
  build/report.ts               guide:report
  hooks/                        useGuide, useLoadedGuide (context), useVisitedNotes (the peek: src/components/PeekPopover + useHoverPopover)
  utils/                        pure screen helpers (app links, search, source cells, card lookup, visited list, map groups, spine entry cards + official reference list)
  screens/, components/
  index.ts                      lazy-route exports
scripts/generate-guide.ts       thin CLI
public/guide/                   committed output
```

The cube code (`cubeRows.ts`: the CubeRow reader and the item / type / string names; `cubeText.ts`: readable cells,
output bonuses, variant merging; `cubeFamilies.ts`: the `::recipes` families) lives in
`src/features/game-data/build/cube/` since the Cube Recipes page (`cube.json`, see GAME-DATA.md "Cube recipes") reuses
it. The guide imports it from there; game-data never imports the guide. Moving it did not change the guide output;
adding `rem` ("socketed items come out") to the cell text changed one row (the Odd Charm socket donut output), and
the recipe blocks gained their `link`.

Shared (`engine/` + `build/`) code uses relative `.ts` imports, no `@/`, and no DOM, like game-data.

## Bundle shape

See `src/features/guide/engine/schema.ts`. One file, `guide.json`: `{ notes, spine, glossary, sourceRefs, familyNotes,
itemNotes }`. Each note
carries its resolved body as a small typed tree (`GuideBlock[]`), its computed `backlinks`, `next`, `spineStep` and
`words`, and `staleReasons` (see Staleness). Links in the body are already resolved: `{ type: 'link', kind: 'note' | 'app' | 'external', href }` where
`href` is a slug, an app path (without the base URL) or an absolute URL.

**Notes index** (`build/noteIndex.ts`, from the resolved data blocks; keys and slugs sorted):

- `familyNotes`: cube family id → slugs. `::recipes[id]` gives that family, `::secret-recipes` / `::secret-recipe[N]`
  give `secret`, `::recipe-output[description]` gives the family of its cubemain rows (`assignCubeRows`).
- `itemNotes`: misc item code → slugs. `::source[Name]` of a misc item (a `{item=unique|set}` source is skipped),
  `::card[socketable:Name]` and the misc inputs of `::recipe-output` rows. A name maps to every misc code with that
  display name (sources.json and the clone's misc.txt names), so collapsed rows (stockers, coupons) find their notes.
  Unique, mythical, runeword and gemword cards are not indexed.

The Materials page (`/game-data/materials`, GAME-DATA.md "Materials") joins both in the browser: an item shows the
notes of its code plus those of the family that makes most of it. The game-data build cannot read them (it runs before
the guide build, and the guide reads the game data). Both fields are optional in `GuideBundle` (hand-built test
bundles leave them out); adding them kept `GUIDE_SCHEMA` at 1.

## Staleness

A patch should not flag every note, so a note that was verified on an older patch only turns amber when the build
finds a concrete reason.

| State    | When                                                             | Badge                                                          |
| -------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `draft`  | no `verified`                                                    | dashed, "Draft – not yet verified in-game"                     |
| `old`    | `verified` major.minor differs from the current ESR version      | amber, "Written for ESR x; may be out of date for y"           |
| `review` | `verified` is an older patch **and** `staleReasons` is non-empty | amber, "Checked on ESR x · needs review", reasons in a popover |
| `fresh`  | otherwise (equal, newer, or an older patch with nothing flagged) | subtle, "Checked on ESR x"                                     |

`staleReasons` (computed by the build, capped at 5 plus "… and N more", always empty for drafts):

- **Changed data blocks.** `content/guide/.verify-lock.json` records, per slug, the version `guide:verify` stamped and
  a sha256 of each resolved data block (`JSON.stringify` of the `DataBlock`), keyed by its directive source in note
  order: `source:Worldstone Shard{item=misc}`, `vendor:Gheed`, `secret-recipes`, `recipes:dstone-cycle`,
  `card:rw:Enigma` (spacing inside a card argument is ignored); a repeated directive gets `#2`, `#3`. A card block only
  holds the item kind, name and app link, so it only goes stale when the item is renamed or removed (a card whose
  stats change does not).
  A block whose hash differs, or that was added or removed, gives "Data in '<caption>' changed since <verified>".
- **Not recorded.** A verified note with no lock entry, or one recorded for another version (someone edited
  `verified:` by hand), gives "Verified, but the data behind this note was not recorded; it may have changed" and a build warning.
- **Patch notes.** Every `<esr>/patchnotes/<version>.md` newer than `verified` is searched case-insensitively for the
  note's **title** and the **glossary terms it owns** (aliases and `mentions` are left out: they are broad search
  words and flagged most notes). Whole words only: a letter, digit or hyphen next to the match rejects it ("Ore" does
  not match "Ore-shards"); terms shorter than 4 characters are skipped; plurals do not match; no fuzzy matching.
  "Patch notes 3.2.11 mention 'Stocker'". Reasons are unique (a repeated block caption gets a ` #2` suffix).

Commands (`scripts/generate-guide.ts` sub-commands; `--esr`/`--content` apply):

```bash
npm run guide:verify -- forging stockers  # verified: '<the guide build's ESR version>' + lock entries; then guide:generate
npm run guide:report                      # notes by state with reasons, volatility: high notes, drafts; writes nothing
```

`guide:verify` stamps the version the guide build compares against (the ESR clone's; the game-data manifest's without a
clone) and warns when `public/game-data` is on another version (run `game-data:generate` first). It edits only the
value of the `verified:` (or `verified :`) line of the frontmatter, keeping a trailing `# comment`, or adds the line
before the closing `---`; every other byte of the note stays as written. It refuses to run while the guide has build
errors. `npm run game-data:update` prints the report after regenerating the guide.

Maintainer checklist after `game-data:update`:

1. Read the "Guide freshness" report it printed (or run `npm run guide:report`).
2. For each **review** note: check the reasons in-game (and the note text), fix the text if needed, then
   `npm run guide:verify -- <slug>`. Do the same for **old** notes after a major.minor update.
3. Re-check the `volatility: high` notes even when nothing flagged them.
4. `npm run guide:generate`, then commit `content/guide` and `public/guide` together.

The `/esr-update` skill (`.claude/skills/esr-update/SKILL.md`) prepares steps 1–2 after a release: it reads the report
and patch notes and proposes note edits, but leaves `guide:verify` to the owner.

## Where it comes from (`sources.json`)

Generated by the **game-data** pipeline (`src/features/game-data/build/bundleSources.ts`) into
`public/game-data/sources.json`, so it refreshes with every `game-data:update`. Qualitative labels only, several per
item, in this order: `cube` ("Cube: Ancient Coupon" / "Cube: <family>" / "Cube"), `boss` ("Drops from <monster>"),
`maps` ("Drops in Endgame Maps"), `drop` ("Drops (random)"), `buy` ("Buy: <NPC>"), `gamble` ("Gamble"), `plugin`
("Boss drop (launcher plugin)"), `unknown`. The UI shows "Derived from the game files; may be incomplete." The guide
consumes it through `::source[...]`; the item cards show a Source line from it too. Every source block also renders a
"Look it up in the Drop Finder ↗" link to the plain official Drop Finder page (`DROP_FINDER_URL` in
`engine/linkSchemes.ts`) next to that line; it is added by the renderer (`GuideDataBlock`), so the bundle and the block
hashes do not change.

## Tests

Logic only (no component tests), colocated `*.test.ts`:

- build: YAML field validation (`fields`), the notes index (`noteIndex`), spine/glossary/sources parsing (`content`), glossary fact values and links (`glossaryEntries`), frontmatter (`parseNote`),
  markdown → GuideBlock conversion (`markdown`), link resolution (`links`), backlinks, next and orphans (`graph`),
  directive resolvers against a trimmed excel fixture (`directives/directives`, secret recipe bonuses and the fallback
  without them), cube families, variant merging and output bonuses (`cubeFamilies`: hidden markers, the counted random
  pool, the per-family bonus rules with a stub renderer, `stubRenderMods` in the shared fixture; against the ESR clone
  when present: every family matches, real rows through the real stat renderer, no renderer warning on any shown
  cubemain mod), block hashes, patch-note scan and staleReasons
  (`staleness`), the lock file and the byte-preserving `verified:` edit (`verifyLock`), the report (`report`), the
  manifest (`writeGuide`), whole-guide generation on fixtures (`generateGuide`).
- engine: link schemes (`linkSchemes`), freshness states, note lookups, local-graph layout, full-map edges and layout (dedupe, determinism, bounds, no label overlap on a guide-sized fixture), the browser loader (cache eviction, schema error).
- utils: app links, search, source cells, card name matching, the visited list, the map's grouping into spine steps and other topics, the spine screen's entry cards and official reference list (`guideHome`: targets exist, hrefs match `docs:` URLs).
- `guideIntegrity.test.ts`: manifest schema and sha256 of the committed files always; regenerating from `content/` in
  memory and comparing is skipped when the ESR clone or sources.json is missing.

Shared fixtures: `build/testContext.mock.ts` (txt rows, strings, game data, `tsv()`) and `engine/testNote.mock.ts`
(`makeNote()`). The source-label rules of `sources.json` are tested in game-data.

## Attribution

Notes list `sources` ids; the screen renders "Sources: …" from `_sources.yml`. The old unofficial wiki (CC BY-SA 3.0)
is consulted for facts only; no text or images are copied. The official site is linked, never mirrored.

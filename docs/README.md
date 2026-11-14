# D2R ESR Runeword Browser - Documentation

This folder contains all project documentation for the D2R ESR Runeword Browser.

## Documentation Structure

### [Features](./features/)

Feature descriptions, user stories, and task breakdowns.

### [Technical](./technical/)

Architecture decisions, coding guidelines, tech stack documentation, and implementation details.

## Quick Links

- [Contributing](./CONTRIBUTING.md) - Setup, commands, game-data workflow, conventions and releasing

### Feature Documentation

- [Core Data](./features/CORE-DATA.md) - HTM parsing, app startup flow, data refresh strategy
- [Runewords](./features/RUNEWORDS.md) - Browse and filter runewords (`/runewords`; the home page is described in [Navigation](./technical/NAVIGATION.md#home-page))
- [Socketables](./features/SOCKETABLES.md) - Unified view of all socketables (gems, runes, crystals) with filters
- [Unique Items](./features/UNIQUE-ITEMS.md) - Browse and filter unique items parsed from HTM pages
- [Game Data](./features/GAME-DATA.md) - Static bundles built from the ESR txt game files (Bases, Item Types, Best Base and Affixes pages)
- [Campaign Map](./features/CAMPAIGN-MAP.md) - Hand-placed map per act plus special areas, uber portals and endgame maps: quest items, caveats, waypoints, monsters, every curated fact with its source (`/campaign-map`)
- [Skills](./features/SKILLS.md) - Class skill trees and item-granted skills from the game files: descriptions, synergies, the items that grant each skill, per-level values (a calculator with synergy points and character level), and a skill peek on item property lines (`/skills`)
- [Modifiers](./features/MODIFIERS.md) - What item modifiers do (deadly strike, crushing blow, leech, resists, procs, speed, MF …): `modifiers.json` with every stat ESR items carry, modifier kinds and numbers from the game files and ESR's plugin configs, plus the calculator formulas; the `/modifiers` page (hand-checked explanations from `content/modifiers/` with source badges, fact tables, leech / MF / hit chance / crushing blow calculators); the modifier peek on item lines (whole-line templates in `modifierRefs.json`, sharing the skill peek's popover)
- [Specializations](./features/SPECIALIZATIONS.md) - ESR 3.3 perk trees from the game files and the specializations plugin configs: `specializations.json` (rules, the 60 perks with their cube, drop, formula and plugin links, page differences), perk icons, the `/specializations` page with `?tree=&perk=` deep links
- [Weapon Masteries](./features/WEAPON-MASTERIES.md) - The 20 weapon masteries from the game files and the official page: `masteries.json` page data (slugs, base names, drop odds, page differences), the `/weapon-masteries` page with `?cls=&mastery=` deep links
- [Mercenaries](./features/MERCENARIES.md) - Every hireling from the official skill page and `hireling.txt`: `mercenaries.json`, card and table views, `?hireling=&type=&difficulty=&view=` deep links (`/mercenaries`)
- [Kill Ledger](./features/KILL-LEDGER.md) - The book from the Starter Pack: `killledger.json` from cubemain, monprop death skills and map bosses, the `/kill-ledger` reference page with its kill and boss bonuses, differences from the official page
- [Patch Notes](./features/PATCH-NOTES.md) - The ESR patch notes per release from the repository's `patchnotes/` folder, with our item change reports and patch-note checks (HTML in a sheet, PDF download) (`/patch-notes`)
- [Loot Filter](./features/LOOT-FILTER.md) - Loot filter editor for ESR's loot filter plugin: shared and saved filters (Supabase), browser drafts, rule builder with game-data pickers, styles, label/sound/icon previews, JSON tab, test-item tab, download for the launcher
- [Loot Filter backlog](./features/LOOT-FILTER-BACKLOG.md) - Deferred loot filter requests: what waits for an in-game check, what needs the plugin or the mod, what was decided against
- [My Stash](./features/STASH.md) - Upload the ESR shared stash (.d2i), parsed and remembered in the browser only; Ancient Coupons page (`/stash`, `/stash/coupons`)
  - [All Items](./features/STASH-ITEMS.md) - Every stash page item, searchable by name and stats (`/stash/items`); [roadmap](./features/STASH-ROADMAP.md)
- [Character save parser](./features/CHARACTER-SAVE.md) - The ESR character save (.d2s) and `.d2rl` sidecar format, what is verified or inferred, error and old-save policy
  - [My Character](./features/CHARACTER-SAVE.md#my-character-page) - Several stored characters with a switcher, in tabs: Overview (the [computed sheet](./features/CHARACTER-SAVE.md#computed-sheet) with every number's sources and optional buffs), Gear, Skills, Combat (chance to hit and be hit), Storage, Progress (`/character?tab=`); "Create a build from this character"
- [Elixirs](./features/ELIXIRS.md) - ESR 3.3 utility elixirs from the game files: effects at a character level with Utility Potion Effectiveness / Duration and Alchemist perks, drop chances per area, perk-gated odds, Gem Infusion recipes, `?name=` links (`/elixirs`)
- [Terror Zones](./features/TERROR-ZONES.md) - Offline terror zone schedule from desecratedzones.json: floating widget on every page, schedule page, watched groups, notifications (`/terror-zones`)
- [Guide](./features/GUIDE.md) - New-player guide: markdown notes compiled into a static bundle, journey spine, data directives, staleness tracking
- [Ideas backlog](./features/IDEAS-BACKLOG.md) - Open feature ideas not planned yet, open checks, and ideas decided against

### Technical Documentation

- [Tech Stack](./technical/TECH-STACK.md) - Libraries, frameworks, and tools
- [Architecture](./technical/ARCHITECTURE.md) - Project structure and data flow
- [Navigation](./technical/NAVIGATION.md) - Routing, app shell layout, settings drawer
- [UI Components](./technical/UI-COMPONENTS.md) - Component patterns and theming
- [Coding Guidelines](./technical/CODING-GUIDELINES.md) - Conventions and standards
- [Data Models](./technical/DATA-MODELS.md) - IndexedDB schema and TypeScript types
- [Sagas](./technical/SAGAS.md) - Redux Saga patterns and architecture
- [Testing](./technical/TESTING.md) - Testing infrastructure and patterns

---

## Data System

The app uses a single HTM-based data system. All data is fetched from the ESR documentation site (`easternsunresurrected.com`), parsed with the native `DOMParser` API, and stored in a single IndexedDB database (`d2r-esr-runeword-browser`).

### Data Sources

| Data                                | Source                 |
| ----------------------------------- | ---------------------- |
| Socketables (gems, runes, crystals) | `gems.htm`             |
| Runewords                           | `runewords.htm`        |
| Gemwords                            | `gemwords.htm`         |
| Unique Weapons                      | `unique_weapons.htm`   |
| Unique Armors                       | `unique_armors.htm`    |
| Unique Others                       | `unique_others.htm`    |
| Mythical Uniques                    | `unique_mythicals.htm` |
| Ascendancies                        | `ascendancies.htm`     |
| Version info (fallback)             | `changelogs.html`      |

### Features

| Feature               | Route                                                                                  | Description                                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                  | `/`                                                                                    | Search across runewords/gemwords/uniques/mythicals/bases, section cards, latest builds, official ESR links, community tools; `/?…` redirects to `/runewords?…` ([NAVIGATION.md](./technical/NAVIGATION.md#home-page))                                                                          |
| Runewords             | `/runewords`                                                                           | ~386 runewords with filters for runes, sockets, item types, tier points, req level                                                                                                                                                                                                             |
| Guide                 | `/guide`, `/guide/:slug` (`/guide/map` redirects)                                      | New-player guide: one overview of every note grouped by journey step, note search, freshness badges, data blocks generated from the game files; renders before the HTM data sync finishes ([GUIDE.md](./features/GUIDE.md), `src/features/guide/`)                                             |
| Gemwords              | `/gemwords`                                                                            | ~590 gem-based socket recipes with filters for gems, sockets, item types, req level                                                                                                                                                                                                            |
| Socketables           | `/socketables`                                                                         | ~177 socketable items across 5 categories                                                                                                                                                                                                                                                      |
| Unique Items          | `/uniques`                                                                             | Unique weapons, armors, and other items with category filters                                                                                                                                                                                                                                  |
| Mythicals             | `/mythicals`                                                                           | Mythical unique items (`src/features/mythical-uniques/`)                                                                                                                                                                                                                                       |
| Ascendancies          | `/ascendancies`                                                                        | Ascendancies with their tier bonuses; a how-to panel (Orb of Creation → ascendancy panel) with the Hell orb locations (static, checked in game), the Tier 1–5 challenges and the Lich King Bonus parsed from the official page (`src/features/ascendancies/`)                                  |
| Skills                | `/skills`                                                                              | The 8 class skill trees and 181 item-only skills: description, mana, synergies, the uniques / sets / runewords granting each, per-level values (calculator with synergies and character level), a skill peek on item lines ([SKILLS.md](./features/SKILLS.md), `src/features/skills/`)         |
| Modifiers             | `/modifiers`                                                                           | What every item modifier does in ESR: 48 hand-checked explanations with source badges, numbers per difficulty / target next to vanilla, calculators, the stats and example items; a generated entry for every other stat ([MODIFIERS.md](./features/MODIFIERS.md))                             |
| Kill Ledger           | `/kill-ledger`                                                                         | Every kill and boss bonus of the book and how each unlocks ([KILL-LEDGER.md](./features/KILL-LEDGER.md))                                                                                                                                                                                       |
| Patch Notes           | `/patch-notes`, `/patch-notes/:version`                                                | The author's patch notes per release, our item change reports and patch-note checks ([PATCH-NOTES.md](./features/PATCH-NOTES.md))                                                                                                                                                              |
| Specializations       | `/specializations`                                                                     | The 4 ESR 3.3 perk trees (60 perks): how to unlock and respec, every perk with what the game files say about it, `?tree=&perk=` deep links ([SPECIALIZATIONS.md](./features/SPECIALIZATIONS.md))                                                                                               |
| Weapon Masteries      | `/weapon-masteries`                                                                    | How a weapon mastery works and what each of the 20 does, by class weapon: recipe, effects, removal, `?cls=&mastery=` deep links ([WEAPON-MASTERIES.md](./features/WEAPON-MASTERIES.md))                                                                                                        |
| Mercenaries           | `/mercenaries`                                                                         | Every hireling: act, gold, skill levels and stats at each level band, as cards or a comparison table ([MERCENARIES.md](./features/MERCENARIES.md))                                                                                                                                             |
| Game Data: Bases      | `/bases` (`/game-data` and old `/game-data/...` links redirect to the new URLs)        | Base items from the ESR txt game files: search, kind/tier/type/sockets/level/class filters, sorting, socket caps per ilvl band, a Normal/Exceptional/Elite families table (`src/features/game-data/`)                                                                                          |
| Game Data: Sets       | `/sets`                                                                                | Every set from sets.txt / setitems.txt: items with own lines, per-item and set-wide partial bonuses, full-set bonuses, sources; search, max level, pieces, class, `?name=` (set or set item)                                                                                                   |
| Game Data: Best Base  | `/best-base`                                                                           | Best base finder for a runeword and a persisted character (class/level/Str/Dex), ranked per item type; `?rw=&v=` from the runeword cards, `cls`/`lvl`/`str`/`dex` override the character                                                                                                       |
| Game Data: Affixes    | `/affixes`                                                                             | Affix browser + "what can roll" on a base (`?base=<code>&ilvl=<n>`)                                                                                                                                                                                                                            |
| Game Data: Item Types | `/item-types`                                                                          | Item type (Equiv) tree with socket caps; `?type=<code>` focuses a node                                                                                                                                                                                                                         |
| Game Data: Areas      | `/area-levels`                                                                         | Every area from levels.txt by act, then the endgame maps by tier and zone: monster level, density and unique packs per difficulty, waypoint, boss, connections; search, min / max monster level                                                                                                |
| Campaign Map          | `/campaign-map`                                                                        | Acts I–V as a hand-placed schematic, special areas, ubers & portals, endgame maps by tier: quest items, heads up, nearest waypoint, monsters; every curated fact labelled with its source ([CAMPAIGN-MAP.md](./features/CAMPAIGN-MAP.md), `src/features/campaign-map/`)                        |
| Elixirs               | `/elixirs`                                                                             | The 35 utility elixirs of ESR 3.3: effects at a chosen level and bonuses, drop chances per area, odds with the Alchemist perks, recipes ([ELIXIRS.md](./features/ELIXIRS.md), `src/features/elixirs/`)                                                                                         |
| Terror Zones          | `/terror-zones`                                                                        | Offline terror zone rotation from `desecratedzones.json`: now / next / upcoming in local time, watched zone groups, opt-in notifications, boosts; a floating widget on every page ([TERROR-ZONES.md](./features/TERROR-ZONES.md))                                                              |
| Loot Filters          | `/loot-filters`, `/loot-filters/:id`, `/loot-filters/draft/:id`, `/loot-filters/sully` | Loot filter editor for ESR's loot filter plugin: library (Shared / My filters), rule builder, styles, JSON and test tabs, download for the launcher; saving and sharing need Supabase ([LOOT-FILTER.md](./features/LOOT-FILTER.md))                                                            |
| My Stash              | `/stash`, `/stash/coupons`, `/stash/items`                                             | Upload the shared stash (.d2i), parsed in the browser and remembered in IndexedDB; the Ancient Coupons you own with the uniques they make, have / need, Wild Card recipe and locations ([STASH.md](./features/STASH.md)); All Items (in progress, [STASH-ITEMS.md](./features/STASH-ITEMS.md)) |
| My Character          | `/character` (`/stash/character` redirects)                                            | Character saves (.d2s + optional .d2rl) parsed and remembered in the browser, several at once with a switcher; Overview, Gear, Skills, Combat, Storage and Progress tabs in `?tab=` ([CHARACTER-SAVE.md](./features/CHARACTER-SAVE.md#my-character-page))                                      |
| Builds                | `/builds`, `/builds/new`, `/builds/:buildId/edit`, `/build/:buildId`, `/user/:userId`  | Shared builds; needs the optional Supabase backend (`src/features/builds/`, `src/features/auth/`). `/builds/new` can [start from a save file](./features/CHARACTER-SAVE.md#start-a-build-from-a-save)                                                                                          |
| Not found             | `*`                                                                                    | Catch-all 404 screen                                                                                                                                                                                                                                                                           |

Favourites for runewords, gemwords, and unique items (sign-in required, synced to Supabase) live in `src/features/favorites/`.

### Static game-file bundles

A second, build-time data source: `npm run game-data:generate` converts the ESR repo's txt game tables (from a local
clone at `../Eastern_Sun_Resurrected`) into JSON committed under `public/game-data/` (`manifest.json`, `types.json`,
`bases.json`, `runewords.json`, `affixes.json`, `sources.json`, `lootfilter.json`, `enhance.json`, `cube.json`,
`materials.json`, `sets.json`, `skills.json`, `skilldetails.json`, `skillcalc.json`, `crafting.json`, `tiers.json`, `areas.json`, `stash.json`, `terrorzones.json`, `modifiers.json`, `masteries.json`, `specializations.json`, `mercenaries.json`; `skills.json` feeds the Skills page
`materials.json`, `sets.json`, `skills.json`, `skilldetails.json`, `skillcalc.json`, `crafting.json`, `tiers.json`, `areas.json`, `stash.json`, `terrorzones.json`, `modifiers.json`, `masteries.json`, `specializations.json`, `killledger.json`; `skills.json` feeds the Skills page
and the builds feature, `crafting.json` the builds feature only), plus item icons from the mod's HD sprites, with the
vanilla D2R art extracted from a game install as the fallback (`npm run game-data:icons`: `icons.json` + `icons/*.webp`:
bases, uniques, set items and socketables, shown on the Bases, Sets, Unique Items and Socketables pages, in builds and in the runeword cards' socket row),
and skill icons cropped from the mod's HD skill icon sheets (`icons/skills/*.webp`, `npm run game-data:skill-icons`).
The browser fetches these lazily;
they never go through the HTM parsers or IndexedDB. The game-file version is `metadata.modVersion` of the cloned
repo's `d2rloader/metadata.json`; the docs-data version is the same field read live from GitHub at startup (the
changelog page is only a fallback), so the two normally match. See [Game Data](./features/GAME-DATA.md).

After an ESR release, run `npm run game-data:update`: it clones or pulls the ESR repo, regenerates the bundles, refreshes
the test fixtures, runs the game-data tests and the staleness check, and prints a summary. Flags and the manual fallback
are in [Game Data → Regenerating](./features/GAME-DATA.md#regenerating). The `/esr-update` Claude Code skill
(`.claude/skills/esr-update/SKILL.md`) runs the whole update with review and asks before committing.

The guide is a third static source: `npm run guide:generate` compiles `content/guide/` into `public/guide/` and also
rewrites `public/sitemap.xml` (static routes + one URL per note, `scripts/lib/sitemap.ts`); `npm run guide:check` fails
when either is stale. See [Guide](./features/GUIDE.md).

---

## Status

Documentation is actively being maintained. See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to set up, test and release.

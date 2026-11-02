# D2R ESR Runeword Browser - Documentation

This folder contains all project documentation for the D2R ESR Runeword Browser.

## Documentation Structure

### [Features](./features/)

Feature descriptions, user stories, and task breakdowns.

### [Technical](./technical/)

Architecture decisions, coding guidelines, tech stack documentation, and implementation details.

## Quick Links

- [Contributing & Documentation Process](./CONTRIBUTING.md) - How to continue documentation sessions

### Feature Documentation

- [Core Data](./features/CORE-DATA.md) - HTM parsing, app startup flow, data refresh strategy
- [Runewords](./features/RUNEWORDS.md) - Browse and filter runewords (`/runewords`; the home page is described in [Navigation](./technical/NAVIGATION.md#home-page))
- [Socketables](./features/SOCKETABLES.md) - Unified view of all socketables (gems, runes, crystals) with filters
- [Unique Items](./features/UNIQUE-ITEMS.md) - Browse and filter unique items parsed from HTM pages
- [Game Data](./features/GAME-DATA.md) - Static bundles built from the ESR txt game files (Bases, Item Types, Best Base and Affixes pages)
- [Skills](./features/SKILLS.md) - Class skill trees and item-granted skills from the game files: descriptions, synergies, the items that grant each skill (`/skills`)
- [Loot Filter](./features/LOOT-FILTER.md) - Loot filter editor for ESR's loot filter plugin: shared and saved filters (Supabase), browser drafts, rule builder with game-data pickers, styles, label/sound/icon previews, JSON tab, test-item tab, download for the launcher
- [Loot Filter backlog](./features/LOOT-FILTER-BACKLOG.md) - Deferred loot filter requests: what waits for an in-game check, what needs the plugin or the mod, what was decided against
- [Guide](./features/GUIDE.md) - New-player guide: markdown notes compiled into a static bundle, journey spine, data directives, staleness tracking

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

| Feature               | Route                                                                                  | Description                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                  | `/`                                                                                    | Search across runewords/gemwords/uniques/mythicals/bases, section cards, latest builds, official ESR links, community tools; `/?…` redirects to `/runewords?…` ([NAVIGATION.md](./technical/NAVIGATION.md#home-page))                 |
| Runewords             | `/runewords`                                                                           | ~386 runewords with filters for runes, sockets, item types, tier points, req level                                                                                                                                                    |
| Guide                 | `/guide`, `/guide/map`, `/guide/:slug`                                                 | New-player guide: small linked notes on a journey spine, note search, freshness badges, data blocks generated from the game files; renders before the HTM data sync finishes ([GUIDE.md](./features/GUIDE.md), `src/features/guide/`) |
| Gemwords              | `/gemwords`                                                                            | ~590 gem-based socket recipes with filters for gems, sockets, item types, req level                                                                                                                                                   |
| Socketables           | `/socketables`                                                                         | ~177 socketable items across 5 categories                                                                                                                                                                                             |
| Unique Items          | `/uniques`                                                                             | Unique weapons, armors, and other items with category filters                                                                                                                                                                         |
| Mythicals             | `/mythicals`                                                                           | Mythical unique items (`src/features/mythical-uniques/`)                                                                                                                                                                              |
| Ascendancies          | `/ascendancies`                                                                        | Ascendancies with their tier bonuses (`src/features/ascendancies/`)                                                                                                                                                                   |
| Skills                | `/skills`                                                                              | The 8 class skill trees and 181 item-only skills from the game files: description, mana, synergies, the uniques / sets / runewords granting each ([SKILLS.md](./features/SKILLS.md), `src/features/skills/`)                          |
| Game Data: Bases      | `/game-data/bases` (`/game-data` redirects here)                                       | Base items from the ESR txt game files: search, kind/tier/type/sockets/level/class filters, sorting, socket caps per ilvl band, a Normal/Exceptional/Elite families table (`src/features/game-data/`)                                 |
| Game Data: Sets       | `/game-data/sets`                                                                      | Every set from sets.txt / setitems.txt: items with own lines, per-item and set-wide partial bonuses, full-set bonuses, sources; search, max level, pieces, class, `?name=` (set or set item)                                          |
| Game Data: Best Base  | `/game-data/best-base`                                                                 | Best base finder for a runeword and a persisted character (class/level/Str/Dex), ranked per item type; `?rw=&v=` from the runeword cards, `cls`/`lvl`/`str`/`dex` override the character                                              |
| Game Data: Affixes    | `/game-data/affixes`                                                                   | Affix browser + "what can roll" on a base (`?base=<code>&ilvl=<n>`)                                                                                                                                                                   |
| Game Data: Item Types | `/game-data/types`                                                                     | Item type (Equiv) tree with socket caps; `?type=<code>` focuses a node                                                                                                                                                                |
| Game Data: Areas      | `/game-data/areas`                                                                     | Every area from levels.txt by act, then the endgame maps by tier and zone: monster level, density and unique packs per difficulty, waypoint, boss, connections; search, min / max monster level                                       |
| Loot Filters          | `/loot-filters`, `/loot-filters/:id`, `/loot-filters/draft/:id`, `/loot-filters/sully` | Loot filter editor for ESR's loot filter plugin: library (Shared / My filters), rule builder, styles, JSON and test tabs, download for the launcher; saving and sharing need Supabase ([LOOT-FILTER.md](./features/LOOT-FILTER.md))   |
| Builds                | `/builds`, `/builds/new`, `/builds/:buildId/edit`, `/build/:buildId`, `/user/:userId`  | Shared builds; needs the optional Supabase backend (`src/features/builds/`, `src/features/auth/`)                                                                                                                                     |
| Not found             | `*`                                                                                    | Catch-all 404 screen                                                                                                                                                                                                                  |

Favourites for runewords, gemwords, and unique items (sign-in required, synced to Supabase) live in `src/features/favorites/`.

### Static game-file bundles

A second, build-time data source: `npm run game-data:generate` converts the ESR repo's txt game tables (from a local
clone at `../Eastern_Sun_Resurrected`) into JSON committed under `public/game-data/` (`manifest.json`, `types.json`,
`bases.json`, `runewords.json`, `affixes.json`, `sources.json`, `lootfilter.json`, `enhance.json`, `cube.json`,
`materials.json`, `sets.json`, `skills.json`, `skilldetails.json`, `crafting.json`, `tiers.json`, `areas.json`; `skills.json` feeds the Skills page
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

Documentation is actively being maintained. See [CONTRIBUTING.md](./CONTRIBUTING.md) for current status and next steps.

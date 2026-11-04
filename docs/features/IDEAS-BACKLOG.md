# Ideas backlog

Open feature ideas that are not planned yet, and ideas we decided against. They came from reviewing other ESR sites in
October 2026; the ideas from that review that have shipped (grouped header, home page, cube and enhancement pages,
materials, sets, build model, item icons, bases families view and others) are documented in their feature docs and not
repeated here. Sizes: S = a day or less, M = a few days, L = a week or more. Checked against the code on 2026-11-04.

## Open ideas

### Quest-route notes (M, S per act)

Guide notes for the Act 2, 3 and 5 quest lines: where each quest area is in ESR (some are moved or changed), what the
quest needs, and what to skip. New players lose time on these more than on anything the data pages answer. Written in
our own words, with our own diagrams, and checked in game before they leave draft.

Touches: `content/guide/notes/` (new notes), `content/guide/spine.yml` (a spine step or entry card), the guide map,
and links to the Areas page (`/game-data/areas`) for area levels and connections. Needs an owner decision on scope and
someone to verify the routes in game.

### Icon-tile category pickers (M)

Show item type and category filters as tiles with an item icon and a label instead of a plain checkbox list: the
runeword and gemword item type filter, the Unique Items categories and the Bases type filter. Tiles are quicker to scan
and easier to tap on a phone.

Touches: `RunewordFilters`, `GemwordFilters`, `HtmCategoryFilter` (Unique Items), `BasesScreen`, and the shared icon
store (`useItemIcons`, `<ItemIcon>`, `icons.json`). Needs one representative icon per item type or category, picked
from a base of that type. The runeword cards themselves stay without icons (decided: too crowded); this idea is about
the filter controls only.

### Recipe-diagram cards (M)

A compact "input + input → result" layout for mechanics that are a single cube recipe (for example "item + gem → same
item with a random affix"), as an alternative to the table rows. It reads faster than a table for one or two recipes.

Touches: the guide recipe directives (`::recipes`, `::recipe-output`, `::secret-recipe` in `src/features/guide/`) and
possibly the Cube and Enhance pages (`/game-data/cube`, `/game-data/enhance`). Value is low while the tables work.

### Paperdoll and charm grid for builds (L)

Show a build's equipment as a paperdoll with item art, and its charms as an inventory grid with the real charm sizes
(1×1, 1×2, 1×3). Today the build page has a text slot layout (`EquipmentGrid`) and charms are free-text entries
(`CharmsEditor`), so the grid also needs structured charm entries (an additive optional field on `build_data`, as for
the earlier build model changes). Inventory sizes are in the game files (`invwidth` / `invheight`).

Touches: `src/features/builds/` (`buildData`, `BuildForm`, `EquipmentGrid`, `CharmsEditor`, the build detail tabs),
the item icons, and `builds-feature-docs/FEATURE-BUILD-SHARING.md`. Value is low for the effort.

### Multi-language support (L)

Show item names, stat lines and the UI in the languages the game ships (the ESR string tables hold them). Steps, in
order:

1. keep the other languages' strings in the game-data generator (`src/features/game-data/build/strings.ts`) instead
   of only English;
2. render the bundles per language at build time;
3. move the HTM-parsed browse pages (runewords, gemwords, uniques, mythicals, socketables) to txt bundles, since the
   official docs pages are English only. This is the blocker and a migration of its own; the Sets and Cube pages
   already show it can be done;
4. add a small UI string dictionary;
5. build per-language search text at build time;
6. put the language in the URL so links keep it.

Guide notes would stay English; translating them is the largest and fastest-ageing cost. No non-English users are known
today, so the value is low.

### Per-page document titles (S)

Every page has the same browser tab title from `index.html`. A title per page ("Runewords", "Bases", a guide note's
title, a build's name) helps tabs, bookmarks, history and search results. React 19 renders `<title>` from components,
so each screen can set its own.

Touches: the screens under `src/features/*/screens/`, `index.html` (the fallback title), and
[NAVIGATION.md](../technical/NAVIGATION.md).

## Open checks

- **Guide notes are all draft.** None of the 31 notes has a `verified:` stamp and `content/guide/.verify-lock.json`
  does not exist yet. Verify notes in game and record them with `npm run guide:verify` ([GUIDE.md](./GUIDE.md)).

## Decided against

| Idea                                                                   | Why not                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copying the official ESR docs pages into the app (iframes or copies)   | The docs have no licence, copies fall behind the mod, and iframes break routing, theming and search. We link to the official pages instead.                               |
| Hand-maintained translated copies of guide pages                       | They fall behind quickly. Linking to the official pages in other languages is cheaper.                                                                                    |
| A community slang glossary in another language                         | It means nothing to English readers.                                                                                                                                      |
| Hard-coded forge tables and success rates                              | They go stale without anyone noticing. Derive them from the game files or leave them out.                                                                                 |
| Storing rendered (translated) text in builds                           | Viewers would see the author's language and values would never update. Builds store ids and arguments.                                                                    |
| Translating rendered English text with a lookup map and fuzzy matching | Large and fragile. Keyed strings from the game files make it unnecessary.                                                                                                 |
| Dropping URL state, Copy Link or `?name=` links                        | Guide links, Best Base and shared links depend on them.                                                                                                                   |
| Replacing the cross-section home page with a static landing page       | The current home page already gives the overview, and `/?…` links keep working.                                                                                           |
| One record per socket count, exact-only socket input, unsummed lines   | All are worse than our single card per runeword, the socket range input and summed bonuses.                                                                               |
| Dropping Warlock, gemwords in builds, the snapshot diff or validation  | Ours is better on each; keep them.                                                                                                                                        |
| Email-only sign-in                                                     | We already offer the sign-in providers we need.                                                                                                                           |
| Taking art or page content from other fan sites                        | Icons come only from the mod files and the vanilla game art through our own generator, with credit. Other sites' pages are used at most as a signal of what readers want. |
| A finer text-size slider; a decorative nav tile                        | No gain over the four text-size steps; the tile adds nothing.                                                                                                             |
| Fetching every string table up front for search                        | Only relevant with multi-language support, and then build-time search text is cheaper.                                                                                    |

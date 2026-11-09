# Campaign Map Feature

A quest and special-areas guide drawn as a map: Acts I–V as hand-placed schematics, the ESR special dungeons, the uber
and special portals and the endgame maps by tier, with a detail panel for every area (`/campaign-map`,
`src/features/campaign-map/`).

## Purpose

- See how the areas of an act connect (walk across, stairs, one-way passages, portals, cube portals, act travel),
  including ESR's rewired Acts II, III and V
- Find where a quest item is ("heart" finds Sewers Level 2), which areas have a waypoint and the nearest waypoint to
  any area
- Read the caveats before going somewhere: no teleport, no town portal, one-way passages, quest gates, the official
  page's warnings, hidden exits (behind a click)
- Look up an area's monster level, density and unique packs per difficulty, the bosses, and the special dungeons, uber
  levels and endgame map zones
- Know how sure each fact is: every hand-written fact carries its source

Out of scope: route planning, level-by-level routing, pan and zoom, a phone-sized map (the list view is the small-screen
layout).

## Page layout

```
PageShell "Campaign Map"   meta: what it covers, ESR version
┌ ToolbarCard ────────────────────────────────────────────────────────────────────────┐
│ [Find an area, boss or quest item… ( / )] [Copy Link]                               │
│ tabs: Act I … Act V                    Special areas  Ubers & portals  Endgame Maps │
│ (tabs with a map, from lg): [Map | List]  hint (peek, click, /, Esc)                │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌ map card ───────────────────────────────┐ ┌ side column, sticky, 20rem ──┐
│ CampaignMapCanvas (role: engine + SVG)  │ │ area detail (selected)       │
│ stamp "Act III · ESR 3.3 · …"           │ │ or the section's notes       │
│ legend: areas · paths · marks           │ │                              │
└─────────────────────────────────────────┘ └──────────────────────────────┘
```

- **Tabs** are links (`?tab=…`), so middle-click and Back work. Acts on the left, the other sections on the right; the
  row scrolls sideways inside the toolbar card on phones (`SUBTAB_*` classes). Switching tab keeps the selection only when the area belongs to the new tab.
- **Map | List** (tabs with a drawn map: the acts and Endgame Maps). The list carries the same data in reading order:
  kind swatch, name, official name, bosses, quest item icons, a heads-up mark, WP, Hell monster level, "Not curated
  yet" / "Not on the map yet". Endgame Maps group the list by tier and zone. Twin rows (Tal Rasha's Tomb ×7) are one
  row, like one station on the map; a twin id (`?area=67`) selects that row and station (`twinRepresentative`).
- **Below `lg`** the map is hidden (CSS only, like the old guide map) and the list is shown with the side column above it;
  a tap on a row (or a panel chip) scrolls the panel into view (`hooks/usePanelScroll.ts`); the search-hit pulse then
  does not scroll the list.
- **Special areas** and **Ubers & portals** have no map (`layout: null`): a card grid of the section's areas. A card of
  an area drawn on another tab opens it there ("Show on map →", a normal navigation, so Back returns to the cards); an
  area whose home has no map (the uber levels) is selected in place.
- **Side column**: the detail panel of the selected area, else the section's notes.
- No print button or print styles (owner decision).

## URL state

`utils/urlState.ts` (tested). Read on every render and kept in the URL:

| Param  | Values                                            | Notes                                                       |
| ------ | ------------------------------------------------- | ----------------------------------------------------------- |
| `tab`  | `act1`…`act5`, `special`, `portals`, `maps`       | Left out when it equals the area's home (or Act I, no area) |
| `area` | levels.txt `Id` (stable when ESR renames an area) | Alone it opens the area's home tab: `/campaign-map?area=93` |
| `view` | `list`                                            | The map is the default                                      |
| `act`  | `1`…`5`                                           | Alias of `tab=actN` (read only)                             |

An unknown area id is dropped and a twin id becomes its family's first id (Tal Rasha's Tomb 67 → 66); an unknown tab,
or one that does not list the area (`?tab=act2&area=12`), falls back to the area's home, else the first section. Selecting an area
on its own tab replaces the history entry (Back is not flooded); a tab switch, a search hit or a ghost jump pushes one.
`campaignMapAreaPath(id)` builds the deep link other pages use.

Examples: `/campaign-map?area=93` (Sewers Level 2 on Act III), `/campaign-map?tab=act3&view=list`,
`/campaign-map?tab=maps&area=197`, `/campaign-map?tab=portals`, `/campaign-map?act=5`.

## Detail panel

`components/AreaDetailPanel.tsx`, in this order (empty sections are left out):

1. **Header**: eyebrow (section · tier · zone · terrain), name, the official page's name when it differs ("Official Maps
   page: Unholy Altar"), chips: Waypoint / No waypoint, bosses (curated plus the map boss of the game files), Special
   area, "One of N identical areas" (twins), "Not curated yet".
2. **Quest items**: the in-game icon and the item name (`icons.json` `quest`, by item code; the name is the one
   stashnames.json `bases` gives the code: `vip` is "Top of the Horadric Staff"; the quest text when a
   code has no name), the quest, how, the source label.
3. **Heads up** (`utils/areaFacts.ts` `headsUpLines`, tested): teleport rules (game files `off` / `restricted`; the
   official page's "no teleport across walls" list is outdated: the owner confirmed you can teleport there, so those
   five areas carry a note instead), no town portal, the quest gate (`questGate` labelled with the vanilla
   quest ids: 11 The Tainted Sun, 13 The Summoner, 18 Khalim's Will, 26 Terror's End, 39 Rite of Passage, 40 Eve of
   Destruction; another value reads "quest #N"), one-way passages and portals in and out (act travel and cube portals
   are one way by nature and not listed), then the
   curated warning notes and the spoiler notes, each behind a `<details>` ("show the official hint"). The Dead End hint
   stays the official text; the page never fills it in.
4. **Boss** / **Bosses** (every level of a tiered endgame map zone; see [Map bosses](#map-bosses)).
5. **Notes**: the other curated notes, each with its source label.
6. **Getting there**: "No known entrance" (`entryUnknown`), the `entry` text (with the source of the route in; it
   replaces the route lines), else the cube / portal routes into the area with their `via` label, the nearest waypoint(s) and the area count, then a chip per connection (styled by edge kind:
   dashed for portals and unconfirmed edges, `→` / `←` for one way). A chip selects that area (another tab when it lives
   there), so the map can be walked from the panel.
7. **Monsters**: level, density and unique packs for Normal / Nightmare / Hell, or "No monsters".
8. **More**: Area Levels page row (`/area-levels?search="<name>"`), cube recipe families (quest items, map portals,
   Pandemonium keys) when they apply, the official Drop Finder (no deep link: its hash is positional) when the area
   has monsters, the official Maps page (Endgame Maps page for maps), the levels.txt Id and Copy Link of this area.

### Map bosses

`components/MapBossSection.tsx`, data from `utils/mapBossFacts.ts` `zoneBossSummary` (tested). Shown on every level of
a tiered map zone (the same summary on the entry, the middle levels and the arena):

- How the zone opens: "Opened by the <map item> map: cube it by itself in Act V, Hell" (areas.json `mapItemName` of the
  zone's entry level; Act V is the official page's word, the files only say Hell).
- A zone without a boss says so, with its Hell unique pack range. Chaos Rift ("Double T1 Bosses") lists the three tier 1
  bosses and says two of them come (the map preset decides which; the files do not say).
- A card per boss links to its arena inside the selected zone (Chaos Rift Level 4 for the tier 1 bosses seen from
  Chaos Rift), else its own (`zoneArena`). `<details>`, open on its own arena or when the zone has one boss; Chaos Rift's start closed): the
  fight in a few words, how to hurt the invincible tier 5 bosses (amber box), the rewards in Hell at players 1 with
  players 8 in brackets, "up to N more" generic loot rolls (a per-kill drop cap may cut them), the terrorized Worldstone
  Shards from the files (and a roll the terrorized table skips; a blank terrorized TC would read "likely his normal
  table", labelled unconfirmed, none in ESR 3.3 since Lucion got his own; the official page dropped its terror paragraph
  in ESR 3.3.03, so nothing is compared), a loot table shared with another
  zone's boss (`sameTableAs`; none in ESR 3.3: Herald of Doom has his own Endless Abyss table since then), the launcher
  plugin set drop (Eternal Hourglass), and the players 8 (uber) variant.
- Where the official page lists another figure or name, the reward row says "Official page: …" (amber text): computed
  at runtime by comparing the files' chances with the page figures kept in `data/mapBosses.ts` (`page`), so the note
  disappears by itself when ESR fixes the files or the page. A page item name the files lack ("Mephisto's Demonic
  Horn") is paired with the files' item the page does not name only when there is exactly one; the perk drops below are
  left out of that pairing.
- Since ESR 3.3 every map boss rolls a 2% Alien Artefact (treasureclassex.txt `Artefact Chance`). The perk gate sits
  one class down (`Artefacts`, since 3.3.02), so the rewards table still prints the 2%, and that row reads "Official
  page: Archaeologist perk only (…)" (`PERK_DROPS` in `data/mapBosses.ts`, shown for every boss, curated or not).
- A link to the guide note `/guide/endgame-bosses`; the note links back to every arena (`page:/campaign-map?area=…`).

Rewards and chances are computed at build time from the treasure classes (areas.json `mapBosses`, GAME-DATA.md
"Areas"); only the fight, damage and uber notes and the page's figures are hand-written (`data/mapBosses.ts`, keyed by
monstats Id, tagged `endgame` or `tables`). The integrity test fails when a map boss has no entry there or an entry is
no longer a map boss.

Guide notes about an area are not linked yet: that needs an `areas:` frontmatter key validated by the guide build (the
UX proposal), not text matching.

### Nearest waypoint

`utils/nearestWaypoint.ts` `nearestWaypoints` (tested): a breadth-first walk **backwards** from the area over the edges
whose both ends are in the area's own section, act travel left out. A two-way edge counts both ways, a one-way edge only
in its direction (you walk from the waypoint to the area). Every waypoint at the shortest distance is listed; distance 0
when the area has its own waypoint; nothing for an area no waypoint leads to (map levels, portal-only areas).

## Trust labels

`utils/sourceLabels.ts` `factSourceLabel` (tested), rendered by `components/FactSourceLabel.tsx` after every curated
fact (quest, note, heads-up line, route):

| `FactSource` | Label                                                         | Look          |
| ------------ | ------------------------------------------------------------- | ------------- |
| `official`   | Official Maps page                                            | green outline |
| `endgame`    | Official Endgame Maps page (map boss fights and rewards)      | green outline |
| `tables`     | Game files                                                    | muted outline |
| `vanilla`    | Vanilla, unconfirmed in ESR                                   | amber, dashed |
| `owner`      | Confirmed                                                     | outline       |
| `verify`     | adds ", unconfirmed" (amber, dashed); vanilla already says it |

Plain game-file facts that need no label (the monster table, the waypoint chip) have none.

## Interaction

- **Click / Enter** on a station or list row selects (the URL changes, the panel updates); it never navigates away. A
  modified click opens the deep link (stations and rows are real links: `areaHref(id)`; the canvas adds the router
  basename to its SVG links itself, `useHref('/')`).
- **Hover / focus peek** (`hooks/useAreaPeek.ts`): one `PeekPopover` for the whole map by event delegation on the
  canvas wrapper: `pointerover` / `pointerout` / `focus` / `blur` find the element with `data-area-id` around the
  target (`closest`; empty canvas opens nothing) and drive `useHoverPopover().delegate`; the popover is anchored to
  that element (`virtualRef`). Mouse and `:focus-visible` only, 300 ms delay, so touch taps never trap; a selection,
  jump, search pick or tab click closes it. Content (`components/AreaPeek.tsx`): name, terrain,
  waypoint, monster levels, quest items, bosses, the first two caveats.
- **Search** (`components/CampaignSearch.tsx`, `utils/search.ts`, tested): a cmdk combobox with our own matching:
  case-insensitive substring over `normaliseItemName` of the area name, official name, quest item name, boss, quest
  and map zone; ranked exact, prefix, word prefix, substring, then by kind (area name first), then map order; one hit per
  area (its best text) and one per twin family, 12 at most. `/` anywhere focuses it. Picking a hit switches to the area's home tab, selects it,
  scrolls it into view and pulses it for 1.4 s (`highlightId`).
- **Arriving with `?area=`** (a link from another page such as the Ascendancies orb table, or a shared link) does the
  same once per mount: `highlightId` starts as the URL's area, so the map scrolls to it and pulses; below `lg` the
  detail panel is scrolled to instead.
- **Selected station**: an amber glow disc and a thick amber ring around the dot (amber like the search pulse), and its
  label in a filled amber pill drawn last over the whole canvas (`SelectedLabel` in `canvas/Station.tsx`, fitted to
  the rendered text with `getBBox`), so no other label or line covers it; on a dungeon stack the pill names the
  selected level ("Hole Level 2"). The rest of the map is not dimmed (owner decision).
- **Esc** and the panel's Close clear the selection and put focus back on the area's station or row (the search and
  popovers handle their own Esc first).
- **Ghost stations** (an area drawn on another tab) jump there (`onJump`).

## Not curated, unplaced, problems

- An area without a hand-written entry (`curated: false`, typically a new area after an ESR release) still shows from
  its game-file data, marked "Not curated yet" in the panel, list, cards and peek.
- An area of a section missing from its grid is drawn by the canvas in an "Unplaced" strip and listed as "Not on the
  map yet" in the list.
- `map.problems` (stale curated ids, renamed areas) are never shown to visitors: logged once with `console.warn`; the
  integrity test fails on them.

## Links in

- Header and home: Areas group, "Campaign Map" next to Area Levels (`navConfig.ts`).
- Area Levels page: "Show on map" under every row's name (`campaignMapAreaPath`).
- Home search: an Areas result opens `/campaign-map?area=<id>` (the panel links back to the Area Levels page row); a name
  without an id still falls back to the Area Levels page search. Names shared across acts carry the act (`areaSearchNames`:
  "Sewers Level 1 (Act II)", "Tristram (Act V)"), so each opens its own area; twins stay one result.
- Guide: `page:/campaign-map?area=<id>` links (`/campaign-map` is in the `APP_PAGES` allowlist).
- `public/sitemap.xml` (`scripts/lib/sitemap.ts`).
- The route skips the startup loading gate (`staticBundleRoutes.ts`): it reads only static bundles.

## Files

```
src/features/campaign-map/
  index.ts                      lazy-route export (CampaignMapScreen)
  screens/CampaignMapScreen.tsx loads areas.json, builds the map, URL state, tabs, toolbar, layout, Esc, highlight
  components/
    CampaignMapCanvas.tsx       the SVG map of one section (engine side, see below)
    AreaDetailPanel.tsx         the side panel; AreaLink (select-on-click links), FactSourceLabel
    MapBossSection.tsx          the Boss section of an endgame map zone
    SectionNotes.tsx            side column without a selection
    AreaList.tsx                list view / small screens
    AreaCards.tsx               Special areas, Ubers & portals
    MapLegend.tsx, AreaPeek.tsx, CampaignSearch.tsx
    mapStyles.ts                local light/dark colours (kind fills, edge strokes and dashes, trust chips); no global tokens
  hooks/                        useAreaPeek, useItemNamesByCode (icons.json quest names), usePanelScroll
  utils/                        urlState, nearestWaypoint (+ connections, entry routes), search, areaFacts (heads up,
                                bosses, eyebrow, station kind), sourceLabels (labels, quest gates), listGroups,
                                mapBossFacts (the Boss section); tests
                                with testMap.mock.ts
  engine/, data/                see "Engine and data"
src/components/PeekPopover.tsx, useHoverPopover.ts   shared with the guide
```

Bundles: `areas.json` (render; its `mapBosses` feed the Boss section) and `icons.json` (quest item icons and names, the shared `useItemIcons` store, loaded in
the background; the panel and search work without it).

## Engine and data

> **To be completed by the engine side (role B).** The contract is `engine/types.ts`; the page only calls
> `buildCampaignMap(areas)` and renders `CampaignMapCanvas`.

What the page relies on:

- `buildCampaignMap(areas: readonly Area[]): CampaignMap` (`engine/buildCampaignMap.ts`), pure and deterministic, layouts
  included. An area's `section` is its home (where it is drawn): act areas `act1`…`act5`, tiered and unique maps `maps`,
  the uber levels `portals`. `special` lists every ESR special area by reference wherever it is drawn; `portals` lists
  the Cow Level, uber levels, Hidden Vault… Both have `layout: null`.
- `CampaignMapCanvas` props: `map`, `section` (with a layout), `selectedId`, `highlightId`, `areaHref`, `onSelect`,
  `onJump`. Every station dot carries `data-area-id`; stations are focusable links. The canvas draws the Unplaced strip.
- Edges: `border` (curated outdoor borders), `passage` (levels.txt Vis, kept when both rows list each other), `portal`
  (red and quest portals), `cube` (cube recipe portals), `act` (act travel); `oneWay`, `via`, `source`, `verify`.
- Areas data (`areas.json`, see GAME-DATA.md "Areas page"): `terrain`, `teleport`, `questGate`, `mapItem`,
  `endgameZone`; the removed orphan rows (30, 36) and the prep rows are not in the bundle; `connections` are mutual only.

TODO (engine): act grid format, curated links and facts (`data/`), Vis folding and twins, edge routing, the Endgame
Maps board, ghosts and regions, the integrity test and what to do when it fails after an ESR release.

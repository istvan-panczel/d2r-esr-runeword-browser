# Navigation & App Shell

Documentation for routing, layout, and navigation patterns.

## Routes

All routes are children of `AppLayout` in `src/core/router/index.tsx`; every screen and layout is lazy (see
[Router Setup](#router-setup)). `/guide` and `/loot-filters` are nested layouts with child routes, and the Game Data pages
share a pathless layout route (see [Nested sections](#nested-sections)).

| Path                                    | Screen                  | Description                                                                                                                                                                                       | Query params                                                                                           |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                                     | HomeScreen              | [Home page](#home-page): search, section cards, latest builds, guide pointer, official links, community tools                                                                                     | any query: redirects to `/runewords` with the same query                                               |
| `/runewords`                            | RunewordsScreen         | Browse and filter runewords (was `/` before the home page)                                                                                                                                        | `search`, `sockets`, `maxlvl`, `items`, `runes`, `runemode`, `tierpts`, `name`                         |
| `/guide`                                | GuideLayout             | Guide frame: a small "Experimental" notice above every guide page, then the child route                                                                                                           |                                                                                                        |
| `/guide` (index)                        | GuideOverviewScreen     | New-player guide: the only overview, every note grouped by spine step plus "Other topics", note search                                                                                            |                                                                                                        |
| `/guide/map`                            | (redirect)              | Redirects to `/guide` (the old note map; its screen is kept in the code, unrouted)                                                                                                                |                                                                                                        |
| `/guide/:slug`                          | GuideNoteScreen         | One guide note; unknown slug shows a "Note not found" block linking back to `/guide`                                                                                                              |                                                                                                        |
| `/gemwords`                             | GemwordsScreen          | Gem-based socket recipes with filters                                                                                                                                                             | `search`, `sockets`, `maxlvl`, `items`, `gems`, `name`                                                 |
| `/socketables`                          | SocketablesScreen       | All socketables with category filters & search                                                                                                                                                    | `search`, `categories`, `onlyHighest`, `name`                                                          |
| `/uniques`                              | HtmUniqueItemsScreen    | Unique items with category & coupon filters                                                                                                                                                       | `search`, `maxlvl`, `cats`, `acq` (legacy `coupon=0`), `name`                                          |
| `/mythicals`                            | MythicalUniquesScreen   | Mythical unique items                                                                                                                                                                             | `search`, `maxlvl`, `cats`, `name`                                                                     |
| `/ascendancies`                         | AscendanciesScreen      | Ascendancies with their tier bonuses                                                                                                                                                              | `search`                                                                                               |
| `/skills`                               | SkillsScreen            | Class skill trees and item-granted skills with details and "Granted by" ([SKILLS.md](../features/SKILLS.md))                                                                                      | `class` (code or `items`), `tab`, `skill`, `search` (kept in the URL)                                  |
| (pathless layout)                       | GameDataLayout          | Shared shell of the game-file data pages (the nine rows below); adds nothing to the URL                                                                                                           |                                                                                                        |
| `/bases`                                | BasesScreen             | Base items browser (txt game files)                                                                                                                                                               | `search`, `sockets` (min.), `maxlvl`, `kind`, `tier`, `type`, `cls`, `sort` (`-<key>` = desc.), `view` |
| `/best-base`                            | BestBaseScreen          | Best base finder for a runeword and a persisted character                                                                                                                                         | `rw`, `v`, `cls`, `lvl`, `str`, `dex`                                                                  |
| `/affixes`                              | AffixesScreen           | Affix browser + "what can roll" on a base                                                                                                                                                         | `search`, `aff`, `rare`, `minlvl`, `maxlvl`, `cls`, `type`, `base`, `ilvl`, `q`, `auto`, `sort`        |
| `/item-types`                           | ItemTypesScreen         | Item type tree + socket caps                                                                                                                                                                      | `type` (focused node)                                                                                  |
| `/enhance`                              | EnhanceScreen           | Corruption, anointment, sanctification and Vessel of Souls outcomes (cube recipes)                                                                                                                | `tab`, `slot`, `tier`, `search` (kept in the URL)                                                      |
| `/cube-recipes`                         | CubeScreen              | Every cube recipe from cubemain.txt, grouped by family and official section                                                                                                                       | `search`, `family` (focused family; kept in the URL)                                                   |
| `/materials`                            | MaterialsScreen         | Every misc item: how to get it, the cube families and Enhance recipes using it, guide notes                                                                                                       | `search`, `group`, `name` (kept in the URL)                                                            |
| `/area-levels`                          | AreasScreen             | Every area: monster level, density and unique packs per difficulty, waypoint, connections; maps by tier                                                                                           | `search`, `minlvl`, `maxlvl` (kept in the URL)                                                         |
| `/sets`                                 | SetsScreen              | Every set: items, per-item and set-wide partial bonuses, full-set bonuses, item sources                                                                                                           | `search`, `maxlvl`, `pieces`, `cls`, `name` (kept in the URL)                                          |
| `/campaign-map`                         | CampaignMapScreen       | Act maps, special areas, ubers & portals, endgame maps ([CAMPAIGN-MAP](../features/CAMPAIGN-MAP.md))                                                                                              | `tab`, `area` (alone: its home tab), `view=list`, `act` (alias) (kept in the URL)                      |
| `/loot-filters`                         | LootFilterLayout        | Loot filter frame: an "Under development" notice above every loot-filter page, then the child route                                                                                               |                                                                                                        |
| `/loot-filters` (index)                 | LootFilterLibraryScreen | Loot filter library: new, upload, Sully's QoL filter template, download (.json or .zip)                                                                                                           |                                                                                                        |
| `/loot-filters/:id`                     | LootFilterEditorScreen  | Loot filter editor; unknown id shows "Filter not found"                                                                                                                                           | `tab=rules\|styles\|settings\|json\|test`                                                              |
| `/specializations`                      | SpecializationsScreen   | The 4 ESR 3.3 perk trees, how to unlock and respec, `?tree=&perk=` deep links ([SPECIALIZATIONS](../features/SPECIALIZATIONS.md))                                                                 | `tree`, `perk`                                                                                         |
| `/weapon-masteries`                     | WeaponMasteriesScreen   | What each weapon mastery does, by class weapon, with recipe and removal, `?cls=&mastery=` deep links ([WEAPON-MASTERIES](../features/WEAPON-MASTERIES.md))                                        | `cls`, `mastery`                                                                                       |
| `/mercenaries`                          | MercenariesScreen       | Every hireling: act, gold, skill levels and stats at each level band, cards or a comparison table ([MERCENARIES](../features/MERCENARIES.md))                                                     | `hireling`, `type`, `difficulty`, `view`                                                               |
| `/kill-ledger`                          | KillLedgerScreen        | Every Kill Ledger bonus and how each unlocks: kill and boss tables, reference only ([KILL-LEDGER](../features/KILL-LEDGER.md))                                                                    |
| `/terror-zones`                         | TerrorZonesScreen       | Offline terror zone schedule: now / next, upcoming slots, zone groups with stars, boosts ([TERROR-ZONES](../features/TERROR-ZONES.md))                                                            |                                                                                                        |
| `/modifiers`                            | ModifiersScreen         | What item modifiers do in ESR, one card per kind ([MODIFIERS](../features/MODIFIERS.md))                                                                                                          | focused modifier, category, search and Key / All (kept in the URL)                                     |
| `/elixirs`                              | ElixirsScreen           | The 35 utility elixirs: effects at a character level with Utility Potion Effectiveness / Duration and Alchemist perks, drop chances, perk-gated odds, recipes ([ELIXIRS](../features/ELIXIRS.md)) | `name`, `search`, `avail`, `variant`, `lvl`, `eff`, `dur`, `perks`                                     |
| `/patch-notes`, `/patch-notes/:version` | PatchNotesScreen        | The ESR patch notes per release, our item change reports and patch-note checks ([PATCH-NOTES](../features/PATCH-NOTES.md))                                                                        | `view` (`items`, `check`)                                                                              |
| `/stash`                                | StashLayout             | My Stash frame: title and shared upload state; the header's page row links the pages ([STASH](../features/STASH.md))                                                                              |                                                                                                        |
| `/stash` (index)                        | StashHomeScreen         | Upload (or the loaded file) and the stash pages with a one-line summary each                                                                                                                      |                                                                                                        |
| `/stash/coupons`                        | StashCouponsScreen      | Ancient Coupons in the uploaded stash: unique, have / need, Wild Card recipe, where                                                                                                               | `search`, `status`, `tier`, `page`, `sort`, `dir` (kept in the URL)                                    |
| `/stash/items`                          | StashItemsScreen        | All Items: every item on the stash pages ([STASH-ITEMS](../features/STASH-ITEMS.md))                                                                                                              |                                                                                                        |
| `/stash/character`                      | (redirect)              | Redirects to `/character` (My Character was a My Stash page until 2026-11)                                                                                                                        |                                                                                                        |
| `/character`                            | CharacterScreen         | My Character: stored character saves with a switcher, in tabs ([CHARACTER-SAVE](../features/CHARACTER-SAVE.md#my-character-page))                                                                 | `tab` (`gear`, `skills`, `combat`, `storage`, `progress`; none = Overview)                             |
| `/builds`                               | BuildsScreen            | Shared builds list (Supabase only)                                                                                                                                                                |                                                                                                        |
| `/builds/new`                           | CreateBuildScreen       | Create a build (sign-in required)                                                                                                                                                                 |                                                                                                        |
| `/builds/:buildId/edit`                 | EditBuildScreen         | Edit an own build                                                                                                                                                                                 |                                                                                                        |
| `/build/:buildId`                       | BuildDetailScreen       | Build detail page                                                                                                                                                                                 |                                                                                                        |
| `/user/:userId`                         | UserProfileScreen       | A user's public builds                                                                                                                                                                            |                                                                                                        |
| `*`                                     | NotFoundScreen          | Catch-all for unknown URLs, with a link back home                                                                                                                                                 |                                                                                                        |

`map` is a static segment, so the router ranks the `/guide/map` redirect above `/guide/:slug` (a note with the slug
`map` would be shadowed). `/guide/:slug` slugs are the file names in `content/guide/notes/`.

**Query params.** The shared keys are `FILTER_URL_PARAM_KEYS` in `src/core/utils/filterUrlParams.ts` (`search`, `sockets`,
`maxlvl`, `items`, `runes`, `tierpts`, `gems`, `name`); `sockets` takes an exact count or a range (`4`, `2-4`, `-4`, `4-`). The
feature-specific keys live next to each feature's `useUrlInitialize` hook, and `GAME_DATA_URL_PARAM_KEYS` in
`src/features/game-data/constants/urlParams.ts`. The filter screens (runewords, gemwords, socketables, uniques, mythicals,
ascendancies, bases, best base, affixes) read their params on mount, put them into Redux and remove them from the URL. Runewords,
gemwords, socketables, uniques, mythicals and bases (`useUrlArrival` in `src/core/hooks/`) read them again whenever the URL later
carries params they recognise, so a link to the page you are on (the [global search](#global-search)) behaves like arriving from
another page; the bare URL left by that cleanup is ignored, and a `?name=` arrival on runewords and gemwords keeps the current filter
selection (the defaults or stored filters run only on mount, so clearing the focus brings the page's filters back);
Copy Link rebuilds a URL from the current state (non-default values only). Item Types (`type`), Enhance (`tab`, `slot`,
`tier`, `search`), Cube Recipes (`search`, `family`), Materials (`search`, `group`, `name`), Area Levels (`search`, `minlvl`, `maxlvl`), the Campaign Map (`tab`, `area`, `view`) and the loot filter editor (`tab`) read their params on every render and keep them in the URL. The builds screens keep their search, class and sort in
Redux only.

**`?name=<Name>` focus** (runewords, gemwords, socketables, uniques, mythicals): shows only the items whose name equals `<Name>`
(`normaliseItemName` in `src/core/utils/itemName.ts`: case, whitespace, quotes/apostrophes and dashes unified; all variants of a
runeword), unlike `?search=`, which also matches affix text. While it is set, every other filter of the screen (search, sockets,
level, types, runes/gems, categories, coupon, highest quality) is ignored but kept, so the item is always visible and clearing
the focus brings the previous filters back; the favourites-only toggle still applies. It is read on mount and on a same-page
arrival like the other params (the URL is then cleaned) and cleared by any visit or arrival whose URL carries no `name`, so it never
outlives the deep link; the URL cleaned of its params does not clear it. The search box
does not change it. A dismissible "Showing: <Name> ×" chip shows it and scrolls into view only right after the deep link.
Copy Link keeps it. Guide `rw:`/`gw:`/`unique:`/`mythical:`/`socketable:` links use it.

**Old runewords links.** The runewords browser lived at `/` until the home page took that path. `/` with any query
string (`/?name=Enigma`, `/?search=x&sockets=4`: old Copy Link URLs and guide deep links) redirects (`replace`) to
`/runewords` with the same query and hash; only a bare `/` renders the home page. The decision is
`runewordsRedirectTarget` in `src/core/router/homeRedirect.ts` (tested), applied by `HomeRoute` around the index route.

**Old Game Data links.** The Game Data pages lived under `/game-data/` until they became top-level URLs. One route,
`game-data/*`, sends the old URLs to the new ones (`replace`) with the same query and hash, so shared Copy Link URLs keep
their filters: `bases`, `sets`, `best-base`, `affixes`, `enhance` and `materials` keep their names, `types` is now
`/item-types`, `cube` `/cube-recipes`, `areas` `/area-levels`, and a bare `/game-data` goes to `/bases`. Any other
`/game-data/...` path shows the not-found page. The mapping is `gameDataRedirectTarget` in
`src/core/router/gameDataRedirect.ts` (tested), applied by `GameDataRedirectRoute`. `public/game-data/` is the data folder
of the bundles, unrelated to these URLs.

### Home page

`src/features/home/` (`HomeScreen`, lazy). Sections, top to bottom, in a `max-w-5xl` column:

1. **Pitch header** (`HomeHero`): title, one-line pitch, and the data versions: "Game files: ESR …" from the game-data
   manifest (`useManifest`) and "Docs data: ESR … (site updated …)" from Dexie metadata (`esrVersion`,
   `docsLastModified`, via `useDocsDataLine`), each left out until it is known.
2. **Search** (`HomeSearch`): one cmdk input with an inline results list grouped Runewords / Gemwords / Uniques /
   Mythicals / Sets / Set items / Bases / Skills / Materials / Areas / Cube recipes, max 6 each (`searchHome` /
   `rankNames` in `utils/homeSearch.ts`: case-insensitive substring over `normaliseItemName`, ranked exact, prefix, word
   prefix, substring, then alphabetical; duplicates collapse). Nothing loads before the first keystroke; then the Dexie
   name indexes (only once the startup sync has initialized; before that the list says "Runeword and unique data is
   still loading…") and, via `loadGameDataFile` (`useBundleNames`, each file settles on its own), `bases.json`,
   `sets.json`, `skilldetails.json` (skill names, class and item skills; same-named variants get the Skills page's
   suffix, "Amplify Damage (Aura)"), `materials.json` (item names, plus its `families` labels for Cube recipes, so
   `cube.json` is not fetched) and `areas.json`. A result opens its page focused on it (`homeResultHref`):
   `?name=<exact name>` on the item list pages, Sets and Materials; Skills `/skills?skill=<id>` (the page picks the class
   and tab); Cube `/cube-recipes?family=<id>`; Areas open the Campaign Map on the area (`/campaign-map?area=<levels.txt Id>`, its
   panel links the Area Levels page row); Bases have no exact-name focus, so `?search="<name>"`. The
   first row, selected by default, is "Search runewords for “…”", so Enter without picking a result goes to
   `/runewords?search=<query>`. The data and the rows (`useHomeSearch`, `HomeSearchRows`) are shared with the
   [global search dialog](#global-search).
3. **Section cards** (`HomeSections`): one card per `NAV_ENTRIES` entry (`getHomeSections` in `utils/homeSections.ts`):
   a group's `description` and its pages as chips; a plain link's `description` and its `homeLinks` chips (none use them
   now) or the page itself (Guide links `/guide` only). Builds only when Supabase is configured. A test checks every nav page appears once.
4. **Latest builds** (`LatestBuilds`, Supabase only): the 3 newest builds as `BuildCard`s plus "Browse all". The
   component awaits `startBuilds()` before dispatching `fetchRecentBuildsRequested`, a separate query in the builds saga
   that writes `recentBuilds` / `recentStatus` only, so the `/builds` list, its filters and paging are untouched. One
   skeleton row while loading; hidden on error or when there are no builds.
5. **New to ESR?** (`HomeStartHere`): a button to `/guide` and the guide's `GuideOfficialReference` strip. Hidden since
   2026-11-04 (commented out in `HomeScreen.tsx`, the component is kept) until the section is reworked.
6. **Official ESR links** (`HomeOfficialLinks`): compact cards (label linking out, description) for `OFFICIAL_LINKS` in
   `navConfig.ts`, the same list as the header's ESR links menu: Official site, Installation Guide, Documentation, Drop Finder,
   Frame Table, Patch notes, Changelog (stops at 3.2.02), Releases, ESR Discord, ESR on GitHub.
7. **Community tools** (`HomeCommunityTools`): a card per fan-made ESR tool from `COMMUNITY_TOOLS` in `navConfig.ts`
   (label linking out, author, a kind badge, a one-sentence description, a dot-separated line of short feature labels, caveat,
   "Source on GitHub" when the project has one), with a note that they are not affiliated with this site or the mod. The descriptions were
   last checked against the live tools on 2026-11-04. Sully's ESR Wiki Overlay ships with ESR since 3.3 (hotkey, cube button or
   main menu), so its label links the ESR 3.3 patch notes (`ESR_WIKI_OVERLAY_NOTE_URL`) and its GitHub repository is only the
   source link. Static data, no fetches. Both sections share the `HomeLinkCard` component.
8. **Footer** (`HomeFooter`): app version (`src/assets/version.json`), ESR / GitHub / privacy policy links (URLs from
   `navConfig.ts`), credits.

The page skips the startup loading gate (exact match on `/`, see below), so it renders before the HTM sync finishes.

## App Shell Layout

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ D2R ESR Recipes▾ Items▾ Character▾ Areas▾ My Data▾ Guide Builds Loot Filters ⌕ … │
│ Uniques  Mythicals  Sets  [Bases]  Item Types  Affixes  Modifiers  Elixirs       │  <- page row of the current menu group
├──────────────────────────────────────────────────────────────────────────────────┤     (none on Home, Guide, Builds, Loot Filters)
│                                                                                  │
│                              Main Content Area                                   │
│                             (Feature Screens)                                    │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

The header row, the page row and `<main>` share one frame width, `APP_FRAME_CLASS` in `src/components/pageWidthClasses.ts`,
picked by the Page width setting: Standard keeps Tailwind's `container` (the look from before the setting: the
header spans the 1536 px container, the 1280 px pages sit centred inside it), Wide is the 1920 px page plus the
gutters and Full is the whole window, so in Wide and Full the header edges line up with the page. `PageShell` sets the
page width inside the frame (see [UI-COMPONENTS.md](./UI-COMPONENTS.md#pageshell)).

### Startup loading gate

`AppLayout` shows a full-screen "Loading data..." spinner until the HTM data sync has initialized (and a full-screen
error with "Try Again" when it failed). Routes that render from static bundles only skip the spinner and render the
normal shell (Header + Outlet + SettingsDrawer) right away; the sync keeps running in the background. They also skip
the fatal-error screen, so a failed first sync does not hide them. They are listed in
`src/core/layouts/staticBundleRoutes.ts` (`isStaticBundlePath`, tested): `/` is matched exactly (as a prefix it would
match every path), the others are prefixes (a path matches its prefix exactly or with a `/` after it):

- `/` (exact): the home page; its item-name search and docs version fill in once the sync has run;
- `/guide`: the guide is a static JSON bundle (`public/guide/`), see [GUIDE.md](../features/GUIDE.md);
- `/loot-filters`: the editor uses the game-data bundles, `public/loot-filters/` and localStorage, see
  [LOOT-FILTER.md](../features/LOOT-FILTER.md);
- `/game-data`: only the redirect of the old URLs, which needs no data (the page it lands on applies its own gate);
- `/enhance`, `/cube-recipes`, `/materials`, `/sets` and `/area-levels`: only
  `enhance.json` / `cube.json` / `materials.json` / `sets.json` / `areas.json` (+ the guide bundle, or sources.json for Sets) (the other Game Data pages stay behind the gate: Best Base matches the HTM
  runewords), see [GAME-DATA.md](../features/GAME-DATA.md).
- `/campaign-map`: `areas.json`, `icons.json` and `stashnames.json` (quest item names), see
  [CAMPAIGN-MAP.md](../features/CAMPAIGN-MAP.md).
- `/stash`: the My Stash pages read `stash.json` and the uploaded file (IndexedDB `d2r-esr-stash`), see
  [STASH.md](../features/STASH.md).
- `/character`: My Character reads `stash.json` (and per tab stashnames, types, itemtext, charsheet (the computed sheet), combat
  (the Combat tab), skills, skilldetails, lootfilter, specializations); an item source on the Overview opens the Gear tab on
  that item (page state, not in the URL) and the stored saves (IndexedDB `d2r-esr-character`); its Ascendancy card fills in once the sync has run, see
  [CHARACTER-SAVE.md](../features/CHARACTER-SAVE.md#my-character-page).
- `/specializations`: `specializations.json`, see [SPECIALIZATIONS.md](../features/SPECIALIZATIONS.md).
- `/weapon-masteries`: `masteries.json`, see [WEAPON-MASTERIES.md](../features/WEAPON-MASTERIES.md).
- `/mercenaries`: `mercenaries.json`, see [MERCENARIES.md](../features/MERCENARIES.md).
- `/terror-zones`: `terrorzones.json` and localStorage, see [TERROR-ZONES.md](../features/TERROR-ZONES.md).
- `/elixirs`: `elixirs.json` and `icons.json`, see [ELIXIRS.md](../features/ELIXIRS.md).

### Floating elements

`AppLayout` also mounts the **terror zone widget** once, below `<main>` (lazy, `Suspense` with no fallback; see
[TERROR-ZONES.md](../features/TERROR-ZONES.md#widget)). It is on every page that renders the shell (not on the startup
spinner or the fatal-error screen), fixed bottom-left at `z-40` (hidden on `/terror-zones`, which shows the same schedule).
**`ScrollToTopButton`** is mounted once next to it, on the same pages, fixed bottom-right at `z-40` once the window has
scrolled 400 px; the toasts are bottom-right too. Fixed bottom elements both move up for (`src/components/floatingElements.ts`):
the builds form's sticky Save / Cancel bar and the guide note's phone "Next on your path" bar. A new fixed bottom element
should be added there.

### Header Components

`src/core/components/Header.tsx` renders from one typed config, `NAV_ENTRIES` in `src/core/navigation/navConfig.ts`
(groups of `NavItem`s with a label, a one-line description and a path, plus plain links). The home page's section
cards render from the same config (group `description`, link `homeLinks`):

| Entry        | Kind  | Pages                                                                                                                                                                                                            |
| ------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recipes ▾    | group | Runewords (`/runewords`), Gemwords (`/gemwords`), Socketables (`/socketables`), Best Base (`/best-base`), Cube Recipes (`/cube-recipes`), Enhance (`/enhance`), Materials (`/materials`)                         |
| Items ▾      | group | Uniques (`/uniques`), Mythicals (`/mythicals`), Sets (`/sets`), Bases (`/bases`), Item Types (`/item-types`), Affixes (`/affixes`), Modifiers (`/modifiers`), Elixirs (`/elixirs`), Patch Notes (`/patch-notes`) |
| Character ▾  | group | Skills (`/skills`), Ascendancies (`/ascendancies`), Specializations (`/specializations`), Weapon Masteries (`/weapon-masteries`), Mercenaries (`/mercenaries`), Kill Ledger (`/kill-ledger`)                     |
| Areas ▾      | group | Campaign Map (`/campaign-map`), Area Levels (`/area-levels`), Terror Zones (`/terror-zones`)                                                                                                                     |
| My Data ▾    | group | My Character (`/character`, its tabs are `?tab=`), Stash Overview (`/stash`, `exact`: not active on its sub-pages), Ancient Coupons (`/stash/coupons`), All Items (`/stash/items`)                               |
| Guide        | link  | `/guide`                                                                                                                                                                                                         |
| Builds       | link  | `/builds`, only when Supabase is configured (`requiresSupabase`, filtered by `getNavEntries`)                                                                                                                    |
| Loot Filters | link  | `/loot-filters` (prefix-matched, so it stays active on the editor pages)                                                                                                                                         |

- **Brand**: "D2R ESR", a link to `/` (the home page).
- **Desktop and hamburger switch**: the header frame is the `header` size container, and the `@desktop-nav/header:` classes
  (`--container-desktop-nav: 79.5rem` in `src/index.css`) swap the hamburger for the desktop nav, the book and page-width
  icons when the row has the room. A container query in `rem` follows the Text size setting and the Page width setting's
  actual frame, which a viewport breakpoint cannot: a media query's `rem` ignores the `<html>` font size, and Standard's
  `container` frame steps from 1024 px to 1280 px at a 1280 px window. 79.5rem holds the brand, the eight entries, the icon cluster with the search icon, and the widest account control, a 14-character signed-in tag (needs 78.5rem at 16 px; the Diablo font's wider
  tag is capped at 12 characters in `UserMenu`). At the default 16 px text size Standard shows the desktop nav from a 1280 px window (1272 px in Wide and Full); at 20 px from 1590 px.
  Below that the hamburger shows. A ninth top-level entry would need about 86rem (measured 2026-11-11), which is why My Character sits in the My Data group. Item, group and link labels do not wrap (`whitespace-nowrap`).
- **Desktop nav**: a shadcn `NavigationMenu` (`src/components/ui/navigation-menu.tsx`, `viewport={false}` so
  each dropdown opens under its own trigger). Each group trigger opens a panel of label + description links: one column
  (`w-72`) for up to 4 pages, two equal columns (`w-[36rem]`, filled downwards, the same order the keyboard moves in) for more. The two-column
  groups are the first three triggers, so their panels stay on screen at the narrowest desktop width (the rightmost panel edge
  is 879 px at a 1280 px window, Character). Active state:
  an item is active when the path equals its `to` or starts with `to/` (only the former for an `exact` item; no item is active on the home page); a group trigger is highlighted when any of its items is active (`isNavGroupActive`). The active page in a panel has the
  accent background and a semibold label; Radix sets `data-active` (empty value), so the classes are `data-active:`, not `data-[active=true]:`. Active links
  get `aria-current="page"`. Keyboard (Radix): triggers are in the tab order, Enter/Space/ArrowDown opens, arrows and
  Tab move through the items, Escape closes; choosing a link closes the menu.
- **Right side**: the [global search](#global-search) magnifier (every width), ESR links dropdown (book icon, desktop nav only: the `OFFICIAL_LINKS` Official site, Installation Guide, Documentation, Drop Finder,
  Frame Table, Patch notes, Changelog, Releases, ESR Discord, ESR on GitHub, then a "Community tools" label with ESR Wiki Overlay, ESR Docs,
  ESR Tools, Unofficial ESR Wiki from `COMMUNITY_TOOLS`), the page width menu (↔ `MoveHorizontal` icon, desktop nav only,
  `PageWidthMenu.tsx`: a radio list Standard 1280 px / Wide 1920 px / Full screen, the same setting as the Settings
  drawer), theme toggle, GitHub link,
  `AuthControls` (Sign In / user menu, Supabase only), settings cog. Below a 28rem row (`@md/header`, 448 px at the default text size) the GitHub
  link and the account control move to the hamburger sheet, so a phone row holds the hamburger, brand, search, theme and settings (at 24rem,
  Sign In pushed the cog off a 390 px row).
- **Page row** (`GroupPagesBar.tsx`, inside `<header>` under the main row, same frame): the pages of the current menu group
  (`getActiveNavGroup`) as a `<nav aria-label="{group} pages">`, active page `aria-current="page"` and a `PAGE_ROW_LINK_*` underline
  (`navTabClasses.ts`). None on Home, Guide, Builds, Loot Filters or a build page; not sticky, like the header. It is one sideways-scrolling
  strip at every width; on a route change the strip centres the active link by setting its own `scrollLeft` (`centeredScrollLeft`), because `scrollIntoView`
  would move the window too.
- **Hamburger (below the switch)**: opens a left `Sheet` with a shadcn `Accordion` (`type="multiple"`) of the same groups;
  the group of the current route starts open, Guide, Builds and Loot Filters are top-level links, then the official ESR links (`OFFICIAL_LINKS`), a small "Community tools" label with the
  community links, "Source on GitHub", and the auth control. Choosing a page closes the sheet.

`navConfig.test.ts` checks that every config path resolves to a real route of the router (not the `*` catch-all), that
labels, keys and paths are unique, that Builds is hidden without Supabase, the agreed menu order, the active-state rules and
`getActiveNavGroup` / `getActiveNavItem`.

### Global search

A magnifier in the header's right cluster (visible at every width) and Ctrl+K (Cmd+K on a Mac) open a centred modal with
the input and the results. It searches what the [home page search](#home-page) searches, plus the site's pages.

- **Shell and lazy chunk**: `GlobalSearch.tsx` (in the entry bundle) is the button and the one `window` keydown listener;
  `GlobalSearchDialog.tsx` is a chunk of its own (with cmdk and the search code) imported on the first open and kept mounted after it.
  A shortcut pressed while the chunk loads still counts: it toggles the open state the dialog renders from when it arrives.
  A failed import closes the request and shows a toast (search could not load, reload the page); the next open tries again. The import
  is by hand, not `React.lazy`, which caches a rejected load and would fail every later open; nothing reaches the root error screen.
- **Results**: Pages first (`searchPages` in `utils/pageSearch.ts`: `rankNames` over the labels of `getNavEntries`, so Builds
  stays hidden without Supabase, then the pages of the menu groups whose label matches, up to the same limit of 6; the row shows its menu group), then the home search's groups, then "Search runewords for “…”" last.
  Data and rows are the home page's: `useHomeSearch` (nothing loads before the first keystroke, each game-data file settles on its
  own, the "still loading" note before the startup sync has initialized) and `HomeSearchResults` / `SearchRunewordsRow` / `HomeSearchRow`
  (`src/features/home/`). Results are computed synchronously from the current query and the names loaded so far, so a slow earlier query cannot
  overwrite a newer one. `shouldFilter={false}` keeps cmdk from filtering or reordering. The list has a fixed height: the dialog is centred,
  so a growing list would move the input while typing.
- **Enter**: runs the selected row, by default the first (a page when one matches, else the best item, else the runewords search). cmdk keeps its
  selection when rows appear above it and the names arrive after the first render, so the row that is currently first carries the
  value `FIRST_ROW_VALUE` (`utils/searchRows.ts`) and the selection follows it. Controlling cmdk's `value` would make it scroll to the previously selected row.
- **Closing**: choosing a result navigates and closes; Escape and clicking outside close. Radix returns focus only to a `DialogTrigger`, so the
  shell remembers the element that was focused when it opened and `onCloseAutoFocus` restores it. Reopening starts empty: the panel
  lives inside `DialogContent`, which unmounts on close.
- **Shortcut** (`isSearchShortcut` in `utils/searchShortcut.ts`, pure): Cmd+K on a Mac, Ctrl+K elsewhere, no other modifier. Ctrl+K on a Mac
  stays the system's delete-to-end-of-line, in text fields and in the CodeMirror JSON tab (`emacsStyleKeymap`, the editor has no `Mod-k`, so nothing conflicts).
  The dialog sets `vimBindings={false}`, or cmdk's own Ctrl+K "move up" would fire together with the close. While another modal is open
  (`[data-slot="dialog-content"]` or `[data-slot="sheet-content"]` with `data-state="open"`: settings drawer, mobile sheet, any dialog; or the sign-in consent gate, `[data-modal-gate]`) the shortcut is
  ignored, like the button behind its backdrop; `preventDefault` still runs, so the browser's own Ctrl+K never fires.

### Nested sections

`/guide` and `/loot-filters` are nested routes, and the Game Data pages are children of a pathless route; each has a lazy layout that renders a frame above an `<Outlet />`:

- `GuideLayout`: a width-only `PageShell` with the "Experimental" `DevNotice`, then the spine (index, its own narrow
  `PageShell` with the title), the map (`map`) or a note (`:slug`);
- `LootFilterLayout`: a width-only `PageShell` with the "Under development" `DevNotice`, then the library (index) or the
  editor (`:id`);
- `GameDataLayout`: a `PageShell` titled with the menu label of the current page (`getActiveNavItem`), then the version
  note. Its route has no path, so the pages keep top-level URLs.

`GameDataLayout` renders:

```
Bases                                            <- menu label of the current page
[amber note when the HTM docs ESR version differs from the game files; nothing otherwise]
<Outlet />                                        <- child route screen
```

Each child route is its own lazy screen wrapped in `<Suspense>` (each section's screens come from one feature module
(`@/features/guide`, `@/features/game-data`, `@/features/loot-filter`), so they share its chunk).
The note compares `public/game-data/manifest.json` with Dexie `metadata.esrVersion`. Both versions normally come from `metadata.modVersion` of ESR's `d2rloader/metadata.json`;
the docs version may fall back to the changelog page's header, so the note never says which version is newer.

The Game Data child pages are ordinary menu items spread over the Recipes, Items and Areas groups (see the table above); the
header's page row links them, not the layout. A section may have its own page tab row only if the pages it links do not
cut across menu groups (the header's page row covers a group's pages, so a row of them on the page would be a duplicate, and a
row across groups would fight the menu).
Guide and Loot Filters are prefix-matched, so they stay active on every child page.

The header triggers and links use `TAB_BASE` / `TAB_INACTIVE` / `TAB_ACTIVE` (`src/core/components/navTabClasses.ts`), the page row `PAGE_ROW_LINK_*`. The
in-page mode tabs (Enhance sections, campaign map sections, the loot filter editor's tabs, the My Character tabs) use
`SUBTAB_BASE` / `SUBTAB_INACTIVE` / `SUBTAB_ACTIVE` (a filled `bg-primary` active pill) and sit in a `ToolbarCard` (see
[UI-COMPONENTS.md](./UI-COMPONENTS.md#toolbarcard-and-sub-tabs)). The editor's tabs and My Character's are not routes but
buttons in a `role="tablist"` (`role="tab"`, `aria-selected`) that set `?tab=` (the editor replaces the history entry, My Character pushes one). The amber notices of `GuideLayout` and
`LootFilterLayout` are both `DevNotice` (`src/core/components/DevNotice.tsx`).

### Navigation Style

- Active route highlighted in nav (item, its group trigger and the page row's underline)
- Below the desktop switch: Sheet-based slide-out menu with an accordion of the groups

## Settings Drawer

Opens from the right side when the cog icon is clicked.

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                               [⚙]  │
├─────────────────────────────┬───────────────────────────────┤
│                             │  Settings            [X]      │
│                             │─────────────────────────────── │
│    Main Content             │  Theme                        │
│    (dimmed/inactive)        │  ○ Dark (default)             │
│                             │  ○ Light                      │
│                             │─────────────────────────────── │
│                             │  Font                         │
│                             │  ☐ Use Diablo 2 style font    │
│                             │─────────────────────────────── │
│                             │  Text Size                    │
│                             │  ○───●───○───○  (slider)      │
│                             │         Normal                │
│                             │─────────────────────────────── │
│                             │  Page width                   │
│                             │  ○ Standard (default) · 1280 px│
│                             │  ○ Wide · 1920 px             │
│                             │  ○ Full · Full screen         │
│                             │─────────────────────────────── │
│                             │  Data                         │
│                             │  [Force Refresh Data]         │
│                             │                               │
│                             │  App Version: 1.12.1          │
│                             │  Game files: ESR 3.3 (...)    │
│                             │  Docs data: ESR 3.3 · ...     │
│                             │  Last updated: 12/21/2025     │
│                             │─────────────────────────────── │
│                             │  Credits                      │
│                             │  Eastern Sun Resurrected by   │
│                             │  Celestialray                 │
│                             │  Source code on GitHub        │
└─────────────────────────────┴───────────────────────────────┘
```

### Drawer Behavior

- **Trigger**: Click settings cog icon
- **Position**: Slides in from right
- **Overlay**: Main content dimmed but visible
- **Close**: X button or click outside

### Settings Contents

- **Theme Toggle**: Dark (default) / Light, persisted in localStorage
- **Text Size**: 4-step slider (small / normal / large / extralarge), persisted in localStorage
- **Diablo Font**: Toggle for thematic font rendering, persisted in localStorage
- **Page width**: Standard (default, 1280 px pages) / Wide (1920 px) / Full (the whole window minus the side gutters),
  persisted in localStorage (`pageWidth`, an unknown value reads as Standard). Also in the header's ↔ menu (desktop nav
  only). It widens the `PageShell` `wide` pages and the header row; the guide spine's reading column, the guide note and
  the home page keep their widths
- **Refresh Data**: Force re-fetch and parse all data
- **Version display**: App version, game-file ESR version (manifest, generated date) and the docs data line
  ("Docs data: ESR … (site updated …)", left out until known)
- **Last updated**: Timestamp of last successful parse
- **Credits**: small muted block at the bottom: "Eastern Sun Resurrected by Celestialray" (links the ESR site) and
  "Source code on GitHub" (both URLs from `src/core/navigation/navConfig.ts`)

## Implementation

### Router Setup

```typescript
// src/core/router/index.tsx
const RunewordsScreen = lazy(async () => {
  const module = await import('@/features/runewords');
  return { default: module.RunewordsScreen };
});
// ... one lazy() wrapper per screen

function routeElement(Screen: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={routeLoadingFallback}>
      <Screen />
    </Suspense>
  );
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      errorElement: <RouteErrorScreen />,
      children: [
        // Bare `/` is the home page; `/?…` (old runewords links) redirects to `/runewords?…`.
        { index: true, element: <HomeRoute>{routeElement(HomeScreen)}</HomeRoute> },
        { path: 'runewords', element: routeElement(RunewordsScreen) },
        {
          path: 'guide',
          element: routeElement(GuideLayout),
          children: [
            { index: true, element: routeElement(GuideOverviewScreen) },
            { path: 'map', element: <Navigate to="/guide" replace /> },
            { path: ':slug', element: routeElement(GuideNoteScreen) },
          ],
        },
        { path: 'gemwords', element: routeElement(GemwordsScreen) },
        { path: 'socketables', element: routeElement(SocketablesScreen) },
        {
          element: routeElement(GameDataLayout), // pathless: the pages are top-level URLs
          children: [
            { path: 'bases', element: routeElement(GameDataBasesScreen) },
            // ... sets, best-base, affixes, item-types, enhance, cube-recipes, materials, area-levels
          ],
        },
        { path: 'game-data/*', element: <GameDataRedirectRoute /> }, // old URLs, query and hash kept
        // ... uniques, mythicals, ascendancies (before the Game Data pages),
        //     loot-filters (layout: index + ':id'), builds, builds/new,
        //     builds/:buildId/edit, build/:buildId, user/:userId
        { path: '*', element: <NotFoundScreen /> },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);
```

Uses `createBrowserRouter` (not hash-based) with `basename` set from Vite's `BASE_URL` for GitHub Pages compatibility.

**Builds routes** load through `loadAfter(() => import('@/features/builds'), startBuilds)` (`src/core/router/loadAfter.ts`):
the screen module resolves only once the builds saga is running, because the screens dispatch their fetches in mount
effects and an action dispatched before the saga listens is lost.

**Code splitting**: Every route screen is lazy-loaded with `React.lazy()` + `<Suspense>` so each screen lands in its own chunk instead of the entry bundle. The guard test `src/core/router/routeCodeSplitting.test.ts` fails if a screen is ever statically imported into the router again.

### Settings State

```typescript
interface SettingsState {
  readonly theme: Theme; // 'dark' | 'light'
  readonly textSize: TextSize; // 'small' | 'normal' | 'large' | 'extralarge'
  readonly useDiabloFont: boolean;
  readonly pageWidth: PageWidthMode; // 'standard' | 'wide' | 'full'
  readonly isDrawerOpen: boolean;
}
```

All settings (except `isDrawerOpen`) are persisted to localStorage and restored on startup. An inline script in `index.html` applies the stored theme, Diablo font class, and text size to `<html>` before first paint (avoids a flash of the default theme); `ThemeInitializer` then keeps them in sync with the Redux state.
The page width needs no pre-paint step: the slice reads it synchronously into its initial state and the layout
components (`AppLayout`, `Header`, `PageShell`) apply it on their first render.

## Feature Location

```
src/core/
├── router/
│   ├── index.tsx           # Route definitions
│   ├── NotFoundScreen.tsx  # Catch-all 404 screen
│   └── RouteErrorScreen.tsx # Route errorElement
├── layouts/
│   └── AppLayout.tsx       # Main app shell
├── navigation/
│   ├── navConfig.ts        # Header groups/items, external URLs, active-state helpers
│   └── navConfig.test.ts   # Paths exist in the router, unique labels
└── components/
    ├── Header.tsx          # Top navigation bar (NavigationMenu groups, mobile accordion)
    ├── GroupPagesBar.tsx   # Page row: the pages of the current menu group
    ├── centeredScrollLeft.ts # Pure helper of the page row's centring
    ├── PageWidthMenu.tsx   # Header quick control for the Page width setting (desktop nav only)
    ├── navTabClasses.ts    # Header nav (TAB_*), page row (PAGE_ROW_LINK_*) and in-page tab (SUBTAB_*) classes
    └── SettingsDrawer.tsx  # Settings slide-out panel

src/features/global-search/
├── components/
│   ├── GlobalSearch.tsx        # Header button + the Ctrl+K / Cmd+K listener (entry bundle)
│   └── GlobalSearchDialog.tsx  # The dialog and its results (lazy chunk)
└── utils/
    ├── searchShortcut.ts       # Pure key test, platform helpers (entry bundle)
    ├── pageSearch.ts           # Pure page-label search
    └── searchRows.ts           # First-row value, page row values

src/features/home/              # Search shared with the dialog
├── hooks/useHomeSearch.ts      # Activation, sources, groups, pending flags
├── components/HomeSearchRows.tsx # Result rows and loading notes
└── utils/homeSearch.ts         # searchHome, rankNames, homeResultHref

src/features/settings/
├── components/
│   └── ThemeInitializer.tsx  # Apply theme on initial render
├── constants/
│   ├── textSize.ts           # Text size pixel mappings
│   ├── pageWidth.ts          # Page width modes, labels, storage key, validator
│   └── types.ts              # Theme, TextSize, PageWidthMode types
├── hooks/
│   └── useTheme.ts           # useThemeSync / useTextSizeSync / useDiabloFontSync (apply settings to <html>)
└── store/
    └── settingsSlice.ts      # Theme, text size, font, page width, drawer state
```

## Accessibility

- Navigation links have proper `aria-current` for active state; the desktop menu and the mobile sheet are `<nav aria-label="Main">`, the page row `<nav aria-label="{group} pages">`
- Group triggers are keyboard operable (Enter/Space/arrows open, Escape closes) via Radix NavigationMenu
- The search button has an `aria-label`, `aria-keyshortcuts` and a `title` naming the shortcut; the search dialog has a screen-reader title and description and returns focus on close
- Settings drawer uses `aria-hidden` and focus trap when open
- Close button and Escape key close the drawer

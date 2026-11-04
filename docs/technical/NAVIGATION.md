# Navigation & App Shell

Documentation for routing, layout, and navigation patterns.

## Routes

All routes are children of `AppLayout` in `src/core/router/index.tsx`; every screen and layout is lazy (see
[Router Setup](#router-setup)). Three sections are nested layouts with child routes: `/guide`, `/game-data` and
`/loot-filters` (see [Nested sections](#nested-sections)).

| Path                    | Screen                  | Description                                                                                                      | Query params                                                                                           |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                     | HomeScreen              | [Home page](#home-page): search, section cards, latest builds, guide pointer, official links, community tools    | any query: redirects to `/runewords` with the same query                                               |
| `/runewords`            | RunewordsScreen         | Browse and filter runewords (was `/` before the home page)                                                       | `search`, `sockets`, `maxlvl`, `items`, `runes`, `runemode`, `tierpts`, `name`                         |
| `/guide`                | GuideLayout             | Guide frame: a small "Experimental" notice above every guide page, then the child route                          |                                                                                                        |
| `/guide` (index)        | GuideSpineScreen        | New-player guide: "Start here" journey spine, note search, "I found something" row                               |                                                                                                        |
| `/guide/map`            | GuideMapScreen          | All notes: link graph (large screens) and a list grouped by spine step                                           |                                                                                                        |
| `/guide/:slug`          | GuideNoteScreen         | One guide note; unknown slug shows a "Note not found" block linking back to `/guide`                             |                                                                                                        |
| `/gemwords`             | GemwordsScreen          | Gem-based socket recipes with filters                                                                            | `search`, `sockets`, `maxlvl`, `items`, `gems`, `name`                                                 |
| `/socketables`          | SocketablesScreen       | All socketables with category filters & search                                                                   | `search`, `categories`, `onlyHighest`, `name`                                                          |
| `/uniques`              | HtmUniqueItemsScreen    | Unique items with category & coupon filters                                                                      | `search`, `maxlvl`, `cats`, `acq` (legacy `coupon=0`), `name`                                          |
| `/mythicals`            | MythicalUniquesScreen   | Mythical unique items                                                                                            | `search`, `maxlvl`, `cats`, `name`                                                                     |
| `/ascendancies`         | AscendanciesScreen      | Ascendancies with their tier bonuses                                                                             | `search`                                                                                               |
| `/skills`               | SkillsScreen            | Class skill trees and item-granted skills with details and "Granted by" ([SKILLS.md](../features/SKILLS.md))     | `class` (code or `items`), `tab`, `skill`, `search` (kept in the URL)                                  |
| `/game-data`            | GameDataLayout          | Game-file data section; index redirects to `bases`                                                               |                                                                                                        |
| `/game-data/bases`      | BasesScreen             | Base items browser (txt game files)                                                                              | `search`, `sockets` (min.), `maxlvl`, `kind`, `tier`, `type`, `cls`, `sort` (`-<key>` = desc.), `view` |
| `/game-data/best-base`  | BestBaseScreen          | Best base finder for a runeword and a persisted character                                                        | `rw`, `v`, `cls`, `lvl`, `str`, `dex`                                                                  |
| `/game-data/affixes`    | AffixesScreen           | Affix browser + "what can roll" on a base                                                                        | `search`, `aff`, `rare`, `minlvl`, `maxlvl`, `cls`, `type`, `base`, `ilvl`, `q`, `auto`, `sort`        |
| `/game-data/types`      | ItemTypesScreen         | Item type tree + socket caps                                                                                     | `type` (focused node)                                                                                  |
| `/game-data/enhance`    | EnhanceScreen           | Corruption, anointment and Vessel of Souls outcomes (cube recipes)                                               | `tab`, `slot`, `tier`, `search` (kept in the URL)                                                      |
| `/game-data/cube`       | CubeScreen              | Every cube recipe from cubemain.txt, grouped by family and official section                                      | `search`, `family` (focused family; kept in the URL)                                                   |
| `/game-data/materials`  | MaterialsScreen         | Every misc item: how to get it, the cube families and Enhance recipes using it, guide notes                      | `search`, `group`, `name` (kept in the URL)                                                            |
| `/game-data/areas`      | AreasScreen             | Every area: monster level, density and unique packs per difficulty, waypoint, connections; maps by tier          | `search`, `minlvl`, `maxlvl` (kept in the URL)                                                         |
| `/game-data/sets`       | SetsScreen              | Every set: items, per-item and set-wide partial bonuses, full-set bonuses, item sources                          | `search`, `maxlvl`, `pieces`, `cls`, `name` (kept in the URL)                                          |
| `/loot-filters`         | LootFilterLayout        | Loot filter frame: an "Under development" notice above every loot-filter page, then the child route              |                                                                                                        |
| `/loot-filters` (index) | LootFilterLibraryScreen | Loot filter library: new, upload, Sully's QoL filter template, download (.json or .zip)                          |                                                                                                        |
| `/loot-filters/:id`     | LootFilterEditorScreen  | Loot filter editor; unknown id shows "Filter not found"                                                          | `tab=rules\|styles\|settings\|json\|test`                                                              |
| `/stash`                | StashLayout             | My Stash frame: Overview / Ancient Coupons / All Items tabs, shared upload state ([STASH](../features/STASH.md)) |                                                                                                        |
| `/stash` (index)        | StashHomeScreen         | Upload (or the loaded file) and the stash pages with a one-line summary each                                     |                                                                                                        |
| `/stash/coupons`        | StashCouponsScreen      | Ancient Coupons in the uploaded stash: unique, have / need, Wild Card recipe, where                              | `search`, `status`, `tier`, `page`, `sort`, `dir` (kept in the URL)                                    |
| `/stash/items`          | StashItemsScreen        | All Items: every item on the stash pages ([STASH-ITEMS](../features/STASH-ITEMS.md))                             |                                                                                                        |
| `/builds`               | BuildsScreen            | Shared builds list (Supabase only)                                                                               |                                                                                                        |
| `/builds/new`           | CreateBuildScreen       | Create a build (sign-in required)                                                                                |                                                                                                        |
| `/builds/:buildId/edit` | EditBuildScreen         | Edit an own build                                                                                                |                                                                                                        |
| `/build/:buildId`       | BuildDetailScreen       | Build detail page                                                                                                |                                                                                                        |
| `/user/:userId`         | UserProfileScreen       | A user's public builds                                                                                           |                                                                                                        |
| `*`                     | NotFoundScreen          | Catch-all for unknown URLs, with a link back home                                                                |                                                                                                        |

`map` is a static segment, so the router ranks `/guide/map` above `/guide/:slug` (a note with the slug `map` would
be shadowed). `/guide/:slug` slugs are the file names in `content/guide/notes/`.

**Query params.** The shared keys are `FILTER_URL_PARAM_KEYS` in `src/core/utils/filterUrlParams.ts` (`search`, `sockets`,
`maxlvl`, `items`, `runes`, `tierpts`, `gems`, `name`); `sockets` takes an exact count or a range (`4`, `2-4`, `-4`, `4-`). The
feature-specific keys live next to each feature's `useUrlInitialize` hook, and `GAME_DATA_URL_PARAM_KEYS` in
`src/features/game-data/constants/urlParams.ts`. The filter screens (runewords, gemwords, socketables, uniques, mythicals,
ascendancies, bases, best base, affixes) read their params once on mount, put them into Redux and remove them from the URL;
Copy Link rebuilds a URL from the current state (non-default values only). Item Types (`type`), Enhance (`tab`, `slot`,
`tier`, `search`), Cube Recipes (`search`, `family`), Materials (`search`, `group`, `name`), Areas (`search`, `minlvl`, `maxlvl`) and the loot filter editor (`tab`) read their params on every render and keep them in the URL. The builds screens keep their search, class and sort in
Redux only.

**`?name=<Name>` focus** (runewords, gemwords, socketables, uniques, mythicals): shows only the items whose name equals `<Name>`
(`normaliseItemName` in `src/core/utils/itemName.ts`: case, whitespace, quotes/apostrophes and dashes unified; all variants of a
runeword), unlike `?search=`, which also matches affix text. While it is set, every other filter of the screen (search, sockets,
level, types, runes/gems, categories, coupon, highest quality) is ignored but kept, so the item is always visible and clearing
the focus brings the previous filters back; the favourites-only toggle still applies. It is read on mount like the other params
(the URL is then cleaned) and cleared by any visit whose URL has no `name`, so it never outlives the deep link. The search box
does not change it. A dismissible "Showing: <Name> ×" chip shows it and scrolls into view only right after the deep link.
Copy Link keeps it. Guide `rw:`/`gw:`/`unique:`/`mythical:`/`socketable:` links use it.

**Old runewords links.** The runewords browser lived at `/` until the home page took that path. `/` with any query
string (`/?name=Enigma`, `/?search=x&sockets=4`: old Copy Link URLs and guide deep links) redirects (`replace`) to
`/runewords` with the same query and hash; only a bare `/` renders the home page. The decision is
`runewordsRedirectTarget` in `src/core/router/homeRedirect.ts` (tested), applied by `HomeRoute` around the index route.

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
   and tab); Cube `/game-data/cube?family=<id>`; Bases and Areas have no exact-name focus, so `?search="<name>"`. The
   first row, selected by default, is "Search runewords for “…”", so Enter without picking a result goes to
   `/runewords?search=<query>`.
3. **Section cards** (`HomeSections`): one card per `NAV_ENTRIES` entry (`getHomeSections` in `utils/homeSections.ts`):
   a group's `description` and its pages as chips; a plain link's `description` and its `homeLinks` chips (Guide: Start
   here, Note map) or the page itself. Builds only when Supabase is configured. A test checks every nav page appears once.
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
   last checked against the live tools on 2026-11-04. Static data, no fetches. Both sections share the `HomeLinkCard` component.
8. **Footer** (`HomeFooter`): app version (`src/assets/version.json`), ESR / GitHub / privacy policy links (URLs from
   `navConfig.ts`), credits.

The page skips the startup loading gate (exact match on `/`, see below), so it renders before the HTM sync finishes.

## App Shell Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│ D2R ESR  Recipes▾ Database▾ Tools▾ Guide Builds [📖] [☀] [GH] [⚙] │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                         Main Content Area                             │
│                        (Feature Screens)                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

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
- `/game-data/enhance`, `/game-data/cube`, `/game-data/materials`, `/game-data/sets` and `/game-data/areas`: only
  `enhance.json` / `cube.json` / `materials.json` / `sets.json` / `areas.json` (+ the guide bundle, or sources.json for Sets) (the other Game Data pages stay behind the gate: Best Base matches the HTM
  runewords), see [GAME-DATA.md](../features/GAME-DATA.md).
- `/stash`: the My Stash pages read `stash.json` and the uploaded file (IndexedDB `d2r-esr-stash`), see
  [STASH.md](../features/STASH.md).

### Header Components

`src/core/components/Header.tsx` renders from one typed config, `NAV_ENTRIES` in `src/core/navigation/navConfig.ts`
(groups of `NavItem`s with a label, a one-line description and a path, plus plain links). The home page's section
cards render from the same config (group `description`, link `homeLinks`):

| Entry      | Kind  | Pages                                                                                                                                                                                                                    |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recipes ▾  | group | Runewords (`/runewords`), Gemwords (`/gemwords`), Socketables (`/socketables`)                                                                                                                                           |
| Database ▾ | group | Uniques (`/uniques`), Mythicals (`/mythicals`), Sets (`/game-data/sets`), Ascendancies (`/ascendancies`), Skills (`/skills`), Bases (`/game-data/bases`), Materials (`/game-data/materials`), Areas (`/game-data/areas`) |
| Tools ▾    | group | Best Base (`/game-data/best-base`), Affixes (`/game-data/affixes`), Item Types (`/game-data/types`), Enhance (`/game-data/enhance`), Cube Recipes (`/game-data/cube`), Loot Filters (`/loot-filters`)                    |
| My Stash ▾ | group | Overview (`/stash`, `exact`: not active on its sub-pages), Ancient Coupons (`/stash/coupons`), All Items (`/stash/items`)                                                                                                |
| Guide      | link  | `/guide`                                                                                                                                                                                                                 |
| Builds     | link  | `/builds`, only when Supabase is configured (`requiresSupabase`, filtered by `getNavEntries`)                                                                                                                            |

- **Brand**: "D2R ESR", a link to `/` (the home page).
- **Desktop (md and up)**: a shadcn `NavigationMenu` (`src/components/ui/navigation-menu.tsx`, `viewport={false}` so
  each dropdown opens under its own trigger). Each group trigger opens a list of label + description links. Active state:
  an item is active when the path equals its `to` or starts with `to/` (only the former for an `exact` item; no item is active on the home page); a group trigger is highlighted when any of its items is active (`isNavGroupActive`). Active links
  get `aria-current="page"`. Keyboard (Radix): triggers are in the tab order, Enter/Space/ArrowDown opens, arrows and
  Tab move through the items, Escape closes; choosing a link closes the menu.
- **Right side**: ESR links dropdown (book icon, md and up: the `OFFICIAL_LINKS` Official site, Installation Guide, Documentation, Drop Finder,
  Frame Table, Patch notes, Changelog, Releases, ESR Discord, ESR on GitHub, then a "Community tools" label with ESR Wiki Overlay, ESR Docs,
  ESR Tools, Unofficial ESR Wiki from `COMMUNITY_TOOLS`), theme toggle, GitHub link,
  `AuthControls` (Sign In / user menu, Supabase only), settings cog.
- **Mobile (below md)**: hamburger opens a left `Sheet` with a shadcn `Accordion` (`type="multiple"`) of the same groups;
  the group of the current route starts open, Guide and Builds are top-level links, then the official ESR links (`OFFICIAL_LINKS`), a small "Community tools" label with the
  community links, and the auth control. Choosing a page closes the sheet.

`navConfig.test.ts` checks that every config path resolves to a real route of the router (not the `*` catch-all), that
labels, keys and paths are unique, that Builds is hidden without Supabase, and the active-state rules.

### Nested sections

`/guide`, `/game-data` and `/loot-filters` are nested routes with a lazy layout that renders a frame above an `<Outlet />`:

- `GuideLayout`: a width-only `PageShell` with the "Experimental" `DevNotice`, then the spine (index, its own narrow
  `PageShell` with the title), the map (`map`) or a note (`:slug`);
- `LootFilterLayout`: a width-only `PageShell` with the "Under development" `DevNotice`, then the library (index) or the
  editor (`:id`);
- `GameDataLayout`: a `PageShell` with the title, the game-file version lines as its meta line and the sub-tabs as its
  tab row (below); its index redirects to `bases`.

`GameDataLayout` renders:

```
Game Data
Game files: ESR 3.2.10 (tag 3.2.10 @ 10b540e, generated 2026-10-09)
Docs data: ESR 3.2.10 (site updated 9 Oct 2026)
[amber note when the HTM docs ESR version differs]
[Bases] [Best Base] [Affixes] [Item Types]      <- NavLinks, same classes as the header links (navTabClasses.ts)
----------------------------------------------
<Outlet />                                        <- child route screen
```

Each child route is its own lazy screen wrapped in `<Suspense>` (each section's screens come from one feature module
(`@/features/guide`, `@/features/game-data`, `@/features/loot-filter`), so they share its chunk).
The version line comes from `public/game-data/manifest.json`; the docs line from Dexie `metadata.esrVersion` and
`metadata.docsLastModified`. Both versions normally come from `metadata.modVersion` of ESR's `d2rloader/metadata.json`;
the docs version may fall back to the changelog page's header, so the note never says which version is newer.

The Game Data child pages are separate header items (Bases, Sets, Materials and Areas under Database; Best Base, Affixes, Item Types, Enhance and Cube Recipes under Tools).
Guide and Loot Filters items are prefix-matched, so they stay active on every child page.

The header triggers and links, the Game Data sub-tabs and the loot filter editor's tabs share one set of classes
(`TAB_BASE` / `TAB_INACTIVE` / `TAB_ACTIVE` in `src/core/components/navTabClasses.ts`). The editor's tabs are not routes but
buttons in a `role="tablist"` (`role="tab"`, `aria-selected`) that set `?tab=`. The amber notices of `GuideLayout` and
`LootFilterLayout` are both `DevNotice` (`src/core/components/DevNotice.tsx`).

### Navigation Style

- Active route highlighted in nav (item and its group trigger)
- Mobile: Sheet-based slide-out menu with an accordion of the groups

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
│                             │  Data                         │
│                             │  [Force Refresh Data]         │
│                             │                               │
│                             │  App Version: 1.12.1          │
│                             │  Game files: ESR 3.2.24 (...) │
│                             │  Docs data: ESR 3.2.24 · ...  │
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
            { index: true, element: routeElement(GuideSpineScreen) },
            { path: 'map', element: routeElement(GuideMapScreen) },
            { path: ':slug', element: routeElement(GuideNoteScreen) },
          ],
        },
        { path: 'gemwords', element: routeElement(GemwordsScreen) },
        { path: 'socketables', element: routeElement(SocketablesScreen) },
        {
          path: 'game-data',
          element: routeElement(GameDataLayout),
          children: [
            { index: true, element: <Navigate to="bases" replace /> },
            { path: 'bases', element: routeElement(GameDataBasesScreen) },
            // ... sets, best-base, affixes, types, enhance, cube, materials, areas
          ],
        },
        // ... uniques, mythicals, ascendancies (before game-data),
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
  readonly isDrawerOpen: boolean;
}
```

All settings (except `isDrawerOpen`) are persisted to localStorage and restored on startup. An inline script in `index.html` applies the stored theme, Diablo font class, and text size to `<html>` before first paint (avoids a flash of the default theme); `ThemeInitializer` then keeps them in sync with the Redux state.

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
    ├── navTabClasses.ts    # Shared nav link / sub-tab classes
    └── SettingsDrawer.tsx  # Settings slide-out panel

src/features/settings/
├── components/
│   └── ThemeInitializer.tsx  # Apply theme on initial render
├── constants/
│   ├── textSize.ts           # Text size pixel mappings
│   └── types.ts              # Theme, TextSize types
├── hooks/
│   └── useTheme.ts           # useThemeSync / useTextSizeSync / useDiabloFontSync (apply settings to <html>)
└── store/
    └── settingsSlice.ts      # Theme, text size, font, drawer state
```

## Accessibility

- Navigation links have proper `aria-current` for active state; the desktop menu and the mobile sheet are `<nav aria-label="Main">`
- Group triggers are keyboard operable (Enter/Space/arrows open, Escape closes) via Radix NavigationMenu
- Settings drawer uses `aria-hidden` and focus trap when open
- Close button and Escape key close the drawer

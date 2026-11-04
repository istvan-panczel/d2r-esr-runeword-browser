# Architecture

## Project Structure

```
src/
├── components/
│   └── ui/                     # shadcn/ui base components
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
│
├── core/                       # App infrastructure
│   ├── store/                  # Redux store setup
│   │   ├── store.ts            # Store configuration
│   │   └── sagaRegistry.ts     # Saga registry (dynamic registration, supports lazy-loaded sagas)
│   ├── db/                     # Dexie database setup
│   │   ├── db.ts               # Database instance (d2r-esr-runeword-browser)
│   │   └── models.ts           # Type definitions for all entities
│   ├── api/                    # Data fetching
│   │   ├── remoteConfig.ts     # Remote URLs
│   │   ├── versionApi.ts       # Version checking (GitHub mod metadata, changelog fallback)
│   │   ├── gemsApi.ts          # Fetch gems.htm
│   │   ├── gemwordsApi.ts      # Fetch gemwords.htm
│   │   ├── runewordsApi.ts     # Fetch runewords.htm
│   │   ├── htmUniqueItemsApi.ts # Fetch unique_weapons/armors/others.htm
│   │   ├── mythicalUniquesApi.ts # Fetch unique_mythicals.htm
│   │   └── ascendanciesApi.ts  # Fetch ascendancies.htm
│   ├── supabase/               # Optional Supabase client, config, generated types
│   ├── components/             # Shared app components (Header, SettingsDrawer, recipe filters/bonuses, favourites)
│   ├── hooks/                  # Shared hooks (useAvailableItemTypes, useSocketableLookup, ...)
│   ├── utils/                  # Shared stateless utilities
│   ├── constants/              # Shared constants (item type categories, gem colors)
│   ├── types/                  # Shared types (RequestState enum)
│   ├── router/                 # Router configuration
│   │   └── index.tsx           # Route definitions (screens lazy-loaded per route)
│   ├── layouts/                # App layouts
│   │   └── AppLayout.tsx
│   └── startup.ts              # Lazy saga registration (startDataSync, startAuth, startBuilds, startFavorites)
│
├── features/                   # Feature modules
│   ├── data-sync/              # Data fetching, parsing, and storage
│   ├── runewords/              # Runeword browsing and filtering
│   ├── gemwords/               # Gemword browsing and filtering
│   ├── socketables/            # Socketable browsing and filtering
│   ├── htm-unique-items/       # Unique item browsing and filtering
│   ├── mythical-uniques/       # Mythical unique items
│   ├── ascendancies/           # Ascendancies and their tier bonuses
│   ├── skills/                 # Skill trees + item-granted skills (game-data bundles)
│   ├── game-data/              # Pages built on the static txt game-file bundles (bases, best base, affixes, item types)
│   ├── guide/                  # New-player guide (static bundle compiled from content/guide/)
│   ├── loot-filter/            # Loot filter library and editor
│   ├── auth/                   # Supabase sign-in (optional backend)
│   ├── builds/                 # Shared builds (optional backend)
│   ├── favorites/              # Recipe favourites synced to Supabase
│   └── settings/               # Theme, text size, Diablo font, page width
│
├── lib/                        # Third-party library configurations
│   └── utils.ts                # shadcn/ui utility (cn())
│
└── index.css                   # Global styles + Tailwind + CSS variables
```

## Feature Module Structure

Each feature is self-contained. **Create subfolders only as needed**, not upfront.

### Minimum Feature Structure

```
features/[feature]/
├── store/
│   └── [feature]Slice.ts
└── index.ts
```

### Full Feature Structure (as it grows)

```
features/runewords/
├── components/              # Feature-specific UI components
├── constants/               # Feature constants
├── hooks/                   # Feature-specific hooks
├── screens/                 # Full page components
├── store/                   # Redux slice (+ saga if needed)
├── types/                   # TypeScript types/interfaces
├── utils/                   # Feature utilities
└── index.ts                 # Public exports
```

## Data Flow

The app has two data systems. The main one is HTM-based: data is fetched from the ESR documentation site, parsed with `DOMParser`, and stored in IndexedDB (below). The Game Data pages use static bundles built from the ESR game files (see [Game-file data](#game-file-data)).

```
┌─────────────────────────────────────────────────────────────┐
│                        App Startup                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Check IndexedDB (d2r-esr-runeword-browser) for data     │
│     - If data exists & version matches → use cached          │
│     - If no data or version differs → trigger parsing saga   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Redux Saga: Fetch & Parse HTML                          │
│     - Fetch 8 HTML files from easternsunresurrected.com     │
│     - Parse with DOMParser                                  │
│     - Transform into structured models                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Store in IndexedDB via Dexie                            │
│     - Database: d2r-esr-runeword-browser (version 14)       │
│     - Tables: gems, esrRunes, lodRunes, kanjiRunes,         │
│       crystals, runewords, gemwords,                        │
│       htmUniqueItems, mythicalUniques, ascendancies,        │
│       metadata                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UI reads from IndexedDB                                 │
│     - useLiveQuery for reactive updates                     │
│     - Components stay in sync automatically                 │
└─────────────────────────────────────────────────────────────┘
```

### Game-file data

The Game Data pages (`/game-data/*`) read static JSON bundles generated at build time from the ESR txt game tables:

```
ESR clone (excel/*.txt, strings/*.json)
   │  npm run game-data:generate  (scripts/generate-game-data.ts, Node type stripping)
   ▼
public/game-data/{manifest,types,bases,runewords,affixes,sources,lootfilter}.json   committed, pinned to an ESR git tag
   │  fetch(…?v=<sha256>) with a module-level promise cache (engine/browser/loadGameData.ts)
   ▼
useGameData(files) → pages (bundles stay out of Redux and IndexedDB)
```

`src/features/game-data/engine/` holds pure logic used both by the pages and the generator (schema, type ancestors,
socket caps, runeword matching, best base, affix eligibility); `build/` is generator-only (txt parser, string tables,
stat renderer, bundle writers) and is excluded from the app build. Both use relative `.ts` imports and no DOM.
Details: [GAME-DATA.md](../features/GAME-DATA.md).

## Core vs Features

| Location         | Contains                       | Example                                        |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| `core/`          | App infrastructure, singletons | Store setup, DB instance, API config, router   |
| `core/utils/`    | Shared stateless utilities     | Version utils, string helpers                  |
| `features/`      | Domain-specific modules        | Runewords, Socketables, Unique Items, Settings |
| `components/ui/` | Shared UI components           | Buttons, cards, badges (shadcn/ui)             |

## Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **Folders**: lowercase with hyphens if needed
- **Slices**: `[feature]Slice.ts`
- **Sagas**: `[feature]Saga.ts`
- **Types**: `index.ts` exports all types, or individual files for complex types

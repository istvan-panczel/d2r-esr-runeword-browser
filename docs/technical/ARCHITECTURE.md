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
│   │   ├── index.ts            # Store configuration
│   │   └── rootSaga.ts         # Root saga
│   ├── db/                     # Dexie database setup
│   │   ├── index.ts            # Database instances (db + txtDb)
│   │   ├── models/             # HTM data type definitions
│   │   ├── txtDb.ts            # TXT database instance
│   │   └── txtModels.ts        # TXT data type definitions
│   ├── api/                    # Data fetching
│   │   └── txtApi.ts           # Fetch TXT files via HTTP
│   ├── utils/
│   │   └── tsvParser.ts        # Generic TSV parser
│   ├── providers/              # React context providers
│   │   └── AppProviders.tsx    # Combines all providers
│   ├── router/                 # Router configuration
│   │   └── index.tsx           # Route definitions
│   └── layouts/                # App layouts
│       └── MainLayout.tsx
│
├── features/                   # Feature modules
│   └── [feature-name]/
│       ├── components/         # Feature-specific UI components
│       ├── containers/         # Container components (combine UI + logic)
│       ├── store/              # Redux slice + saga
│       │   ├── [feature]Slice.ts
│       │   └── [feature]Saga.ts
│       ├── hooks/              # Feature-specific hooks
│       ├── types/              # TypeScript types/interfaces
│       ├── constants/          # Feature constants
│       ├── mappers/            # Data transformation functions
│       ├── screens/            # Full page components (if needed)
│       ├── modals/             # Modal components (if needed)
│       └── enums/              # Enumerations (if needed)
│
├── utils/                      # Shared utilities
│   ├── cn.ts                   # className utility (clsx + tailwind-merge)
│   └── ...
│
├── public/
│   └── txt/                    # TXT game data files (TSV format)
│       ├── properties.txt      # Property code translations
│       ├── gems.txt            # Socketable definitions
│       ├── runes.txt           # Runeword definitions
│       ├── uniqueitems.txt     # Unique item definitions
│       ├── sets.txt            # Set definitions
│       └── setitems.txt        # Set item definitions
│
├── lib/                        # Third-party library configurations
│   └── utils.ts                # shadcn/ui utility (generated)
│
└── styles/
    └── globals.css             # Global styles + Tailwind + CSS variables
```

## Feature Module Structure

Each feature is self-contained. **Create subfolders only as needed**, not upfront.

### Minimum Feature Structure
```
features/runewords/
├── store/
│   ├── runewordsSlice.ts
│   └── runewordsSaga.ts
└── types/
    └── index.ts
```

### Full Feature Structure (as it grows)
```
features/runewords/
├── components/
│   ├── RunewordCard.tsx
│   └── RunewordFilters.tsx
├── containers/
│   └── RunewordListContainer.tsx
├── store/
│   ├── runewordsSlice.ts
│   └── runewordsSaga.ts
├── hooks/
│   └── useRunewordSearch.ts
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
├── mappers/
│   └── htmlToRuneword.ts
└── screens/
    └── RunewordsScreen.tsx
```

## Data Flow

The app has two data systems running in parallel during the transition period.

### HTM-Based Data Flow (Current - will be deprecated)

```
┌─────────────────────────────────────────────────────────────┐
│                        App Startup                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Check IndexedDB (d2r-esr-runewords) for existing data   │
│     - If data exists & fresh → skip parsing                 │
│     - If no data or stale → trigger parsing saga            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Redux Saga: Fetch & Parse HTML                          │
│     - Prod: Fetch from ESR documentation site               │
│     - Parse with DOMParser                                  │
│     - Transform via mappers                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Store in IndexedDB via Dexie                            │
│     - Database: d2r-esr-runewords                           │
│     - Tables: gems, esrRunes, lodRunes, kanjiRunes,         │
│       crystals, runewords, affixes, metadata                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UI reads from IndexedDB                                 │
│     - useLiveQuery for reactive updates                     │
│     - Components stay in sync automatically                 │
└─────────────────────────────────────────────────────────────┘
```

### TXT-Based Data Flow (Experimental - will replace HTM)

```
┌─────────────────────────────────────────────────────────────┐
│            User clicks "Parse TXT Files" in Settings        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Check IndexedDB (d2r-esr-txt-data) for cached data      │
│     - If force refresh → clear and re-fetch                 │
│     - If cached → use existing data                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Redux Saga: Fetch & Parse TXT (TSV format)              │
│     - Fetch 6 TXT files via HTTP from public/txt/           │
│     - Parse with tsvParser utility                          │
│     - Resolve property codes to tooltips                    │
│     - Resolve rune codes to names                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Store in IndexedDB via Dexie                            │
│     - Database: d2r-esr-txt-data                            │
│     - Tables: properties, socketables, runewords,           │
│       uniqueItems, sets, setItems, metadata                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UI reads from txtDb                                     │
│     - useLiveQuery for reactive updates                     │
│     - PropertyTranslator for code → text conversion         │
└─────────────────────────────────────────────────────────────┘
```

### Two Databases

| Database | Purpose | Trigger |
|----------|---------|---------|
| `d2r-esr-runewords` | HTM-based data (socketables, runewords) | App startup |
| `d2r-esr-txt-data` | TXT-based data (all items including unique/sets) | Manual button |

Both databases coexist during development. Once TXT-based features are complete, HTM parsing will be removed.

## Core vs Features vs Utils

| Location | Contains | Example |
|----------|----------|---------|
| `core/` | App infrastructure, singletons | Store setup, DB instance, providers |
| `features/` | Domain-specific modules | Runewords, Characters, Filters |
| `utils/` | Shared stateless utilities | String helpers, formatters, cn() |

## Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **Folders**: lowercase with hyphens if needed
- **Slices**: `[feature]Slice.ts`
- **Sagas**: `[feature]Saga.ts`
- **Types**: `index.ts` exports all types, or individual files for complex types

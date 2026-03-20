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
│   │   └── rootSaga.ts         # Root saga (dynamic registration)
│   ├── db/                     # Dexie database setup
│   │   ├── db.ts               # Database instance (d2r-esr-runeword-browser)
│   │   └── models.ts           # Type definitions for all entities
│   ├── api/                    # Data fetching
│   │   ├── remoteConfig.ts     # Remote URLs
│   │   ├── changelogApi.ts     # Version checking
│   │   ├── gemsApi.ts          # Fetch gems.htm
│   │   ├── runewordsApi.ts     # Fetch runewords.htm
│   │   └── htmUniqueItemsApi.ts # Fetch unique_*.htm pages
│   ├── types/                  # Shared types (RequestState enum)
│   ├── router/                 # Router configuration
│   │   └── index.tsx           # Route definitions
│   └── layouts/                # App layouts
│       └── AppLayout.tsx
│
├── features/                   # Feature modules
│   ├── data-sync/              # Data fetching, parsing, and storage
│   ├── runewords/              # Runeword browsing and filtering
│   ├── socketables/            # Socketable browsing and filtering
│   ├── htm-unique-items/       # Unique item browsing and filtering
│   └── settings/               # Theme, text size, Diablo font
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

The app uses a single HTM-based data system. All data is fetched from the ESR documentation site, parsed with `DOMParser`, and stored in IndexedDB.

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
│     - Fetch 5 HTML files from easternsunresurrected.com     │
│     - Parse with DOMParser                                  │
│     - Transform into structured models                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Store in IndexedDB via Dexie                            │
│     - Database: d2r-esr-runeword-browser (version 10)       │
│     - Tables: gems, esrRunes, lodRunes, kanjiRunes,         │
│       crystals, runewords, affixes, htmUniqueItems, metadata│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UI reads from IndexedDB                                 │
│     - useLiveQuery for reactive updates                     │
│     - Components stay in sync automatically                 │
└─────────────────────────────────────────────────────────────┘
```

## Core vs Features

| Location | Contains | Example |
|----------|----------|---------|
| `core/` | App infrastructure, singletons | Store setup, DB instance, API config, router |
| `core/utils/` | Shared stateless utilities | Version utils, string helpers |
| `features/` | Domain-specific modules | Runewords, Socketables, Unique Items, Settings |
| `components/ui/` | Shared UI components | Buttons, cards, badges (shadcn/ui) |

## Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **Folders**: lowercase with hyphens if needed
- **Slices**: `[feature]Slice.ts`
- **Sagas**: `[feature]Saga.ts`
- **Types**: `index.ts` exports all types, or individual files for complex types

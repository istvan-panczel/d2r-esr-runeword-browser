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
│   │   ├── index.ts            # Database instance
│   │   └── models/             # Table type definitions
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
├── data/
│   └── raw/                    # Dev HTML fixtures
│       └── runewords.htm       # Local copy for development
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

```
┌─────────────────────────────────────────────────────────────┐
│                        App Startup                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Check IndexedDB for existing data                       │
│     - If data exists & fresh → skip parsing                 │
│     - If no data or stale → trigger parsing saga            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Redux Saga: Fetch & Parse HTML                          │
│     - Dev: Load from src/data/raw/                          │
│     - Prod: Fetch from remote URLs                          │
│     - Parse with DOMParser                                  │
│     - Transform via mappers                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Store in IndexedDB via Dexie                            │
│     - Structured data models                                │
│     - Indexed for fast queries                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. UI reads from IndexedDB                                 │
│     - useLiveQuery for reactive updates                     │
│     - Components stay in sync automatically                 │
└─────────────────────────────────────────────────────────────┘
```

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

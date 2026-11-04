# Tech Stack

## Core Framework

| Technology     | Version | Purpose                              |
| -------------- | ------- | ------------------------------------ |
| React          | 19      | UI library                           |
| React Compiler | Latest  | Automatic memoization & optimization |
| TypeScript     | 5.9     | Type safety                          |
| Vite           | 8       | Build tool & dev server              |

## UI & Styling

| Technology               | Purpose                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| shadcn/ui                | Base component library (copy-paste approach)                           |
| Tailwind CSS 4           | Utility-first CSS framework (with @tailwindcss/vite plugin)            |
| Radix UI                 | Accessible primitives (checkbox, dialog, label, popover, slider, slot) |
| Lucide React             | Icon library                                                           |
| Class Variance Authority | Component variant management                                           |
| clsx                     | Conditional className construction                                     |
| tailwind-merge           | Merge Tailwind classes without conflicts                               |
| CodeMirror 6             | Loot filter JSON editor (lazy chunk); VS Code themes from @uiw         |

shadcn/ui components are installed via CLI and customized for a Diablo 2 aesthetic.

## State Management

| Technology    | Purpose                              |
| ------------- | ------------------------------------ |
| Redux Toolkit | State management with slices         |
| Redux Saga    | Side effects & async operations      |
| react-redux   | React bindings for Redux             |
| reselect      | Memoized selectors for derived state |

**Why Redux Saga over RTK Query/Thunks:**

- App works offline with IndexedDB, no REST APIs to call
- Sagas provide better control for complex data parsing flows
- Generator-based approach for sequential HTML parsing operations

## Data Layer

| Technology        | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| Dexie.js          | IndexedDB wrapper for local database            |
| dexie-react-hooks | React hooks for reactive queries (useLiveQuery) |

**Data Flow:**

1. Fetch and parse the remote ESR HTML pages (in dev and production alike)
2. Transform data into structured models
3. Store in IndexedDB via Dexie
4. UI reads from IndexedDB reactively

## HTML Parsing

| Technology | Purpose                             |
| ---------- | ----------------------------------- |
| DOMParser  | Native browser API for HTML parsing |

No external parsing libraries needed. DOMParser provides sufficient capability for extracting data from the ESR documentation HTML.

## Routing

| Technology       | Version | Purpose                                      |
| ---------------- | ------- | -------------------------------------------- |
| react-router-dom | 7       | Client-side routing with createBrowserRouter |

## Testing

| Technology          | Purpose                                    |
| ------------------- | ------------------------------------------ |
| Vitest 5            | Test runner and assertion library          |
| @vitest/ui          | Visual UI for interactive testing          |
| @vitest/coverage-v8 | Code coverage reporting                    |
| jsdom               | DOM environment for browser API simulation |
| fake-indexeddb      | IndexedDB mock for database testing        |

**Test Scripts:**

```bash
npm run test             # Run tests once (CI mode)
npm run test:watch       # Run tests in watch mode (development)
npm run test:ui          # Open Vitest UI for interactive testing
npm run test:coverage    # Generate code coverage report
```

See [TESTING.md](./TESTING.md) for detailed testing patterns and conventions.

## React Compiler

The project uses [React Compiler](https://react.dev/learn/react-compiler) for automatic optimization.

**What it does:**

- Automatically memoizes components and hooks at compile time
- Eliminates the need for manual `useMemo`, `useCallback`, and `React.memo`
- Optimizes re-renders without developer intervention

**When manual optimization is still needed:**

- Complex computations that the compiler can't analyze
- Third-party library integration edge cases
- Performance-critical code where you need explicit control

**ESLint Integration:**
The compiler's diagnostics ship as rules in `eslint-plugin-react-hooks` (its recommended flat config enables them), so patterns that prevent optimization fail lint.

**Scripts:**

```bash
npm run compiler:check    # Check if compiler can optimize all components
npm run compiler:health   # Run health check on the codebase
```

## Build Scripts

`scripts/generate-game-data.ts` runs directly with Node's built-in TypeScript type stripping (Node ≥ 22.18, see
`engines`): `npm run game-data:generate` / `npm run game-data:check`. It and the shared `src/features/game-data/{engine,build}`
code are type-checked by `tsconfig.scripts.json` (Node types, ES2023, no DOM; relative imports ending in `.ts`).

## Development Tools

Already configured in project:

- ESLint (strict TypeScript rules + React Compiler rules)
- Prettier (formatting)
- Husky + lint-staged (pre-commit hooks)
- commitlint (conventional commits)
- commit-and-tag-version (semantic versioning)

# Tech Stack

## Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI library |
| React Compiler | Latest | Automatic memoization & optimization |
| TypeScript | Latest | Type safety |
| Vite | Latest | Build tool & dev server |

## UI & Styling

| Technology | Purpose |
|------------|---------|
| shadcn/ui | Base component library (copy-paste approach) |
| Tailwind CSS | Utility-first CSS framework |
| clsx | Conditional className construction |
| tailwind-merge | Merge Tailwind classes without conflicts |

shadcn/ui components are installed via CLI and customized for a Diablo 2 aesthetic.

## State Management

| Technology | Purpose |
|------------|---------|
| Redux Toolkit | State management with slices |
| Redux Saga | Side effects & async operations |
| react-redux | React bindings for Redux |
| reselect | Memoized selectors for derived state |

**Why Redux Saga over RTK Query/Thunks:**
- App works offline with IndexedDB, no REST APIs to call
- Sagas provide better control for complex data parsing flows
- Generator-based approach for sequential HTML parsing operations

## Data Layer

| Technology | Purpose |
|------------|---------|
| Dexie.js | IndexedDB wrapper for local database |
| dexie-react-hooks | React hooks for reactive queries |

**Data Flow:**
1. Parse remote HTML files (or local dev fixtures)
2. Transform data into structured models
3. Store in IndexedDB via Dexie
4. UI reads from IndexedDB reactively

## HTML Parsing

| Technology | Purpose |
|------------|---------|
| DOMParser | Native browser API for HTML parsing |

No external parsing libraries needed. DOMParser provides sufficient capability for extracting data from the ESR documentation HTML.

## Routing

| Technology | Purpose |
|------------|---------|
| react-router-dom | Client-side routing (v7 recommended) |

## Validation (Recommended)

| Technology | Purpose |
|------------|---------|
| zod | Runtime validation of parsed data |

Useful for validating data structures extracted from HTML before storing in IndexedDB.

## Testing

| Technology | Purpose |
|------------|---------|
| Vitest | Test runner and assertion library |
| @vitest/ui | Visual UI for interactive testing |
| @vitest/coverage-v8 | Code coverage reporting |
| jsdom | DOM environment for browser API simulation |
| fake-indexeddb | IndexedDB mock for database testing |

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
The `eslint-plugin-react-compiler` is configured to report errors when code patterns prevent optimization.

**Scripts:**
```bash
npm run compiler:check    # Check if compiler can optimize all components
npm run compiler:health   # Run health check on the codebase
```

## Development Tools

Already configured in project:
- ESLint (strict TypeScript rules + React Compiler rules)
- Prettier (formatting)
- Husky + lint-staged (pre-commit hooks)
- commitlint (conventional commits)

## Package Installation Commands

```bash
# UI
npx shadcn@latest init
npm install clsx tailwind-merge

# State
npm install @reduxjs/toolkit react-redux redux-saga reselect

# Database
npm install dexie dexie-react-hooks

# Routing
npm install react-router-dom

# Validation (optional)
npm install zod
```

# Coding Guidelines

This document defines coding conventions for consistency across the project. It will be expanded as patterns emerge during development.

## General Principles

1. **Consistency over personal preference** - Follow established patterns
2. **Explicit over implicit** - Prefer clear, readable code
3. **Composition over inheritance** - Use hooks and composition patterns

## TypeScript

### Strict Mode
The project uses strict TypeScript. Avoid:
- `any` type (use `unknown` if truly unknown)
- Non-null assertions (`!`) - use proper null checks
- Type assertions (`as`) unless necessary

### Prefer Readonly
Use `readonly` wherever possible. ESLint enforces this via `@typescript-eslint/prefer-readonly`.

```typescript
// Good - class members that aren't reassigned
class RunewordService {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }
}

// Good - readonly arrays and objects in types
interface RunewordFilters {
  readonly selectedRunes: readonly string[];
  readonly socketCount: number | null;
}

// Good - function parameters (when possible)
function processRunewords(runewords: readonly Runeword[]): void {
  // ...
}
```

### Type Definitions

```typescript
// Prefer interfaces for object shapes
interface Runeword {
  id: string;
  name: string;
  runes: string[];
  stats: RunewordStat[];
}

// Use types for unions, primitives, or computed types
type ItemType = 'weapon' | 'armor' | 'shield';
type RunewordId = string;
```

### Export Types
Export types from a feature's `types/index.ts`:

```typescript
// features/runewords/types/index.ts
export interface Runeword { ... }
export interface RunewordStat { ... }
export type RunewordFilter = { ... };
```

## React Components

### Function Components Only
Use function components with hooks. No class components.

```typescript
// Good
function RunewordCard({ runeword }: RunewordCardProps) {
  return <div>{runeword.name}</div>;
}

// Also good (arrow function for simple components)
const RunewordCard = ({ runeword }: RunewordCardProps) => (
  <div>{runeword.name}</div>
);
```

### Props Interface Naming
Name props interfaces as `[ComponentName]Props`:

```typescript
interface RunewordCardProps {
  runeword: Runeword;
  onSelect?: (id: string) => void;
}
```

### Destructure Props
Always destructure props in the function signature:

```typescript
// Good
function RunewordCard({ runeword, onSelect }: RunewordCardProps) { ... }

// Avoid
function RunewordCard(props: RunewordCardProps) { ... }
```

### Hooks Dependencies
ESLint enforces `react-hooks/exhaustive-deps` as an error. All dependencies must be specified.

```typescript
// Good - all dependencies listed
const filteredRunewords = useMemo(
  () => runewords.filter((rw) => rw.sockets === socketCount),
  [runewords, socketCount]
);

// Good - callback with proper deps
const handleSelect = useCallback(
  (id: string) => {
    onSelect(id);
    trackEvent('runeword_selected', { id });
  },
  [onSelect]
);

// If you need to exclude a dependency, explain why with a comment
// eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only on mount
useEffect(() => {
  initializeData();
}, []);
```

## File Organization

### One Component Per File
Each component gets its own file. Exception: tightly coupled sub-components.

### Index Files
Use `index.ts` for public exports from a folder:

```typescript
// features/runewords/components/index.ts
export { RunewordCard } from './RunewordCard';
export { RunewordFilters } from './RunewordFilters';
```

### Import Order
1. React/external libraries
2. Internal absolute imports (@/)
3. Relative imports
4. Styles

```typescript
import { useState } from 'react';
import { useAppSelector } from '@/core/store';
import { Card } from '@/components/ui/card';
import { Runeword } from '../types';
import { formatStats } from './utils';
```

### Path Aliases
Use path aliases instead of relative imports for cross-folder imports:

| Alias | Path | Use for |
|-------|------|---------|
| `@/components/*` | `src/components/*` | UI components (shadcn/ui) |
| `@/core/*` | `src/core/*` | App infrastructure |
| `@/features/*` | `src/features/*` | Feature modules |
| `@/utils/*` | `src/utils/*` | Shared utilities |
| `@/lib/*` | `src/lib/*` | Third-party configs |
| `@/data/*` | `src/data/*` | Dev HTML fixtures |
| `@/*` | `src/*` | Any other src imports |

```typescript
// Good - use aliases for cross-folder imports
import { Button } from '@/components/ui/button';
import { db } from '@/core/db';
import { useRunewordFilters } from '@/features/runewords/hooks';

// Good - use relative imports within the same feature
import { RunewordCard } from './components/RunewordCard';
import { Runeword } from '../types';

// Avoid - deep relative paths
import { Button } from '../../../components/ui/button';
```

## Redux

### Slice Structure

```typescript
// features/runewords/store/runewordsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface RunewordsState {
  filters: RunewordFilters;
  isLoading: boolean;
  error: string | null;
}

const initialState: RunewordsState = {
  filters: {},
  isLoading: false,
  error: null,
};

const runewordsSlice = createSlice({
  name: 'runewords',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<RunewordFilters>) {
      state.filters = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
  },
});

export const { setFilters, setLoading } = runewordsSlice.actions;
export default runewordsSlice.reducer;
```

### Saga Structure

```typescript
// features/runewords/store/runewordsSaga.ts
import { takeLatest, put, call } from 'redux-saga/effects';
import { setLoading } from './runewordsSlice';

function* fetchRunewordsSaga() {
  yield put(setLoading(true));
  try {
    // ... fetch and parse logic
  } finally {
    yield put(setLoading(false));
  }
}

export function* runewordsSaga() {
  yield takeLatest('runewords/fetch', fetchRunewordsSaga);
}
```

## Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `RunewordCard.tsx` |
| Hooks | camelCase, use prefix | `useRunewordSearch.ts` |
| Utilities | camelCase | `formatStats.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_RUNES` |
| Types/Interfaces | PascalCase | `Runeword` |
| Slices | camelCase + Slice | `runewordsSlice.ts` |
| Sagas | camelCase + Saga | `runewordsSaga.ts` |

## Comments

- Don't comment obvious code
- Do comment complex logic or non-obvious decisions
- Use JSDoc for public APIs/utilities

```typescript
/**
 * Parses runeword data from ESR HTML structure.
 * Expects a table with specific column layout.
 */
function parseRunewordTable(table: HTMLTableElement): Runeword[] {
  // ...
}
```

---

*This document will be updated as new patterns and conventions are established during development.*

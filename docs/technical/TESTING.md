# Testing

## Overview

The project uses [Vitest](https://vitest.dev/) with native ESM support and Vite integration.

## Tech Stack

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner and assertions |
| `@vitest/ui` | Visual UI for interactive testing |
| `@vitest/coverage-v8` | Code coverage |
| `jsdom` | DOM environment |
| `fake-indexeddb` | IndexedDB mock |

## Commands

```bash
npm run test:fixtures    # Fetch test fixtures (required once after checkout)
npm run test             # Run tests once (CI mode)
npm run test:coverage    # Generate coverage report
```

> **Important:** After cloning the repository, run `npm run test:fixtures` at least once to download the HTML fixture files needed for integration tests. These files are not committed to the repository.

## Configuration

- **Environment:** jsdom (browser-like)
- **Globals:** `describe`, `it`, `expect` available without imports
- **Setup:** `src/test/setup.ts` imports `fake-indexeddb/auto`
- **Include:** `src/**/*.test.ts`, `src/**/*.test.tsx`

## File Organization

Tests are colocated with source files using `.test.ts` suffix:

```
features/data-sync/
├── parsers/
│   ├── gemsParser.ts
│   └── gemsParser.test.ts        # Unit tests
└── dataSync.integration.test.ts   # Integration tests
```

## Test Types

### Unit Tests

Test individual functions alongside source files. Focus on inputs/outputs, edge cases.

### Integration Tests

Test full flows at feature level: parse → store → query. Use real HTML fixtures from `public/data/`.

## Key Patterns

### Database Testing

Always clear database before each test:

```typescript
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
```

### Fixture-Based Testing

Integration tests use real HTML files fetched from the ESR documentation site. These files are stored in `test-fixtures/` (gitignored).

**Setup (required once after checkout):**
```bash
npm run test:fixtures
```

This downloads:
- `gems.htm` - Socketables data (gems, runes, crystals)
- `runewords.htm` - Runeword definitions
- `changelogs.html` - Version information

**Loading fixtures in tests:**
```typescript
const html = readFileSync(resolve(__dirname, '../../../test-fixtures/gems.htm'), 'utf-8');
```

### Async Testing

Use `async/await` for database operations and promises.

## Best Practices

**Do:**
- Colocate tests with source files
- Clear database in `beforeEach`
- Use descriptive test names
- Test expected quantities and edge cases

**Don't:**
- Share state between tests
- Test implementation details
- Mock unnecessarily

## Adding New Tests

**Unit tests:** Create `[file].test.ts` alongside source, test function with various inputs.

**Integration tests:** Create `[feature].integration.test.ts`, load fixtures, test full parse → store → query flow.

---

*See [CODING-GUIDELINES.md](./CODING-GUIDELINES.md) for general conventions.*

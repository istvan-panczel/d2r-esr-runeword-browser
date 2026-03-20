# Redux Saga Patterns

## Overview

The project uses Redux Saga for side effects: async workflows, cancellation support, IndexedDB operations, and data processing pipelines.

## Architecture

### Dynamic Saga Registration

Sagas are registered dynamically to avoid circular dependencies between core and features:

```
rootSaga (core/store/rootSaga.ts)
    │
    └── dataSyncSaga (data-sync feature)
```

- `registerSaga(saga)` - Register a feature saga before app starts
- `runSagas()` - Start saga middleware after all registrations
- Feature sagas are registered in `main.tsx`

### Feature Saga Structure

Each feature exports a main saga combining all watchers in `features/[feature]/store/[feature]Saga.ts`.

## Patterns

### Pipeline Pattern

The primary data-sync saga uses this pattern. Each stage dispatches a success action that triggers the next:

```
startupCheck → startupNeedsFetch / startupUseCached
                      ↓
              initDataLoad → fetchHtmlSuccess
                                    ↓
                             parseDataSuccess
                                    ↓
                             storeDataSuccess
                                    ↓
                         extractAffixesSuccess → App Ready
```

**Benefits:** Clear separation, independent error handling per stage, UI can react to intermediate states (loading, parsing, storing).

### Parallel Operations

Use `all()` for independent operations (multiple fetches, database writes):

```typescript
// Fetch all HTML files in parallel
const [gemsHtml, runewordsHtml, uniqueWeaponsHtml, uniqueArmorsHtml, uniqueOthersHtml] = yield all([
  call(fetchGemsHtml),
  call(fetchRunewordsHtml),
  call(fetchUniqueWeaponsHtml),
  call(fetchUniqueArmorsHtml),
  call(fetchUniqueOthersHtml),
]);
```

### Error Handling

Every worker saga uses try/catch with typed error messages:

```typescript
try {
  // side effects
  yield put(successAction(data));
} catch (error) {
  yield put(errorAction(error instanceof Error ? error.message : 'Error'));
}
```

### Wrapping Promises

Use `call()` for async functions and Promise-based APIs (testability, cancellation):

```typescript
yield call(fetchData);
yield call(() => db.table.bulkPut(items));
```

## Effect Types Reference

| Effect | Usage |
|--------|-------|
| `takeLatest` | Cancel previous, run latest (user actions) |
| `takeEvery` | Run all without cancellation (analytics) |
| `all([...])` | Run in parallel |
| `call(fn)` | Call function/Promise |
| `put(action)` | Dispatch action |
| `select(selector)` | Read from Redux store |

## Best Practices

**Do:**
- Use `takeLatest` for user-triggered actions
- Use `all()` for independent parallel operations
- Type payloads with `PayloadAction<T>`
- Handle errors in every worker saga
- Pass data between stages via action payloads

**Don't:**
- Use `takeEvery` unless processing every action is needed
- Put complex logic in sagas - delegate to utility functions
- Read from Redux state when data is in the action payload

## Adding a New Feature Saga

1. Create `features/[feature]/store/[feature]Saga.ts` with worker and watcher sagas
2. Export from `features/[feature]/store/index.ts`
3. Register in `main.tsx`: `registerSaga(featureSaga)`

---

*See [CODING-GUIDELINES.md](./CODING-GUIDELINES.md) for additional Redux conventions.*

# Feature: Gemword Browser

## Overview

Add a new "Gemwords" page that parses gemword recipes (gem-based socket recipes, analogous to runewords) from the ESR documentation, stores them in IndexedDB, and displays them with the same filtering/sharing UX as the runewords browser.

This phase also introduces two pieces of shared infrastructure used by later phases (loot filter, guide database):

- `src/core/hooks/usePersistentState.ts` — generic localStorage-persisted React state with JSON validation
- `src/core/utils/recipeFavorites.ts` — favorite-recipe ID helpers shared by runewords and gemwords

And, since the infrastructure is then available, it adds **recipe favorites to the existing runewords browser** as well.

## Data Source

**URL:** `https://easternsunresurrected.com/gemwords.htm`

**Key facts:**

- Same `tr.recipeRow` table structure as `runewords.htm`: name + sockets in cell 0, ingredients in cell 1, allowed items in cell 2, three per-column bonus cells (3–5: weapons/gloves, helms/boots, armor/shields/belts)
- Ingredients are gems only (validated with `isGemName()` from the gems parser)
- ~590 recipes; many names repeat with different gem qualities → variant counter per name (same pattern as runewords)
- Required level is derived from the highest `reqLevel` among the recipe's gems (gem data from `gems.htm`)

## Data Model

### TypeScript Interface

Add to `src/core/db/models.ts` (mirrors `Runeword`, minus rune-specific fields):

```typescript
export interface Gemword {
  readonly name: string;
  readonly variant: number;
  readonly sockets: number;
  readonly reqLevel: number;
  readonly sortKey: number; // = reqLevel (no tier points for gems)
  readonly gems: readonly string[];
  readonly ingredients: readonly string[]; // same as gems, kept for model symmetry with Runeword
  readonly allowedItems: readonly string[];
  readonly affixes: readonly Affix[]; // first non-empty column (backward-compat pattern)
  readonly columnAffixes: SocketableBonuses; // per-column bonuses
}
```

### IndexedDB Table

`gemwords: '[name+variant], name, sockets, reqLevel, sortKey'` — compound primary key, same as runewords. Requires a Dexie schema version bump in `src/core/db/db.ts`.

## Parser

`src/features/data-sync/parsers/gemwordsParser.ts` — reuses existing runewords/gems parser building blocks:

- `extractName`, `extractSockets`, `extractAllowedItems`, `GemReqLevelLookup` from `runewordsParser.ts`
- `isGemName` from `gemsParser.ts`
- `parseAffixes` from `shared/parserUtils.ts`

Exports: `parseGemwordsHtml(html, gemReqLevelLookup)`, `calculateGemwordReqLevel`, `extractGemwordIngredients`.

Fixture-based tests in `gemwordsParser.test.ts` (requires `gemwords.htm` added to `scripts/fetch-test-fixtures.js`).

## Data Sync Integration

- `src/core/api/remoteConfig.ts` — add `gemwords` URL
- `src/core/api/gemwordsApi.ts` — `fetchGemwordsHtml()`
- `dataSyncSlice.ts` — add `gemwordsHtml` to `FetchedHtmlData`
- `dataSyncSaga.ts` — fetch gemwords.htm in the parallel `all([...])`, parse after runewords (reusing the already-built `gemReqLevelLookup`), `bulkPut` into `db.gemwords`, and include gemword column affixes in `handleExtractAffixes`
- `startupSaga.ts` — migration check: if `db.gemwords.count() === 0`, refetch (same pattern as the mythicalUniques migration)
- `dataCacheVersion.ts` — bump `DATA_CACHE_VERSION` so existing visitors refetch

## UI

### Route & Navigation

- Route `/gemwords`, lazy-loaded (added to `routeCodeSplitting.test.ts` guard list)
- Header nav item "Gemwords" after "Runewords"
- `public/sitemap.xml` entry

### Screen (`src/features/gemwords/`)

Feature folder mirrors runewords:

- **`store/gemwordsSlice.ts`** — searchText, socketCount, maxReqLevel, selectedItemTypes, selectedGems (+ select/deselect/group-toggle reducers, reselect selectors). Registered in `core/store/store.ts`.
- **`hooks/`** — `useFilteredGemwords` (Dexie `useLiveQuery` ordered by `sortKey` + filter pipeline), `useGemGroups` (gems grouped by type, only gems actually used by gemwords), `useGemBonuses` (aggregated per-column gem bonuses for a recipe), `useAvailableItemTypes`, `useUrlInitialize` (URL params > persisted filters > defaults), `useShareUrl`
- **`components/`** — `GemwordFilters` (debounced search/sockets/max-level inputs + copy-link button + per-quality "only" quick-select buttons), `ItemTypeFilter` (grouped checkboxes with group toggles, mirroring the runewords one), `GemCheckboxGroup` (gem checkboxes grouped by gem type with color swatches), `GemwordCard` (gem badges, allowed items, per-column gemword bonuses + aggregated gem bonuses, favorite star)
- **`utils/filteringHelpers.ts`** — pure match functions (search across name/gems/items/affixes, sockets, max level, item types, gem selection — a gemword is hidden if ANY of its gems is deselected) + `buildGemQualitySelection` for the quality quick-select buttons
- **`constants/filterLayout.ts`** — shared grid classes for aligned gem checkbox rows
- Rendering: all filtered cards render at once, same as the uniques and runewords screens (the fork's progressive loading was removed by maintainer decision)
- Gem quality quick-select: "Only quality:" buttons (Chipped/Flawed/.../Perfect) select exactly the gems of that quality and deselect all others (exclusive)

### Filter persistence & sharing

- Filters persist to localStorage (`d2r-esr.gemwords.filters.v1`) and restore on next visit
- URL params (`search`, `sockets`, `maxlvl`, `items`, `gems`) override persisted filters; share URL built like the runewords one
- Favorites: `d2r-esr.gemwords.favoriteRecipes.v1` + show-favorites-only toggle (`d2r-esr.gemwords.showFavoriteRecipesOnly.v1`)

### Shared changes to the runewords feature

- `constants/gemColors.ts` (new): `GEM_BG_COLORS` moved out of `GemBadge.tsx`, plus new `GEM_SWATCH_COLORS` for the gem filter swatches
- `RunewordCard`: optional `isFavorite`/`onToggleFavorite` props + star button
- `RunewordsScreen`: favorites state (`d2r-esr.runewords.favoriteRecipes.v1`) + show-favorites-only toggle
- `useGemGroups` lives in gemwords and reads `GEM_TYPES`/`GEM_QUALITIES` from data-sync constants

## Port Adaptations (from the fork)

- All `translateGameText()` / `buildLocalizedSearchText()` calls removed; search matches plain English text (lowercased)
- `translateCategoryLabel()` replaced by the existing `getCategoryLabel()` from `itemCategoryMapping.ts`
- All UI strings in English, mirroring the runewords browser's wording

## Tasks

1. ~~Spec~~ (this document)
2. Core data layer: `Gemword` model, `gemwords` table (schema bump), `gemwordsApi`, `gemwordsParser` + fixture tests
3. Data-sync integration: saga fetch/parse/store, startup migration check, cache version bump, fixture script
4. Feature folder: slice, hooks, components, screen, utils + tests
5. Shared infra: `usePersistentState` + `recipeFavorites` (+ tests), `gemColors.ts` refactor, runeword favorites
6. Wiring: route (lazy), header nav, store reducer, sitemap, code-splitting guard test
7. Verify: lint, tests, build, manual smoke test

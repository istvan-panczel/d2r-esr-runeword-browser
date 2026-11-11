# Core Data Feature

The core data feature handles fetching HTML sources, parsing game data, and storing it in IndexedDB for offline use.

**Important:** All data is loaded and parsed at app startup, not when individual features are accessed. The app is only ready for use after data loading is complete.

## Data Sources

Data is fetched from the ESR documentation site:

| Data             | URL                                                                         |
| ---------------- | --------------------------------------------------------------------------- |
| Changelog        | `https://easternsunresurrected.com/changelogs.html` (version fallback only) |
| Socketables      | `https://easternsunresurrected.com/gems.htm`                                |
| Runewords        | `https://easternsunresurrected.com/runewords.htm`                           |
| Gemwords         | `https://easternsunresurrected.com/gemwords.htm`                            |
| Unique Weapons   | `https://easternsunresurrected.com/unique_weapons.htm`                      |
| Unique Armors    | `https://easternsunresurrected.com/unique_armors.htm`                       |
| Unique Others    | `https://easternsunresurrected.com/unique_others.htm`                       |
| Mythical Uniques | `https://easternsunresurrected.com/unique_mythicals.htm`                    |
| Ascendancies     | `https://easternsunresurrected.com/ascendancies.htm`                        |

Remote URLs are configured in `src/core/api/remoteConfig.ts`.

**Version Checking** (`fetchLatestVersion` in `src/core/api/versionApi.ts`): the ESR version comes from the mod's
launcher metadata on GitHub, `https://raw.githubusercontent.com/CelestialRayOne/Eastern_Sun_Resurrected/main/d2rloader/metadata.json`
(`metadata.modVersion`, e.g. `3.3`; CORS `*`, cached 5 minutes by GitHub), validated as `X.Y` or `X.Y.Z`. The
changelog page is only a **fallback** when that fetch fails or does not parse: its first header
`Eastern Sun Resurrected X.Y.ZZ - DD/MM/YYYY` (the author stopped adding dated headers there after 3.2.02, so the fallback
can be stale). Both sources failing counts as a network failure. The console logs which source was used
(`[Version] ESR version from mod metadata …` or `… from the changelog page (fallback)`); `EsrVersionInfo.source` says the same.

**Docs freshness:** the data sync reads the `Last-Modified` header of `runewords.htm` (`fetchRunewordsPage`; the site
regenerates every page at once) and stores it as Dexie `metadata.docsLastModified` (ISO). The UI shows
"Docs data: ESR 3.3 (site updated 7 Nov 2026)" (`useDocsDataLine` / `formatDocsDataLine`).

### gems.htm Contents

The gems.htm file contains **5 distinct categories** of socketable items:

| Category        | Items     | Tiers         | Level Range | Description                                                        |
| --------------- | --------- | ------------- | ----------- | ------------------------------------------------------------------ |
| **Gems**        | 8 types   | 6 tiers       | 1-35        | Amethyst, Sapphire, Emerald, Ruby, Diamond, Topaz, Skull, Obsidian |
| **ESR Runes**   | ~50 runes | By color      | 2-60        | I Rune -> Null Rune (ESR-specific runes)                           |
| **LoD Runes**   | 35 runes  | Sequential    | 11-69       | El Rune -> Zod Rune (original D2 runes)                            |
| **Kanji Runes** | ~14 runes | All high-tier | 60          | Moon Rune -> God Rune (thematic runes)                             |
| **Crystals**    | 12 types  | 3 tiers       | 6-42        | Shadow Quartz -> Tainted Tourmaline                                |

Each category is stored in its own Dexie table for clean separation.

## App Startup Flow

All data loading happens at app startup before any feature is accessible. The data sync module itself is loaded dynamically: `main.tsx` renders the app shell (loading UI) first, then `startDataSync()` (`src/core/startup.ts`) imports the data-sync feature, registers its saga, and dispatches `startupCheck` — so the heavy parsing code downloads in parallel with the first paint instead of blocking it (guarded by `src/mainStartup.test.ts`). The data sync saga orchestrates the flow:

```
┌─────────────────────────────────────────┐
│              App Startup                │
│          (show loading UI)              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  startupCheck: Check IndexedDB for     │
│  cached data and stored version         │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Fetch latest ESR version (GitHub mod   │
│  metadata; changelog page as fallback)  │
└─────────────────────────────────────────┘
                    │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│  Network      │    │  Success           │
│  failure      │    │                    │
└───────────────┘    └────────────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│ Has cached    │    │ Compare versions   │
│ data?         │    │                    │
└───────────────┘    └────────────────────┘
    │       │             │           │
   Yes      No        Different     Same
    │       │             │           │
    ▼       ▼             ▼           ▼
┌───────┐ ┌───────┐  ┌───────────┐  ┌───────────┐
│ Use   │ │ Fatal │  │  Fetch    │  │ Use       │
│cached │ │ error │  │  remote   │  │ cached    │
│+ warn │ │ retry │  │  data     │  │ data      │
└───────┘ └───────┘  └───────────┘  └───────────┘
    │                      │              │
    └──────────┬───────────┴──────────────┘
               ▼
┌─────────────────────────────────────────┐
│              App Ready                  │
│   (all features can access data)        │
└─────────────────────────────────────────┘
```

### Startup Pipeline (dataSyncSaga)

When fresh data is needed, the pipeline proceeds through these stages:

```
startupCheck
  → startupNeedsFetch / startupUseCached
    → initDataLoad
      → fetchHtmlSuccess (8 HTML files fetched in parallel)
        → parseDataSuccess (all parsers run)
          → storeDataSuccess (IndexedDB bulk writes)
            → App Ready
```

Each stage dispatches a success action that triggers the next stage, with independent error handling at each step.

### Network Error Handling

| Scenario              | Cached Data? | Behavior                                                |
| --------------------- | ------------ | ------------------------------------------------------- |
| Network error         | Yes          | Show warning (`networkWarning`), use cached data        |
| Force refresh fails   | Yes          | Warning + toast ("Refresh failed: …"), keep cached data |
| Network error         | No           | Show fatal error with retry button                      |
| Version matches       | Yes          | Use cached data immediately                             |
| Version differs       | Yes/No       | Fetch fresh data from remote                            |
| Parse or store throws | Yes          | Warning + toast, use cached data                        |
| Parse or store throws | No           | Show fatal error with retry button                      |

### Store Sanity Check

Parsers return `[]` (or far fewer rows) instead of throwing when the upstream HTML format drifts. Before the store transaction, `handleStoreData` compares each parsed dataset (gems, ESR/LoD/Kanji runes, crystals, runewords, gemwords, unique items, mythical uniques, ascendancies) against the row count already cached in its table. A dataset is **bad** when it parsed empty, or when it has a cache and parsed below 50% of the cached count (`store/storeSanity.ts`). The ascendancy challenges (`ascendancyChallenges`) are deliberately not checked: when the page has no readable challenge section they store empty and the Ascendancies page hides that part.

| Bad datasets   | Cached Data? | Behavior                                                                                                                                  |
| -------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| None           | Yes/No       | Clear and rewrite all tables, write `esrVersion`, `docsLastModified` (when the header was sent), `lastUpdated`, `appVersion`              |
| Some           | Yes          | Write nothing; warning + toast naming the datasets; use cached data. `esrVersion` is unchanged, so the next startup refetches and retries |
| Some (not all) | No           | Store what parsed, write `lastUpdated`/`appVersion` but **not** `esrVersion` (next startup retries); warning + toast; app continues       |
| All            | No           | Fatal store error with retry button                                                                                                       |

The same check applies to a manual force refresh. Warnings from the sanity check and from parse/store failures are shown once as a toast ("See Settings for details.") and kept in `networkWarning` for the Settings drawer; the ordinary offline warning is drawer-only.

## Parsing Order

When a full parse is triggered:

```
1. Fetch all HTML files in parallel:
   - gems.htm
   - gemwords.htm
   - runewords.htm
   - unique_weapons.htm
   - unique_armors.htm
   - unique_others.htm
   - unique_mythicals.htm
   - ascendancies.htm
2. Parse gems.htm:
   a. Extract Gems (8 types x 6 tiers = 48 items)
   b. Extract ESR Runes (~50 items)
   c. Extract LoD Runes (35 items)
   d. Extract Kanji Runes (~14 items)
   e. Extract Crystals (12 types x 3 tiers = 36 items)
3. Parse runewords.htm and gemwords.htm (multi-variant, bonuses, socketable bonus groups, gems; the ESR 3.3 "Bonuses" / "Socketable Bonuses" layout and the older per-category columns, see RUNEWORDS.md "Source layout")
4. Parse unique item pages (weapons, armors, others), mythical uniques, and ascendancies (the cards plus the Tier 1–5 challenges, `parseAscendanciesPage`)
5. Store everything in IndexedDB (separate tables per category)
6. Store version string and timestamp in metadata
7. Signal app ready (storeDataSuccess)
```

## Database

Single IndexedDB database: **`d2r-esr-runeword-browser`** (version 16)

Tables: `gems`, `esrRunes`, `lodRunes`, `kanjiRunes`, `crystals`, `runewords`, `gemwords`, `htmUniqueItems`, `mythicalUniques`, `ascendancies`, `ascendancyChallenges`, `ascendancySections`, `metadata`

Version 15 added `ascendancyChallenges`; its upgrade deletes the stored `appVersion`, so the next online startup refetches and re-parses (existing caches get the challenges without waiting for an app release). Version 16 added `ascendancySections` (the Lich King Bonus, ESR 3.3.04) with the same upgrade, which also drops the stone recipes and `Ascendancy.unlockInputs` that older caches still hold.

ESR 3.3 (new runewords.htm / gemwords.htm layout) needed no Dexie version: `socketableBonuses` is an unindexed field and old rows without it still render. Caches refresh on their own: the old parser read no row of the 3.3 pages, so the sanity check kept the 3.2.24 cache and never wrote the 3.3 `esrVersion` (the next startup refetches), and the release with the new parser changes `appVersion`, which refetches too. A parse that fails the sanity check still never replaces the cache.

The startup check opens the database first via `openDatabase()` (`src/core/db/openDatabase.ts`). If Dexie cannot upgrade the stored schema (`UpgradeError`, e.g. a very old install with a different primary key) or the stored version is newer (`VersionError`), the database is deleted and recreated empty; it is only a cache, so the startup check then refetches everything.

See [DATA-MODELS.md](../technical/DATA-MODELS.md) for the full schema.

## Data Models

All socketable items share a common bonus structure with three categories:

- Weapons / Gloves
- Helms / Boots
- Armor / Shields / Belts

### Gem

```typescript
interface Gem {
  readonly name: string; // Primary key. "Chipped Ruby", "Perfect Sapphire"
  readonly type: GemType; // "Amethyst", "Sapphire", etc.
  readonly quality: GemQuality; // "Chipped", "Flawed", etc.
  readonly color: string; // Color string
  readonly reqLevel: number; // Required level (1-35)
  readonly bonuses: SocketableBonuses;
}

type GemType = 'Amethyst' | 'Sapphire' | 'Emerald' | 'Ruby' | 'Diamond' | 'Topaz' | 'Skull' | 'Obsidian';
type GemQuality = 'Chipped' | 'Flawed' | 'Standard' | 'Flawless' | 'Blemished' | 'Perfect';
```

**Gem Tiers (6 levels):**

| Quality   | Req Level |
| --------- | --------- |
| Chipped   | 1         |
| Flawed    | 7         |
| Standard  | 14        |
| Flawless  | 21        |
| Blemished | 28        |
| Perfect   | 35        |

### ESR Rune

```typescript
interface EsrRune {
  readonly name: string; // Primary key. "I Rune", "Ka Rune"
  readonly order: number; // Order in source file (1-based)
  readonly tier: number; // Derived from color
  readonly color: string; // HTML color attribute
  readonly reqLevel: number; // Required level (2-60)
  readonly points?: number; // Rune points from "(X points)" suffix
  readonly bonuses: SocketableBonuses;
}
```

### LoD Rune

```typescript
interface LodRune {
  readonly name: string; // Primary key. "El Rune" -> "Zod Rune"
  readonly order: number; // Position in sequence (1-35)
  readonly tier: number; // 1=Low (El-Dol), 2=Mid (Hel-Gul), 3=High (Vex-Zod)
  readonly reqLevel: number; // Required level (11-69)
  readonly points?: number; // Rune points from "(X points)" suffix
  readonly bonuses: SocketableBonuses;
}
```

### Kanji Rune

```typescript
interface KanjiRune {
  readonly name: string; // Primary key. "Moon Rune", "God Rune"
  readonly reqLevel: number; // All level 60
  readonly bonuses: SocketableBonuses;
}
```

### Crystal

```typescript
interface Crystal {
  readonly name: string; // Primary key. "Chipped Shadow Quartz"
  readonly type: CrystalType; // Base crystal type
  readonly quality: CrystalQuality; // "Chipped", "Flawed", "Standard"
  readonly color: string; // Each type has unique color
  readonly reqLevel: number; // Required level (6, 24, 42)
  readonly bonuses: SocketableBonuses;
}
```

### Shared Types

```typescript
interface SocketableBonuses {
  readonly weaponsGloves: readonly Affix[];
  readonly helmsBoots: readonly Affix[];
  readonly armorShieldsBelts: readonly Affix[];
}

interface Affix {
  readonly rawText: string;
  readonly pattern: string;
  readonly value: number | readonly [number, number] | null;
  readonly valueType: 'flat' | 'percent' | 'range' | 'none';
}
```

## Data Refresh Strategy

### Automatic Refresh

On app startup, the app automatically:

1. Fetches the latest ESR version (GitHub `d2rloader/metadata.json`, changelog page as fallback)
2. Compares with the stored version in IndexedDB
3. Re-fetches data only if versions differ

### Manual Refresh

A "Force Refresh Data" button in Settings allows users to bypass version checking and always re-fetch (`initDataLoad({ force: true })`).

### Offline Support

The app uses IndexedDB as a client-side cache:

- If network is unavailable but cached data exists, a warning is shown and cached data is used
- If network is unavailable and no cached data exists, a fatal error is shown with a retry button

## Implementation Notes

### HTML Parsing with DOMParser

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(htmlString, 'text/html');

// Example: Extract rune color
const fontElement = runeRow.querySelector('font[color]');
const color = fontElement?.getAttribute('color') || 'WHITE';
```

### Splitting Cells into Affix / Property Lines

Affix and property cells list one entry per visual line, separated by `<br>`. All parsers share the
helpers in `parsers/shared/parserUtils.ts` instead of splitting `innerHTML` on `<br>`:

- `extractCellLines(cell)` walks the DOM (text nodes + `<br>` elements) and returns one `CellLine`
  (`{ text, orange }`) per visual line. `orange` is true when the text sits inside a
  `<font color="orange">` element (attribute value matched case-insensitively, quoted or not) — even
  when that font spans several `<br>`-separated lines or starts with a `<br>`. The mythical uniques
  parser uses this flag to route every orange line to `specialProperties` and the rest to `properties`.
  Each line also goes through `fillUnformattedBleedDuration`: the ESR 3.3 pages print the bleed string's format unfilled
  ("Adds 25%-50% Bleed Damage over %.2f seconds", 84 lines on the runeword and unique pages; an upstream docs-generator
  slip, the txt-generated bundles have the number), and the duration differs per item (0.60 to 20 seconds), so the line
  reads "… Bleed Damage over time" instead of a number the page does not give.
- `splitCellLineGroups(lines)` splits on `<br><br>` (recipe bonuses vs. ingredient bonuses in the
  pre-ESR 3.3 runeword/gemword cells; `parseRecipeAffixes` keeps only the first group). Since ESR 3.2, gemword
  cells for most non-Charm items also list "1-2 of the following:" random bonus pools between the two;
  `parseRecipeBonusPools` returns every group between the first and last non-empty group that starts
  with an "… of the following:" header (stored as `Gemword.columnBonusPools`). The ESR 3.3 "Bonuses" cell has
  no trailing ingredient group: `parseRecipeBonusesCell` keeps every pool group as a pool and every other group
  as the recipe's bonuses; `parseSocketableBonusGroups` reads the "Socketable Bonuses" cell (one plain list or
  one `.rws-group` per `.rws-label`), `parseSocketableGroupLabel` splits a label into item types with their own
  "(except …)" lists. `shared/recipeRowBonuses.ts` picks the layout per row (6 cells: old, 5: 3.3).
- `mergeWrappedCellLines(lines)` / `mergeWrappedLines(strings)` re-join affixes that the ESR pages
  hard-wrap with `<br>` mid-sentence (mostly long orange "special" affixes, e.g. Obsession, Death
  Cleaver, Tal Rasha's Final Whisper).

**Line-merge heuristic** (`isWrappedContinuation(previous, next)`): a line is appended (with a single
space) to the previous line when

1. it starts with a lowercase letter (`…to Attacks` ⏎ `per 4 Dexterity`), or
2. the previous line ends with a comma, or
3. the previous line ends with a lowercase function word: conjunctions (`and or but when while if
than that as`), prepositions (`with per to of for from by in on at into during after before until
against upon over under within without`) or determiners (`the a an your all each every no not`).
   The match is case-sensitive so Title Case affix endings never trigger it; `you` is deliberately
   excluded ("…and return to you"). The list is intentionally limited to function words: a handful
   of upstream wraps after a verb ("…attacks deal" ⏎ "10 additional damage") stay split rather than
   growing an item-tuned word list.

Lines are never merged across an orange/non-orange boundary or across an empty line (`<br><br>`).
An orange block is not always one affix — e.g. Imperius' Undying Wrath has four orange lines that
form three statements; only the hard-wrapped pair is joined. Known limits: a wrap where the previous
line ends in a capitalised noun and the next line starts uppercase (Aegis of Corruption: "…your Direct
Damage" ⏎ "Spells that have…") stays split, and Mosaic's orange lines, which are in reversed order
upstream, are intentionally left as two lines.

### Ascendancies Page (ascendancies.htm)

`parseAscendanciesPage(html)` (`parsers/ascendanciesParser.ts`) returns `{ ascendancies, challenges, sections }`;
`parseAscendancies(html)` is the cards-only wrapper (used by `scripts/check-user-data.ts`).

- **Cards**: one flex `<div>` per ascendancy (name, image, `Tier N` bonus groups, `<font size="-2">` footnotes).
- **Challenges**: every `<h3>Tier N Challenge</h3>` (after `<a name="challenge">`) is followed by a one-cell
  description table. The description becomes plain-text paragraphs (one per `<br>` line, emphasis dropped,
  hard-wrapped lines re-joined with `mergeWrappedLines`). The table is the first one up to the next heading (also
  inside a wrapper element). A heading with no description is skipped. Since ESR 3.3.04 the page has no recipe tables:
  the Orb of Creation unlocks the ascendancy panel (Tier 1) and the later tiers unlock on the kills, so there are no
  stone recipes or per-card unlock gems any more.
- **Sections**: any other `<h3>` with a description table (not a "…Challenge" heading) becomes
  `{ title, order, description }` in page order, the first of a repeated title only. At ESR 3.3.04 that is the
  "Lich King Bonus". The cards' "Ascendancies" heading has no table and is skipped.
- **Degradation**: challenge parsing never affects the cards: a missing or reshaped section yields fewer (or no)
  challenges and sections, and an unexpected exception is caught and logged (both `[]`). The Ascendancies page then
  shows only the fixed summary, the orb locations and the links in its how-to panel.
- **Page panel**: the Ascendancies page shows these in a collapsible "How to unlock an ascendancy and its tiers"
  panel above the filters (open by default, the state kept in localStorage `ascendancies.howToOpen`): a fixed summary
  (cube the orbs into the Orb of Creation, use it to unlock the ascendancy panel, pick one; tiers 2–5 unlock by
  themselves), the orb table, the parsed tier steps and the sections (Lich King Bonus). Its "Orb locations (Hell)"
  table is **not** parsed (the official page does not say where the orbs drop): it is the static
  `ORB_LOCATIONS` in `src/features/ascendancies/data/orbLocations.ts`, checked in game, with the levels.txt area ids
  for the campaign map links; `orbLocations.test.ts` checks the superuniques against `sources.json` and the area ids
  and names against `areas.json` and the campaign map, so an ESR update that moves an orb fails the test suite. Orbs
  and the Primordial Soulstone link to the official Drop Finder (the plain page, like the guide's `dropfinder:` links).

### Test Fixtures

Integration tests use real HTML files fetched from the ESR site. Run `npm run test:fixtures` once after checkout to download fixtures to `test-fixtures/` (gitignored).

## Feature Location

```
src/
├── core/
│   ├── api/
│   │   ├── remoteConfig.ts        # Remote URLs configuration
│   │   ├── versionApi.ts          # Latest ESR version: GitHub mod metadata, changelog fallback
│   │   ├── gemsApi.ts             # Fetch gems.htm
│   │   ├── gemwordsApi.ts         # Fetch gemwords.htm
│   │   ├── runewordsApi.ts        # Fetch runewords.htm (+ its Last-Modified header)
│   │   ├── htmUniqueItemsApi.ts   # Fetch unique_weapons/armors/others.htm
│   │   ├── mythicalUniquesApi.ts  # Fetch unique_mythicals.htm
│   │   └── ascendanciesApi.ts     # Fetch ascendancies.htm
│   ├── db/
│   │   ├── db.ts                  # Dexie database instance
│   │   ├── openDatabase.ts        # Open/upgrade with delete-and-recreate fallback
│   │   └── models.ts              # Type definitions
│   └── utils/
│       └── versionUtils.ts        # Version comparison utilities
└── features/
    └── data-sync/                 # Data parsing feature
        ├── store/
        │   ├── dataSyncSlice.ts   # State management with startup/error states
        │   ├── dataSyncSaga.ts    # Main saga orchestration (pipeline)
        │   ├── storeSanity.ts     # Pre-store plausibility check of parsed datasets
        │   ├── cacheStatus.ts     # Cached table counts / completeness checks
        │   └── startupSaga.ts     # Startup version checking logic
        ├── parsers/
        │   ├── gemsParser.ts            # Parse gems from gems.htm
        │   ├── esrRunesParser.ts        # Parse ESR runes
        │   ├── lodRunesParser.ts        # Parse LoD runes
        │   ├── kanjiRunesParser.ts      # Parse Kanji runes
        │   ├── crystalsParser.ts        # Parse crystals
        │   ├── runewordsParser.ts       # Parse runewords.htm
        │   ├── gemwordsParser.ts        # Parse gemwords.htm
        │   ├── htmUniqueItemsParser.ts  # Parse unique item pages
        │   ├── mythicalUniquesParser.ts # Parse unique_mythicals.htm
        │   ├── ascendanciesParser.ts    # Parse ascendancies.htm
        │   └── shared/
        │       ├── extractSocketableNames.ts
        │       └── parserUtils.ts
        ├── constants/
        │   ├── constants.ts
        │   └── defaultRunePoints.ts
        └── interfaces/
            └── ParsedData.ts
```

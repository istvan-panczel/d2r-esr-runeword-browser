# Core Data Feature

The core data feature handles fetching HTML sources, parsing game data, and storing it in IndexedDB for offline use.

**Important:** All data is loaded and parsed at app startup, not when individual features are accessed. The app is only ready for use after data loading is complete.

## Data Sources

Data is fetched from the ESR documentation site:

| Data | URL |
|------|-----|
| Changelog | `https://easternsunresurrected.com/changelogs.html` |
| Socketables | `https://easternsunresurrected.com/gems.htm` |
| Runewords | `https://easternsunresurrected.com/runewords.htm` |
| Unique Weapons | `https://easternsunresurrected.com/unique_weapons.htm` |
| Unique Armors | `https://easternsunresurrected.com/unique_armors.htm` |
| Unique Others | `https://easternsunresurrected.com/unique_others.htm` |

Remote URLs are configured in `src/core/api/remoteConfig.ts`.

**Version Checking:** The version is extracted from the changelog page using the pattern: `Eastern Sun Resurrected X.Y.ZZ - DD/MM/YYYY`

### gems.htm Contents

The gems.htm file contains **5 distinct categories** of socketable items:

| Category | Items | Tiers | Level Range | Description |
|----------|-------|-------|-------------|-------------|
| **Gems** | 8 types | 6 tiers | 1-35 | Amethyst, Sapphire, Emerald, Ruby, Diamond, Topaz, Skull, Obsidian |
| **ESR Runes** | ~50 runes | By color | 2-60 | I Rune -> Null Rune (ESR-specific runes) |
| **LoD Runes** | 35 runes | Sequential | 11-69 | El Rune -> Zod Rune (original D2 runes) |
| **Kanji Runes** | ~14 runes | All high-tier | 60 | Moon Rune -> God Rune (thematic runes) |
| **Crystals** | 12 types | 3 tiers | 6-42 | Shadow Quartz -> Tainted Tourmaline |

Each category is stored in its own Dexie table for clean separation.

## App Startup Flow

All data loading happens at app startup before any feature is accessible. The data sync saga orchestrates the flow:

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
│  Fetch changelog from remote server     │
│  (extract latest version)               │
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
      → fetchHtmlSuccess (5 HTML files fetched in parallel)
        → parseDataSuccess (all parsers run)
          → storeDataSuccess (IndexedDB bulk writes)
            → extractAffixesSuccess (affix patterns extracted)
              → App Ready
```

Each stage dispatches a success action that triggers the next stage, with independent error handling at each step.

### Network Error Handling

| Scenario | Cached Data? | Behavior |
|----------|--------------|----------|
| Network error | Yes | Show warning (`networkWarning`), use cached data |
| Network error | No | Show fatal error with retry button |
| Version matches | Yes | Use cached data immediately |
| Version differs | Yes/No | Fetch fresh data from remote |

## Parsing Order

When a full parse is triggered:

```
1. Fetch all HTML files in parallel:
   - gems.htm
   - runewords.htm
   - unique_weapons.htm
   - unique_armors.htm
   - unique_others.htm
2. Parse gems.htm:
   a. Extract Gems (8 types x 6 tiers = 48 items)
   b. Extract ESR Runes (~50 items)
   c. Extract LoD Runes (35 items)
   d. Extract Kanji Runes (~14 items)
   e. Extract Crystals (12 types x 3 tiers = 36 items)
3. Parse runewords.htm (multi-variant, per-column bonuses, gems)
4. Parse unique item pages (weapons, armors, others)
5. Normalize all affixes and extract patterns
6. Store everything in IndexedDB (separate tables per category)
7. Store version string and timestamp in metadata
8. Signal app ready (extractAffixesSuccess)
```

## Database

Single IndexedDB database: **`d2r-esr-runeword-browser`** (version 10)

Tables: `gems`, `esrRunes`, `lodRunes`, `kanjiRunes`, `crystals`, `runewords`, `affixes`, `htmUniqueItems`, `metadata`

See [DATA-MODELS.md](../technical/DATA-MODELS.md) for the full schema.

## Data Models

All socketable items share a common bonus structure with three categories:
- Weapons / Gloves
- Helms / Boots
- Armor / Shields / Belts

### Gem

```typescript
interface Gem {
  readonly name: string;             // Primary key. "Chipped Ruby", "Perfect Sapphire"
  readonly type: GemType;            // "Amethyst", "Sapphire", etc.
  readonly quality: GemQuality;      // "Chipped", "Flawed", etc.
  readonly color: string;            // Color string
  readonly reqLevel: number;         // Required level (1-35)
  readonly bonuses: SocketableBonuses;
}

type GemType = 'Amethyst' | 'Sapphire' | 'Emerald' | 'Ruby' | 'Diamond' | 'Topaz' | 'Skull' | 'Obsidian';
type GemQuality = 'Chipped' | 'Flawed' | 'Standard' | 'Flawless' | 'Blemished' | 'Perfect';
```

**Gem Tiers (6 levels):**
| Quality | Req Level |
|---------|-----------|
| Chipped | 1 |
| Flawed | 7 |
| Standard | 14 |
| Flawless | 21 |
| Blemished | 28 |
| Perfect | 35 |

### ESR Rune

```typescript
interface EsrRune {
  readonly name: string;             // Primary key. "I Rune", "Ka Rune"
  readonly order: number;            // Order in source file (1-based)
  readonly tier: number;             // Derived from color
  readonly color: string;            // HTML color attribute
  readonly reqLevel: number;         // Required level (2-60)
  readonly points?: number;          // Rune points from "(X points)" suffix
  readonly bonuses: SocketableBonuses;
}
```

### LoD Rune

```typescript
interface LodRune {
  readonly name: string;             // Primary key. "El Rune" -> "Zod Rune"
  readonly order: number;            // Position in sequence (1-35)
  readonly tier: number;             // 1=Low (El-Dol), 2=Mid (Hel-Gul), 3=High (Vex-Zod)
  readonly reqLevel: number;         // Required level (11-69)
  readonly points?: number;          // Rune points from "(X points)" suffix
  readonly bonuses: SocketableBonuses;
}
```

### Kanji Rune

```typescript
interface KanjiRune {
  readonly name: string;             // Primary key. "Moon Rune", "God Rune"
  readonly reqLevel: number;         // All level 60
  readonly bonuses: SocketableBonuses;
}
```

### Crystal

```typescript
interface Crystal {
  readonly name: string;             // Primary key. "Chipped Shadow Quartz"
  readonly type: CrystalType;        // Base crystal type
  readonly quality: CrystalQuality;  // "Chipped", "Flawed", "Standard"
  readonly color: string;            // Each type has unique color
  readonly reqLevel: number;         // Required level (6, 24, 42)
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
1. Fetches the changelog to get the latest version
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

### Test Fixtures

Integration tests use real HTML files fetched from the ESR site. Run `npm run test:fixtures` once after checkout to download fixtures to `test-fixtures/` (gitignored).

## Feature Location

```
src/
├── core/
│   ├── api/
│   │   ├── remoteConfig.ts        # Remote URLs configuration
│   │   ├── changelogApi.ts        # Fetch and parse version from changelog
│   │   ├── gemsApi.ts             # Fetch gems.htm
│   │   ├── runewordsApi.ts        # Fetch runewords.htm
│   │   └── htmUniqueItemsApi.ts   # Fetch unique_*.htm pages
│   ├── db/
│   │   ├── db.ts                  # Dexie database instance
│   │   └── models.ts              # Type definitions
│   └── utils/
│       └── versionUtils.ts        # Version comparison utilities
└── features/
    └── data-sync/                 # Data parsing feature
        ├── store/
        │   ├── dataSyncSlice.ts   # State management with startup/error states
        │   ├── dataSyncSaga.ts    # Main saga orchestration (pipeline)
        │   └── startupSaga.ts     # Startup version checking logic
        ├── parsers/
        │   ├── gemsParser.ts            # Parse gems from gems.htm
        │   ├── esrRunesParser.ts        # Parse ESR runes
        │   ├── lodRunesParser.ts        # Parse LoD runes
        │   ├── kanjiRunesParser.ts      # Parse Kanji runes
        │   ├── crystalsParser.ts        # Parse crystals
        │   ├── runewordsParser.ts       # Parse runewords.htm
        │   ├── htmUniqueItemsParser.ts  # Parse unique item pages
        │   └── shared/
        │       ├── extractSocketableNames.ts
        │       └── parserUtils.ts
        ├── constants/
        │   ├── constants.ts
        │   └── defaultRunePoints.ts
        └── interfaces/
            └── ParsedData.ts
```

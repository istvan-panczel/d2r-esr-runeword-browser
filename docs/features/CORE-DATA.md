# Core Data Feature

The core data feature handles parsing HTML sources, extracting game data, and storing it in IndexedDB for offline use.

**Important:** All data is loaded and parsed at app startup, not when individual features are accessed. The app is only ready for use after data loading is complete.

## Data Sources

Data is fetched from the official ESR documentation site:

| Data | URL |
|------|-----|
| Changelog | `https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs/changelogs.html` |
| Socketables | `https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs/gems.htm` |
| Runewords | `https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs/runewords.htm` |

**Version Checking:** The version is extracted from the changelog page using the pattern: `Eastern Sun Resurrected X.Y.ZZ - DD/MM/YYYY`

**Local Files (for testing):** Local copies are kept in `public/data/` for integration testing purposes only.

### gems.htm Contents

The gems.htm file contains **5 distinct categories** of socketable items:

| Category | Items | Tiers | Level Range | Description |
|----------|-------|-------|-------------|-------------|
| **Gems** | 8 types | 6 tiers | 1-35 | Amethyst, Sapphire, Emerald, Ruby, Diamond, Topaz, Skull, Obsidian |
| **ESR Runes** | ~50 runes | By color | 2-60 | I Rune → Null Rune (ESR-specific runes) |
| **LoD Runes** | 35 runes | Sequential | 11-69 | El Rune → Zod Rune (original D2 runes) |
| **Kanji Runes** | ~14 runes | All high-tier | 60 | Moon Rune → God Rune (thematic runes) |
| **Crystals** | 12 types | 3 tiers | 6-42 | Shadow Quartz → Tainted Tourmaline |

Each category is stored in its own Dexie table for clean separation.

## App Startup Flow

All data loading happens at app startup before any feature is accessible. The app checks the remote changelog for version updates:

```
┌─────────────────────────────────────────┐
│              App Startup                │
│          (show loading UI)              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Check IndexedDB for cached data        │
│  and stored version                     │
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

### Network Error Handling

| Scenario | Cached Data? | Behavior |
|----------|--------------|----------|
| Network error | Yes | Show warning, use cached data |
| Network error | No | Show fatal error with retry button |
| Version matches | Yes | Use cached data immediately |
| Version differs | Yes/No | Fetch fresh data from remote |

## Parsing Order

When a full parse is triggered:

```
1. Fetch gems.htm from remote server:
   a. Extract Gems (8 types × 6 tiers = 48 items)
   b. Extract ESR Runes (I Rune → Null Rune, ~50 items)
   c. Extract LoD Runes (El Rune → Zod Rune, 35 items)
   d. Extract Kanji Runes (Moon Rune → God Rune, ~14 items)
   e. Extract Crystals (12 types × 3 tiers = 36 items)
2. Fetch and parse runewords.htm from remote server
3. Normalize all affixes
4. Store everything in IndexedDB (separate tables per category)
5. Store version string and timestamp in metadata
6. Signal app ready
```

## Data Models

All socketable items share a common bonus structure with three categories:
- Weapons / Gloves
- Helms / Boots
- Armor / Shields / Belts

### Gem

```typescript
interface Gem {
  id: string;                    // Generated unique ID
  name: string;                  // "Chipped Ruby", "Perfect Sapphire"
  type: GemType;                 // "Amethyst", "Sapphire", etc.
  quality: GemQuality;           // "Chipped", "Flawed", etc.
  reqLevel: number;              // Required level (1-35)
  bonuses: SocketableBonuses;
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
  id: string;                    // Generated unique ID
  name: string;                  // "I Rune", "Ka Rune", "Null Rune"
  tier: number;                  // Derived from color (parsed from HTML)
  color: string;                 // HTML color attribute (determines tier)
  reqLevel: number;              // Required level (2-60)
  bonuses: SocketableBonuses;
}
```

**Tier Derivation:** Parse the `color` attribute from HTML `<font color="...">` tags. Runes with the same color belong to the same tier.

### LoD Rune

```typescript
interface LodRune {
  id: string;                    // Generated unique ID
  name: string;                  // "El Rune", "Eld Rune", ..., "Zod Rune"
  order: number;                 // Position in sequence (1-35)
  reqLevel: number;              // Required level (11-69)
  bonuses: SocketableBonuses;
}
```

**Note:** LoD runes are the original Diablo 2 runes. Order is sequential from El (1) to Zod (35).

### Kanji Rune

```typescript
interface KanjiRune {
  id: string;                    // Generated unique ID
  name: string;                  // "Moon Rune", "Fire Rune", ..., "God Rune"
  reqLevel: number;              // All are level 60
  bonuses: SocketableBonuses;
}
```

**Note:** All Kanji runes are high-level (60) and share the "+1 to All Skills" affix.

### Crystal

```typescript
interface Crystal {
  id: string;                    // Generated unique ID
  name: string;                  // "Chipped Shadow Quartz", "Flawed Burning Sulphur"
  type: CrystalType;             // Base crystal type
  quality: CrystalQuality;       // "Chipped", "Flawed", or standard (no prefix)
  color: string;                 // Each crystal type has its own color
  reqLevel: number;              // Required level (6, 24, or 42)
  bonuses: SocketableBonuses;
}

type CrystalType =
  | 'Shadow Quartz' | 'Frozen Soul' | 'Bleeding Stone' | 'Burning Sulphur'
  | 'Dark Azurite' | 'Bitter Peridot' | 'Pulsing Opal' | 'Enigmatic Cinnabar'
  | 'Tomb Jade' | 'Solid Mercury' | 'Storm Amber' | 'Tainted Tourmaline';

type CrystalQuality = 'Chipped' | 'Flawed' | 'Standard';
```

**Crystal Tiers (3 levels):**
| Quality | Req Level |
|---------|-----------|
| Chipped | 6 |
| Flawed | 24 |
| Standard | 42 |

### Shared Types

```typescript
interface SocketableBonuses {
  weaponsGloves: Affix[];        // Bonuses when used in weapons/gloves
  helmsBoots: Affix[];           // Bonuses when used in helms/boots
  armorShieldsBelts: Affix[];    // Bonuses when used in armor/shields/belts
}
```

### Runeword

```typescript
interface Runeword {
  id: string;                    // Generated unique ID
  name: string;                  // "Stone", "Spirit"
  sockets: number;               // Number of sockets required
  runes: string[];               // Ordered array of rune names
  allowedItems: string[];        // "Any Armor", "Weapon", "Shield"
  affixes: Affix[];              // What the runeword itself gives
}
```

**Important:** The runeword's `affixes` are separate from what the individual runes contribute. When displaying a runeword, you need to:
1. Show the runeword's own affixes
2. Look up each rune and show their bonuses based on item type

### Affix

```typescript
interface Affix {
  id: string;                    // Generated unique ID
  rawText: string;               // "+100 Defense"
  pattern: string;               // "+# Defense"
  value: number | null;          // 100 (null if no numeric value)
  valueType: 'flat' | 'percent' | 'range' | 'none';
}
```

**Normalization Examples:**

| Raw Text | Pattern | Value | Type |
|----------|---------|-------|------|
| +100 Defense | +# Defense | 100 | flat |
| +15% Enhanced Damage | +#% Enhanced Damage | 15 | percent |
| Physical Resist: +10% | Physical Resist: +#% | 10 | percent |
| +5 to Mana after each Kill | +# to Mana after each Kill | 5 | flat |
| Cannot Be Frozen | Cannot Be Frozen | null | none |
| Adds 10-20 Fire Damage | Adds #-# Fire Damage | [10, 20] | range |

## Data Refresh Strategy

### Automatic Refresh

On app startup, the app automatically:
1. Fetches the changelog to get the latest version
2. Compares with the stored version in IndexedDB
3. Re-fetches data only if versions differ

This ensures users always have the latest data while minimizing unnecessary network requests.

### Manual Refresh

A "Force Refresh Data" button in Settings allows users to bypass version checking and always re-fetch. This is useful if:
- The user suspects data corruption
- The changelog version format changes
- Development/debugging purposes

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

### Local Data Files (Testing Only)

The repository includes pre-downloaded HTML data files in `public/data/` for integration testing:

```
public/data/
├── gems.htm           # Gems, runes (ESR/LoD/Kanji), crystals
├── runewords.htm      # All runeword definitions
└── data-version.txt   # Version string for test reference
```

**Note:** These files are NOT used by the production app. The app fetches data from the remote ESR documentation site.

## Feature Location

```
src/
├── core/
│   ├── api/
│   │   ├── remoteConfig.ts      # Remote URLs configuration
│   │   ├── changelogApi.ts      # Fetch and parse version from changelog
│   │   ├── gemsApi.ts           # Fetch gems.htm from remote
│   │   └── runewordsApi.ts      # Fetch runewords.htm from remote
│   ├── db/
│   │   ├── index.ts             # Dexie database instance
│   │   └── models/              # Type definitions
│   └── utils/
│       └── versionUtils.ts      # Version comparison utilities
└── features/
    └── data-sync/               # Data parsing feature
        ├── store/
        │   ├── dataSyncSlice.ts # State management with startup/error states
        │   ├── dataSyncSaga.ts  # Main saga orchestration
        │   └── startupSaga.ts   # Startup version checking logic
        ├── parsers/
        │   ├── gemsParser.ts          # Parse gems from gems.htm
        │   ├── esrRunesParser.ts      # Parse ESR runes
        │   ├── lodRunesParser.ts      # Parse LoD runes
        │   ├── kanjiRunesParser.ts    # Parse Kanji runes
        │   ├── crystalsParser.ts      # Parse crystals
        │   └── runewordsParser.ts     # Parse runewords.htm
        └── types/
            └── index.ts
```

---

## TXT-Based Data System (Experimental)

A new data parsing system is being developed to replace HTM parsing. It uses original D2R game data files in TSV format, providing access to more complete data including unique items, sets, and gemwords.

### Why TXT-Based Data?

| Aspect | HTM-based | TXT-based |
|--------|-----------|-----------|
| **Source** | ESR documentation site | D2R game files |
| **Format** | HTML tables | TSV (Tab-Separated Values) |
| **Runewords** | ~386 | ~997 (includes gemwords) |
| **Unique Items** | ❌ Not available | ✅ 1134 items |
| **Sets** | ❌ Not available | ✅ 70 sets, 245 items |
| **Properties** | Embedded in affixes | 251 with tooltips |
| **Reliability** | Depends on remote site | Local files |

### TXT Files Used

Located in `public/txt/` (served via HTTP):

| File | Purpose | Records |
|------|---------|---------|
| `properties.txt` | Property code → tooltip mapping | 251 |
| `gems.txt` | Socketable definitions (gems, runes) | 178 |
| `runes.txt` | Runeword/Gemword definitions | 997 |
| `uniqueitems.txt` | Unique item definitions | 1134 |
| `sets.txt` | Set definitions | 70 |
| `setitems.txt` | Set item components | 245 |
| `weapons.txt` | Base weapons (item code → type mapping) | ~500 |
| `armor.txt` | Base armor (item code → type mapping) | ~300 |
| `misc.txt` | Misc items (item code → type mapping) | ~400 |
| `itemtypes.txt` | Item type hierarchy | ~180 |
| `cubemain.txt` | Cube recipes (Ancient Coupon detection) | ~1500 |

### Database

The TXT-based system uses a separate IndexedDB database:

- **Database name**: `d2r-esr-txt-data`
- **Instance**: `src/core/db/txtDb.ts`

This keeps TXT data isolated from HTM data during the transition period.

### Data Loading

Unlike HTM data which loads at app startup, TXT data is loaded on-demand:

1. User clicks "Parse TXT Files" button in Settings
2. Saga fetches TXT files via HTTP from `public/txt/`
3. Parsers convert TSV to structured data
4. Data is stored in `d2r-esr-txt-data` IndexedDB
5. Subsequent visits use cached data (unless force refresh)

### Key Data Types

#### TxtRuneword / Gemword

```typescript
interface TxtRuneword {
  id: string;              // "Runeword1", "Runeword123"
  displayName: string;     // "Holy", "Spirit"
  complete: boolean;       // Whether enabled
  itemTypes: string[];     // Allowed item type codes
  excludeTypes: string[];  // Excluded item type codes
  runes: TxtRuneRef[];     // Socketable references (runes OR gems)
  properties: TxtProperty[];
}

interface TxtRuneRef {
  code: string;   // Gem code from gems.txt (e.g., "r01", "gcw")
  name: string;   // Resolved name (e.g., "El Rune", "Chipped Diamond")
}
```

**Note**: Gemwords are runewords that use gems instead of runes. They share the same data structure but can be identified by their `runes` array containing gem codes (e.g., "gcv" for Chipped Amethyst) rather than rune codes.

#### TxtUniqueItem

```typescript
interface TxtUniqueItem {
  id: number;              // Unique numeric ID
  index: string;           // Display name
  version: number;
  enabled: boolean;
  level: number;
  levelReq: number;
  itemCode: string;        // Base item code
  itemName: string;        // Base item display name
  properties: TxtProperty[];
  isAncientCoupon: boolean; // True if obtained via Ancient Coupon (not droppable)
}
```

#### TxtProperty

```typescript
interface TxtProperty {
  code: string;   // Property code (e.g., "str", "dmg%")
  param: string;  // Parameter (skill name, etc.)
  min: number;
  max: number;
}
```

### Property Translation

The `PropertyTranslator` class converts property codes to human-readable text:

```typescript
const translator = createPropertyTranslator(properties);

// Input: { code: "str", param: "", min: 10, max: 15 }
// Output: { text: "+10-15 to Strength", ... }

// Input: { code: "oskill", param: "Teleport", min: 1, max: 1 }
// Output: { text: "+1 to Teleport", ... }
```

### Feature Location

```
src/
├── core/
│   ├── api/
│   │   └── txtApi.ts           # Fetch TXT files via HTTP
│   ├── db/
│   │   ├── txtDb.ts            # TXT database instance
│   │   └── txtModels.ts        # TXT data type definitions
│   └── utils/
│       └── tsvParser.ts        # Generic TSV parser
└── features/
    └── txt-data/               # TXT data feature
        ├── store/
        │   ├── txtDataSlice.ts # State management
        │   └── txtDataSaga.ts  # Data loading orchestration
        ├── parsers/
        │   ├── propertiesParser.ts   # Parse properties.txt
        │   ├── socketablesParser.ts  # Parse gems.txt
        │   ├── runewordsParser.ts    # Parse runes.txt
        │   ├── uniqueItemsParser.ts  # Parse uniqueitems.txt
        │   ├── setsParser.ts         # Parse sets.txt
        │   └── setItemsParser.ts     # Parse setitems.txt
        ├── utils/
        │   └── propertyTranslator.ts # Code → text translation
        └── index.ts
```

### Roadmap

The TXT-based system will eventually replace HTM parsing:

1. **Unique Items** - New feature with TXT data
2. **Sets & Set Items** - New feature with TXT data
3. **Gemwords** - New feature (subset of runewords using gems)
4. **Socketables** - Re-implement with TXT data
5. **Runewords** - Re-implement with TXT data
6. **Deprecate HTM** - Remove HTM-based parsing and `data-sync` feature

See [TXT Files Reference](../data/TXT-FILES-REFERENCE.md) for detailed file format documentation.

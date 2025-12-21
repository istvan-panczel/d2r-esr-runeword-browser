# Core Data Feature

The core data feature handles parsing HTML sources, extracting game data, and storing it in IndexedDB for offline use.

## Data Sources

| Source | URL | Data |
|--------|-----|------|
| Runes | [gems.htm](https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs/gems.htm) | All runes with bonuses by item type |
| Runewords | [runewords.htm](https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs/runewords.htm) | Runeword definitions |
| Version | [changelogs.html](https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs/changelogs.html) | Latest ESR version for freshness check |

## Parsing Order

```
1. Fetch changelogs.html → Extract version (e.g., "3.9.07 - 18/12/2025")
2. Compare with stored version
3. If new version:
   a. Parse gems.htm → Extract all runes
   b. Parse runewords.htm → Extract all runewords
   c. Normalize all affixes
   d. Store in IndexedDB
   e. Update stored version
```

## Data Models

### Rune

```typescript
interface Rune {
  id: string;                    // Generated unique ID
  name: string;                  // "Ka Rune", "El Rune"
  reqLevel: number;              // From "Req Lvl: X"
  color: string;                 // From HTML font color attribute
  bonuses: {
    weaponsGloves: Affix[];      // Bonuses when used in weapons/gloves
    helmsBoots: Affix[];         // Bonuses when used in helms/boots
    armorShieldsBelts: Affix[];  // Bonuses when used in armor/shields/belts
  };
}
```

**Parsing Notes:**
- Rune name from text content
- Color from `<font color="WHITE">` attribute
- Required level from "Req Lvl: X" pattern
- Bonuses organized in three columns by item type

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

### Version Checking

On every app load:

```
┌─────────────────────────────────────────┐
│           App Startup                   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Fetch changelogs.html                  │
│  Extract latest version string          │
│  (e.g., "3.9.07 - 18/12/2025")         │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Read stored version from IndexedDB     │
└─────────────────────────────────────────┘
                    │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│  Same version │    │  Different version │
│  Use cached   │    │  Trigger re-parse  │
│  data         │    │  of all sources    │
└───────────────┘    └────────────────────┘
```

### Manual Refresh

A "Refresh Data" button allows users to force re-parse regardless of version.

## Implementation Notes

### HTML Parsing with DOMParser

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(htmlString, 'text/html');

// Example: Extract rune color
const fontElement = runeRow.querySelector('font[color]');
const color = fontElement?.getAttribute('color') || 'WHITE';
```

### Development Mode

During development, use local HTML fixtures from `src/data/raw/`:
- `src/data/raw/gems.htm`
- `src/data/raw/runewords.htm`
- `src/data/raw/changelogs.html`

This avoids hitting the remote server during development.

## Feature Location

```
src/
├── core/
│   └── db/
│       ├── index.ts          # Dexie database instance
│       └── models/           # Type definitions
└── features/
    └── data-sync/            # Data parsing feature
        ├── store/
        │   ├── dataSyncSlice.ts
        │   └── dataSyncSaga.ts
        ├── mappers/
        │   ├── runeMapper.ts
        │   ├── runewordMapper.ts
        │   └── affixNormalizer.ts
        └── types/
            └── index.ts
```

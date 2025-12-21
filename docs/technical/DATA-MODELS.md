# Data Models

Technical documentation of the IndexedDB schema and TypeScript types.

## Dexie Database Schema

```typescript
import Dexie, { Table } from 'dexie';

export class AppDatabase extends Dexie {
  // Socketable items (from gems.htm)
  gems!: Table<Gem, string>;
  esrRunes!: Table<EsrRune, string>;
  lodRunes!: Table<LodRune, string>;
  kanjiRunes!: Table<KanjiRune, string>;
  crystals!: Table<Crystal, string>;

  // Runewords (from runewords.htm)
  runewords!: Table<Runeword, string>;

  // Shared
  affixes!: Table<Affix, string>;
  metadata!: Table<Metadata, string>;

  constructor() {
    super('d2r-esr-runewords');

    this.version(1).stores({
      gems: 'id, name, type, quality, reqLevel',
      esrRunes: 'id, name, tier, color, reqLevel',
      lodRunes: 'id, name, order, reqLevel',
      kanjiRunes: 'id, name, reqLevel',
      crystals: 'id, name, type, quality, reqLevel',
      runewords: 'id, name, sockets, *allowedItems, *runes',
      affixes: 'id, pattern, valueType, category',
      metadata: 'key'
    });
  }
}

export const db = new AppDatabase();
```

## Table Definitions

### gems

Stores all gem data (8 types × 6 tiers = 48 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| name | string | Yes | "Chipped Ruby", "Perfect Sapphire" |
| type | GemType | Yes | "Amethyst", "Sapphire", etc. |
| quality | GemQuality | Yes | "Chipped" → "Perfect" |
| reqLevel | number | Yes | Required level (1-35) |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### esrRunes

Stores ESR-specific runes (~50 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| name | string | Yes | "I Rune", "Ka Rune", "Null Rune" |
| tier | number | Yes | Derived from color |
| color | string | Yes | HTML color (determines tier) |
| reqLevel | number | Yes | Required level (2-60) |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### lodRunes

Stores original LoD runes (35 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| name | string | Yes | "El Rune" → "Zod Rune" |
| order | number | Yes | Sequential position (1-35) |
| reqLevel | number | Yes | Required level (11-69) |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### kanjiRunes

Stores Kanji thematic runes (~14 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| name | string | Yes | "Moon Rune", "God Rune" |
| reqLevel | number | Yes | All level 60 |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### crystals

Stores all crystals (12 types × 3 tiers = 36 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| name | string | Yes | "Chipped Shadow Quartz" |
| type | CrystalType | Yes | Base crystal type |
| quality | CrystalQuality | Yes | "Chipped", "Flawed", "Standard" |
| color | string | No | Each type has unique color |
| reqLevel | number | Yes | Required level (6, 24, 42) |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### runewords

Stores all runeword definitions.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| name | string | Yes | "Stone", "Spirit" |
| sockets | number | Yes | Socket count required |
| runes | string[] | Multi | Ordered rune names |
| allowedItems | string[] | Multi | "Any Armor", "Weapon" |
| affixes | Affix[] | No | Runeword's own bonuses |

**Multi-Index Note:** The `*` prefix creates a multi-entry index, allowing queries like "find runewords containing rune X".

### affixes

Stores normalized affix patterns for the affix selector feature.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| rawText | string | No | Original text "+100 Defense" |
| pattern | string | Yes | Normalized "+# Defense" |
| value | number/array/null | No | Extracted numeric value(s) |
| valueType | AffixValueType | Yes | 'flat', 'percent', 'range', 'none' |
| category | string | Yes | "Defense", "Damage", etc. |

### metadata

Key-value store for app metadata.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| key | string | Primary | Metadata key |
| value | any | No | Metadata value |

**Used Keys:**
- `esrVersion` - Current parsed version (e.g., "3.9.07 - 18/12/2025")
- `lastParsed` - Timestamp of last parse
- `parseStatus` - 'idle', 'parsing', 'error'

## TypeScript Interfaces

### Shared Types

```typescript
// src/core/db/models/shared.ts

// All socketable items share this bonus structure
export interface SocketableBonuses {
  weaponsGloves: Affix[];
  helmsBoots: Affix[];
  armorShieldsBelts: Affix[];
}
```

### Gems

```typescript
// src/core/db/models/gem.ts
export interface Gem {
  id: string;
  name: string;
  type: GemType;
  quality: GemQuality;
  reqLevel: number;
  bonuses: SocketableBonuses;
}

export type GemType =
  | 'Amethyst' | 'Sapphire' | 'Emerald' | 'Ruby'
  | 'Diamond' | 'Topaz' | 'Skull' | 'Obsidian';

export type GemQuality =
  | 'Chipped' | 'Flawed' | 'Standard'
  | 'Flawless' | 'Blemished' | 'Perfect';
```

### ESR Runes

```typescript
// src/core/db/models/esrRune.ts
export interface EsrRune {
  id: string;
  name: string;
  tier: number;       // Derived from color
  color: string;      // HTML color attribute
  reqLevel: number;
  bonuses: SocketableBonuses;
}
```

### LoD Runes

```typescript
// src/core/db/models/lodRune.ts
export interface LodRune {
  id: string;
  name: string;
  order: number;      // 1 (El) to 35 (Zod)
  reqLevel: number;
  bonuses: SocketableBonuses;
}
```

### Kanji Runes

```typescript
// src/core/db/models/kanjiRune.ts
export interface KanjiRune {
  id: string;
  name: string;
  reqLevel: number;   // All level 60
  bonuses: SocketableBonuses;
}
```

### Crystals

```typescript
// src/core/db/models/crystal.ts
export interface Crystal {
  id: string;
  name: string;
  type: CrystalType;
  quality: CrystalQuality;
  color: string;
  reqLevel: number;
  bonuses: SocketableBonuses;
}

export type CrystalType =
  | 'Shadow Quartz' | 'Frozen Soul' | 'Bleeding Stone' | 'Burning Sulphur'
  | 'Dark Azurite' | 'Bitter Peridot' | 'Pulsing Opal' | 'Enigmatic Cinnabar'
  | 'Tomb Jade' | 'Solid Mercury' | 'Storm Amber' | 'Tainted Tourmaline';

export type CrystalQuality = 'Chipped' | 'Flawed' | 'Standard';
```

### Runewords

```typescript
// src/core/db/models/runeword.ts
export interface Runeword {
  id: string;
  name: string;
  sockets: number;
  runes: string[];          // Rune names in order
  allowedItems: string[];
  affixes: Affix[];
}
```

### Affixes

```typescript
// src/core/db/models/affix.ts
export interface Affix {
  id: string;
  rawText: string;
  pattern: string;
  value: number | [number, number] | null;
  valueType: AffixValueType;
  category?: string;
}

export type AffixValueType = 'flat' | 'percent' | 'range' | 'none';
```

### Metadata

```typescript
// src/core/db/models/metadata.ts
export interface Metadata {
  key: string;
  value: string | number | boolean;
}
```

## Relationships

```
┌─────────────┐
│   Runeword  │
├─────────────┤
│ id          │
│ name        │
│ sockets     │
│ runes[]     │───────┬──────────────────────────────────────┐
│ allowedItems│       │ references by name                   │
│ affixes[]   │       ▼                                      ▼
└─────────────┘   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
      │           │ EsrRune  │  │ LodRune  │  │KanjiRune │  │  (any)   │
      │           └──────────┘  └──────────┘  └──────────┘  └──────────┘
      │
      ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Affix     │◄──────│    Gem      │       │   Crystal   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ bonuses     │───────│ bonuses     │
│ rawText     │       └─────────────┘       └─────────────┘
│ pattern     │              ▲                     ▲
│ value       │              │                     │
│ valueType   │              └─── SocketableBonuses
│ category    │                   (embedded Affix[])
└─────────────┘
```

**Notes:**
- Runewords reference runes by name (string lookup across ESR/LoD/Kanji tables)
- Affixes are embedded in all socketable items via SocketableBonuses
- The `affixes` table stores unique patterns for the affix selector UI
- Each socketable category has its own table for clean separation

## Querying Examples

### Get all ESR runes by tier

```typescript
const tier2Runes = await db.esrRunes
  .where('tier')
  .equals(2)
  .toArray();
```

### Get all gems of a specific type

```typescript
const rubies = await db.gems
  .where('type')
  .equals('Ruby')
  .toArray();
```

### Get runewords containing specific rune

```typescript
const withElRune = await db.runewords
  .where('runes')
  .equals('El Rune')
  .toArray();
```

### Find rune by name across all tables

```typescript
async function findRune(name: string) {
  // Check each table
  const esrRune = await db.esrRunes.where('name').equals(name).first();
  if (esrRune) return { type: 'esr', rune: esrRune };

  const lodRune = await db.lodRunes.where('name').equals(name).first();
  if (lodRune) return { type: 'lod', rune: lodRune };

  const kanjiRune = await db.kanjiRunes.where('name').equals(name).first();
  if (kanjiRune) return { type: 'kanji', rune: kanjiRune };

  return null;
}
```

### Reactive query with useLiveQuery

```typescript
import { useLiveQuery } from 'dexie-react-hooks';

function EsrRuneList() {
  const runes = useLiveQuery(() =>
    db.esrRunes.orderBy('tier').toArray()
  );

  if (!runes) return <Loading />;

  return runes.map(rune => <RuneCard key={rune.id} rune={rune} />);
}
```

## Migration Strategy

When schema changes are needed:

```typescript
this.version(2).stores({
  // Updated schema
}).upgrade(tx => {
  // Migration logic
});
```

Always increment version and provide upgrade path for existing data.

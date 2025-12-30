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

---

## TXT Database Schema (Experimental)

A separate IndexedDB database for TXT-based data parsing. This database will eventually replace the HTM-based database above.

### Database Instance

```typescript
// src/core/db/txtDb.ts
import Dexie, { type EntityTable } from 'dexie';

class TxtDatabase extends Dexie {
  properties!: EntityTable<TxtPropertyDef, 'code'>;
  socketables!: EntityTable<TxtSocketable, 'code'>;
  runewords!: EntityTable<TxtRuneword, 'id'>;
  uniqueItems!: EntityTable<TxtUniqueItem, 'id'>;
  sets!: EntityTable<TxtSet, 'index'>;
  setItems!: EntityTable<TxtSetItem, 'id'>;
  metadata!: EntityTable<TxtMetadata, 'key'>;

  constructor() {
    super('d2r-esr-txt-data');

    this.version(1).stores({
      properties: '&code',
      socketables: '&code, name',
      runewords: '&id, displayName',
      uniqueItems: '&id, index, itemCode, enabled',
      sets: '&index, name',
      setItems: '&id, index, setName, itemCode',
      metadata: '&key',
    });
  }
}

export const txtDb = new TxtDatabase();
```

### TXT Table Definitions

#### properties

Stores property code definitions for tooltip translation.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| code | string | Primary | Property code ("str", "dmg%") |
| tooltip | string | No | Human-readable format ("+# to Strength") |
| parameter | string | No | Parameter label |

#### socketables

Stores gems and runes from gems.txt.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| code | string | Primary | Gem/rune code ("gcv", "r01") |
| name | string | Yes | Display name ("Chipped Amethyst", "El Rune") |
| letter | string | No | Single character identifier |
| weaponMods | TxtSocketableMod[] | No | Weapon socket bonuses |
| helmMods | TxtSocketableMod[] | No | Helm/boot socket bonuses |
| shieldMods | TxtSocketableMod[] | No | Shield/armor socket bonuses |

#### runewords

Stores runewords AND gemwords from runes.txt.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Internal ID ("Runeword1") |
| displayName | string | Yes | Display name ("Spirit", "Holy") |
| complete | boolean | No | Whether enabled |
| itemTypes | string[] | No | Allowed item type codes |
| excludeTypes | string[] | No | Excluded item type codes |
| runes | TxtRuneRef[] | No | Required socketables (code + resolved name) |
| properties | TxtProperty[] | No | Runeword properties |

**Note**: Gemwords share this table. They can be identified by their `runes` array containing gem codes instead of rune codes.

#### uniqueItems

Stores unique item definitions from uniqueitems.txt.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | number | Primary | Unique numeric ID |
| index | string | Yes | Display name |
| version | number | No | Game version |
| enabled | boolean | Yes | Whether active |
| level | number | No | Item level |
| levelReq | number | No | Level requirement |
| itemCode | string | Yes | Base item code |
| properties | TxtProperty[] | No | Item properties |

#### sets

Stores set definitions from sets.txt.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| index | string | Primary | Set index |
| name | string | Yes | Set name |
| version | number | No | Game version |
| partialBonuses | TxtPartialBonus[] | No | 2-5 item bonuses |
| fullSetBonuses | TxtProperty[] | No | Complete set bonuses |

#### setItems

Stores set item components from setitems.txt.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | number | Primary | Unique numeric ID |
| index | string | Yes | Display name |
| setName | string | Yes | Parent set name |
| itemCode | string | Yes | Base item code |
| level | number | No | Item level |
| levelReq | number | No | Level requirement |
| properties | TxtProperty[] | No | Base properties |
| partialBonuses | TxtSetItemBonus[] | No | Per-slot bonuses |

#### metadata

Key-value store for TXT data metadata.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| key | string | Primary | Metadata key |
| value | string | No | Metadata value |

**Used Keys:**
- `lastUpdated` - ISO timestamp of last parse

### TXT TypeScript Interfaces

```typescript
// src/core/db/txtModels.ts

// Shared property structure
export interface TxtProperty {
  readonly code: string;
  readonly param: string;
  readonly min: number;
  readonly max: number;
}

// Property definition (from properties.txt)
export interface TxtPropertyDef {
  readonly code: string;
  readonly tooltip: string;
  readonly parameter: string;
}

// Socketable mod (weapon/helm/shield bonuses)
export interface TxtSocketableMod {
  readonly code: string;
  readonly param: string;
  readonly min: number;
  readonly max: number;
}

// Socketable (gem or rune)
export interface TxtSocketable {
  readonly name: string;
  readonly code: string;
  readonly letter: string;
  readonly weaponMods: readonly TxtSocketableMod[];
  readonly helmMods: readonly TxtSocketableMod[];
  readonly shieldMods: readonly TxtSocketableMod[];
}

// Rune reference in runewords (resolved)
export interface TxtRuneRef {
  readonly code: string;   // Gem code from gems.txt
  readonly name: string;   // Resolved display name
}

// Runeword (also used for gemwords)
export interface TxtRuneword {
  readonly id: string;
  readonly displayName: string;
  readonly complete: boolean;
  readonly itemTypes: readonly string[];
  readonly excludeTypes: readonly string[];
  readonly runes: readonly TxtRuneRef[];
  readonly properties: readonly TxtProperty[];
}

// Unique item
export interface TxtUniqueItem {
  readonly id: number;
  readonly index: string;
  readonly version: number;
  readonly enabled: boolean;
  readonly level: number;
  readonly levelReq: number;
  readonly itemCode: string;
  readonly properties: readonly TxtProperty[];
}

// Partial set bonus (2-5 items equipped)
export interface TxtPartialBonus {
  readonly itemCount: number;
  readonly properties: readonly TxtProperty[];
}

// Set definition
export interface TxtSet {
  readonly index: string;
  readonly name: string;
  readonly version: number;
  readonly partialBonuses: readonly TxtPartialBonus[];
  readonly fullSetBonuses: readonly TxtProperty[];
}

// Set item partial bonus
export interface TxtSetItemBonus {
  readonly slot: string;
  readonly properties: readonly TxtProperty[];
}

// Set item
export interface TxtSetItem {
  readonly id: number;
  readonly index: string;
  readonly setName: string;
  readonly itemCode: string;
  readonly level: number;
  readonly levelReq: number;
  readonly properties: readonly TxtProperty[];
  readonly partialBonuses: readonly TxtSetItemBonus[];
}

// Metadata
export interface TxtMetadata {
  readonly key: string;
  readonly value: string;
}
```

### TXT Querying Examples

#### Get all socketables

```typescript
const socketables = await txtDb.socketables.toArray();
```

#### Find socketable by code

```typescript
const elRune = await txtDb.socketables.get('r01');
// { code: 'r01', name: 'El Rune', ... }
```

#### Get enabled runewords

```typescript
const runewords = await txtDb.runewords
  .filter(rw => rw.complete)
  .toArray();
```

#### Get unique items by base type

```typescript
const charms = await txtDb.uniqueItems
  .where('itemCode')
  .startsWith('cm')
  .toArray();
```

#### Get all items in a set

```typescript
const setItems = await txtDb.setItems
  .where('setName')
  .equals("Autolycus' Magic Tools")
  .toArray();
```

#### Reactive query with useLiveQuery

```typescript
function UniqueItemList() {
  const items = useLiveQuery(() =>
    txtDb.uniqueItems
      .where('enabled')
      .equals(1)
      .toArray()
  );

  if (!items) return <Loading />;
  return items.map(item => <ItemCard key={item.id} item={item} />);
}
```

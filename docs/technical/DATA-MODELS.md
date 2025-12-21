# Data Models

Technical documentation of the IndexedDB schema and TypeScript types.

## Dexie Database Schema

```typescript
import Dexie, { Table } from 'dexie';

export class AppDatabase extends Dexie {
  runes!: Table<Rune, string>;
  runewords!: Table<Runeword, string>;
  affixes!: Table<Affix, string>;
  metadata!: Table<Metadata, string>;

  constructor() {
    super('d2r-esr-runewords');

    this.version(1).stores({
      runes: 'id, name, reqLevel',
      runewords: 'id, name, sockets, *allowedItems, *runes',
      affixes: 'id, pattern, valueType',
      metadata: 'key'
    });
  }
}

export const db = new AppDatabase();
```

## Table Definitions

### runes

Stores all rune data parsed from gems.htm.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | string | Primary | Generated UUID |
| name | string | Yes | "Ka Rune", "El Rune" |
| reqLevel | number | Yes | Required level to use |
| color | string | No | HTML color name ("WHITE", "RED") |
| bonuses | object | No | Bonuses by item type (see below) |

**Bonuses Structure:**
```typescript
{
  weaponsGloves: Affix[],
  helmsBoots: Affix[],
  armorShieldsBelts: Affix[]
}
```

### runewords

Stores all runeword definitions parsed from runewords.htm.

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
| valueType | enum | Yes | 'flat', 'percent', 'range', 'none' |
| category | string | Yes | "Defense", "Damage", etc. (for grouping) |

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

```typescript
// src/core/db/models/rune.ts
export interface Rune {
  id: string;
  name: string;
  reqLevel: number;
  color: string;
  bonuses: RuneBonuses;
}

export interface RuneBonuses {
  weaponsGloves: Affix[];
  helmsBoots: Affix[];
  armorShieldsBelts: Affix[];
}

// src/core/db/models/runeword.ts
export interface Runeword {
  id: string;
  name: string;
  sockets: number;
  runes: string[];          // Rune names in order
  allowedItems: string[];
  affixes: Affix[];
}

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

// src/core/db/models/metadata.ts
export interface Metadata {
  key: string;
  value: string | number | boolean;
}
```

## Relationships

```
┌─────────────┐       ┌─────────────┐
│   Runeword  │       │    Rune     │
├─────────────┤       ├─────────────┤
│ id          │       │ id          │
│ name        │       │ name        │◄─────┐
│ sockets     │       │ reqLevel    │      │
│ runes[]     │───────│ color       │      │
│ allowedItems│  refs │ bonuses     │      │
│ affixes[]   │       └─────────────┘      │
└─────────────┘              │             │
      │                      │             │
      │                      ▼             │
      │               ┌─────────────┐      │
      └──────────────►│   Affix     │◄─────┘
                      ├─────────────┤  embedded in
                      │ id          │  rune bonuses
                      │ rawText     │
                      │ pattern     │
                      │ value       │
                      │ valueType   │
                      │ category    │
                      └─────────────┘
```

**Notes:**
- Runewords reference Runes by name (string), not foreign key
- Affixes are embedded in both Runewords and Rune bonuses
- The `affixes` table is for the affix selector (all unique patterns)

## Querying Examples

### Get all runewords with specific affix pattern

```typescript
const runewords = await db.runewords
  .filter(rw => rw.affixes.some(a => a.pattern === '+#% Enhanced Damage'))
  .toArray();
```

### Get runewords by socket count

```typescript
const twoSocketRunewords = await db.runewords
  .where('sockets')
  .equals(2)
  .toArray();
```

### Get runewords containing specific rune

```typescript
const withElRune = await db.runewords
  .where('runes')
  .equals('El Rune')
  .toArray();
```

### Get all unique affix categories

```typescript
const categories = await db.affixes
  .orderBy('category')
  .uniqueKeys();
```

### Reactive query with useLiveQuery

```typescript
import { useLiveQuery } from 'dexie-react-hooks';

function RunewordList() {
  const runewords = useLiveQuery(() => db.runewords.toArray());

  if (!runewords) return <Loading />;

  return runewords.map(rw => <RunewordCard key={rw.id} runeword={rw} />);
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

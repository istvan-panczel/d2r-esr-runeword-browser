# Data Models

Technical documentation of the IndexedDB schema and TypeScript types.

## Dexie Database Schema

```typescript
// src/core/db/db.ts
import Dexie, { type EntityTable, type Table } from 'dexie';

class AppDatabase extends Dexie {
  gems!: EntityTable<Gem, 'name'>;
  esrRunes!: EntityTable<EsrRune, 'name'>;
  lodRunes!: EntityTable<LodRune, 'name'>;
  kanjiRunes!: EntityTable<KanjiRune, 'name'>;
  crystals!: EntityTable<Crystal, 'name'>;
  runewords!: Table<Runeword, [string, number]>;  // Compound key: [name, variant]
  affixes!: EntityTable<AffixPattern, 'pattern'>;
  htmUniqueItems!: EntityTable<HtmUniqueItem, 'id'>;
  metadata!: EntityTable<Metadata, 'key'>;

  constructor() {
    super('d2r-esr-runeword-browser');

    this.version(10).stores({
      gems: 'name, type, quality, color',
      esrRunes: 'name, order, tier, color',
      lodRunes: 'name, order',
      kanjiRunes: 'name',
      crystals: 'name, type, quality, color',
      runewords: '[name+variant], name, sockets, reqLevel, sortKey',
      affixes: 'pattern',
      htmUniqueItems: '++id, name, page, category, reqLevel',
      metadata: 'key',
    });
  }
}

export const db = new AppDatabase();
```

## Table Definitions

### gems

Stores all gem data (8 types x 6 tiers = 48 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| name | string | Primary | "Chipped Ruby", "Perfect Sapphire" |
| type | GemType | Yes | "Amethyst", "Sapphire", etc. |
| quality | GemQuality | Yes | "Chipped" -> "Perfect" |
| color | string | Yes | Gem color |
| reqLevel | number | No | Required level (1-35) |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### esrRunes

Stores ESR-specific runes (~50 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| name | string | Primary | "I Rune", "Ka Rune", "Null Rune" |
| order | number | Yes | Order in source file (1-based) |
| tier | number | Yes | Derived from color |
| color | string | Yes | HTML color (determines tier) |
| reqLevel | number | No | Required level (2-60) |
| points | number? | No | Rune points from "(X points)" suffix |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### lodRunes

Stores original LoD runes (35 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| name | string | Primary | "El Rune" -> "Zod Rune" |
| order | number | Yes | Sequential position (1-35) |
| tier | number | No | 1=Low, 2=Mid, 3=High |
| reqLevel | number | No | Required level (11-69) |
| points | number? | No | Rune points from "(X points)" suffix |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### kanjiRunes

Stores Kanji thematic runes (~14 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| name | string | Primary | "Moon Rune", "God Rune" |
| reqLevel | number | No | All level 60 |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### crystals

Stores all crystals (12 types x 3 tiers = 36 items).

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| name | string | Primary | "Chipped Shadow Quartz" |
| type | CrystalType | Yes | Base crystal type |
| quality | CrystalQuality | Yes | "Chipped", "Flawed", "Standard" |
| color | string | Yes | Each type has unique color |
| reqLevel | number | No | Required level (6, 24, 42) |
| bonuses | SocketableBonuses | No | Bonuses by item type |

### runewords

Stores all runeword definitions.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| [name+variant] | [string, number] | Compound PK | Primary key |
| name | string | Yes | "Stone", "Spirit" |
| variant | number | (part of PK) | 1, 2, 3... for multi-variant runewords |
| sockets | number | Yes | Socket count required |
| reqLevel | number | Yes | Highest req level among ingredients |
| sortKey | number | Yes | Pre-calculated sort key |
| runes | string[] | No | Rune names in order |
| gems | string[] | No | Gem names in recipe |
| ingredients | string[] | No | All items in original order |
| allowedItems | string[] | No | "Any Armor", "Weapon" |
| excludedItems | string[] | No | Items excluded from variant |
| affixes | Affix[] | No | Backward compat: first non-empty column |
| columnAffixes | SocketableBonuses | No | Per-column bonuses (weapon/helm/armor) |
| tierPointTotals | TierPointTotal[] | No | Pre-calculated tier point totals |
| jewelInfo | string? | No | Jewel info for Kanji runewords |

### affixes

Stores normalized affix patterns for filtering.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| pattern | string | Primary | Normalized "+# Defense" |
| valueType | AffixValueType | No | 'flat', 'percent', 'range', 'none' |

### htmUniqueItems

Stores unique items parsed from HTM pages.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| id | number | Auto-PK | Auto-increment primary key |
| name | string | Yes | "Titan's Revenge", "Windforce" |
| baseItem | string | No | "Ceremonial Javelin", "Hydra Bow" |
| baseItemCode | string | No | Item code for resolution |
| page | HtmUniqueItemPage | Yes | 'weapons', 'armors', 'other' |
| category | string | Yes | "Amazon Javelin", "Bow", etc. |
| itemLevel | number | No | Item level |
| reqLevel | number | Yes | Required level |
| properties | string[] | No | Human-readable property strings |
| isAncientCoupon | boolean | No | True if coupon-only item |
| gambleItem | string | No | Gamble item identifier |

### metadata

Key-value store for app metadata.

| Column | Type | Index | Description |
|--------|------|-------|-------------|
| key | string | Primary | Metadata key |
| value | string | No | Metadata value |

**Used Keys:**
- `esrVersion` - Current parsed version (e.g., "3.9.07 - 18/12/2025")
- `lastParsed` - Timestamp of last parse

## TypeScript Interfaces

All types are defined in `src/core/db/models.ts`.

### Shared Types

```typescript
interface Affix {
  readonly rawText: string;
  readonly pattern: string;
  readonly value: number | readonly [number, number] | null;
  readonly valueType: 'flat' | 'percent' | 'range' | 'none';
}

interface AffixPattern {
  readonly pattern: string;
  readonly valueType: 'flat' | 'percent' | 'range' | 'none';
}

interface SocketableBonuses {
  readonly weaponsGloves: readonly Affix[];
  readonly helmsBoots: readonly Affix[];
  readonly armorShieldsBelts: readonly Affix[];
}
```

### Runeword Types

```typescript
type RuneCategory = 'esrRunes' | 'lodRunes';

interface TierPointTotal {
  readonly tier: number;
  readonly category: RuneCategory;
  readonly totalPoints: number;
}

interface Runeword {
  readonly name: string;
  readonly variant: number;
  readonly sockets: number;
  readonly reqLevel: number;
  readonly sortKey: number;
  readonly runes: readonly string[];
  readonly gems: readonly string[];
  readonly ingredients: readonly string[];
  readonly allowedItems: readonly string[];
  readonly excludedItems: readonly string[];
  readonly affixes: readonly Affix[];
  readonly columnAffixes: SocketableBonuses;
  readonly tierPointTotals: readonly TierPointTotal[];
  readonly jewelInfo?: string;
}
```

### HTM Unique Item Types

```typescript
type HtmUniqueItemPage = 'weapons' | 'armors' | 'other';

interface HtmUniqueItem {
  readonly id?: number;
  readonly name: string;
  readonly baseItem: string;
  readonly baseItemCode: string;
  readonly page: HtmUniqueItemPage;
  readonly category: string;
  readonly itemLevel: number;
  readonly reqLevel: number;
  readonly properties: readonly string[];
  readonly isAncientCoupon: boolean;
  readonly gambleItem: string;
}
```

### Metadata

```typescript
interface Metadata {
  readonly key: string;
  readonly value: string;
}
```

## Relationships

```
┌─────────────────┐
│    Runeword     │
├─────────────────┤
│ [name+variant]  │ (compound PK)
│ runes[]         │───────┬──────────────────────────────┐
│ gems[]          │──┐    │ references by name            │
│ ingredients[]   │  │    ▼                               ▼
│ allowedItems[]  │  │ ┌──────────┐  ┌──────────┐  ┌──────────┐
│ affixes[]       │  │ │ EsrRune  │  │ LodRune  │  │KanjiRune │
│ columnAffixes   │  │ └──────────┘  └──────────┘  └──────────┘
│ tierPointTotals │  │
└─────────────────┘  └─→ ┌──────────┐
                         │   Gem    │
                         └──────────┘

┌─────────────────┐
│ HtmUniqueItem   │  (independent, no FK relationships)
├─────────────────┤
│ page            │
│ category        │
│ properties[]    │
│ isAncientCoupon │
└─────────────────┘
```

**Notes:**
- Runewords reference runes by name (string lookup across ESR/LoD/Kanji tables)
- Runewords can also reference gems by name
- Affixes are embedded in all socketable items via SocketableBonuses
- The `affixes` table stores unique patterns for potential affix filtering
- HTM unique items are independent and categorized by page/category
- Each socketable category has its own table for clean separation

## Querying Examples

### Get all ESR runes by tier

```typescript
const tier2Runes = await db.esrRunes
  .where('tier')
  .equals(2)
  .toArray();
```

### Get runewords by socket count

```typescript
const fourSocket = await db.runewords
  .where('sockets')
  .equals(4)
  .toArray();
```

### Get unique items by page

```typescript
const weapons = await db.htmUniqueItems
  .where('page')
  .equals('weapons')
  .toArray();
```

### Reactive query with useLiveQuery

```typescript
import { useLiveQuery } from 'dexie-react-hooks';

function EsrRuneList() {
  const runes = useLiveQuery(() =>
    db.esrRunes.orderBy('tier').toArray()
  );

  if (!runes) return <Loading />;
  return runes.map(rune => <RuneCard key={rune.name} rune={rune} />);
}
```

## Migration Strategy

When schema changes are needed:

```typescript
this.version(11).stores({
  // Updated schema
}).upgrade(tx => {
  // Migration logic
});
```

Always increment version and provide upgrade path for existing data.

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
  runewords!: Table<Runeword, [string, number]>; // Compound key: [name, variant]
  gemwords!: Table<Gemword, [string, number]>; // Compound key: [name, variant]
  htmUniqueItems!: EntityTable<HtmUniqueItem, 'id'>;
  mythicalUniques!: EntityTable<MythicalUnique, 'id'>;
  ascendancies!: EntityTable<Ascendancy, 'name'>;
  ascendancyChallenges!: EntityTable<AscendancyChallenge, 'tier'>;
  metadata!: EntityTable<Metadata, 'key'>;

  constructor() {
    super('d2r-esr-runeword-browser');

    // version(13) (with affixes) and version(14) (affixes: null, the unused table dropped) are still declared
    // before this so existing databases upgrade
    this.version(15)
      .stores({
        gems: 'name, type, quality, color',
        esrRunes: 'name, order, tier, color',
        lodRunes: 'name, order',
        kanjiRunes: 'name',
        crystals: 'name, type, quality, color',
        runewords: '[name+variant], name, sockets, reqLevel, sortKey',
        gemwords: '[name+variant], name, sockets, reqLevel, sortKey',
        htmUniqueItems: '++id, name, page, category, reqLevel',
        mythicalUniques: '++id, name, category, reqLevel',
        ascendancies: 'name',
        ascendancyChallenges: 'tier', // v15
        metadata: 'key',
      })
      // v15: forget the app version that wrote the cache, so the next online startup re-parses
      .upgrade(async (tx) => {
        await tx.table('metadata').delete('appVersion');
      });
  }
}

export const db = new AppDatabase();
```

## Table Definitions

### gems

Stores all gem data (8 types x 6 tiers = 48 items).

| Column   | Type              | Index   | Description                        |
| -------- | ----------------- | ------- | ---------------------------------- |
| name     | string            | Primary | "Chipped Ruby", "Perfect Sapphire" |
| type     | GemType           | Yes     | "Amethyst", "Sapphire", etc.       |
| quality  | GemQuality        | Yes     | "Chipped" -> "Perfect"             |
| color    | string            | Yes     | Gem color                          |
| reqLevel | number            | No      | Required level (1-35)              |
| bonuses  | SocketableBonuses | No      | Bonuses by item type               |

### esrRunes

Stores ESR-specific runes (~50 items).

| Column   | Type              | Index   | Description                          |
| -------- | ----------------- | ------- | ------------------------------------ |
| name     | string            | Primary | "I Rune", "Ka Rune", "Null Rune"     |
| order    | number            | Yes     | Order in source file (1-based)       |
| tier     | number            | Yes     | Derived from color                   |
| color    | string            | Yes     | HTML color (determines tier)         |
| reqLevel | number            | No      | Required level (2-60)                |
| points   | number?           | No      | Rune points from "(X points)" suffix |
| bonuses  | SocketableBonuses | No      | Bonuses by item type                 |

### lodRunes

Stores original LoD runes (35 items).

| Column   | Type              | Index   | Description                          |
| -------- | ----------------- | ------- | ------------------------------------ |
| name     | string            | Primary | "El Rune" -> "Zod Rune"              |
| order    | number            | Yes     | Sequential position (1-35)           |
| tier     | number            | No      | 1=Low, 2=Mid, 3=High                 |
| reqLevel | number            | No      | Required level (11-69)               |
| points   | number?           | No      | Rune points from "(X points)" suffix |
| bonuses  | SocketableBonuses | No      | Bonuses by item type                 |

### kanjiRunes

Stores Kanji thematic runes (~14 items).

| Column   | Type              | Index   | Description             |
| -------- | ----------------- | ------- | ----------------------- |
| name     | string            | Primary | "Moon Rune", "God Rune" |
| reqLevel | number            | No      | All level 60            |
| bonuses  | SocketableBonuses | No      | Bonuses by item type    |

### crystals

Stores all crystals (12 types x 3 tiers = 36 items).

| Column   | Type              | Index   | Description                     |
| -------- | ----------------- | ------- | ------------------------------- |
| name     | string            | Primary | "Chipped Shadow Quartz"         |
| type     | CrystalType       | Yes     | Base crystal type               |
| quality  | CrystalQuality    | Yes     | "Chipped", "Flawed", "Standard" |
| color    | string            | Yes     | Each type has unique color      |
| reqLevel | number            | No      | Required level (6, 24, 42)      |
| bonuses  | SocketableBonuses | No      | Bonuses by item type            |

### runewords

Stores all runeword definitions.

| Column            | Type                    | Index        | Description                                                                                                                               |
| ----------------- | ----------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [name+variant]    | [string, number]        | Compound PK  | Primary key                                                                                                                               |
| name              | string                  | Yes          | "Stone", "Spirit"                                                                                                                         |
| variant           | number                  | (part of PK) | 1, 2, 3... for multi-variant runewords                                                                                                    |
| sockets           | number                  | Yes          | Base/minimum socket count (= ingredients + required jewels)                                                                               |
| socketsMax        | number?                 | No           | Only when the source shows a range, e.g. "(2-3 Socket)" for optional jewels                                                               |
| reqLevel          | number                  | Yes          | Page "Req Lvl" (3.3+), else highest ingredient                                                                                            |
| sortKey           | number                  | Yes          | = reqLevel (legacy cached rows: LoD = 10000 + reqLevel); the list sorts in JS                                                             |
| isLod             | boolean                 | No           | Has a LoD-exclusive rune (Ko alone does not count); absent on old cached rows                                                             |
| runes             | string[]                | No           | Rune names in order                                                                                                                       |
| gems              | string[]                | No           | Gem names in recipe                                                                                                                       |
| ingredients       | string[]                | No           | All items in original order                                                                                                               |
| allowedItems      | string[]                | No           | "Any Armor", "Weapon"                                                                                                                     |
| excludedItems     | string[]                | No           | Items excluded from variant                                                                                                               |
| affixes           | Affix[]                 | No           | Backward compat: first non-empty column                                                                                                   |
| columnAffixes     | SocketableBonuses       | No           | Per-column bonuses (weapon/helm/armor)                                                                                                    |
| tierPointTotals   | TierPointTotal[]        | No           | Pre-calculated tier point totals                                                                                                          |
| jewelInfo         | string?                 | No           | Jewel info: optional "(0-3) Jewels" (with socketsMax) or required "(2) Jewels"                                                            |
| socketableBonuses | SocketableBonusGroup[]? | No           | The site's rune bonuses per item-type group (ESR 3.3+): `{ label, itemTypes: { name, except }[], affixes }`; undefined on old cached rows |

### gemwords

Stores all gemword definitions (gem-based socket recipes, analogous to runewords).

| Column            | Type                    | Index        | Description                                                                                                                                      |
| ----------------- | ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [name+variant]    | [string, number]        | Compound PK  | Primary key                                                                                                                                      |
| name              | string                  | Yes          | "Holy", "Razor"                                                                                                                                  |
| variant           | number                  | (part of PK) | 1, 2, 3... for multi-variant gemwords                                                                                                            |
| sockets           | number                  | Yes          | Socket count required                                                                                                                            |
| reqLevel          | number                  | Yes          | Page "Req Lvl" (3.3+), else highest gem level                                                                                                    |
| sortKey           | number                  | Yes          | Pre-calculated sort key (= reqLevel)                                                                                                             |
| gems              | string[]                | No           | Gem names in recipe                                                                                                                              |
| ingredients       | string[]                | No           | Same as gems (model symmetry with Runeword)                                                                                                      |
| allowedItems      | string[]                | No           | "Body Armor", "Any Shield"                                                                                                                       |
| affixes           | Affix[]                 | No           | Backward compat: first non-empty column                                                                                                          |
| columnAffixes     | SocketableBonuses       | No           | Per-column bonuses (weapon/helm/armor)                                                                                                           |
| columnBonusPools  | ColumnBonusPools?       | No           | Per-column random bonus pools (ESR 3.2+): `{ label: "1-2 of the following:", affixes }[]` per column; undefined in data cached before it existed |
| jewelInfo         | string?                 | No           | Optional jewel requirement, e.g. "Jewel" (America, Canada, China)                                                                                |
| socketableBonuses | SocketableBonusGroup[]? | No           | The site's gem bonuses per item-type group (ESR 3.3+); undefined on old cached rows                                                              |

### htmUniqueItems

Stores unique items parsed from HTM pages.

| Column          | Type              | Index   | Description                                                                                                              |
| --------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| id              | number            | Auto-PK | Auto-increment primary key                                                                                               |
| name            | string            | Yes     | "Titan's Revenge", "Windforce"                                                                                           |
| baseItem        | string            | No      | "Ceremonial Javelin", "Hydra Bow"                                                                                        |
| baseItemCode    | string            | No      | Item code for resolution                                                                                                 |
| page            | HtmUniqueItemPage | Yes     | 'weapons', 'armors', 'other'                                                                                             |
| category        | string            | Yes     | "Amazon Javelin", "Bow", etc.                                                                                            |
| itemLevel       | number            | No      | Item level                                                                                                               |
| reqLevel        | number            | Yes     | Required level                                                                                                           |
| properties      | string[]          | No      | Human-readable property strings, one per property (hard-wrapped source lines re-joined, see CORE-DATA "Splitting Cells") |
| isAncientCoupon | boolean           | No      | True if coupon-only item                                                                                                 |
| gambleItem      | string            | No      | Gamble item identifier                                                                                                   |

### ascendancies

Stores the ascendancies parsed from `ascendancies.htm` (15 at ESR 3.2.24).

| Column       | Type             | Index   | Description                                                                                                                                      |
| ------------ | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| name         | string           | Primary | "Battlemage", "Soul Warden"                                                                                                                      |
| imageUrl     | string           | No      | Relative URL on the docs site, e.g. "./images/ascendancies/battlemage.png"                                                                       |
| tiers        | AscendancyTier[] | No      | `{ tier, bonuses }` for tiers 1–5                                                                                                                |
| footnotes    | string[]         | No      | The `*` notes under the card                                                                                                                     |
| unlockInputs | string[]?        | No      | The Tier 1 Challenge recipe for this stone: ["Orb of Creation", "2 Blemished Sapphire", …]; `[]` when the page has none; undefined in older data |

### ascendancyChallenges

Stores the "Tier N Challenge" sections of `ascendancies.htm` (5 at ESR 3.2.24). Not sanity-checked: empty when the
page has no readable challenge section (the Ascendancies page then hides its tier steps).

| Column      | Type               | Index   | Description                                                                                                                                                                                      |
| ----------- | ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| tier        | number             | Primary | 1–5                                                                                                                                                                                              |
| description | string[]           | No      | Plain-text paragraphs (emphasis dropped, hard-wrapped lines re-joined)                                                                                                                           |
| recipes     | AscendancyRecipe[] | No      | `{ inputs, outputs }`, one entry per cell line; Tier 1 has one per ascendancy (15), the later tiers one each (e.g. "Ascendancy Stone" + "Maple Leaf" → "Ascendancy Stone", "Upgraded to Tier 3") |

### metadata

Key-value store for app metadata.

| Column | Type   | Index   | Description    |
| ------ | ------ | ------- | -------------- |
| key    | string | Primary | Metadata key   |
| value  | string | No      | Metadata value |

**Used Keys:**

- `esrVersion` - ESR version of the synced docs data (e.g., "3.2.24"), from GitHub `d2rloader/metadata.json`
  (`metadata.modVersion`), or the changelog page's first header as a fallback
- `docsLastModified` - ISO `Last-Modified` of the docs site's `runewords.htm` at the last sync (absent when not sent)
- `lastUpdated` - ISO timestamp of the last successful store
- `appVersion` - App version that wrote the cache (an app upgrade triggers a refetch; the v15 schema upgrade deletes it to force one)

## TypeScript Interfaces

All types are defined in `src/core/db/models.ts`.

### Shared Types

```typescript
interface Affix {
  readonly rawText: string; // one affix; hard-wrapped <br> lines in the source are re-joined with a space
  readonly pattern: string;
  readonly value: number | readonly [number, number] | null;
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
  readonly socketsMax?: number;
  readonly reqLevel: number;
  readonly sortKey: number;
  readonly isLod: boolean;
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
- HTM unique items are independent and categorized by page/category
- Each socketable category has its own table for clean separation

## Querying Examples

### Get all ESR runes by tier

```typescript
const tier2Runes = await db.esrRunes.where('tier').equals(2).toArray();
```

### Get runewords by socket count

```typescript
const fourSocket = await db.runewords.where('sockets').equals(4).toArray();
```

### Get unique items by page

```typescript
const weapons = await db.htmUniqueItems.where('page').equals('weapons').toArray();
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

## Stash Database

The uploaded shared stash (My Stash pages) lives in a second Dexie database, `d2r-esr-stash`
(`src/features/stash/db/stashDb.ts`), not in the cache database above: that one is cleared on every HTM data sync and
deleted when it cannot be upgraded, while the stash file is user data. One table, `files` (key `key`), holds one
record (`key: 'last'`): the raw file bytes (`ArrayBuffer`) with `name`, `size`, `lastModified` and `uploadedAt`. The
bytes are re-parsed on every visit, so parser fixes and new game data apply without a re-upload. "Clear" deletes the
record. See [STASH.md](../features/STASH.md).

## Game Data Bundles

The Game Data pages do not use Dexie. Their data is static JSON under `public/game-data/`, typed in
`src/features/game-data/engine/schema.ts` (`GAME_DATA_SCHEMA`, bumped on incompatible shape changes):

| File             | Type                 | Contents                                                                                                                |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`  | `GameDataManifest`   | schema, ESR version / tag / commit, `generatedAt`, sha256 + bytes per file, counts, warnings                            |
| `types.json`     | `TypesBundle`        | `ItemTypeInfo[]` (parents, ancestors, socket caps, class, categories) + `ClassInfo[]`                                   |
| `bases.json`     | `BasesBundle`        | `BaseItem[]`: spawnable weapons, armor, accessories (tier, family, requirements, damage/defense, socket caps)           |
| `runewords.json` | `TxtRunewordsBundle` | `TxtRuneword[]` keyed `RunewordNNN`, one `TxtRunewordRow` per socket variant (ingredients, item types, rendered `text`) |
| `affixes.json`   | `AffixesBundle`      | `Affix[]`: magic prefixes/suffixes/automods with levels, frequency, group, item types, `mods` and rendered `text`       |

See [GAME-DATA.md](../features/GAME-DATA.md) for the generation rules.

## Migration Strategy

When schema changes are needed:

```typescript
this.version(16)
  .stores({
    // Updated schema
  })
  .upgrade((tx) => {
    // Migration logic
  });
```

Always increment version and provide upgrade path for existing data.

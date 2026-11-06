import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Gem,
  EsrRune,
  LodRune,
  KanjiRune,
  Crystal,
  Runeword,
  Gemword,
  HtmUniqueItem,
  MythicalUnique,
  Ascendancy,
  AscendancyChallenge,
  Metadata,
} from './models';

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

    this.version(13).stores({
      gems: 'name, type, quality, color',
      esrRunes: 'name, order, tier, color',
      lodRunes: 'name, order',
      kanjiRunes: 'name',
      crystals: 'name, type, quality, color',
      runewords: '[name+variant], name, sockets, reqLevel, sortKey',
      gemwords: '[name+variant], name, sockets, reqLevel, sortKey',
      affixes: 'pattern',
      htmUniqueItems: '++id, name, page, category, reqLevel',
      mythicalUniques: '++id, name, category, reqLevel',
      ascendancies: 'name',
      metadata: 'key',
    });

    // v14: drop the unused affixes table
    this.version(14).stores({
      gems: 'name, type, quality, color',
      esrRunes: 'name, order, tier, color',
      lodRunes: 'name, order',
      kanjiRunes: 'name',
      crystals: 'name, type, quality, color',
      runewords: '[name+variant], name, sockets, reqLevel, sortKey',
      gemwords: '[name+variant], name, sockets, reqLevel, sortKey',
      affixes: null,
      htmUniqueItems: '++id, name, page, category, reqLevel',
      mythicalUniques: '++id, name, category, reqLevel',
      ascendancies: 'name',
      metadata: 'key',
    });

    // v15: the ascendancies.htm Tier 1–5 challenges (Ascendancy rows also gained unlockInputs). Dropping the stored
    // app version makes the next online startup refetch and re-parse, so existing caches fill the new table and field
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
        ascendancyChallenges: 'tier',
        metadata: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('metadata').delete('appVersion');
      });
  }
}

export const db = new AppDatabase();

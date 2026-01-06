import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Gem, EsrRune, LodRune, KanjiRune, Crystal, Runeword, AffixPattern, Metadata } from './models';

class AppDatabase extends Dexie {
  gems!: EntityTable<Gem, 'name'>;
  esrRunes!: EntityTable<EsrRune, 'name'>;
  lodRunes!: EntityTable<LodRune, 'name'>;
  kanjiRunes!: EntityTable<KanjiRune, 'name'>;
  crystals!: EntityTable<Crystal, 'name'>;
  runewords!: Table<Runeword, [string, number]>; // Compound key: [name, variant]
  affixes!: EntityTable<AffixPattern, 'pattern'>;
  metadata!: EntityTable<Metadata, 'key'>;

  constructor() {
    super('d2r-esr-runeword-browser');

    this.version(9).stores({
      gems: 'name, type, quality, color',
      esrRunes: 'name, order, tier, color',
      lodRunes: 'name, order',
      kanjiRunes: 'name',
      crystals: 'name, type, quality, color',
      runewords: '[name+variant], name, sockets, reqLevel, sortKey',
      affixes: 'pattern',
      metadata: 'key',
    });
  }
}

export const db = new AppDatabase();

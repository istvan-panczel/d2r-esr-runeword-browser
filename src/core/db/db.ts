import Dexie, { type EntityTable } from 'dexie';
import type { Gem, EsrRune, LodRune, KanjiRune, Crystal, Runeword, Affix, Metadata } from './models';

class AppDatabase extends Dexie {
  gems!: EntityTable<Gem, 'name'>;
  esrRunes!: EntityTable<EsrRune, 'name'>;
  lodRunes!: EntityTable<LodRune, 'name'>;
  kanjiRunes!: EntityTable<KanjiRune, 'name'>;
  crystals!: EntityTable<Crystal, 'name'>;
  runewords!: EntityTable<Runeword, 'id'>;
  affixes!: EntityTable<Affix, 'id'>;
  metadata!: EntityTable<Metadata, 'key'>;

  constructor() {
    super('d2r-esr-runeword-browser');

    this.version(2).stores({
      gems: 'name, type, quality, color',
      esrRunes: 'name, tier, color',
      lodRunes: 'name, order',
      kanjiRunes: 'name',
      crystals: 'name, type, quality, color',
      runewords: 'id, name, sockets',
      affixes: 'id, pattern',
      metadata: 'key',
    });
  }
}

export const db = new AppDatabase();

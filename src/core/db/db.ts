import Dexie, { type EntityTable } from 'dexie';
import type { Gem, EsrRune, LodRune, KanjiRune, Crystal, Runeword, Affix, Metadata } from './models';

class AppDatabase extends Dexie {
  gems!: EntityTable<Gem, 'name'>;
  esrRunes!: EntityTable<EsrRune, 'name'>;
  lodRunes!: EntityTable<LodRune, 'name'>;
  kanjiRunes!: EntityTable<KanjiRune, 'name'>;
  crystals!: EntityTable<Crystal, 'name'>;
  runewords!: EntityTable<Runeword, 'name'>;
  affixes!: EntityTable<Affix, 'pattern'>;
  metadata!: EntityTable<Metadata, 'key'>;

  constructor() {
    super('d2r-esr-runeword-browser');

    this.version(3).stores({
      gems: 'name, type, quality, color',
      esrRunes: 'name, tier, color',
      lodRunes: 'name, order',
      kanjiRunes: 'name',
      crystals: 'name, type, quality, color',
      runewords: 'name, sockets',
      affixes: 'pattern',
      metadata: 'key',
    });
  }
}

export const db = new AppDatabase();

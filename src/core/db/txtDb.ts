import Dexie, { type EntityTable } from 'dexie';
import type {
  TxtPropertyDef,
  TxtSocketable,
  TxtRuneword,
  TxtUniqueItem,
  TxtSet,
  TxtSetItem,
  TxtMetadata,
  TxtItemType,
  TxtItemTypeDef,
} from './txtModels';

/**
 * IndexedDB database for TXT file data
 * Separate from the main database to keep HTM-parsed data intact
 */
class TxtDatabase extends Dexie {
  properties!: EntityTable<TxtPropertyDef, 'code'>;
  socketables!: EntityTable<TxtSocketable, 'code'>;
  runewords!: EntityTable<TxtRuneword, 'id'>;
  uniqueItems!: EntityTable<TxtUniqueItem, 'id'>;
  sets!: EntityTable<TxtSet, 'index'>;
  setItems!: EntityTable<TxtSetItem, 'id'>;
  itemTypes!: EntityTable<TxtItemType, 'code'>;
  itemTypeDefs!: EntityTable<TxtItemTypeDef, 'code'>;
  metadata!: EntityTable<TxtMetadata, 'key'>;

  constructor() {
    super('d2r-esr-txt-data');

    this.version(1).stores({
      // Property definitions (from properties.txt)
      properties: 'code',

      // Socketables - gems and runes (from gems.txt)
      socketables: 'code, name',

      // Runewords (from runes.txt)
      runewords: 'id, displayName',

      // Unique items (from uniqueitems.txt)
      uniqueItems: 'id, index, itemCode, enabled',

      // Set definitions (from sets.txt)
      sets: 'index, name',

      // Set items (from setitems.txt)
      setItems: 'id, index, setName, itemCode',

      // Metadata for tracking database state
      metadata: 'key',
    });

    this.version(2).stores({
      // Item types mapping (from weapons.txt, armor.txt, misc.txt)
      itemTypes: 'code, type',
    });

    this.version(3).stores({
      // Item type definitions (from itemtypes.txt)
      itemTypeDefs: 'code, storePage',
    });
  }
}

export const txtDb = new TxtDatabase();

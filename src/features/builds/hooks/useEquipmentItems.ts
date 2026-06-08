import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import type { Gemword, HtmUniqueItem, MythicalUnique, Runeword } from '@/core/db';

export interface EquipmentItems {
  readonly uniques: readonly HtmUniqueItem[];
  readonly mythicals: readonly MythicalUnique[];
  readonly runewords: readonly Runeword[];
  readonly gemwords: readonly Gemword[];
}

/** Loads the local item collections the equipment picker searches. Undefined while loading. */
export function useEquipmentItems(): EquipmentItems | undefined {
  return useLiveQuery(async () => {
    const [uniques, mythicals, runewords, gemwords] = await Promise.all([
      db.htmUniqueItems.toArray(),
      db.mythicalUniques.toArray(),
      db.runewords.toArray(),
      db.gemwords.toArray(),
    ]);
    return { uniques, mythicals, runewords, gemwords };
  });
}

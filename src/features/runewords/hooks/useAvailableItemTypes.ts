import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';

export function useAvailableItemTypes(): readonly string[] | undefined {
  return useLiveQuery(async () => {
    const runewords = await db.runewords.toArray();
    const itemTypeSet = new Set<string>();

    for (const runeword of runewords) {
      for (const item of runeword.allowedItems) {
        itemTypeSet.add(item);
      }
    }

    // Sort alphabetically for consistent UI
    return Array.from(itemTypeSet).sort();
  }, []);
}

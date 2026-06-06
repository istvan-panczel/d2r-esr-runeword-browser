import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';

export function useAvailableItemTypes(): readonly string[] | undefined {
  return useLiveQuery(async () => {
    const gemwords = await db.gemwords.toArray();
    const itemTypeSet = new Set<string>();

    for (const gemword of gemwords) {
      for (const item of gemword.allowedItems) {
        itemTypeSet.add(item);
      }
    }

    return Array.from(itemTypeSet).sort();
  }, []);
}

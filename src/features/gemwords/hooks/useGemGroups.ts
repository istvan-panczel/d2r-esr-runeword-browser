import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { GEM_TYPES, GEM_QUALITIES } from '@/features/data-sync/constants/constants';
import type { GemGroup } from '../types';

export function useGemGroups(): readonly GemGroup[] | undefined {
  return useLiveQuery(async () => {
    const gems = await db.gems.toArray();
    const gemwords = await db.gemwords.toArray();
    const usedGemNames = new Set(gemwords.flatMap((gemword) => gemword.gems));
    const groups: GemGroup[] = [];

    for (const type of GEM_TYPES) {
      const groupGems = gems
        .filter((gem) => gem.type === type && usedGemNames.has(gem.name))
        .sort((a, b) => GEM_QUALITIES.indexOf(a.quality) - GEM_QUALITIES.indexOf(b.quality));

      if (groupGems.length > 0) {
        groups.push({ type, gems: groupGems });
      }
    }

    return groups;
  }, []);
}

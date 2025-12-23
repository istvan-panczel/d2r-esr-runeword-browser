import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { LOD_TIER_LABELS } from '@/features/data-sync/constants/constants';
import type { RuneGroup } from '../types';

export function useRuneGroups(): readonly RuneGroup[] | undefined {
  return useLiveQuery(async () => {
    const [esrRunes, lodRunes, kanjiRunes] = await Promise.all([
      db.esrRunes.orderBy('order').toArray(),
      db.lodRunes.orderBy('order').toArray(),
      db.kanjiRunes.toArray(),
    ]);

    const groups: RuneGroup[] = [];

    // ESR Runes grouped by tier (1-7), preserving order within each tier
    for (let tier = 1; tier <= 7; tier++) {
      const tierRunes = esrRunes.filter((r) => r.tier === tier).map((r) => r.name);
      if (tierRunes.length > 0) {
        groups.push({
          label: `ESR Tier ${String(tier)}`,
          category: 'esrRunes',
          tier,
          runes: tierRunes,
        });
      }
    }

    // LoD Runes grouped by tier (1=Low, 2=Mid, 3=High)
    for (let tier = 1; tier <= 3; tier++) {
      const tierRunes = lodRunes.filter((r) => r.tier === tier).map((r) => r.name);
      if (tierRunes.length > 0) {
        groups.push({
          label: `LoD ${LOD_TIER_LABELS[tier]}`,
          category: 'lodRunes',
          tier,
          runes: tierRunes,
        });
      }
    }

    // Kanji Runes (no tiers, single group)
    if (kanjiRunes.length > 0) {
      groups.push({
        label: 'Kanji Runes',
        category: 'kanjiRunes',
        tier: null,
        runes: kanjiRunes.map((r) => r.name),
      });
    }

    return groups;
  }, []);
}

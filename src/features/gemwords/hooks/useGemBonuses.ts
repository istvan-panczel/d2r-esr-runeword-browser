import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import type { SocketableBonuses } from '@/core/db/models';

export type GemBonusMap = ReadonlyMap<string, SocketableBonuses>;

export interface AggregatedGemBonuses {
  readonly weaponsGloves: readonly string[];
  readonly helmsBoots: readonly string[];
  readonly armorShieldsBelts: readonly string[];
}

/**
 * Loads the gems table once at screen level. Pass the resulting map down to
 * the cards — a per-card live query would issue cards × gems IndexedDB reads
 * and one subscription per card.
 */
export function useGemBonusMap(): GemBonusMap | undefined {
  return useLiveQuery(async () => {
    const gems = await db.gems.toArray();
    return new Map(gems.map((gem) => [gem.name, gem.bonuses]));
  }, []);
}

/** Aggregates the per-column bonuses of a gemword's gems for display. */
export function aggregateGemBonuses(gems: readonly string[], gemBonusMap: GemBonusMap): AggregatedGemBonuses {
  const weaponsGloves: string[] = [];
  const helmsBoots: string[] = [];
  const armorShieldsBelts: string[] = [];

  for (const gemName of gems) {
    const bonuses = gemBonusMap.get(gemName);
    if (!bonuses) continue;

    for (const affix of bonuses.weaponsGloves) {
      weaponsGloves.push(affix.rawText);
    }
    for (const affix of bonuses.helmsBoots) {
      helmsBoots.push(affix.rawText);
    }
    for (const affix of bonuses.armorShieldsBelts) {
      armorShieldsBelts.push(affix.rawText);
    }
  }

  return { weaponsGloves, helmsBoots, armorShieldsBelts };
}

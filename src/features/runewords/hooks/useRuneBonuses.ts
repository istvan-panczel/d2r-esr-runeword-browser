import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import type { SocketableBonuses } from '@/core/db/models';

export interface AggregatedBonuses {
  readonly weaponsGloves: readonly string[];
  readonly helmsBoots: readonly string[];
  readonly armorShieldsBelts: readonly string[];
}

/**
 * Fetches a rune from any of the rune tables (ESR, LoD, Kanji).
 */
async function fetchRune(runeName: string): Promise<SocketableBonuses | null> {
  const esrRune = await db.esrRunes.get(runeName);
  if (esrRune) return esrRune.bonuses;

  const lodRune = await db.lodRunes.get(runeName);
  if (lodRune) return lodRune.bonuses;

  const kanjiRune = await db.kanjiRunes.get(runeName);
  if (kanjiRune) return kanjiRune.bonuses;

  return null;
}

/**
 * Hook that fetches and aggregates bonuses from all runes in a runeword.
 * Returns aggregated bonus texts for each category.
 */
export function useRuneBonuses(runes: readonly string[]): AggregatedBonuses | undefined {
  return useLiveQuery(async () => {
    const weaponsGloves: string[] = [];
    const helmsBoots: string[] = [];
    const armorShieldsBelts: string[] = [];

    for (const runeName of runes) {
      const bonuses = await fetchRune(runeName);
      if (bonuses) {
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
    }

    return { weaponsGloves, helmsBoots, armorShieldsBelts };
  }, [runes]);
}

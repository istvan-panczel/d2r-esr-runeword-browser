/**
 * The Progress tab: what the save's `gf` attributes say about ESR's character progression, without new decoding. Stat
 * ids are itemstatcost.txt rows (ESR 3.3); the specialization perks carry their stat id in specializations.json.
 */
import type { SpecializationPerk, SpecializationsBundle, SpecializationTree } from '@/features/game-data/engine/schema';
import type { CharacterFile } from '../parser/types';

/** itemstatcost.txt rows of the progression stats a save holds */
export const PROGRESS_STATS = {
  /** `kill_base`: the kill count the Kill Ledger reads */
  kills: 163,
  /** `relic_of_knowledge`: Relics of Knowledge used */
  relics: 235,
  /** `respecpoints`: what unlearning a perk costs (and other respecs) */
  respecPoints: 237,
  /** `specializationpoints`: unspent specialization points */
  specializationPoints: 926,
  /** `specializationtokencap`: set once the Mystical Tesseract was used (INFERRED from one save: 1 with five perks learned) */
  specializationToken: 942,
} as const;

/** A stat's value (ValShift applied), 0 when the save does not hold it (zero values are not written) */
export function statValue(character: Pick<CharacterFile, 'attributes'>, id: number): number {
  return character.attributes.find((stat) => stat.id === id)?.value ?? 0;
}

export interface LearnedPerk {
  readonly perk: SpecializationPerk;
  /** The perk stat's value: 1 in every save seen */
  readonly rank: number;
}

export interface SpecializationTreeProgress {
  readonly tree: SpecializationTree;
  /** Perks with a non-zero stat, in tree order */
  readonly learned: readonly LearnedPerk[];
}

export interface SpecializationProgress {
  /** Every tree in tab order, learned or not */
  readonly trees: readonly SpecializationTreeProgress[];
  readonly learnedCount: number;
  readonly unspentPoints: number;
  /** The token stat is set, or a perk is learned */
  readonly unlocked: boolean;
}

export function specializationProgress(
  character: Pick<CharacterFile, 'attributes'>,
  bundle: Pick<SpecializationsBundle, 'trees'>
): SpecializationProgress {
  const trees = bundle.trees.map((tree) => ({
    tree,
    learned: tree.perks.flatMap((perk) => {
      const rank = statValue(character, perk.stat);
      return rank > 0 ? [{ perk, rank }] : [];
    }),
  }));
  const learnedCount = trees.reduce((sum, entry) => sum + entry.learned.length, 0);
  return {
    trees,
    learnedCount,
    unspentPoints: statValue(character, PROGRESS_STATS.specializationPoints),
    unlocked: learnedCount > 0 || statValue(character, PROGRESS_STATS.specializationToken) > 0,
  };
}

export interface ProgressCounters {
  readonly kills: number;
  readonly relics: number;
  readonly respecPoints: number;
}

export function progressCounters(character: Pick<CharacterFile, 'attributes'>): ProgressCounters {
  return {
    kills: statValue(character, PROGRESS_STATS.kills),
    relics: statValue(character, PROGRESS_STATS.relics),
    respecPoints: statValue(character, PROGRESS_STATS.respecPoints),
  };
}

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import type { AscendancyChallenge } from '@/core/db';

const NO_CHALLENGES: readonly AscendancyChallenge[] = [];

/**
 * The parsed Tier 1–5 challenges in tier order; empty while loading and when the page had no challenge section (the
 * panel then shows only the orb locations).
 */
export function useAscendancyChallenges(): readonly AscendancyChallenge[] {
  return useLiveQuery(() => db.ascendancyChallenges.toArray()) ?? NO_CHALLENGES;
}

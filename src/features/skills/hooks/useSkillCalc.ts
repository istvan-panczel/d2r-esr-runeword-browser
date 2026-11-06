import { useEffect, useState } from 'react';
import { loadGameDataFile } from '@/features/game-data/engine/browser/loadGameData';
import { indexSkillCalc, type SkillCalcIndex } from '@/features/game-data/engine/skillCalc';

export type SkillCalcState =
  { readonly status: 'loading' | 'error'; readonly index: undefined } | { readonly status: 'ready'; readonly index: SkillCalcIndex };

/** The loaded calculator, kept for the page's lifetime so a remounted detail card (another skill) is ready at once */
let loaded: SkillCalcIndex | undefined;

/**
 * skillcalc.json (the per-level formulas), loaded lazily the first time a skill detail card is shown. The bundle
 * promise itself is cached by `loadGameDataFile`; a failed load is retried by the next card that mounts.
 */
export function useSkillCalc(): SkillCalcState {
  const [state, setState] = useState<SkillCalcState>(() =>
    loaded === undefined ? { status: 'loading', index: undefined } : { status: 'ready', index: loaded }
  );
  useEffect(() => {
    if (loaded !== undefined) return;
    let cancelled = false;
    const fail = (error: unknown) => {
      console.error('Failed to load the skill calculator data:', error);
      if (!cancelled) setState({ status: 'error', index: undefined });
    };
    loadGameDataFile('skillcalc').then((bundle) => {
      // A bundle that cannot be indexed is an error too (the card falls back to its fixed lines), not an endless load
      try {
        loaded = indexSkillCalc(bundle);
      } catch (error: unknown) {
        fail(error);
        return;
      }
      if (!cancelled) setState({ status: 'ready', index: loaded });
    }, fail);
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

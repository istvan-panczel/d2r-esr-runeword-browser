import { useGameData } from '@/features/game-data/hooks/useGameData';
import type { SheetData } from '../engine/sheet';
import type { AvailableBuff, BuffSelection } from '../engine/sheet/types';
import { sheetCache } from '../engine/sheetCache';
import { computeSheetView, type SheetViewResult } from '../engine/sheetViewState';
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import { useSheetView } from './useSheetView';

/** Loaded only by the tabs that show the sheet (lazy, like every tab's own game data) */
const SHEET_FILES = ['charsheet', 'itemtext'] as const;

type ReadyView = Extract<SheetViewResult, { status: 'ready' }>;

export type CharacterSheetState =
  | { readonly status: 'loading' }
  /** The sheet's game data could not be loaded (retry) */
  | { readonly status: 'error'; readonly error: unknown; readonly retry: () => void }
  /** The calculation failed on this save: the tabs show the stored base values and the message */
  | { readonly status: 'failed'; readonly message: string }
  | (Omit<ReadyView, 'status'> & {
      readonly status: 'ready';
      readonly availableBuffs: readonly AvailableBuff[];
      readonly data: SheetData;
      readonly difficulty: DifficultyIndex;
      readonly setDifficulty: (difficulty: DifficultyIndex) => void;
      /** The selections that count: the remembered ones this character can use */
      readonly buffs: readonly BuffSelection[];
      readonly setBuffs: (buffs: readonly BuffSelection[]) => void;
    });

/**
 * The computed sheet of `character`, shared by the tabs: computed once per (character, difficulty, buffs) in the page's
 * sheet cache, with the view state (difficulty, buffs) from CharacterSheetProvider. Never throws: a failing calculation
 * is the `failed` state.
 */
export function useCharacterSheet(character: CharacterFile): CharacterSheetState {
  const view = useSheetView();
  const gameData = useGameData(SHEET_FILES);
  if (gameData.status === 'loading') return { status: 'loading' };
  if (gameData.status === 'error') return { status: 'error', error: gameData.error, retry: gameData.retry };
  const difficulty = view.difficultyOf(character);
  const result = computeSheetView(sheetCache, gameData.data, character, difficulty, view.buffsOf(character));
  if (result.status === 'failed') return result;
  return {
    ...result,
    status: 'ready',
    difficulty,
    setDifficulty: (next) => {
      view.setDifficulty(character, next);
    },
    setBuffs: (next) => {
      view.setBuffs(character, next);
    },
  };
}

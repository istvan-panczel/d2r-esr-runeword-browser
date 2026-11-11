import { useGameData } from '@/features/game-data/hooks/useGameData';
import type { SheetData } from '../engine/sheet';
import type { AvailableBuff, BuffSelection, CharacterSheet } from '../engine/sheet/types';
import { sheetCache } from '../engine/sheetCache';
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import { useSheetView } from './useSheetView';

/** Loaded only by the tabs that show the sheet (lazy, like every tab's own game data) */
const SHEET_FILES = ['charsheet', 'itemtext'] as const;

export type CharacterSheetState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: unknown; readonly retry: () => void }
  | {
      readonly status: 'ready';
      /** The sheet for the chosen difficulty with the buffs switched on */
      readonly sheet: CharacterSheet;
      /** The same without buffs, when buffs are on (null otherwise): what a changed number was */
      readonly unbuffed: CharacterSheet | null;
      readonly availableBuffs: readonly AvailableBuff[];
      readonly data: SheetData;
      readonly difficulty: DifficultyIndex;
      readonly setDifficulty: (difficulty: DifficultyIndex) => void;
      readonly buffs: readonly BuffSelection[];
      readonly setBuffs: (buffs: readonly BuffSelection[]) => void;
    };

/**
 * The computed sheet of `character`, shared by the tabs: computed once per (character, difficulty, buffs) in the page's
 * sheet cache, with the view state (difficulty, buffs) from CharacterSheetProvider.
 */
export function useCharacterSheet(character: CharacterFile): CharacterSheetState {
  const view = useSheetView();
  const gameData = useGameData(SHEET_FILES);
  if (gameData.status === 'loading') return { status: 'loading' };
  if (gameData.status === 'error') return { status: 'error', error: gameData.error, retry: gameData.retry };
  const data = sheetCache.data(gameData.data.charsheet, gameData.data.itemtext);
  const difficulty = view.difficultyOf(character);
  const buffs = view.buffsOf(character);
  const sheet = sheetCache.sheet(data, character, difficulty, buffs);
  return {
    status: 'ready',
    sheet,
    unbuffed: buffs.length === 0 ? null : sheetCache.sheet(data, character, difficulty, []),
    availableBuffs: sheetCache.availableBuffs(data, character),
    data,
    difficulty,
    setDifficulty: (next) => {
      view.setDifficulty(character, next);
    },
    buffs,
    setBuffs: (next) => {
      view.setBuffs(character, next);
    },
  };
}

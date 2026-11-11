import { createContext, use } from 'react';
import type { BuffSelection } from '../engine/sheet/types';
import type { CharacterFile, DifficultyIndex } from '../parser/types';

export interface SheetViewContextValue {
  /** The difficulty the resists are shown for: the chosen one, else the save's */
  readonly difficultyOf: (character: CharacterFile) => DifficultyIndex;
  readonly setDifficulty: (character: CharacterFile, difficulty: DifficultyIndex) => void;
  readonly buffsOf: (character: CharacterFile) => readonly BuffSelection[];
  readonly setBuffs: (character: CharacterFile, buffs: readonly BuffSelection[]) => void;
}

export const SheetViewContext = createContext<SheetViewContextValue | null>(null);

/** The sheet's view state (CharacterSheetProvider) */
export function useSheetView(): SheetViewContextValue {
  const value = use(SheetViewContext);
  if (value === null) throw new Error('useSheetView must be used inside <CharacterSheetProvider>');
  return value;
}

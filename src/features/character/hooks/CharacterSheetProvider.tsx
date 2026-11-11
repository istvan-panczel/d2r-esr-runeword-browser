import { useState, type ReactNode } from 'react';
import type { BuffSelection } from '../engine/sheet/types';
import { parseBuffMemory } from '../engine/sheetView';
import type { DifficultyIndex } from '../parser/types';
import { SheetViewContext, type SheetViewContextValue } from './useSheetView';

/** Buff choices per character for this browser tab's session only (a reload keeps them, a new tab does not) */
const BUFF_MEMORY_KEY = 'myCharacter.buffs';
const NO_BUFFS: readonly BuffSelection[] = [];

function loadBuffMemory(): Record<string, BuffSelection[]> {
  try {
    return parseBuffMemory(sessionStorage.getItem(BUFF_MEMORY_KEY));
  } catch {
    return {};
  }
}

function saveBuffMemory(memory: Record<string, readonly BuffSelection[]>): void {
  try {
    sessionStorage.setItem(BUFF_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Storage blocked: the choices last until the page is left
  }
}

/**
 * The computed sheet's view state, shared by the My Character tabs: the difficulty and the buffs switched on, per
 * character (by name). Not in the URL; the difficulty lasts while the page is open, the buffs for the session.
 */
export function CharacterSheetProvider({ children }: { readonly children: ReactNode }) {
  const [difficulties, setDifficulties] = useState<Readonly<Record<string, DifficultyIndex>>>({});
  const [buffMemory, setBuffMemory] = useState<Readonly<Record<string, readonly BuffSelection[]>>>(loadBuffMemory);

  const value: SheetViewContextValue = {
    difficultyOf: (character) => difficulties[character.name] ?? character.progress.difficulty,
    setDifficulty: (character, difficulty) => {
      setDifficulties((previous) => ({ ...previous, [character.name]: difficulty }));
    },
    buffsOf: (character) => buffMemory[character.name] ?? NO_BUFFS,
    setBuffs: (character, selections) => {
      setBuffMemory((previous) => {
        const others = Object.entries(previous).filter(([name]) => name !== character.name);
        const next = Object.fromEntries(selections.length === 0 ? others : [...others, [character.name, selections]]);
        saveBuffMemory(next);
        return next;
      });
    },
  };
  return <SheetViewContext value={value}>{children}</SheetViewContext>;
}

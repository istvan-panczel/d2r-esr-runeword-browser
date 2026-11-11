import { useState, type ReactNode } from 'react';
import type { BuffSelection } from '../engine/sheet/types';
import {
  buffMemorySave,
  parseBuffMemory,
  rememberedBuffs,
  serializeBuffMemory,
  updateBuffMemory,
  type BuffMemoryEntry,
} from '../engine/sheetView';
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import { useCharacter } from './useCharacter';
import { SheetViewContext, type SheetViewContextValue } from './useSheetView';

/** Buff choices per character for this browser tab's session only (a reload keeps them, a new tab does not) */
const BUFF_MEMORY_KEY = 'myCharacter.buffs';
const NO_BUFFS: readonly BuffSelection[] = [];

function loadBuffMemory(): Map<string, BuffMemoryEntry> {
  try {
    return parseBuffMemory(sessionStorage.getItem(BUFF_MEMORY_KEY));
  } catch {
    return new Map();
  }
}

function saveBuffMemory(memory: ReadonlyMap<string, BuffMemoryEntry>): void {
  try {
    sessionStorage.setItem(BUFF_MEMORY_KEY, serializeBuffMemory(memory));
  } catch {
    // Storage blocked: the choices last until the page is left
  }
}

/**
 * The computed sheet's view state, shared by the My Character tabs: the difficulty and the buffs switched on, per
 * character (by name, in Maps: a character may be called "constructor"). Not in the URL; the difficulty lasts while the
 * page is open, the buffs for the session and only for the save they were chosen for (a replaced, removed or uploaded
 * again character starts unbuffed; characters no longer stored are dropped from the memory on the next change).
 */
export function CharacterSheetProvider({ children }: { readonly children: ReactNode }) {
  const { entries } = useCharacter();
  const [difficulties, setDifficulties] = useState<ReadonlyMap<string, DifficultyIndex>>(() => new Map());
  const [buffMemory, setBuffMemory] = useState<ReadonlyMap<string, BuffMemoryEntry>>(loadBuffMemory);
  const saveOf = (character: CharacterFile) =>
    buffMemorySave(character, entries.find((entry) => entry.key === character.name)?.file.uploadedAt ?? null);

  const value: SheetViewContextValue = {
    difficultyOf: (character) => difficulties.get(character.name) ?? character.progress.difficulty,
    setDifficulty: (character, difficulty) => {
      setDifficulties((previous) => new Map(previous).set(character.name, difficulty));
    },
    buffsOf: (character) => rememberedBuffs(buffMemory, character.name, saveOf(character)) ?? NO_BUFFS,
    setBuffs: (character, selections) => {
      const save = saveOf(character);
      setBuffMemory((previous) => {
        const next = updateBuffMemory(previous, character.name, { save, selections }, (name) =>
          entries.some((entry) => entry.key === name)
        );
        saveBuffMemory(next);
        return next;
      });
    },
  };
  return <SheetViewContext value={value}>{children}</SheetViewContext>;
}

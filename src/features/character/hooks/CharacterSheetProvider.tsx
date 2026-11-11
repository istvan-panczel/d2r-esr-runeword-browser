import { useState, type ReactNode } from 'react';
import type { BuffSelection, WhatIfEntries } from '../engine/sheet/types';
import { NO_WHAT_IF } from '../engine/sheet/whatIf';
import {
  buffMemorySave,
  parseBuffMemory,
  rememberedBuffs,
  serializeBuffMemory,
  updateBuffMemory,
  type BuffMemoryEntry,
} from '../engine/sheetView';
import {
  parseWhatIfMemory,
  rememberedWhatIf,
  serializeWhatIfMemory,
  updateWhatIfMemory,
  type WhatIfMemoryEntry,
} from '../engine/whatIfView';
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

/** What-if entries per character, kept like the buffs: this browser tab's session, the save they were made for */
const WHAT_IF_MEMORY_KEY = 'myCharacter.whatIf';

function loadWhatIfMemory(): Map<string, WhatIfMemoryEntry> {
  try {
    return parseWhatIfMemory(sessionStorage.getItem(WHAT_IF_MEMORY_KEY));
  } catch {
    return new Map();
  }
}

function saveWhatIfMemory(memory: ReadonlyMap<string, WhatIfMemoryEntry>): void {
  try {
    sessionStorage.setItem(WHAT_IF_MEMORY_KEY, serializeWhatIfMemory(memory));
  } catch {
    // Storage blocked: the entries last until the page is left
  }
}

/**
 * The computed sheet's view state, shared by the My Character tabs: the difficulty, the buffs switched on and the
 * what-if entries, per character (by name, in Maps: a character may be called "constructor"). Not in the URL; the
 * difficulty lasts while the page is open, the buffs and what-if entries for the session and only for the save they were
 * chosen for (a replaced, removed or uploaded again character starts plain; characters no longer stored are dropped
 * from the memory on the next change).
 */
export function CharacterSheetProvider({ children }: { readonly children: ReactNode }) {
  const { entries } = useCharacter();
  const [difficulties, setDifficulties] = useState<ReadonlyMap<string, DifficultyIndex>>(() => new Map());
  const [buffMemory, setBuffMemory] = useState<ReadonlyMap<string, BuffMemoryEntry>>(loadBuffMemory);
  const [whatIfMemory, setWhatIfMemory] = useState<ReadonlyMap<string, WhatIfMemoryEntry>>(loadWhatIfMemory);
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
    whatIfOf: (character) => rememberedWhatIf(whatIfMemory, character.name, saveOf(character)) ?? NO_WHAT_IF,
    setWhatIf: (character, whatIf: WhatIfEntries) => {
      const save = saveOf(character);
      setWhatIfMemory((previous) => {
        const next = updateWhatIfMemory(previous, character.name, { save, entries: whatIf }, (name) =>
          entries.some((entry) => entry.key === name)
        );
        saveWhatIfMemory(next);
        return next;
      });
    },
  };
  return <SheetViewContext value={value}>{children}</SheetViewContext>;
}

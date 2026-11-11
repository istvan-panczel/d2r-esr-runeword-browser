/**
 * Computed sheets shared by the My Character tabs: one SheetData per loaded bundle pair, one sheet per (character,
 * difficulty, buffs) and one buff list per character. Explicit memoisation on purpose: a sheet takes several evaluation
 * passes, and React Compiler's memoisation is per component instance, so every tab (and a tab switch) would compute it
 * again. Weak keys: a re-parsed character or a reloaded bundle drops its entries with the old objects.
 */
import type { CharSheetBundle, ItemTextBundle } from '@/features/game-data/engine/schema';
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import { computeCharacterSheet, createSheetData, listAvailableBuffs, type SheetData } from './sheet';
import type { AvailableBuff, BuffSelection, CharacterSheet } from './sheet/types';
import { buffsKey } from './sheetView';

/** Sheets kept per character (difficulty × buff combinations); the oldest goes first */
const SHEETS_PER_CHARACTER = 24;

export interface SheetEngine {
  readonly createData: typeof createSheetData;
  readonly compute: typeof computeCharacterSheet;
  readonly listBuffs: typeof listAvailableBuffs;
}

export interface SheetCache {
  data(charsheet: CharSheetBundle, itemtext: ItemTextBundle): SheetData;
  sheet(data: SheetData, character: CharacterFile, difficulty: DifficultyIndex, buffs: readonly BuffSelection[]): CharacterSheet;
  availableBuffs(data: SheetData, character: CharacterFile): AvailableBuff[];
}

const DEFAULT_ENGINE: SheetEngine = { createData: createSheetData, compute: computeCharacterSheet, listBuffs: listAvailableBuffs };

export function createSheetCache(engine: SheetEngine = DEFAULT_ENGINE): SheetCache {
  const dataCache = new WeakMap<CharSheetBundle, WeakMap<ItemTextBundle, SheetData>>();
  const sheets = new WeakMap<SheetData, WeakMap<CharacterFile, Map<string, CharacterSheet>>>();
  const buffs = new WeakMap<SheetData, WeakMap<CharacterFile, AvailableBuff[]>>();

  const inner = <K extends object, V extends object>(outer: WeakMap<K, V>, key: K, create: () => V): V => {
    const found = outer.get(key);
    if (found !== undefined) return found;
    const made = create();
    outer.set(key, made);
    return made;
  };

  return {
    data(charsheet, itemtext) {
      const byText = inner(dataCache, charsheet, () => new WeakMap<ItemTextBundle, SheetData>());
      return inner(byText, itemtext, () => engine.createData(charsheet, itemtext));
    },
    sheet(data, character, difficulty, selections) {
      const byCharacter = inner(sheets, data, () => new WeakMap<CharacterFile, Map<string, CharacterSheet>>());
      const list = inner(byCharacter, character, () => new Map<string, CharacterSheet>());
      const key = `${String(difficulty)}|${buffsKey(selections)}`;
      const found = list.get(key);
      if (found !== undefined) return found;
      const sheet = engine.compute(character, data, selections.length === 0 ? { difficulty } : { difficulty, buffs: selections });
      if (list.size >= SHEETS_PER_CHARACTER) {
        const oldest = list.keys().next();
        if (oldest.done !== true) list.delete(oldest.value);
      }
      list.set(key, sheet);
      return sheet;
    },
    availableBuffs(data, character) {
      const byCharacter = inner(buffs, data, () => new WeakMap<CharacterFile, AvailableBuff[]>());
      return inner(byCharacter, character, () => engine.listBuffs(character, data));
    },
  };
}

/** The page's cache */
export const sheetCache = createSheetCache();

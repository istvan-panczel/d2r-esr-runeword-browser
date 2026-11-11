/**
 * The pure part of useCharacterSheet: the sheet data, the buff list, the selections that count and the sheets, from the
 * page's sheet cache. Never throws: an engine failure on one save becomes `failed` with a message, so the page keeps its
 * switcher and the other tabs instead of falling to the route error screen.
 */
import type { CharSheetBundle, ItemTextBundle } from '@/features/game-data/engine/schema';
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import type { SheetData } from './sheet';
import type { AvailableBuff, BuffSelection, CharacterSheet } from './sheet/types';
import type { SheetCache } from './sheetCache';
import { usableSelections } from './sheetView';

export type SheetViewResult =
  | { readonly status: 'failed'; readonly message: string }
  | {
      readonly status: 'ready';
      /** The sheet for the chosen difficulty with the buffs switched on */
      readonly sheet: CharacterSheet;
      /** The same without buffs, when buffs are on (null otherwise): what a changed number was */
      readonly unbuffed: CharacterSheet | null;
      readonly availableBuffs: readonly AvailableBuff[];
      readonly data: SheetData;
      /** The remembered selections this character can use (others never change the numbers) */
      readonly buffs: readonly BuffSelection[];
    };

export function computeSheetView(
  cache: SheetCache,
  bundles: { readonly charsheet: CharSheetBundle; readonly itemtext: ItemTextBundle },
  character: CharacterFile,
  difficulty: DifficultyIndex,
  remembered: readonly BuffSelection[]
): SheetViewResult {
  try {
    const data = cache.data(bundles.charsheet, bundles.itemtext);
    const availableBuffs = cache.availableBuffs(data, character);
    const buffs = usableSelections(remembered, availableBuffs);
    return {
      status: 'ready',
      sheet: cache.sheet(data, character, difficulty, buffs),
      unbuffed: buffs.length === 0 ? null : cache.sheet(data, character, difficulty, []),
      availableBuffs,
      data,
      buffs,
    };
  } catch (error) {
    console.error(`[Character] Could not work out the sheet of ${character.name}:`, error);
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

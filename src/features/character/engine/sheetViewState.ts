/**
 * The pure part of useCharacterSheet: the sheet data, the buff list, the selections that count and the sheets, from the
 * page's sheet cache. Never throws: an engine failure on one save becomes `failed` with a message, so the page keeps its
 * switcher and the other tabs instead of falling to the route error screen.
 */
import type { CharSheetBundle, ItemTextBundle } from '@/features/game-data/engine/schema';
import type { CharacterFile, DifficultyIndex } from '../parser/types';
import type { SheetData } from './sheet';
import type { AvailableBuff, BuffSelection, CharacterSheet, WhatIfEntries } from './sheet/types';
import { hasWhatIf, NO_WHAT_IF } from './sheet/whatIf';
import type { SheetCache } from './sheetCache';
import { usableSelections } from './sheetView';

export type SheetViewResult =
  | { readonly status: 'failed'; readonly message: string }
  | {
      readonly status: 'ready';
      /** The sheet for the chosen difficulty with the buffs switched on and the what-if entries */
      readonly sheet: CharacterSheet;
      /** The same without buffs and what-if entries, when any are on (null otherwise): what a changed number was */
      readonly unbuffed: CharacterSheet | null;
      /** The same with the buffs but without the what-if entries, when any count (null otherwise): the what-if diff's base */
      readonly withoutWhatIf: CharacterSheet | null;
      readonly availableBuffs: readonly AvailableBuff[];
      readonly data: SheetData;
      /** The remembered selections this character can use (others never change the numbers) */
      readonly buffs: readonly BuffSelection[];
      /** The remembered what-if entries of this character's save (the rows, zero values included) */
      readonly whatIf: WhatIfEntries;
    };

export function computeSheetView(
  cache: SheetCache,
  bundles: { readonly charsheet: CharSheetBundle; readonly itemtext: ItemTextBundle },
  character: CharacterFile,
  difficulty: DifficultyIndex,
  remembered: readonly BuffSelection[],
  whatIf: WhatIfEntries = NO_WHAT_IF
): SheetViewResult {
  try {
    const data = cache.data(bundles.charsheet, bundles.itemtext);
    const availableBuffs = cache.availableBuffs(data, character);
    const buffs = usableSelections(remembered, availableBuffs);
    const extra = hasWhatIf(whatIf);
    return {
      status: 'ready',
      sheet: cache.sheet(data, character, difficulty, buffs, whatIf),
      unbuffed: buffs.length === 0 && !extra ? null : cache.sheet(data, character, difficulty, []),
      withoutWhatIf: extra ? cache.sheet(data, character, difficulty, buffs) : null,
      availableBuffs,
      data,
      buffs,
      whatIf,
    };
  } catch (error) {
    console.error(`[Character] Could not work out the sheet of ${character.name}:`, error);
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

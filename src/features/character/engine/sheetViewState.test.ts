import { describe, expect, it, vi } from 'vitest';
import { computeCharacterSheet, listAvailableBuffs } from './sheet';
import { charSheetBundle, itemTextBundle, sheetData, testCharacter } from './sheet/testSheet.mock';
import { createSheetCache } from './sheetCache';
import { computeSheetView } from './sheetViewState';

const BUNDLES = { charsheet: charSheetBundle, itemtext: itemTextBundle };
const BATTLE_ORDERS = 570;
const FERAL_RAGE = 608;

describe('computeSheetView', () => {
  it('gives the failed state with the message when the engine throws, instead of throwing during render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cache = createSheetCache({
      createData: () => sheetData,
      compute: () => {
        throw new Error('boom');
      },
      listBuffs: listAvailableBuffs,
    });
    expect(computeSheetView(cache, BUNDLES, testCharacter(), 2, [])).toEqual({ status: 'failed', message: 'boom' });
  });

  it('counts only remembered buffs the character can use: a stale selection never changes the numbers', () => {
    const cache = createSheetCache({ createData: () => sheetData, compute: computeCharacterSheet, listBuffs: listAvailableBuffs });
    // A barbarian with Battle Orders; the memory also holds a Druid skill at level 20 (a same-name character of before)
    const character = testCharacter({ skills: { [BATTLE_ORDERS]: 1 }, attributes: { maxhp: 100 * 256 } });
    const result = computeSheetView(cache, BUNDLES, character, 2, [{ skillId: FERAL_RAGE, level: 20 }, { skillId: BATTLE_ORDERS }]);
    if (result.status !== 'ready') throw new Error(result.message);
    expect(result.buffs).toEqual([{ skillId: BATTLE_ORDERS }]);
    expect(result.sheet.buffs.map((buff) => buff.skillId)).toEqual([BATTLE_ORDERS]);
    const stale = computeSheetView(cache, BUNDLES, character, 2, [{ skillId: FERAL_RAGE, level: 20 }]);
    if (stale.status !== 'ready') throw new Error(stale.message);
    expect(stale.buffs).toEqual([]);
    expect(stale.unbuffed).toBeNull();
    expect(stale.sheet.buffs).toEqual([]);
  });
});

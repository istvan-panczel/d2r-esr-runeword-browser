import { describe, expect, it } from 'vitest';
import { emptyItem } from '../../stash/parser/parseItem.ts';
import type { StashItem } from '../../stash/parser/types.ts';
import { equippedGear, locationOf, NO_UNIQUE_ROW, toCharacterItem } from './location.ts';

function item(fields: Partial<StashItem>): StashItem {
  return { ...emptyItem({ section: 0, index: 0 }, 0), ...fields };
}

describe('locationOf', () => {
  it('names the stored locations, with the ESR charm inventory at store 7', () => {
    expect(locationOf(item({ mode: 0, storePage: 1, x: 2, y: 3 }), false)).toEqual({ kind: 'inventory', x: 2, y: 3 });
    expect(locationOf(item({ mode: 0, storePage: 4, x: 1, y: 1 }), false)).toEqual({ kind: 'cube', x: 1, y: 1 });
    expect(locationOf(item({ mode: 0, storePage: 5, x: 0, y: 12 }), false)).toEqual({ kind: 'stash', x: 0, y: 12 });
    expect(locationOf(item({ mode: 0, storePage: 7, x: 7, y: 7 }), false)).toEqual({ kind: 'charm', x: 7, y: 7 });
  });

  it('names the belt slot and socket', () => {
    expect(locationOf(item({ mode: 2, x: 13 }), false)).toEqual({ kind: 'belt', slot: 13 });
    expect(locationOf(item({ mode: 6, x: 2 }), false)).toEqual({ kind: 'socketed', socket: 2 });
  });

  it('keeps an unknown store page as unknown, not as garbage', () => {
    expect(locationOf(item({ mode: 0, storePage: 2 }), false)).toEqual({ kind: 'unknown', mode: 0, body: 0, store: 2 });
    expect(locationOf(item({ mode: 1, bodyLocation: 13 }), false)).toEqual({ kind: 'unknown', mode: 1, body: 13, store: 0 });
  });

  it.each([
    [4, false, 'rightHand', 1],
    [5, false, 'leftHand', 1],
    [11, false, 'rightHand', 2],
    [12, false, 'leftHand', 2],
    [4, true, 'rightHand', 2],
    [5, true, 'leftHand', 2],
    [11, true, 'rightHand', 1],
    [12, true, 'leftHand', 1],
  ] as const)('body %i, active set II %s: %s of set %i', (body, swapped, slot, weaponSet) => {
    expect(locationOf(item({ mode: 1, bodyLocation: body }), swapped)).toEqual({ kind: 'equipped', slot, weaponSet, rawBody: body });
  });

  it('does not give non-hand slots a weapon set', () => {
    expect(locationOf(item({ mode: 1, bodyLocation: 3 }), true)).toEqual({ kind: 'equipped', slot: 'torso', weaponSet: null, rawBody: 3 });
  });
});

describe('toCharacterItem and equippedGear', () => {
  it('drops the quest sentinel and maps the socketed children', () => {
    const converted = toCharacterItem(
      item({ uniqueId: NO_UNIQUE_ROW, mode: 1, bodyLocation: 1, socketed: [item({ mode: 6, x: 0, uniqueId: 5 })] }),
      false
    );
    expect(converted.uniqueId).toBeNull();
    expect(converted.socketed[0]?.uniqueId).toBe(5);
    expect(converted.socketed[0]?.location).toEqual({ kind: 'socketed', socket: 0 });
  });

  it('builds the slot view with both weapon sets', () => {
    const items = [
      toCharacterItem(item({ mode: 1, bodyLocation: 1, code: 'hlm' }), true),
      toCharacterItem(item({ mode: 1, bodyLocation: 4, code: 'set2' }), true),
      toCharacterItem(item({ mode: 1, bodyLocation: 11, code: 'set1' }), true),
      toCharacterItem(item({ mode: 0, storePage: 1, code: 'none' }), true),
    ];
    const gear = equippedGear(items);
    expect(gear.head?.code).toBe('hlm');
    expect(gear.weaponSets[0].rightHand?.code).toBe('set1');
    expect(gear.weaponSets[1].rightHand?.code).toBe('set2');
  });
});

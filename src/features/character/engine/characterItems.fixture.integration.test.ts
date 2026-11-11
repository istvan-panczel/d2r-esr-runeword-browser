/**
 * The owner's in-game tooltip for SpinToWin (level 102) on Thunder Star (unique row 215, code 0fl), against the page's
 * item path. Skipped without the save (test-fixtures/character/, gitignored: personal saves).
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { ItemTextBundle, StashBundle, StashNamesBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { stashCatalog, withNames } from '@/features/stash/engine/catalog';
import { buildItemTypeIndex } from '@/features/stash/engine/itemTypes';
import { createItemTextContext, renderItemText } from '@/features/stash/engine/items/itemText';
import { createCharacterData } from '../parser/characterData';
import { parseCharacter } from '../parser/parseCharacter';
import { buildCharacterItems } from './characterItems';

const ROOT = resolve(__dirname, '../../../..');
const SAVE = resolve(ROOT, 'test-fixtures/character/SpinToWin.d2s');
const json = <T>(file: string) => JSON.parse(readFileSync(resolve(ROOT, 'public/game-data', file), 'utf-8')) as T;

describe.skipIf(!existsSync(SAVE))('SpinToWin against the in-game tooltip', () => {
  const bundle = json<StashBundle>('stash.json');
  const catalog = stashCatalog(
    withNames(bundle, json<StashNamesBundle>('stashnames.json')),
    buildItemTypeIndex(json<TypesBundle>('types.json').types)
  );
  const ctx = createItemTextContext(json<ItemTextBundle>('itemtext.json'), catalog);
  const character = parseCharacter(new Uint8Array(readFileSync(SAVE)), createCharacterData(bundle));
  const thunderStar = character.items.player.find((item) => item.code === '0fl' && item.uniqueId === 215);

  it('shows Thunder Star at level 102 like the game', () => {
    expect(character.level).toBe(102);
    if (thunderStar === undefined) throw new Error('no Thunder Star in the save');
    const text = renderItemText(thunderStar, ctx, { characterLevel: character.level });
    expect(text.base).toContain('One-Hand Damage: 25 to 397');
    expect(text.stats).toContain('+306% Enhanced Maximum Damage (Based on Character Level)');
  });

  it('keeps the stash text (no level) at the raw rate', () => {
    if (thunderStar === undefined) throw new Error('no Thunder Star in the save');
    const text = renderItemText(thunderStar, ctx);
    expect(text.base).toContain('One-Hand Damage: 25 to 171');
    expect(text.stats).toContain('+3% Enhanced Maximum Damage (Based on Character Level)');
  });

  it('gives the page the same lines, on weapon set II', () => {
    const view = buildCharacterItems(character, catalog, ctx);
    const row = view.weaponSets[1].slots.find((slot) => slot.key === 'rightHand')?.row;
    expect(row?.text.base).toContain('One-Hand Damage: 25 to 397');
    expect(row?.name).toBe('Thunder Star');
    expect(view.charms).toHaveLength(30);
    expect(view.ledgers.map((entry) => entry.inCharmInventory)).toEqual([true]);
    expect(view.ascendancyStones.map((entry) => entry.inCharmInventory)).toEqual([true]);
  });
});

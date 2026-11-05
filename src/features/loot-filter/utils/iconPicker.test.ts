import { describe, expect, it } from 'vitest';
import { BUNDLED_ICON_ASSETS, isGeneratedIcon } from './bundledAssets';
import { filterIcons, gridMove, ICON_PICKER_ICONS } from './iconPicker';

describe('ICON_PICKER_ICONS', () => {
  it('holds every bundled icon once, the generated ones first', () => {
    expect(ICON_PICKER_ICONS).toHaveLength(BUNDLED_ICON_ASSETS.length);
    expect(new Set(ICON_PICKER_ICONS.map((asset) => asset.name)).size).toBe(BUNDLED_ICON_ASSETS.length);
    const firstSully = ICON_PICKER_ICONS.findIndex((asset) => !isGeneratedIcon(asset));
    expect(firstSully).toBeGreaterThan(0);
    expect(ICON_PICKER_ICONS.slice(firstSully).every((asset) => !isGeneratedIcon(asset))).toBe(true);
    expect(ICON_PICKER_ICONS[0].name).toBe('star_gold');
  });
});

describe('filterIcons', () => {
  it('lists every icon for an empty query, whatever icon is chosen', () => {
    expect(filterIcons('')).toBe(ICON_PICKER_ICONS);
    expect(filterIcons('   ')).toBe(ICON_PICKER_ICONS);
  });

  it('matches anywhere in the name, label or use, any case, every word', () => {
    expect(filterIcons('GOLD').map((asset) => asset.name)).toEqual(
      expect.arrayContaining(['star_gold', 'crown_gold', 'coin_gold', 'goldstar'])
    );
    expect(filterIcons('crown purple').map((asset) => asset.name)).toEqual(['crown_purple']);
    expect(filterIcons('runeword').map((asset) => asset.name)).toContain('shield_white');
    expect(filterIcons('nothing like this')).toEqual([]);
  });
});

describe('gridMove', () => {
  it('moves by a tile or a row and stays inside the grid', () => {
    expect(gridMove(0, 'ArrowRight', 10, 4)).toBe(1);
    expect(gridMove(9, 'ArrowRight', 10, 4)).toBe(9);
    expect(gridMove(0, 'ArrowLeft', 10, 4)).toBe(0);
    expect(gridMove(1, 'ArrowDown', 10, 4)).toBe(5);
    expect(gridMove(7, 'ArrowDown', 10, 4)).toBe(7);
    expect(gridMove(5, 'ArrowUp', 10, 4)).toBe(1);
    expect(gridMove(2, 'ArrowUp', 10, 4)).toBe(2);
    expect(gridMove(5, 'Home', 10, 4)).toBe(0);
    expect(gridMove(5, 'End', 10, 4)).toBe(9);
  });

  it('starts at the first tile and ignores other keys', () => {
    expect(gridMove(-1, 'ArrowDown', 10, 4)).toBe(0);
    expect(gridMove(-1, 'a', 10, 4)).toBeUndefined();
    expect(gridMove(3, 'Enter', 10, 4)).toBeUndefined();
    expect(gridMove(0, 'ArrowDown', 0, 4)).toBeUndefined();
  });
});

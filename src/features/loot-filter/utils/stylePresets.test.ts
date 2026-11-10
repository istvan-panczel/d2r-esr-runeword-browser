import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { findColorCode } from '../engine/colors';
import { parseLootFilter } from '../engine/parse';
import { buildLootFilterReference } from '../engine/reference';
import { serializeLootFilter } from '../engine/serialize';
import { validateLootFilter } from '../engine/validate';
import { findBundledIconAsset } from './bundledAssets';
import {
  presetPreviewText,
  presetStyleStatus,
  sameIcon,
  sameStyle,
  STYLE_PRESETS,
  stylePreset,
  stylePreviewText,
  styleWithoutIcon,
} from './stylePresets';

const json = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data', file), 'utf8')) as unknown;
const reference = buildLootFilterReference(json('lootfilter.json') as LootFilterDataBundle, json('types.json') as TypesBundle);

describe('STYLE_PRESETS', () => {
  it('has 12 to 20 presets with unique ids and names, a label, a description and a sample each', () => {
    expect(STYLE_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(STYLE_PRESETS.length).toBeLessThanOrEqual(20);
    expect(new Set(STYLE_PRESETS.map((preset) => preset.id)).size).toBe(STYLE_PRESETS.length);
    expect(new Set(STYLE_PRESETS.map((preset) => preset.name.toLowerCase())).size).toBe(STYLE_PRESETS.length);
    for (const preset of STYLE_PRESETS) {
      expect(preset.label).not.toBe('');
      expect(preset.description).toMatch(/\.$/);
      expect(preset.sample).not.toBe('');
      expect(preset.name).toMatch(/^[A-Za-z]+$/);
    }
  });

  it("uses no style name of Sully's template but MidRune, so starting from it and adding a preset rarely meets one of his", () => {
    const sully = parseLootFilter(readFileSync(resolve(process.cwd(), 'public/loot-filters/sullys-qol-filter.json'), 'utf8')).filter;
    const his = new Set(Object.keys(sully.styles ?? {}).map((name) => name.toLowerCase()));
    expect(his.size).toBeGreaterThan(0);
    // Sully's v0.9.0 added a MidRune style of his own: picking the Mid rune preset in his filter uses his style (a style
    // of that name is never overwritten, `presetStyleStatus`). Any other clash is new: rename the preset or list it here.
    expect(STYLE_PRESETS.filter((preset) => his.has(preset.name.toLowerCase())).map((preset) => preset.name)).toEqual(['MidRune']);
  });

  it('holds the look and an icon only (no sound or chat line), with known colour codes', () => {
    for (const { id, style } of STYLE_PRESETS) {
      expect([style.sound, style.chatMessage, style.notify, style.hide], id).toEqual([undefined, undefined, undefined, undefined]);
      const name = typeof style.replaceName === 'string' ? style.replaceName : '';
      for (const [, code] of name.matchAll(/ÿc(.)/g)) expect(findColorCode(code), `${id} ÿc${code}`).toBeDefined();
    }
  });

  it('carries the generated icon that pairs with it, at 27 to 50 px; Low rune and Muted stay without one', () => {
    const icons = Object.fromEntries(STYLE_PRESETS.map((preset) => [preset.id, preset.style.icon?.iconName]));
    expect(icons).toEqual({
      'high-rune': 'diamond_red',
      'mid-rune': 'diamond_orange',
      'low-rune': undefined,
      unique: 'star_gold',
      set: 'star_green',
      mythical: 'star_purple',
      'runeword-base': 'shield_white',
      'good-charm': 'square_emerald',
      'good-jewel': 'hexagon_yellow',
      jewellery: 'ring_blue',
      uber: 'key_purple',
      'perfect-gem': 'gem_gold',
      crafting: 'flame_orange',
      'rare-reagent': 'coin_gold',
      coupon: 'scroll_gold',
      map: 'map_white',
      valuable: 'cross_red',
      muted: undefined,
    });
    for (const { id, label, style } of STYLE_PRESETS) {
      if (style.icon === undefined) continue;
      const asset = findBundledIconAsset(style.icon.iconName);
      expect(asset?.credit, id).toBe('Generated for this app');
      // The registry's note names the preset the icon pairs with.
      expect(asset?.use, id).toContain(`the ${label} preset`);
      expect(Object.keys(style.icon).sort(), id).toEqual(['iconName', 'iconSize']);
      expect(style.icon.iconSize, id).toBeGreaterThanOrEqual(27);
      expect(style.icon.iconSize, id).toBeLessThanOrEqual(50);
    }
  });

  it('writes, reads and validates every preset in one filter without a problem', () => {
    const styles = Object.fromEntries(STYLE_PRESETS.map((preset) => [preset.name, preset.style]));
    const rules = STYLE_PRESETS.map((preset) => ({ itemCodes: ['r51'], useStyle: preset.name }));
    const parsed = parseLootFilter(serializeLootFilter({ formatVersion: 1, styles, rules, leadingComments: [] }));
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.filter.styles).toEqual(styles);
    expect(validateLootFilter(parsed.filter, reference)).toEqual([]);
  });
});

describe('presetStyleStatus', () => {
  const high = stylePreset('high-rune');

  it('is missing without a style of that name, same for an equal one in any key order, different otherwise', () => {
    expect(presetStyleStatus(undefined, high)).toBe('missing');
    expect(presetStyleStatus({ Other: {} }, high)).toBe('missing');
    const reordered = Object.fromEntries(Object.entries(high.style).reverse());
    expect(presetStyleStatus({ HighRune: reordered }, high)).toBe('same');
    expect(presetStyleStatus({ HighRune: { ...high.style, sound: 'tink.mp3' } }, high)).toBe('different');
  });

  it('finds a preset added before the presets had icons different: the filter keeps it as it is', () => {
    expect(presetStyleStatus({ HighRune: styleWithoutIcon(high.style) }, high)).toBe('different');
  });

  it('compares nested values', () => {
    expect(sameStyle({ labelBorder: { color: [1, 2, 3], width: 1 } }, { labelBorder: { width: 1, color: [1, 2, 3] } })).toBe(true);
    expect(sameStyle({ labelBorder: { color: [1, 2, 3], width: 1 } }, { labelBorder: { color: [1, 2, 4], width: 1 } })).toBe(false);
  });
});

describe('presetPreviewText', () => {
  it('puts the sample name in place of {name}', () => {
    expect(presetPreviewText(stylePreset('high-rune'))).toBe('ÿc1Ber Rune');
    expect(presetPreviewText(stylePreset('runeword-base'))).toBe('Phase Blade');
    expect(stylePreviewText({ replaceName: 'ÿc4{name} [{name}]' }, 'Shako')).toBe('ÿc4Shako [Shako]');
  });

  it('draws a filter style as the label shows it: prefix and suffix, the enUS text, nothing when it hides', () => {
    expect(stylePreviewText({ namePrefix: 'ÿc1* ', nameSuffix: ' *' }, 'Shako')).toBe('ÿc1* Shako *');
    expect(stylePreviewText({ replaceName: { enUS: 'ÿc4{name}', deDE: 'ÿc4{name}!' } }, 'Shako')).toBe('ÿc4Shako');
    expect(stylePreviewText({ hide: true, replaceName: 'ÿc4{name}' }, 'Shako')).toBe('');
  });
});

describe('styleWithoutIcon and sameIcon', () => {
  it('drops the icon only, and returns a style without one as it is', () => {
    const unique = stylePreset('unique').style;
    const bare = styleWithoutIcon(unique);
    expect(bare.icon).toBeUndefined();
    expect({ ...bare, icon: unique.icon }).toEqual(unique);
    expect(styleWithoutIcon(bare)).toBe(bare);
  });

  it('compares icons by content, both absent being the same', () => {
    expect(sameIcon(undefined, undefined)).toBe(true);
    expect(sameIcon({ iconName: 'star_gold', iconSize: 30 }, { iconSize: 30, iconName: 'star_gold' })).toBe(true);
    expect(sameIcon({ iconName: 'star_gold', iconSize: 30 }, { iconName: 'star_gold', iconSize: 40 })).toBe(false);
    expect(sameIcon({ iconName: 'star_gold' }, undefined)).toBe(false);
    expect(sameIcon({ iconName: 'star_gold', color: [255, 0, 0] }, { iconName: 'star_gold' })).toBe(false);
  });
});

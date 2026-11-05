import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { findColorCode } from '../engine/colors';
import { parseLootFilter } from '../engine/parse';
import { buildLootFilterReference } from '../engine/reference';
import { serializeLootFilter } from '../engine/serialize';
import { validateLootFilter } from '../engine/validate';
import { presetPreviewText, presetStyleStatus, sameStyle, STYLE_PRESETS, stylePreset } from './stylePresets';

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

  it("uses no style name of Sully's template, so starting from it and adding a preset never meets one of his", () => {
    const sully = parseLootFilter(readFileSync(resolve(process.cwd(), 'public/loot-filters/sullys-qol-filter.json'), 'utf8')).filter;
    const his = new Set(Object.keys(sully.styles ?? {}).map((name) => name.toLowerCase()));
    expect(his.size).toBeGreaterThan(0);
    expect(STYLE_PRESETS.filter((preset) => his.has(preset.name.toLowerCase())).map((preset) => preset.name)).toEqual([]);
  });

  it('holds the look only (no sound, icon or chat line), with known colour codes', () => {
    for (const { id, style } of STYLE_PRESETS) {
      expect([style.sound, style.icon, style.chatMessage, style.notify, style.hide], id).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
      const name = typeof style.replaceName === 'string' ? style.replaceName : '';
      for (const [, code] of name.matchAll(/ÿc(.)/g)) expect(findColorCode(code), `${id} ÿc${code}`).toBeDefined();
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

  it('compares nested values', () => {
    expect(sameStyle({ labelBorder: { color: [1, 2, 3], width: 1 } }, { labelBorder: { width: 1, color: [1, 2, 3] } })).toBe(true);
    expect(sameStyle({ labelBorder: { color: [1, 2, 3], width: 1 } }, { labelBorder: { color: [1, 2, 4], width: 1 } })).toBe(false);
  });
});

describe('presetPreviewText', () => {
  it('puts the sample name in place of {name}', () => {
    expect(presetPreviewText(stylePreset('high-rune'))).toBe('ÿc1Ber Rune');
    expect(presetPreviewText(stylePreset('runeword-base'))).toBe('Phase Blade');
  });
});

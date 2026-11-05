import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeSprite } from '../../src/features/loot-filter/engine/sprite.ts';
import { encodeSprite } from '../../src/features/loot-filter/engine/spriteEncode.ts';
import { BUNDLED_ICON_ASSETS, findBundledIconAsset } from '../../src/features/loot-filter/utils/bundledAssets.ts';
import { REPO_ROOT } from './esrClone.ts';
import { GENERATED_ICONS, ICON_COLORS, ICON_SHAPES, ICON_SIZE, renderIcon } from './lootFilterIcons.ts';

const ICONS_DIR = join(REPO_ROOT, 'public', 'loot-filters', 'icons');
const readIcon = (name: string) => new Uint8Array(readFileSync(join(ICONS_DIR, `${name}.sprite`)));
const SULLYS = ['charm', 'cube', 'gem', 'gem2', 'gemP', 'goldstar', 'map', 'Myth', 'redD', 'rune', 'scroll', 'star'];

describe('generated loot filter icons', () => {
  it('names each `<shape>_<colour>` once, with no clash with another bundled icon in any case', () => {
    for (const icon of GENERATED_ICONS) {
      expect(icon.name).toBe(`${icon.shape}_${icon.color}`);
      expect(Object.keys(ICON_SHAPES)).toContain(icon.shape);
      expect(Object.keys(ICON_COLORS)).toContain(icon.color);
    }
    const names = GENERATED_ICONS.map((icon) => icon.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const name of SULLYS) expect(names).not.toContain(name.toLowerCase());
  });

  it('registers every one (after Sully’s, in the same order) with the app credit and no low graphics file', () => {
    expect(BUNDLED_ICON_ASSETS.slice(12).map((asset) => asset.name)).toEqual(GENERATED_ICONS.map((icon) => icon.name));
    expect(
      BUNDLED_ICON_ASSETS.slice(0, 12)
        .map((asset) => asset.name)
        .sort()
    ).toEqual([...SULLYS].sort());
    for (const icon of GENERATED_ICONS) {
      const asset = findBundledIconAsset(icon.name);
      expect(asset?.credit, icon.name).toBe('Generated for this app');
      expect(asset?.lowend, icon.name).toBeUndefined();
    }
  });

  it.each(GENERATED_ICONS.map((icon) => [icon.name, icon] as const))(
    '%s.sprite is up to date (npm run loot-filter:icons)',
    (name, icon) => {
      const expected = encodeSprite({ width: ICON_SIZE, height: ICON_SIZE, rgba: renderIcon(icon) });
      const bytes = readIcon(name);
      expect(bytes.length).toBe(expected.length);
      expect(Buffer.from(bytes).equals(Buffer.from(expected))).toBe(true);
    }
  );

  it.each(GENERATED_ICONS.map((icon) => icon.name))('%s.sprite has the header of Sully’s 128 px icons and decodes', (name) => {
    const bytes = readIcon(name);
    // Every field of the 40-byte header, not only the ones the decoder reads.
    expect(Array.from(bytes.subarray(0, 40))).toEqual(Array.from(readIcon('star').subarray(0, 40)));
    const sprite = decodeSprite(bytes);
    expect(sprite).toMatchObject({ width: ICON_SIZE, height: ICON_SIZE, frames: 1 });
    expect(bytes.length).toBe(40 + ICON_SIZE * ICON_SIZE * 4);
  });

  it.each(GENERATED_ICONS.map((icon) => [icon.name, icon] as const))(
    '%s has a transparent border, an opaque middle and clean transparent pixels',
    (name, icon) => {
      const { rgba } = decodeSprite(readIcon(name));
      const alphaAt = (x: number, y: number) => rgba[(y * ICON_SIZE + x) * 4 + 3];
      for (let i = 0; i < ICON_SIZE; i++) {
        for (const [x, y] of [
          [i, 0],
          [i, ICON_SIZE - 1],
          [0, i],
          [ICON_SIZE - 1, i],
        ] as const) {
          expect(alphaAt(x, y), `${name} ${String(x)},${String(y)}`).toBe(0);
        }
      }
      // Fully transparent pixels are 0,0,0,0, as in Sully's files.
      for (let offset = 0; offset < rgba.length; offset += 4) {
        if (rgba[offset + 3] === 0) expect(rgba[offset] + rgba[offset + 1] + rgba[offset + 2]).toBe(0);
      }
      let opaque = 0;
      for (let offset = 3; offset < rgba.length; offset += 4) if (rgba[offset] === 255) opaque++;
      // Bold silhouettes: at least a quarter of the square opaque (Sully's icons: 19 to 65%).
      expect(opaque / (ICON_SIZE * ICON_SIZE), name).toBeGreaterThan(0.25);
      expect(icon.shape === 'ring' || icon.shape === 'key' || alphaAt(64, 64) === 255).toBe(true);
    }
  );
});

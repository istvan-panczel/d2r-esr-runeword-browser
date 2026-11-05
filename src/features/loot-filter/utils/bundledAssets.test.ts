import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeSprite } from '../engine/sprite';
import {
  BUNDLED_ICON_ASSETS,
  BUNDLED_ICONS,
  BUNDLED_SOUND_ASSETS,
  BUNDLED_SOUNDS,
  DEFAULT_ICON_NAME,
  findBundledIcon,
  findBundledIconAsset,
  findBundledSound,
} from './bundledAssets';

const folder = (name: string) => resolve(process.cwd(), 'public/loot-filters', name);

describe('bundled asset registry', () => {
  it('lists exactly the sound files in public/loot-filters/sounds', () => {
    const files = readdirSync(folder('sounds')).filter((file) => /\.(mp3|wav|flac)$/i.test(file));
    expect([...BUNDLED_SOUNDS].sort()).toEqual(files.sort());
  });

  it('lists exactly the icons in public/loot-filters/icons (a low graphics variant only where flagged), and every icon decodes', () => {
    const files = readdirSync(folder('icons')).filter((file) => file.endsWith('.sprite'));
    const expected = BUNDLED_ICON_ASSETS.flatMap((asset) =>
      asset.lowend === true ? [`${asset.name}.sprite`, `${asset.name}.lowend.sprite`] : [`${asset.name}.sprite`]
    );
    expect(expected.sort()).toEqual(files.sort());
    for (const file of files) expect(decodeSprite(readFileSync(resolve(folder('icons'), file))).width, file).toBeGreaterThan(0);
  });

  it('gives every asset a label, a use and a credit, with unique names in any case', () => {
    for (const asset of [...BUNDLED_SOUND_ASSETS, ...BUNDLED_ICON_ASSETS]) {
      expect(asset.label).not.toBe('');
      expect(asset.use).toMatch(/\.$/);
      expect(asset.credit).not.toBe('');
    }
    expect(new Set(BUNDLED_SOUNDS.map((name) => name.toLowerCase())).size).toBe(BUNDLED_SOUNDS.length);
    expect(new Set(BUNDLED_ICONS.map((name) => name.toLowerCase())).size).toBe(BUNDLED_ICONS.length);
    expect(DEFAULT_ICON_NAME).toBe('goldstar');
  });

  it('finds files case-insensitively, icons with or without .sprite', () => {
    expect(findBundledSound(' TINK.mp3 ')).toBe('tink.mp3');
    expect(findBundledSound(12)).toBeUndefined();
    expect(findBundledSound('item_rune')).toBeUndefined();
    expect(findBundledIcon('gemp')).toBe('gemP');
    expect(findBundledIcon('MYTH.sprite')).toBe('Myth');
    expect(findBundledIconAsset('goldstar')?.lowend).toBe(true);
    expect(findBundledIcon('nope')).toBeUndefined();
  });
});

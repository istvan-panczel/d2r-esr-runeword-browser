import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeSprite } from '../engine/sprite';
import type { LootFilter } from '../engine/types';
import { BUNDLED_ICON_ASSETS } from './bundledAssets';
import { collectReferencedAssets, isSoundFile, referencedAssetsOfText } from './referencedAssets';
import { lootFilterAssetUrl } from './template';

const filter = (parts: Partial<LootFilter>): LootFilter => ({ formatVersion: 1, rules: [], leadingComments: [], ...parts });
const paths = (assets: { readonly bundled: readonly { readonly path: string }[] }) => assets.bundled.map((file) => file.path);

describe('isSoundFile', () => {
  it('accepts .wav, .mp3 and .flac names only', () => {
    expect(isSoundFile('gong.mp3')).toBe(true);
    expect(isSoundFile('Alarm.WAV')).toBe(true);
    expect(isSoundFile('song.flac ')).toBe(true);
    expect(isSoundFile('item_rune')).toBe(false);
    expect(isSoundFile(42)).toBe(false);
    expect(isSoundFile(undefined)).toBe(false);
  });
});

describe('collectReferencedAssets', () => {
  it('collects sounds and icons from rules and styles, once each', () => {
    const assets = collectReferencedAssets(
      filter({
        styles: { Unique: { sound: 'unique.mp3', icon: { iconName: 'goldstar' } } },
        rules: [{ sound: 'GONG.mp3' }, { sound: 'unique.mp3', icon: { iconName: 'Goldstar.sprite' } }, { useStyle: 'Unique' }],
      })
    );
    expect(paths(assets)).toEqual(['sounds/unique.mp3', 'icons/goldstar.sprite', 'icons/goldstar.lowend.sprite', 'sounds/gong.mp3']);
    expect(assets.bundled[0]?.url).toBe(lootFilterAssetUrl('sounds/unique.mp3'));
    expect(assets.missing).toEqual([]);
  });

  it('ignores sounds.txt names and row numbers', () => {
    const assets = collectReferencedAssets(filter({ rules: [{ sound: 'item_rune' }, { sound: 12 }] }));
    expect(assets).toEqual({ bundled: [], missing: [] });
  });

  it('lists files the app does not bundle as missing', () => {
    const assets = collectReferencedAssets(
      filter({
        rules: [
          { sound: 'my sound.wav' },
          { sound: 'My Sound.wav' },
          { icon: { iconName: 'skull' } },
          { icon: { iconName: 'heart.sprite' } },
          { sound: 'tink.mp3' },
        ],
      })
    );
    expect(assets.missing).toEqual(['sounds/my sound.wav', 'icons/skull.sprite', 'icons/heart.sprite']);
    expect(paths(assets)).toEqual(['sounds/tink.mp3']);
  });

  it('writes bundled icons under the file name in its own case', () => {
    const assets = collectReferencedAssets(
      filter({ rules: [{ icon: { iconName: 'gemp' } }, { icon: { iconName: 'MYTH.sprite' } }, { icon: { iconName: 'rune' } }] })
    );
    expect(paths(assets)).toEqual(['icons/gemP.sprite', 'icons/Myth.sprite', 'icons/rune.sprite']);
    expect(assets.bundled[0]?.url).toBe(lootFilterAssetUrl('icons/gemP.sprite'));
    expect(assets.missing).toEqual([]);
  });

  it('encodes file names in the URL', () => {
    const assets = collectReferencedAssets(filter({ rules: [{ sound: 't5_map.mp3' }] }));
    expect(assets.bundled[0]?.url).toBe(lootFilterAssetUrl('sounds/t5_map.mp3'));
  });
});

describe('referencedAssetsOfText', () => {
  it("reads Sully's template v0.9.2: sounds, and all twelve of his bundled icons", () => {
    const text = readFileSync(resolve(process.cwd(), 'src/features/loot-filter/engine/__fixtures__/sullys-qol-filter-0.9.2.json'), 'utf8');
    const assets = referencedAssetsOfText(text);
    expect(assets.missing).toEqual([]);
    expect(paths(assets).filter((path) => path.startsWith('sounds/')).length).toBeGreaterThan(0);
    const icons = paths(assets).filter((path) => path.startsWith('icons/'));
    // All twelve of Sully's bundled icons (not the generated ones), plus goldstar's low graphics variant.
    const sullys = BUNDLED_ICON_ASSETS.filter((asset) => asset.credit !== 'Generated for this app');
    expect(sullys).toHaveLength(12);
    expect(icons).toHaveLength(sullys.length + 1);
  });

  // An invariant of the bundled copy, whatever version `npm run loot-filter:template` last fetched: the zip download
  // and the sandbox need every sound and icon it names.
  it('the bundled template: every sound and icon it references is bundled, and every icon decodes', () => {
    const text = readFileSync(resolve(process.cwd(), 'public/loot-filters/sullys-qol-filter.json'), 'utf8');
    const assets = referencedAssetsOfText(text);
    expect(assets.missing).toEqual([]);
    for (const path of paths(assets).filter((name) => name.startsWith('icons/'))) {
      const sprite = decodeSprite(readFileSync(resolve(process.cwd(), 'public/loot-filters', path)));
      expect(sprite.width, path).toBeGreaterThan(0);
    }
  });

  it('finds nothing in text that is not JSON', () => {
    expect(referencedAssetsOfText('{ nope')).toEqual({ bundled: [], missing: [] });
  });
});

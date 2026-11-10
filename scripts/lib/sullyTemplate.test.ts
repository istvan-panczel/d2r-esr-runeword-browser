import { describe, expect, it } from 'vitest';
import { BUNDLED_ICON_ASSETS, BUNDLED_SOUND_ASSETS } from '../../src/features/loot-filter/utils/bundledAssets.ts';
import { plural, unbundledAssets, upstreamAssetsOfTree } from './sullyTemplate.ts';

const blob = (path: string) => ({ path, type: 'blob' });

describe("Sully's template script", () => {
  it('reads the icons and sounds of a tree listing, nothing else', () => {
    const tree = {
      tree: [
        blob('Sullys-QoL-Filter.json'),
        { path: 'icons', type: 'tree' },
        blob('icons/goldstar.sprite'),
        blob('icons/goldstar.lowend.sprite'),
        blob('icons/readme.txt'),
        blob('icons/old/x.sprite'),
        blob('sounds/gong.mp3'),
        blob('sounds/new.WAV'),
      ],
      truncated: false,
    };
    expect(upstreamAssetsOfTree(tree)).toEqual({ icons: ['goldstar.lowend.sprite', 'goldstar.sprite'], sounds: ['gong.mp3', 'new.WAV'] });
    expect(upstreamAssetsOfTree({ ...tree, truncated: true })).toBeNull();
    expect(upstreamAssetsOfTree({ message: 'API rate limit exceeded' })).toBeNull();
    expect(upstreamAssetsOfTree(null)).toBeNull();
  });

  it('lists the upstream files the site does not bundle, icons and sounds in any case', () => {
    const bundled = { icons: BUNDLED_ICON_ASSETS, sounds: BUNDLED_SOUND_ASSETS.map((sound) => sound.file) };
    expect(
      unbundledAssets(
        { icons: ['GEMP.sprite', 'goldstar.lowend.sprite', 'rune.lowend.sprite', 'halo.sprite'], sounds: ['GONG.mp3', 'new.wav'] },
        bundled
      )
    ).toEqual(['icons/rune.lowend.sprite', 'icons/halo.sprite', 'sounds/new.wav']);
  });

  it('counts with plurals', () => {
    expect(plural(1, 'rule')).toBe('1 rule');
    expect(plural(0, 'error')).toBe('0 errors');
  });
});

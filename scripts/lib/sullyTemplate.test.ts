import { describe, expect, it } from 'vitest';
import { BUNDLED_ICON_ASSETS, BUNDLED_SOUND_ASSETS } from '../../src/features/loot-filter/utils/bundledAssets.ts';
import { SULLYS_QOL_TEMPLATE } from '../../src/features/loot-filter/utils/template.ts';
import { githubRepoSlug, githubTreeUrl, plural, rawUrlBranch, sizeReport, unbundledAssets, upstreamAssetsOfTree } from './sullyTemplate.ts';

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

  it('derives the repository, branch and tree listing from the template URLs', () => {
    expect(githubRepoSlug('https://github.com/Thisisnotsully/QoL-Filter')).toBe('Thisisnotsully/QoL-Filter');
    expect(githubRepoSlug('https://github.com/Thisisnotsully/QoL-Filter/')).toBe('Thisisnotsully/QoL-Filter');
    expect(githubRepoSlug('https://example.com/a/b')).toBeNull();
    expect(rawUrlBranch('https://raw.githubusercontent.com/a/b/refs/heads/main/f.json')).toBe('main');
    expect(rawUrlBranch('https://raw.githubusercontent.com/a/b/dev/f.json')).toBe('dev');
    expect(githubTreeUrl(SULLYS_QOL_TEMPLATE.repoUrl ?? '', SULLYS_QOL_TEMPLATE.liveUrl ?? '')).toBe(
      'https://api.github.com/repos/Thisisnotsully/QoL-Filter/git/trees/main?recursive=1'
    );
  });

  it('reports the size against the saved-filter cap and warns from 75%', () => {
    const cap = 2_097_152;
    expect(sizeReport(537_684, 553_637, cap)).toEqual({
      line: 'Size: 537,684 bytes, 553,637 as the editor writes it (26% of the 2,097,152-byte saved-filter cap)',
      warning: null,
    });
    expect(sizeReport(1_500_000, 1_600_000, cap).warning).toMatch(/^WARNING: over 75% of the saved-filter cap/);
    expect(sizeReport(1_000_000, 2_100_000, cap).warning).toMatch(/^WARNING: over the saved-filter cap/);
  });

  it('counts with plurals', () => {
    expect(plural(1, 'rule')).toBe('1 rule');
    expect(plural(0, 'error')).toBe('0 errors');
  });
});

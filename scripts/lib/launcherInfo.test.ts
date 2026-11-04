import { describe, expect, it } from 'vitest';
import {
  EMPTY_LAUNCHER_VERSIONS,
  findLootFilterDll,
  formatLauncherVersions,
  parseLauncherMetadata,
  parseSaveFormatMode,
  readPluginVersion,
} from './launcherInfo.ts';

describe('launcherInfo', () => {
  it('reads the versions of metadata.json', () => {
    const text =
      '﻿' +
      JSON.stringify({
        metadata: { modVersion: '3.2.24' },
        d2rloader: { version: '1.3.1', bins: { gameVersion: '3.3.0', gameBuild: '93847' } },
      });
    expect(parseLauncherMetadata(text)).toEqual({ modVersion: '3.2.24', loaderVersion: '1.3.1', gameVersion: '3.3.0', gameBuild: '93847' });
    expect(parseLauncherMetadata('{ broken')).toEqual({ modVersion: null, loaderVersion: null, gameVersion: null, gameBuild: null });
    expect(parseLauncherMetadata(null).modVersion).toBeNull();
  });

  it('reads the save format mode of its section', () => {
    const toml = '[d2rcore]\nmodels = false\nmode = "other"\n\n[d2rcore.save_format]\n# comment\nmode = "extended"\n';
    expect(parseSaveFormatMode(toml)).toBe('extended');
    expect(parseSaveFormatMode('mode = "x"\n')).toBe('x');
    expect(parseSaveFormatMode('models = false\n')).toBeNull();
  });

  it('reads the plugin version after the NUL-terminated plugin id', () => {
    const bytes = Buffer.concat([
      Buffer.from('MZ\0\0# celestialrayone.loot-filter\n'),
      Buffer.from('celestialrayone.loot-filter\0'),
      Buffer.from('1.5.3\0\0\0'),
    ]);
    expect(readPluginVersion(bytes)).toBe('1.5.3');
    expect(readPluginVersion(Buffer.from('celestialrayone.loot-filter\0\0\0not a version\0'))).toBeNull();
    expect(readPluginVersion(null)).toBeNull();
  });

  it('finds the loot filter DLL under d2rloader/', () => {
    expect(findLootFilterDll(['d2rloader/plugins/a.dll', 'd2rloader/plugins/d2rl-celestialrayone-loot-filter.dll'])).toBe(
      'd2rloader/plugins/d2rl-celestialrayone-loot-filter.dll'
    );
    expect(findLootFilterDll(['other/loot-filter.dll'])).toBeNull();
  });

  it('formats changed fields as before → after', () => {
    const before = { ...EMPTY_LAUNCHER_VERSIONS, modVersion: '3.2.20', loaderVersion: '1.3.1' };
    expect(formatLauncherVersions(before, { ...before, modVersion: '3.2.24' })).toBe(
      'metadata.modVersion 3.2.20 → 3.2.24, d2rloader.version 1.3.1, bins.gameVersion —, bins.gameBuild —, save_format mode —, loot filter plugin —'
    );
  });
});

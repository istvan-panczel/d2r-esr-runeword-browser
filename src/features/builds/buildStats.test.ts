import { describe, expect, it } from 'vitest';
import { asBuildData, asVariantData, type BuildData } from './buildData';
import { asBuildStats, asStatValues, isStatValue, STAT_KEYS, STAT_RANGES, type BuildStats } from './buildStats';

const SAVE_STATS: BuildStats = {
  source: 'save',
  difficulty: 2,
  character: 'SpinToWin',
  savedAt: 1_794_387_009,
  esrVersion: '3.3.03',
  values: { str: 986, dex: 746, vit: 493, ene: 118, life: 6080, mana: 791, fr: 79, mr: 38, def: 73276, sk: 10 },
};

/** Every stat at its range's maximum: the largest block the validator lets through. */
const FULL_STATS: BuildStats = {
  source: 'save',
  edited: true,
  difficulty: 2,
  buffed: true,
  character: 'Abcdefghijklmno',
  savedAt: 4_102_444_800,
  esrVersion: '3.3.03',
  values: Object.fromEntries(STAT_KEYS.map((key) => [key, STAT_RANGES[key].max])),
};

describe('asBuildStats', () => {
  it('keeps a well-formed save-derived block unchanged', () => {
    expect(asBuildStats(structuredClone(SAVE_STATS))).toEqual(SAVE_STATS);
    expect(asBuildStats(structuredClone(FULL_STATS))).toEqual(FULL_STATS);
  });

  it('keeps a hand-made block, dropping save-only provenance from it', () => {
    const manual = { ...SAVE_STATS, source: 'manual', edited: true, buffed: true };
    expect(asBuildStats(manual)).toEqual({ source: 'manual', difficulty: 2, buffed: true, values: SAVE_STATS.values });
  });

  it('rebuilds the block in a fixed key order, whatever the stored order', () => {
    const shuffled = { values: { sk: 10, str: 986 }, esrVersion: '3.3.03', difficulty: 1, source: 'save', edited: true };
    expect(JSON.stringify(asBuildStats(shuffled))).toBe(
      '{"source":"save","edited":true,"difficulty":1,"esrVersion":"3.3.03","values":{"str":986,"sk":10}}'
    );
  });

  it('drops the whole block without a known source or difficulty, or without any valid number', () => {
    expect(asBuildStats({ ...SAVE_STATS, source: 'game' })).toBeUndefined();
    expect(asBuildStats({ ...SAVE_STATS, source: undefined })).toBeUndefined();
    expect(asBuildStats({ ...SAVE_STATS, difficulty: 3 })).toBeUndefined();
    expect(asBuildStats({ ...SAVE_STATS, difficulty: '2' })).toBeUndefined();
    expect(asBuildStats({ ...SAVE_STATS, values: {} })).toBeUndefined();
    expect(asBuildStats({ ...SAVE_STATS, values: { str: 'lots', life: -5 } })).toBeUndefined();
    expect(asBuildStats({ ...SAVE_STATS, values: [1, 2, 3] })).toBeUndefined();
    for (const value of [null, 1, 'stats', [], true]) expect(asBuildStats(value)).toBeUndefined();
  });

  it('drops just the bad numbers: wrong type, fractions, NaN-ish, out of range, unknown keys', () => {
    const values = {
      str: 100,
      dex: '100',
      vit: 1.5,
      ene: -1,
      life: 1e12,
      fr: -1001,
      cr: -1000,
      lr: 101,
      pr: 100,
      sk: null,
      mf: Number.MAX_SAFE_INTEGER,
      lvl: 99,
      __proto__: 5,
      evil: '<script>',
    };
    expect(asStatValues(values)).toEqual({ str: 100, cr: -1000, pr: 100 });
  });

  it('drops bad provenance fields alone', () => {
    const stats = asBuildStats({
      ...SAVE_STATS,
      edited: 'yes',
      buffed: 1,
      character: 'Robert"); DROP TABLE builds;--',
      savedAt: 12.5,
      esrVersion: 'x'.repeat(5000),
    });
    expect(stats).toEqual({ source: 'save', difficulty: 2, values: SAVE_STATS.values });
    expect(asBuildStats({ ...SAVE_STATS, savedAt: 0, esrVersion: '3.3.03 <b>' })).toEqual({
      source: 'save',
      difficulty: 2,
      character: 'SpinToWin',
      values: SAVE_STATS.values,
    });
  });

  it('caps a hostile, bloated block to the known keys (well under 1 KB)', () => {
    const hostile = {
      ...FULL_STATS,
      extra: 'x'.repeat(100_000),
      values: { ...FULL_STATS.values, ...Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`k${String(i)}`, i])) },
    };
    const stats = asBuildStats(hostile);
    expect(stats).toEqual(FULL_STATS);
    expect(new TextEncoder().encode(JSON.stringify(stats)).length).toBeLessThan(1024);
  });

  it('isStatValue accepts integers within the range only', () => {
    expect(isStatValue('fr', -1000)).toBe(true);
    expect(isStatValue('fr', 100)).toBe(true);
    expect(isStatValue('fr', 101)).toBe(false);
    expect(isStatValue('dod', 75.5)).toBe(false);
    expect(isStatValue('dod', Number.NaN)).toBe(false);
    expect(isStatValue('dod', Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('stats in build_data', () => {
  it('reads a stats block on the top level and on every variant', () => {
    const value = { items: {}, stats: SAVE_STATS, variants: [{ variantName: 'MF', stats: { ...SAVE_STATS, source: 'manual' } }] };
    const data = asBuildData(structuredClone(value));
    expect(data.stats).toEqual(SAVE_STATS);
    expect(data.variants?.[0].stats).toEqual({ source: 'manual', difficulty: 2, values: SAVE_STATS.values });
  });

  it('drops a malformed block without touching the rest of the variant', () => {
    const data = asVariantData({ skills: 'Whirlwind', level: 90, stats: { source: 'save', difficulty: 9, values: { str: 1 } } });
    expect(JSON.parse(JSON.stringify(data))).toEqual({ skills: 'Whirlwind', level: 90 });
  });

  it('leaves builds without stats byte-identical (no stats key appears)', () => {
    const old: BuildData = {
      charms: ['Annihilus'],
      ascendancy: 'Zealot',
      skills: 'x',
      level: 90,
      variantName: 'A',
      variants: [{ skills: 'y' }],
    };
    expect(JSON.stringify(asBuildData(structuredClone(old)))).toBe(JSON.stringify(old));
  });

  it('puts stats after every older key, so it never reorders an existing build', () => {
    const data = asVariantData({ stats: SAVE_STATS, variantNote: 'n', skills: 'x' });
    expect(Object.keys(JSON.parse(JSON.stringify(data)) as object)).toEqual(['skills', 'variantNote', 'stats']);
  });
});

import { describe, it, expect } from 'vitest';
import { DEFAULT_ESR_RUNE_POINTS, DEFAULT_LOD_RUNE_POINTS } from './defaultRunePoints';

describe('DEFAULT_ESR_RUNE_POINTS', () => {
  it('should have 47 entries (7 per tier x 6 tiers + 5 in T7)', () => {
    expect(Object.keys(DEFAULT_ESR_RUNE_POINTS)).toHaveLength(47);
  });

  it('should have Ru Rune = 4 points', () => {
    expect(DEFAULT_ESR_RUNE_POINTS['Ru Rune']).toBe(4);
  });

  it('should follow doubling pattern within each tier', () => {
    // T1 WHITE: I(1), U(2), Shi(4), Ka(8), N(16), Ku(32), Yo(64)
    const tier1 = ['I Rune', 'U Rune', 'Shi Rune', 'Ka Rune', 'N Rune', 'Ku Rune', 'Yo Rune'];
    const tier1Points = tier1.map((name) => DEFAULT_ESR_RUNE_POINTS[name]);
    expect(tier1Points).toEqual([1, 2, 4, 8, 16, 32, 64]);

    // T7 PURPLE: Su(1), He(2), Nu(4), Wo(8), Null(16)
    const tier7 = ['Su Rune', 'He Rune', 'Nu Rune', 'Wo Rune', 'Null Rune'];
    const tier7Points = tier7.map((name) => DEFAULT_ESR_RUNE_POINTS[name]);
    expect(tier7Points).toEqual([1, 2, 4, 8, 16]);
  });

  it('should have all rune names ending with " Rune"', () => {
    for (const name of Object.keys(DEFAULT_ESR_RUNE_POINTS)) {
      expect(name.endsWith(' Rune')).toBe(true);
    }
  });
});

describe('DEFAULT_LOD_RUNE_POINTS', () => {
  it('should have 33 entries', () => {
    expect(Object.keys(DEFAULT_LOD_RUNE_POINTS)).toHaveLength(33);
  });

  it('should follow doubling pattern within LOW tier (El-Amn)', () => {
    const low = [
      'El Rune',
      'Eld Rune',
      'Tir Rune',
      'Nef Rune',
      'Eth Rune',
      'Ith Rune',
      'Tal Rune',
      'Ral Rune',
      'Ort Rune',
      'Thul Rune',
      'Amn Rune',
    ];
    const lowPoints = low.map((name) => DEFAULT_LOD_RUNE_POINTS[name]);
    expect(lowPoints).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]);
  });

  it('should follow doubling pattern within MID tier (Sol-Um)', () => {
    const mid = [
      'Sol Rune',
      'Shael Rune',
      'Dol Rune',
      'Hel Rune',
      'Io Rune',
      'Lum Rune',
      'Ko Rune',
      'Fal Rune',
      'Lem Rune',
      'Pul Rune',
      'Um Rune',
    ];
    const midPoints = mid.map((name) => DEFAULT_LOD_RUNE_POINTS[name]);
    expect(midPoints).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]);
  });

  it('should follow doubling pattern within HIGH tier (Mal-Zod)', () => {
    const high = [
      'Mal Rune',
      'Ist Rune',
      'Gul Rune',
      'Vex Rune',
      'Ohm Rune',
      'Lo Rune',
      'Sur Rune',
      'Ber Rune',
      'Jah Rune',
      'Cham Rune',
      'Zod Rune',
    ];
    const highPoints = high.map((name) => DEFAULT_LOD_RUNE_POINTS[name]);
    expect(highPoints).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]);
  });

  it('should have all rune names ending with " Rune"', () => {
    for (const name of Object.keys(DEFAULT_LOD_RUNE_POINTS)) {
      expect(name.endsWith(' Rune')).toBe(true);
    }
  });
});

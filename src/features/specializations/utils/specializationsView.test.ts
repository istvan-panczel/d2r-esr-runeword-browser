import { describe, expect, it } from 'vitest';
import type { SpecializationPerk, SpecializationRules, SpecializationsBundle } from '@/features/game-data/engine/schema';
import { percentText, readSpecializationsState, specializationsParams, tokenPointsByLevel } from './specializationsView';

const perk = (slug: string, row = 1): SpecializationPerk => ({
  slug,
  title: slug,
  description: '',
  row,
  column: 1,
  stat: 0,
  statName: 'x',
});

const RULES: SpecializationRules = {
  pointLevels: [45, 60, 75, 90],
  unlockPoints: 1,
  maxPoints: 5,
  perksPerRow: 3,
  unlearnHint: '',
  shard: { code: 'u42', name: 'Mystical Shard', description: [] },
  token: { code: 'u43', name: 'Mystical Tesseract', description: [], levels: [45, 60, 75, 90] },
  shardsOnlyBeforeUnlock: true,
  shardDrops: [],
};

const BUNDLE: SpecializationsBundle = {
  rules: RULES,
  trees: [
    { slug: 'alchemist', name: 'Alchemist', perks: [perk('hidden-elixirs'), perk('shared')] },
    { slug: 'jeweler', name: 'Jeweler', perks: [perk('my-precious'), perk('shared')] },
  ],
  pageDiffs: [],
};

const read = (query: string) => {
  const state = readSpecializationsState(new URLSearchParams(query), BUNDLE);
  return state === null ? null : { tree: state.tree.slug, perk: state.perk?.slug ?? null, unknown: state.unknown };
};

describe('readSpecializationsState', () => {
  it('opens the first tree by default and the named tree and perk from the URL', () => {
    expect(read('')).toEqual({ tree: 'alchemist', perk: null, unknown: null });
    expect(read('tree=jeweler')).toEqual({ tree: 'jeweler', perk: null, unknown: null });
    expect(read('tree=jeweler&perk=my-precious')).toEqual({ tree: 'jeweler', perk: 'my-precious', unknown: null });
  });

  it('finds the tree of a perk linked without (or with the wrong) tree, and keeps the named tree for a shared slug', () => {
    expect(read('perk=my-precious')).toEqual({ tree: 'jeweler', perk: 'my-precious', unknown: null });
    expect(read('tree=alchemist&perk=my-precious')).toEqual({ tree: 'jeweler', perk: 'my-precious', unknown: null });
    expect(read('tree=jeweler&perk=shared')).toEqual({ tree: 'jeweler', perk: 'shared', unknown: null });
  });

  it('reports a slug that names nothing', () => {
    expect(read('tree=miner')).toEqual({ tree: 'alchemist', perk: null, unknown: 'miner' });
    expect(read('tree=jeweler&perk=nope')).toEqual({ tree: 'jeweler', perk: null, unknown: 'nope' });
    expect(readSpecializationsState(new URLSearchParams(''), { ...BUNDLE, trees: [] })).toBeNull();
  });

  it('writes the same URL format back', () => {
    expect(specializationsParams('alchemist', 'hidden-elixirs').toString()).toBe('tree=alchemist&perk=hidden-elixirs');
    expect(specializationsParams('jeweler').toString()).toBe('tree=jeweler');
  });
});

describe('tokenPointsByLevel', () => {
  it('gives the unlock point plus one per point level reached, capped at the maximum', () => {
    expect(tokenPointsByLevel(RULES)).toEqual([
      { from: 1, to: 44, points: 1 },
      { from: 45, to: 59, points: 2 },
      { from: 60, to: 74, points: 3 },
      { from: 75, to: 89, points: 4 },
      { from: 90, to: null, points: 5 },
    ]);
    expect(tokenPointsByLevel({ ...RULES, maxPoints: 3 }).map((band) => band.points)).toEqual([1, 2, 3, 3, 3]);
  });
});

describe('percentText', () => {
  it('keeps small chances readable', () => {
    expect(percentText(0.05)).toBe('5%');
    expect(percentText(0.2353)).toBe('23.5%');
    expect(percentText(0.0025)).toBe('0.25%');
  });
});

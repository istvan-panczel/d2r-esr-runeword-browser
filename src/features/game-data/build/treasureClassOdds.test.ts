import { describe, expect, it } from 'vitest';
import { adjustedNoDrop, chanceOfAny, createTcOdds, expectedCounts, readTcRows } from './treasureClassOdds.ts';
import { parseTsv } from './tsv.ts';

const HEADER = ['Treasure Class', 'Picks', 'NoDrop', 'Item1', 'Prob1', 'Item2', 'Prob2', 'Item3', 'Prob3', 'ConditionCalc'];
const table = (rows: string[][]) => parseTsv([HEADER, ...rows].map((row) => row.join('\t')).join('\n'));

const odds = createTcOdds(
  readTcRows(
    table([
      ['Nothing', '0', '', '', '', '', '', '', '', ''],
      // 5% orb, a real NoDrop plus an explicit Nothing (which /players does not shrink)
      ['Orb', '1', '52', 'orb', '5', 'Nothing', '43', '', '', ''],
      ['Key', '1', '8', 'Random Key', '4', 'Nothing', '4', '', '', ''],
      ['Random Key', '1', '', 'pk1', '1', 'pk2', '1', 'pk3', '1', ''],
      ['Soulstone', '1', '', 'ss', '1', '', '', '', '', "stat('count')<10"],
      ['Two Keys', '2', '', 'Random Key', '1', '', '', '', '', ''],
      ['Key Set', '-3', '', 'pk1', '1', 'pk2', '1', 'pk3', '1', ''],
      ['Key Set Roll', '1', '1', 'Key Set', '1', '', '', '', '', ''],
      ['Base', '1', '', '"gld,mul=2048"', '1', 'gear', '1', '', '', ''],
      ['Boss', '-5', '', 'Orb', '1', 'Key', '1', 'Base', '3', ''],
      ['Boss Main', '-2', '', 'horn', '1', 'Boss', '1', '', '', ''],
      ['Loop', '1', '', 'Loop', '1', '', '', '', '', ''],
      ['Repeat', '1', '', 'first', '1', '', '', '', '', ''],
      ['Repeat', '1', '', 'second', '1', '', '', '', '', ''],
    ])
  )
);

describe('adjustedNoDrop', () => {
  it('raises the no-drop chance to the power floor((players + 1) / 2) and truncates the weight', () => {
    expect(adjustedNoDrop(52, 48, 1)).toBe(52);
    expect(adjustedNoDrop(52, 48, 2)).toBe(52);
    // 0.52^4 = 0.0731 → 48 × 0.0731 / 0.9269 = 3.79 → 3
    expect(adjustedNoDrop(52, 48, 8)).toBe(3);
    expect(adjustedNoDrop(52, 48, 7)).toBe(3);
    expect(adjustedNoDrop(0, 48, 8)).toBe(0);
  });
});

describe('createTcOdds', () => {
  it('weights a pick by its entries and NoDrop; an explicit Nothing entry stays', () => {
    expect(chanceOfAny(odds.picks('Orb', 1), new Set(['orb']))).toBeCloseTo(0.05);
    expect(chanceOfAny(odds.picks('Orb', 8), new Set(['orb']))).toBeCloseTo(5 / 51);
  });

  it('follows single-pick sub-TCs (one random key)', () => {
    const picks = odds.picks('Key', 1);
    expect(picks).toHaveLength(1);
    expect(expectedCounts(picks).get('pk2')).toBeCloseTo(0.25 / 3);
    expect(chanceOfAny(picks, (ref) => ref.startsWith('pk'))).toBeCloseTo(0.25);
    expect(chanceOfAny(odds.picks('Key', 8), (ref) => ref.startsWith('pk'))).toBeCloseTo(0.5);
  });

  it('makes Picks independent picks for a positive Picks', () => {
    const picks = odds.picks('Two Keys', 1);
    expect(picks).toHaveLength(2);
    expect(expectedCounts(picks).get('pk1')).toBeCloseTo(2 / 3);
  });

  it('keeps a multi-pick sub-TC a single pick lands on as one branch (a whole key set at 50%)', () => {
    const picks = odds.picks('Key Set Roll', 1);
    expect(chanceOfAny(picks, (ref) => ref.startsWith('pk'))).toBeCloseTo(0.5);
    expect(chanceOfAny(picks, new Set(['pk1']))).toBeCloseTo(0.5);
    expect(expectedCounts(picks).get('pk3')).toBeCloseTo(0.5);
  });

  it('rolls each entry Prob times for a negative Picks, through nested negative TCs', () => {
    const picks = odds.picks('Boss Main', 1);
    expect(picks).toHaveLength(6);
    expect(chanceOfAny(picks.slice(0, 1), new Set(['horn']))).toBe(1);
    expect(chanceOfAny(picks, new Set(['gear']))).toBeCloseTo(1 - 0.5 ** 3);
    expect(odds.picks('Unknown TC', 1)).toEqual([]);
  });

  it('lists the reachable item refs and the conditions on the way', () => {
    expect([...odds.reachableRefs('Boss')].sort()).toEqual(['gear', 'gld', 'orb', 'pk1', 'pk2', 'pk3']);
    expect(odds.reachableRefs('Nothing').size).toBe(0);
    expect(odds.conditions('Soulstone')).toEqual(["stat('count')<10"]);
    expect(chanceOfAny(odds.picks('Soulstone', 1), new Set(['ss']))).toBe(1);
  });

  it('keeps the first row of a repeated name and stops on a TC that names itself', () => {
    expect(chanceOfAny(odds.picks('Repeat', 1), new Set(['first']))).toBe(1);
    expect(() => odds.picks('Loop', 1)).toThrow(/leads back to itself/);
  });
});

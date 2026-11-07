import { describe, expect, it } from 'vitest';
import type { CubeRow } from './cubeRows.ts';
import { perkCheckText, perkChecks, perkOfStat } from './perks.ts';

const STRINGS = new Map([
  ['SpecializationsBlacksmith', 'Blacksmith'],
  ['SpecializationsJeweler', 'Jeweler'],
  ['SpecializationsBlacksmith5_2Title', 'The Secret Crucible'],
  ['SpecializationsJeweler5_3Title', 'Steady Pliers'],
  ['SpecializationsJeweler3_1Title', 'Hidden Potential'],
]);
const STATS = new Map([
  [959, 'blacksmithing_14'],
  [975, 'jeweler_15'],
  [280, 'item_craftflag'],
]);

const row = (line: number, inputs: string[], condition: CubeRow['condition'] = null): CubeRow => ({
  line,
  description: `row ${String(line)}`,
  cls: '',
  minDiff: 0,
  inputs,
  outputs: [{ spec: 'useitem', mods: [] }],
  condition,
});

describe('perkOfStat', () => {
  it('names perk n of a tree by its row and column (n = (row - 1) * 3 + column)', () => {
    expect(perkOfStat('jeweler_15', STRINGS)).toEqual({ title: 'Steady Pliers', tree: 'Jeweler' });
    expect(perkOfStat('jeweler_7', STRINGS)).toEqual({ title: 'Hidden Potential', tree: 'Jeweler' });
    expect(perkOfStat('blacksmithing_14', STRINGS)).toEqual({ title: 'The Secret Crucible', tree: 'Blacksmith' });
    expect(perkOfStat('jeweler_16', STRINGS)).toBeNull();
    expect(perkOfStat('item_craftflag', STRINGS)).toBeNull();
    // No title string: no perk (nothing invented)
    expect(perkOfStat('alchemy_1', STRINGS)).toBeNull();
  });
});

describe('perkChecks', () => {
  const trap = row(10, ['weap,nru', '"qqq,qty=2"'], { op: 6, param: 959, value: 0 });
  const forging = row(20, ['weap,low,sock,nru', '"qqq,qty=2"'], { op: 18, param: 280, value: 0 });
  const other = row(21, ['armo,nru', '"qqq,qty=2"']);
  const before = row(5, ['weap,nru', '"qqq,qty=2"']);
  const special = row(30, ['weap', 'key'], { op: 6, param: 975, value: 1 });
  const checks = perkChecks([special, forging, other, trap, before], (id) => STATS.get(id), STRINGS);

  it('reads the perk a row needs or excludes from its own condition', () => {
    expect(checks.get(special)).toEqual([{ perk: { title: 'Steady Pliers', tree: 'Jeweler' }, has: true }]);
    expect(checks.get(trap)).toEqual([{ perk: { title: 'The Secret Crucible', tree: 'Blacksmith' }, has: false }]);
  });

  it('makes later rows the "without" row catches need the perk (its qualifiers a subset), not earlier or other rows', () => {
    expect(checks.get(forging)).toEqual([{ perk: { title: 'The Secret Crucible', tree: 'Blacksmith' }, has: true, inherited: true }]);
    expect(checks.has(other)).toBe(false);
    expect(checks.has(before)).toBe(false);
  });

  it('words the checks', () => {
    expect(perkCheckText({ perk: { title: 'Steady Pliers', tree: 'Jeweler' }, has: true })).toBe('Needs the Jeweler perk Steady Pliers');
    expect(perkCheckText({ perk: { title: 'Steady Pliers', tree: 'Jeweler' }, has: false })).toBe(
      'Only without the Jeweler perk Steady Pliers'
    );
  });
});

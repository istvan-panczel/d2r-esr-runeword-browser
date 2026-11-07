import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModifiersBundle } from '@/features/game-data/engine/schema';
import {
  attackRatingFor,
  crushingBlowDamageStat,
  crushingBlowRows,
  hitChanceView,
  leechRows,
  magicFindRows,
  minimumUsefulLeech,
  parseNumberInput,
  vanillaFacts,
} from './calculatorViews';
import { hitChance } from './modifierMath';

const bundle = JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data/modifiers.json'), 'utf8')) as ModifiersBundle;
const facts = bundle.facts;

describe('parseNumberInput', () => {
  it('parses, clamps and falls back', () => {
    expect(parseNumberInput('20', 0, 100, 5)).toBe(20);
    expect(parseNumberInput(' 2,5 ', 0, 100, 5)).toBe(2.5);
    expect(parseNumberInput('500', 0, 100, 5)).toBe(100);
    expect(parseNumberInput('-3', 0, 100, 5)).toBe(0);
    expect(parseNumberInput('', 0, 100, 5)).toBe(5);
    expect(parseNumberInput('abc', 0, 100, 5)).toBe(5);
  });
});

describe('vanillaFacts', () => {
  it('swaps in the vanilla values of the named facts only', () => {
    const swapped = vanillaFacts(facts, ['difficulty.LifeStealDivisor']);
    expect(swapped.find((fact) => fact.key === 'difficulty.LifeStealDivisor')?.value).toEqual([1, 2, 3]);
    expect(swapped.find((fact) => fact.key === 'difficulty.ManaStealDivisor')?.value).toEqual([1, 15, 75]);
  });
});

describe('leechRows', () => {
  it('gives the exact and 1/64 % values per difficulty next to vanilla', () => {
    const rows = leechRows(20, 'life', 100, facts);
    expect(rows.map((row) => row.difficulty)).toEqual(['Normal', 'Nightmare', 'Hell']);
    expect(rows.map((row) => row.divisor)).toEqual([1, 25, 150]);
    expect(rows.map((row) => row.vanillaDivisor)).toEqual([1, 2, 3]);
    expect(rows[2]?.exact).toBeCloseTo(20 / 150);
    expect(rows[2]?.engine).toBe(8 / 64);
    expect(rows[2]?.per1000).toBe(1.25);
    expect(rows[1]?.vanillaExact).toBe(10);
  });

  it('scales by the target drain and finds the smallest leech that is not 0', () => {
    expect(leechRows(20, 'mana', 0, facts).every((row) => row.engine === 0)).toBe(true);
    expect(minimumUsefulLeech('life', 2, facts)).toBe(3);
    expect(minimumUsefulLeech('mana', 2, facts)).toBe(2);
  });
});

describe('magicFindRows', () => {
  it('shows the diminished MF with the ESR tail next to vanilla', () => {
    const rows = magicFindRows(300, facts);
    expect(rows.map((row) => row.quality)).toEqual(['magic', 'rare', 'set', 'unique']);
    const unique = rows.find((row) => row.quality === 'unique');
    expect(unique).toMatchObject({ esr: 166, vanilla: 136, tail: 30, dim: 250 });
    expect(rows[0]).toMatchObject({ esr: 300, vanilla: 300, tail: 0, dim: null });
  });
});

describe('hit chance', () => {
  it('gives ESR and vanilla chances and the attack rating each target chance needs', () => {
    const view = hitChanceView(5000, 1000, facts);
    expect(view).toMatchObject({ ratio: 5, esr: 50, vanilla: 83 });
    expect(view.needed.map((row) => row.chance)).toEqual([50, 75, 90, 95]);
    for (const row of view.needed) {
      const ar = row.attackRating;
      if (ar === null) continue;
      expect(hitChance(ar, 1000, facts)).toBeGreaterThanOrEqual(row.chance);
      expect(hitChance(ar - 1, 1000, facts)).toBeLessThan(row.chance);
    }
    expect(attackRatingFor(50, 0, facts)).toBe(0);
    expect(hitChanceView(100, 0, facts).ratio).toBeNull();
  });
});

describe('crushingBlowRows', () => {
  it('gives the share and life removed per target, ESR next to vanilla', () => {
    const rows = crushingBlowRows({ currentLife: 10_000, physicalResist: 0, players: 1, ranged: false }, facts);
    const row = (target: string) => rows.find((entry) => entry.target === target);
    expect(row('monster')).toMatchObject({ share: 12.5, damage: 1250, vanillaShare: 25, vanillaDamage: 2500 });
    expect(row('unique')).toMatchObject({ share: 6.25, vanillaShare: 25 });
    expect(row('act_boss')).toMatchObject({ share: 2, vanillaShare: 12.5 });
    const ranged = crushingBlowRows({ currentLife: 10_000, physicalResist: 50, players: 3, ranged: true }, facts);
    // ESR ranged = melee; vanilla halves it; 3 players = ÷2 against monsters; 50 % physical resist halves again
    expect(ranged.find((entry) => entry.target === 'monster')).toMatchObject({ share: 3.125, vanillaShare: 3.125 });
    expect(ranged.find((entry) => entry.target === 'player')).toMatchObject({ share: 2.5 });
  });

  it('applies +x% Crushing Blow Damage to ESR only (vanilla D2R has no such stat)', () => {
    const rows = crushingBlowRows({ currentLife: 10_000, physicalResist: 0, players: 1, ranged: false, crushingBlowDamage: 25 }, facts);
    expect(rows.find((entry) => entry.target === 'monster')).toMatchObject({ share: 15.625, damage: 1562.5, vanillaShare: 25 });
    expect(rows.find((entry) => entry.target === 'act_boss')).toMatchObject({ share: 2.5, vanillaShare: 12.5 });
  });

  it('names the effectiveness stat, or null when the config turns it off', () => {
    expect(crushingBlowDamageStat(facts)).toBe(1045);
    expect(
      crushingBlowDamageStat(facts.map((fact) => (fact.key === 'crushingBlow.effectivenessStat' ? { ...fact, value: -1 } : fact)))
    ).toBeNull();
    expect(crushingBlowDamageStat(facts.filter((fact) => fact.key !== 'crushingBlow.effectivenessStat'))).toBeNull();
  });
});

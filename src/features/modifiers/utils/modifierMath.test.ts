import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { ModifierFact, ModifiersBundle } from '@/features/game-data/engine/schema';
import { crushingBlow, curveChance, effectiveLeech, effectiveMagicFind, hitChance, hitCurve, recordFact, type Facts } from './modifierMath';

const { facts } = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data/modifiers.json'), 'utf-8')) as ModifiersBundle;

/** The committed facts with some values replaced (to check that the formulas read the facts, not constants) */
const withFact = (key: string, value: ModifierFact['value']): Facts => facts.map((fact) => (fact.key === key ? { ...fact, value } : fact));

describe('effectiveLeech (committed ESR facts)', () => {
  it('divides by the difficulty divisor: life 1 / 25 / 150, mana 1 / 15 / 75', () => {
    expect(effectiveLeech(10, 0, 'life', facts)).toEqual({ exact: 10, engine: 10 });
    expect(effectiveLeech(10, 1, 'life', facts).exact).toBeCloseTo(0.4);
    expect(effectiveLeech(10, 2, 'life', facts).exact).toBeCloseTo(10 / 150);
    expect(effectiveLeech(15, 2, 'mana', facts).exact).toBeCloseTo(0.2);
  });

  it('keeps the engine precision of 1/64 percent', () => {
    // floor(10 × 64 / 25) = 25 → 25 / 64
    expect(effectiveLeech(10, 1, 'life', facts).engine).toBeCloseTo(25 / 64);
    // floor(10 × 64 / 150) = 4 → 4 / 64
    expect(effectiveLeech(10, 2, 'life', facts).engine).toBeCloseTo(4 / 64);
    // under 1/64 after the divisor: nothing
    expect(effectiveLeech(2, 2, 'life', facts).engine).toBe(0);
  });

  it('scales by the monster Drain and returns 0 for no leech or Drain 0', () => {
    expect(effectiveLeech(20, 0, 'life', facts, 10).exact).toBeCloseTo(2);
    expect(effectiveLeech(20, 2, 'life', facts, 0)).toEqual({ exact: 0, engine: 0 });
    expect(effectiveLeech(0, 2, 'life', facts)).toEqual({ exact: 0, engine: 0 });
  });

  it('follows a changed divisor', () => {
    const changed = withFact('difficulty.LifeStealDivisor', [1, 2, 3]);
    expect(effectiveLeech(9, 2, 'life', changed).exact).toBeCloseTo(3);
  });
});

describe('effectiveMagicFind (committed ESR facts)', () => {
  it('gives magic items the full value', () => {
    expect(effectiveMagicFind(500, 'magic', facts)).toBe(500);
  });

  it('applies the 250 / 500 / 600 curve plus the 10 % soft tail', () => {
    // unique: floor(250 × 300 / 550) = 136, + 30
    expect(effectiveMagicFind(300, 'unique', facts)).toBe(166);
    // set: floor(500 × 300 / 800) = 187, + 30
    expect(effectiveMagicFind(300, 'set', facts)).toBe(217);
    // rare: floor(600 × 300 / 900) = 200, + 30
    expect(effectiveMagicFind(300, 'rare', facts)).toBe(230);
    // 2000 MF: 222 + 200
    expect(effectiveMagicFind(2000, 'unique', facts)).toBe(422);
  });

  it('is the vanilla curve without the tail', () => {
    expect(effectiveMagicFind(300, 'unique', withFact('magicFind.tail', { unique: 0, set: 0, rare: 0 }))).toBe(136);
    expect(effectiveMagicFind(0, 'unique', facts)).toBe(0);
  });

  it('skips the diminishing returns up to 10 MF, as the engine does (100 + MF must be above 110)', () => {
    expect(effectiveMagicFind(5, 'unique', facts)).toBe(5);
    expect(effectiveMagicFind(10, 'unique', facts)).toBe(10);
    expect(effectiveMagicFind(10, 'rare', facts)).toBe(10);
    expect(effectiveMagicFind(-20, 'set', facts)).toBe(-20);
    // 11: floor(250 × 11 / 261) = 10, + floor(1.1) = 1
    expect(effectiveMagicFind(11, 'unique', facts)).toBe(11);
    expect(effectiveMagicFind(11, 'unique', withFact('magicFind.tail', { unique: 0, set: 0, rare: 0 }))).toBe(10);
  });
});

describe('hitChance (committed ESR facts)', () => {
  it('reproduces the curve table of attack-rating.toml', () => {
    const table = recordFact(facts, 'attackRating.table');
    expect(Object.keys(table).length).toBeGreaterThan(10);
    const curve = hitCurve(facts);
    for (const [ratio, chance] of Object.entries(table)) expect(curveChance(Number(ratio), curve), `r = ${ratio}`).toBe(chance);
  });

  it('is 50 % at attack rating = 5 × defense, without level scaling, within 0–100', () => {
    expect(hitChance(5000, 1000, facts)).toBe(50);
    expect(hitChance(5000, 1000, facts, { levels: [1, 99] })).toBe(50);
    expect(hitChance(1000, 1000, facts)).toBe(0);
    expect(hitChance(104_000, 1000, facts)).toBe(100);
    expect(hitChance(1000, 0, facts)).toBe(100);
  });

  it('reproduces vanilla D2 with the vanilla curve: 100 × AR / (AR + DEF) × 2 × alvl / (alvl + dlvl), 5–95', () => {
    expect(hitChance(1000, 1000, facts, { vanilla: true, levels: [50, 50] })).toBe(50);
    expect(hitChance(3000, 1000, facts, { vanilla: true, levels: [50, 50] })).toBe(75);
    expect(hitChance(3000, 1000, facts, { vanilla: true, levels: [90, 10] })).toBe(95);
    expect(hitChance(100, 1000, facts, { vanilla: true, levels: [10, 90] })).toBe(5);
  });
});

describe('crushingBlow (committed ESR facts)', () => {
  it('removes the per-class share of current life', () => {
    expect(crushingBlow({ currentLife: 1000, target: 'monster' }, facts)).toEqual({ share: 12.5, damage: 125 });
    expect(crushingBlow({ currentLife: 1000, target: 'unique' }, facts).share).toBe(6.25);
    expect(crushingBlow({ currentLife: 1000, target: 'act_boss' }, facts).share).toBe(2);
    expect(crushingBlow({ currentLife: 1000, target: 'player' }, facts).share).toBe(5);
  });

  it('is as strong ranged as melee in ESR, half in vanilla', () => {
    expect(crushingBlow({ currentLife: 1000, target: 'monster', ranged: true }, facts).share).toBe(12.5);
    expect(crushingBlow({ currentLife: 1000, target: 'monster', ranged: true }, withFact('crushingBlow.ranged', 50)).share).toBe(6.25);
  });

  it('is divided by the /players life bonus against monsters only, and reduced by physical resist', () => {
    // players 3: 1 + 0.5 × 2 = 2
    expect(crushingBlow({ currentLife: 1000, target: 'monster', players: 3 }, facts).share).toBe(6.25);
    expect(crushingBlow({ currentLife: 1000, target: 'mercenary', players: 3 }, facts).share).toBe(5);
    expect(crushingBlow({ currentLife: 1000, target: 'monster', physicalResist: 50 }, facts).damage).toBe(62.5);
    expect(crushingBlow({ currentLife: 1000, target: 'monster', physicalResist: -50 }, facts).damage).toBe(125);
    expect(crushingBlow({ currentLife: 1000, target: 'monster', physicalResist: 150 }, facts).damage).toBe(0);
  });

  it('scales every share by +x% Crushing Blow Damage (crushing-blow.toml [effectiveness])', () => {
    // the toml's own examples: +25 → ×1.25, a monster at 50 goes from 12.5 % to 15.6 %, an act boss at 16 from 2 % to 2.5 %
    expect(crushingBlow({ currentLife: 1000, target: 'monster', crushingBlowDamage: 25 }, facts).share).toBe(15.625);
    expect(crushingBlow({ currentLife: 1000, target: 'act_boss', crushingBlowDamage: 25 }, facts).share).toBe(2.5);
    expect(crushingBlow({ currentLife: 1000, target: 'monster', crushingBlowDamage: -50 }, facts).share).toBe(6.25);
    // -100 or lower: the attacker's Crushing Blow does nothing
    expect(crushingBlow({ currentLife: 1000, target: 'monster', crushingBlowDamage: -100 }, facts).damage).toBe(0);
    expect(crushingBlow({ currentLife: 1000, target: 'monster', crushingBlowDamage: -250 }, facts).damage).toBe(0);
    // stacks with ranged, /players and physical resist: 12.5 × 2 ÷ 2 × 0.5
    expect(
      crushingBlow({ currentLife: 1000, target: 'monster', crushingBlowDamage: 100, players: 3, physicalResist: 50 }, facts).share
    ).toBe(6.25);
    // stat_id = -1 leaves it off
    expect(
      crushingBlow({ currentLife: 1000, target: 'monster', crushingBlowDamage: 25 }, withFact('crushingBlow.effectivenessStat', -1)).share
    ).toBe(12.5);
    // never more than the current life
    expect(crushingBlow({ currentLife: 1000, target: 'monster', crushingBlowDamage: 1000 }, facts).damage).toBe(1000);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { peekNumbers } from './modifierPeek';
import type { ModifierRef } from './modifierRefData';
import type { ModifierRefsData } from './modifierRefs';

// The facts the peek data carries (not the whole modifiers.json): a fact the peek reads but the data lacks throws here
const data = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../src/features/modifiers/data/modifierRefs.json'), 'utf-8')
) as ModifierRefsData;
const facts = data.facts;

const texts = (ref: ModifierRef) => peekNumbers(ref, facts).map((number) => `${number.text} [${number.origin}]`);

describe('peekNumbers (committed ESR 3.2.24 facts)', () => {
  it('works out leech for the line’s value per difficulty (engine precision, the roll’s maximum)', () => {
    // floor(8 × 64 / 25) / 64 = 0.3125, floor(8 × 64 / 150) / 64 = 0.046875
    expect(texts({ key: 'life-leech', value: [8, 8] })).toEqual(['8% leeches about 0.313% in Nightmare and 0.047% in Hell [game-files]']);
    expect(texts({ key: 'life-leech', value: [5, 20] })).toEqual(['20% leeches about 0.797% in Nightmare and 0.125% in Hell [game-files]']);
    expect(texts({ key: 'mana-leech', value: [10, 10] })).toEqual([
      '10% leeches about 0.656% in Nightmare and 0.125% in Hell [game-files]',
    ]);
    // Hell divisor 150: 2% leech is 0 there
    expect(texts({ key: 'life-leech', value: [2, 2] })).toEqual(['2% leeches about 0.078% in Nightmare and 0% in Hell [game-files]']);
    expect(texts({ key: 'life-leech' })).toEqual(['Divided by 25 in Nightmare and 150 in Hell [game-files]']);
    // A negative line (stash items) keeps its sign: no leech amount, only the divisors
    expect(texts({ key: 'life-leech', value: [-5, -5] })).toEqual(['Divided by 25 in Nightmare and 150 in Hell [game-files]']);
  });

  it('works out Magic Find per quality for the line alone', () => {
    // unique: floor(250 × 100 / 350) + floor(100 × 10 / 100) = 71 + 10
    expect(texts({ key: 'magic-find', value: [100, 100] })).toEqual([
      'This line alone (100%): unique +81%, set +93%, rare +95% (diminishing returns) [vanilla-engine]',
    ]);
    // Small and negative values count in full, sign kept
    expect(texts({ key: 'magic-find', value: [-20, -20] })).toEqual([
      'This line alone (-20%): unique -20%, set -20%, rare -20% (counts in full) [vanilla-engine]',
    ]);
    expect(texts({ key: 'magic-find', value: [8, 8] })).toEqual([
      'This line alone (8%): unique +8%, set +8%, rare +8% (counts in full) [vanilla-engine]',
    ]);
    // Per-level lines: the number is per level, so no value-based numbers
    expect(texts({ key: 'magic-find', value: [3, 3], perLevel: true })).toEqual([]);
  });

  it('quotes the per-target and per-entry ESR numbers', () => {
    expect(texts({ key: 'crushing-blow', value: [15, 15] })).toEqual([
      "Removes 12.5% of a normal monster's current life, 6.25% of a unique's, 2% of an act boss's [esr-config]",
    ]);
    expect(texts({ key: 'deadly-strike', value: [20, 20] })).toEqual(['A deadly strike deals ×2 physical damage [esr-config]']);
    expect(texts({ key: 'critical-damage', value: [50, 50] })).toEqual(['Critical multiplier ×2 → ×2.5 [esr-config]']);
    expect(texts({ key: 'fcr', value: [30, 30] })).toEqual(["ESR's cap: 500 FCR (vanilla 200) [esr-config]"]);
    expect(texts({ key: 'dodge' })).toEqual(['Dodge, Avoid and Evade are each capped at 75% [esr-config]']);
    expect(texts({ key: 'resists', value: [30, 30] })).toEqual([
      'Nightmare subtracts 80%, Hell 150% [game-files]',
      'Capped at 75%, 95% at most with Maximum Resist [vanilla-engine]',
    ]);
    // Magic resist gets no difficulty penalty
    expect(texts({ key: 'resists', kind: 'magic-resist', value: [10, 10] })).toEqual([
      'Capped at 75%, 95% at most with Maximum Resist [vanilla-engine]',
    ]);
    expect(texts({ key: 'resists', kind: 'resist-fire', value: [30, 30] })).toHaveLength(2);
    expect(texts({ key: 'critical-damage', value: [-10, -10] })).toEqual(['Critical multiplier ×2 → ×1.9 [esr-config]']);
    expect(texts({ key: 'attack-rating' })).toEqual(["50% chance to hit at 5× the target's defense (vanilla 1×) [esr-config]"]);
    expect(texts({ key: 'freeze' })).toEqual(['Freeze length ÷2 in Nightmare, ÷4 in Hell [game-files]']);
  });

  it('shows nothing for entries without key numbers', () => {
    expect(texts({ key: 'knockback' })).toEqual([]);
    expect(texts({ key: 'cannot-be-frozen' })).toEqual([]);
    expect(texts({ key: 'critical-damage' })).toEqual([]);
  });

  it('never throws for any entry (every fact it reads is in the data)', () => {
    for (const entry of data.entries) {
      expect(() => peekNumbers({ key: entry.key, value: [10, 20] }, facts)).not.toThrow();
      expect(() => peekNumbers({ key: entry.key }, facts)).not.toThrow();
    }
  });
});

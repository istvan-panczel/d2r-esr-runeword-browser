/**
 * The modifier peek's key numbers (docs/features/MODIFIERS.md "Modifier peek"): one or two ESR values for the entry,
 * worked out for the hovered line's own value where that matters (leech per difficulty, Magic Find per quality, Deadly
 * Strike Damage's multiplier). Pure; reads the facts the peek data carries (modifierRefs.ts PEEK_FACT_KEYS).
 */
import type { ModifierFactOrigin } from '@/features/game-data/engine/schema';
import { difficultyFact, effectiveLeech, effectiveMagicFind, hitCurve, numberFact, recordFact, type Facts } from './modifierMath';
import { formatNumber, formatSmallPercent } from './modifierPlaceholders';
import type { ModifierRef } from './modifierRefData';

export interface PeekNumber {
  readonly text: string;
  /** Where the number comes from (the source badge after it) */
  readonly origin: ModifierFactOrigin;
}

/** The line's value for per-value numbers: the roll's maximum; none for per-level lines (the number is per level) */
function lineValue(ref: ModifierRef): number | null {
  if (ref.value === undefined || ref.perLevel === true) return null;
  const value = Math.max(Math.abs(ref.value[0]), Math.abs(ref.value[1]));
  return value > 0 ? value : null;
}

function percent(value: number): string {
  return `${formatNumber(value, 2)}%`;
}

function leechNumbers(ref: ModifierRef, facts: Facts, resource: 'life' | 'mana'): PeekNumber[] {
  const value = lineValue(ref);
  const nightmare = difficultyFact(facts, resource === 'life' ? 'difficulty.LifeStealDivisor' : 'difficulty.ManaStealDivisor', 1);
  const hell = difficultyFact(facts, resource === 'life' ? 'difficulty.LifeStealDivisor' : 'difficulty.ManaStealDivisor', 2);
  if (value === null) return [{ text: `Divided by ${String(nightmare)} in Nightmare and ${String(hell)} in Hell`, origin: 'game-files' }];
  const at = (difficulty: 1 | 2) => formatSmallPercent(effectiveLeech(value, difficulty, resource, facts).engine);
  return [{ text: `${percent(value)} leeches about ${at(1)} in Nightmare and ${at(2)} in Hell`, origin: 'game-files' }];
}

function magicFindNumbers(ref: ModifierRef, facts: Facts): PeekNumber[] {
  const value = lineValue(ref);
  if (value === null) return [];
  const at = (quality: 'unique' | 'set' | 'rare') => `+${String(effectiveMagicFind(value, quality, facts))}%`;
  return [
    {
      text: `This line alone (${percent(value)}): unique ${at('unique')}, set ${at('set')}, rare ${at('rare')} (diminishing returns)`,
      origin: 'vanilla-engine',
    },
  ];
}

/** The numbers an entry's peek shows; [] for entries without any */
export function peekNumbers(ref: ModifierRef, facts: Facts): PeekNumber[] {
  switch (ref.key) {
    case 'life-leech':
      return leechNumbers(ref, facts, 'life');
    case 'mana-leech':
      return leechNumbers(ref, facts, 'mana');
    case 'magic-find':
      return magicFindNumbers(ref, facts);
    case 'crushing-blow': {
      const share = recordFact(facts, 'crushingBlow.share');
      const of = (target: string) => percent(share[target] ?? 0);
      return [
        {
          text: `Removes ${of('monster')} of a normal monster's current life, ${of('unique')} of a unique's, ${of('act_boss')} of an act boss's`,
          origin: 'esr-config',
        },
      ];
    }
    case 'deadly-strike': {
      const base = numberFact(facts, 'criticalDamage.basePercent');
      return [{ text: `A deadly strike deals ×${formatNumber(base / 100)} physical damage`, origin: 'esr-config' }];
    }
    case 'critical-damage': {
      const base = numberFact(facts, 'criticalDamage.basePercent');
      const value = lineValue(ref);
      if (value === null) return [];
      return [{ text: `Critical multiplier ×${formatNumber(base / 100)} → ×${formatNumber((base + value) / 100)}`, origin: 'esr-config' }];
    }
    case 'fcr': {
      const cap = facts.find((fact) => fact.key === 'castRate.cap');
      const vanilla = typeof cap?.vanilla === 'number' ? ` (vanilla ${String(cap.vanilla)})` : '';
      return [{ text: `ESR's cap: ${String(numberFact(facts, 'castRate.cap'))} FCR${vanilla}`, origin: 'esr-config' }];
    }
    case 'dodge': {
      const cap = recordFact(facts, 'dodge.cap');
      return [{ text: `Dodge, Avoid and Evade are each capped at ${percent(cap.dodge)}`, origin: 'esr-config' }];
    }
    case 'resists': {
      const nightmare = -difficultyFact(facts, 'difficulty.ResistPenalty', 1);
      const hell = -difficultyFact(facts, 'difficulty.ResistPenalty', 2);
      return [
        { text: `Nightmare subtracts ${String(nightmare)}%, Hell ${String(hell)}%`, origin: 'game-files' },
        {
          text: `Capped at ${percent(numberFact(facts, 'resist.maxBase'))}, ${percent(numberFact(facts, 'resist.hardCap'))} at most with Maximum Resist`,
          origin: 'vanilla-engine',
        },
      ];
    }
    case 'max-resists':
      return [{ text: `Hard ceiling: ${percent(numberFact(facts, 'resist.hardCap'))}`, origin: 'vanilla-engine' }];
    case 'physical-resist':
      return [{ text: `Capped at ${percent(numberFact(facts, 'resist.physicalCap'))}`, origin: 'vanilla-engine' }];
    case 'absorb':
      return [{ text: `Percent absorb caps at ${percent(numberFact(facts, 'absorb.percentCap'))}`, origin: 'vanilla-engine' }];
    case 'block':
      return [{ text: `Capped at ${percent(numberFact(facts, 'block.cap'))}`, origin: 'vanilla-engine' }];
    case 'attack-rating':
    case 'target-defense': {
      const esr = hitCurve(facts).pivotRatio;
      const vanilla = hitCurve(facts, true).pivotRatio;
      return [
        {
          text: `50% chance to hit at ${formatNumber(esr)}× the target's defense (vanilla ${formatNumber(vanilla)}×)`,
          origin: 'esr-config',
        },
      ];
    }
    case 'freeze': {
      const nightmare = difficultyFact(facts, 'difficulty.MonsterFreezeDivisor', 1);
      const hell = difficultyFact(facts, 'difficulty.MonsterFreezeDivisor', 2);
      return [{ text: `Freeze length ÷${String(nightmare)} in Nightmare, ÷${String(hell)} in Hell`, origin: 'game-files' }];
    }
    default:
      return [];
  }
}

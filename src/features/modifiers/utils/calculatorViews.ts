/**
 * The rows the modifier calculators show (leech per difficulty, Magic Find per quality, hit chance, Crushing Blow per
 * target), from modifierMath.ts and the facts. The vanilla columns run the same formulas on the facts' `vanilla`
 * values. Pure; the components only render these.
 */
import type { ModifierFact } from '@/features/game-data/engine/schema';
import {
  crushingBlow,
  difficultyFact,
  effectiveLeech,
  effectiveMagicFind,
  hitChance,
  recordFact,
  type CrushingBlowTarget,
  type Difficulty,
  type Facts,
  type MagicFindQuality,
} from './modifierMath';

export const DIFFICULTY_LABELS: readonly [string, string, string] = ['Normal', 'Nightmare', 'Hell'];
const DIFFICULTY_INDEXES: readonly Difficulty[] = [0, 1, 2];

/** A calculator input: digits (and one leading minus / dot) parsed and clamped; anything else is `fallback` */
export function parseNumberInput(text: string, min: number, max: number, fallback: number): number {
  const value = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** The facts with these keys' values replaced by their `vanilla` values (facts without one stay as they are) */
export function vanillaFacts(facts: Facts, keys: readonly string[]): ModifierFact[] {
  return facts.map((fact) => (keys.includes(fact.key) && fact.vanilla !== undefined ? { ...fact, value: fact.vanilla } : fact));
}

// --- leech --------------------------------------------------------------------------------------------------------------

export interface LeechRow {
  readonly difficulty: string;
  readonly divisor: number;
  readonly vanillaDivisor: number | null;
  /** % of the physical damage dealt, unrounded */
  readonly exact: number;
  /** % with the vanilla engine's 1/64 % precision */
  readonly engine: number;
  /** The same leech in vanilla D2R (exact) */
  readonly vanillaExact: number | null;
  /** Life (or mana) back per 1000 physical damage dealt, at engine precision */
  readonly per1000: number;
}

export function leechRows(leech: number, resource: 'life' | 'mana', drain: number, facts: Facts): LeechRow[] {
  const key = resource === 'life' ? 'difficulty.LifeStealDivisor' : 'difficulty.ManaStealDivisor';
  const vanilla = facts.find((fact) => fact.key === key)?.vanilla;
  const vanillaSet = vanilla === undefined ? null : vanillaFacts(facts, [key]);
  return DIFFICULTY_INDEXES.map((difficulty) => {
    const result = effectiveLeech(leech, difficulty, resource, facts, drain);
    return {
      difficulty: DIFFICULTY_LABELS[difficulty],
      divisor: difficultyFact(facts, key, difficulty),
      vanillaDivisor: vanillaSet === null ? null : difficultyFact(vanillaSet, key, difficulty),
      exact: result.exact,
      engine: result.engine,
      vanillaExact: vanillaSet === null ? null : effectiveLeech(leech, difficulty, resource, vanillaSet, drain).exact,
      per1000: result.engine * 10,
    };
  });
}

/** The smallest whole item leech % that is not 0 at engine precision in this difficulty (null: none up to 1000) */
export function minimumUsefulLeech(resource: 'life' | 'mana', difficulty: Difficulty, facts: Facts): number | null {
  for (let leech = 1; leech <= 1000; leech++) if (effectiveLeech(leech, difficulty, resource, facts).engine > 0) return leech;
  return null;
}

// --- magic find ---------------------------------------------------------------------------------------------------------

export interface MagicFindRow {
  readonly quality: MagicFindQuality;
  readonly label: string;
  readonly esr: number;
  /** Without ESR's soft tail */
  readonly vanilla: number;
  /** The diminishing-returns constant (null for magic items: no diminishing returns) */
  readonly dim: number | null;
  /** The part ESR's tail adds */
  readonly tail: number;
}

const MF_QUALITIES: readonly { quality: MagicFindQuality; label: string }[] = [
  { quality: 'magic', label: 'Magic' },
  { quality: 'rare', label: 'Rare' },
  { quality: 'set', label: 'Set' },
  { quality: 'unique', label: 'Unique' },
];

export function magicFindRows(mf: number, facts: Facts): MagicFindRow[] {
  const vanillaSet = vanillaFacts(facts, ['magicFind.tail']);
  const dims = recordFact(facts, 'magicFind.dim');
  return MF_QUALITIES.map(({ quality, label }) => {
    const esr = effectiveMagicFind(mf, quality, facts);
    const vanilla = effectiveMagicFind(mf, quality, vanillaSet);
    return { quality, label, esr, vanilla, dim: quality === 'magic' ? null : (dims[quality] ?? null), tail: esr - vanilla };
  });
}

// --- hit chance ---------------------------------------------------------------------------------------------------------

export interface HitChanceView {
  /** Attack rating / defense (null when the defense is 0) */
  readonly ratio: number | null;
  readonly esr: number;
  /** The vanilla curve at equal attacker and defender level */
  readonly vanilla: number;
  /** The attack rating ESR's curve needs for these chances against this defense (null: out of reach) */
  readonly needed: readonly { readonly chance: number; readonly attackRating: number | null }[];
}

export const HIT_TARGETS: readonly number[] = [50, 75, 90, 95];
const AR_SEARCH_LIMIT = 100_000_000;

/** The smallest attack rating with at least `chance` % against `defense` (binary search; the curve only rises) */
export function attackRatingFor(chance: number, defense: number, facts: Facts): number | null {
  if (defense <= 0) return 0;
  if (hitChance(AR_SEARCH_LIMIT, defense, facts) < chance) return null;
  let low = 0;
  let high = AR_SEARCH_LIMIT;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (hitChance(mid, defense, facts) >= chance) high = mid;
    else low = mid + 1;
  }
  return low;
}

export function hitChanceView(attackRating: number, defense: number, facts: Facts): HitChanceView {
  return {
    ratio: defense > 0 ? attackRating / defense : null,
    esr: hitChance(attackRating, defense, facts),
    vanilla: hitChance(attackRating, defense, facts, { vanilla: true, levels: [1, 1] }),
    needed: HIT_TARGETS.map((chance) => ({ chance, attackRating: attackRatingFor(chance, defense, facts) })),
  };
}

// --- crushing blow ------------------------------------------------------------------------------------------------------

export const CRUSHING_BLOW_TARGETS: readonly { readonly target: CrushingBlowTarget; readonly label: string }[] = [
  { target: 'monster', label: 'Normal monster' },
  { target: 'champion', label: 'Champion' },
  { target: 'minion', label: 'Minion' },
  { target: 'unique', label: 'Unique (yellow)' },
  { target: 'super_unique', label: 'Superunique' },
  { target: 'act_boss', label: 'Act boss' },
  { target: 'mercenary', label: 'Mercenary' },
  { target: 'player', label: 'Player' },
];

export interface CrushingBlowInputs {
  readonly currentLife: number;
  readonly physicalResist: number;
  readonly players: number;
  readonly ranged: boolean;
}

export interface CrushingBlowRow {
  readonly target: CrushingBlowTarget;
  readonly label: string;
  /** % of current life per Crushing Blow */
  readonly share: number;
  readonly damage: number;
  readonly vanillaShare: number;
  readonly vanillaDamage: number;
}

export function crushingBlowRows(inputs: CrushingBlowInputs, facts: Facts): CrushingBlowRow[] {
  const vanillaSet = vanillaFacts(facts, ['crushingBlow.share', 'crushingBlow.ranged']);
  return CRUSHING_BLOW_TARGETS.map(({ target, label }) => {
    const input = { ...inputs, target };
    const esr = crushingBlow(input, facts);
    const vanilla = crushingBlow(input, vanillaSet);
    return { target, label, share: esr.share, damage: esr.damage, vanillaShare: vanilla.share, vanillaDamage: vanilla.damage };
  });
}

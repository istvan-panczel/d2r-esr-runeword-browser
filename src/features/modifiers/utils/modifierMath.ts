/**
 * The modifier calculators' formulas (docs/features/MODIFIERS.md "Calculators"): effective leech per difficulty, the
 * Magic Find curve, ESR's hit chance curve and Crushing Blow per target. Every parameter comes from modifiers.json
 * `facts` (difficultylevels.txt, ESR's plugin configs, vanilla engine constants), so an ESR update flows through
 * without code changes. Pure functions; a missing fact throws (the bundle integrity test pins them).
 */
import type { ModifierFact } from '../../game-data/engine/schema.ts';

export type Facts = readonly ModifierFact[];

/** 0 Normal, 1 Nightmare, 2 Hell */
export type Difficulty = 0 | 1 | 2;

function fact(facts: Facts, key: string): ModifierFact {
  const found = facts.find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`modifiers.json has no fact ${key}`);
  return found;
}

export function numberFact(facts: Facts, key: string): number {
  const { value } = fact(facts, key);
  if (typeof value !== 'number') throw new Error(`fact ${key} is not a number`);
  return value;
}

/** A per-difficulty fact's value ([Normal, Nightmare, Hell]) */
export function difficultyFact(facts: Facts, key: string, difficulty: Difficulty): number {
  const { value } = fact(facts, key);
  if (!Array.isArray(value) || typeof value[difficulty] !== 'number') throw new Error(`fact ${key} is not per difficulty`);
  return value[difficulty];
}

export function recordFact(facts: Facts, key: string): Readonly<Record<string, number>> {
  const { value } = fact(facts, key);
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`fact ${key} is not a record`);
  return value;
}

// --- leech --------------------------------------------------------------------------------------------------------------

export interface LeechResult {
  /** Percent of the physical damage dealt that comes back, without rounding */
  exact: number;
  /**
   * The same with the vanilla engine's precision: floor(leech × 64 / divisor) / 64 (D2MOO SUNITDMG_ExecuteEvents).
   * Whether D2R keeps this precision, or rounds anything under 1 % down to 0 as some guides say, is not confirmed.
   */
  engine: number;
}

/**
 * Effective life or mana leech: the item value divided by difficultylevels.txt LifeStealDivisor / ManaStealDivisor,
 * scaled by the target's monstats.txt Drain (100 = full, 0 = cannot be leeched).
 */
export function effectiveLeech(leech: number, difficulty: Difficulty, resource: 'life' | 'mana', facts: Facts, drain = 100): LeechResult {
  const divisor = difficultyFact(facts, resource === 'life' ? 'difficulty.LifeStealDivisor' : 'difficulty.ManaStealDivisor', difficulty);
  const precision = numberFact(facts, 'leech.precision');
  const scale = Math.max(0, drain) / 100;
  if (leech <= 0 || divisor <= 0) return { exact: 0, engine: 0 };
  return {
    exact: (leech / divisor) * scale,
    engine: (Math.floor((leech * precision) / divisor) / precision) * scale,
  };
}

// --- magic find ---------------------------------------------------------------------------------------------------------

export type MagicFindQuality = 'unique' | 'set' | 'rare' | 'magic';

/**
 * Up to this much Magic Find the engine skips the diminishing returns: it applies the curve only when 100 + MF is
 * above 110 (D2MOO D2Game/src/ITEMS/Items.cpp:2397, 2416, 2437), else it divides by 100 + MF directly.
 */
export const MAGIC_FIND_FULL_VALUE_UP_TO = 10;

/**
 * The Magic Find a quality roll uses: magic items get the full value, and so does any MF up to 10 (or negative MF);
 * above that unique, set and rare items get floor(dim × MF / (MF + dim)) (dim 250 / 500 / 600) plus ESR's soft tail
 * floor(MF × tail / 100). Whole numbers, as the engine's integer maths gives them (the tail's rounding is the config's
 * formula read the same way; the tail is assumed to ride on the curve branch only).
 */
export function effectiveMagicFind(mf: number, quality: MagicFindQuality, facts: Facts): number {
  if (quality === 'magic' || mf <= MAGIC_FIND_FULL_VALUE_UP_TO) return mf;
  const dim = recordFact(facts, 'magicFind.dim')[quality];
  const tail = recordFact(facts, 'magicFind.tail')[quality] ?? 0;
  return Math.floor((dim * mf) / (mf + dim)) + Math.floor((mf * tail) / 100);
}

// --- hit chance ---------------------------------------------------------------------------------------------------------

/** attack-rating.toml `[curve]` / `[chance]` (attackRating.curve) */
export interface HitCurve {
  enabled: number;
  pivotRatio: number;
  steepness: number;
  tail: number;
  lateTail: number;
  blendStart: number;
  blendEnd: number;
  snapTo100At: number;
  minChance: number;
  maxChance: number;
  levelScaling: number;
}

export function hitCurve(facts: Facts, vanilla = false): HitCurve {
  const found = fact(facts, 'attackRating.curve');
  const value = vanilla ? found.vanilla : found.value;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('fact attackRating.curve is not a record');
  return value as unknown as HitCurve;
}

/** Smoothstep weight of the late tail between blendStart and blendEnd (0 before, 1 after) */
function lateTailWeight(ratio: number, curve: HitCurve): number {
  if (ratio <= curve.blendStart) return 0;
  if (ratio >= curve.blendEnd) return 1;
  const x = (ratio - curve.blendStart) / (curve.blendEnd - curve.blendStart);
  return x * x * (3 - 2 * x);
}

/**
 * The curve before the limits, as a whole percent. Below the pivot 100 × r^s / (r^s + pivot^s); above it
 * 50 + 50 × d / (d + tail) with d = r − pivot, the late tail's value blended in with a smoothstep weight between
 * blendStart and blendEnd. The config only says "blended in smoothly": the smoothstep reproduces the plugin author's
 * table (a linear blend misses r = 80), blending the tail value instead of the chance reproduces it too.
 */
export function curveChance(ratio: number, curve: HitCurve): number {
  let chance: number;
  if (ratio <= curve.pivotRatio) {
    const rs = ratio ** curve.steepness;
    chance = (100 * rs) / (rs + curve.pivotRatio ** curve.steepness);
  } else {
    const d = ratio - curve.pivotRatio;
    const early = 50 + (50 * d) / (d + curve.tail);
    const late = curve.lateTail > 0 ? 50 + (50 * d) / (d + curve.lateTail) : early;
    chance = early + (late - early) * (curve.lateTail > 0 ? lateTailWeight(ratio, curve) : 0);
  }
  if (curve.snapTo100At < 100 && chance >= curve.snapTo100At) return 100;
  return Math.floor(chance);
}

/**
 * Chance to hit in percent: attack rating vs defense through attack-rating.toml (ESR) or the vanilla curve
 * (`vanilla`), then the level scaling when the curve has it (`levels`: attacker and defender level), then min / max.
 */
export function hitChance(
  attackRating: number,
  defense: number,
  facts: Facts,
  options: { vanilla?: boolean; levels?: [number, number] } = {}
): number {
  const curve = hitCurve(facts, options.vanilla === true);
  let chance = defense <= 0 ? 100 : attackRating <= 0 ? 0 : curveChance(attackRating / defense, curve);
  if (curve.levelScaling !== 0 && options.levels !== undefined) {
    const [attacker, defender] = options.levels;
    if (attacker + defender > 0) chance = Math.floor((2 * chance * attacker) / (attacker + defender));
  }
  return Math.min(curve.maxChance, Math.max(curve.minChance, chance));
}

// --- crushing blow ------------------------------------------------------------------------------------------------------

/** crushing-blow.toml target classes */
export type CrushingBlowTarget = 'monster' | 'champion' | 'unique' | 'super_unique' | 'act_boss' | 'minion' | 'mercenary' | 'player';

export interface CrushingBlowInput {
  /** The target's current life */
  currentLife: number;
  target: CrushingBlowTarget;
  ranged?: boolean;
  /** The game's player count (/players): divides Crushing Blow against monsters */
  players?: number;
  /** The target's physical resist (damage reduced by %); reduces the result, a negative value does not raise it */
  physicalResist?: number;
}

export interface CrushingBlowResult {
  /** Percent of current life one Crushing Blow removes */
  share: number;
  /** Life removed */
  damage: number;
}

/**
 * Life one Crushing Blow removes: the per-class share of current life (crushing-blow.toml, % of vanilla), the ranged
 * setting for missiles, divided by the /players life bonus against monsters (vanilla: +50 % life per extra player),
 * reduced by the target's physical resist (capped at 100; negative resist does not add).
 */
export function crushingBlow(input: CrushingBlowInput, facts: Facts): CrushingBlowResult {
  let share = recordFact(facts, 'crushingBlow.share')[input.target] ?? 0;
  if (input.ranged === true) share = (share * numberFact(facts, 'crushingBlow.ranged')) / 100;
  const players = Math.max(1, Math.floor(input.players ?? 1));
  if (input.target !== 'mercenary' && input.target !== 'player')
    share = share / (1 + (numberFact(facts, 'monster.hpBonusPerPlayer') * (players - 1)) / 100);
  const resist = Math.min(100, Math.max(0, input.physicalResist ?? 0));
  share = (share * (100 - resist)) / 100;
  return { share, damage: (Math.max(0, input.currentLife) * share) / 100 };
}

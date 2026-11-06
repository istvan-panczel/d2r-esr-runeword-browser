/**
 * The `{placeholders}` of the modifier explanations, resolved against modifiers.json `facts` at render time (and for the
 * peek's summaries at `modifiers:refs` time), so a new ESR value shows up without editing the text
 * (docs/features/MODIFIERS.md "Content"). Naming:
 *
 * - `{difficulty.<normal|nightmare|hell|*>.<column>}`: difficultylevels.txt (`difficulty.<Column>` facts); `*` = all three
 * - `{charstats.<class|*>.<Column>}`: charstats.txt per class (`charstats.<Column>`); `*` = one value when every class
 *   has it, else the list
 * - `{config.<plugin>.<section>.<key>}`, `{patch.<file>.<value>}`, `{monstats.…}`, `{engine.…}` (vanilla engine
 *   constants): PLACEHOLDER_FACTS below
 * - `{derived.…}`: a number computed from the facts with the calculators' formulas (DERIVED below), e.g.
 *   `{derived.crushing-blow.<target>}`, `{derived.leech.<life|mana>.<item %>.<difficulty>}`
 * - `{vanilla.<any path above>}`: the same fact's vanilla value (only facts that have one)
 * - `{…key}`: the previous placeholder's path with its last part replaced (`{config.x.curve.tail}` … `{…late_tail}`)
 *
 * An HTML comment right after a placeholder (`{x}<!-- 150 -->`) is the value at writing time and is dropped; any other
 * comment's text is kept as plain text (the content test allows no such comment in the committed text).
 */
import type { ModifierFact, ModifierFactValue } from '../../game-data/engine/schema.ts';
import {
  difficultyFact,
  effectiveLeech,
  effectiveMagicFind,
  numberFact,
  recordFact,
  type Difficulty,
  type Facts,
  type MagicFindQuality,
} from './modifierMath.ts';

interface FactRef {
  readonly fact: string;
  /** Record field */
  readonly field?: string;
  /** Per-difficulty index */
  readonly index?: number;
  /** Show a 0 / 1 setting as false / true */
  readonly bool?: true;
}

/** Placeholders whose path is not a fact key by rule: plugin config keys, patch values, monstats counts */
export const PLACEHOLDER_FACTS: Readonly<Partial<Record<string, FactRef>>> = {
  'config.critical-strike-damage.critical_strike_damage.base_percent': { fact: 'criticalDamage.basePercent' },
  'config.critical-strike-damage.critical_strike_damage.max_percent': { fact: 'criticalDamage.maxPercent' },
  'config.critical-strike-damage.critical_strike_damage.stat_id': { fact: 'criticalDamage.stat' },
  'config.crushing-blow.attack.ranged': { fact: 'crushingBlow.ranged' },
  'config.bleed.bleed.min_damage_stat': { fact: 'bleed.stats', field: 'min' },
  'config.bleed.bleed.max_damage_stat': { fact: 'bleed.stats', field: 'max' },
  'config.bleed.bleed.length_stat': { fact: 'bleed.stats', field: 'length' },
  'config.bleed.bleed.state_id': { fact: 'bleed.stats', field: 'state' },
  'config.attack-rating.curve.pivot_ratio': { fact: 'attackRating.curve', field: 'pivotRatio' },
  'config.attack-rating.curve.steepness': { fact: 'attackRating.curve', field: 'steepness' },
  'config.attack-rating.curve.tail': { fact: 'attackRating.curve', field: 'tail' },
  'config.attack-rating.curve.late_tail': { fact: 'attackRating.curve', field: 'lateTail' },
  'config.attack-rating.curve.blend_start_ratio': { fact: 'attackRating.curve', field: 'blendStart' },
  'config.attack-rating.curve.blend_end_ratio': { fact: 'attackRating.curve', field: 'blendEnd' },
  'config.attack-rating.curve.snap_to_100_at': { fact: 'attackRating.curve', field: 'snapTo100At' },
  'config.attack-rating.chance.min_chance': { fact: 'attackRating.curve', field: 'minChance' },
  'config.attack-rating.chance.max_chance': { fact: 'attackRating.curve', field: 'maxChance' },
  'config.attack-rating.chance.level_scaling': { fact: 'attackRating.curve', field: 'levelScaling', bool: true },
  'config.cast-rate-cap.cast-rate-cap.fcr_cap': { fact: 'castRate.cap' },
  'config.dodge-avoid-evade-cap.dodge_avoid_evade_cap.cap_percent': { fact: 'dodge.cap', field: 'dodge' },
  'config.magic-find-soft-tail.magic_find_soft_tail.tail_percent': { fact: 'magicFind.tail', field: 'unique' },
  'config.item-quantity.stat_id': { fact: 'extraItems.settings', field: 'stat' },
  'config.item-quantity.percent': { fact: 'extraItems.settings', field: 'percent', bool: true },
  'config.item-quantity.exclude_prime_evils': { fact: 'extraItems.settings', field: 'excludePrimeEvils', bool: true },
  'config.item-quantity.credit_minion_owner': { fact: 'extraItems.settings', field: 'creditMinionOwner', bool: true },
  'config.item-quantity.max_bonus_picks': { fact: 'extraItems.settings', field: 'maxBonusPicks' },
  'config.soft-hit-removal.soft_hit_removal.attacker_takes_damage': { fact: 'thorns.killCredit' },
  'config.soft-hit-removal.soft_hit_removal.thorns_percent': { fact: 'thorns.percentKillCredit' },
  'config.poison-immunity.poison_immunity.state_id': { fact: 'poisonImmunity.state' },
  'config.enhanced-damage-fix.enhanced_damage_fix.enabled': { fact: 'enhancedDamageFix.enabled' },
  'patch.esr-resistance-floor-minus-1000.floor': { fact: 'resist.floor' },
  'monstats.drainN.blankCount': { fact: 'monstats.drainZero', index: 0 },
  'monstats.drainNM.blankCount': { fact: 'monstats.drainZero', index: 1 },
  'monstats.drainH.blankCount': { fact: 'monstats.drainZero', index: 2 },
  'monstats.drainH.partialCount': { fact: 'monstats.drainPartial', index: 2 },
  'engine.leech.precision': { fact: 'leech.precision' },
  'engine.resist.max-base': { fact: 'resist.maxBase' },
  'engine.resist.hard-cap': { fact: 'resist.hardCap' },
  'engine.resist.physical-cap': { fact: 'resist.physicalCap' },
  'engine.absorb.percent-cap': { fact: 'absorb.percentCap' },
  'engine.block.cap': { fact: 'block.cap' },
  'engine.magic-find.dim.unique': { fact: 'magicFind.dim', field: 'unique' },
  'engine.magic-find.dim.set': { fact: 'magicFind.dim', field: 'set' },
  'engine.magic-find.dim.rare': { fact: 'magicFind.dim', field: 'rare' },
  'derived.fcr-ceiling': { fact: 'castRate.maxRate' },
};

const DIFFICULTIES: Readonly<Partial<Record<string, Difficulty>>> = { normal: 0, nightmare: 1, hell: 2 };

/** A number as the texts write it: whole, or up to `digits` decimals without trailing zeros */
export function formatNumber(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** A leech or share percent: 2 decimals from 1 % up, 3 below */
export function formatSmallPercent(value: number): string {
  return `${formatNumber(value, Math.abs(value) >= 1 ? 2 : 3)}%`;
}

export function formatFactValue(value: ModifierFactValue, bool = false): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return bool ? (value !== 0 ? 'true' : 'false') : formatNumber(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => (typeof entry === 'number' ? formatNumber(entry) : entry)).join(' / ');
  const entries = Object.entries(value);
  const values = new Set(entries.map(([, entry]) => entry));
  if (values.size === 1) return formatNumber(entries[0]?.[1] ?? 0);
  return entries.map(([name, entry]) => `${name} ${formatNumber(entry)}`).join(', ');
}

export interface ResolvedPlaceholder {
  readonly text: string;
  /** The fact it reads (shown in the card's fact tables) */
  readonly fact: string;
}

function select(found: ModifierFact, ref: FactRef): string | null {
  const { value } = found;
  if (ref.field !== undefined) {
    if (typeof value !== 'object' || Array.isArray(value)) return null;
    return Object.hasOwn(value, ref.field) ? formatFactValue(value[ref.field], ref.bool === true) : null;
  }
  if (ref.index !== undefined) {
    if (!Array.isArray(value)) return null;
    const entry = value.at(ref.index);
    return typeof entry === 'number' ? formatNumber(entry) : null;
  }
  return formatFactValue(value, ref.bool === true);
}

const RESOURCES: Readonly<Partial<Record<string, 'life' | 'mana'>>> = { life: 'life', mana: 'mana' };
const QUALITIES: Readonly<Partial<Record<string, MagicFindQuality>>> = { unique: 'unique', set: 'set', rare: 'rare', magic: 'magic' };
const LEECH_DIVISORS = { life: 'difficulty.LifeStealDivisor', mana: 'difficulty.ManaStealDivisor' } as const;

/** A whole-number path part, or NaN */
function numberPart(part: string | undefined): number {
  return part !== undefined && /^-?\d+(\.\d+)?$/.test(part) ? Number(part) : Number.NaN;
}

/** ESR's cast rate for an FCR value: 100 + the engine's 120 × FCR / (FCR + 120), stopped at the plugin's ceiling */
function castRate(fcr: number, facts: Facts): number {
  const divisors = recordFact(facts, 'speed.breakpointDivisor');
  if (!Object.hasOwn(divisors, 'fcr')) throw new Error('speed.breakpointDivisor has no fcr');
  const divisor = divisors.fcr;
  return Math.min(100 + Math.floor((divisor * fcr) / (fcr + divisor)), numberFact(facts, 'castRate.maxRate'));
}

/** The path parts after the name (each may be missing) */
type Derive = (args: readonly (string | undefined)[], facts: Facts) => ResolvedPlaceholder | null;

/** `{derived.<name>.<args…>}`: numbers computed from the facts (a missing fact throws and resolves to nothing) */
const DERIVED: Readonly<Partial<Record<string, Derive>>> = {
  /** `crushing-blow.<target>`: the share of current life, with "%" */
  'crushing-blow': ([target], facts) => {
    const shares = recordFact(facts, 'crushingBlow.share');
    if (target === undefined || !Object.hasOwn(shares, target)) return null;
    return { text: `${formatNumber(shares[target])}%`, fact: 'crushingBlow.share' };
  },
  /** `leech.<life|mana>.<item %>.<difficulty>`: effective leech with the engine's 1/64 precision, with "%" */
  leech: ([resource, leech, difficulty], facts) => {
    const res = RESOURCES[resource ?? ''];
    const level = DIFFICULTIES[difficulty ?? ''];
    const value = numberPart(leech);
    if (res === undefined || level === undefined || !Number.isFinite(value)) return null;
    return { text: formatSmallPercent(effectiveLeech(value, level, res, facts).engine), fact: LEECH_DIVISORS[res] };
  },
  /** `leech-threshold.<life|mana>.<difficulty>`: item leech below divisor / precision gives 0, with "%" */
  'leech-threshold': ([resource, difficulty], facts) => {
    const res = RESOURCES[resource ?? ''];
    const level = DIFFICULTIES[difficulty ?? ''];
    if (res === undefined || level === undefined) return null;
    const divisor = difficultyFact(facts, LEECH_DIVISORS[res], level);
    return { text: formatSmallPercent(divisor / numberFact(facts, 'leech.precision')), fact: LEECH_DIVISORS[res] };
  },
  /** `critical-multiplier.<Deadly Strike Damage %>`: the crit multiplier (base_percent + bonus) / 100, without "×" */
  'critical-multiplier': ([bonus], facts) => {
    const value = numberPart(bonus);
    if (!Number.isFinite(value)) return null;
    return { text: formatNumber((numberFact(facts, 'criticalDamage.basePercent') + value) / 100), fact: 'criticalDamage.basePercent' };
  },
  /** `magic-find.<quality>.<MF>`: the effective Magic Find (effectiveMagicFind), without "%" */
  'magic-find': ([quality, mf], facts) => {
    const q = QUALITIES[quality ?? ''];
    const value = numberPart(mf);
    if (q === undefined || !Number.isFinite(value)) return null;
    return { text: formatNumber(effectiveMagicFind(value, q, facts)), fact: 'magicFind.tail' };
  },
  /** `fcr-rate.<FCR>`: the cast animation rate ESR gives that FCR */
  'fcr-rate': ([fcr], facts) => {
    const value = numberPart(fcr);
    return Number.isFinite(value) ? { text: formatNumber(castRate(value, facts)), fact: 'castRate.maxRate' } : null;
  },
  /** `fcr-frames.<animation frames>.<FCR>`: frames per cast at AnimationSpeed 256, ceil(100 × frames / rate) − 1 */
  'fcr-frames': ([frames, fcr], facts) => {
    const length = numberPart(frames);
    const value = numberPart(fcr);
    if (!Number.isFinite(length) || !Number.isFinite(value)) return null;
    return { text: formatNumber(Math.ceil((100 * length) / castRate(value, facts)) - 1), fact: 'castRate.maxRate' };
  },
  /** `fcr-max-useful`: the smallest FCR that reaches ESR's ceiling (more changes nothing) */
  'fcr-max-useful': (args, facts) => {
    if (args.length > 0) return null;
    const ceiling = numberFact(facts, 'castRate.maxRate');
    const cap = numberFact(facts, 'castRate.cap');
    for (let fcr = 0; fcr <= cap; fcr++) if (castRate(fcr, facts) >= ceiling) return { text: formatNumber(fcr), fact: 'castRate.cap' };
    return null;
  },
  /** `max-resist-headroom`: the most maximum resist that matters, hard cap − base cap */
  'max-resist-headroom': (args, facts) =>
    args.length > 0
      ? null
      : { text: formatNumber(numberFact(facts, 'resist.hardCap') - numberFact(facts, 'resist.maxBase')), fact: 'resist.hardCap' },
  /** `attack-rating-table`: the plugin author's own table, "ratio → chance, …" */
  'attack-rating-table': (args, facts) => {
    if (args.length > 0) return null;
    const table = Object.entries(recordFact(facts, 'attackRating.table'))
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ratio, chance]) => `${ratio} → ${formatNumber(chance)}`)
      .join(', ');
    return { text: table, fact: 'attackRating.table' };
  },
};

/** One placeholder path (without braces), or null when it names nothing in `facts` */
export function resolvePlaceholder(path: string, facts: Facts): ResolvedPlaceholder | null {
  const factOf = (key: string) => facts.find((entry) => entry.key === key);
  const parts = path.split('.');
  const [scope, second, third] = [0, 1, 2].map((index) => parts.at(index));
  if (scope === 'difficulty' && parts.length === 3 && second !== undefined && third !== undefined) {
    const key = `difficulty.${third.charAt(0).toUpperCase()}${third.slice(1)}`;
    const found = factOf(key);
    if (found === undefined) return null;
    const text = second === '*' ? formatFactValue(found.value) : select(found, { fact: key, index: DIFFICULTIES[second] ?? -1 });
    return text === null ? null : { text, fact: key };
  }
  if (scope === 'charstats' && parts.length === 3 && second !== undefined && third !== undefined) {
    const key = `charstats.${third}`;
    const found = factOf(key);
    if (found === undefined || typeof found.value !== 'object' || Array.isArray(found.value)) return null;
    if (second === '*') return { text: formatFactValue(found.value), fact: key };
    const cls = Object.keys(found.value).find((name) => name.toLowerCase() === second.toLowerCase());
    return cls === undefined ? null : { text: formatNumber(found.value[cls]), fact: key };
  }
  if (scope === 'vanilla' && parts.length > 1) {
    const vanilla = facts.flatMap((entry) => (entry.vanilla === undefined ? [] : [{ ...entry, value: entry.vanilla }]));
    return resolvePlaceholder(parts.slice(1).join('.'), vanilla);
  }
  if (scope === 'derived' && second !== undefined) {
    const derive = DERIVED[second];
    if (derive !== undefined) {
      try {
        return derive(parts.slice(2), facts);
      } catch {
        // A fact the formula needs is missing (or has another shape): the placeholder resolves to nothing
        return null;
      }
    }
  }
  const target = /^config\.crushing-blow\.targets\.(\w+)$/.exec(path)?.at(1);
  const ref = target === undefined ? PLACEHOLDER_FACTS[path] : { fact: 'crushingBlow.settings', field: target };
  if (ref === undefined) return null;
  const found = factOf(ref.fact);
  const text = found === undefined ? null : select(found, ref);
  return text === null ? null : { text, fact: ref.fact };
}

export interface ResolvedText {
  readonly text: string;
  /** Fact keys the text reads, in order of first use */
  readonly facts: readonly string[];
  /** Placeholders that resolved to nothing (shown as written; the content test fails on them) */
  readonly missing: readonly string[];
}

const PLACEHOLDER = /\{([^{}\s]+)\}/g;

/**
 * A content line with its placeholders replaced by the current values and its HTML comments handled (see the header).
 * `{…key}` continues the path of the placeholder before it on the same line.
 */
export function resolveText(text: string, facts: Facts): ResolvedText {
  const withoutComments = text
    .replace(/(\{[^{}\s]+\}`?)\s*<!--[\s\S]*?-->/g, '$1')
    .replace(/<!--\s*([\s\S]*?)\s*-->/g, (_, inner: string) => inner);
  const used: string[] = [];
  const missing: string[] = [];
  let previous: string | null = null;
  const resolved = withoutComments.replace(PLACEHOLDER, (whole, raw: string) => {
    let path = raw;
    if (raw.startsWith('…') || raw.startsWith('...')) {
      const last = raw.replace(/^(…|\.\.\.)/, '');
      if (previous === null) {
        missing.push(raw);
        return whole;
      }
      path = `${previous.slice(0, previous.lastIndexOf('.'))}.${last}`;
    }
    previous = path;
    const found = resolvePlaceholder(path, facts);
    if (found === null) {
      missing.push(path);
      return whole;
    }
    if (!used.includes(found.fact)) used.push(found.fact);
    return found.text;
  });
  return { text: resolved, facts: used, missing };
}

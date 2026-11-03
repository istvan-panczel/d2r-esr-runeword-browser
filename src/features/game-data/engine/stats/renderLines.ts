/**
 * Turns the stat entries of one item (all its properties) into display lines:
 *
 * 0. add up identical stats (same stat + param)
 * 1. merge fixed-value min/max damage pairs (physical, fire, lightning, magic, cold + length, poison + length, bleed + length) and
 *    equal enhanced min/max damage % into one line
 * 2. collapse a `dgrp` set (dgrpfunc 19) when every stat of the set is present with the same value; a set is the stats
 *    sharing `dgrp` and `dgrpstrpos` (ESR puts minimum and maximum elemental damage into one dgrp with two strings)
 * 3. render the rest with their descfunc; stats with descfunc 0 (e.g. `tinkerflag2`) are hidden
 * 4. sort by `descpriority`, highest first (stable)
 */
import { renderStat, statValue, type DescContext } from './descfunc.ts';
import { formatSigned, sprintf, type Range } from './sprintf.ts';
import type { StatDef, StatEntry } from './types.ts';

export interface RenderContext extends DescContext {
  stats: ReadonlyMap<string, StatDef>;
}

export interface DamagePair {
  min: string;
  max: string;
  /** Length stat in frames (25 per second) */
  length?: string;
  rangeKey: string;
  /** Poison values are per frame in 1/256: shown total = value × length / 256 */
  perFrame?: boolean;
  /** Appended when the range string has no duration (cold) */
  durationSuffix?: boolean;
}

/** The fixed-value damage pairs merged into one line ("Adds 10-20 Fire Damage") */
export const DAMAGE_PAIRS: readonly DamagePair[] = [
  { min: 'firemindam', max: 'firemaxdam', rangeKey: 'strModFireDamageRange' },
  { min: 'lightmindam', max: 'lightmaxdam', rangeKey: 'strModLightningDamageRange' },
  { min: 'coldmindam', max: 'coldmaxdam', length: 'coldlength', rangeKey: 'strModColdDamageRange', durationSuffix: true },
  { min: 'poisonmindam', max: 'poisonmaxdam', length: 'poisonlength', rangeKey: 'strModPoisonDamageRange', perFrame: true },
  { min: 'bleedmindam', max: 'bleedmaxdam', length: 'bleedlength', rangeKey: 'strModBleedDamageRange' },
];

/** The string-table keys renderLines reads itself (besides the stat descriptions) */
export const RENDER_LINES_STRINGS: readonly string[] = [...DAMAGE_PAIRS.map((pair) => pair.rangeKey), 'strModEnhancedDamage'];

interface Line {
  priority: number;
  lines: string[];
}

function priorityOf(stat: string, ctx: RenderContext): number {
  return ctx.stats.get(stat)?.descpriority ?? 0;
}

function single(value: Range): number | Range {
  return value.min === value.max ? value.min : value;
}

/** "Adds %d-%d Fire Damage"; min == max reads "Adds 75 Fire Damage" (as on the ESR docs pages). Fixed values only. */
export function damageLine(pair: DamagePair, min: number, max: number, length: number | null, ctx: RenderContext): string {
  const format = ctx.strings.get(pair.rangeKey) ?? `${pair.min} %d-%d`;
  const total = (value: number) => (pair.perFrame === true && length !== null ? Math.round((value * length) / 256) : value);
  const lo = total(min);
  const hi = total(max);
  const seconds = length === null ? 0 : Math.round((length / 25) * 100) / 100;
  let line =
    format.includes('%d-%d') && lo === hi ? sprintf(format.replace('%d-%d', '%d'), [lo, seconds]) : sprintf(format, [lo, hi, seconds]);
  if (pair.durationSuffix === true && length !== null) line += ` over ${String(seconds)} Seconds`;
  return line;
}

function rangeOf(entry: StatEntry): Range {
  return { min: entry.min, max: entry.max };
}

function sameRange(a: Range, b: Range): boolean {
  return a.min === b.min && a.max === b.max;
}

/** Stats whose min/max are not a value (event skills: chance/level, charges: charges/level) are never summed. */
const UNSUMMED_DESCFUNCS = new Set([15, 24]);

/** The game adds up identical stats (same stat and param), e.g. `res-cold` 30 + `res-all` 40 → Cold Resist +70%. */
export function sumDuplicates(entries: readonly StatEntry[], ctx: RenderContext): StatEntry[] {
  const result: StatEntry[] = [];
  const index = new Map<string, number>();
  for (const entry of entries) {
    const summable = entry.text === undefined && !UNSUMMED_DESCFUNCS.has(ctx.stats.get(entry.stat)?.descfunc ?? 0);
    const key = `${entry.stat}|${entry.param}`;
    const i = summable ? index.get(key) : undefined;
    const existing = i === undefined ? undefined : result[i];
    if (i !== undefined && existing !== undefined) {
      result[i] = { ...existing, min: existing.min + entry.min, max: existing.max + entry.max };
      continue;
    }
    if (summable) index.set(key, result.length);
    result.push(entry);
  }
  return result;
}

export function renderLines(entries: readonly StatEntry[], ctx: RenderContext): string[] {
  const out: Line[] = [];
  const rest = sumDuplicates(entries, ctx);
  const take = (stat: string): StatEntry | undefined => {
    const i = rest.findIndex((entry) => entry.text === undefined && entry.stat === stat);
    if (i === -1) return undefined;
    const [entry] = rest.splice(i, 1);
    return entry;
  };
  const has = (stat: string) => rest.some((entry) => entry.text === undefined && entry.stat === stat);

  // 1. damage pairs with fixed values (rolled ranges stay separate minimum/maximum lines, as on the docs pages)
  const fixed = (stat: string) => rest.find((entry) => entry.text === undefined && entry.stat === stat && entry.min === entry.max);
  for (const pair of DAMAGE_PAIRS) {
    for (;;) {
      const min = fixed(pair.min);
      const max = fixed(pair.max);
      if (min === undefined || max === undefined) break;
      rest.splice(rest.indexOf(min), 1);
      rest.splice(rest.indexOf(max), 1);
      const lengthEntry = pair.length === undefined ? undefined : take(pair.length);
      const length = lengthEntry === undefined ? null : lengthEntry.max;
      out.push({ priority: priorityOf(pair.max, ctx), lines: [damageLine(pair, min.min, max.min, length, ctx)] });
    }
  }
  if (has('item_maxdamage_percent') && has('item_mindamage_percent')) {
    const max = rest.find((entry) => entry.text === undefined && entry.stat === 'item_maxdamage_percent');
    const min = rest.find((entry) => entry.text === undefined && entry.stat === 'item_mindamage_percent');
    if (max !== undefined && min !== undefined && sameRange(rangeOf(max), rangeOf(min))) {
      take('item_maxdamage_percent');
      take('item_mindamage_percent');
      const format = ctx.strings.get('strModEnhancedDamage') ?? '%+d%% Enhanced Damage';
      out.push({ priority: priorityOf('item_maxdamage_percent', ctx), lines: [sprintf(format, [single(rangeOf(max))])] });
    }
  }

  // 1b. a class skill (`skill`) and the same skill for every class (`oskill`) read "+N to X (All Classes)" on the
  // ESR docs pages, N being the sum (ESR's "skill-pierce-all-classes" pattern)
  for (const classSkill of rest.filter((entry) => entry.text === undefined && entry.stat === 'item_singleskill')) {
    const other = rest.find(
      (entry) => entry.text === undefined && entry.stat === 'item_nonclassskill_display' && entry.param === classSkill.param
    );
    if (other === undefined) continue;
    rest.splice(rest.indexOf(classSkill), 1);
    rest.splice(rest.indexOf(other), 1);
    const sum = { min: classSkill.min + other.min, max: classSkill.max + other.max };
    const name = ctx.skills.skill(classSkill.param)?.name ?? classSkill.param;
    out.push({ priority: priorityOf('item_nonclassskill_display', ctx), lines: [`${formatSigned(sum)} to ${name} (All Classes)`] });
  }

  // 2. dgrp sets
  const sets = new Map<string, string[]>();
  for (const def of ctx.stats.values()) {
    if (def.dgrp === 0 || def.dgrpfunc !== 19) continue;
    const key = `${String(def.dgrp)}|${def.dgrpstrpos}`;
    sets.set(key, [...(sets.get(key) ?? []), def.stat]);
  }
  for (const members of sets.values()) {
    if (!members.every((stat) => has(stat))) continue;
    const found = members.map((stat) => rest.find((entry) => entry.text === undefined && entry.stat === stat));
    const first = found[0];
    if (first === undefined || !found.every((entry) => entry !== undefined && sameRange(rangeOf(entry), rangeOf(first)))) continue;
    const def = ctx.stats.get(first.stat);
    if (def === undefined) continue;
    for (const stat of members) take(stat);
    const value = statValue(first, def);
    const negative = Math.max(value.min, value.max) < 0;
    const format = ctx.strings.get(negative && def.dgrpstrneg !== '' ? def.dgrpstrneg : def.dgrpstrpos) ?? def.dgrpstrpos;
    out.push({ priority: Math.max(...members.map((stat) => priorityOf(stat, ctx))), lines: [sprintf(format, [single(value)])] });
  }

  // 3. everything else
  for (const entry of rest) {
    if (entry.text !== undefined) {
      out.push({ priority: priorityOf(entry.stat, ctx), lines: [entry.text] });
      continue;
    }
    const def = ctx.stats.get(entry.stat);
    if (def === undefined) continue;
    out.push({ priority: def.descpriority, lines: renderStat(entry, def, ctx) });
  }

  // 4. priority, highest first; Array.prototype.sort is stable
  return out.sort((a, b) => b.priority - a.priority).flatMap((line) => line.lines);
}

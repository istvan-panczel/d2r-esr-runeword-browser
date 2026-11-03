/**
 * The stat filter values of an item (`StatValue`, rules in itemText.ts and docs/features/STASH-ITEMS.md): one entry per
 * key, summed over the given stats, with the displayed value, a param-free label and the group entries (dgrp sets,
 * damage ranges, enhanced damage). Labels depend only on the key, so they are built once per key and data.
 */
import { renderStat } from '@/features/game-data/engine/stats/descfunc';
import { DAMAGE_PAIRS, damageLine, type DamagePair, type RenderContext } from '@/features/game-data/engine/stats/renderLines';
import { sprintf } from '@/features/game-data/engine/stats/sprintf';
import type { StatDef, StatEntry } from '@/features/game-data/engine/stats/types';
import type { StashStat } from '../../parser/types';
import type { StatValue } from './itemText';
import { layerOf, skillLevel, STAT_ID, tabNumber, type TextData } from './textData';

/** Descfuncs whose line names the stat's param: one key per param */
const PARAM_DESCFUNCS = new Set([13, 14, 15, 16, 22, 23, 24, 27, 28]);
/** Event skills and charges: the key names the skill, the value is the skill level (never summed: the highest wins) */
const SKILL_LEVEL_DESCFUNCS = new Set([15, 24]);
const PER_LEVEL_OPS = new Set([2, 4, 5]);

/** A value no stat has: its rendered digits become the `#` of a label */
const SENTINEL = 194425;
/** The second number of a two-number line (event chance, charges) */
const SENTINEL_2 = 194426;

interface Acc {
  key: string;
  statId: number;
  def: StatDef;
  param: number | null;
  raw: number;
}

interface Labels {
  label: string;
  statLabel: string;
  paramLabel: string | null;
}

interface DamageGroup {
  name: string;
  min: number;
  max: number;
  /** renderLines' pair (fire, lightning, cold, poison): its range string and poison totals */
  pair?: DamagePair;
  /** The range string of the other pairs */
  rangeKey?: string;
}

/** Saved min / max damage pairs → `g.dmg-<name>` (value = max, `range`) */
const DAMAGE_GROUPS: readonly DamageGroup[] = [
  { name: 'phys', min: STAT_ID.minDamage, max: STAT_ID.maxDamage, rangeKey: 'strModMinDamageRange' },
  { name: 'magic', min: 52, max: 53, rangeKey: 'strModMagicDamageRange' },
  { name: 'fire', min: 48, max: 49, pair: DAMAGE_PAIRS.find((pair) => pair.min === 'firemindam') },
  { name: 'light', min: 50, max: 51, pair: DAMAGE_PAIRS.find((pair) => pair.min === 'lightmindam') },
  { name: 'cold', min: 54, max: 55, pair: DAMAGE_PAIRS.find((pair) => pair.min === 'coldmindam') },
  { name: 'pois', min: 57, max: 58, pair: DAMAGE_PAIRS.find((pair) => pair.min === 'poisonmindam') },
];

const labelCache = new WeakMap<TextData, Map<string, Labels>>();

/** Raw saved value whose displayed value is `shown` (inverse of `displayed`) */
function rawFor(def: StatDef, shown: number): number {
  if (PER_LEVEL_OPS.has(def.op)) return shown * 2 ** def.opParam;
  if (def.descfunc === 5 || def.descfunc === 10) return (shown * 128) / 100;
  if (def.descfunc === 20 || def.descfunc === 21) return -shown;
  return shown;
}

/** The value the tooltip shows for a raw (summed) saved value */
function displayed(def: StatDef, raw: number): number {
  if (PER_LEVEL_OPS.has(def.op)) return raw / 2 ** def.opParam;
  if (def.descfunc === 5 || def.descfunc === 10) return Math.floor((raw * 100) / 128);
  if (def.descfunc === 20 || def.descfunc === 21) return -raw;
  return raw;
}

function masked(text: string): string {
  return text
    .replace(new RegExp(`([+-]?)${String(SENTINEL)}`, 'g'), '$1#')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The line of `def` with the sentinel as its value, `param` as the entry param. A per-level stat's label leaves out
 * its descstr2 ("(Based on Character Level)"): `perLevel` says it, and the page writes it.
 */
function sentinelLine(full: StatDef, param: string, ctx: RenderContext): string {
  const def = PER_LEVEL_OPS.has(full.op) ? { ...full, descstr2: '' } : full;
  if (def.descfunc === 24) {
    const name = ctx.skills.skill(param)?.name ?? param;
    const format = ctx.strings.get(def.descstrpos) ?? 'Level %d %s (%d/%d Charges)';
    return masked(sprintf(format, [SENTINEL, name, SENTINEL_2, SENTINEL_2]).replace(`${String(SENTINEL_2)}/${String(SENTINEL_2)} `, ''));
  }
  const entry: StatEntry =
    def.descfunc === 15
      ? { stat: def.stat, param, min: SENTINEL_2, max: SENTINEL }
      : { stat: def.stat, param, min: rawFor(def, SENTINEL), max: rawFor(def, SENTINEL) };
  const line = renderStat(entry, def, ctx).join(' ');
  if (def.descfunc !== 15) return masked(line);
  return capitalized(masked(line.replace(new RegExp(`${String(SENTINEL_2)}%?\\s*`), '')));
}

function tabName(data: TextData, param: number): string | null {
  const format = data.bundle.classes.at(param >> 3)?.tabs[param & 7];
  if (format === undefined) return null;
  return (
    format
      .replace(/%\+?d/, '')
      .replace(/^\s*to\s+/i, '')
      .trim() || null
  );
}

function paramLabelOf(def: StatDef, param: number, data: TextData): string | null {
  switch (def.descfunc) {
    case 13:
      return data.bundle.classes.at(param)?.name ?? null;
    case 14:
      return tabName(data, param);
    case 22:
      return data.bundle.monTypes.at(param) ?? null;
    case 23:
      return data.bundle.monsters.at(param) ?? null;
    default:
      return data.render.skills.skill(String(param))?.name ?? null;
  }
}

/** The renderer param of a key param (the packed tab becomes the properties.txt tab number) */
function entryParam(def: StatDef, param: number | null): string {
  if (param === null) return '';
  return def.descfunc === 14 ? String(tabNumber(param)) : String(param);
}

/** Placeholder param of the param-free label: the renderer looks skills up in the placeholder context */
function placeholderParam(def: StatDef): string {
  if (def.descfunc === 22) return '[Monster Type]';
  if (def.descfunc === 23) return '[Monster]';
  return def.descfunc === 14 ? '0' : '1';
}

function cacheOf(data: TextData): Map<string, Labels> {
  let cache = labelCache.get(data);
  if (cache === undefined) labelCache.set(data, (cache = new Map<string, Labels>()));
  return cache;
}

function labelsOf(acc: Acc, data: TextData): Labels {
  const cache = cacheOf(data);
  const cached = cache.get(acc.key);
  if (cached !== undefined) return cached;
  const label = sentinelLine(acc.def, entryParam(acc.def, acc.param), data.render);
  const labels: Labels =
    acc.param === null
      ? { label, statLabel: label, paramLabel: null }
      : {
          label,
          statLabel: sentinelLine(acc.def, placeholderParam(acc.def), data.placeholder),
          paramLabel: paramLabelOf(acc.def, acc.param, data),
        };
  cache.set(acc.key, labels);
  return labels;
}

function groupLabel(key: string, data: TextData, build: () => string): string {
  const cache = cacheOf(data);
  const cached = cache.get(key);
  if (cached !== undefined) return cached.label;
  const label = build();
  cache.set(key, { label, statLabel: label, paramLabel: null });
  return label;
}

function damageLabel(group: DamageGroup, data: TextData): string {
  return groupLabel(`g.dmg-${group.name}`, data, () => {
    if (group.pair !== undefined) {
      // no duration: the range label has the two `#` of min and max only
      const line = damageLine(group.pair, SENTINEL, SENTINEL_2, group.pair.perFrame === true ? 256 : null, data.render);
      return line
        .replace(/\s+over\s+[\d.]+\s+seconds?/i, '')
        .replace(/\d+(\.\d+)?/g, '#')
        .trim();
    }
    const format = data.render.strings.get(group.rangeKey ?? '') ?? 'Adds %d-%d Damage';
    return sprintf(format, [SENTINEL, SENTINEL_2]).replace(/\d+/g, '#');
  });
}

/** Poison min / max shown as totals over their length, like the tooltip */
function poisonTotal(statId: number, raw: number, accs: ReadonlyMap<string, Acc>, data: TextData): number {
  const def = data.defs[statId];
  const pair = DAMAGE_PAIRS.find((entry) => entry.perFrame === true && (entry.min === def?.stat || entry.max === def?.stat));
  if (pair?.length === undefined) return raw;
  const lengthId = data.ids.get(pair.length);
  const length = lengthId === undefined ? undefined : accs.get(`s${String(lengthId)}`)?.raw;
  return length === undefined ? raw : Math.round((raw * length) / 256);
}

/** The stat values of a list of saved stats (an item's own + runeword + socketed jewel stats). */
export function itemStatValues(stats: readonly StashStat[], data: TextData): StatValue[] {
  const accs = new Map<string, Acc>();
  // lengths (coldlength, poisonlength) are hidden, but poison totals need them
  const lengths = new Map<string, Acc>();
  for (const stat of stats) {
    const def = data.defs[stat.id];
    if (def === undefined) continue;
    if (def.descfunc === 0) {
      if (def.stat.endsWith('length')) {
        const key = `s${String(stat.id)}`;
        const acc = lengths.get(key);
        if (acc === undefined) lengths.set(key, { key, statId: stat.id, def, param: null, raw: stat.value });
        else acc.raw += stat.value;
      }
      continue;
    }
    // a text-only line (ESR's mythical descriptions): no value to filter on
    if (def.descfunc === 23 && def.descval === 0) continue;
    const named = PARAM_DESCFUNCS.has(def.descfunc);
    const level = SKILL_LEVEL_DESCFUNCS.has(def.descfunc) ? skillLevel(stat.param) : null;
    const param = level !== null ? level.skill : named ? layerOf(stat.param) : null;
    const raw = level !== null ? level.level : stat.value;
    const key = param === null ? `s${String(stat.id)}` : `s${String(stat.id)}.${String(param)}`;
    const acc = accs.get(key);
    if (acc === undefined) accs.set(key, { key, statId: stat.id, def, param, raw });
    else acc.raw = level !== null ? Math.max(acc.raw, raw) : acc.raw + raw;
  }

  const values = new Map<string, StatValue>();
  const shown = (acc: Acc) => poisonTotal(acc.statId, displayed(acc.def, acc.raw), lengths, data);
  for (const acc of accs.values()) {
    const labels = labelsOf(acc, data);
    values.set(acc.key, {
      key: acc.key,
      statKey: acc.param === null ? acc.key : `s${String(acc.statId)}`,
      statId: acc.statId,
      param: acc.param,
      ...labels,
      value: shown(acc),
      ...(PER_LEVEL_OPS.has(acc.def.op) ? { perLevel: true as const } : {}),
    });
  }

  const group = (key: string, label: string, value: number, range?: { min: number; max: number }) => {
    values.set(key, {
      key,
      statKey: key,
      statId: null,
      param: null,
      label,
      statLabel: label,
      paramLabel: null,
      value,
      ...(range === undefined ? {} : { range }),
    });
  };
  const single = (id: number) => values.get(`s${String(id)}`);

  for (const set of data.dgrpSets) {
    // ESR's magic damage dgrp (strModMagicDamage) is the magic min / max pair: g.dmg-magic covers it
    if (DAMAGE_GROUPS.some((damage) => set.members.length === 2 && set.members.includes(damage.min) && set.members.includes(damage.max)))
      continue;
    const members = set.members.flatMap((id) => {
      const member = single(id);
      return member === undefined ? [] : [member];
    });
    if (members.length < set.members.length) continue;
    const key = `g.${set.name}`;
    const label = groupLabel(key, data, () => {
      const format = data.render.strings.get(set.def.dgrpstrpos) ?? set.def.dgrpstrpos;
      return masked(sprintf(format, [SENTINEL]));
    });
    group(key, label, Math.min(...members.map((member) => member.value)));
  }

  for (const damage of DAMAGE_GROUPS) {
    const min = single(damage.min);
    const max = single(damage.max);
    if (min === undefined || max === undefined) continue;
    group(`g.dmg-${damage.name}`, damageLabel(damage, data), max.value, { min: min.value, max: max.value });
  }

  const maxEd = single(STAT_ID.maxDamagePercent);
  const minEd = single(STAT_ID.minDamagePercent);
  if (maxEd !== undefined && minEd !== undefined) {
    const label = groupLabel('g.ed', data, () =>
      masked(sprintf(data.render.strings.get('strModEnhancedDamage') ?? '%+d%% Enhanced Damage', [SENTINEL]))
    );
    group('g.ed', label, Math.min(maxEd.value, minEd.value));
  }

  return [...values.values()];
}

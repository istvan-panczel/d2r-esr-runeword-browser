/**
 * Renders one stat entry with its itemstatcost `descfunc`. S1 = descstrpos (descstrneg for negative values),
 * S2 = descstr2, V = value; `descval` places V for bare labels: 0 none, 1 before S1, 2 after S1. Strings with printf
 * tokens are formatted with `sprintf` instead (ESR uses printf strings almost everywhere).
 *
 *  1 +V S1     2 V% S1     3 V S1     4 +V% S1     5 V×100/128% S1     6–10 like 1–5 followed by S2
 *  11 repair durability    12 +V S1 (V omitted when 1)    13 +V to [class] Skill Levels
 *  14 +V to [tab] Skills ([class] Only)    15 chance, level, skill    16 Level L [skill] Aura When Equipped
 *  19 sprintf(S1, V)    20 -V% S1    21 -V S1    22 V% S1 [montype]    23 sprintf(S1, V, [monster])
 *  24 Level L [skill] (C/C Charges)    27 +V to [skill] ([class] Only)    28 +V to [skill]
 *
 * Per-level stats (`op` 2/4/5) show V = value / 2^`op param` (e.g. 5/8 = 0.625) followed by S2
 * "(Based on Character Level)", as on the ESR docs pages. Strings with `\n` are drawn bottom-up by the game, so
 * their lines are reversed. A result of [] means the stat is not displayed (descfunc 0).
 */
import { formatSigned, formatValue, hasFormat, sprintf, type Range, type SprintfArg } from './sprintf.ts';
import type { SkillLookup, StatDef, StatEntry } from './types.ts';

export interface DescContext {
  strings: ReadonlyMap<string, string>;
  skills: SkillLookup;
  /** monstats NameStr string keys by row */
  monsterNames: readonly string[];
  /** montype strplur string keys by row */
  monTypeNames: readonly string[];
}

const PER_LEVEL_OPS = new Set([2, 4, 5]);

export function statValue(entry: Pick<StatEntry, 'min' | 'max'>, def: Pick<StatDef, 'op' | 'opParam'>): Range {
  const divisor = PER_LEVEL_OPS.has(def.op) ? 2 ** def.opParam : 1;
  return { min: entry.min / divisor, max: entry.max / divisor };
}

function text(ctx: DescContext, key: string): string {
  return key === '' ? '' : (ctx.strings.get(key) ?? key);
}

/** Bare label layout by descval; printf strings are formatted instead. */
function layout(format: string, valueText: string, descval: number, args: readonly SprintfArg[]): string {
  if (hasFormat(format)) return sprintf(format, args);
  if (descval === 1) return `${valueText} ${format}`;
  if (descval === 2) return `${format} ${valueText}`;
  return format;
}

function scaled(value: Range, factor: number): Range {
  return { min: Math.floor(value.min * factor), max: Math.floor(value.max * factor) };
}

function negated(value: Range): Range {
  return { min: -value.max, max: -value.min };
}

/** Row of a table by numeric id param; undefined for non-numeric params. */
function byId(rows: readonly string[], param: string): string | undefined {
  return /^\d+$/.test(param) ? rows.at(Number(param)) : undefined;
}

function skillName(ctx: DescContext, param: string): string {
  return ctx.skills.skill(param)?.name ?? param;
}

function classOnly(ctx: DescContext, param: string): string {
  const cls = ctx.skills.skill(param)?.cls ?? null;
  return cls === null ? '' : (ctx.skills.classText(cls)?.only ?? '');
}

function lines(rendered: string): string[] {
  return rendered
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .reverse();
}

function withS2(line: string, s2: string): string {
  return s2 === '' ? line : `${line} ${s2}`;
}

/**
 * The descfuncs renderStat knows: 0 (hidden) and the cases of its switch. Any other descfunc falls through to the
 * `default` branch (a plain signed number) without a warning; runtimeConstants.test.ts checks that itemtext.json uses
 * only these. Keep in sync with the switch.
 */
export const HANDLED_DESCFUNCS: ReadonlySet<number> = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 27, 28,
]);

export function renderStat(entry: StatEntry, def: StatDef, ctx: DescContext): string[] {
  if (def.descfunc === 0) return [];
  const value = statValue(entry, def);
  const negative = Math.max(value.min, value.max) < 0;
  const s1 = text(ctx, negative && def.descstrneg !== '' ? def.descstrneg : def.descstrpos);
  const s2 = text(ctx, def.descstr2);
  const dv = def.descval;

  switch (def.descfunc) {
    case 1:
    case 6:
    case 12:
      if (def.descfunc === 12 && value.max <= 1 && !hasFormat(s1)) return lines(withS2(s1, s2));
      return lines(withS2(layout(s1, formatSigned(value), dv, [value]), s2));
    case 2:
    case 7:
      return lines(withS2(layout(s1, `${formatValue(value)}%`, dv, [value]), s2));
    case 3:
    case 9:
      return lines(withS2(layout(s1, formatValue(value), dv, [value]), s2));
    case 4:
    case 8:
      return lines(withS2(layout(s1, `${formatSigned(value)}%`, dv, [value]), s2));
    case 5:
    case 10: {
      const percent = scaled(value, 100 / 128);
      return lines(withS2(layout(s1, `${formatValue(percent)}%`, dv, [percent]), s2));
    }
    case 11:
      return lines(sprintf(s1, [value, Math.round(100 / Math.max(1, value.max))]));
    case 13: {
      const cls = ctx.skills.classText(Number(entry.param));
      const format = cls?.allSkills ?? s1;
      return lines(layout(format, formatSigned(value), 1, [value]));
    }
    case 14: {
      const tab = Number(entry.param);
      const cls = ctx.skills.classText(Math.floor(tab / 3));
      const format = cls?.tabs[tab % 3] ?? s1;
      return lines(`${layout(format, formatSigned(value), 1, [value])} ${cls?.only ?? ''}`);
    }
    case 15:
      return lines(sprintf(s1, [entry.min, entry.max, skillName(ctx, entry.param)]));
    case 16:
      return lines(sprintf(s1, [value, skillName(ctx, entry.param)]));
    case 19:
      return lines(withS2(sprintf(s1, [value]), s2));
    case 20:
      return lines(withS2(layout(s1, `${formatValue(negated(value))}%`, dv, [negated(value)]), s2));
    case 21:
      return lines(withS2(layout(s1, formatValue(negated(value)), dv, [negated(value)]), s2));
    case 22: {
      const monType = text(ctx, byId(ctx.monTypeNames, entry.param) ?? entry.param);
      return lines(`${layout(s1, `${formatValue(value)}%`, dv, [value])} ${monType}`);
    }
    case 23: {
      // ESR's mythical descriptions use descval 0 and the format ".%1%0" (monstats NameStr as a text holder); the
      // docs pages show neither the value nor the leading dot
      const monster = text(ctx, byId(ctx.monsterNames, entry.param) ?? entry.param);
      const rendered = sprintf(s1, [dv === 0 ? '' : value, monster]);
      return lines(dv === 0 ? rendered.replace(/^\./, '') : rendered);
    }
    case 24:
      return lines(sprintf(s1, [entry.max, skillName(ctx, entry.param), entry.min, entry.min]));
    case 27:
      return lines(sprintf(s1, [value, skillName(ctx, entry.param), classOnly(ctx, entry.param)]));
    case 28:
      return lines(sprintf(s1, [value, skillName(ctx, entry.param)]));
    default:
      return lines(withS2(layout(s1, formatSigned(value), dv, [value]), s2));
  }
}

/**
 * Skill tooltip lines at a skill level: the skilldesc line functions ESR uses, applied to the evaluated formulas.
 *
 * | type | shown as                                                                           |
 * | ---- | ---------------------------------------------------------------------------------- |
 * | 74   | printf(a, calca)                                                                   |
 * | 75   | printf(a, calca, calcb)                                                            |
 * | 76   | printf(a, b, calca) (synergy lines "%s: %+d%% Fire Damage per Level")             |
 * | 77   | printf(a, b, calca, calcb)                                                         |
 * | 79   | printf(a, b, calca / calcb) with one decimal                                      |
 * | 36   | v = calca / calcb (calcb blank = 1) with one decimal; a when v is 1 (or no b), else b |
 * | 40   | printf(a, b), calca = colour (the "Receives Bonuses From" header)                  |
 * | 18   | a                                                                                  |
 * | 78   | printf(a, b)                                                                       |
 * | 25   | a + b                                                                              |
 * | 3    | a + calca + b;  4: a + "+" calca;  5: a + calca;  6: "+" calca + a (no b)          |
 * | 63   | "a: +calca% b";  67: "a: +calca b" (old synergy lines)                             |
 *
 * Types 3-6 and 63 follow the Phrozen Keep SkillDesc.txt File Guide (`3 '%s%d%s',desctexta,desccalca,desctextb`,
 * `4 '%s+%d',desctexta,desccalca`, `5 '%s%d',desctexta,desccalca`, `6 '+%d%s',desccalca,desctexta`); types 4 and 6 print
 * no textb (ESR Vigor of the Ancients: textb " percent" is not shown). The guide's 67 (`'%s+%d%s'`) would glue
 * "Lycanthropy+1Second per Level" together, so 67 keeps the 63 layout without "%".
 *
 * 13 (summon life from monstats), 31 (difficulty divisor), 34 (summon damage) and 56 (item quantity) need the engine and
 * are never shown. Multi-line strings are read bottom-up (`bottomUp`), as in skilldetails.json.
 *
 * Tooltip order (`tooltipOrder`): the game adds the desc and dsc2 lines from bottom to top (descline1 is the lowest
 * line of its block: usually Mana Cost) and the dsc3 lines from top to bottom (Phrozen Keep SkillDesc.txt File Guide:
 * "desc and dsc2 add their lines to the description from bottom to top while dsc3 goes from top to bottom"); the
 * blocks are drawn dsc2 (pinned lines), desc (the level block), dsc3 (synergies).
 */
import type { SkillCalcLine, SkillCalcSkill } from '../schema.ts';
import { CalcRun, type CalcReads, type SkillCalcContext, type SkillCalcSource } from './evaluate.ts';
import { bottomUp, markNumber, printfMarked, splitMarked } from './text.ts';

export type SkillLineBlock = 'level' | 'fixed' | 'synergy';

/** The line functions the calculator formats */
export const LINE_TYPES: ReadonlySet<number> = new Set([74, 75, 76, 77, 79, 36, 40, 18, 78, 25, 3, 4, 5, 6, 63, 67]);
/** Line functions computed by the engine from other tables: never shown */
export const ENGINE_LINE_TYPES: ReadonlySet<number> = new Set([13, 31, 34, 56]);
/** Line functions that only print texts (no number) */
export const TEXT_LINE_TYPES: ReadonlySet<number> = new Set([40, 18, 78, 25]);

export function lineBlock(key: string): SkillLineBlock {
  if (key.startsWith('dsc2')) return 'fixed';
  if (key.startsWith('dsc3')) return 'synergy';
  return 'level';
}

export interface SkillLineResult {
  /** SkillCalcLine.key: stable across levels */
  key: string;
  block: SkillLineBlock;
  type: number;
  /** The line in reading order (multi-line strings joined with "\n"); '' when unavailable */
  text: string;
  /** The numbers shown in the text, in reading order (one decimal for types 36 / 79) */
  values: number[];
  /** Text before the first number, the numbers with what is between them ("10-20"), text after the last number */
  before: string;
  span: string;
  after: string;
  /** Type 40 header colour code (2 = green, …) */
  color?: number;
  /** This input reaches a formula the calculator cannot evaluate: show no value */
  unavailable?: true;
  /** The line scales with the character level / with the skill's own hard points (bundle flags) */
  readsCharLevel: boolean;
  readsHardPoints: boolean;
}

/** One decimal at most, trailing zeros dropped (14.5, 5.3, 4) */
export function oneDecimal(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** calca / calcb as a decimal (calcb blank = 1, calcb 0 = 0) */
function ratio(a: number, b: number | undefined): number {
  if (b === undefined) return a;
  return b === 0 ? 0 : oneDecimal(a / b);
}

/** printf "+%d": a literal plus, so a negative value shows as "+-5" like in game */
function plusNumber(value: number): string {
  return value < 0 ? `+${markNumber(value, false)}` : markNumber(value, true);
}

/** The marked (unordered) text of a line; null for a type the calculator does not format */
function formatLine(line: SkillCalcLine, source: SkillCalcSource, va: number | undefined, vb: number | undefined): string | null {
  const a = line.a === undefined ? '' : (source.text(line.a) ?? '');
  const b = line.b === undefined ? '' : (source.text(line.b) ?? '');
  const x = va ?? 0;
  const y = vb ?? 0;
  switch (line.type) {
    case 74:
      return printfMarked(a, [x]);
    case 75:
      return printfMarked(a, [x, y]);
    case 76:
      return printfMarked(a, [b, x]);
    case 77:
      return printfMarked(a, [b, x, y]);
    case 79:
      return printfMarked(a, [b, ratio(x, vb)]);
    case 36: {
      const value = ratio(x, vb);
      return printfMarked(value === 1 || b === '' ? a : b, [value]);
    }
    case 40:
    case 78:
      return printfMarked(a, [b]);
    case 18:
      return a.replace(/%%/g, '%');
    case 25:
      return a + b;
    case 3:
      return `${a}${markNumber(x, false)}${b}`;
    case 4:
      return `${a}${plusNumber(x)}`;
    case 5:
      return `${a}${markNumber(x, false)}`;
    case 6:
      return `${plusNumber(x)}${a}`;
    case 63:
      return `${a}: ${markNumber(x, true)}% ${b}`;
    case 67:
      return `${a}: ${markNumber(x, true)} ${b}`;
    default:
      return null;
  }
}

export interface EvaluatedLine {
  result: SkillLineResult;
  /** What the line's formulas read */
  reads: CalcReads;
  /** calca / calcb values (undefined when the cell is blank) */
  raw: [number | undefined, number | undefined];
}

/** Evaluates one line with a run (shared by the lines of a skill at one context) */
export function evaluateLine(line: SkillCalcLine, run: CalcRun): EvaluatedLine {
  run.resetReads();
  const va = line.ca === undefined ? undefined : run.formula(line.ca);
  const vb = line.cb === undefined ? undefined : run.formula(line.cb);
  const reads: CalcReads = {
    ...run.reads,
    stats: new Set(run.reads.stats),
    skills: new Set(run.reads.skills),
    unsupported: new Set(run.reads.unsupported),
  };
  const base = {
    key: line.key,
    block: lineBlock(line.key),
    type: line.type,
    readsCharLevel: line.ulvl === true,
    readsHardPoints: line.blvl === true,
  };
  const marked = reads.unsupported.size > 0 || reads.random ? null : formatLine(line, run.source, va, vb);
  if (marked === null) {
    return {
      result: { ...base, text: '', values: [], before: '', span: '', after: '', unavailable: true },
      reads,
      raw: [va, vb],
    };
  }
  const parts = splitMarked(bottomUp(marked));
  const result: SkillLineResult = { ...base, ...parts };
  if (line.type === 40 && va !== undefined) result.color = va;
  return { result, reads, raw: [va, vb] };
}

/**
 * Lines (in skilldesc file order) in the order the tooltip shows them, top to bottom: the dsc2 block bottom-up (last
 * dsc2line first), the desc block bottom-up (descline1 last), then the dsc3 block top-down.
 */
export function tooltipOrder<T extends { key: string }>(lines: readonly T[]): T[] {
  const block = (name: SkillLineBlock) => lines.filter((line) => lineBlock(line.key) === name);
  return [...block('fixed').reverse(), ...block('level').reverse(), ...block('synergy')];
}

/** The lines of a skill for one character state, in tooltip order (top to bottom, see `tooltipOrder`) */
export function evaluateSkill(skill: SkillCalcSkill, source: SkillCalcSource, ctx: SkillCalcContext): SkillLineResult[] {
  const run = new CalcRun(source, skill.id, ctx);
  return tooltipOrder(skill.lines).map((line) => evaluateLine(line, run).result);
}

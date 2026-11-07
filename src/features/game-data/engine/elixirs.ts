/**
 * The elixir formulas (misc.txt `len` and `calc1` … `calc6` of the utility potions), evaluated like the game does: the
 * calc language on whole numbers, left to right, each division truncated (`(25+stat('level'.accr)/3*2)` at level 10 is
 * 25 + 3 × 2). Shared by the generator (elixirs.json values at level 1 and the top level) and the Elixirs page.
 */
import { calcBinary } from './skillCalc/evaluate.ts';
import { parseCalc, type CalcNode } from './skillCalc/parse.ts';

/** Game frames per second: misc.txt `len` is in frames (1125 = 45 seconds) */
export const FRAMES_PER_SECOND = 25;

/** The character stats a formula reads (`stat('x'.accr)`), by itemstatcost name; a missing stat is 0 */
export type ElixirStats = Readonly<Partial<Record<string, number>>>;

/** The itemstatcost names the elixir formulas read besides the perk stats */
export const ELIXIR_STATS = {
  level: 'level',
  effectiveness: 'utilitypotionmultiplier',
  duration: 'utilitypotionduration',
} as const;

const i32 = (value: number) => value | 0;

/** One node; null when the formula reads something other than stats and numbers (a skill, a missile, a code) */
function evaluateNode(node: CalcNode, stats: ElixirStats): number | null {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'neg': {
      const value = evaluateNode(node.arg, stats);
      return value === null ? null : i32(-value);
    }
    case 'bin': {
      const left = evaluateNode(node.left, stats);
      const right = evaluateNode(node.right, stats);
      return left === null || right === null ? null : calcBinary(node.op, left, right);
    }
    case 'ternary': {
      const cond = evaluateNode(node.cond, stats);
      if (cond === null) return null;
      return evaluateNode(cond !== 0 ? node.then : node.else, stats);
    }
    case 'call': {
      if ((node.name === 'min' || node.name === 'max') && node.args.length === 2) {
        const [first, second] = node.args.map((arg) => evaluateNode(arg, stats));
        if (first === null || second === null) return null;
        return node.name === 'min' ? Math.min(first, second) : Math.max(first, second);
      }
      const link = node.name === 'stat' && node.args.length === 1 && node.args[0]?.kind === 'link' ? node.args[0].link : null;
      if (link === null || link.fields.length !== 1 || (link.fields[0] !== 'accr' && link.fields[0] !== 'base')) return null;
      return stats[link.name] ?? 0;
    }
    case 'code':
    case 'link':
    case 'error':
      return null;
  }
}

/** The value of a formula for the given stats; null when it reads anything but stats and numbers */
export function evaluateElixirCalc(text: string, stats: ElixirStats): number | null {
  return evaluateNode(parseCalc(text), stats);
}

/** The stat names a formula reads, in order of first use */
export function calcStatNames(text: string): string[] {
  const names = new Set<string>();
  const walk = (node: CalcNode): void => {
    switch (node.kind) {
      case 'neg':
        walk(node.arg);
        return;
      case 'bin':
        walk(node.left);
        walk(node.right);
        return;
      case 'ternary':
        walk(node.cond);
        walk(node.then);
        walk(node.else);
        return;
      case 'call':
        if (node.name === 'stat' && node.args[0]?.kind === 'link') names.add(node.args[0].link.name);
        else node.args.forEach(walk);
        return;
      default:
        return;
    }
  };
  walk(parseCalc(text));
  return [...names];
}

/** Seconds of a `len` value in frames, to one decimal (1237 frames → 49.5) */
export function framesToSeconds(frames: number): number {
  return Math.round((frames / FRAMES_PER_SECOND) * 10) / 10;
}

/** A rendered effect line with its value: `{v}` → the number */
export function fillValue(line: string, value: number): string {
  return line.replaceAll('{v}', String(value));
}

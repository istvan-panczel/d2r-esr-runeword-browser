/**
 * Geometry of the Combat tab's curve chart: hit chance (y, 0–100 %) over attack rating / defense (x, log scale). Pure;
 * HitCurveChart only draws what this returns.
 */
import { curveChance, hitCurve, type Facts } from '@/features/modifiers/utils/modifierMath';

export const CHART = { width: 360, height: 210, left: 34, right: 12, top: 12, bottom: 30 } as const;
/** The x range: below 0.5 the curve is 0 %, above 200 it is 100 % */
export const RATIO_MIN = 0.5;
export const RATIO_MAX = 200;
export const RATIO_TICKS: readonly number[] = [1, 2, 5, 10, 20, 50, 100];
export const CHANCE_TICKS: readonly number[] = [0, 25, 50, 75, 100];

const plotWidth = CHART.width - CHART.left - CHART.right;
const plotHeight = CHART.height - CHART.top - CHART.bottom;

export function xOfRatio(ratio: number): number {
  const clamped = Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio));
  return CHART.left + (Math.log(clamped / RATIO_MIN) / Math.log(RATIO_MAX / RATIO_MIN)) * plotWidth;
}

export function ratioOfX(x: number): number {
  const share = Math.min(1, Math.max(0, (x - CHART.left) / plotWidth));
  return RATIO_MIN * (RATIO_MAX / RATIO_MIN) ** share;
}

export function yOfChance(chance: number): number {
  return CHART.top + (1 - Math.min(100, Math.max(0, chance)) / 100) * plotHeight;
}

/** The chance the curve gives a ratio (the curve and its limits, as the hit roll uses them) */
export function chanceAtRatio(ratio: number, facts: Facts): number {
  const curve = hitCurve(facts);
  return Math.min(curve.maxChance, Math.max(curve.minChance, curveChance(ratio, curve)));
}

/** SVG path of the curve, sampled every 2 px (whole percents, so it steps where the game's chance steps) */
export function curvePath(facts: Facts): string {
  const points: string[] = [];
  for (let x = CHART.left; x <= CHART.width - CHART.right; x += 2) {
    const y = yOfChance(chanceAtRatio(ratioOfX(x), facts));
    points.push(`${points.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

/** A ratio as the chart labels it: "0.42×", "8.5×", "37×", "≥ 200×" */
export function formatRatio(ratio: number): string {
  if (ratio >= RATIO_MAX) return `≥ ${String(RATIO_MAX)}×`;
  if (ratio < 1) return `${ratio.toFixed(2)}×`;
  if (ratio < 10) return `${ratio.toFixed(1)}×`;
  return `${String(Math.round(ratio))}×`;
}

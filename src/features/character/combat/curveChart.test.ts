import { describe, expect, it } from 'vitest';
import type { ModifierFact } from '@/features/game-data/engine/schema';
import { CHART, chanceAtRatio, curvePath, formatRatio, ratioOfX, RATIO_MAX, RATIO_MIN, xOfRatio, yOfChance } from './curveChart';

// ESR 3.3 attack-rating.toml
const facts: ModifierFact[] = [
  {
    key: 'attackRating.curve',
    label: 'curve',
    value: {
      enabled: 1,
      pivotRatio: 5,
      steepness: 5,
      tail: 3,
      lateTail: 1,
      blendStart: 30,
      blendEnd: 100,
      snapTo100At: 99.5,
      minChance: 0,
      maxChance: 100,
      levelScaling: 0,
    },
    origin: 'esr-config',
    source: { file: 'd2rloader/config/celestialrayone.attack-rating.toml', key: 'curve' },
  },
];

describe('curve chart geometry', () => {
  it('maps the ratio range onto the plot on a log scale, and back', () => {
    expect(xOfRatio(RATIO_MIN)).toBe(CHART.left);
    expect(xOfRatio(RATIO_MAX)).toBeCloseTo(CHART.width - CHART.right);
    expect(xOfRatio(1000)).toBeCloseTo(CHART.width - CHART.right);
    expect(ratioOfX(xOfRatio(8))).toBeCloseTo(8);
    expect(yOfChance(100)).toBe(CHART.top);
    expect(yOfChance(0)).toBe(CHART.height - CHART.bottom);
  });

  it('reads the curve with its limits (the plugin table: 50% at 5×, 75% at 8×, 100% from 104×)', () => {
    expect(chanceAtRatio(5, facts)).toBe(50);
    expect(chanceAtRatio(8, facts)).toBe(75);
    expect(chanceAtRatio(104, facts)).toBe(100);
    expect(curvePath(facts).startsWith(`M${CHART.left.toFixed(1)},`)).toBe(true);
  });

  it('formats ratios for labels', () => {
    expect(formatRatio(0.423)).toBe('0.42×');
    expect(formatRatio(8.47)).toBe('8.5×');
    expect(formatRatio(37.4)).toBe('37×');
    expect(formatRatio(500)).toBe('≥ 200×');
  });
});

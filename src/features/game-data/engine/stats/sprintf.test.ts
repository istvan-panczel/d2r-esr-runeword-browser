import { describe, it, expect } from 'vitest';
import { formatSigned, formatValue, hasFormat, sprintf } from './sprintf.ts';

describe('sprintf', () => {
  it('formats %d, %+d, %i, %s and %%', () => {
    expect(sprintf('%+d to Strength', [15])).toBe('+15 to Strength');
    expect(sprintf('%+d to Strength', [-5])).toBe('-5 to Strength');
    expect(sprintf('%d%% Chance to Cast Level %d %s on Striking', [10, 5, 'Nova'])).toBe('10% Chance to Cast Level 5 Nova on Striking');
    expect(sprintf('Socketed (%i)', [4])).toBe('Socketed (4)');
    expect(sprintf('Fire Resist %+d%%', [30])).toBe('Fire Resist +30%');
  });

  it('formats positional %0..%9', () => {
    expect(sprintf('%0%% Reanimate as: %1', [25, 'Zombie'])).toBe('25% Reanimate as: Zombie');
    expect(sprintf('%1 before %0', ['a', 'b'])).toBe('b before a');
  });

  it('formats ranges like the docs: +(10 to 20), (10 to 20)%, -(10 to 20)', () => {
    expect(sprintf('%+d to Life', [{ min: 10, max: 20 }])).toBe('+(10 to 20) to Life');
    expect(sprintf('%d%% Target Defense', [{ min: 10, max: 20 }])).toBe('(10 to 20)% Target Defense');
    expect(sprintf('%+d to Life', [{ min: -20, max: -10 }])).toBe('-(10 to 20) to Life');
    expect(sprintf('%d to Life', [{ min: -20, max: -10 }])).toBe('-(10 to 20) to Life');
    expect(sprintf('%+d to Life', [{ min: 7, max: 7 }])).toBe('+7 to Life');
  });

  it('keeps per-level fractions and drops float noise', () => {
    expect(formatSigned(0.625)).toBe('+0.625');
    expect(formatValue(0.1 + 0.2)).toBe('0.3');
  });

  it('leaves missing arguments empty and tells printf strings from bare labels', () => {
    expect(sprintf('%d and %d', [1])).toBe('1 and ');
    expect(hasFormat('to Fire Skills')).toBe(false);
    expect(hasFormat('100%% sure')).toBe(false);
    expect(hasFormat('%+d to Strength')).toBe(true);
    expect(hasFormat('.%1%0')).toBe(true);
  });
});

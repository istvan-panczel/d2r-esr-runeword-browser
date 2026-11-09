import { describe, expect, it } from 'vitest';
import { centeredScrollLeft } from './centeredScrollLeft';

describe('centeredScrollLeft', () => {
  const strip = { viewportWidth: 300, contentWidth: 900, itemWidth: 100 };

  it('centres an item in the middle of the strip', () => {
    expect(centeredScrollLeft({ ...strip, itemLeft: 400 })).toBe(300);
  });

  it('never scrolls before the start', () => {
    expect(centeredScrollLeft({ ...strip, itemLeft: 20 })).toBe(0);
  });

  it('never scrolls past the end', () => {
    expect(centeredScrollLeft({ ...strip, itemLeft: 800 })).toBe(600);
  });

  it('does not scroll a strip that fits', () => {
    expect(centeredScrollLeft({ viewportWidth: 900, contentWidth: 500, itemLeft: 400, itemWidth: 100 })).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { spriteDrawSize, spriteFitSize } from './spriteSize';

const square = { width: 128, height: 128 };
const wide = { width: 200, height: 100 };

describe('spriteDrawSize', () => {
  it('draws the longer side at iconSize, keeping the proportions', () => {
    expect(spriteDrawSize(square, 40)).toEqual({ width: 40, height: 40 });
    expect(spriteDrawSize(wide, 50)).toEqual({ width: 50, height: 25 });
  });

  it("uses the file's size without iconSize and keeps iconSize within 4 to 256", () => {
    expect(spriteDrawSize(square, undefined)).toEqual(square);
    expect(spriteDrawSize(square, 1)).toEqual({ width: 4, height: 4 });
    expect(spriteDrawSize(square, 999)).toEqual({ width: 256, height: 256 });
    expect(spriteDrawSize({ width: 3, height: 300 }, 4)).toEqual({ width: 1, height: 4 });
  });

  it('caps the longer side at max, smaller icons keep their size', () => {
    expect(spriteDrawSize(square, undefined, 40)).toEqual({ width: 40, height: 40 });
    expect(spriteDrawSize(wide, 120, 40)).toEqual({ width: 40, height: 20 });
    expect(spriteDrawSize(square, 27, 40)).toEqual({ width: 27, height: 27 });
  });
});

describe('spriteFitSize', () => {
  it('fits the longer side into the box', () => {
    expect(spriteFitSize(square, 32)).toEqual({ width: 32, height: 32 });
    expect(spriteFitSize(wide, 64)).toEqual({ width: 64, height: 32 });
  });
});

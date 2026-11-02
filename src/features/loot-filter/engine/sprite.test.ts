import { readFileSync } from 'fs';
import { resolve } from 'path';
import { decodeSprite } from './sprite.ts';

const ICONS = resolve(__dirname, '../../../../public/loot-filters/icons');

function pixel(rgba: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(rgba.subarray(offset, offset + 4));
}

describe('decodeSprite', () => {
  // Sully's icons from github.com/Thisisnotsully/QoL-Filter (512 px squares, the rune 1080 px), shrunk to 128 px: filters
  // draw them at 27-50 minimap pixels, and the raw RGBA files were 1-4.7 MB each.
  it.each(
    ['charm', 'cube', 'gem', 'gem2', 'gemP', 'map', 'Myth', 'redD', 'scroll', 'star', 'rune'].map(
      (name) => [`${name}.sprite`, 128] as const
    )
  )('decodes %s at %i px', (file, size) => {
    const sprite = decodeSprite(new Uint8Array(readFileSync(resolve(ICONS, file))));
    expect(sprite).toMatchObject({ width: size, height: size, frames: 1 });
    expect(sprite.rgba).toHaveLength(size * size * 4);
  });

  it.each([
    ['goldstar.sprite', 128],
    ['goldstar.lowend.sprite', 100],
  ])('decodes %s', (file, size) => {
    const bytes = readFileSync(resolve(ICONS, file));
    const sprite = decodeSprite(new Uint8Array(bytes));
    expect(sprite).toMatchObject({ width: size, height: size, frames: 1 });
    expect(sprite.rgba).toHaveLength(size * size * 4);
    for (const [x, y] of [
      [0, 0],
      [size - 1, 0],
      [0, size - 1],
      [size - 1, size - 1],
    ] as const) {
      expect(pixel(sprite.rgba, size, x, y)[3]).toBe(0);
    }
    const [r = 0, g = 0, b = 0, a = 0] = pixel(sprite.rgba, size, size / 2, size / 2);
    expect(a).toBeGreaterThan(200);
    // A gold star: red and green high, blue low, so the bytes are RGBA (not BGRA).
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(150);
    expect(b).toBeLessThan(150);
  });

  it('accepts an ArrayBuffer', () => {
    const bytes = readFileSync(resolve(ICONS, 'goldstar.lowend.sprite'));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(decodeSprite(buffer).width).toBe(100);
  });

  it('accepts the SPa1 magic spelling used by many HD item sprites', () => {
    const bytes = new Uint8Array(readFileSync(resolve(ICONS, 'goldstar.lowend.sprite')));
    const variant = bytes.slice();
    variant.set([0x53, 0x50, 0x61, 0x31], 0); // "SPa1"
    const sprite = decodeSprite(variant);
    expect(sprite).toMatchObject({ width: 100, height: 100, frames: 1 });
    expect(sprite.rgba).toEqual(decodeSprite(bytes).rgba);
  });

  it('decodes only the declared frame when a file carries extra pixel data', () => {
    const bytes = new Uint8Array(readFileSync(resolve(ICONS, 'goldstar.lowend.sprite')));
    const longer = new Uint8Array(bytes.byteLength + 64);
    longer.set(bytes);
    expect(decodeSprite(longer).rgba).toHaveLength(100 * 100 * 4);
  });

  it('rejects a bad magic, a short header and a truncated frame', () => {
    const bytes = new Uint8Array(readFileSync(resolve(ICONS, 'goldstar.lowend.sprite')));
    const bad = bytes.slice();
    bad[0] = 0x58;
    expect(() => decodeSprite(bad)).toThrow(/SpA1/);
    expect(() => decodeSprite(bytes.slice(0, 20))).toThrow(/header/);
    expect(() => decodeSprite(bytes.slice(0, 1000))).toThrow(/truncated/);
  });
});

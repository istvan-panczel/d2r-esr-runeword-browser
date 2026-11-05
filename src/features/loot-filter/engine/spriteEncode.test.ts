import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { decodeSprite } from './sprite.ts';
import { encodeSprite, SPRITE_HEADER_SIZE } from './spriteEncode.ts';

const ICONS = resolve(__dirname, '../../../../public/loot-filters/icons');
const read = (file: string) => new Uint8Array(readFileSync(resolve(ICONS, file)));

/** The byte offsets where two buffers differ. */
function differences(a: Uint8Array, b: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

/**
 * The loot filter plugin's own check (v1.5.3 disassembly): at least 40 bytes, `SpA1`, version 31, width, height and
 * frame count not 0, width a multiple of the frame count, width ≤ 8192, height ≤ 4096, and the pixels all there.
 */
function pluginAccepts(bytes: Uint8Array): boolean {
  if (bytes.length < 40) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x31417053 || view.getUint16(4, true) !== 31) return false;
  const width = view.getUint32(8, true);
  const height = view.getInt32(12, true);
  const frames = view.getUint32(20, true);
  if (width === 0 || height === 0 || frames === 0 || width % frames !== 0) return false;
  if (width > 0x2000 || height > 0x1000) return false;
  return bytes.length >= 40 + width * height * 4;
}

describe('encodeSprite', () => {
  // Sully's twelve icons as bundled (shrunk to 128 px; his own 512 / 1080 px files have the same header, see LOOT-FILTER.md)
  const sullys = ['charm', 'cube', 'gem', 'gem2', 'gemP', 'goldstar', 'map', 'Myth', 'redD', 'rune', 'scroll', 'star'].map(
    (name) => `${name}.sprite`
  );

  it.each(sullys)('re-encodes the decoded pixels of %s byte for byte', (file) => {
    const bytes = read(file);
    const sprite = decodeSprite(bytes);
    const encoded = encodeSprite(sprite);
    expect(encoded.length).toBe(bytes.length);
    expect(differences(encoded, bytes)).toEqual([]);
  });

  it('re-encodes the mod’s goldstar.lowend.sprite with only the pixel byte count and bytes per pixel added', () => {
    // The mod's file has 0 at 32-39 (like about half of the game's own sprites); the plugin never reads those bytes.
    const bytes = read('goldstar.lowend.sprite');
    const encoded = encodeSprite(decodeSprite(bytes));
    expect(differences(encoded, bytes)).toEqual([32, 33, 36]);
    const view = new DataView(encoded.buffer);
    expect(view.getUint32(32, true)).toBe(100 * 100 * 4);
    expect(view.getUint32(36, true)).toBe(4);
    expect(encoded.subarray(SPRITE_HEADER_SIZE)).toEqual(bytes.subarray(SPRITE_HEADER_SIZE));
  });

  it('writes the header field by field', () => {
    const rgba = new Uint8Array(3 * 2 * 4).map((_, index) => index);
    const bytes = encodeSprite({ width: 3, height: 2, rgba });
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('SpA1');
    expect([view.getUint16(4, true), view.getUint16(6, true)]).toEqual([31, 3]);
    expect([8, 12, 16, 20, 24, 28, 32, 36].map((offset) => view.getUint32(offset, true))).toEqual([3, 2, 0, 1, 0, 0, 24, 4]);
    expect(bytes.subarray(SPRITE_HEADER_SIZE)).toEqual(rgba);
    expect(bytes.length).toBe(40 + 24);
    expect(pluginAccepts(bytes)).toBe(true);
    expect(decodeSprite(bytes)).toMatchObject({ width: 3, height: 2, frames: 1, rgba: new Uint8ClampedArray(rgba) });
  });

  it('accepts a Uint8ClampedArray, and every bundled icon passes the plugin’s check', () => {
    expect(encodeSprite({ width: 1, height: 1, rgba: new Uint8ClampedArray([1, 2, 3, 4]) }).subarray(40)).toEqual(
      new Uint8Array([1, 2, 3, 4])
    );
    for (const file of readdirSync(ICONS).filter((name) => name.endsWith('.sprite'))) expect(pluginAccepts(read(file)), file).toBe(true);
  });

  it('rejects sizes the plugin refuses and pixel data of the wrong length', () => {
    expect(() => encodeSprite({ width: 0, height: 1, rgba: new Uint8Array(0) })).toThrow(/positive/);
    expect(() => encodeSprite({ width: 1.5, height: 1, rgba: new Uint8Array(4) })).toThrow(/whole/);
    expect(() => encodeSprite({ width: 8193, height: 1, rgba: new Uint8Array(8193 * 4) })).toThrow(/8192×4096/);
    expect(() => encodeSprite({ width: 1, height: 4097, rgba: new Uint8Array(4097 * 4) })).toThrow(/8192×4096/);
    expect(() => encodeSprite({ width: 2, height: 2, rgba: new Uint8Array(15) })).toThrow(/needs 16 bytes, got 15/);
  });
});

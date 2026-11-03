import { describe, expect, it } from 'vitest';
import { BitReader, BitReaderEofError } from './bitReader.ts';
import { BitWriter } from './testItems.ts';

describe('BitReader', () => {
  it('reads least significant bit first, across byte boundaries', () => {
    // 0b1010_0101, 0b0000_0011
    const reader = new BitReader(new Uint8Array([0xa5, 0x03]));
    expect(reader.read(1)).toBe(1);
    expect(reader.read(3)).toBe(0b010);
    expect(reader.read(6)).toBe(0b11_1010);
    expect(reader.position).toBe(10);
    expect(reader.read(6)).toBe(0);
  });

  it('reads full 32-bit values as unsigned numbers', () => {
    const reader = new BitReader(new Uint8Array([0x55, 0xaa, 0x55, 0xaa, 0xff]));
    expect(reader.read(32)).toBe(0xaa55aa55);
    expect(new BitReader(new Uint8Array([0x55, 0xaa, 0x55, 0xaa, 0xff]), 4).read(32)).toBe(0xfaa55aa5);
  });

  it('round-trips values written by the test BitWriter', () => {
    const writer = new BitWriter().write(5, 3).write(160, 8).write(0xffffffff, 32).write(1, 1).alignToByte().write(0x1234, 16);
    const reader = new BitReader(writer.bytes());
    expect([reader.read(3), reader.read(8), reader.read(32), reader.read(1)]).toEqual([5, 160, 0xffffffff, 1]);
    reader.alignToByte();
    expect(reader.position).toBe(48);
    expect(reader.read(16)).toBe(0x1234);
  });

  it('peeks without moving and pads a short tail with zeros', () => {
    const reader = new BitReader(new Uint8Array([0xff]), 4);
    expect(reader.peek(9)).toBe(0b1111);
    expect(reader.position).toBe(4);
  });

  it('aligns to the next byte only when inside one', () => {
    const reader = new BitReader(new Uint8Array(4), 8);
    reader.alignToByte();
    expect(reader.position).toBe(8);
    const inside = new BitReader(new Uint8Array(4), 9);
    inside.alignToByte();
    expect(inside.position).toBe(16);
  });

  it('throws at the end of the data', () => {
    const reader = new BitReader(new Uint8Array([1]), 4);
    expect(() => reader.read(5)).toThrow(BitReaderEofError);
  });
});

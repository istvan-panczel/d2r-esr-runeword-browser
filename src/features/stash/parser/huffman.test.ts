import { describe, expect, it } from 'vitest';
import { BitReader } from './bitReader.ts';
import { HUFFMAN_ENCODE, InvalidItemCodeError, readItemCode } from './huffman.ts';
import { BitWriter, writeItemCode } from './testItems.ts';

describe('item code Huffman decoding', () => {
  it('decodes a real item code from save bytes', () => {
    // "jew " as stored in a D2R stash: 000101110 110000 00000 10 (stream order)
    const writer = new BitWriter();
    for (const bit of '00010111011000000000' + '10') writer.write(bit === '1' ? 1 : 0, 1);
    expect(readItemCode(new BitReader(writer.bytes()))).toBe('jew');
  });

  it('round-trips every symbol and strips the padding', () => {
    const symbols = [...HUFFMAN_ENCODE.keys()].filter((symbol) => symbol !== ' ');
    expect(symbols).toHaveLength(36);
    for (let i = 0; i < symbols.length; i += 3) {
      const code = symbols.slice(i, i + 3).join('');
      const writer = new BitWriter();
      writeItemCode(writer, code);
      const reader = new BitReader(writer.bytes());
      expect(readItemCode(reader)).toBe(code);
      expect(reader.position).toBe(writer.length);
    }
  });

  it('is a prefix-free code', () => {
    const stream = [...HUFFMAN_ENCODE.values()].map(({ value, length }) =>
      Array.from({ length }, (_, i) => String(Math.floor(value / 2 ** i) % 2)).join('')
    );
    for (const a of stream) for (const b of stream) if (a !== b) expect(a.startsWith(b)).toBe(false);
  });

  it('rejects bits that are not a code', () => {
    // The code covers 511 of the 512 9-bit patterns; 000101111 (next to "j" = 000101110) is the free one
    const writer = new BitWriter();
    for (const bit of '000101111' + '0000000') writer.write(bit === '1' ? 1 : 0, 1);
    expect(() => readItemCode(new BitReader(writer.bytes()))).toThrow(InvalidItemCodeError);
  });
});

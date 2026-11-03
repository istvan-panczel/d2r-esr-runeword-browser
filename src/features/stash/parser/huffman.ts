/**
 * The Huffman code D2R (save version > 96) stores item codes with: four symbols, the code padded with spaces
 * ("jew " for a jewel). Table from d07riv's D2R save viewer as used by dschu012/d2s and ResurrectedTrader/d2s-rs
 * (MIT): each symbol's bits are listed in the order they appear in the stream.
 */
import type { BitReader } from './bitReader.ts';

const CODES: readonly (readonly [string, string])[] = [
  ['0', '11111011'],
  [' ', '10'],
  ['1', '1111100'],
  ['2', '001100'],
  ['3', '1101101'],
  ['4', '11111010'],
  ['5', '00010110'],
  ['6', '1101111'],
  ['7', '01111'],
  ['8', '000100'],
  ['9', '01110'],
  ['a', '11110'],
  ['b', '0101'],
  ['c', '01000'],
  ['d', '110001'],
  ['e', '110000'],
  ['f', '010011'],
  ['g', '11010'],
  ['h', '00011'],
  ['i', '1111110'],
  ['j', '000101110'],
  ['k', '010010'],
  ['l', '11101'],
  ['m', '01101'],
  ['n', '001101'],
  ['o', '1111111'],
  ['p', '11001'],
  ['q', '11011001'],
  ['r', '11100'],
  ['s', '0010'],
  ['t', '01100'],
  ['u', '00001'],
  ['v', '1101110'],
  ['w', '00000'],
  ['x', '00111'],
  ['y', '0001010'],
  ['z', '11011000'],
];

const MAX_CODE_LENGTH = 9;

/** The stream bits of a code as a little-endian value (first stream bit = bit 0), the way BitReader.peek returns them */
function streamValue(bits: string): number {
  let value = 0;
  for (let i = 0; i < bits.length; i++) if (bits.charAt(i) === '1') value |= 1 << i;
  return value;
}

/** Indexed by the next 9 stream bits: [symbol, code length]; length 0 marks an invalid prefix */
const DECODE: readonly (readonly [string, number])[] = (() => {
  const table: [string, number][] = Array.from({ length: 1 << MAX_CODE_LENGTH }, () => ['', 0]);
  for (const [symbol, bits] of CODES) {
    const stream = streamValue(bits);
    for (let fill = 0; fill < 1 << (MAX_CODE_LENGTH - bits.length); fill++) table[stream | (fill << bits.length)] = [symbol, bits.length];
  }
  return table;
})();

export const HUFFMAN_ENCODE: ReadonlyMap<string, { value: number; length: number }> = new Map(
  CODES.map(([symbol, bits]) => [symbol, { value: streamValue(bits), length: bits.length }])
);

export class InvalidItemCodeError extends Error {
  constructor(position: number) {
    super(`invalid Huffman item code at bit ${String(position)}`);
    this.name = 'InvalidItemCodeError';
  }
}

/** Reads a 4-symbol item code and returns it without the trailing padding spaces ("jew "→ "jew"). */
export function readItemCode(reader: BitReader): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    const [symbol, length] = DECODE[reader.peek(MAX_CODE_LENGTH)] ?? ['', 0];
    if (length === 0) throw new InvalidItemCodeError(reader.position);
    reader.read(length);
    code += symbol;
  }
  return code.trimEnd();
}

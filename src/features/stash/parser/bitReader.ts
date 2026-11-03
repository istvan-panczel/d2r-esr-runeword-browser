/** Thrown by BitReader when a read runs past the end of the data. */
export class BitReaderEofError extends Error {
  constructor(position: number, count: number, length: number) {
    super(`read of ${String(count)} bits at bit ${String(position)} runs past the end (${String(length)} bits)`);
    this.name = 'BitReaderEofError';
  }
}

/**
 * Reads a byte array as a little-endian bit stream, the way D2 save files are written: bit 0 of byte 0 comes first and
 * a multi-bit value is assembled least significant bit first.
 */
export class BitReader {
  readonly #bytes: Uint8Array;
  #position: number;

  constructor(bytes: Uint8Array, bitPosition = 0) {
    this.#bytes = bytes;
    this.#position = bitPosition;
  }

  /** Current bit position from the start of the data */
  get position(): number {
    return this.#position;
  }

  set position(bit: number) {
    this.#position = bit;
  }

  get bitLength(): number {
    return this.#bytes.length * 8;
  }

  /** An unsigned value of `count` bits (0–32), least significant bit first. */
  read(count: number): number {
    if (count < 0 || count > 32) throw new RangeError(`cannot read ${String(count)} bits at once`);
    if (this.#position + count > this.bitLength) throw new BitReaderEofError(this.#position, count, this.bitLength);
    let value = 0;
    let written = 0;
    while (written < count) {
      const byte = this.#bytes[this.#position >> 3] ?? 0;
      const offset = this.#position & 7;
      const take = Math.min(8 - offset, count - written);
      const chunk = (byte >> offset) & ((1 << take) - 1);
      // Multiplication instead of << keeps bit 31 from turning the value negative
      value += chunk * 2 ** written;
      written += take;
      this.#position += take;
    }
    return value;
  }

  readBit(): number {
    return this.read(1);
  }

  readBool(): boolean {
    return this.read(1) === 1;
  }

  /** The next `count` bits without moving; fewer when the data ends sooner (the missing high bits read as 0). */
  peek(count: number): number {
    const available = Math.min(count, this.bitLength - this.#position);
    const start = this.#position;
    const value = available > 0 ? this.read(available) : 0;
    this.#position = start;
    return value;
  }

  skip(count: number): void {
    this.#position += count;
  }

  /** Moves to the next byte boundary (no-op when already on one). */
  alignToByte(): void {
    this.#position = (this.#position + 7) & ~7;
  }
}

import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha1 } from './sha1';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const nodeSha1 = (bytes: Uint8Array) => createHash('sha1').update(bytes).digest('hex');

describe('sha1', () => {
  it('matches the standard test vectors', () => {
    expect(hex(sha1(new Uint8Array()))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(hex(sha1(new TextEncoder().encode('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('matches node:crypto for every length up to one block (0–55 bytes)', () => {
    for (let length = 0; length <= 55; length++) {
      const bytes = new Uint8Array(randomBytes(length));
      expect(hex(sha1(bytes)), `length ${String(length)}`).toBe(nodeSha1(bytes));
    }
  });

  it('matches node:crypto for 2000 random 8-byte inputs (the rotation hashes uint64 values)', () => {
    for (let i = 0; i < 2000; i++) {
      const bytes = new Uint8Array(randomBytes(8));
      expect(hex(sha1(bytes))).toBe(nodeSha1(bytes));
    }
    for (const fill of [0x00, 0x80, 0xff]) {
      const bytes = new Uint8Array(8).fill(fill);
      expect(hex(sha1(bytes))).toBe(nodeSha1(bytes));
    }
  });

  it('refuses messages longer than one block', () => {
    expect(() => sha1(new Uint8Array(56))).toThrow(RangeError);
  });
});

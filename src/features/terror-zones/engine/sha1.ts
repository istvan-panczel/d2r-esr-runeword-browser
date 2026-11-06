/**
 * Synchronous SHA-1 of a short message (at most 55 bytes: one 64-byte block after padding). The rotation needs one hash
 * per terror zone slot since the config's start (thousands on first load) and `crypto.subtle.digest` is async only.
 * Not for security: the game uses SHA-1 as its slot random number generator.
 */

const MAX_ONE_BLOCK_BYTES = 55;

const rotl = (value: number, bits: number) => (value << bits) | (value >>> (32 - bits));

/** The 20-byte SHA-1 digest of `bytes` (throws above 55 bytes). */
export function sha1(bytes: Uint8Array): Uint8Array {
  if (bytes.length > MAX_ONE_BLOCK_BYTES) throw new RangeError(`sha1: ${String(bytes.length)} bytes; at most 55 are supported`);
  const w = new Int32Array(80);
  for (let i = 0; i < bytes.length; i++) w[i >> 2] |= (bytes[i] ?? 0) << (24 - (i % 4) * 8);
  w[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  w[15] = bytes.length * 8;
  for (let i = 16; i < 80; i++) w[i] = rotl((w[i - 3] ?? 0) ^ (w[i - 8] ?? 0) ^ (w[i - 14] ?? 0) ^ (w[i - 16] ?? 0), 1);

  const h0 = 0x67452301;
  const h1 = 0xefcdab89 | 0;
  const h2 = 0x98badcfe | 0;
  const h3 = 0x10325476;
  const h4 = 0xc3d2e1f0 | 0;
  let a = h0;
  let b = h1;
  let c = h2;
  let d = h3;
  let e = h4;
  for (let t = 0; t < 80; t++) {
    let f: number;
    let k: number;
    if (t < 20) {
      f = (b & c) | (~b & d);
      k = 0x5a827999;
    } else if (t < 40) {
      f = b ^ c ^ d;
      k = 0x6ed9eba1;
    } else if (t < 60) {
      f = (b & c) | (b & d) | (c & d);
      k = 0x8f1bbcdc;
    } else {
      f = b ^ c ^ d;
      k = 0xca62c1d6;
    }
    const next = (rotl(a, 5) + f + e + k + (w[t] ?? 0)) | 0;
    e = d;
    d = c;
    c = rotl(b, 30);
    b = a;
    a = next;
  }

  const digest = new Uint8Array(20);
  const view = new DataView(digest.buffer);
  view.setUint32(0, (a + h0) >>> 0);
  view.setUint32(4, (b + h1) >>> 0);
  view.setUint32(8, (c + h2) >>> 0);
  view.setUint32(12, (d + h3) >>> 0);
  view.setUint32(16, (e + h4) >>> 0);
  return digest;
}

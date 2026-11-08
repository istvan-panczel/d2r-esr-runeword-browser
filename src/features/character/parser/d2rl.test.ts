import { describe, expect, it } from 'vitest';
import { d2rlMatchesSave, parseD2rl } from './d2rl.ts';
import { D2rlParseError } from './errors.ts';

function buildSidecar(options: { magic?: string; format?: number; d2sHash?: Uint8Array; version?: string } = {}): Uint8Array {
  const strings = ['3.3.94995'];
  const mod = ['Eastern_Sun_Resurrected', 'Eastern_Sun_Resurrected', '', 'description', options.version ?? '3.3.02'];
  const encoder = new TextEncoder();
  const lengthPrefixed = (text: string): number[] => {
    const bytes = encoder.encode(text);
    return [bytes.length, 0, 0, 0, ...bytes];
  };
  const tail = [
    ...strings.flatMap(lengthPrefixed),
    ...new Array<number>(12).fill(0),
    ...mod.flatMap(lengthPrefixed),
    0,
    0,
    0,
    0, // plugin count
  ];
  const size = 0x154 + tail.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  out.set(encoder.encode(options.magic ?? 'D2RL'), 0);
  view.setUint16(4, options.format ?? 2, true);
  view.setUint16(6, 44, true);
  view.setUint32(8, size - 44, true);
  view.setUint32(0x34, 0xdeadbeef, true);
  view.setUint32(0x38, 8453, true);
  if (options.d2sHash !== undefined) out.set(options.d2sHash, 0x3c);
  view.setBigUint64(0x74, 1_794_169_893n, true);
  out.set(tail, 0x154);
  return out;
}

describe('parseD2rl', () => {
  it('reads the versions, the recorded save data and the last-saved time', () => {
    const sidecar = parseD2rl(buildSidecar({ version: '3.2.24' }));
    expect(sidecar).toMatchObject({
      formatVersion: 2,
      gameVersion: '3.3.94995',
      esrVersion: '3.2.24',
      d2sChecksum: 0xdeadbeef,
      d2sSize: 8453,
      lastSavedAt: 1_794_169_893,
    });
  });

  it('rejects files that are not sidecars, with a typed error', () => {
    expect(() => parseD2rl(buildSidecar({ magic: 'NOPE' }))).toThrowError(D2rlParseError);
    expect(() => parseD2rl(new Uint8Array(10))).toThrowError(D2rlParseError);
    expect(() => parseD2rl(buildSidecar({ format: 3 }))).toThrowError(/format version 3/);
  });

  it('reports a string running past the end instead of reading garbage', () => {
    const sidecar = buildSidecar();
    new DataView(sidecar.buffer).setUint32(0x154, 1_000_000, true);
    expect(() => parseD2rl(sidecar)).toThrowError(D2rlParseError);
  });
});

describe('d2rlMatchesSave', () => {
  const save = new TextEncoder().encode('the character save bytes');

  it('confirms the SHA-256 at offset 60 and rejects another save', async () => {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', save.slice()));
    const sidecar = parseD2rl(buildSidecar({ d2sHash: digest }));
    expect(await d2rlMatchesSave(sidecar, save)).toBe(true);
    expect(await d2rlMatchesSave(sidecar, new TextEncoder().encode('another'))).toBe(false);
  });
});

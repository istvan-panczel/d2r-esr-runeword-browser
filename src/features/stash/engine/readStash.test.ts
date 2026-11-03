import { describe, expect, it } from 'vitest';
import { checkStashUpload, MAX_STASH_BYTES, readStash, toStashLoadError } from './readStash';
import { StashParseError, UnsupportedStashError } from '../parser/errors';

const EMPTY_DATA = { stats: [], items: [] };

/** One 64-byte section header with the given save version */
function header(version: number): Uint8Array {
  const bytes = new Uint8Array(64);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0xaa55aa55, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, version, true);
  view.setUint16(16, 64, true);
  return bytes;
}

describe('checkStashUpload', () => {
  it('accepts a .d2i file of any case', () => {
    expect(checkStashUpload('ModernSharedStashSoftCoreV2.D2I', 220_000)).toBeNull();
  });

  it('rejects other file types and names a character save', () => {
    expect(checkStashUpload('Sorc.d2s', 10_000)?.message).toContain('character save');
    expect(checkStashUpload('stash.zip', 10_000)).toMatchObject({ kind: 'wrong-type' });
  });

  it('rejects a file far too large for a stash', () => {
    expect(checkStashUpload('big.d2i', MAX_STASH_BYTES + 1)).toMatchObject({ kind: 'wrong-type' });
  });
});

describe('readStash', () => {
  it('reports the legacy stash as unsupported', () => {
    const result = readStash(header(0x63), EMPTY_DATA);
    expect(result).toMatchObject({ ok: false, error: { kind: 'unsupported', reason: 'legacy' } });
  });

  it('reports a file without the stash magic as not a stash', () => {
    expect(readStash(new Uint8Array(100), EMPTY_DATA)).toMatchObject({ ok: false, error: { kind: 'unsupported', reason: 'not-a-stash' } });
  });

  it('keeps the parser error details', () => {
    const details = { section: 3, item: 7, path: 'item 7', code: 'jew', itemBitOffset: 100, bitOffset: 140 };
    expect(toStashLoadError(new StashParseError('boom', details))).toEqual({
      kind: 'parse',
      message: 'section 3 item 7 (jew) bit 140: boom',
      details,
    });
    expect(toStashLoadError(new UnsupportedStashError('retail', 'retail'))).toMatchObject({ kind: 'unsupported', reason: 'retail' });
    expect(toStashLoadError('weird')).toEqual({ kind: 'unexpected', message: 'weird' });
  });
});

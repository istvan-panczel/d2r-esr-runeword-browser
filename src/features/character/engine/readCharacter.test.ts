import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { StashBundle } from '@/features/game-data/engine/schema';
import { CharacterParseError } from '../parser/errors';
import {
  MAX_CHARACTER_BYTES,
  pickCharacterFiles,
  readCharacter,
  relatedSidecars,
  resolveSidecar,
  toCharacterLoadError,
} from './readCharacter';

const file = (name: string, size = 100) => ({ name, size });

function sidecarBytes(saveHash: Uint8Array, version = '3.3.02'): Uint8Array {
  const encoder = new TextEncoder();
  const prefixed = (text: string): number[] => [text.length, 0, 0, 0, ...encoder.encode(text)];
  const tail = [...prefixed('3.3.94995'), ...new Array<number>(12).fill(0), ...['a', 'b', '', 'd', version].flatMap(prefixed), 0, 0, 0, 0];
  const out = new Uint8Array(0x154 + tail.length);
  const view = new DataView(out.buffer);
  out.set(encoder.encode('D2RL'), 0);
  view.setUint16(4, 2, true);
  view.setUint16(6, 44, true);
  view.setUint32(8, out.length - 44, true);
  out.set(saveHash, 0x3c);
  out.set(tail, 0x154);
  return out;
}

const sha256 = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice()));

describe('pickCharacterFiles', () => {
  it('takes the .d2s and the .d2rl candidates', () => {
    const save = file('Hero.d2s');
    const sidecar = file('Hero.d2rl');
    expect(pickCharacterFiles([sidecar, save])).toEqual({ ok: true, saves: [save], sidecars: [sidecar], skipped: [] });
    expect(pickCharacterFiles([save])).toEqual({ ok: true, saves: [save], sidecars: [], skipped: [] });
  });

  it('takes several saves at once, in the order picked, and ignores other files next to them', () => {
    const [a, b, aSidecar, stash] = [file('a.d2s'), file('b.d2s'), file('a.d2rl'), file('SharedStash.d2i')];
    expect(pickCharacterFiles([b, stash, aSidecar, a])).toEqual({ ok: true, saves: [b, a], sidecars: [aSidecar], skipped: [] });
  });

  it('skips a far too large save but reads the others', () => {
    const [big, small] = [file('big.d2s', MAX_CHARACTER_BYTES + 1), file('small.d2s')];
    const picked = pickCharacterFiles([big, small]);
    if (!picked.ok) throw new Error('expected a pick');
    expect(picked.saves).toEqual([small]);
    expect(picked.skipped.map((entry) => entry.fileName)).toEqual(['big.d2s']);
    expect(picked.skipped[0]?.error.message).toContain('too large');
  });

  it('rejects anything without a usable save', () => {
    const message = (files: ReturnType<typeof file>[]) => {
      const picked = pickCharacterFiles(files);
      return picked.ok ? null : picked.error.message;
    };
    expect(message([file('Hero.d2rl')])).toContain('alone is not a save');
    expect(message([file('ModernSharedStashSoftCoreV2.d2i')])).toContain('shared stash');
    expect(message([file('notes.txt')])).toContain('not a character save');
    expect(message([file('a.d2s', MAX_CHARACTER_BYTES + 1)])).toContain('too large');
    expect(message([])).toContain('No file');
  });
});

describe('relatedSidecars', () => {
  const sidecars = [file('Hero.d2rl'), file('Other.D2RL'), file('random.d2rl')];

  it('reports every candidate on a single save, as before', () => {
    expect(relatedSidecars('Hero.d2s', sidecars, 1)).toEqual(sidecars);
  });

  it('reports only the same-named candidate when several saves came at once', () => {
    expect(relatedSidecars('other.d2s', sidecars, 3)).toEqual([file('Other.D2RL')]);
    expect(relatedSidecars('Nobody.d2s', sidecars, 2)).toEqual([]);
  });
});

describe('resolveSidecar', () => {
  const save = new Uint8Array([1, 2, 3]);

  it('uses the sidecar whose hash is the save, among several', async () => {
    const hash = await sha256(save);
    const other = sidecarBytes(new Uint8Array(32));
    const matching = sidecarBytes(hash, '3.2.24');
    expect(
      await resolveSidecar(
        [
          { name: 'other.d2rl', bytes: other },
          { name: 'Hero.d2rl', bytes: matching },
        ],
        save
      )
    ).toEqual({ status: 'matched', name: 'Hero.d2rl', esrVersion: '3.2.24' });
  });

  it('still finds a match among every candidate, but reports only a related one as rejected', async () => {
    const hash = await sha256(save);
    const other = { name: 'Other.d2rl', bytes: sidecarBytes(new Uint8Array(32)) };
    const matching = { name: 'Elsewhere.d2rl', bytes: sidecarBytes(hash, '3.3.02') };
    expect(await resolveSidecar([other, matching], save, [])).toEqual({ status: 'matched', name: 'Elsewhere.d2rl', esrVersion: '3.3.02' });
    expect(await resolveSidecar([other], save, [])).toEqual({ status: 'none' });
    expect(await resolveSidecar([other], save, [other])).toMatchObject({ status: 'rejected', name: 'Other.d2rl' });
  });

  it('reports a mismatch or an unreadable file, never throws', async () => {
    expect(await resolveSidecar([], save)).toEqual({ status: 'none' });
    expect(await resolveSidecar([{ name: 'x.d2rl', bytes: sidecarBytes(new Uint8Array(32)) }], save)).toEqual({
      status: 'rejected',
      name: 'x.d2rl',
      reason: 'mismatch',
    });
    expect(await resolveSidecar([{ name: 'bad.d2rl', bytes: new Uint8Array([9, 9]) }], save)).toEqual({
      status: 'rejected',
      name: 'bad.d2rl',
      reason: 'unreadable',
    });
  });
});

describe('readCharacter', () => {
  it('maps a parse error with its failure point', () => {
    const error = toCharacterLoadError(new CharacterParseError('bad-magic', 'no magic', { section: 'header', byteOffset: 0 }));
    expect(error).toMatchObject({ kind: 'parse', details: { section: 'header', byteOffset: 0 } });
    expect(toCharacterLoadError(new Error('boom'))).toEqual({ kind: 'unexpected', message: 'boom' });
  });

  const bundlePath = resolve(__dirname, '../../../../public/game-data/stash.json');
  it.skipIf(!existsSync(bundlePath))('never throws on garbage bytes', () => {
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf-8')) as StashBundle;
    const result = readCharacter(new Uint8Array(40), bundle);
    expect(result).toMatchObject({ ok: false, error: { kind: 'parse' } });
  });
});

import { describe, expect, it } from 'vitest';
import { clearStoredCharacter, loadStoredCharacter, saveStoredCharacter, type CharacterFileMeta } from './characterDb';

const META: CharacterFileMeta = {
  name: 'Hero.d2s',
  size: 3,
  lastModified: 1_700_000_000_000,
  uploadedAt: 1_700_000_100_000,
  sidecar: { status: 'matched', name: 'Hero.d2rl', esrVersion: '3.3.02' },
};

describe('character storage', () => {
  it('remembers the last character only and forgets it on clear', async () => {
    expect(await loadStoredCharacter()).toBeNull();
    await saveStoredCharacter(META, new Uint8Array([1, 2, 3]));
    await saveStoredCharacter({ ...META, name: 'Second.d2s', sidecar: { status: 'none' } }, new Uint8Array([4, 5, 6]).subarray(1));
    const stored = await loadStoredCharacter();
    expect(stored?.meta).toEqual({ ...META, name: 'Second.d2s', sidecar: { status: 'none' } });
    expect([...(stored?.bytes ?? [])]).toEqual([5, 6]);
    await clearStoredCharacter();
    expect(await loadStoredCharacter()).toBeNull();
  });
});

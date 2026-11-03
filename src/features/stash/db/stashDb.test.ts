import { describe, expect, it } from 'vitest';
import { clearStoredStash, loadStoredStash, saveStoredStash } from './stashDb';

const META = { name: 'ModernSharedStashSoftCoreV2.d2i', size: 3, lastModified: 1_700_000_000_000, uploadedAt: 1_700_000_100_000 };

describe('stash storage', () => {
  it('remembers the last upload and forgets it on clear', async () => {
    expect(await loadStoredStash()).toBeNull();
    await saveStoredStash(META, new Uint8Array([1, 2, 3]));
    await saveStoredStash({ ...META, name: 'second.d2i' }, new Uint8Array([4, 5, 6]).subarray(1));
    const stored = await loadStoredStash();
    expect(stored?.meta).toEqual({ ...META, name: 'second.d2i' });
    expect([...(stored?.bytes ?? [])]).toEqual([5, 6]);
    await clearStoredStash();
    expect(await loadStoredStash()).toBeNull();
  });
});

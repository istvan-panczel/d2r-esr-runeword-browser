import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHARACTER_DB_NAME,
  characterDb,
  clearStoredCharacters,
  loadStoredCharacters,
  removeStoredCharacter,
  saveNameOf,
  saveStoredCharacter,
  type CharacterFileMeta,
} from './characterDb';

const META: CharacterFileMeta = {
  name: 'Hero.d2s',
  size: 3,
  lastModified: 1_700_000_000_000,
  uploadedAt: 1_700_000_100_000,
  sidecar: { status: 'matched', name: 'Hero.d2rl', esrVersion: '3.3.02' },
};

/** A save-sized buffer with `name` in the header's name field */
function saveWithName(name: string, length = 0x200): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(new TextEncoder().encode(name), 0x12b);
  return bytes;
}

async function freshDatabase(): Promise<void> {
  characterDb.close({ disableAutoOpen: false });
  await Dexie.delete(CHARACTER_DB_NAME);
}

beforeEach(freshDatabase);

describe('saveNameOf', () => {
  it('reads the header name up to the first zero byte', () => {
    expect(saveNameOf(saveWithName('SpinToWin'))).toBe('SpinToWin');
  });

  it('is null for a short file or an empty name', () => {
    expect(saveNameOf(new Uint8Array(10))).toBeNull();
    expect(saveNameOf(new Uint8Array(0x200))).toBeNull();
  });
});

describe('character storage', () => {
  it('keeps one record per character name and replaces a re-uploaded character', async () => {
    expect(await loadStoredCharacters()).toEqual([]);
    await saveStoredCharacter('Hero', META, new Uint8Array([1, 2, 3]));
    await saveStoredCharacter('Other', { ...META, name: 'Other.d2s' }, new Uint8Array([7]));
    await saveStoredCharacter(
      'Hero',
      { ...META, name: 'Hero (2).d2s', sidecar: { status: 'none' } },
      new Uint8Array([4, 5, 6]).subarray(1)
    );

    const stored = await loadStoredCharacters();
    expect(stored.map((entry) => entry.characterName).sort()).toEqual(['Hero', 'Other']);
    const hero = stored.find((entry) => entry.characterName === 'Hero');
    expect(hero?.meta).toEqual({ ...META, name: 'Hero (2).d2s', sidecar: { status: 'none' } });
    expect([...(hero?.bytes ?? [])]).toEqual([5, 6]);
  });

  it('removes one character, and clears them all', async () => {
    await saveStoredCharacter('Hero', META, new Uint8Array([1]));
    await saveStoredCharacter('Other', META, new Uint8Array([2]));
    await removeStoredCharacter('Hero');
    expect((await loadStoredCharacters()).map((entry) => entry.characterName)).toEqual(['Other']);
    await clearStoredCharacters();
    expect(await loadStoredCharacters()).toEqual([]);
  });
});

describe('migration from the one-record version 1', () => {
  async function writeVersion1(record: Record<string, unknown> | null): Promise<void> {
    const legacy = new Dexie(CHARACTER_DB_NAME);
    legacy.version(1).stores({ files: 'key' });
    if (record !== null) await legacy.table('files').put(record);
    legacy.close();
  }

  it('keeps the remembered character, keyed by the name in its header', async () => {
    const bytes = saveWithName('SpinToWin');
    await writeVersion1({ key: 'last', ...META, name: 'SpinToWin.d2s', bytes: bytes.slice().buffer });

    const stored = await loadStoredCharacters();
    expect(characterDb.verno).toBe(3);
    expect(characterDb.tables.map((table) => table.name)).toEqual(['characters']);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.characterName).toBe('SpinToWin');
    expect(stored[0]?.meta).toEqual({ ...META, name: 'SpinToWin.d2s' });
    expect(stored[0]?.bytes).toEqual(bytes);
  });

  it('falls back to the file name when the header has no readable name', async () => {
    await writeVersion1({ key: 'last', ...META, name: 'Broken.d2s', bytes: new Uint8Array(4).buffer });
    expect((await loadStoredCharacters()).map((entry) => entry.characterName)).toEqual(['Broken']);
  });

  it('opens an empty version 1 database as an empty list', async () => {
    await writeVersion1(null);
    expect(await loadStoredCharacters()).toEqual([]);
  });
});

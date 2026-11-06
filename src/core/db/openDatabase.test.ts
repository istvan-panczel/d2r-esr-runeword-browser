import { afterEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { db } from './db';
import { openDatabase } from './openDatabase';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openDatabase', () => {
  it('recreates a cache database whose schema cannot be upgraded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    db.close();
    await Dexie.delete(db.name);

    // An old install: runewords keyed by name only (the primary key changed later)
    const legacy = new Dexie(db.name);
    legacy.version(3).stores({ runewords: 'name', affixes: 'pattern' });
    await legacy.table('runewords').put({ name: 'Old' });
    legacy.close();

    await openDatabase();

    expect(db.isOpen()).toBe(true);
    expect(db.verno).toBe(15);
    expect(await db.runewords.count()).toBe(0);
    expect(db.tables.map((table) => table.name)).not.toContain('affixes');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('opens a compatible database without deleting it', async () => {
    db.close();
    await Dexie.delete(db.name);
    await openDatabase();
    await db.metadata.put({ key: 'esrVersion', value: '1.0.0' });
    db.close();

    await openDatabase();

    expect((await db.metadata.get('esrVersion'))?.value).toBe('1.0.0');
  });

  it('upgrades a version 14 cache to 15 and drops the stored app version so the next startup re-parses', async () => {
    db.close();
    await Dexie.delete(db.name);

    const v14 = new Dexie(db.name);
    v14.version(14).stores({ ascendancies: 'name', metadata: 'key' });
    await v14.table('ascendancies').put({ name: 'Battlemage' });
    await v14.table('metadata').bulkPut([
      { key: 'esrVersion', value: '3.2.24' },
      { key: 'appVersion', value: '1.54.0' },
    ]);
    v14.close();

    await openDatabase();

    expect(db.verno).toBe(15);
    expect(await db.ascendancies.count()).toBe(1);
    expect(await db.ascendancyChallenges.count()).toBe(0);
    expect((await db.metadata.get('esrVersion'))?.value).toBe('3.2.24');
    expect(await db.metadata.get('appVersion')).toBeUndefined();
  });
});

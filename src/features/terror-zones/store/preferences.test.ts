import { beforeEach, describe, expect, it } from 'vitest';
import type { TerrorZoneGroup } from '@/features/game-data/engine/schema';
import { zoneGroupHashes, zoneSetFingerprint } from '../utils/watched';
import { syncWatchedZoneSet, WATCHED_STORAGE_KEY, WATCHED_ZONE_SET_STORAGE_KEY } from './preferences';

const stored = (key: string): unknown => JSON.parse(window.localStorage.getItem(key) ?? 'null');
const group = (id: string, areaIds: number[]): TerrorZoneGroup => ({
  id,
  labels: [id],
  areas: areaIds.map((areaId) => ({ id: areaId, name: String(areaId) })),
});
const v33 = [group('ESR-Zone03', [39, 34]), group('ESR-Zone19', [27, 29])];

describe('syncWatchedZoneSet', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('drops only the reused ids from a list starred before the hashes existed, and stores the hashes', () => {
    window.localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(['ESR-Zone19', 'ESR-Zone03', 'ESR-Zone21']));
    syncWatchedZoneSet(v33);
    expect(stored(WATCHED_STORAGE_KEY)).toEqual(['ESR-Zone03']);
    expect(stored(WATCHED_ZONE_SET_STORAGE_KEY)).toEqual(zoneGroupHashes(v33));
  });

  it('keeps a list stored with a matching v1.59.0 fingerprint', () => {
    window.localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(['ESR-Zone19', 'ESR-Zone03']));
    window.localStorage.setItem(WATCHED_ZONE_SET_STORAGE_KEY, JSON.stringify(zoneSetFingerprint(v33)));
    syncWatchedZoneSet(v33);
    expect(stored(WATCHED_STORAGE_KEY)).toEqual(['ESR-Zone19', 'ESR-Zone03']);
    expect(stored(WATCHED_ZONE_SET_STORAGE_KEY)).toEqual(zoneGroupHashes(v33));
  });

  it('keeps the stars of unchanged groups when another group changes', () => {
    syncWatchedZoneSet(v33);
    window.localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(['ESR-Zone03', 'ESR-Zone19']));
    syncWatchedZoneSet(v33);
    expect(stored(WATCHED_STORAGE_KEY)).toEqual(['ESR-Zone03', 'ESR-Zone19']);
    const next = [group('ESR-Zone03', [34, 39]), group('ESR-Zone19', [27, 29, 31]), group('ESR-Zone21', [1])];
    syncWatchedZoneSet(next);
    expect(stored(WATCHED_STORAGE_KEY)).toEqual(['ESR-Zone03']);
    expect(stored(WATCHED_ZONE_SET_STORAGE_KEY)).toEqual(zoneGroupHashes(next));
  });

  it('only stores the hashes when nothing is watched', () => {
    syncWatchedZoneSet(v33);
    expect(window.localStorage.getItem(WATCHED_STORAGE_KEY)).toBeNull();
    expect(stored(WATCHED_ZONE_SET_STORAGE_KEY)).toEqual(zoneGroupHashes(v33));
  });
});

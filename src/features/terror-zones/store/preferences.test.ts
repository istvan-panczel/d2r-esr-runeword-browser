import { beforeEach, describe, expect, it } from 'vitest';
import { syncWatchedZoneSet, WATCHED_STORAGE_KEY, WATCHED_ZONE_SET_STORAGE_KEY } from './preferences';

const stored = (key: string): unknown => JSON.parse(window.localStorage.getItem(key) ?? 'null');

describe('syncWatchedZoneSet', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('clears a watch list starred before the fingerprint existed and stores the fingerprint', () => {
    window.localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(['ESR-Zone19', 'ESR-Zone21']));
    syncWatchedZoneSet('20-aaaaaaaa');
    expect(stored(WATCHED_STORAGE_KEY)).toEqual([]);
    expect(stored(WATCHED_ZONE_SET_STORAGE_KEY)).toBe('20-aaaaaaaa');
  });

  it('keeps the list while the zone groups stay the same, clears it once when they change', () => {
    syncWatchedZoneSet('20-aaaaaaaa');
    window.localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(['ESR-Zone03']));
    syncWatchedZoneSet('20-aaaaaaaa');
    expect(stored(WATCHED_STORAGE_KEY)).toEqual(['ESR-Zone03']);
    syncWatchedZoneSet('21-bbbbbbbb');
    expect(stored(WATCHED_STORAGE_KEY)).toEqual([]);
    expect(stored(WATCHED_ZONE_SET_STORAGE_KEY)).toBe('21-bbbbbbbb');
  });

  it('only stores the fingerprint when nothing is watched', () => {
    syncWatchedZoneSet('20-aaaaaaaa');
    expect(window.localStorage.getItem(WATCHED_STORAGE_KEY)).toBeNull();
    expect(stored(WATCHED_ZONE_SET_STORAGE_KEY)).toBe('20-aaaaaaaa');
  });
});

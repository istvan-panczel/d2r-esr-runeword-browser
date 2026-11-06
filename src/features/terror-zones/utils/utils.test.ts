import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TerrorZoneBoost, TerrorZoneGroup } from '@/features/game-data/engine/schema';
import type { TerrorZoneSlot } from '../engine/schedule';
import { formatCompactBoosts, sameCaps, summariseBoosts, formatVersionBoost } from './boosts';
import { formatClockRange, formatCountdown, formatDayLabel, formatIn, formatWhen, localDayKey } from './format';
import { filterSlots, knownWatched, shouldNotify, toggleWatched, watchAlert } from './watched';
import { isWidgetHidden, widgetLift } from './widgetPosition';

const zone = (id: string): TerrorZoneGroup => ({ id, labels: [id], areas: [] });
const slot = (n: number, id: string): TerrorZoneSlot => ({ slot: n, start: n * 3600, end: (n + 1) * 3600, zoneIndex: 0, zone: zone(id) });

describe('formatCountdown / formatIn', () => {
  it('formats a countdown as m:ss or h:mm:ss, never negative', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(45 * 60 + 12)).toBe('45:12');
    expect(formatCountdown(3600 + 2 * 60 + 3)).toBe('1:02:03');
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('formats a wait in days, hours and minutes', () => {
    expect(formatIn(30)).toBe('now');
    expect(formatIn(45 * 60)).toBe('in 45 min');
    expect(formatIn(3 * 3600 + 20 * 60)).toBe('in 3 h 20 min');
    expect(formatIn(2 * 86400 + 4 * 3600 + 59)).toBe('in 2 d 4 h');
    expect(formatIn(86400)).toBe('in 1 d');
  });

  it('keys local days', () => {
    const noon = new Date(2026, 10, 6, 12).getTime() / 1000;
    expect(localDayKey(noon)).toBe('2026-11-06');
    expect(localDayKey(noon + 12 * 3600)).toBe('2026-11-07');
  });
});

describe('day labels in a half-hour time zone (Asia/Kolkata, UTC+5:30)', () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Asia/Kolkata';
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });
  const utc = (iso: string) => Date.parse(iso) / 1000;

  it('labels a slot by the real time, also when the current slot started before local midnight', () => {
    // 18:00Z = 23:30 IST on the 6th, 18:30Z = 00:00 IST on the 7th
    expect(localDayKey(utc('2026-11-06T18:30:00Z'))).toBe('2026-11-07');
    // at 23:50 IST the slot starting at 00:00 is tomorrow
    expect(formatDayLabel(utc('2026-11-06T19:00:00Z'), utc('2026-11-06T18:20:00Z'))).toBe('Tomorrow');
    // at 00:10 IST (after midnight, inside the slot that started at 23:30) it is today, not tomorrow
    expect(formatDayLabel(utc('2026-11-06T19:00:00Z'), utc('2026-11-06T18:40:00Z'))).toBe('Today');
    expect(formatWhen(utc('2026-11-06T19:00:00Z'), utc('2026-11-06T18:40:00Z'), 'en-GB')).toMatch(/^0?0:30$/);
  });

  it('keeps a window on one short line, also across local midnight', () => {
    // 18:00Z–19:00Z = 23:30–00:30 IST
    expect(formatClockRange(utc('2026-11-06T18:00:00Z'), utc('2026-11-06T19:00:00Z'), 'en-US')).toBe('11:30 PM–12:30 AM');
    // ending exactly at midnight (17:30Z–18:30Z = 23:00–00:00 IST): no dates either
    expect(formatClockRange(utc('2026-11-06T17:30:00Z'), utc('2026-11-06T18:30:00Z'), 'en-US')).toBe('11:00 PM–12:00 AM');
    expect(formatClockRange(utc('2026-11-06T08:30:00Z'), utc('2026-11-06T09:30:00Z'), 'en-GB')).toMatch(/^14:00\s?[–-]\s?15:00$/);
    expect(formatClockRange(utc('2026-11-06T08:30:00Z'), utc('2026-11-06T09:30:00Z'), 'en-US')).toMatch(/^2:00\s?[–-]\s?3:00\sPM$/);
  });
});

describe('watched helpers', () => {
  const watched = new Set(['ESR-Zone03']);

  it('raises the alert for a watched current group first, then for the next one', () => {
    expect(watchAlert(slot(1, 'ESR-Zone03'), slot(2, 'ESR-Zone05'), watched)).toBe('active');
    expect(watchAlert(slot(1, 'ESR-Zone05'), slot(2, 'ESR-Zone03'), watched)).toBe('next');
    expect(watchAlert(null, slot(2, 'ESR-Zone03'), watched)).toBe('next');
    expect(watchAlert(slot(1, 'ESR-Zone05'), null, watched)).toBeNull();
  });

  it('filters to watched slots only when asked', () => {
    const slots = [slot(1, 'ESR-Zone03'), slot(2, 'ESR-Zone05')];
    expect(filterSlots(slots, watched, false)).toHaveLength(2);
    expect(filterSlots(slots, watched, true).map((entry) => entry.slot)).toEqual([1]);
  });

  it('toggles ids and drops ids the bundle no longer has', () => {
    expect(toggleWatched(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleWatched(['a', 'b'], 'a')).toEqual(['b']);
    expect([...knownWatched(['ESR-Zone03', 'Old-Zone'], ['ESR-Zone03'])]).toEqual(['ESR-Zone03']);
  });

  it('notifies only for a slot change to a watched group, once across tabs', () => {
    // slot 2 starts at 7200 s; the tab sees it 10 s in
    const base = { previousSlot: 1, current: slot(2, 'ESR-Zone03'), watched, enabled: true, lastNotifiedStart: null, now: 7210 };
    expect(shouldNotify(base)).toBe(true);
    // page load: no previous slot seen
    expect(shouldNotify({ ...base, previousSlot: null })).toBe(false);
    expect(shouldNotify({ ...base, previousSlot: 2 })).toBe(false);
    expect(shouldNotify({ ...base, enabled: false })).toBe(false);
    expect(shouldNotify({ ...base, current: slot(2, 'ESR-Zone05') })).toBe(false);
    // another tab already notified this slot (keyed by its start time, not the slot index)
    expect(shouldNotify({ ...base, lastNotifiedStart: 7200 })).toBe(false);
    expect(shouldNotify({ ...base, lastNotifiedStart: 3600 })).toBe(true);
    // a config moved later restarts the slot numbers; an old start time far in the past does not block them
    expect(shouldNotify({ ...base, current: slot(0, 'ESR-Zone03'), previousSlot: -1, now: 10, lastNotifiedStart: -50_000 })).toBe(true);
    // opened in a break (-1), then a watched zone starts
    expect(shouldNotify({ ...base, previousSlot: -1 })).toBe(true);
    // woke from sleep / unfrozen more than 5 minutes after the start: skipped
    expect(shouldNotify({ ...base, now: 7200 + 5 * 60 })).toBe(true);
    expect(shouldNotify({ ...base, now: 7200 + 5 * 60 + 1 })).toBe(false);
  });
});

describe('boost summary', () => {
  const boosts: TerrorZoneBoost[] = [0, 1, 2].flatMap((difficulty) => [
    { version: 'expansion' as const, difficulty, minLevel: 3, maxLevel: [45, 71, 96][difficulty] ?? 0, levelBoost: 4, xpPercent: 50 },
    { version: 'rotw' as const, difficulty, minLevel: 3, maxLevel: [45, 71, 96][difficulty] ?? 0, levelBoost: 2, xpPercent: 25 },
  ]);

  it('summarises each version with uniform boosts, with the caps per difficulty', () => {
    const summary = summariseBoosts(boosts);
    expect(summary.map((entry) => entry.version)).toEqual(['expansion', 'rotw']);
    expect(summary[0]).toMatchObject({ levelBoost: 4, xpPercent: 50, caps: [45, 71, 96] });
    expect(formatCompactBoosts(summary)).toBe('LoD +4 mlvl, +50% XP · RotW +2 mlvl, +25% XP');
    expect(sameCaps(summary)).toEqual([45, 71, 96]);
    expect(formatVersionBoost(summary[1] ?? summary[0])).toBe('+2 monster levels (capped at 45 / 71 / 96), +25% XP');
  });

  it('leaves out a version whose difficulties differ', () => {
    const mixed = boosts.map((boost) => (boost.version === 'rotw' && boost.difficulty === 2 ? { ...boost, levelBoost: 3 } : boost));
    expect(summariseBoosts(mixed).map((entry) => entry.version)).toEqual(['expansion']);
    expect(formatCompactBoosts([])).toBeNull();
  });
});

describe('widgetLift', () => {
  it('lifts the widget above the builds form bar and the guide note phone bar', () => {
    expect(widgetLift('/builds/new')).toBe('formBar');
    expect(widgetLift('/builds/abc-123/edit')).toBe('formBar');
    expect(widgetLift('/builds')).toBe('none');
    expect(widgetLift('/guide/terror-zones')).toBe('phoneBar');
    expect(widgetLift('/guide/map')).toBe('none');
    expect(widgetLift('/guide')).toBe('none');
    expect(widgetLift('/runewords')).toBe('none');
  });

  it('hides the widget on the schedule page only', () => {
    expect(isWidgetHidden('/terror-zones')).toBe(true);
    expect(isWidgetHidden('/terror-zones/')).toBe(true);
    expect(isWidgetHidden('/runewords')).toBe(false);
    expect(isWidgetHidden('/')).toBe(false);
  });
});

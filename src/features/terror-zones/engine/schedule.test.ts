import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { TerrorZonesBundle } from '@/features/game-data/engine/schema';
import { roll, Rotation } from './rotation';
import {
  createSchedule,
  currentWindow,
  nextSlotIndex,
  nextWindowPerZone,
  slotIndexAt,
  slotWindow,
  upcomingWindows,
  windowsFrom,
} from './schedule';

const toSeconds = (utc: string) => Date.parse(utc) / 1000;
const HOUR = 3600;

/** The retail D2R config (patch 3.x): 34 zones, 30-minute slots, from d2r-arcane-tracker's RETAIL_TERROR_ZONE_CONFIG */
const RETAIL_START = toSeconds('2025-12-05T00:00:00Z');
const RETAIL_SEED = 16665365343970128666n;
const RETAIL_ZONES = [
  'Act1-BurialGrounds',
  'Act1-Catacombs',
  'Act1-ColdPlains',
  'Act1-DarkWood',
  'Act1-BloodMoor',
  'Act1-Jail',
  'Act1-MooMooFarm',
  'Act1-Tristram',
  'Act1-Tower',
  'Act1-Monastery',
  'Act2-Sewers',
  'Act2-RockyWaste',
  'Act2-DryHills',
  'Act2-FarOasis',
  'Act2-LostCity',
  'Act2-TalRashas',
  'Act2-ArcaneSanctuary',
  'Act3-SpiderForest',
  'Act3-GreatMarsh',
  'Act3-FlayerJungle',
  'Act3-Kurast',
  'Act3-Travincal',
  'Act3-DuranceOfHate',
  'Act4_OuterSteppes',
  'Act4-RiverOfFlame',
  'Act4-ChaosSanctuary',
  'Act5-BloodyFoothils',
  'Act5-ArreatPlateau',
  'Act5-CrystallinePassage',
  'Act5-Halls',
  'Act5-GlacialTrail',
  'Act5-AncientsWay',
  'Act5-FrozenTundra',
  'Act5-WorldstoneKeep',
];

/** Retail slots published by d2emu.com (via d2r-arcane-tracker's tests), spread over four months */
const RETAIL_SLOTS: [string, string][] = [
  ['2026-07-15T00:00:00Z', 'Act1-ColdPlains'],
  ['2026-07-20T17:00:00Z', 'Act3-DuranceOfHate'],
  ['2026-08-01T03:00:00Z', 'Act2-Sewers'],
  ['2026-08-12T13:00:00Z', 'Act3-FlayerJungle'],
  ['2026-08-26T19:30:00Z', 'Act1-DarkWood'],
  ['2026-09-12T22:30:00Z', 'Act3-Travincal'],
  ['2026-09-30T01:30:00Z', 'Act5-BloodyFoothils'],
  ['2026-10-14T08:00:00Z', 'Act1-Catacombs'],
  ['2026-10-25T18:00:00Z', 'Act5-FrozenTundra'],
  ['2026-11-06T04:00:00Z', 'Act3-DuranceOfHate'],
  ['2026-11-11T21:00:00Z', 'Act1-Monastery'],
];

/** ESR 3.2.24's config: zones seen in game (ESR Docs' rules) and the owner's checks */
const ESR_SLOTS: [string, string][] = [
  ['2026-10-31T23:00:00Z', 'ESR-Zone19'],
  ['2026-11-01T00:00:00Z', 'ESR-Zone03'],
  ['2026-11-06T13:00:00Z', 'ESR-Zone21'],
  ['2026-11-06T14:00:00Z', 'ESR-Zone15'],
  ['2026-11-06T15:00:00Z', 'ESR-Zone16'],
  ['2026-11-06T16:00:00Z', 'ESR-Zone13'],
];

const bundle = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data/terrorzones.json'), 'utf-8')) as TerrorZonesBundle;

function retailRotation(): Rotation {
  return new Rotation({ start: RETAIL_START, period: 30 * 60, seed: RETAIL_SEED, zoneCount: RETAIL_ZONES.length });
}

describe('roll', () => {
  it('is the first 4 SHA-1 bytes (little endian) of uint64_le(time XOR seed) over 2^32', () => {
    const time = RETAIL_START;
    const input = Buffer.alloc(8);
    input.writeBigUInt64LE(BigInt.asUintN(64, BigInt(time) ^ RETAIL_SEED));
    const expected = createHash('sha1').update(input).digest().readUInt32LE(0) / 2 ** 32;
    expect(roll(time, RETAIL_SEED)).toBe(expected);
  });
});

describe('Rotation', () => {
  it('reproduces the retail picks ESR Docs checks (2026-07-15, 8 slots)', () => {
    const first = (toSeconds('2026-07-15T00:00:00Z') - RETAIL_START) / 1800;
    expect(retailRotation().picks(first, 8)).toEqual([2, 33, 22, 12, 28, 0, 26, 19]);
  });

  it.each(RETAIL_SLOTS)('retail %s is %s, like the game and d2emu', (utc, zoneId) => {
    const slot = (toSeconds(utc) - RETAIL_START) / 1800;
    expect(RETAIL_ZONES[retailRotation().pick(slot)]).toBe(zoneId);
  });

  it('caches: asking for a later slot extends the replay without changing earlier picks', () => {
    const rotation = retailRotation();
    const early = rotation.picks(0, 50);
    expect(rotation.computed).toBe(50);
    rotation.pick(500);
    expect(rotation.computed).toBe(501);
    expect(rotation.picks(0, 50)).toEqual(early);
    expect(retailRotation().pick(500)).toBe(rotation.pick(500));
  });

  it('never picks the same zone twice in a row', () => {
    const picks = retailRotation().picks(0, 2000);
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
  });

  it('rejects fewer than 2 zones and negative slots', () => {
    expect(() => new Rotation({ start: 0, period: 60, seed: 1n, zoneCount: 1 })).toThrow(RangeError);
    expect(() => retailRotation().pick(-1)).toThrow(RangeError);
  });
});

describe('ESR schedule (committed terrorzones.json)', () => {
  it('keeps the seed exact (it is above 2^53)', () => {
    expect(bundle.config.seed).toBe('16664395743969097666');
    expect(BigInt(bundle.config.seed) > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it.each(ESR_SLOTS)('%s is %s', (utc, zoneId) => {
    const schedule = createSchedule(bundle);
    const window = currentWindow(schedule, toSeconds(utc) + 1);
    expect(window?.zone.id).toBe(zoneId);
    expect(window?.start).toBe(toSeconds(utc));
    expect(window?.end).toBe(toSeconds(utc) + HOUR);
  });

  it('lists the upcoming windows back to back, the next starting where the current ends', () => {
    const schedule = createSchedule(bundle);
    const now = toSeconds('2026-11-06T13:20:00Z');
    const current = currentWindow(schedule, now);
    const upcoming = upcomingWindows(schedule, now, 3);
    expect(upcoming.map((window) => window.zone.id)).toEqual(['ESR-Zone15', 'ESR-Zone16', 'ESR-Zone13']);
    expect(upcoming[0]?.start).toBe(current?.end);
    expect(upcoming.map((window) => window.slot)).toEqual([1, 2, 3].map((offset) => (current?.slot ?? 0) + offset));
  });

  it('finds the next window of every group (the current one counts) within the lookahead', () => {
    const schedule = createSchedule(bundle);
    const now = toSeconds('2026-11-06T13:20:00Z');
    const next = nextWindowPerZone(schedule, now);
    expect(next).toHaveLength(bundle.zones.length);
    expect(next.every((window) => window !== null)).toBe(true);
    const zone21 = bundle.zones.findIndex((zone) => zone.id === 'ESR-Zone21');
    expect(next[zone21]?.start).toBe(toSeconds('2026-11-06T13:00:00Z'));
    const zone16 = bundle.zones.findIndex((zone) => zone.id === 'ESR-Zone16');
    expect(next[zone16]?.start).toBe(toSeconds('2026-11-06T15:00:00Z'));
    for (const window of next) expect(window === null || window.end > now).toBe(true);
  });
});

describe('schedule edges (a config with breaks, a start and an end)', () => {
  const edited: TerrorZonesBundle = {
    ...bundle,
    config: {
      start: toSeconds('2026-01-01T00:00:00Z'),
      end: toSeconds('2026-01-01T05:00:00Z'),
      seed: '12345',
      zoneMinutes: 60,
      breakMinutes: 10,
    },
  };
  const schedule = createSchedule(edited);
  const start = edited.config.start;

  it('has no current window before the start, and slot 0 next', () => {
    expect(slotIndexAt(schedule, start - 10)).toBe(-1);
    expect(currentWindow(schedule, start - 10)).toBeNull();
    expect(nextSlotIndex(schedule, start - 10_000)).toBe(0);
    expect(upcomingWindows(schedule, start - 10, 1)[0]?.start).toBe(start);
  });

  it('has no current window inside a break; slots are zone + break long', () => {
    expect(currentWindow(schedule, start + 30 * 60)?.slot).toBe(0);
    expect(currentWindow(schedule, start + 65 * 60)).toBeNull();
    expect(slotWindow(schedule, 1)?.start).toBe(start + 70 * 60);
    expect(slotWindow(schedule, 1)?.end).toBe(start + 130 * 60);
  });

  it('stops at the config end and cuts the last window there', () => {
    const windows = windowsFrom(schedule, 0, 10);
    expect(windows).toHaveLength(5);
    expect(windows.at(-1)?.end).toBeLessThanOrEqual(start + 5 * HOUR);
    expect(slotWindow(schedule, 5)).toBeNull();
  });
});

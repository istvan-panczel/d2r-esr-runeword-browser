import { describe, expect, it } from 'vitest';
import type { AreasBundle } from '../engine/schema.ts';
import { buildTerrorZonesBundle, parseDesecratedZones, utcSeconds } from './bundleTerrorZones.ts';

const LEVELS = [
  ['Name', 'Id', 'LevelName', 'LevelGroup'],
  ['Act 1 - Catacombs 1', '34', 'Catacombs Level 1', 'Act 1 - Catacombs'],
  ['Act 1 - Catacombs 2', '35', 'Catacombs Level 2', 'Act 1 - Catacombs'],
  ['Act 1 - Moo Moo Farm', '39', 'The Secret Cow Level', ''],
  ['Tier 1 Map - Chasm Prep Zone', '139', 'Chasm Prep', 'Tier 1 Map - Chasm of Horrors'],
  ['Tier 1 Map - Chasm of Horrors 1', '140', 'Chasm of Horrors Level 1', 'Tier 1 Map - Chasm of Horrors'],
]
  .map((row) => row.join('\t'))
  .join('\n');

const LEVEL_GROUPS = [
  ['LevelGroupId', 'ParentLevelGroupId', '*Name', 'NameString'],
  ['Act 1 - Catacombs', 'Act 1', 'Catacombs', 'Catacombs'],
  ['Tier 1 Map - Chasm of Horrors', '', 'Chasm of Horrors (Tier 1)', 'z02'],
]
  .map((row) => row.join('\t'))
  .join('\n');

const STRINGS = new Map([
  ['Catacombs', 'Catacombs'],
  ['z02', 'Chasm of Horrors (Tier 1)'],
  ['The Secret Cow Level', 'The Secret Cow Level'],
]);

const AREAS: AreasBundle = {
  areas: [34, 35, 39, 140].map((id) => ({
    id,
    name: id === 39 ? 'The Secret Cow Level' : id === 140 ? 'Chasm of Horrors Level 1' : `Catacombs Level ${String(id - 33)}`,
    act: 0,
    waypoint: false,
    level: null,
    density: null,
    uniques: null,
    connections: [],
    terrain: 'dungeon' as const,
  })),
  mapBosses: [],
};

const difficulty = (boost: number, xp: number) => ({
  defaults: { bound_incl_min: 3, bound_incl_max: 45, boost_level: boost, boost_experience_percent: xp },
});

function file(zones: unknown[], extra: Record<string, unknown> = {}): string {
  const config = {
    start_time_utc: '2025-12-05 00:00:00',
    end_time_utc: '',
    seed: 0,
    zone_duration_minutes: 60,
    break_duration_minutes: 0,
    game_difficulties: {
      expansion: { normal: difficulty(4, 50), nightmare: difficulty(4, 50), hell: difficulty(4, 50) },
      rotw: { normal: difficulty(2, 25), nightmare: difficulty(2, 25), hell: difficulty(2, 25) },
    },
    zones,
    ...extra,
  };
  // The real file writes the seed as a bare 64-bit number
  return `﻿${JSON.stringify({ desecrated_zones: [config] }, null, 4).replace('"seed": 0', '"seed": 16664395743969097666')}`;
}

const zone = (id: string, levels: number[]) => ({ id, levels: levels.map((level_id) => ({ level_id })) });

const build = (text: string) =>
  buildTerrorZonesBundle({
    esrVersion: '9.9.9',
    desecratedZonesText: text,
    levelsText: LEVELS,
    levelGroupsText: LEVEL_GROUPS,
    strings: STRINGS,
    areas: AREAS,
  });

describe('parseDesecratedZones', () => {
  it('keeps a 64-bit seed exact (a plain JSON.parse rounds it)', () => {
    const text = '{"desecrated_zones":[{"seed": 16664395743969097666 /* comment */}]}';
    expect(parseDesecratedZones(text)).toEqual({ desecrated_zones: [{ seed: '16664395743969097666' }] });
    expect(String(JSON.parse('16664395743969097666'))).not.toBe('16664395743969097666');
  });

  it('reads UTC times in the exact format of the file only', () => {
    expect(utcSeconds('2025-12-05 00:00:00')).toBe(Date.UTC(2025, 11, 5) / 1000);
    expect(utcSeconds('2025-12-05 13:45:07')).toBe(Date.UTC(2025, 11, 5, 13, 45, 7) / 1000);
    expect(utcSeconds('')).toBeNull();
    for (const loose of ['2025-12-05', '2025-12-05T00:00:00Z', 'Dec 5 2025', '2025-02-30 00:00:00', '2025-12-05 24:00:00'])
      expect(utcSeconds(loose), loose).toBeNull();
  });
});

describe('buildTerrorZonesBundle', () => {
  it('builds the config, the boosts and the zone groups in file order', () => {
    const { bundle, warnings, unlistedLevels } = build(file([zone('ESR-Zone03', [39, 34, 35]), zone('ESR-Zone19', [139, 140])]));
    expect(warnings).toEqual([]);
    expect(bundle.esrVersion).toBe('9.9.9');
    expect(bundle.config).toEqual({
      start: Date.UTC(2025, 11, 5) / 1000,
      end: null,
      seed: '16664395743969097666',
      zoneMinutes: 60,
      breakMinutes: 0,
    });
    expect(bundle.boosts).toHaveLength(6);
    expect(bundle.boosts[0]).toEqual({ version: 'expansion', difficulty: 0, minLevel: 3, maxLevel: 45, levelBoost: 4, xpPercent: 50 });
    expect(bundle.boosts[3]).toMatchObject({ version: 'rotw', difficulty: 0, levelBoost: 2, xpPercent: 25 });
    expect(bundle.zones.map((entry) => entry.id)).toEqual(['ESR-Zone03', 'ESR-Zone19']);
    // Level groups first (each once), then the ungrouped levels, like the game's display
    expect(bundle.zones[0]?.labels).toEqual(['Catacombs', 'The Secret Cow Level']);
    expect(bundle.zones[1]?.labels).toEqual(['Chasm of Horrors (Tier 1)']);
    // areas: the areas.json names, file order; the map entrance (139) is not an area
    expect(bundle.zones[0]?.areas.map((area) => area.name)).toEqual(['The Secret Cow Level', 'Catacombs Level 1', 'Catacombs Level 2']);
    expect(bundle.zones[1]?.areas).toEqual([{ id: 140, name: 'Chasm of Horrors Level 1' }]);
    expect(unlistedLevels).toBe(1);
  });

  it('skips a duplicate zone id like the game, and warns about unknown levels', () => {
    const { bundle, warnings } = build(file([zone('A', [34]), zone('A', [35]), zone('B', [39, 999])]));
    expect(bundle.zones.map((entry) => entry.id)).toEqual(['A', 'B']);
    expect(warnings).toEqual([
      'terrorzones: duplicate zone id A; left out like the game does',
      'terrorzones: B lists level 999, which levels.txt does not have',
    ]);
  });

  it('refuses a file the rotation cannot run on', () => {
    expect(() => build(file([zone('A', [34])]))).toThrow(/at least 2/);
    expect(() => build(file([zone('A', [34]), zone('B', [35])], { zone_duration_minutes: 0 }))).toThrow(/zone_duration_minutes/);
    expect(() => build(file([zone('A', [34]), zone('B', [35])], { start_time_utc: 'soon' }))).toThrow(/start_time_utc/);
    expect(() => build(file([zone('A', [34]), zone('B', [35])], { end_time_utc: '2026-01-01' }))).toThrow(/end_time_utc/);
  });

  it('refuses more than one config (the app schedules only the first), pointing at the update reference', () => {
    const text = file([zone('A', [34]), zone('B', [35])]);
    const parsed = parseDesecratedZones(text) as { desecrated_zones: unknown[] };
    const two = JSON.stringify({ desecrated_zones: [parsed.desecrated_zones[0], parsed.desecrated_zones[0]] });
    expect(() => build(two)).toThrow(/2 configs.*esr-update\/reference\.md/);
  });
});

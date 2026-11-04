import { describe, expect, it } from 'vitest';
import type { Area } from '../engine/schema';
import { buildAreaSections, encodeAreasState, filterAreas, matchesLevel, readAreasState } from './areas';

function area(id: number, name: string, extra: Partial<Area> = {}): Area {
  return { id, name, act: 0, waypoint: false, level: null, density: null, uniques: null, connections: [], terrain: 'outdoor', ...extra };
}

const AREAS: Area[] = [
  area(1, 'Rogue Encampment', { waypoint: true }),
  area(2, 'Blood Moor', { level: [2, 38, 68] }),
  area(40, 'Lut Gholein', { act: 1, waypoint: true }),
  area(140, 'Chasm of Horrors Level 1', { act: 4, tier: 1, group: 'Chasm of Horrors', level: [100, 100, 100] }),
  area(143, 'Crypt of Damnation', { act: 4, tier: 1, group: 'Crypt of Damnation', level: [100, 100, 100] }),
  area(141, 'Chasm of Horrors Level 2', { act: 4, tier: 1, group: 'Chasm of Horrors', level: [100, 100, 100], boss: "Diablo's Hellhound" }),
  area(213, 'The Hidden Vault', { act: 4, uniqueMap: true, group: 'Goblin Realm', level: [106, 106, 106] }),
];

describe('areas URL state', () => {
  it('round-trips search and the level bounds, dropping out-of-range values', () => {
    const state = { search: 'chasm', minLvl: 90, maxLvl: 104 };
    expect(readAreasState(encodeAreasState(state))).toEqual(state);
    expect(encodeAreasState(state).toString()).toBe('search=chasm&minlvl=90&maxlvl=104');
    expect(readAreasState(new URLSearchParams('minlvl=0&maxlvl=abc'))).toEqual({ search: '', minLvl: null, maxLvl: null });
  });
});

describe('buildAreaSections', () => {
  it('groups by act, then map tier by zone (first appearance), then unique maps', () => {
    const sections = buildAreaSections(AREAS);
    expect(sections.map((section) => section.title)).toEqual(['Act I', 'Act II', 'Maps · Tier 1', 'Unique maps']);
    const tier1 = sections[2];
    expect(tier1?.blocks.map((block) => [block.zone, block.areas.map((entry) => entry.id)])).toEqual([
      ['Chasm of Horrors', [140, 141]],
      ['Crypt of Damnation', [143]],
    ]);
    expect(sections[0]?.blocks).toEqual([{ zone: null, areas: [AREAS[0], AREAS[1]] }]);
  });
});

describe('filterAreas', () => {
  it('matches a level range on any difficulty and never matches areas without a level', () => {
    expect(matchesLevel(AREAS[1] as Area, 60, 70)).toBe(true);
    expect(matchesLevel(AREAS[1] as Area, 40, 60)).toBe(false);
    expect(matchesLevel(AREAS[0] as Area, null, 10)).toBe(false);
    expect(matchesLevel(AREAS[0] as Area, null, null)).toBe(true);
  });

  it('searches names, zones and bosses', () => {
    const ids = (search: string, minLvl: number | null = null, maxLvl: number | null = null) =>
      filterAreas(AREAS, { search, minLvl, maxLvl }).map((entry) => entry.id);
    expect(ids('hellhound')).toEqual([141]);
    expect(ids('goblin')).toEqual([213]);
    expect(ids('chasm')).toEqual([140, 141]);
    expect(ids('', 101)).toEqual([213]);
  });
});

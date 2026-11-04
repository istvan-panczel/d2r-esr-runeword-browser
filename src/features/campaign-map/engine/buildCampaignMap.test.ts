import { describe, expect, it } from 'vitest';
import type { Area } from '@/features/game-data/engine/schema';
import { buildCampaignMap, type CampaignMapData } from './buildCampaignMap';

function area(id: number, name: string, connections: number[], extra: Partial<Area> = {}): Area {
  return { id, name, act: 0, waypoint: false, level: [1, 2, 3], density: null, uniques: null, connections, terrain: 'outdoor', ...extra };
}

/** A tiny act: town 1 — field 2 (border), field 2 ↔ cave 3 (Vis), two twin tombs 4/5 off the field, 6 a one-way Vis row */
const AREAS: Area[] = [
  area(1, 'Town', [], { terrain: 'town', waypoint: true }),
  area(2, 'Field', [3, 4, 5]),
  area(3, 'Cave', [2], { terrain: 'cave' }),
  area(4, 'Tomb', [2], { terrain: 'tomb' }),
  area(5, 'Tomb', [2], { terrain: 'tomb' }),
  area(6, 'Stray', [2], { terrain: 'cave' }),
  area(10, 'Next Town', [], { act: 1, terrain: 'town' }),
  area(109, 'Harrogath', [], { act: 4, terrain: 'town' }),
  area(20, 'Map One Level 1', [21], { act: 4, tier: 1, group: 'Map One', mapItem: 'z01' }),
  area(21, 'Map One Level 2', [20], { act: 4, tier: 1, group: 'Map One', boss: 'Big Boss' }),
];

const NAMES = Object.fromEntries(AREAS.map((a) => [a.id, a.name]));

const DATA: CampaignMapData = {
  grids: [
    { key: 'act1', act: 0, grid: '1 2 3\n. 4 .\n6 . @10' },
    { key: 'act2', act: 1, grid: '10' },
    { key: 'act5', act: 4, grid: '109' },
  ],
  links: [
    { from: 1, to: 2, kind: 'border', source: 'vanilla' },
    { from: 2, to: 3, kind: 'passage', oneWay: true, via: 'one way', source: 'official', verify: true },
    { from: 3, to: 10, kind: 'act', oneWay: true, source: 'vanilla' },
  ],
  curated: { 3: { name: 'Cave', bosses: ['Corpsefire'] } },
  names: NAMES,
  sections: [
    { key: 'act1', title: 'Act I', notes: [] },
    { key: 'act2', title: 'Act II', notes: [] },
    { key: 'act5', title: 'Act V', notes: [] },
    { key: 'special', title: 'Special', notes: [] },
    { key: 'portals', title: 'Portals', notes: [] },
    { key: 'maps', title: 'Maps', notes: [] },
  ],
};

describe('buildCampaignMap', () => {
  const map = buildCampaignMap(AREAS, DATA);

  it('builds a clean map from consistent data', () => {
    expect(map.problems).toEqual([]);
  });

  it('keeps only mutual Vis links as passages and applies curated restyles', () => {
    const passages = map.edges.filter((edge) => edge.kind === 'passage');
    expect(passages.map((edge) => `${String(edge.from)}-${String(edge.to)}`)).toEqual(['2-3', '2-4', '2-5', '20-21']);
    expect(passages[0]).toMatchObject({ oneWay: true, via: 'one way', source: 'official', verify: true });
    expect(map.edges.some((edge) => edge.from === 6 || edge.to === 6)).toBe(false);
  });

  it('adds a cube edge from Harrogath to every map entry level', () => {
    expect(map.edges).toContainEqual({ from: 109, to: 20, kind: 'cube', oneWay: false, via: 'Map portal', source: 'tables' });
  });

  it('merges curated facts and table facts into the areas', () => {
    const cave = map.areas.get(3);
    expect(cave?.bosses).toEqual(['Corpsefire']);
    expect(cave?.teleport).toEqual([]);
    expect(map.areas.get(21)?.bosses).toEqual(['Big Boss']);
    expect(map.areas.get(20)?.entry).toMatch(/map item/);
    expect(map.areas.get(20)?.section).toBe('maps');
  });

  it('folds twin rows into one station', () => {
    const act1 = map.sections.find((section) => section.key === 'act1');
    const tomb = act1?.layout?.stations.find((station) => station.ids.includes(4));
    expect(tomb?.ids).toEqual([4, 5]);
    expect(tomb?.folded).toBe(true);
    expect(tomb?.label.text).toBe('Tomb ×2');
    expect(map.areas.get(5)?.twins).toEqual([4]);
    // The twin's passage is not drawn a second time
    expect(act1?.layout?.edges.filter((edge) => edge.edge.from === 2 && edge.edge.to !== 3)).toHaveLength(1);
  });

  it('draws ghosts of other tabs and the act edge to them', () => {
    const act1 = map.sections.find((section) => section.key === 'act1');
    const ghost = act1?.layout?.stations.find((station) => station.ghostOf !== undefined);
    expect(ghost).toMatchObject({ ids: [10], ghostOf: 'act2' });
    expect(ghost?.label.lines.at(-1)).toBe('→ Act II');
    expect(act1?.layout?.edges.some((edge) => edge.edge.kind === 'act')).toBe(true);
    expect(act1?.areaIds).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('lays the maps out automatically and lists portal targets by reference', () => {
    const maps = map.sections.find((section) => section.key === 'maps');
    expect(maps?.layout?.stations.map((station) => station.ids)).toEqual([[20, 21]]);
    expect(maps?.areaIds).toEqual([20, 21]);
    expect(map.sections.find((section) => section.key === 'portals')?.layout).toBeNull();
  });

  it('is deterministic', () => {
    expect(buildCampaignMap(AREAS, DATA)).toEqual(map);
  });
});

describe('buildCampaignMap problems', () => {
  it('reports new, renamed, unplaced and unknown areas without throwing', () => {
    const areas = [...AREAS.map((a) => (a.id === 3 ? { ...a, name: 'Big Cave' } : a)), area(7, 'New Dungeon', [])];
    const map = buildCampaignMap(areas, {
      ...DATA,
      grids: [{ ...DATA.grids[0], grid: '1 2 3 99\n. 4 .\n6 . @10' }, ...DATA.grids.slice(1)],
    } as CampaignMapData);
    expect(map.problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/area 3 was renamed "Cave" → "Big Cave"/),
        expect.stringMatching(/area 7 "New Dungeon" is new/),
        expect.stringMatching(/curated area 3 is named "Cave"/),
        expect.stringMatching(/grid id 99 is not in areas.json/),
        expect.stringMatching(/area 7 "New Dungeon" is not placed/),
      ])
    );
    const act1 = map.sections.find((section) => section.key === 'act1');
    expect(act1?.unplacedIds).toEqual([7]);
    expect(act1?.layout?.stations.some((station) => station.ids.includes(7))).toBe(true);
  });

  it('reports placement and link mistakes', () => {
    const data: CampaignMapData = {
      ...DATA,
      grids: [{ key: 'act1', act: 0, grid: '1 2 3 2\n. 4 6\n. . @1', routes: { '1-6': 'diagonal-first' } }, ...DATA.grids.slice(1)],
      links: [
        ...DATA.links,
        { from: 1, to: 6, kind: 'passage', oneWay: true, source: 'official' },
        { from: 1, to: 77, kind: 'portal', source: 'vanilla' },
      ],
    };
    const problems = buildCampaignMap(AREAS, data).problems.join('\n');
    expect(problems).toMatch(/area 2 "Field" is placed twice/);
    expect(problems).toMatch(/ghost @1 must point at an area drawn on another tab/);
    expect(problems).toMatch(/restyles a passage the data no longer has/);
    expect(problems).toMatch(/names 77, not in areas.json/);
    expect(problems).toMatch(/route hint "1-6"/);
  });

  it('adds a passage the tables lack when the link says so', () => {
    const data: CampaignMapData = {
      ...DATA,
      links: [...DATA.links, { from: 1, to: 6, kind: 'passage', source: 'owner', missingFromTables: true }],
    };
    const map = buildCampaignMap(AREAS, data);
    expect(map.problems.join('\n')).not.toMatch(/restyles a passage/);
    expect(map.edges).toContainEqual(expect.objectContaining({ from: 1, to: 6, kind: 'passage', source: 'owner' }));
  });

  it('reports an edge running over a station', () => {
    const data: CampaignMapData = { ...DATA, grids: [{ key: 'act1', act: 0, grid: '1 6 2 3\n. 4 .\n. . @10' }, ...DATA.grids.slice(1)] };
    expect(buildCampaignMap(AREAS, data).problems).toContainEqual(expect.stringMatching(/edge 1–2 runs over station 6/));
  });
});

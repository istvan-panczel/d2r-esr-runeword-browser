import { describe, expect, it } from 'vitest';
import { areaConnections, entryRoutes, nearestWaypoints } from './nearestWaypoint';
import { edge, mockCampaignArea, mockMap } from './testMap.mock';

const wp = { area: { waypoint: true } };

describe('nearestWaypoints', () => {
  it('is distance 0 for an area with its own waypoint', () => {
    const map = mockMap([mockCampaignArea(1, 'Town', 'act1', wp)]);
    expect(nearestWaypoints(map, 1)).toEqual({ ids: [1], distance: 0 });
  });

  it('finds every waypoint at the shortest distance', () => {
    // 1 (WP) – 2 – 4 (target) – 3 – 7 – 5 (WP, farther); 6 (WP) – 2
    const map = mockMap(
      [
        mockCampaignArea(1, 'A', 'act1', wp),
        mockCampaignArea(2, 'B'),
        mockCampaignArea(3, 'C'),
        mockCampaignArea(4, 'Target'),
        mockCampaignArea(5, 'E', 'act1', wp),
        mockCampaignArea(6, 'F', 'act1', wp),
        mockCampaignArea(7, 'G'),
      ],
      [edge(1, 2), edge(2, 4), edge(4, 3), edge(3, 7), edge(7, 5), edge(6, 2)]
    );
    expect(nearestWaypoints(map, 4)).toEqual({ ids: [1, 6], distance: 2 });
  });

  it('only walks a one-way edge in its direction', () => {
    // WP 1 → 2 one way: 2 is reachable from 1; 1 is not reachable from WP 3 through 2
    const map = mockMap(
      [mockCampaignArea(1, 'Jungle', 'act3', wp), mockCampaignArea(2, 'Sewers 1', 'act3'), mockCampaignArea(3, 'Bazaar', 'act3', wp)],
      [edge(1, 2, { oneWay: true }), edge(2, 3)]
    );
    expect(nearestWaypoints(map, 2)).toEqual({ ids: [1, 3], distance: 1 });
    const back = mockMap(
      [mockCampaignArea(1, 'Jungle', 'act3'), mockCampaignArea(2, 'Sewers 1', 'act3'), mockCampaignArea(3, 'Bazaar', 'act3', wp)],
      [edge(1, 2, { oneWay: true }), edge(2, 3)]
    );
    expect(nearestWaypoints(back, 1)).toBeNull();
  });

  it("ignores edges leaving the area's section and act travel", () => {
    const map = mockMap(
      [mockCampaignArea(1, 'Harrogath', 'act5', wp), mockCampaignArea(2, 'Map L1', 'maps'), mockCampaignArea(3, 'Map L2', 'maps')],
      [edge(1, 2, { kind: 'cube', oneWay: true }), edge(2, 3)]
    );
    expect(nearestWaypoints(map, 3)).toBeNull();
    const act = mockMap([mockCampaignArea(1, 'A', 'act1', wp), mockCampaignArea(2, 'B', 'act1')], [edge(1, 2, { kind: 'act' })]);
    expect(nearestWaypoints(act, 2)).toBeNull();
  });

  it('is null for an unknown area', () => {
    expect(nearestWaypoints(mockMap([]), 9)).toBeNull();
  });
});

describe('areaConnections', () => {
  it('lists both ends with the direction of one-way edges', () => {
    const edges = [edge(1, 2), edge(2, 3, { oneWay: true }), edge(4, 2, { oneWay: true }), edge(2, 2)];
    expect(areaConnections(edges, 2).map(({ id, direction }) => [id, direction])).toEqual([
      [1, 'both'],
      [3, 'out'],
      [4, 'in'],
    ]);
  });
});

it('entryRoutes keeps the portal and cube edges into the area', () => {
  const edges = [edge(1, 2), edge(3, 2, { kind: 'cube', via: 'Club + Tome' }), edge(2, 5, { kind: 'portal' })];
  expect(entryRoutes(edges, 2).map((e) => e.via)).toEqual(['Club + Tome']);
});

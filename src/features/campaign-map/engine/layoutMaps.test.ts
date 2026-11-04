import { describe, expect, it } from 'vitest';
import type { Area } from '@/features/game-data/engine/schema';
import { layoutMapsBoard } from './layoutMaps';
import type { CampaignEdge } from './types';

function map(id: number, name: string, tier: number | undefined, group: string, extra: Partial<Area> = {}): Area {
  return {
    id,
    name,
    act: 4,
    tier,
    group,
    waypoint: false,
    level: [100, 100, 100],
    density: null,
    uniques: null,
    connections: [],
    terrain: 'cave',
    ...extra,
  };
}

const passage = (from: number, to: number): CampaignEdge => ({ from, to, kind: 'passage', oneWay: false, source: 'tables' });

const AREAS: Area[] = [
  // Tier 2: a fork (root 10 → wings 11→12 and 13)
  map(10, 'Eye', 2, 'Eye', { mapItem: 'z17' }),
  map(11, 'Wing Level 1', 2, 'Eye'),
  map(12, 'Wing Level 2', 2, 'Eye', { boss: 'B' }),
  map(13, 'Side', 2, 'Eye'),
  // Tier 1: a chain, entered at its map item level
  map(1, 'Chasm Level 1', 1, 'Chasm', { mapItem: 'z02' }),
  map(2, 'Chasm Level 2', 1, 'Chasm'),
  // Unique map
  map(30, 'Vault', undefined, 'Vault', { uniqueMap: true, mapItem: 'z99' }),
];
const EDGES = [passage(1, 2), passage(10, 11), passage(11, 12), passage(10, 13)];

describe('layoutMapsBoard', () => {
  const board = layoutMapsBoard(AREAS, EDGES, (id) => AREAS.find((a) => a.id === id)?.name ?? '');

  it('orders tiers, then the unique map, and walks each zone from its entry level', () => {
    expect(board.order).toEqual([1, 2, 10, 11, 12, 13, 30]);
    expect(board.layout.regions.map((region) => region.label)).toEqual(['Tier 1', 'Tier 2', 'Unique map']);
  });

  it('draws a chain as one stack and a fork as branches one row down', () => {
    const stations = board.layout.stations;
    expect(stations.map((station) => station.ids)).toEqual([[1, 2], [10], [11, 12], [13], [30]]);
    expect(stations[0]?.label.text).toBe('Chasm');
    const [root, wing, side] = [stations[1], stations[2], stations[3]];
    expect(wing?.dots[0]?.y).toBeGreaterThan(root?.dots[0]?.y ?? 0);
    expect(side?.dots[0]?.y).toBe(wing?.dots[0]?.y);
    expect(side?.dots[0]?.x).toBeGreaterThan(wing?.dots[0]?.x ?? 0);
    expect(board.layout.edges.map((edge) => `${String(edge.edge.from)}-${String(edge.edge.to)}`)).toEqual(['10-11', '10-13']);
  });

  it('stays within the canvas width', () => {
    expect(board.layout.width).toBeLessThanOrEqual(880);
    for (const station of board.layout.stations) for (const dot of station.dots) expect(dot.x).toBeLessThan(board.layout.width);
  });
});

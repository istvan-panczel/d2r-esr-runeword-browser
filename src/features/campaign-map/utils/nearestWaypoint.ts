/**
 * "Getting there" helpers of the detail panel: the nearest waypoint(s) and an area's connections. Pure.
 */
import type { CampaignArea, CampaignEdge, CampaignMap } from '../engine/types';

export interface NearestWaypoints {
  /** Waypoint areas at the shortest distance, in the order found (edge order) */
  readonly ids: readonly number[];
  /** Areas to cross after the waypoint: 0 when the area has its own waypoint */
  readonly distance: number;
}

/**
 * The waypoints closest to `targetId`: a breadth-first walk backwards over the edges of the area's own section (both
 * ends in that section; act travel left out), so a one-way edge only counts in its direction (you walk from the
 * waypoint to the area). Null when no waypoint leads there (endgame maps, portal-only areas).
 */
export function nearestWaypoints(map: Pick<CampaignMap, 'areas' | 'edges'>, targetId: number): NearestWaypoints | null {
  const target = map.areas.get(targetId);
  if (target === undefined) return null;
  if (target.area.waypoint) return { ids: [targetId], distance: 0 };

  const inSection = (id: number) => map.areas.get(id)?.section === target.section;
  /** to → the areas you can step from into it */
  const incoming = new Map<number, number[]>();
  const add = (from: number, to: number) => {
    const list = incoming.get(to);
    if (list === undefined) incoming.set(to, [from]);
    else list.push(from);
  };
  for (const edge of map.edges) {
    if (edge.kind === 'act' || !inSection(edge.from) || !inSection(edge.to)) continue;
    add(edge.from, edge.to);
    if (!edge.oneWay) add(edge.to, edge.from);
  }

  const seen = new Set<number>([targetId]);
  let frontier = [targetId];
  for (let distance = 1; frontier.length > 0; distance++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const from of incoming.get(id) ?? []) {
        if (seen.has(from)) continue;
        seen.add(from);
        next.push(from);
      }
    }
    const waypoints = next.filter((id) => map.areas.get(id)?.area.waypoint === true);
    if (waypoints.length > 0) return { ids: waypoints, distance };
    frontier = next;
  }
  return null;
}

export type ConnectionDirection = 'both' | 'out' | 'in';

export interface AreaConnection {
  /** The other area */
  readonly id: number;
  readonly edge: CampaignEdge;
  /** both: a two-way edge; out: one way from this area; in: one way into it */
  readonly direction: ConnectionDirection;
}

/** Every edge touching the area, one entry per other area and edge, in edge order (self loops left out) */
export function areaConnections(edges: readonly CampaignEdge[], id: number): AreaConnection[] {
  const connections: AreaConnection[] = [];
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    if (edge.from === id) connections.push({ id: edge.to, edge, direction: edge.oneWay ? 'out' : 'both' });
    else if (edge.to === id) connections.push({ id: edge.from, edge, direction: edge.oneWay ? 'in' : 'both' });
  }
  return connections;
}

/** "Areas you reach by a portal": the via labels of the cube and portal edges into an area ("Club + Tome of Town Portal") */
export function entryRoutes(edges: readonly CampaignEdge[], id: number): CampaignEdge[] {
  return edges.filter((edge) => edge.to === id && (edge.kind === 'cube' || edge.kind === 'portal'));
}

/** Display name of an area id (the id itself when unknown) */
export function areaName(areas: ReadonlyMap<number, CampaignArea>, id: number): string {
  return areas.get(id)?.name ?? `Area ${String(id)}`;
}

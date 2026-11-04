/**
 * Geometry of one hand-placed act section: grid cells → stations (plain, stack, folded twins, ghosts), the "unplaced"
 * strip, edges routed octilinearly between dots, regions and labels. Pure and deterministic.
 */
import type { ActGrid } from '../data/types';
import {
  CELL_H,
  CELL_W,
  DOT_R,
  LABEL_MAX_CHARS,
  MARGIN_X,
  MARGIN_Y,
  MAX_COLUMNS,
  STACK_PITCH,
  cellX,
  cellY,
  distanceToSegment,
  memberLabelBoxes,
  pathData,
  placeLabel,
  regionCaptionBox,
  route,
  round,
  segmentsOf,
  viaLabelPoint,
  type Box,
  type RouteMode,
  type Segment,
} from './geometry';
import type { GridCellKind } from './grid';
import { wrapLabel } from './text';
import type { CampaignEdge, CampaignSectionKey, MapEdge, MapRegion, MapStation, Point, SectionLayout } from './types';

/** A grid cell resolved against the data: ids known to exist, twins already expanded */
export interface ResolvedCell {
  readonly col: number;
  readonly row: number;
  readonly kind: GridCellKind;
  readonly ids: readonly number[];
  /** Twin rows drawn as one dot */
  readonly folded: boolean;
  /** Label text (stack: shared name; folded: "Name ×7"; ghost: the area's name) */
  readonly text: string;
  /** Ghost: the section the area is drawn in, and that section's title */
  readonly ghostOf?: { readonly key: CampaignSectionKey; readonly title: string };
}

export interface GridLayoutInput {
  readonly grid: ActGrid;
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly ResolvedCell[];
  /** Areas of the section missing from the grid, with their label text */
  readonly unplaced: readonly { readonly id: number; readonly text: string }[];
  /** Every edge of the map; the ones with both ends in this section are drawn */
  readonly edges: readonly CampaignEdge[];
}

interface Node {
  readonly cell: ResolvedCell;
  readonly dots: Point[];
}

/** Rows a stack's dots and label reach below its cell (other cells there would collide) */
function extraRows(cell: ResolvedCell): number {
  if (cell.kind !== 'stack') return 0;
  return Math.floor(((cell.ids.length - 1) * STACK_PITCH + 30) / CELL_H);
}

function dotsOf(cell: ResolvedCell, x: number, y: number): Point[] {
  if (cell.kind !== 'stack' || cell.folded) return cell.ids.map(() => ({ x, y }));
  return cell.ids.map((_, i) => ({ x, y: y + i * STACK_PITCH }));
}

export function layoutGridSection(input: GridLayoutInput): { layout: SectionLayout; problems: string[] } {
  const { grid } = input;
  const problems: string[] = [];
  const problem = (text: string) => problems.push(`${grid.key}: ${text}`);

  // --- stations --------------------------------------------------------------------------------------------------
  const occupied = new Map<string, string>();
  const nodes: Node[] = [];
  for (const cell of input.cells) {
    const label = cell.ids.join('+');
    for (let r = 0; r <= extraRows(cell); r++) {
      const key = `${String(cell.col)},${String(cell.row + r)}`;
      const owner = occupied.get(key);
      if (owner !== undefined) problem(`${label} at column ${String(cell.col)}, row ${String(cell.row)} overlaps ${owner}`);
      occupied.set(key, label);
    }
    if (cell.col >= MAX_COLUMNS) problem(`${label} is in column ${String(cell.col)}: at most ${String(MAX_COLUMNS)} columns fit`);
    nodes.push({ cell, dots: dotsOf(cell, cellX(cell.col), cellY(cell.row)) });
  }
  const stripRow = input.rows + 1;
  input.unplaced.forEach(({ id, text }, i) => {
    const cell: ResolvedCell = {
      col: i % MAX_COLUMNS,
      row: stripRow + Math.floor(i / MAX_COLUMNS),
      kind: 'station',
      ids: [id],
      folded: false,
      text,
    };
    nodes.push({ cell, dots: dotsOf(cell, cellX(cell.col), cellY(cell.row)) });
  });

  // id → its dot (real stations first, then ghosts)
  const real = new Map<number, { node: Node; dot: Point }>();
  const ghosts = new Map<number, { node: Node; dot: Point }>();
  for (const node of nodes) {
    node.cell.ids.forEach((id, i) => {
      const dot = node.dots.at(i);
      if (dot === undefined) return;
      (node.cell.kind === 'ghost' ? ghosts : real).set(id, { node, dot });
    });
  }

  // --- edges -----------------------------------------------------------------------------------------------------
  const usedHints = new Set<string>();
  const drawn = new Set<string>();
  const edges: { edge: CampaignEdge; points: Point[]; ends: readonly Node[] }[] = [];
  for (const edge of input.edges) {
    const from = real.get(edge.from) ?? ghosts.get(edge.from);
    const to = real.get(edge.to) ?? ghosts.get(edge.to);
    if (from === undefined || to === undefined) continue;
    if (from.node === to.node) continue; // inside a stack (the pill shows it) or between folded twins
    if (from.node.cell.kind === 'ghost' && to.node.cell.kind === 'ghost') continue;
    const key = [from.dot, to.dot]
      .map((p) => `${String(p.x)},${String(p.y)}`)
      .sort()
      .join('|');
    if (drawn.has(key)) continue; // a twin of an edge already drawn
    drawn.add(key);
    const forward = `${String(edge.from)}-${String(edge.to)}`;
    const backward = `${String(edge.to)}-${String(edge.from)}`;
    const hints = grid.routes ?? {};
    let points: Point[];
    if (forward in hints) {
      usedHints.add(forward);
      points = route(from.dot, to.dot, hints[forward]);
    } else if (backward in hints) {
      usedHints.add(backward);
      points = route(to.dot, from.dot, hints[backward]).reverse();
    } else points = route(from.dot, to.dot, 'straight-first' satisfies RouteMode);
    edges.push({ edge, points, ends: [from.node, to.node] });
  }
  for (const key of Object.keys(grid.routes ?? {})) if (!usedHints.has(key)) problem(`route hint "${key}" matches no drawn edge`);

  // An edge must not run over a station that is not one of its ends
  for (const { edge, points, ends } of edges) {
    for (const node of nodes) {
      if (ends.includes(node)) continue;
      const hit = segmentsOf(points).some((segment) => node.dots.some((dot) => distanceToSegment(dot, segment) < DOT_R + 2));
      if (hit) problem(`edge ${String(edge.from)}–${String(edge.to)} runs over station ${node.cell.ids.join('+')}`);
    }
  }

  // --- size ------------------------------------------------------------------------------------------------------
  const maxCol = Math.max(input.cols - 1, ...nodes.map((node) => node.cell.col));
  const width = MARGIN_X * 2 + maxCol * CELL_W;

  // --- labels ----------------------------------------------------------------------------------------------------
  const regions: MapRegion[] = (grid.regions ?? []).map(({ label, from, to }) => ({
    label,
    x: round(cellX(from[0])),
    y: round(cellY(from[1])),
    width: round((to[0] - from[0]) * CELL_W),
    height: round((to[1] - from[1]) * CELL_H),
  }));

  const segments: Segment[] = edges.flatMap(({ points }) => segmentsOf(points));
  const allDots = nodes.flatMap((node) => node.dots);
  const boxes: Box[] = [
    ...regions.map(regionCaptionBox),
    ...nodes.flatMap((node) => (node.cell.kind === 'stack' && !node.cell.folded ? memberLabelBoxes(node.dots) : [])),
  ];
  const stations: MapStation[] = nodes.map((node) => {
    const { cell } = node;
    const lines = wrapLabel(cell.text, LABEL_MAX_CHARS);
    if (cell.ghostOf !== undefined) lines.push(`→ ${cell.ghostOf.title}`);
    const box = placeLabel(node.dots, lines, { segments, dots: allDots, boxes, width }, cell.kind === 'stack' && !cell.folded);
    boxes.push(box);
    return {
      ids: cell.ids,
      dots: node.dots,
      label: { x: round(box.x + box.w / 2), y: box.y, text: cell.text, lines },
      ...(cell.ghostOf === undefined ? {} : { ghostOf: cell.ghostOf.key }),
      ...(cell.folded ? { folded: true as const } : {}),
    };
  });

  const bottom = Math.max(
    0,
    ...allDots.map((dot) => dot.y + DOT_R),
    ...boxes.map((box) => box.y + box.h),
    ...regions.map((region) => region.y + region.height)
  );
  const mapEdges: MapEdge[] = edges.map(({ edge, points }) => {
    const at = edge.via === undefined ? undefined : viaLabelPoint(points, edge.via);
    return { edge, path: pathData(points), ...(at === undefined ? {} : { labelAt: at }) };
  });
  return { layout: { width, height: Math.ceil(bottom + MARGIN_Y / 2), stations, edges: mapEdges, regions }, problems };
}

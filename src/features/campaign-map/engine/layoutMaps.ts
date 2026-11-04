/**
 * The Endgame Maps board, laid out automatically (nothing authored, so new maps appear by themselves): one band per
 * tier (the unique map last), the tier's zones left to right, each zone as a tree of its levels from the entry level.
 * A run of single levels is one stack ("Endless Abyss" L1–L10); a fork puts its branches side by side one row down
 * (Eye of the Storm → three wings). Pure and deterministic.
 */
import type { Area } from '@/features/game-data/engine/schema';
import {
  CELL_W,
  DOT_R,
  LABEL_GAP,
  LABEL_LINE,
  LABEL_MAX_CHARS,
  MARGIN_X,
  MARGIN_Y,
  MAX_COLUMNS,
  STACK_PITCH,
  cellX,
  memberLabelBoxes,
  pathData,
  placeLabel,
  regionCaptionBox,
  round,
  segmentsOf,
  viaLabelPoint,
  type Box,
  type Segment,
} from './geometry';
import { baseName, wrapLabel } from './text';
import type { CampaignEdge, MapEdge, MapRegion, MapStation, Point, SectionLayout } from './types';

/** Height of a band's caption above its first row */
const BAND_CAPTION = 24;
const BAND_GAP = 14;
const ROW_GAP = 22;

interface Block {
  /** Area ids of a run of single levels, top to bottom */
  readonly ids: number[];
  readonly children: Block[];
}

interface PlacedBlock {
  readonly block: Block;
  readonly dots: Point[];
  readonly lines: string[];
  readonly text: string;
}

/** Mutual Vis neighbours inside the same zone */
type Neighbours = (id: number) => readonly number[];

function buildBlock(start: number, neighbours: Neighbours, seen: Set<number>): Block {
  const ids = [start];
  seen.add(start);
  let current = start;
  for (;;) {
    const next = neighbours(current).filter((id) => !seen.has(id));
    if (next.length !== 1) {
      next.forEach((id) => seen.add(id));
      return { ids, children: next.map((id) => buildBlock(id, neighbours, seen)) };
    }
    const only = next.at(0);
    if (only === undefined) return { ids, children: [] };
    ids.push(only);
    seen.add(only);
    current = only;
  }
}

const blockWidth = (block: Block): number =>
  Math.max(
    1,
    block.children.reduce((sum, child) => sum + blockWidth(child), 0)
  );

export interface MapsBoard {
  readonly layout: SectionLayout;
  /** Area ids in board order (tier, zone, level tree) */
  readonly order: readonly number[];
}

/**
 * @param areas the map areas (tiered maps and the unique map), any order
 * @param edges every edge of the campaign map; the passages between drawn levels are drawn
 * @param nameOf display name of an area
 */
export function layoutMapsBoard(areas: readonly Area[], edges: readonly CampaignEdge[], nameOf: (id: number) => string): MapsBoard {
  const ids = new Set(areas.map((area) => area.id));
  const byId = new Map(areas.map((area) => [area.id, area]));
  const zoneOf = (area: Area) => `${String(area.tier ?? 'unique')}|${area.group ?? area.name}`;
  const passages = new Map<number, number[]>();
  for (const edge of edges) {
    if (edge.kind !== 'passage' || !ids.has(edge.from) || !ids.has(edge.to)) continue;
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (a === undefined || b === undefined || zoneOf(a) !== zoneOf(b)) continue;
    passages.set(edge.from, [...(passages.get(edge.from) ?? []), edge.to]);
    passages.set(edge.to, [...(passages.get(edge.to) ?? []), edge.from]);
  }
  const neighbours: Neighbours = (id) => [...(passages.get(id) ?? [])].sort((a, b) => a - b);

  // Tiers (unique map last), zones in id order, roots: the map item's entry level first
  const tiers = [...new Set(areas.map((area) => area.tier ?? Number.POSITIVE_INFINITY))].sort((a, b) => a - b);
  const width = MARGIN_X * 2 + (MAX_COLUMNS - 1) * CELL_W;
  const placed: PlacedBlock[] = [];
  const regions: MapRegion[] = [];
  const order: number[] = [];
  const drawnEdges: { edge: CampaignEdge; points: Point[] }[] = [];
  let top = MARGIN_Y / 2;

  for (const tier of tiers) {
    const inTier = areas.filter((area) => (area.tier ?? Number.POSITIVE_INFINITY) === tier).sort((a, b) => a.id - b.id);
    const zones = [...new Set(inTier.map(zoneOf))];
    const trees: Block[] = [];
    for (const zone of zones) {
      const members = inTier.filter((area) => zoneOf(area) === zone);
      const seen = new Set<number>();
      const starts = [...members.filter((area) => area.mapItem !== undefined), ...members];
      for (const area of starts) if (!seen.has(area.id)) trees.push(buildBlock(area.id, neighbours, seen));
    }

    // A zone's level tree: each block below its parent, siblings side by side (independent of the other zones)
    const placeBlock = (block: Block, blockCol: number, blockTop: number, parent: PlacedBlock | undefined): number => {
      const x = cellX(blockCol);
      const y = blockTop + DOT_R + 2;
      const names = block.ids.map(nameOf);
      const text = block.ids.length > 1 ? baseName(names[0] ?? '') : (names[0] ?? '');
      const lines = wrapLabel(text, LABEL_MAX_CHARS);
      const dots = block.ids.map((_, i) => ({ x, y: y + i * STACK_PITCH }));
      const entry: PlacedBlock = { block, dots, lines, text };
      placed.push(entry);
      order.push(...block.ids);
      const first = dots[0] ?? { x, y };
      const last = dots[dots.length - 1] ?? first;
      if (parent !== undefined) {
        const from = parent.dots[parent.dots.length - 1] ?? first;
        const fromId = parent.block.ids[parent.block.ids.length - 1];
        const toId = block.ids[0];
        const edge = edges.find(
          (e) => e.kind === 'passage' && ((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))
        );
        if (edge !== undefined) {
          const midY = first.y - ROW_GAP / 2 - DOT_R;
          drawnEdges.push({
            edge,
            points: from.x === first.x ? [from, first] : [from, { x: from.x, y: midY }, { x: first.x, y: midY }, first],
          });
        }
      }
      const ownBottom = last.y + DOT_R + LABEL_GAP + lines.length * LABEL_LINE;
      let bottom = ownBottom;
      let childCol = blockCol;
      for (const child of block.children) {
        bottom = Math.max(bottom, placeBlock(child, childCol, ownBottom + ROW_GAP, entry));
        childCol += blockWidth(child);
      }
      return bottom;
    };

    // Zones left to right, wrapping onto a new line after MAX_COLUMNS
    const bandTop = top;
    let lineTop = top + BAND_CAPTION;
    let lineBottom = lineTop;
    let col = 0;
    for (const tree of trees) {
      const treeWidth = blockWidth(tree);
      if (col > 0 && col + treeWidth > MAX_COLUMNS) {
        lineTop = lineBottom + ROW_GAP;
        col = 0;
      }
      lineBottom = Math.max(lineBottom, placeBlock(tree, col, lineTop, undefined));
      col += treeWidth;
    }
    const bottom = lineBottom + 6;
    regions.push({
      label: Number.isFinite(tier) ? `Tier ${String(tier)}` : 'Unique map',
      x: round(MARGIN_X - CELL_W / 2 + 4),
      y: round(bandTop),
      width: round(MAX_COLUMNS * CELL_W - 8),
      height: round(bottom - bandTop),
    });
    top = bottom + BAND_GAP;
  }

  // Labels (stacks below; a fork's root moves aside of its trunk)
  const segments: Segment[] = drawnEdges.flatMap(({ points }) => segmentsOf(points));
  const allDots = placed.flatMap((p) => p.dots);
  const boxes: Box[] = [...regions.map(regionCaptionBox), ...placed.flatMap((p) => (p.dots.length > 1 ? memberLabelBoxes(p.dots) : []))];
  const stations: MapStation[] = placed.map((p) => {
    const box = placeLabel(p.dots, p.lines, { segments, dots: allDots, boxes, width }, p.dots.length > 1);
    boxes.push(box);
    return { ids: p.block.ids, dots: p.dots, label: { x: round(box.x + box.w / 2), y: box.y, text: p.text, lines: p.lines } };
  });
  const mapEdges: MapEdge[] = drawnEdges.map(({ edge, points }) => {
    const at = edge.via === undefined ? undefined : viaLabelPoint(points, edge.via);
    return { edge, path: pathData(points), ...(at === undefined ? {} : { labelAt: at }) };
  });
  const height = Math.ceil(Math.max(top - BAND_GAP, ...boxes.map((box) => box.y + box.h)) + MARGIN_Y / 2);
  // Areas that ended up in no tree (cannot happen: every member starts a tree when unseen) are still listed
  for (const area of areas) if (!order.includes(area.id)) order.push(area.id);
  return { layout: { width, height, stations, edges: mapEdges, regions }, order };
}

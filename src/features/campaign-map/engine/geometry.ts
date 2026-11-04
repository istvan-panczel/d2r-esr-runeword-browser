/**
 * Geometry of the campaign map in SVG user units (drawn about 1:1 on the ~880 px canvas): grid pitch, octilinear edge
 * routing, label boxes and the label placer. Pure and deterministic.
 */
import type { MapRegion, Point } from './types';

/** Column pitch: 7 columns fit 868 units */
export const CELL_W = 124;
export const CELL_H = 88;
export const MARGIN_X = 62;
export const MARGIN_Y = 44;
/** Distance between the dots of a dungeon stack */
export const STACK_PITCH = 22;
export const DOT_R = 6;
export const LABEL_FONT = 11.5;
export const LABEL_LINE = 14;
/** Estimated average character width of a label (about 0.55 em) */
export const LABEL_CHAR_W = 6.3;
export const LABEL_MAX_CHARS = 17;
/** Free space between a dot's rim and its label */
export const LABEL_GAP = 4;
/** Stack member labels ("L1") sit right of each dot */
export const MEMBER_LABEL_FONT = 9.5;
export const MEMBER_LABEL_DX = DOT_R + 4;
const MEMBER_LABEL_W = 18;
/** The canvas is never drawn wider than this (the Standard page leaves ~880 px next to the detail panel) */
export const MAX_COLUMNS = 7;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type Segment = readonly [Point, Point];

export const round = (value: number) => Math.round(value * 10) / 10;

export const cellX = (col: number) => MARGIN_X + col * CELL_W;
export const cellY = (row: number) => MARGIN_Y + row * CELL_H;

export type RouteMode = 'straight-first' | 'diagonal-first';

/**
 * Octilinear polyline a → b: a horizontal or vertical segment and a 45° segment ('straight-first' starts with the
 * straight one). Aligned or exactly diagonal points give one segment.
 */
export function route(a: Point, b: Point, mode: RouteMode = 'straight-first'): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 0.5 || ady < 0.5 || Math.abs(adx - ady) < 0.5) return [a, b];
  const d = Math.min(adx, ady);
  const diagX = Math.sign(dx) * d;
  const diagY = Math.sign(dy) * d;
  const mid = mode === 'diagonal-first' ? { x: a.x + diagX, y: a.y + diagY } : { x: b.x - diagX, y: b.y - diagY };
  return [a, mid, b];
}

export function pathData(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${String(round(p.x))} ${String(round(p.y))}`).join(' ');
}

export function segmentsOf(points: readonly Point[]): Segment[] {
  return points.slice(1).flatMap((p, i) => {
    const prev = points.at(i);
    return prev === undefined ? [] : [[prev, p] as const];
  });
}

/** Via labels on edges: font size and estimated character width */
export const VIA_FONT = 9.5;
const VIA_CHAR_W = 5.3;

/**
 * Where an edge's `via` text goes (centre of its baseline), or undefined when no segment is long enough to carry it
 * without running into the stations: beside a vertical or diagonal segment, above a horizontal one.
 */
export function viaLabelPoint(points: readonly Point[], text: string): Point | undefined {
  const textW = text.length * VIA_CHAR_W;
  const segments = segmentsOf(points).sort(
    (a, b) => Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y) - Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y)
  );
  for (const [a, b] of segments) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (Math.abs(dy) < 0.5) {
      if (length >= textW + 40) return { x: round(midX), y: round(midY - 5) };
    } else if (Math.abs(dx) < 0.5) {
      if (length >= 44) return { x: round(midX + textW / 2 + 6), y: round(midY + 3) };
    } else if (length >= textW * 0.9 + 24) {
      // "/" (going up to the right): text on the left of the line; "\": on the right
      const side = Math.sign(dx) === Math.sign(dy) ? 1 : -1;
      return { x: round(midX + side * (textW / 2 + 5)), y: round(midY + 3) };
    }
  }
  return undefined;
}

export function distanceToSegment(p: Point, [a, b]: Segment): number {
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / lengthSq));
  return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

/** Liang–Barsky: does the segment cross the box (or lie inside it)? */
export function segmentHitsBox([a, b]: Segment, box: Box): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.w - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.h - a.y],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function circleHitsBox(c: Point, r: number, box: Box): boolean {
  const nx = Math.max(box.x, Math.min(c.x, box.x + box.w));
  const ny = Math.max(box.y, Math.min(c.y, box.y + box.h));
  return Math.hypot(c.x - nx, c.y - ny) < r;
}

/** A region's caption sits inside its top-left corner (small caps, ~7 units per character) */
export const REGION_CAPTION_DX = 10;
export const REGION_CAPTION_DY = 8;

export function regionCaptionBox(region: MapRegion): Box {
  return { x: region.x + REGION_CAPTION_DX - 2, y: region.y + REGION_CAPTION_DY - 2, w: region.label.length * 7 + 4, h: 14 };
}

export function labelSize(lines: readonly string[]): { w: number; h: number } {
  return { w: Math.max(0, ...lines.map((line) => line.length)) * LABEL_CHAR_W, h: lines.length * LABEL_LINE };
}

/** Boxes of a stack's member labels ("L1"…) right of each dot: obstacles for other labels */
export function memberLabelBoxes(dots: readonly Point[]): Box[] {
  return dots.map((dot) => ({ x: dot.x + MEMBER_LABEL_DX - 1, y: dot.y - 6, w: MEMBER_LABEL_W, h: 12 }));
}

export interface LabelObstacles {
  readonly segments: readonly Segment[];
  readonly dots: readonly Point[];
  readonly boxes: readonly Box[];
  /** Canvas width: labels must stay inside [0, width] */
  readonly width: number;
}

/**
 * Pick the label box of a station: the first candidate (below, right, above, left, then the four corners) that crosses
 * no edge, dot, other label or the canvas side; else the one with the fewest conflicts. `dots` are the station's own
 * dots (top to bottom). Stacks never take the right side (their member labels are there).
 */
export function placeLabel(dots: readonly Point[], lines: readonly string[], obstacles: LabelObstacles, isStack: boolean): Box {
  const first = dots[0] ?? { x: 0, y: 0 };
  const last = dots[dots.length - 1] ?? first;
  const cx = first.x;
  const cy = (first.y + last.y) / 2;
  const { w, h } = labelSize(lines);
  const r = DOT_R;
  const below = last.y + r + LABEL_GAP;
  const above = first.y - r - LABEL_GAP - h;
  const candidates: Box[] = [
    { x: cx - w / 2, y: below, w, h },
    ...(isStack ? [] : [{ x: cx + r + LABEL_GAP + 2, y: cy - h / 2, w, h }]),
    { x: cx - w / 2, y: above, w, h },
    { x: cx - r - LABEL_GAP - 2 - w, y: cy - h / 2, w, h },
    { x: cx + 3 + (isStack ? MEMBER_LABEL_W : 0), y: below - 2, w, h },
    { x: cx - 3 - w, y: below - 2, w, h },
    { x: cx + 3 + (isStack ? MEMBER_LABEL_W : 0), y: above + 2, w, h },
    { x: cx - 3 - w, y: above + 2, w, h },
  ];
  const own = new Set(dots);
  let best = candidates[0] ?? { x: cx, y: below, w, h };
  let bestScore = Number.POSITIVE_INFINITY;
  for (const box of candidates) {
    const padded = { x: box.x - 1, y: box.y - 1, w: box.w + 2, h: box.h + 2 };
    let score = 0;
    if (box.x < 2 || box.x + box.w > obstacles.width - 2 || box.y < 2) score += 10;
    for (const segment of obstacles.segments) if (segmentHitsBox(segment, padded)) score += 1;
    for (const dot of obstacles.dots) if (!own.has(dot) && circleHitsBox(dot, r + 2, padded)) score += 2;
    for (const dot of dots) if (circleHitsBox(dot, r + 1, padded)) score += 2;
    for (const other of obstacles.boxes) if (boxesOverlap(other, padded)) score += 3;
    if (score < bestScore) {
      best = box;
      bestScore = score;
      if (score === 0) break;
    }
  }
  return { x: round(best.x), y: round(best.y), w: round(best.w), h: round(best.h) };
}

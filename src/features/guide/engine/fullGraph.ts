/**
 * NOT USED (kept on purpose, 2026-11-07): the full map is no longer routed (`/guide/map` redirects to the `/guide`
 * overview); this layout, components/FullGraph.tsx and screens/GuideMapScreen.tsx stay so it can come back.
 *
 * Layout of the full guide map (`/guide/map`, desktop only): every note as a node, every knowFirst / related / next
 * connection as an edge, placed by a d3-force simulation that is run to completion synchronously.
 *
 * Deterministic: the initial placement is computed from the spine (one column per step, notes in spine order; off-spine
 * notes start beside the notes they connect to), the simulation's random source is a seeded LCG, and the tick count is
 * fixed, so the same bundle and box size always give the same picture. Unit-tested in fullGraph.test.ts.
 *
 * Shared code: relative `.ts` imports only, no DOM.
 */
import { forceLink, forceManyBody, forceSimulation, forceX, forceY, type Force, type SimulationNodeDatum } from 'd3-force';
import { labelWidth, truncateLabel } from './localGraph.ts';
import type { GuideBundle } from './schema.ts';

export type FullGraphEdgeKind = 'knowFirst' | 'related' | 'next';

export interface FullGraphNode {
  readonly slug: string;
  readonly title: string;
  /** Title truncated to FULL_GRAPH_LABEL_MAX_CHARS (the full title goes in the SVG `<title>`) */
  readonly label: string;
  /** 0-based spine step, or null for an off-spine note */
  readonly step: number | null;
  readonly x: number;
  readonly y: number;
}

/** Directed like the local graph: a knowFirst edge points at the note that needs it; related and next point away. */
export interface FullGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: FullGraphEdgeKind;
}

export interface FullGraphLayout {
  readonly nodes: FullGraphNode[];
  readonly edges: FullGraphEdge[];
}

export interface FullGraphSize {
  readonly width: number;
  readonly height: number;
  /** Label font size in the same units as width/height (default 12) */
  readonly fontSize?: number;
}

export const FULL_GRAPH_NODE_RADIUS = 7;
/** Distance between a node's rim and its label (the label hangs centred below the node) */
export const FULL_GRAPH_LABEL_GAP = 4;
export const FULL_GRAPH_LABEL_MAX_CHARS = 22;
/** Label line height in em, used for the label's box */
const LABEL_LINE = 1.25;
/** Free space kept between a node's box (circle + label) and the edge of the layout box */
const EDGE_PAD = 6;
/** Minimum free space between two node boxes */
const BOX_GAP = 6;
const TICKS = 400;
const SEED = 0x2f6e2b1;

/** Edge priority when the same pair of notes is connected more than once (in either direction). */
const EDGE_PRIORITY: Record<FullGraphEdgeKind, number> = { knowFirst: 0, next: 1, related: 2 };

const round = (value: number) => Math.round(value * 100) / 100;

/** A deterministic random source for d3-force (its `jiggle` uses it when two nodes coincide). */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Every connection between two notes of the bundle, once per pair: knowFirst (k → note), next (note → next, from the
 * notes' `next` and from the spine order) and related (note → related). A pair linked more than once, in either
 * direction, keeps one edge, by priority knowFirst > next > related (the first one seen of that kind wins the direction).
 * Self links and slugs missing from the bundle are skipped. Order: by note order of the bundle, then knowFirst, next,
 * related; spine-order edges last.
 */
export function fullGraphEdges(bundle: Pick<GuideBundle, 'notes' | 'spine'>): FullGraphEdge[] {
  const slugs = new Set(bundle.notes.map((note) => note.slug));
  const byPair = new Map<string, FullGraphEdge>();
  const order: string[] = [];

  const add = (from: string, to: string, kind: FullGraphEdgeKind) => {
    if (from === to || !slugs.has(from) || !slugs.has(to)) return;
    const pair = from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
    const existing = byPair.get(pair);
    if (existing === undefined) order.push(pair);
    else if (EDGE_PRIORITY[existing.kind] <= EDGE_PRIORITY[kind]) return;
    byPair.set(pair, { from, to, kind });
  };

  for (const note of bundle.notes) {
    for (const slug of note.knowFirst) add(slug, note.slug, 'knowFirst');
    if (note.next !== null) add(note.slug, note.next, 'next');
    for (const slug of note.related) add(note.slug, slug, 'related');
  }
  const path = bundle.spine.steps.flatMap((step) => step.notes);
  path.slice(1).forEach((to, i) => {
    add(path.at(i) ?? to, to, 'next');
  });

  return order.flatMap((pair) => {
    const edge = byPair.get(pair);
    return edge === undefined ? [] : [edge];
  });
}

/** Spine step of every note listed in the spine (the first step wins if a slug is listed twice). */
function spineSteps(bundle: Pick<GuideBundle, 'spine'>): Map<string, { step: number; index: number; count: number }> {
  const result = new Map<string, { step: number; index: number; count: number }>();
  bundle.spine.steps.forEach((step, stepIndex) => {
    step.notes.forEach((slug, index) => {
      if (!result.has(slug)) result.set(slug, { step: stepIndex, index, count: step.notes.length });
    });
  });
  return result;
}

interface SimNode extends SimulationNodeDatum {
  slug: string;
  /** Half the box width (the wider of the circle and the label) */
  halfWidth: number;
  /** Box extent above and below the node centre */
  above: number;
  below: number;
  /** Preferred x (the step column), or null for off-spine notes */
  columnX: number | null;
  x: number;
  y: number;
}

/**
 * Pushes overlapping node boxes (circle + hanging label) apart along the axis with the smaller overlap. Boxes rather
 * than circles: a label is several times wider than it is tall, so a circular collide radius would waste most of the
 * vertical room.
 */
function boxCollide(strength: number): Force<SimNode, undefined> {
  let nodes: SimNode[] = [];
  const force = () => {
    nodes.forEach((a, i) => {
      for (const b of nodes.slice(i + 1)) {
        const overlapX = a.halfWidth + b.halfWidth + BOX_GAP - Math.abs(a.x - b.x);
        if (overlapX <= 0) continue;
        // Vertical extents: [y - above, y + below]
        const overlapY = Math.min(a.y + a.below, b.y + b.below) - Math.max(a.y - a.above, b.y - b.above) + BOX_GAP;
        if (overlapY <= 0) continue;
        if (overlapX < overlapY) {
          // Ties (same x or y) push the earlier node left / up.
          const shift = (overlapX / 2) * strength * (a.x <= b.x ? -1 : 1);
          a.x += shift;
          b.x -= shift;
        } else {
          const shift = (overlapY / 2) * strength * (a.y <= b.y ? -1 : 1);
          a.y += shift;
          b.y -= shift;
        }
      }
    });
  };
  force.initialize = (next: SimNode[]) => {
    nodes = next;
  };
  return force;
}

/** Keeps every node box inside the layout box. */
function clamp(nodes: SimNode[], width: number, height: number) {
  for (const node of nodes) {
    node.x = Math.min(width - EDGE_PAD - node.halfWidth, Math.max(EDGE_PAD + node.halfWidth, node.x));
    node.y = Math.min(height - EDGE_PAD - node.below, Math.max(EDGE_PAD + node.above, node.y));
  }
}

/**
 * Stretches the settled layout (each axis on its own, never shrinking) so the node boxes fill the layout box. Moving
 * box centres further apart along an axis cannot create an overlap, so the collision result is kept.
 */
function spread(nodes: SimNode[], width: number, height: number) {
  const stretch = (axis: 'x' | 'y', size: number, before: (n: SimNode) => number, after: (n: SimNode) => number) => {
    const low = Math.min(...nodes.map((n) => n[axis]));
    const high = Math.max(...nodes.map((n) => n[axis]));
    if (high - low < 1) return;
    // Room the outermost boxes need beyond the outermost centres
    const lowRoom = low - Math.min(...nodes.map((n) => n[axis] - before(n)));
    const highRoom = Math.max(...nodes.map((n) => n[axis] + after(n))) - high;
    const scale = Math.max(1, (size - 2 * EDGE_PAD - lowRoom - highRoom) / (high - low));
    for (const node of nodes) node[axis] = EDGE_PAD + lowRoom + (node[axis] - low) * scale;
  };
  if (nodes.length < 2) return;
  stretch(
    'x',
    width,
    (n) => n.halfWidth,
    (n) => n.halfWidth
  );
  stretch(
    'y',
    height,
    (n) => n.above,
    (n) => n.below
  );
  clamp(nodes, width, height);
}

/**
 * Positions of every note in a `size` box. Spine notes are pulled towards their step's column (steps run left to
 * right), off-spine notes float freely next to the notes they connect to; linked notes attract, all notes repel, and
 * node boxes (circle + centred label below) do not overlap in the common case. Every box stays inside `size`.
 */
export function layoutFullGraph(bundle: Pick<GuideBundle, 'notes' | 'spine'>, size: FullGraphSize): FullGraphLayout {
  const { width, height } = size;
  const fontSize = size.fontSize ?? 12;
  const edges = fullGraphEdges(bundle);
  const steps = spineSteps(bundle);
  const columns = Math.max(1, bundle.spine.steps.length);
  const columnX = (step: number) => ((step + 0.5) / columns) * width;
  const labelHeight = fontSize * LABEL_LINE;
  const above = FULL_GRAPH_NODE_RADIUS;
  const below = FULL_GRAPH_NODE_RADIUS + FULL_GRAPH_LABEL_GAP + labelHeight;

  const labels = new Map(bundle.notes.map((note) => [note.slug, truncateLabel(note.title, FULL_GRAPH_LABEL_MAX_CHARS)]));
  const box = (slug: string) => Math.max(FULL_GRAPH_NODE_RADIUS, labelWidth(labels.get(slug) ?? slug, fontSize) / 2);

  // Initial placement: spine notes in their step column (spread top to bottom in spine order)…
  const simNodes: SimNode[] = [];
  const bySlug = new Map<string, SimNode>();
  for (const note of bundle.notes) {
    const place = steps.get(note.slug);
    if (place === undefined) continue;
    const node: SimNode = {
      slug: note.slug,
      halfWidth: box(note.slug),
      above,
      below,
      columnX: columnX(place.step),
      x: columnX(place.step),
      y: ((place.index + 1) / (place.count + 1)) * height,
    };
    simNodes.push(node);
    bySlug.set(note.slug, node);
  }
  // …off-spine notes at the centroid of their placed neighbours, nudged apart by their index (or along the bottom).
  const offSpine = bundle.notes.filter((note) => !steps.has(note.slug));
  offSpine.forEach((note, index) => {
    const anchors = edges
      .flatMap((edge) => (edge.from === note.slug ? [edge.to] : edge.to === note.slug ? [edge.from] : []))
      .flatMap((slug) => {
        const placed = bySlug.get(slug);
        return placed === undefined ? [] : [placed];
      });
    const angle = (index * 2.399963) % (2 * Math.PI); // golden angle: deterministic, well spread
    const fallback = { x: ((index + 0.5) / offSpine.length) * width, y: height * 0.9 };
    const centre =
      anchors.length === 0
        ? fallback
        : { x: anchors.reduce((sum, a) => sum + a.x, 0) / anchors.length, y: anchors.reduce((sum, a) => sum + a.y, 0) / anchors.length };
    const node: SimNode = {
      slug: note.slug,
      halfWidth: box(note.slug),
      above,
      below,
      columnX: null,
      x: centre.x + Math.cos(angle) * 40,
      y: centre.y + Math.sin(angle) * 40,
    };
    simNodes.push(node);
    bySlug.set(note.slug, node);
  });
  clamp(simNodes, width, height);

  const links = edges.map((edge) => ({ source: edge.from, target: edge.to }));
  const linkDistance = Math.min(width / columns, height / 3) * 0.6;
  const simulation = forceSimulation<SimNode>(simNodes)
    .randomSource(lcg(SEED))
    .force(
      'link',
      forceLink<SimNode, { source: string; target: string }>(links)
        .id((node) => node.slug)
        .distance(linkDistance)
        .strength(0.15)
    )
    .force(
      'charge',
      forceManyBody<SimNode>()
        .strength(-120)
        .distanceMax(width / 2)
    )
    .force(
      'column',
      forceX<SimNode>((node) => node.columnX ?? width / 2).strength((node) => (node.columnX === null ? 0.01 : 0.35))
    )
    .force('middle', forceY<SimNode>(height / 2).strength(0.04))
    .force('boxes', boxCollide(0.7))
    .stop();
  for (let i = 0; i < TICKS; i++) {
    simulation.tick();
    clamp(simNodes, width, height);
  }
  // A few collision-only passes after the forces have settled, so the last word is "no overlap", then the bounds.
  const settle = boxCollide(1);
  settle.initialize?.(simNodes, lcg(SEED));
  for (let i = 0; i < 30; i++) {
    settle(1);
    clamp(simNodes, width, height);
  }

  spread(simNodes, width, height);

  const stepOf = (slug: string) => steps.get(slug)?.step ?? null;
  const nodes: FullGraphNode[] = bundle.notes.map((note) => {
    const sim = bySlug.get(note.slug);
    return {
      slug: note.slug,
      title: note.title,
      label: labels.get(note.slug) ?? note.title,
      step: stepOf(note.slug),
      x: round(sim?.x ?? width / 2),
      y: round(sim?.y ?? height / 2),
    };
  });
  return { nodes, edges };
}

/** The box a node occupies (circle + hanging label), for bounds and overlap checks. */
export function fullGraphNodeBox(node: FullGraphNode, fontSize = 12): { left: number; right: number; top: number; bottom: number } {
  const half = Math.max(FULL_GRAPH_NODE_RADIUS, labelWidth(node.label, fontSize) / 2);
  return {
    left: node.x - half,
    right: node.x + half,
    top: node.y - FULL_GRAPH_NODE_RADIUS,
    bottom: node.y + FULL_GRAPH_NODE_RADIUS + FULL_GRAPH_LABEL_GAP + fontSize * LABEL_LINE,
  };
}

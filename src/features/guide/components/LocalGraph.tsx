import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  layoutLocalGraph,
  LOCAL_GRAPH_CURRENT_RADIUS as CURRENT_RADIUS,
  LOCAL_GRAPH_LABEL_GAP as LABEL_GAP,
  LOCAL_GRAPH_NODE_RADIUS as NODE_RADIUS,
  type LocalGraphEdge,
  type LocalGraphNode,
} from '../engine/localGraph';
import { findNote } from '../engine/notes';
import type { GuideNote } from '../engine/schema';
import { useHoverPopover } from '@/components/useHoverPopover';
import { useLoadedGuide } from '../hooks/useLoadedGuide';
import { PeekPopover, PeekText } from '@/components/PeekPopover';
import { SectionLabel } from './SectionLabel';
import { GUIDE_PROSE_FONT } from './styles';

/**
 * The SVG is drawn 1:1 in CSS pixels: its viewBox width is the measured column width, so the rem-sized labels render at
 * their real size (text-size setting included) and the layout can keep them inside the box.
 */
const HEIGHT = 360;
const FALLBACK = { width: 352, fontSize: 12 } as const;
/** Label size in rem (matches LABEL_CLASS) */
const LABEL_REM = 0.75;
/** viewBox units kept above the top node and below the bottom node's hanging label */
const CROP_PAD = { top: 16, bottom: 24 } as const;
// paint-order: a background-coloured halo keeps labels legible where they cross an edge.
const LABEL_CLASS = 'fill-foreground stroke-background text-[0.75rem] [paint-order:stroke] [stroke-linejoin:round] [stroke-width:3px]';

const radiusOf = (node: LocalGraphNode) => (node.kind === 'current' ? CURRENT_RADIUS : NODE_RADIUS);

interface NodeLabelProps {
  readonly node: LocalGraphNode;
}

function NodeLabel({ node }: NodeLabelProps) {
  const label = node.label;
  const r = radiusOf(node);
  if (node.kind === 'knowFirst' || node.kind === 'related' || node.kind === 'backlink') {
    const left = node.kind === 'knowFirst';
    return (
      <text
        x={left ? node.x - r - LABEL_GAP : node.x + r + LABEL_GAP}
        y={node.y}
        dominantBaseline="central"
        textAnchor={left ? 'end' : 'start'}
        className={LABEL_CLASS}
      >
        {label}
      </text>
    );
  }
  return (
    <text
      x={node.x}
      y={node.y + r + LABEL_GAP}
      dominantBaseline="hanging"
      textAnchor="middle"
      className={cn(LABEL_CLASS, node.kind === 'current' && 'font-semibold')}
    >
      {label}
    </text>
  );
}

interface NeighbourNodeProps {
  readonly node: LocalGraphNode;
  readonly visited: boolean;
}

function NeighbourNode({ node, visited }: NeighbourNodeProps) {
  const { bundle } = useLoadedGuide();
  const target = findNote(bundle, node.slug);
  const peek = useHoverPopover();

  return (
    <PeekPopover
      peek={peek}
      className={GUIDE_PROSE_FONT}
      enabled={target !== undefined}
      trigger={
        <Link
          to={`/guide/${node.slug}`}
          aria-label={visited ? `${node.title} (read)` : node.title}
          className="group cursor-pointer outline-none"
          {...peek.triggerProps}
        >
          <title>{node.title}</title>
          {/* Larger invisible hit area */}
          <circle cx={node.x} cy={node.y} r={NODE_RADIUS + 6} fill="transparent" />
          <circle
            cx={node.x}
            cy={node.y}
            r={NODE_RADIUS + 3.5}
            fill="none"
            strokeWidth={2}
            className="stroke-ring opacity-0 group-focus-visible:opacity-100"
          />
          <circle
            cx={node.x}
            cy={node.y}
            r={NODE_RADIUS}
            strokeWidth={1.5}
            className={cn(
              'stroke-muted-foreground transition-colors group-hover:stroke-primary',
              visited ? 'fill-muted-foreground' : 'fill-background'
            )}
          />
          <NodeLabel node={node} />
        </Link>
      }
    >
      {target && <PeekText title={target.title} text={target.summary} />}
    </PeekPopover>
  );
}

interface EdgeProps {
  readonly edge: LocalGraphEdge;
  readonly nodes: ReadonlyMap<string, LocalGraphNode>;
  readonly arrowId: string;
}

function Edge({ edge, nodes, arrowId }: EdgeProps) {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (from === undefined || to === undefined) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  // Stop the line at the circles' rims (plus room for the arrowhead).
  const start = radiusOf(from) + 1;
  const end = radiusOf(to) + (edge.kind === 'knowFirst' ? 3 : 1);
  return (
    <line
      x1={from.x + (dx / length) * start}
      y1={from.y + (dy / length) * start}
      x2={to.x - (dx / length) * end}
      y2={to.y - (dy / length) * end}
      stroke="currentColor"
      strokeOpacity={edge.kind === 'knowFirst' || edge.kind === 'next' ? 0.55 : 0.3}
      strokeWidth={1.25}
      strokeDasharray={edge.kind === 'next' ? '5 4' : undefined}
      markerEnd={edge.kind === 'knowFirst' ? `url(#${arrowId})` : undefined}
    />
  );
}

/**
 * Desktop-only map of the note's direct neighbours (know first on the left, related and "mentioned in" on the right,
 * next on the path below). Supplementary: every node is also reachable through the chips and the next link.
 */
interface LocalGraphProps {
  readonly note: GuideNote;
  readonly visited: ReadonlySet<string>;
}

export function LocalGraph({ note, visited }: LocalGraphProps) {
  const { bundle } = useLoadedGuide();
  const arrowId = `guide-graph-arrow-${useId().replace(/:/g, '')}`;
  const sectionRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{ width: number; fontSize: number }>(FALLBACK);

  // Track the column width and the label size in px. The legend below the SVG is rem-sized, so a text-size change
  // resizes the section and re-reads the root font size too.
  useEffect(() => {
    const section = sectionRef.current;
    if (section === null) return;
    const measure = () => {
      const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const width = Math.round(section.clientWidth);
      const fontSize = rootPx * LABEL_REM;
      if (width > 0) setBox((current) => (current.width === width && current.fontSize === fontSize ? current : { width, fontSize }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    return () => {
      observer.disconnect();
    };
  }, []);

  const graph = layoutLocalGraph(note, bundle, { width: box.width, height: HEIGHT, fontSize: box.fontSize });
  if (graph.edges.length === 0) return null;
  const bySlug = new Map(graph.nodes.map((node) => [node.slug, node]));
  // Crop the viewBox to the used rows, so a graph without top or bottom neighbours leaves no empty band.
  const ys = graph.nodes.map((node) => node.y);
  const top = Math.max(0, Math.min(...ys) - CURRENT_RADIUS - CROP_PAD.top);
  const bottom = Math.min(HEIGHT, Math.max(...ys) + CURRENT_RADIUS + LABEL_GAP + CROP_PAD.bottom);

  return (
    <section ref={sectionRef} aria-labelledby={`${arrowId}-heading`} className="space-y-2">
      <SectionLabel id={`${arrowId}-heading`}>Connections</SectionLabel>
      <svg
        viewBox={`0 ${String(top)} ${String(box.width)} ${String(bottom - top)}`}
        className={cn('h-auto w-full overflow-visible text-foreground', GUIDE_PROSE_FONT)}
      >
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fillOpacity={0.7} />
          </marker>
        </defs>
        <g>
          {graph.edges.map((edge) => (
            <Edge key={`${edge.from}>${edge.to}`} edge={edge} nodes={bySlug} arrowId={arrowId} />
          ))}
        </g>
        {graph.nodes.map((node) =>
          node.kind === 'current' ? (
            <g key={node.slug} aria-current="page">
              <circle cx={node.x} cy={node.y} r={CURRENT_RADIUS} className="fill-primary stroke-primary" />
              <NodeLabel node={node} />
            </g>
          ) : (
            <NeighbourNode key={node.slug} node={node} visited={visited.has(node.slug)} />
          )
        )}
      </svg>
      <p className="text-xs text-muted-foreground">Arrow: know first · dashed: next on your path · filled: read</p>
    </section>
  );
}

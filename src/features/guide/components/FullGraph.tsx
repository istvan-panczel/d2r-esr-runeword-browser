import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FULL_GRAPH_LABEL_GAP as LABEL_GAP,
  FULL_GRAPH_NODE_RADIUS as NODE_RADIUS,
  layoutFullGraph,
  type FullGraphEdge,
  type FullGraphNode,
} from '../engine/fullGraph';
import { findNote } from '../engine/notes';
import type { GuideSpineStep } from '../engine/schema';
import { useHoverPopover } from '@/components/useHoverPopover';
import { useLoadedGuide } from '../hooks/useLoadedGuide';
import { PeekPopover, PeekText } from '@/components/PeekPopover';
import { GUIDE_PROSE_FONT } from './styles';

/** Height / width of the graph panel. */
const ASPECT = 0.6;
/**
 * The graph is never taller than the window minus this much (rem: about the header, the guide banner and the title),
 * so a Wide or Full page on a large monitor does not get a graph taller than the screen (width × 0.6 is about 2000 px
 * on a 3440 px window). It is never capped below MIN_CAP_REM either: that is the height of the Standard page's graph
 * (80rem × 0.6), which stays as it was.
 */
const VIEWPORT_MARGIN_REM = 15;
const MIN_CAP_REM = 48;
/** Label size in rem (matches LABEL_CLASS) */
const LABEL_REM = 0.75;
// paint-order: a background-coloured halo keeps labels legible where they cross an edge (same as the local graph).
const LABEL_CLASS = 'fill-foreground stroke-card text-[0.75rem] [paint-order:stroke] [stroke-linejoin:round] [stroke-width:3px]';

/** Node outline per spine step (cycled if the spine ever grows past five steps); off-spine notes stay neutral. */
const STEP_STROKE = ['stroke-sky-500', 'stroke-emerald-500', 'stroke-amber-500', 'stroke-rose-500', 'stroke-violet-500'] as const;
const STEP_SWATCH = ['border-sky-500', 'border-emerald-500', 'border-amber-500', 'border-rose-500', 'border-violet-500'] as const;
const NEUTRAL_STROKE = 'stroke-muted-foreground';
const NEUTRAL_SWATCH = 'border-muted-foreground';

const stepStroke = (step: number | null) => (step === null ? NEUTRAL_STROKE : (STEP_STROKE[step % STEP_STROKE.length] ?? NEUTRAL_STROKE));
const stepSwatch = (step: number | null) => (step === null ? NEUTRAL_SWATCH : (STEP_SWATCH[step % STEP_SWATCH.length] ?? NEUTRAL_SWATCH));

/** How a node relates to the hovered / focused node, if any. */
type Emphasis = 'active' | 'linked' | null;

interface NodeProps {
  readonly node: FullGraphNode;
  readonly visited: boolean;
  readonly emphasis: Emphasis;
  /** Called with the node's slug on hover / focus, with null when the pointer or focus leaves it */
  readonly onActive: (slug: string | null) => void;
}

function Node({ node, visited, emphasis, onActive }: NodeProps) {
  const { bundle } = useLoadedGuide();
  const target = findNote(bundle, node.slug);
  const peek = useHoverPopover();
  // The peek's handlers stay in charge of the popover; these only add the edge highlight on top.
  const { onFocus, onBlur, ...triggerProps } = peek.triggerProps;

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
          {...triggerProps}
          onMouseEnter={() => {
            onActive(node.slug);
          }}
          onMouseLeave={() => {
            onActive(null);
          }}
          onFocus={(event) => {
            onFocus(event);
            onActive(node.slug);
          }}
          onBlur={(event) => {
            onBlur(event);
            onActive(null);
          }}
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
            strokeWidth={2}
            className={cn(
              'transition-colors group-hover:stroke-primary',
              stepStroke(node.step),
              visited ? 'fill-muted-foreground' : 'fill-card'
            )}
          />
          <text
            x={node.x}
            y={node.y + NODE_RADIUS + LABEL_GAP}
            dominantBaseline="hanging"
            textAnchor="middle"
            className={cn(
              LABEL_CLASS,
              'group-hover:fill-primary',
              emphasis !== null && 'fill-primary',
              emphasis === 'active' && 'font-semibold'
            )}
          >
            {node.label}
          </text>
        </Link>
      }
    >
      {target && <PeekText title={target.title} text={target.summary} />}
    </PeekPopover>
  );
}

interface EdgeProps {
  readonly edge: FullGraphEdge;
  readonly nodes: ReadonlyMap<string, FullGraphNode>;
  readonly arrowId: string;
  /** The hovered / focused node, or null */
  readonly active: string | null;
}

function Edge({ edge, nodes, arrowId, active }: EdgeProps) {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (from === undefined || to === undefined) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  // Stop the line at the circles' rims (plus room for the arrowhead).
  const start = NODE_RADIUS + 1;
  const end = NODE_RADIUS + (edge.kind === 'knowFirst' ? 3 : 1);
  return (
    <line
      x1={from.x + (dx / length) * start}
      y1={from.y + (dy / length) * start}
      x2={to.x - (dx / length) * end}
      y2={to.y - (dy / length) * end}
      stroke="currentColor"
      // A denser picture than the local graph: related edges are fainter so the path and prerequisites stand out. While a
      // node is hovered or focused, its own edges go to full strength and every other edge almost disappears.
      style={{ opacity: active === null ? (edge.kind === 'related' ? 0.2 : 0.5) : edge.from === active || edge.to === active ? 1 : 0.08 }}
      className="transition-opacity duration-150"
      strokeWidth={1.25}
      strokeDasharray={edge.kind === 'next' ? '5 4' : undefined}
      markerEnd={edge.kind === 'knowFirst' ? `url(#${arrowId})` : undefined}
    />
  );
}

interface LegendProps {
  readonly steps: readonly GuideSpineStep[];
}

function Legend({ steps }: LegendProps) {
  const swatch = 'inline-block size-2.5 shrink-0 rounded-full border-2';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {steps.map((step, index) => (
        <span key={step.title} className="inline-flex items-center gap-1.5">
          <span className={cn(swatch, stepSwatch(index))} aria-hidden />
          {index + 1}. {step.title}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className={cn(swatch, NEUTRAL_SWATCH)} aria-hidden />
        Other topics
      </span>
      <span>Arrow: know first · dashed: next on your path · filled: read · hover: that note's links</span>
    </div>
  );
}

interface FullGraphProps {
  /** Slugs in the order keyboard focus should visit the nodes (the list order below the graph) */
  readonly order: readonly string[];
  readonly visited: ReadonlySet<string>;
  readonly className?: string;
}

/**
 * Desktop-only map of every guide note (layout in engine/fullGraph.ts). Supplementary: the grouped list below it
 * carries every note too, so the graph is never the only way to reach one.
 */
export function FullGraph({ order, visited, className }: FullGraphProps) {
  const { bundle } = useLoadedGuide();
  const arrowId = `guide-map-arrow-${useId().replace(/:/g, '')}`;
  const panelRef = useRef<HTMLDivElement>(null);
  // Measured panel width and label size in px; null until measured (the panel is display:none below lg, so phones
  // never run the layout).
  const [box, setBox] = useState<{ width: number; fontSize: number; maxHeight: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // Same approach as the local graph: the SVG is drawn 1:1 in CSS pixels, so rem labels render at their real size.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    const measure = () => {
      const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const width = Math.round(panel.clientWidth);
      const fontSize = rootPx * LABEL_REM;
      const maxHeight = Math.round(Math.max(MIN_CAP_REM * rootPx, window.innerHeight - VIEWPORT_MARGIN_REM * rootPx));
      if (width > 0)
        setBox((current) =>
          current?.width === width && current.fontSize === fontSize && current.maxHeight === maxHeight
            ? current
            : { width, fontSize, maxHeight }
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    // The cap follows the window height, which the panel's own size does not reflect
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const naturalHeight = box === null ? 0 : Math.round(box.width * ASPECT);
  const capped = box !== null && naturalHeight > box.maxHeight;
  const height = box === null ? 0 : Math.min(naturalHeight, box.maxHeight);
  const graph = box === null ? null : layoutFullGraph(bundle, { width: box.width, height, fontSize: box.fontSize });
  const bySlug = new Map(graph?.nodes.map((node) => [node.slug, node]));
  const rank = new Map(order.map((slug, index) => [slug, index]));
  // Hovered or keyboard-focused node: pure render state, the layout does not depend on it.
  const linked = new Set(
    active === null
      ? []
      : (graph?.edges ?? []).flatMap((edge) => (edge.from === active ? [edge.to] : edge.to === active ? [edge.from] : []))
  );
  const emphasisOf = (slug: string): Emphasis => (slug === active ? 'active' : linked.has(slug) ? 'linked' : null);
  const nodes = [...(graph?.nodes ?? [])].sort((a, b) => (rank.get(a.slug) ?? order.length) - (rank.get(b.slug) ?? order.length));

  return (
    <section aria-label="Map of every guide note" className={cn('space-y-2', className)}>
      {/* Capped: the SVG (viewBox width × capped height) sets the panel height instead of the aspect ratio */}
      <div ref={panelRef} className="rounded-lg border bg-card" style={capped ? undefined : { aspectRatio: `1 / ${String(ASPECT)}` }}>
        {graph !== null && box !== null && (
          <svg
            viewBox={`0 0 ${String(box.width)} ${String(height)}`}
            className={cn('block h-auto w-full text-foreground', GUIDE_PROSE_FONT)}
          >
            <defs>
              <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fillOpacity={0.7} />
              </marker>
            </defs>
            <g>
              {graph.edges.map((edge) => (
                <Edge key={`${edge.from}>${edge.to}`} edge={edge} nodes={bySlug} arrowId={arrowId} active={active} />
              ))}
            </g>
            {nodes.map((node) => (
              <Node key={node.slug} node={node} visited={visited.has(node.slug)} emphasis={emphasisOf(node.slug)} onActive={setActive} />
            ))}
          </svg>
        )}
      </div>
      <Legend steps={bundle.spine.steps} />
    </section>
  );
}

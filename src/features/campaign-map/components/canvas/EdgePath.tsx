import { cn } from '@/lib/utils';
import type { MapEdge } from '../../engine/types';
import { EDGE_KIND_LABEL, EDGE_STYLE, HALO, markerId } from './canvasStyles';

interface EdgePathProps {
  readonly mapEdge: MapEdge;
  readonly markerPrefix: string;
  readonly nameOf: (id: number) => string;
  /** The selected area is one of its ends: draw it stronger */
  readonly active: boolean;
}

/** One edge: line pattern + arrowhead by kind, a <title> for hover and screen readers */
export function EdgePath({ mapEdge, markerPrefix, nameOf, active }: EdgePathProps) {
  const { edge, path } = mapEdge;
  const style = EDGE_STYLE[edge.kind];
  const arrow = edge.oneWay || edge.kind === 'act';
  const title = `${nameOf(edge.from)} ${edge.oneWay ? '→' : '↔'} ${nameOf(edge.to)}: ${EDGE_KIND_LABEL[edge.kind]}${
    edge.via === undefined ? '' : ` (${edge.via})`
  }${edge.verify === true ? ', unconfirmed' : ''}`;
  return (
    <g>
      <title>{title}</title>
      <path
        d={path}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={style.width + (active ? 1 : 0)}
        strokeDasharray={style.dash}
        className={style.className}
        markerEnd={arrow ? `url(#${markerId(markerPrefix, edge.kind)})` : undefined}
      />
    </g>
  );
}

interface EdgeLabelProps {
  readonly mapEdge: MapEdge;
}

/** The edge's `via` text at its label point (drawn above every edge, below the stations) */
export function EdgeLabel({ mapEdge }: EdgeLabelProps) {
  const { edge, labelAt } = mapEdge;
  if (labelAt === undefined || edge.via === undefined) return null;
  return (
    <text x={labelAt.x} y={labelAt.y} textAnchor="middle" aria-hidden className={cn('fill-muted-foreground text-[9.5px] italic', HALO)}>
      {edge.via}
      {edge.verify === true ? ' ?' : ''}
    </text>
  );
}

interface CanvasMarkersProps {
  readonly prefix: string;
}

/** Arrowheads, one per edge kind (marker colour cannot follow the line in every browser) */
export function CanvasMarkers({ prefix }: CanvasMarkersProps) {
  return (
    <defs>
      {Object.entries(EDGE_STYLE).map(([kind, style]) => (
        <marker
          key={kind}
          id={markerId(prefix, kind)}
          viewBox="0 0 10 10"
          // The path ends at the dot's centre: refX 22 pulls the tip back ~10 units, outside the waypoint ring
          refX="22"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" className={style.markerClass} />
        </marker>
      ))}
    </defs>
  );
}

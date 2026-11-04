import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AreaTerrain } from '@/features/game-data/engine/schema';
import type { EdgeKind } from '../engine/types';
import { EDGE_KIND_LABELS, terrainLabel } from '../utils/sourceLabels';
import { EDGE_STYLE } from './canvas/canvasStyles';
import { TerrainDot } from './TerrainDot';

const TERRAINS: readonly AreaTerrain[] = ['town', 'outdoor', 'cave', 'tomb', 'dungeon', 'temple', 'tower', 'special'];
const EDGES: readonly EdgeKind[] = ['border', 'passage', 'portal', 'cube', 'act'];

/**
 * The legend under the map, drawn with the canvas's own classes (`canvas/canvasStyles.ts`, the station marks of
 * `canvas/Station.tsx`), so the two cannot drift apart. Shapes only; the words carry the meaning.
 */
export function MapLegend({ className }: { readonly className?: string }) {
  return (
    <div className={cn('space-y-1.5 px-1 text-xs text-muted-foreground', className)} aria-label="Legend" role="group">
      <LegendRow title="Areas">
        {TERRAINS.map((terrain) => (
          <LegendItem key={terrain} label={terrainLabel(terrain)}>
            <TerrainDot terrain={terrain} />
          </LegendItem>
        ))}
      </LegendRow>
      <LegendRow title="Paths">
        {EDGES.map((kind) => {
          const style = EDGE_STYLE[kind];
          return (
            <LegendItem key={kind} label={EDGE_KIND_LABELS[kind]}>
              <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden>
                <line
                  x1="2"
                  y1="6"
                  x2={kind === 'act' ? 26 : 32}
                  y2="6"
                  strokeWidth={Math.min(style.width, 5)}
                  strokeDasharray={style.dash}
                  className={style.className}
                />
                {kind === 'act' && <path d="M25 2 L33 6 L25 10 z" className={style.markerClass} />}
              </svg>
            </LegendItem>
          );
        })}
        <LegendItem label="One way (arrowhead)">
          <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden>
            <line x1="2" y1="6" x2="26" y2="6" strokeWidth={EDGE_STYLE.passage.width} className={EDGE_STYLE.passage.className} />
            <path d="M25 2 L33 6 L25 10 z" className={EDGE_STYLE.passage.markerClass} />
          </svg>
        </LegendItem>
      </LegendRow>
      <LegendRow title="Marks">
        <LegendItem label="Waypoint">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <circle cx="9" cy="9" r="7.5" fill="none" strokeWidth="2" className="stroke-sky-500 dark:stroke-sky-400" />
            <circle cx="9" cy="9" r="4.5" strokeWidth="1.5" className="fill-card stroke-muted-foreground" />
          </svg>
        </LegendItem>
        <LegendItem label="Boss">
          <svg width="10" height="10" viewBox="-5 -5 10 10" aria-hidden>
            <path d="M0 -3.5 L3.5 3 L-3.5 3 z" className="fill-red-600 dark:fill-red-400" />
          </svg>
        </LegendItem>
        <LegendItem label="Quest item">
          <svg width="10" height="10" viewBox="-5 -5 10 10" aria-hidden>
            <path d="M0 -4 L3.5 0 L0 4 L-3.5 0 z" className="fill-amber-500 dark:fill-amber-400" />
          </svg>
        </LegendItem>
        <LegendItem label="Heads up (teleport, caveat, no known entrance)">
          <svg width="10" height="10" viewBox="-5 -5 10 10" aria-hidden>
            <circle r="4" className="fill-orange-500 dark:fill-orange-400" />
          </svg>
        </LegendItem>
        <LegendItem label="Drawn on another tab (click to go there)">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="5" strokeWidth="1.5" className="fill-card stroke-muted-foreground [stroke-dasharray:2_2]" />
          </svg>
        </LegendItem>
      </LegendRow>
    </div>
  );
}

function LegendRow({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-12 shrink-0 font-semibold text-foreground">{title}</span>
      {children}
    </div>
  );
}

function LegendItem({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {label}
    </span>
  );
}

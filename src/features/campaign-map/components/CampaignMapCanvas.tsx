import { useId } from 'react';
import { useHref } from 'react-router-dom';
import { DOT_R, LABEL_CHAR_W, LABEL_LINE, REGION_CAPTION_DX, REGION_CAPTION_DY, regionCaptionBox } from '../engine/geometry';
import type { CampaignMap, CampaignSection, CampaignSectionKey, MapStation } from '../engine/types';
import { CanvasMarkers, EdgeLabel, EdgePath } from './canvas/EdgePath';
import { Station } from './canvas/Station';

export interface CampaignMapCanvasProps {
  map: CampaignMap;
  /** section.layout !== null */
  section: CampaignSection;
  selectedId: number | null;
  /** Pulse/highlight (search hit) */
  highlightId?: number | null;
  /**
   * App path of an area's station (`/campaign-map?tab=…&area=…`, as a router `to`); stations are focusable SVG <a>
   * elements, so the canvas adds the router basename itself
   */
  areaHref: (id: number) => string;
  /** click / Enter on a station (preventDefault on the link) */
  onSelect: (id: number) => void;
  /** Ghost station clicked: switch tab and select */
  onJump: (section: CampaignSectionKey, id: number) => void;
}

/** The canvas is drawn about 1:1; it shrinks with its container down to this scale, then scrolls sideways */
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.25;

/** Bounding box of the unplaced stations (dots + labels), for the dashed "not placed yet" frame */
function unplacedFrame(stations: readonly MapStation[]): { x: number; y: number; width: number; height: number } | null {
  if (stations.length === 0) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const station of stations) {
    for (const dot of station.dots) {
      xs.push(dot.x - DOT_R, dot.x + DOT_R);
      ys.push(dot.y - DOT_R);
    }
    const half = (Math.max(0, ...station.label.lines.map((line) => line.length)) * LABEL_CHAR_W) / 2;
    xs.push(station.label.x - half, station.label.x + half);
    ys.push(station.label.y + station.label.lines.length * LABEL_LINE);
  }
  const pad = 12;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad - 14;
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y };
}

/**
 * SVG transit-style map of one section (layout from the engine): regions, edges by kind (pattern + arrowhead), via
 * labels, stations (terrain fill, waypoint ring, town square, boss / quest / caution marks), ghosts of other tabs and
 * the "not placed yet" strip. Legend, panel and peek belong to the page; every station link carries `data-area-id`.
 */
export function CampaignMapCanvas({ map, section, selectedId, highlightId = null, areaHref, onSelect, onJump }: CampaignMapCanvasProps) {
  const markerPrefix = `campaign-map-${useId().replace(/:/g, '')}`;
  // Raw SVG links bypass <Link>: prefix the basename (production serves the app under /d2r-esr-runeword-browser/)
  const basePath = useHref('/').replace(/\/$/, '');
  const stationHref = (id: number) => `${basePath}${areaHref(id)}`;
  const layout = section.layout;
  if (layout === null) return null;
  const nameOf = (id: number) => map.areas.get(id)?.name ?? String(id);
  const titleOf = new Map(map.sections.map((s) => [s.key, s.title]));
  const unplaced = new Set(section.unplacedIds);
  const isUnplaced = (station: MapStation) => station.ghostOf === undefined && station.ids.some((id) => unplaced.has(id));
  const frame = unplacedFrame(layout.stations.filter(isUnplaced));
  const touches = (from: number, to: number) => selectedId !== null && (from === selectedId || to === selectedId);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
        role="group"
        aria-label={`${section.title} map`}
        className="mx-auto block h-auto w-full select-none"
        style={{ minWidth: layout.width * MIN_SCALE, maxWidth: layout.width * MAX_SCALE }}
      >
        <CanvasMarkers prefix={markerPrefix} />
        <g aria-hidden>
          {layout.regions.map((region) => (
            <g key={region.label}>
              <rect
                x={region.x}
                y={region.y}
                width={region.width}
                height={region.height}
                rx={12}
                className="fill-muted/60 stroke-border"
                strokeWidth={1}
              />
            </g>
          ))}
          {frame !== null && (
            <g>
              <rect {...frame} rx={10} fill="none" strokeWidth={1.25} strokeDasharray="5 4" className="stroke-orange-500" />
              <text
                x={frame.x + 10}
                y={frame.y + 7}
                dominantBaseline="hanging"
                className="fill-orange-600 text-[10px] font-medium tracking-wider uppercase dark:fill-orange-400"
              >
                Not placed on the map yet
              </text>
            </g>
          )}
        </g>
        <g>
          {layout.edges.map((mapEdge) => (
            <EdgePath
              key={`${String(mapEdge.edge.from)}-${String(mapEdge.edge.to)}-${mapEdge.edge.kind}`}
              mapEdge={mapEdge}
              markerPrefix={markerPrefix}
              nameOf={nameOf}
              active={touches(mapEdge.edge.from, mapEdge.edge.to)}
            />
          ))}
        </g>
        {/* Region captions over the edges, on a pill, so a line crossing the corner does not cut through them */}
        <g aria-hidden>
          {layout.regions.map((region) => {
            const box = regionCaptionBox(region);
            return (
              <g key={region.label}>
                <rect
                  x={box.x - 3}
                  y={box.y - 1}
                  width={box.w + 6}
                  height={box.h + 2}
                  rx={4}
                  className="fill-card stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={region.x + REGION_CAPTION_DX}
                  y={region.y + REGION_CAPTION_DY}
                  dominantBaseline="hanging"
                  className="fill-muted-foreground text-[10px] font-medium tracking-wider uppercase"
                >
                  {region.label}
                </text>
              </g>
            );
          })}
        </g>
        <g>
          {layout.edges.map((mapEdge) => (
            <EdgeLabel key={`${String(mapEdge.edge.from)}-${String(mapEdge.edge.to)}-${mapEdge.edge.kind}`} mapEdge={mapEdge} />
          ))}
        </g>
        <g>
          {layout.stations.map((station) => {
            const ghostOf = station.ghostOf;
            return (
              <Station
                key={`${ghostOf ?? 'station'}-${station.ids.join('+')}`}
                station={station}
                areas={map.areas}
                ghostTitle={ghostOf === undefined ? undefined : titleOf.get(ghostOf)}
                unplaced={isUnplaced(station)}
                selectedId={selectedId}
                highlightId={highlightId}
                areaHref={stationHref}
                onActivate={(id) => {
                  if (ghostOf === undefined) onSelect(id);
                  else onJump(ghostOf, id);
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

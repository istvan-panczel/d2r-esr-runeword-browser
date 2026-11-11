import { useState, type PointerEvent } from 'react';
import type { Facts } from '@/features/modifiers/utils/modifierMath';
import {
  CHANCE_TICKS,
  CHART,
  RATIO_MAX,
  RATIO_TICKS,
  chanceAtRatio,
  curvePath,
  formatRatio,
  ratioOfX,
  xOfRatio,
  yOfChance,
} from './curveChart';

/** One player position on the curve: a ratio and the chance it gives */
export interface CurveMarker {
  readonly ratio: number;
  readonly chance: number;
}

interface HitCurveChartProps {
  readonly facts: Facts;
  /** Your attack rating ÷ the target's defense */
  readonly hit: CurveMarker | null;
  /** The target's attack rating ÷ your defense */
  readonly beHit: CurveMarker | null;
  readonly targetName: string;
}

const MARKER_RADIUS = 5;

/**
 * ESR's hit chance curve (one curve for every attacker and defender) with the two positions of the selected target:
 * where your attacks land on it and where its attacks on you land. A crosshair reads the curve under the pointer.
 */
export function HitCurveChart({ facts, hit, beHit, targetName }: HitCurveChartProps) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const path = curvePath(facts);
  const plotRight = CHART.width - CHART.right;
  const plotBottom = CHART.height - CHART.bottom;

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * CHART.width;
    setHoverX(x >= CHART.left && x <= plotRight ? x : null);
  };

  const hoverRatio = hoverX === null ? null : ratioOfX(hoverX);
  const hoverChance = hoverRatio === null ? null : chanceAtRatio(hoverRatio, facts);
  const summary = [
    hit === null ? null : `you hit ${String(hit.chance)}% at ${formatRatio(hit.ratio)}`,
    beHit === null ? null : `${targetName} hits you ${String(beHit.chance)}% at ${formatRatio(beHit.ratio)}`,
  ]
    .filter((part) => part !== null)
    .join('; ');

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${String(CHART.width)} ${String(CHART.height)}`}
        className="h-auto w-full touch-none overflow-visible text-foreground select-none"
        role="img"
        aria-label={`Hit chance curve: chance over attack rating ÷ defense, 50% at 5×.${summary === '' ? '' : ` Typical monster: ${summary}.`}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          setHoverX(null);
        }}
      >
        {/* Grid: solid hairlines one step off the surface */}
        {CHANCE_TICKS.map((tick) => (
          <g key={`y${String(tick)}`}>
            <line x1={CHART.left} x2={plotRight} y1={yOfChance(tick)} y2={yOfChance(tick)} className="stroke-border" strokeWidth={1} />
            <text
              x={CHART.left - 6}
              y={yOfChance(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {tick}%
            </text>
          </g>
        ))}
        {RATIO_TICKS.map((tick) => (
          <g key={`x${String(tick)}`}>
            <line x1={xOfRatio(tick)} x2={xOfRatio(tick)} y1={CHART.top} y2={plotBottom} className="stroke-border" strokeWidth={1} />
            <text x={xOfRatio(tick)} y={plotBottom + 14} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
              {tick}×
            </text>
          </g>
        ))}
        <text x={plotRight} y={CHART.height - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
          attack rating ÷ defense
        </text>

        <path d={path} fill="none" className="stroke-muted-foreground" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hoverX !== null && hoverRatio !== null && hoverChance !== null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={CHART.top} y2={plotBottom} className="stroke-foreground/40" strokeWidth={1} />
            <circle cx={hoverX} cy={yOfChance(hoverChance)} r={3} className="fill-foreground" />
            <text
              x={hoverX > CHART.width / 2 ? hoverX - 6 : hoverX + 6}
              y={CHART.top + 10}
              textAnchor={hoverX > CHART.width / 2 ? 'end' : 'start'}
              className="fill-foreground text-[11px] font-semibold tabular-nums"
            >
              {hoverChance}%<tspan className="fill-muted-foreground font-normal"> at {formatRatio(hoverRatio)}</tspan>
            </text>
          </g>
        )}

        {beHit !== null && (
          <Marker marker={beHit} colorVar="--combat-behit" label={`Hits you ${String(beHit.chance)}%`} side="lower-right" />
        )}
        {hit !== null && <Marker marker={hit} colorVar="--combat-hit" label={`You hit ${String(hit.chance)}%`} side="upper-left" />}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendKey colorVar="--combat-hit" text="You hit it: your attack rating ÷ its defense" />
        <LegendKey colorVar="--combat-behit" text="It hits you: its attack rating ÷ your defense" />
      </figcaption>
    </figure>
  );
}

/** Rough width of an 11px label, to keep it inside the plot */
const labelWidth = (text: string) => text.length * 6;

/**
 * A position on the curve with its direct label. The curve only rises, so the space above-left of a point and below-right
 * of it is free: the "you hit" label goes above-left, the "hits you" label below-right, flipped at the plot's edges.
 */
function Marker({
  marker,
  colorVar,
  label,
  side,
}: {
  marker: CurveMarker;
  colorVar: string;
  label: string;
  side: 'upper-left' | 'lower-right';
}) {
  const x = xOfRatio(marker.ratio);
  const y = yOfChance(marker.chance);
  const text = marker.ratio > RATIO_MAX ? `${label} (off the chart)` : label;
  const plotRight = CHART.width - CHART.right;
  const plotBottom = CHART.height - CHART.bottom;
  let textX: number;
  let anchor: 'start' | 'end';
  let textY: number;
  if (side === 'upper-left') {
    const fitsLeft = x - 9 - labelWidth(text) >= CHART.left;
    textX = fitsLeft ? x - 9 : x + 9;
    anchor = fitsLeft ? 'end' : 'start';
    textY = y - 6 < CHART.top + 10 ? y + 16 : y - 6;
  } else {
    const fitsRight = x + 9 + labelWidth(text) <= plotRight;
    textX = fitsRight ? x + 9 : x - 9;
    anchor = fitsRight ? 'start' : 'end';
    textY = y + 14 > plotBottom - 4 ? y - 8 : y + 14;
  }
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={MARKER_RADIUS + 2} className="fill-card" />
      <circle cx={x} cy={y} r={MARKER_RADIUS} style={{ fill: `var(${colorVar})` }} />
      <text x={textX} y={textY} textAnchor={anchor} className="fill-foreground text-[11px] font-semibold tabular-nums">
        {text}
      </text>
    </g>
  );
}

function LegendKey({ colorVar, text }: { colorVar: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: `var(${colorVar})` }} />
      {text}
    </span>
  );
}

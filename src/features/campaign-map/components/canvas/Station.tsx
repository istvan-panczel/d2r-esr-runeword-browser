import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DOT_R, LABEL_FONT, LABEL_LINE, MEMBER_LABEL_DX, MEMBER_LABEL_FONT } from '../../engine/geometry';
import { memberLabel } from '../../engine/text';
import type { CampaignArea, MapStation, Point } from '../../engine/types';
import { HALO, TERRAIN_CLASS, TERRAIN_LABEL } from './canvasStyles';

interface StationProps {
  readonly station: MapStation;
  readonly areas: ReadonlyMap<number, CampaignArea>;
  /** Title of the ghost's home section ("Act II") */
  readonly ghostTitle?: string;
  readonly unplaced: boolean;
  readonly selectedId: number | null;
  readonly highlightId: number | null;
  readonly areaHref: (id: number) => string;
  /** Click / Enter on a dot (a ghost jumps to its tab instead) */
  readonly onActivate: (id: number) => void;
}

/** Plain left click / Enter: handled in the page. Modified clicks (new tab, copy link) keep the link's default. */
function handleClick(event: MouseEvent, id: number, onActivate: (id: number) => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onActivate(id);
}

function ariaLabel(area: CampaignArea | undefined, ghostTitle: string | undefined, count: number): string {
  if (area === undefined) return '';
  const parts = [count > 1 ? `${area.name} (${String(count)} identical rows)` : area.name];
  if (ghostTitle !== undefined) return `${area.name}, drawn on ${ghostTitle}`;
  if (area.officialName !== undefined) parts.push(`official name ${area.officialName}`);
  parts.push(TERRAIN_LABEL[area.terrain]);
  if (area.area.waypoint) parts.push('waypoint');
  if (area.bosses.length > 0) parts.push(`boss: ${area.bosses.join(', ')}`);
  if (area.quests.length > 0) parts.push(`quest: ${[...new Set(area.quests.map((quest) => quest.quest))].join(', ')}`);
  if (hasWarning(area)) parts.push('caution');
  if (!area.curated) parts.push('not curated yet');
  return parts.join(', ');
}

function hasWarning(area: CampaignArea): boolean {
  return area.notes.some((note) => note.warning === true) || area.teleport.length > 0 || area.entryUnknown === true;
}

interface BadgesProps {
  readonly area: CampaignArea;
  /** Centre of the first mark ('right') or of the last one ('left': the marks grow leftwards) */
  readonly at: Point;
  readonly align?: 'left' | 'right';
}

/** Tiny boss / quest / caution marks right of a dot (details live in the page's panel) */
function Badges({ area, at, align = 'right' }: BadgesProps) {
  const marks: { key: string; node: (x: number, y: number) => ReactNode }[] = [];
  if (area.bosses.length > 0)
    marks.push({
      key: 'boss',
      node: (x, y) => (
        <path
          d={`M${String(x)} ${String(y - 3.5)} L${String(x + 3.5)} ${String(y + 3)} L${String(x - 3.5)} ${String(y + 3)} z`}
          className="fill-red-600 dark:fill-red-400"
        />
      ),
    });
  if (area.quests.length > 0)
    marks.push({
      key: 'quest',
      node: (x, y) => (
        <path
          d={`M${String(x)} ${String(y - 4)} L${String(x + 3.5)} ${String(y)} L${String(x)} ${String(y + 4)} L${String(x - 3.5)} ${String(y)} z`}
          className="fill-amber-500 dark:fill-amber-400"
        />
      ),
    });
  if (hasWarning(area))
    marks.push({
      key: 'warn',
      node: (x, y) => (
        <g>
          <circle cx={x} cy={y} r={4} className="fill-orange-500 dark:fill-orange-400" />
          <path
            d={`M${String(x)} ${String(y - 2.2)} V${String(y + 0.6)} M${String(x)} ${String(y + 1.9)} V${String(y + 2.1)}`}
            className="stroke-white dark:stroke-neutral-900"
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </g>
      ),
    });
  return (
    <g aria-hidden>
      {marks.map((mark, i) => (
        <g key={mark.key}>{mark.node(align === 'right' ? at.x + i * 9 : at.x - (marks.length - 1 - i) * 9, at.y)}</g>
      ))}
    </g>
  );
}

interface DotProps {
  readonly area: CampaignArea | undefined;
  readonly at: Point;
  readonly ghost: boolean;
  readonly selected: boolean;
  readonly highlighted: boolean;
}

/** One dot: town square or terrain circle, waypoint ring, selection and search-hit rings */
function Dot({ area, at, ghost, selected, highlighted }: DotProps) {
  const town = area?.terrain === 'town';
  const shape = cn(
    'stroke-[1.5px]',
    ghost
      ? 'fill-card stroke-muted-foreground [stroke-dasharray:2_2]'
      : area === undefined
        ? 'fill-card stroke-muted-foreground'
        : TERRAIN_CLASS[area.terrain]
  );
  return (
    <>
      {/* Larger invisible hit area */}
      <circle cx={at.x} cy={at.y} r={DOT_R + 7} fill="transparent" />
      {highlighted && (
        <circle
          cx={at.x}
          cy={at.y}
          r={DOT_R + 6}
          fill="none"
          strokeWidth={2.5}
          className="animate-ping stroke-amber-500 [transform-box:fill-box] [transform-origin:center]"
        />
      )}
      {selected && <circle cx={at.x} cy={at.y} r={DOT_R + 6} fill="none" strokeWidth={2.5} className="stroke-primary" />}
      <circle
        cx={at.x}
        cy={at.y}
        r={DOT_R + 9}
        fill="none"
        strokeWidth={1.5}
        className="stroke-ring opacity-0 [stroke-dasharray:3_2] group-focus-visible:opacity-100"
      />
      {area?.area.waypoint === true && !ghost && (
        <circle cx={at.x} cy={at.y} r={DOT_R + 3} fill="none" strokeWidth={2} className="stroke-sky-500 dark:stroke-sky-400" />
      )}
      {town ? (
        <rect x={at.x - DOT_R - 1} y={at.y - DOT_R - 1} width={(DOT_R + 1) * 2} height={(DOT_R + 1) * 2} rx={3} className={shape} />
      ) : (
        <circle cx={at.x} cy={at.y} r={DOT_R} className={cn(shape, 'transition-colors group-hover:stroke-primary')} />
      )}
    </>
  );
}

interface LabelProps {
  readonly station: MapStation;
  readonly muted: boolean;
  readonly selected: boolean;
}

function Label({ station, muted, selected }: LabelProps) {
  const { label } = station;
  return (
    <text
      x={label.x}
      y={label.y}
      textAnchor="middle"
      dominantBaseline="hanging"
      className={cn(
        'text-[11.5px]',
        HALO,
        muted ? 'fill-muted-foreground italic' : 'fill-foreground group-hover:fill-primary',
        selected && 'font-semibold'
      )}
      style={{ fontSize: LABEL_FONT }}
    >
      {label.lines.map((line, i) => (
        <tspan key={line} x={label.x} dy={i === 0 ? 0 : LABEL_LINE}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** One map station: a plain area, a dungeon stack (a link per level), folded twins, or a ghost of another tab */
export function Station({ station, areas, ghostTitle, unplaced, selectedId, highlightId, areaHref, onActivate }: StationProps) {
  const ghost = station.ghostOf !== undefined;
  const isStack = station.dots.length > 1 && station.folded !== true;
  const firstId = station.ids.at(0);
  if (firstId === undefined) return null;
  const selected = selectedId !== null && station.ids.includes(selectedId);

  if (!isStack) {
    const area = areas.get(firstId);
    const at = station.dots[0] ?? { x: 0, y: 0 };
    const labelOnRight = station.label.x > at.x + DOT_R && station.label.y < at.y;
    return (
      <a
        href={areaHref(firstId)}
        data-area-id={firstId}
        aria-label={ariaLabel(area, ghostTitle, station.ids.length)}
        className="group cursor-pointer outline-none"
        onClick={(event) => {
          handleClick(event, firstId, onActivate);
        }}
      >
        <Dot
          area={area}
          at={at}
          ghost={ghost}
          selected={selected}
          highlighted={highlightId !== null && station.ids.includes(highlightId)}
        />
        {area !== undefined &&
          !ghost &&
          // Top-right of the dot, or top-left when the label sits on the right
          (labelOnRight ? (
            <Badges area={area} at={{ x: at.x - DOT_R - 6, y: at.y - DOT_R - 3 }} align="left" />
          ) : (
            <Badges area={area} at={{ x: at.x + DOT_R + 6, y: at.y - DOT_R - 3 }} />
          ))}
        <Label station={station} muted={ghost || unplaced} selected={selected} />
      </a>
    );
  }

  const first = station.dots[0] ?? { x: 0, y: 0 };
  const last = station.dots[station.dots.length - 1] ?? first;
  const base = station.label.text;
  return (
    <g>
      <rect
        x={first.x - DOT_R - 4}
        y={first.y - DOT_R - 4}
        width={(DOT_R + 4) * 2}
        height={last.y - first.y + (DOT_R + 4) * 2}
        rx={DOT_R + 4}
        strokeWidth={1.25}
        className="fill-card stroke-muted-foreground"
      />
      {station.ids.map((id, i) => {
        const area = areas.get(id);
        const at = station.dots[i] ?? first;
        const short = area === undefined ? '' : memberLabel(area.area.name, base);
        return (
          <a
            key={id}
            href={areaHref(id)}
            data-area-id={id}
            aria-label={ariaLabel(area, undefined, 1)}
            className="group cursor-pointer outline-none"
            onClick={(event) => {
              handleClick(event, id, onActivate);
            }}
          >
            <Dot area={area} at={at} ghost={false} selected={selectedId === id} highlighted={highlightId === id} />
            {short !== '' && (
              <text
                x={at.x + MEMBER_LABEL_DX}
                y={at.y}
                dominantBaseline="central"
                className={cn('fill-muted-foreground group-hover:fill-primary', HALO, selectedId === id && 'fill-foreground font-semibold')}
                style={{ fontSize: MEMBER_LABEL_FONT }}
              >
                {short}
              </text>
            )}
            {area !== undefined && <Badges area={area} at={{ x: at.x + MEMBER_LABEL_DX + (short === '' ? 4 : 20), y: at.y }} />}
          </a>
        );
      })}
      <g aria-hidden>
        <Label station={station} muted={unplaced} selected={selected} />
      </g>
    </g>
  );
}

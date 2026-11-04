import { Skull, TriangleAlert } from 'lucide-react';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { cn } from '@/lib/utils';
import type { CampaignArea, CampaignMap, CampaignSection } from '../engine/types';
import { areaBosses, headsUpLines } from '../utils/areaFacts';
import { areaListGroups, withoutLaterTwins } from '../utils/listGroups';
import { areaName } from '../utils/nearestWaypoint';
import { AreaLink } from './AreaLink';
import { WAYPOINT_CHIP_CLASS } from './mapStyles';
import { TerrainDot } from './TerrainDot';
import { terrainLabel } from '../utils/sourceLabels';

interface AreaListProps {
  readonly map: CampaignMap;
  readonly section: CampaignSection;
  readonly selectedId: number | null;
  readonly highlightId: number | null;
  readonly areaHref: (id: number) => string;
  readonly onSelect: (id: number) => void;
  readonly className?: string;
}

/**
 * The list view: every area of the section in reading order with its marks. The full fallback of the map (also the
 * only view below `lg`).
 */
export function AreaList({ map, section, selectedId, highlightId, areaHref, onSelect, className }: AreaListProps) {
  const groups = areaListGroups(section, map.areas);
  return (
    <div className={cn('space-y-4 rounded-lg border bg-card p-2', className)}>
      {groups.map((group) => (
        <div key={group.key}>
          {group.title !== null && <h3 className="px-2 pt-1 pb-1.5 text-xs font-semibold text-muted-foreground">{group.title}</h3>}
          <ol className="divide-y" aria-label={group.title ?? section.title}>
            {withoutLaterTwins(group.ids, map.areas).map((id) => {
              const area = map.areas.get(id);
              if (area === undefined) return null;
              return (
                <AreaRow
                  key={id}
                  map={map}
                  area={area}
                  selected={selectedId === id}
                  highlighted={highlightId === id}
                  unplaced={section.unplacedIds.includes(id)}
                  href={areaHref(id)}
                  onSelect={onSelect}
                />
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

interface AreaRowProps {
  readonly map: CampaignMap;
  readonly area: CampaignArea;
  readonly selected: boolean;
  readonly highlighted: boolean;
  readonly unplaced: boolean;
  readonly href: string;
  readonly onSelect: (id: number) => void;
}

function AreaRow({ map, area, selected, highlighted, unplaced, href, onSelect }: AreaRowProps) {
  const warnings = headsUpLines(area, map.edges, (id) => areaName(map.areas, id)).length;
  const bosses = areaBosses(area);
  const level = area.area.level;
  return (
    <li data-area-row={area.id}>
      <AreaLink
        id={area.id}
        href={href}
        onSelect={onSelect}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
          selected && 'bg-accent ring-1 ring-primary/40',
          highlighted && 'animate-pulse'
        )}
      >
        <span title={terrainLabel(area.terrain)} className="inline-flex">
          <TerrainDot terrain={area.terrain} size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{area.name}</span>
          {area.twins.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground" title={`${String(area.twins.length + 1)} identical areas`}>
              ×{area.twins.length + 1}
            </span>
          )}
          {area.officialName !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">({area.officialName})</span>}
          {bosses.length > 0 && (
            <span className="block truncate text-xs text-muted-foreground">
              <Skull className="mr-1 inline size-3 align-[-0.1em]" aria-hidden />
              {bosses.join(', ')}
            </span>
          )}
          {(!area.curated || unplaced) && (
            <span className="block text-xs text-muted-foreground italic">{!area.curated ? 'Not curated yet' : 'Not on the map yet'}</span>
          )}
        </span>
        {area.quests.map(
          (quest, index) =>
            quest.itemCode !== undefined && (
              <ItemIcon key={`${quest.itemCode}-${String(index)}`} item={{ kind: 'quest', code: quest.itemCode }} size={22} />
            )
        )}
        {warnings > 0 && (
          <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label={`${String(warnings)} heads up`} />
        )}
        {area.area.waypoint && <span className={cn('rounded px-1 text-[0.625rem] leading-4 font-semibold', WAYPOINT_CHIP_CLASS)}>WP</span>}
        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums" title="Monster level in Hell">
          {level === null ? '—' : `lvl ${String(level[2])}`}
        </span>
      </AreaLink>
    </li>
  );
}

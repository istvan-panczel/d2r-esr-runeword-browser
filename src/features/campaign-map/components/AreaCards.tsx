import { Link } from 'react-router-dom';
import { ArrowRight, Skull, TriangleAlert } from 'lucide-react';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { cn } from '@/lib/utils';
import type { CampaignArea, CampaignMap, CampaignSection, CampaignSectionKey } from '../engine/types';
import { areaBosses, areaEyebrow, headsUpLines, levelText } from '../utils/areaFacts';
import { areaName, entryRoutes } from '../utils/nearestWaypoint';
import { terrainLabel } from '../utils/sourceLabels';
import { AreaLink } from './AreaLink';
import { WAYPOINT_CHIP_CLASS } from './mapStyles';
import { TerrainDot } from './TerrainDot';

interface AreaCardsProps {
  readonly map: CampaignMap;
  readonly section: CampaignSection;
  readonly selectedId: number | null;
  readonly sectionTitle: (key: CampaignSectionKey) => string;
  /** The area's URL on this tab (selects it here) */
  readonly areaHref: (id: number) => string;
  /** The area's URL on its home map */
  readonly homeHref: (id: number) => string;
  readonly onSelect: (id: number) => void;
}

/**
 * The Special areas and Ubers & portals tabs: one card per area (no drawn map). A card opens the area on its home map;
 * an area whose home has no map (the uber levels) is selected in place.
 */
export function AreaCards({ map, section, selectedId, sectionTitle, areaHref, homeHref, onSelect }: AreaCardsProps) {
  const hasMap = (key: CampaignSectionKey) => map.sections.some((entry) => entry.key === key && entry.layout !== null);
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2 @8xl/page:grid-cols-3 @10xl/page:grid-cols-4">
        {section.areaIds.map((id) => {
          const area = map.areas.get(id);
          if (area === undefined) return null;
          const onMap = area.section !== section.key && hasMap(area.section);
          return (
            <li key={id}>
              <AreaCard
                map={map}
                area={area}
                selected={selectedId === id}
                eyebrow={areaEyebrow(area, sectionTitle(area.section), terrainLabel(area.terrain))}
                href={onMap ? homeHref(id) : areaHref(id)}
                onMap={onMap}
                onSelect={onSelect}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface AreaCardProps {
  readonly map: CampaignMap;
  readonly area: CampaignArea;
  readonly selected: boolean;
  readonly eyebrow: string;
  readonly href: string;
  /** The card opens the area's home map (else it selects the area here) */
  readonly onMap: boolean;
  readonly onSelect: (id: number) => void;
}

function AreaCard({ map, area, selected, eyebrow, href, onMap, onSelect }: AreaCardProps) {
  const nameOf = (id: number) => areaName(map.areas, id);
  const routes = entryRoutes(map.edges, area.id);
  const bosses = areaBosses(area);
  const warnings = headsUpLines(area, map.edges, nameOf).length;
  const level = levelText(area);
  const className = cn(
    'block h-full rounded-lg border bg-card p-3 text-sm shadow-xs transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
    selected && 'ring-2 ring-primary/50'
  );
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TerrainDot terrain={area.terrain} size={12} />
        {eyebrow}
      </span>
      <span className="mt-0.5 flex items-start justify-between gap-2">
        <span className="font-semibold">
          {area.name}
          {area.officialName !== undefined && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">({area.officialName})</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {area.quests.map(
            (quest, index) =>
              quest.itemCode !== undefined && (
                <ItemIcon key={`${quest.itemCode}-${String(index)}`} item={{ kind: 'quest', code: quest.itemCode }} size={24} />
              )
          )}
          {area.area.waypoint && (
            <span className={cn('rounded px-1 text-[0.625rem] leading-4 font-semibold', WAYPOINT_CHIP_CLASS)}>WP</span>
          )}
        </span>
      </span>
      {bosses.length > 0 && (
        <span className="mt-1 block text-xs text-muted-foreground">
          <Skull className="mr-1 inline size-3 align-[-0.1em]" aria-hidden />
          {bosses.join(', ')}
        </span>
      )}
      {level !== null && <span className="mt-1 block text-xs text-muted-foreground tabular-nums">Monster level {level}</span>}
      {area.entry !== undefined && <span className="mt-1.5 block">{area.entry}</span>}
      {routes.map(
        (edge) =>
          edge.via !== undefined && (
            <span key={`${String(edge.from)}-${edge.kind}`} className="mt-1.5 block">
              {edge.kind === 'cube' ? 'Cube' : 'Portal'}: {edge.via}
              <span className="text-muted-foreground"> (from {nameOf(edge.from)})</span>
            </span>
          )
      )}
      {area.entryUnknown === true && <span className="mt-1.5 block text-muted-foreground italic">No known entrance</span>}
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {warnings > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-3" aria-hidden />
            {warnings} heads up
          </span>
        )}
        {!area.curated && <span className="text-muted-foreground italic">Not curated yet</span>}
        {onMap && (
          <span className="ml-auto inline-flex items-center gap-1 text-primary">
            Show on map
            <ArrowRight className="size-3" aria-hidden />
          </span>
        )}
      </span>
    </>
  );
  // A card into another tab is a plain navigation (Back returns here); in place it selects like a station.
  return onMap ? (
    <Link to={href} className={className}>
      {body}
    </Link>
  ) : (
    <AreaLink id={area.id} href={href} onSelect={onSelect} className={className}>
      {body}
    </AreaLink>
  );
}

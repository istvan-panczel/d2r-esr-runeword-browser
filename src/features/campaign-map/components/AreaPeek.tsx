import type { CampaignArea, CampaignMap } from '../engine/types';
import { areaBosses, headsUpLines, levelText } from '../utils/areaFacts';
import { areaName } from '../utils/nearestWaypoint';
import { terrainLabel } from '../utils/sourceLabels';

interface AreaPeekProps {
  readonly map: CampaignMap;
  readonly area: CampaignArea;
  readonly itemNames: ReadonlyMap<string, string> | null;
}

/** The hover / focus peek of a map station: name, kind, waypoint, levels, quest items, bosses, the first caveats. */
export function AreaPeek({ map, area, itemNames }: AreaPeekProps) {
  const level = levelText(area);
  const bosses = areaBosses(area);
  const items = area.quests.map((quest) => (quest.itemCode === undefined ? quest.quest : (itemNames?.get(quest.itemCode) ?? quest.quest)));
  const warnings = headsUpLines(area, map.edges, (id) => areaName(map.areas, id)).filter((line) => line.spoiler !== true);
  return (
    <div className="space-y-1">
      <p className="font-semibold">{area.name}</p>
      <p className="text-xs text-muted-foreground">
        {terrainLabel(area.terrain)}
        {area.area.waypoint ? ' · Waypoint' : ''}
        {level === null ? '' : ` · Monster level ${level}`}
      </p>
      {items.length > 0 && <p>Quest: {[...new Set(items)].join(', ')}</p>}
      {bosses.length > 0 && <p>Boss: {bosses.join(', ')}</p>}
      {warnings.slice(0, 2).map((line) => (
        <p key={line.key} className="text-xs text-amber-600 dark:text-amber-400">
          {line.text}
        </p>
      ))}
      {warnings.length > 2 && <p className="text-xs text-muted-foreground">and {warnings.length - 2} more in the details</p>}
      {!area.curated && <p className="text-xs text-muted-foreground italic">Not curated yet</p>}
    </div>
  );
}

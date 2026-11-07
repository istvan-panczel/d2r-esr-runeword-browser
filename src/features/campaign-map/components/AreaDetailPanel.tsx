import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Info, List, MapPin, Skull, TriangleAlert, X } from 'lucide-react';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/components/ui/button';
import { DROP_FINDER_URL } from '@/core/navigation/navConfig';
import { GAME_DATA_URL_PARAM_KEYS } from '@/features/game-data/constants/urlParams';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import type { MapBoss, PerDifficulty } from '@/features/game-data/engine/schema';
import { officialDocsUrl } from '@/features/guide/engine/linkSchemes';
import { cn } from '@/lib/utils';
import type { CampaignArea, CampaignMap, CampaignSectionKey, QuestFact } from '../engine/types';
import { MAP_BOSS_FACTS } from '../data/mapBosses';
import { areaBosses, areaEyebrow, headsUpLines, plainNotes, type HeadsUpLine } from '../utils/areaFacts';
import { zoneBossSummary } from '../utils/mapBossFacts';
import { areaConnections, areaName, entryRoutes, nearestWaypoints, type AreaConnection } from '../utils/nearestWaypoint';
import { EDGE_KIND_LABELS, terrainLabel } from '../utils/sourceLabels';
import { AreaLink } from './AreaLink';
import { FactSourceLabel } from './FactSourceLabel';
import { MapBossSection } from './MapBossSection';
import { EDGE_TEXT_CLASS, ONE_WAY_TEXT_CLASS, WARNING_BOX_CLASS, WAYPOINT_CHIP_CLASS } from './mapStyles';

const OFFICIAL_MAPS_URL = officialDocsUrl('Eastern Sun Resurrected Maps.html');
const OFFICIAL_ENDGAME_MAPS_URL = officialDocsUrl('endgame_maps.htm');
const LINK_CLASS = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';
const MORE_LINK_CLASS = 'inline-flex items-center gap-1.5 text-primary hover:underline';

interface AreaDetailPanelProps {
  readonly map: CampaignMap;
  readonly area: CampaignArea;
  /** areas.json `mapBosses`: the boss section of the endgame map zones */
  readonly mapBosses: readonly MapBoss[];
  /** Item names by code (null while loading) */
  readonly itemNames: ReadonlyMap<string, string> | null;
  readonly sectionTitle: (key: CampaignSectionKey) => string;
  readonly areaHref: (id: number) => string;
  readonly onSelect: (id: number) => void;
  readonly onClose: () => void;
  /** Absolute share URL of this area */
  readonly getShareUrl: () => string;
}

/**
 * The selected area: header, quest items, heads up, notes, getting there, monsters, more links. Every curated fact
 * carries its source label. Sections without content are left out.
 */
export function AreaDetailPanel({
  map,
  area,
  mapBosses,
  itemNames,
  sectionTitle,
  areaHref,
  onSelect,
  onClose,
  getShareUrl,
}: AreaDetailPanelProps) {
  const nameOf = (id: number) => areaName(map.areas, id);
  const bosses = areaBosses(area);
  const headsUp = headsUpLines(area, map.edges, nameOf);
  const notes = plainNotes(area);
  const bossSummary = zoneBossSummary(map, area, mapBosses, MAP_BOSS_FACTS);
  const headingId = `campaign-area-${String(area.id)}`;

  return (
    <section aria-labelledby={headingId} className="rounded-lg border bg-card text-sm shadow-xs">
      <header className="space-y-1.5 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{areaEyebrow(area, sectionTitle(area.section), terrainLabel(area.terrain))}</p>
          <Button variant="ghost" size="icon" className="-mt-1.5 -mr-2 size-7" onClick={onClose} aria-label="Close the area details">
            <X className="size-4" />
          </Button>
        </div>
        <h2 id={headingId} className="text-lg leading-tight font-semibold">
          {area.name}
        </h2>
        {area.officialName !== undefined && (
          <p className="text-xs text-muted-foreground">
            Official Maps page: <span className="text-foreground">{area.officialName}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {area.area.waypoint ? (
            <span className={cn('rounded px-1.5 text-xs leading-5 font-semibold', WAYPOINT_CHIP_CLASS)}>Waypoint</span>
          ) : (
            <Chip>No waypoint</Chip>
          )}
          {bosses.map((boss) => (
            <Chip key={boss}>
              <Skull className="size-3" aria-hidden />
              {boss}
            </Chip>
          ))}
          {area.special && area.section !== 'maps' && <Chip>Special area</Chip>}
          {area.twins.length > 0 && (
            <Chip title={`levels.txt Ids ${[area.id, ...area.twins].join(', ')}`}>One of {area.twins.length + 1} identical areas</Chip>
          )}
          {!area.curated && (
            <Chip className="border-dashed" title="New in this ESR version: the map has no hand-written facts for it yet">
              Not curated yet
            </Chip>
          )}
        </div>
      </header>

      {area.quests.length > 0 && (
        <PanelSection title="Quest items">
          <ul className="space-y-3">
            {area.quests.map((quest, index) => (
              <QuestRow key={`${quest.quest}-${String(index)}`} quest={quest} itemNames={itemNames} />
            ))}
          </ul>
        </PanelSection>
      )}

      {headsUp.length > 0 && (
        <PanelSection title="Heads up">
          <ul className="space-y-1.5">
            {headsUp.map((line) => (
              <HeadsUpRow key={line.key} line={line} />
            ))}
          </ul>
        </PanelSection>
      )}

      {bossSummary !== null && (
        <PanelSection title={bossSummary.bosses.length > 1 ? 'Bosses' : 'Boss'}>
          <MapBossSection summary={bossSummary} nameOf={nameOf} areaHref={areaHref} onSelect={onSelect} areaId={area.id} />
        </PanelSection>
      )}

      {notes.length > 0 && (
        <PanelSection title="Notes">
          <ul className="list-disc space-y-1 pl-4">
            {notes.map((note) => (
              <li key={note.text}>
                {note.text}
                <FactSourceLabel source={note.source} verify={note.verify} />
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      <GettingThere map={map} area={area} nameOf={nameOf} areaHref={areaHref} onSelect={onSelect} />

      <PanelSection title="Monsters">
        <MonsterTable area={area} />
      </PanelSection>

      <PanelSection title="More">
        <ul className="space-y-1.5">
          <li>
            <Link to={`/game-data/areas?search=${encodeURIComponent(`"${area.area.name}"`)}`} className={MORE_LINK_CLASS}>
              <List className="size-3.5" aria-hidden />
              Areas page row
            </Link>
          </li>
          {area.quests.some((quest) => quest.itemCode !== undefined) && <CubeLink family="quest-items" label="Quest item cube recipes" />}
          {area.area.mapItem !== undefined && <CubeLink family="map-portals" label="Map portal recipes" />}
          {area.section === 'portals' && <CubeLink family="uber-keys" label="Pandemonium keys and portals" />}
          {area.area.level !== null && (
            <li>
              <ExternalLink href={DROP_FINDER_URL} className={MORE_LINK_CLASS} iconClassName="size-3.5">
                Drop Finder (official)
              </ExternalLink>
            </li>
          )}
          <li>
            <ExternalLink
              href={area.section === 'maps' ? OFFICIAL_ENDGAME_MAPS_URL : OFFICIAL_MAPS_URL}
              className={MORE_LINK_CLASS}
              iconClassName="size-3.5"
            >
              {area.section === 'maps' ? 'Official Endgame Maps page' : 'Official Maps page'}
            </ExternalLink>
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>levels.txt Id {area.id}</span>
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>
      </PanelSection>
    </section>
  );
}

function PanelSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="border-b p-4 last:border-b-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Chip({ children, className, title }: { readonly children: ReactNode; readonly className?: string; readonly title?: string }) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 text-xs leading-5 text-muted-foreground', className)}
    >
      {children}
    </span>
  );
}

function CubeLink({ family, label }: { readonly family: string; readonly label: string }) {
  return (
    <li>
      <Link to={`/game-data/cube?${GAME_DATA_URL_PARAM_KEYS.FAMILY}=${encodeURIComponent(family)}`} className={MORE_LINK_CLASS}>
        <ArrowRight className="size-3.5" aria-hidden />
        {label}
      </Link>
    </li>
  );
}

function QuestRow({ quest, itemNames }: { readonly quest: QuestFact; readonly itemNames: ReadonlyMap<string, string> | null }) {
  const itemName = quest.itemCode === undefined ? undefined : itemNames?.get(quest.itemCode);
  return (
    <li className="flex gap-3">
      {quest.itemCode !== undefined && (
        <ItemIcon item={{ kind: 'quest', code: quest.itemCode }} size={40} className="rounded-md border bg-muted/50 p-0.5" />
      )}
      <div className="min-w-0">
        <p className="font-medium">{itemName ?? quest.quest}</p>
        {itemName !== undefined && <p className="text-xs text-muted-foreground">Quest: {quest.quest}</p>}
        {quest.how !== undefined && <p className="mt-0.5">{quest.how}</p>}
        <FactSourceLabel source={quest.source} verify={quest.verify} className="ml-0" />
      </div>
    </li>
  );
}

function HeadsUpRow({ line }: { readonly line: HeadsUpLine }) {
  const label = line.source === undefined ? null : <FactSourceLabel source={line.source} verify={line.verify} />;
  return (
    <li className={cn('flex gap-2 rounded-md border px-2 py-1.5', WARNING_BOX_CLASS)}>
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      {line.spoiler === true ? (
        <details className="min-w-0">
          <summary className="cursor-pointer text-muted-foreground">Hidden exit: show the official hint</summary>
          <p className="mt-1">
            {line.text}
            {label}
          </p>
        </details>
      ) : (
        <p className="min-w-0">
          {line.text}
          {label}
        </p>
      )}
    </li>
  );
}

interface GettingThereProps {
  readonly map: CampaignMap;
  readonly area: CampaignArea;
  readonly nameOf: (id: number) => string;
  readonly areaHref: (id: number) => string;
  readonly onSelect: (id: number) => void;
}

function GettingThere({ map, area, nameOf, areaHref, onSelect }: GettingThereProps) {
  const nearest = nearestWaypoints(map, area.id);
  const routes = entryRoutes(map.edges, area.id).filter((edge) => edge.via !== undefined);
  const connections = areaConnections(map.edges, area.id);
  const entryRoute = routes.at(0);
  const areaLink = (id: number) => (
    <AreaLink key={id} id={id} href={areaHref(id)} onSelect={onSelect} className={LINK_CLASS}>
      {nameOf(id)}
    </AreaLink>
  );

  return (
    <PanelSection title="Getting there">
      <div className="space-y-2">
        {area.entryUnknown === true && (
          <p className="flex gap-1.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>No known entrance: neither the game files nor the official pages say how to get in.</span>
          </p>
        )}
        {/* The entry text already tells the route in: it carries the route's source instead of repeating it */}
        {area.entry !== undefined && (
          <p>
            {area.entry}
            {entryRoute !== undefined && <FactSourceLabel source={entryRoute.source} verify={entryRoute.verify} />}
          </p>
        )}
        {area.entry === undefined &&
          routes.map((edge) => (
            <p key={`${String(edge.from)}-${edge.kind}`}>
              {edge.kind === 'cube' ? 'Cube' : 'Portal'}: {edge.via} (from {nameOf(edge.from)})
              <FactSourceLabel source={edge.source} verify={edge.verify} />
            </p>
          ))}
        {nearest !== null &&
          (nearest.distance === 0 ? (
            <p className="flex gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>This area has a waypoint.</span>
            </p>
          ) : (
            <p className="flex gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                Nearest {nearest.ids.length === 1 ? 'waypoint' : 'waypoints'}:{' '}
                {nearest.ids.map((id, index) => (
                  <span key={id}>
                    {index > 0 && ', '}
                    {areaLink(id)}
                  </span>
                ))}{' '}
                · {nearest.distance} {nearest.distance === 1 ? 'area' : 'areas'} away
              </span>
            </p>
          ))}
        {connections.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Connected areas">
            {connections.map((connection) => (
              <ConnectionChip
                key={`${String(connection.id)}-${connection.edge.kind}-${connection.direction}`}
                connection={connection}
                name={nameOf(connection.id)}
                areaHref={areaHref}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </PanelSection>
  );
}

const DIRECTION_GLYPH: Record<AreaConnection['direction'], string> = { both: '', out: '→ ', in: '← ' };

function ConnectionChip({
  connection,
  name,
  areaHref,
  onSelect,
}: {
  readonly connection: AreaConnection;
  readonly name: string;
  readonly areaHref: (id: number) => string;
  readonly onSelect: (id: number) => void;
}) {
  const { edge, direction } = connection;
  const kind = EDGE_KIND_LABELS[edge.kind];
  const title = [
    kind,
    direction === 'out' ? 'one way from here' : direction === 'in' ? 'one way into this area' : null,
    edge.via ?? null,
    edge.verify === true ? 'unconfirmed' : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  return (
    <li>
      <AreaLink
        id={connection.id}
        href={areaHref(connection.id)}
        onSelect={onSelect}
        title={title}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs transition-colors hover:border-primary/50 hover:bg-accent/40',
          edge.kind === 'border' || edge.kind === 'passage' ? '' : 'border-dashed',
          edge.verify === true && 'border-dashed'
        )}
      >
        {direction !== 'both' && <span className={ONE_WAY_TEXT_CLASS}>{DIRECTION_GLYPH[direction]}</span>}
        {(edge.kind === 'portal' || edge.kind === 'cube' || edge.kind === 'act') && (
          <span className={EDGE_TEXT_CLASS[edge.kind]} aria-hidden>
            ⟲
          </span>
        )}
        {name}
        <span className="sr-only"> ({title})</span>
      </AreaLink>
    </li>
  );
}

const DIFFICULTIES = ['Normal', 'Nightmare', 'Hell'] as const;

function MonsterTable({ area }: { readonly area: CampaignArea }) {
  const { level, density, uniques } = area.area;
  if (level === null && density === null && uniques === null) return <p className="text-muted-foreground">No monsters.</p>;
  const rows: { label: string; values: PerDifficulty<string> | null }[] = [
    { label: 'Level', values: level === null ? null : [String(level[0]), String(level[1]), String(level[2])] },
    { label: 'Density', values: density === null ? null : [String(density[0]), String(density[1]), String(density[2])] },
    {
      label: 'Unique packs',
      values: uniques === null ? null : [packText(uniques[0]), packText(uniques[1]), packText(uniques[2])],
    },
  ];
  return (
    <table className="w-full text-sm tabular-nums">
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th scope="col" className="py-1 text-left font-medium">
            <span className="sr-only">Value</span>
          </th>
          {DIFFICULTIES.map((difficulty) => (
            <th key={difficulty} scope="col" className="py-1 text-right font-medium">
              {difficulty}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(
          (row) =>
            row.values !== null && (
              <tr key={row.label} className="border-t">
                <th scope="row" className="py-1 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td key={DIFFICULTIES[index]} className="py-1 text-right">
                    {value}
                  </td>
                ))}
              </tr>
            )
        )}
      </tbody>
    </table>
  );
}

function packText([min, max]: readonly [number, number]): string {
  return min === max ? String(min) : `${String(min)}–${String(max)}`;
}

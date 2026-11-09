import { Check, Map as MapIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { ResultsBar } from '@/components/ResultsBar';
import { SectionHeader } from '@/components/SectionHeader';
import { NumberFilterInput } from '@/core/components/RecipeCommonFilters';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { campaignMapAreaPath } from '@/features/campaign-map/utils/urlState';
import type { Area, AreasBundle, PerDifficulty } from '../engine/schema';
import { EnhanceSearch } from '../components/EnhanceParts';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { useGameData } from '../hooks/useGameData';
import {
  AREA_LEVEL_RANGE,
  buildAreaSections,
  encodeAreasState,
  filterAreas,
  readAreasState,
  sectionAreaCount,
  type AreaSection,
  type AreasState,
} from '../utils/areas';
import { formatCount } from '../utils/cube';

const AREAS_FILES = ['areas'] as const;
const AREAS_ROUTE = 'game-data/areas';
const SEARCH_DEBOUNCE_MS = 300;
const LEVEL_DEBOUNCE_MS = 400;
const COLUMN_COUNT = 6;

export function AreasScreen() {
  const gameData = useGameData(AREAS_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return <AreasBrowser bundle={gameData.data.areas} />;
}

/** The page state lives in the URL (search, min / max monster level), so links and the back button keep it. */
function AreasBrowser({ bundle }: { readonly bundle: AreasBundle }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readAreasState(searchParams);

  const update = (patch: Partial<AreasState>) => {
    setSearchParams(encodeAreasState({ ...state, ...patch }), { replace: true });
  };

  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );
  const [minLvl, setMinLvl, commitMinLvl] = useDebouncedFilterValue(
    state.minLvl,
    (value) => {
      update({ minLvl: value });
    },
    LEVEL_DEBOUNCE_MS
  );
  const [maxLvl, setMaxLvl, commitMaxLvl] = useDebouncedFilterValue(
    state.maxLvl,
    (value) => {
      update({ maxLvl: value });
    },
    LEVEL_DEBOUNCE_MS
  );

  const names = new Map(bundle.areas.map((area) => [area.id, area.name]));
  const shown = filterAreas(bundle.areas, state);
  const sections = buildAreaSections(shown);
  const getShareUrl = () => buildShareUrl(AREAS_ROUTE, encodeAreasState({ search, minLvl, maxLvl }));
  const reset = () => {
    commitSearch('');
    commitMinLvl(null);
    commitMaxLvl(null);
    setSearchParams(new URLSearchParams(), { replace: false });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every area from the game files with its monster level, monster density and unique / champion pack count in Normal, Nightmare and
        Hell, its waypoint and the areas it connects to, then the endgame map zones by tier with their bosses. Monster levels are the
        expansion values the game uses; the map entrances are left out.
      </p>

      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            value={search}
            onChange={setSearch}
            onClear={() => {
              commitSearch('');
            }}
            placeholder="Search areas, map zones or bosses..."
            hint="Search area, zone and boss names;"
          />
          <NumberFilterInput
            id="areas-minLvl"
            hint="Min monster level."
            label="Min monster level"
            placeholder="Min lvl"
            max={AREA_LEVEL_RANGE.max}
            value={minLvl}
            onChange={setMinLvl}
            onClear={() => {
              commitMinLvl(null);
            }}
            clearLabel="Clear min monster level"
          />
          <NumberFilterInput
            id="areas-maxLvl"
            hint="Max monster level."
            label="Max monster level"
            placeholder="Max lvl"
            max={AREA_LEVEL_RANGE.max}
            value={maxLvl}
            onChange={setMaxLvl}
            onClear={() => {
              commitMaxLvl(null);
            }}
            clearLabel="Clear max monster level"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Share this view.</p>
              <CopyLinkHelpButton />
            </div>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          An area matches the level range when its Normal, Nightmare or Hell monster level is inside it; towns and areas without monsters
          never match a set level.
        </p>
      </FilterPanel>

      <ResultsBar summary={`Showing ${formatCount(shown.length)} of ${formatCount(bundle.areas.length)} areas`} />

      {sections.length === 0 ? (
        <EmptyState onReset={reset} />
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <AreaTable key={section.key} section={section} nameOf={(id) => names.get(id) ?? String(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

interface AreaTableProps {
  readonly section: AreaSection;
  readonly nameOf: (id: number) => string;
}

const HEAD_CLASS = 'px-2 py-1.5 text-left font-medium whitespace-nowrap';
const CELL_CLASS = 'border-t px-2 py-1.5 align-top';
/** The Area column stays visible while the table scrolls sideways on phones */
const STICKY_CLASS = 'sticky left-0 z-10 bg-card';

function AreaTable({ section, nameOf }: AreaTableProps) {
  const headingId = `areas-${section.key}`;
  return (
    <section aria-labelledby={headingId}>
      <SectionHeader id={headingId} title={section.title} count={formatCount(sectionAreaCount(section))} />
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className={`${HEAD_CLASS} ${STICKY_CLASS} bg-muted`}>
                Area
              </th>
              <th scope="col" className={HEAD_CLASS} title="Normal / Nightmare / Hell">
                Monster level
              </th>
              <th scope="col" className={HEAD_CLASS} title="Normal / Nightmare / Hell">
                Density
              </th>
              <th scope="col" className={HEAD_CLASS} title="Unique and champion packs, min–max, Normal / Nightmare / Hell">
                Unique packs
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Waypoint
              </th>
              <th scope="col" className={HEAD_CLASS}>
                Connects to
              </th>
            </tr>
          </thead>
          {section.blocks.map((block) => (
            <tbody key={block.zone ?? 'all'}>
              {block.zone !== null && (
                <tr>
                  <th colSpan={COLUMN_COUNT} scope="colgroup" className="border-t bg-muted/60 px-2 py-1 text-left font-semibold">
                    {block.zone}
                  </th>
                </tr>
              )}
              {block.areas.map((area) => (
                <AreaRow key={area.id} area={area} nameOf={nameOf} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

function AreaRow({ area, nameOf }: { readonly area: Area; readonly nameOf: (id: number) => string }) {
  return (
    <tr>
      <th scope="row" className={`${CELL_CLASS} ${STICKY_CLASS} max-w-[12rem] text-left font-medium sm:max-w-none`}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>{area.name}</span>
          {area.preventTownPortal === true && (
            <Badge variant="outline" className="px-1.5 py-0 text-[0.65rem] font-normal text-muted-foreground">
              No town portal
            </Badge>
          )}
        </span>
        {area.boss !== undefined && <span className="block text-xs font-normal text-muted-foreground">Boss: {area.boss}</span>}
        <Link
          to={campaignMapAreaPath(area.id)}
          className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
          aria-label={`Show ${area.name} on the campaign map`}
        >
          <MapIcon className="size-3" aria-hidden />
          Show on map
        </Link>
      </th>
      <td className={`${CELL_CLASS} whitespace-nowrap tabular-nums`}>{formatTriple(area.level)}</td>
      <td className={`${CELL_CLASS} whitespace-nowrap tabular-nums`}>{formatTriple(area.density)}</td>
      <td className={`${CELL_CLASS} whitespace-nowrap tabular-nums`}>
        {formatTriple(
          area.uniques === null ? null : area.uniques.map(([min, max]) => (min === max ? String(min) : `${String(min)}–${String(max)}`))
        )}
      </td>
      <td className={CELL_CLASS}>
        {area.waypoint ? (
          <Check className="size-4 text-primary" aria-label="Waypoint" />
        ) : (
          <span className="text-muted-foreground" aria-label="No waypoint">
            —
          </span>
        )}
      </td>
      <td className={`${CELL_CLASS} min-w-[12rem] text-muted-foreground`}>
        {area.connections.length === 0 ? '—' : area.connections.map(nameOf).join(', ')}
      </td>
    </tr>
  );
}

/** "2 / 38 / 68"; "—" when the area has no value */
function formatTriple(values: PerDifficulty<number> | readonly string[] | null): string {
  if (values === null) return '—';
  return values.map(String).join(' / ');
}

function EmptyState({ onReset }: { readonly onReset: () => void }) {
  return (
    <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
      <p>No area matches.</p>
      <p>
        Try fewer words or a wider level range, or{' '}
        <button
          type="button"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          onClick={onReset}
        >
          show every area
        </button>
        .
      </p>
    </div>
  );
}

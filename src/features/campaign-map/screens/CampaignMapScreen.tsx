import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { List, Map as MapIcon } from 'lucide-react';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { PageShell } from '@/components/PageShell';
import { PeekPopover } from '@/components/PeekPopover';
import { ToolbarCard } from '@/components/ToolbarCard';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import { cn } from '@/lib/utils';
import { buildCampaignMap } from '../engine/buildCampaignMap';
import type { CampaignMap, CampaignSection, CampaignSectionKey } from '../engine/types';
import { AreaCards } from '../components/AreaCards';
import { AreaDetailPanel } from '../components/AreaDetailPanel';
import { AreaList } from '../components/AreaList';
import { AreaPeek } from '../components/AreaPeek';
import { CampaignMapCanvas } from '../components/CampaignMapCanvas';
import { CampaignSearch } from '../components/CampaignSearch';
import { MapLegend } from '../components/MapLegend';
import { SectionNotes } from '../components/SectionNotes';
import { useAreaPeek } from '../hooks/useAreaPeek';
import { useItemNamesByCode } from '../hooks/useItemNamesByCode';
import { isWideScreen, usePanelScroll } from '../hooks/usePanelScroll';
import { twinRepresentative } from '../utils/listGroups';
import { SECTION_TAB_LABELS } from '../utils/sourceLabels';
import {
  CAMPAIGN_MAP_ROUTE,
  encodeCampaignMapState,
  readCampaignMapUrlState,
  resolveCampaignMapState,
  type CampaignMapState,
} from '../utils/urlState';

const AREA_FILES = ['areas'] as const;
/** How long a search hit or a ghost jump pulses */
const HIGHLIGHT_MS = 1400;
const ACT_KEYS: readonly CampaignSectionKey[] = ['act1', 'act2', 'act3', 'act4', 'act5'];

/** Build problems (a stale curated id, a renamed area) are for the integrity test, not the visitor: logged once. */
let problemsLogged = false;

export function CampaignMapScreen() {
  const gameData = useGameData(AREA_FILES);
  const manifest = useManifest();
  const version = manifest?.esrVersion;
  return (
    <PageShell
      title="Campaign Map"
      meta={
        <p>
          Every act, special area, uber portal and endgame map{version === undefined ? '' : ` of ESR ${version}`}: areas from the game files
          (levels.txt), quests and notes from the official Maps page.
        </p>
      }
    >
      {gameData.status === 'loading' && <GameDataLoading />}
      {gameData.status === 'error' && <GameDataError error={gameData.error} onRetry={gameData.retry} />}
      {gameData.status === 'ready' && <CampaignMapBrowser map={buildCampaignMap(gameData.data.areas.areas)} version={version} />}
    </PageShell>
  );
}

/** The first visible element of an area (map station or list row) inside `root`; the hidden view's copy is skipped */
function visibleAreaElement(root: HTMLElement | null, id: number): Element | null {
  if (root === null) return null;
  for (const element of root.querySelectorAll(`[data-area-id="${String(id)}"], [data-area-row="${String(id)}"]`)) {
    if (element.getClientRects().length > 0) return element;
  }
  return null;
}

function focusArea(root: HTMLElement | null, id: number): void {
  const element = visibleAreaElement(root, id);
  if (element === null) return;
  const FOCUSABLE = 'a[href], button, [tabindex]';
  const target = element.matches(FOCUSABLE) ? element : (element.closest(FOCUSABLE) ?? element.querySelector(FOCUSABLE));
  if (target instanceof HTMLElement || target instanceof SVGElement) target.focus();
}

interface CampaignMapBrowserProps {
  readonly map: CampaignMap;
  readonly version: string | undefined;
}

/** The page state (tab, selected area, Map / List) lives in the URL; selecting an area replaces the entry. */
function CampaignMapBrowser({ map, version }: CampaignMapBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = resolveCampaignMapState(readCampaignMapUrlState(searchParams), map);
  const itemNames = useItemNamesByCode();
  // Arriving with an area in the URL (a link from another page, a shared link) shows it like a search hit
  const [highlightId, setHighlightId] = useState<number | null>(() => state.area);
  const rootRef = useRef<HTMLDivElement>(null);
  const { panelRef, requestScroll } = usePanelScroll(state.area);
  const { peek, peekId, wrapperProps, close: closePeek } = useAreaPeek();
  /** False while a panel scroll (below `lg`) is coming: the pulse then does not scroll the map or list too */
  const scrollToHighlight = useRef(true);

  const homeOf = (id: number) => map.areas.get(id)?.section;
  const sectionTitle = (key: CampaignSectionKey) => map.sections.find((entry) => entry.key === key)?.title ?? SECTION_TAB_LABELS[key];
  const section = map.sections.find((entry) => entry.key === state.tab);
  const belongsTo = (key: CampaignSectionKey, id: number) => map.sections.find((entry) => entry.key === key)?.areaIds.includes(id) === true;

  const query = (next: CampaignMapState) => {
    const params = encodeCampaignMapState(next, homeOf).toString();
    return `/${CAMPAIGN_MAP_ROUTE}${params === '' ? '' : `?${params}`}`;
  };
  const go = (next: CampaignMapState, replace: boolean) => {
    setSearchParams(encodeCampaignMapState(next, homeOf), { replace });
  };
  /** The area on this tab when it belongs here, else on its home tab */
  const targetFor = (id: number): CampaignMapState => ({
    ...state,
    tab: belongsTo(state.tab, id) ? state.tab : (homeOf(id) ?? state.tab),
    area: id,
  });
  const areaHref = (id: number) => query(targetFor(id));
  const homeHref = (id: number) => query({ ...state, tab: homeOf(id) ?? state.tab, area: id });
  const pulse = (id: number, scroll = true) => {
    scrollToHighlight.current = scroll;
    setHighlightId(id);
  };

  // Twins (Tal Rasha's Tomb 67) are selected, pulsed and focused under the id their station and row carry (66).
  const select = (anyId: number) => {
    const id = twinRepresentative(map.areas, anyId);
    const next = targetFor(id);
    const panelScroll = requestScroll();
    closePeek();
    go(next, next.tab === state.tab);
    if (next.tab !== state.tab) pulse(id, !panelScroll);
  };
  const jump = (key: CampaignSectionKey, anyId: number) => {
    const id = twinRepresentative(map.areas, anyId);
    closePeek();
    go({ ...state, tab: key, area: id }, false);
    pulse(id);
  };
  const pick = (anyId: number) => {
    const id = twinRepresentative(map.areas, anyId);
    const tab = homeOf(id) ?? state.tab;
    closePeek();
    go({ ...state, tab, area: id }, tab === state.tab);
    pulse(id);
  };
  /** Clears the selection and puts focus back on the area's station or row (panel Close and Esc) */
  const clear = () => {
    const id = state.area;
    go({ ...state, area: null }, true);
    if (id !== null) focusArea(rootRef.current, id);
  };

  useEffect(() => {
    if (problemsLogged || map.problems.length === 0) return;
    problemsLogged = true;
    console.warn(`[Campaign map] ${String(map.problems.length)} problem(s) in the curated data:`, map.problems);
  }, [map]);

  // On arrival below `lg` the detail panel (above the list) is what to scroll to, not the list row. Once per mount.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    if (state.area === null || isWideScreen()) return;
    scrollToHighlight.current = false;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Search hit / jump: scroll the area into view once the tab has rendered, then stop the pulse.
  useEffect(() => {
    if (highlightId === null) return;
    if (scrollToHighlight.current)
      visibleAreaElement(rootRef.current, highlightId)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const timer = window.setTimeout(() => {
      setHighlightId(null);
    }, HIGHLIGHT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightId, state.tab]);

  // Esc clears the selection and puts focus back on the area (search and popovers handle their own Esc first).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || state.area === null) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      clear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  if (section === undefined) return <p className="text-sm text-muted-foreground">The campaign map has no sections.</p>;

  const selectedArea = state.area === null ? undefined : map.areas.get(state.area);
  const peekArea = peekId === null ? undefined : map.areas.get(peekId);
  const getShareUrl = () => buildShareUrl(CAMPAIGN_MAP_ROUTE, encodeCampaignMapState(state, homeOf));
  const tabHref = (key: CampaignSectionKey) =>
    query({ ...state, tab: key, area: state.area !== null && belongsTo(key, state.area) ? state.area : null });
  const hasLayout = section.layout !== null;

  return (
    <div ref={rootRef} className="space-y-3">
      <ToolbarCard>
        <div className="flex flex-wrap items-center gap-2">
          <CampaignSearch map={map} itemNames={itemNames} sectionTitle={sectionTitle} onPick={pick} />
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>

        <SectionTabs sections={map.sections} active={state.tab} tabHref={tabHref} onSwitch={closePeek} />

        {hasLayout && (
          <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 lg:flex">
            <ViewToggle
              view={state.view}
              onChange={(view) => {
                go({ ...state, view }, true);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Hover or focus an area to peek · click to select · <kbd className="rounded border px-1 font-mono text-[0.6875rem]">/</kbd>{' '}
              search · <kbd className="rounded border px-1 font-mono text-[0.6875rem]">Esc</kbd> clears
            </p>
          </div>
        )}
      </ToolbarCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start @9xl/page:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          {!hasLayout ? (
            <AreaCards
              map={map}
              section={section}
              selectedId={state.area}
              sectionTitle={sectionTitle}
              areaHref={areaHref}
              homeHref={homeHref}
              onSelect={select}
            />
          ) : (
            <>
              {state.view === 'map' && (
                <div className="hidden rounded-lg border bg-card p-2 lg:block">
                  <div className="overflow-x-auto" {...wrapperProps}>
                    <CampaignMapCanvas
                      map={map}
                      section={section}
                      selectedId={state.area}
                      highlightId={highlightId}
                      areaHref={areaHref}
                      onSelect={select}
                      onJump={jump}
                    />
                  </div>
                  <p className="px-1 text-right text-[0.625rem] text-muted-foreground">
                    {section.title}
                    {version === undefined ? '' : ` · ESR ${version}`} · ESR Runeword Browser
                  </p>
                  <MapLegend className="mt-2 border-t pt-2" />
                  {peekArea !== undefined && (
                    <PeekPopover peek={peek} anchorRef={peek.anchorRef}>
                      <AreaPeek map={map} area={peekArea} itemNames={itemNames} />
                    </PeekPopover>
                  )}
                </div>
              )}
              <AreaList
                map={map}
                section={section}
                selectedId={state.area}
                highlightId={highlightId}
                areaHref={areaHref}
                onSelect={select}
                className={cn(state.view === 'map' && 'lg:hidden')}
              />
            </>
          )}
        </div>

        <aside
          ref={panelRef}
          className="order-first scroll-mt-20 lg:sticky lg:top-20 lg:order-none lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
          aria-label="Area details"
        >
          {selectedArea === undefined ? (
            <SectionNotes
              section={section}
              hint={
                hasLayout
                  ? 'Pick an area on the map or in the list to see its quests, caveats, waypoints and monsters.'
                  : 'Pick a card to see the area.'
              }
            />
          ) : (
            <AreaDetailPanel
              key={selectedArea.id}
              map={map}
              area={selectedArea}
              itemNames={itemNames}
              sectionTitle={sectionTitle}
              areaHref={areaHref}
              onSelect={select}
              onClose={clear}
              getShareUrl={() => buildShareUrl(CAMPAIGN_MAP_ROUTE, encodeCampaignMapState({ ...state, area: selectedArea.id }, homeOf))}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

interface SectionTabsProps {
  readonly sections: readonly CampaignSection[];
  readonly active: CampaignSectionKey;
  readonly tabHref: (key: CampaignSectionKey) => string;
  readonly onSwitch: () => void;
}

/** Act I–V on the left, the other sections on the right (one row that scrolls sideways on phones) */
function SectionTabs({ sections, active, tabHref, onSwitch }: SectionTabsProps) {
  const tab = (section: CampaignSection) => (
    <Link
      key={section.key}
      to={tabHref(section.key)}
      onClick={onSwitch}
      aria-current={section.key === active ? 'page' : undefined}
      className={cn(SUBTAB_BASE, 'shrink-0 whitespace-nowrap', section.key === active ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)}
    >
      {section.title}
    </Link>
  );
  const acts = sections.filter((section) => ACT_KEYS.includes(section.key));
  const others = sections.filter((section) => !ACT_KEYS.includes(section.key));
  return (
    <nav aria-label="Map sections" className="flex gap-1 overflow-x-auto">
      {acts.map(tab)}
      <span className="min-w-4 flex-1" aria-hidden />
      {others.map(tab)}
    </nav>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  readonly view: CampaignMapState['view'];
  readonly onChange: (view: CampaignMapState['view']) => void;
}) {
  const option = (value: CampaignMapState['view'], label: string, Icon: typeof MapIcon) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => {
        onChange(value);
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        view === value ? SUBTAB_ACTIVE : SUBTAB_INACTIVE
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="View" className="inline-flex divide-x overflow-hidden rounded-md border">
      {option('map', 'Map', MapIcon)}
      {option('list', 'List', List)}
    </div>
  );
}

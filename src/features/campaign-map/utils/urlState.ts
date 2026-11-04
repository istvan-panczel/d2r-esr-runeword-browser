/**
 * Campaign map URL state: `?tab=<section>&area=<levels.txt Id>&view=list`. The area alone is enough (`?area=93`): its
 * home section is the tab. `?act=3` is an alias of `?tab=act3`. See docs/features/CAMPAIGN-MAP.md "URL state".
 */
import type { CampaignMap, CampaignSectionKey } from '../engine/types';
import { twinRepresentative } from './listGroups';

export const CAMPAIGN_MAP_ROUTE = 'campaign-map';

export const CAMPAIGN_MAP_URL_PARAMS = {
  TAB: 'tab',
  AREA: 'area',
  VIEW: 'view',
  /** Alias: `act=1`…`5` */
  ACT: 'act',
} as const;

export const SECTION_KEYS: readonly CampaignSectionKey[] = ['act1', 'act2', 'act3', 'act4', 'act5', 'special', 'portals', 'maps'];

export type CampaignMapView = 'map' | 'list';

/** What the URL says, unchecked against the data */
export interface CampaignMapUrlState {
  readonly tab: CampaignSectionKey | null;
  readonly area: number | null;
  readonly view: CampaignMapView;
}

/** The state the page renders: a real tab and a known area (or none) */
export interface CampaignMapState {
  readonly tab: CampaignSectionKey;
  readonly area: number | null;
  readonly view: CampaignMapView;
}

export const DEFAULT_TAB: CampaignSectionKey = 'act1';

export function isSectionKey(value: string | null): value is CampaignSectionKey {
  return value !== null && (SECTION_KEYS as readonly string[]).includes(value);
}

function parseAreaId(value: string | null): number | null {
  if (value === null || !/^\d{1,4}$/.test(value.trim())) return null;
  return Number(value.trim());
}

export function readCampaignMapUrlState(params: URLSearchParams): CampaignMapUrlState {
  const tab = params.get(CAMPAIGN_MAP_URL_PARAMS.TAB);
  const act = params.get(CAMPAIGN_MAP_URL_PARAMS.ACT);
  const actTab = act === null ? null : `act${act.trim()}`;
  return {
    tab: isSectionKey(tab) ? tab : isSectionKey(actTab) ? actTab : null,
    area: parseAreaId(params.get(CAMPAIGN_MAP_URL_PARAMS.AREA)),
    view: params.get(CAMPAIGN_MAP_URL_PARAMS.VIEW) === 'list' ? 'list' : 'map',
  };
}

/**
 * Checks the URL against the map: an unknown area is dropped, a twin (Tal Rasha's Tomb 67) becomes the id its family is
 * shown under (66). Without a tab the area's home section is the tab (else Act I); a tab the map does not have, or one
 * that does not list the area (`?tab=act2&area=12`), falls back the same way.
 */
export function resolveCampaignMapState(url: CampaignMapUrlState, map: Pick<CampaignMap, 'areas' | 'sections'>): CampaignMapState {
  const area = url.area !== null && map.areas.has(url.area) ? twinRepresentative(map.areas, url.area) : null;
  const home = area === null ? undefined : map.areas.get(area)?.section;
  const known = (key: CampaignSectionKey | null | undefined): key is CampaignSectionKey =>
    key !== null && key !== undefined && map.sections.some((section) => section.key === key);
  const lists = (key: CampaignSectionKey) =>
    area === null || map.sections.find((section) => section.key === key)?.areaIds.includes(area) === true;
  const fallback = map.sections.at(0)?.key ?? DEFAULT_TAB;
  const tab = known(url.tab) && lists(url.tab) ? url.tab : known(home) ? home : fallback;
  return { tab, area, view: url.view };
}

/** The query of a state; the tab is left out when it is the area's home (`?area=93`) or the default with no area */
export function encodeCampaignMapState(state: CampaignMapState, homeOf: (id: number) => CampaignSectionKey | undefined): URLSearchParams {
  const params = new URLSearchParams();
  const derivedTab = state.area === null ? DEFAULT_TAB : (homeOf(state.area) ?? DEFAULT_TAB);
  if (state.tab !== derivedTab) params.set(CAMPAIGN_MAP_URL_PARAMS.TAB, state.tab);
  if (state.area !== null) params.set(CAMPAIGN_MAP_URL_PARAMS.AREA, String(state.area));
  if (state.view === 'list') params.set(CAMPAIGN_MAP_URL_PARAMS.VIEW, 'list');
  return params;
}

/** App path of an area on its home map (`/campaign-map?area=93`), for links from other pages */
export function campaignMapAreaPath(id: number): string {
  return `/${CAMPAIGN_MAP_ROUTE}?${CAMPAIGN_MAP_URL_PARAMS.AREA}=${String(id)}`;
}

/**
 * Builds the campaign map from areas.json and the hand-written data in ../data: areas with their curated facts, typed
 * edges (mutual Vis links → passages, curated borders / portals / act travel, map item portals), the sections with
 * their layouts, and a list of problems (stale ids, renames, unplaced areas, layout collisions). Never throws on data
 * drift: the page degrades (unplaced strip, "not curated yet") and the integrity test asserts `problems` is empty.
 *
 * Pure and deterministic; unit-tested in buildCampaignMap.test.ts, checked against the real bundle in
 * campaignMapIntegrity.test.ts.
 */
import type { Area } from '@/features/game-data/engine/schema';
import { CURATED_AREAS } from '../data/areas';
import { ACT_GRIDS } from '../data/grids';
import { CURATED_LINKS } from '../data/links';
import { AREA_NAMES } from '../data/names';
import { SECTION_DEFS } from '../data/sections';
import type { ActGrid, CuratedArea, CuratedLink, SectionDef } from '../data/types';
import { parseGrid } from './grid';
import { layoutGridSection, type ResolvedCell } from './layoutGrid';
import { layoutMapsBoard } from './layoutMaps';
import { baseName, displayName, hasEndgameZoneSuffix } from './text';
import type { CampaignArea, CampaignEdge, CampaignMap, CampaignSection, CampaignSectionKey, SectionLayout } from './types';

/** Harrogath: where the cube portals open (uber levels, endgame maps) */
export const HARROGATH_ID = 109;
export const ROGUE_ENCAMPMENT_ID = 1;

export interface CampaignMapData {
  readonly grids: readonly ActGrid[];
  readonly links: readonly CuratedLink[];
  readonly curated: Readonly<Partial<Record<number, CuratedArea>>>;
  readonly names: Readonly<Partial<Record<number, string>>>;
  readonly sections: readonly SectionDef[];
}

export const CAMPAIGN_MAP_DATA: CampaignMapData = {
  grids: ACT_GRIDS,
  links: CURATED_LINKS,
  curated: CURATED_AREAS,
  names: AREA_NAMES,
  sections: SECTION_DEFS,
};

const ACT_KEYS: readonly CampaignSectionKey[] = ['act1', 'act2', 'act3', 'act4', 'act5'];

const pairKey = (a: number, b: number) => (a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`);

/** The tab an area is drawn on */
function homeOf(area: Area, curated: CuratedArea | undefined): CampaignSectionKey {
  if (curated?.home !== undefined) return curated.home;
  if (area.tier !== undefined || area.uniqueMap === true) return 'maps';
  return ACT_KEYS[area.act] ?? 'act5';
}

/** Rows with the same act, name and neighbours (Tal Rasha's Tomb ×7): id → every id of its group, ascending */
function findTwins(areas: readonly Area[], mutual: (area: Area) => number[]): Map<number, number[]> {
  const groups = new Map<string, number[]>();
  for (const area of areas) {
    const key = `${String(area.act)}|${area.name}|${mutual(area)
      .sort((a, b) => a - b)
      .join(',')}`;
    groups.set(key, [...(groups.get(key) ?? []), area.id]);
  }
  const twins = new Map<number, number[]>();
  for (const ids of groups.values()) if (ids.length > 1) for (const id of ids) twins.set(id, ids);
  return twins;
}

export function buildCampaignMap(areas: readonly Area[], data: CampaignMapData = CAMPAIGN_MAP_DATA): CampaignMap {
  const problems: string[] = [];
  const byId = new Map(areas.map((area) => [area.id, area]));
  const label = (id: number) => {
    const area = byId.get(id);
    return area === undefined ? String(id) : `${String(id)} "${area.name}"`;
  };
  const mutual = (area: Area) => area.connections.filter((id) => byId.get(id)?.connections.includes(area.id) === true);

  // --- names and curated entries ---------------------------------------------------------------------------------
  for (const area of areas) {
    const known = data.names[area.id];
    if (known === undefined) problems.push(`area ${label(area.id)} is new: add it to data/names.ts (and place it)`);
    else if (known !== area.name) problems.push(`area ${String(area.id)} was renamed "${known}" → "${area.name}": check data/`);
  }
  for (const id of Object.keys(data.names).map(Number)) {
    if (!byId.has(id)) problems.push(`area ${String(id)} "${data.names[id] ?? ''}" is gone from areas.json: remove it from data/`);
  }
  for (const [key, curated] of Object.entries(data.curated)) {
    if (curated === undefined) continue;
    const area = byId.get(Number(key));
    if (area === undefined) problems.push(`curated area ${key} "${curated.name}" is not in areas.json`);
    else if (area.name !== curated.name) problems.push(`curated area ${key} is named "${curated.name}" but areas.json says "${area.name}"`);
  }

  // --- edges -----------------------------------------------------------------------------------------------------
  const edges: CampaignEdge[] = [];
  const passageIndex = new Map<string, number>();
  for (const area of areas) {
    for (const other of mutual(area)) {
      if (other < area.id) continue;
      passageIndex.set(pairKey(area.id, other), edges.length);
      edges.push({ from: area.id, to: other, kind: 'passage', oneWay: false, source: 'tables' });
    }
  }
  if (byId.has(HARROGATH_ID)) {
    for (const area of areas) {
      if (area.mapItem !== undefined)
        edges.push({ from: HARROGATH_ID, to: area.id, kind: 'cube', oneWay: false, via: 'Map portal', source: 'tables' });
    }
  }
  for (const link of data.links) {
    const missing = [link.from, link.to].filter((id) => !byId.has(id));
    if (missing.length > 0) {
      problems.push(`link ${String(link.from)}→${String(link.to)} names ${missing.map(String).join(', ')}, not in areas.json`);
      continue;
    }
    const edge: CampaignEdge = {
      from: link.from,
      to: link.to,
      kind: link.kind,
      oneWay: link.oneWay === true,
      source: link.source,
      ...(link.via === undefined ? {} : { via: link.via }),
      ...(link.verify === true ? { verify: true } : {}),
    };
    const index = passageIndex.get(pairKey(link.from, link.to));
    if (index !== undefined) {
      if (link.kind !== 'passage') problems.push(`link ${String(link.from)}→${String(link.to)} (${link.kind}) is already a Vis passage`);
      edges[index] = edge;
    } else if (link.kind === 'passage' && link.missingFromTables !== true) {
      problems.push(`link ${String(link.from)}→${String(link.to)} restyles a passage the data no longer has`);
    } else edges.push(edge);
  }

  // --- areas -----------------------------------------------------------------------------------------------------
  const twins = findTwins(areas, mutual);
  const campaignAreas = new Map<number, CampaignArea>();
  for (const area of areas) {
    const curated = data.curated[area.id];
    const bosses = [...(curated?.bosses ?? [])];
    if (area.boss !== undefined && !bosses.includes(area.boss)) bosses.push(area.boss);
    const entry =
      curated?.entry ??
      (area.mapItem === undefined ? undefined : 'Transmute its map item by itself in Act V, Hell: a red portal opens here');
    campaignAreas.set(area.id, {
      id: area.id,
      name: displayName(area.name),
      area,
      section: homeOf(area, curated),
      terrain: area.terrain,
      special: area.endgameZone === true || hasEndgameZoneSuffix(area.name) || curated?.special === true,
      ...(curated?.officialName === undefined ? {} : { officialName: curated.officialName }),
      bosses,
      quests: curated?.quests ?? [],
      notes: curated?.notes ?? [],
      teleport: area.teleport === undefined ? [] : [{ rule: area.teleport, source: 'tables' as const }],
      ...(entry === undefined ? {} : { entry }),
      ...(curated?.entryUnknown === true ? { entryUnknown: true as const } : {}),
      twins: (twins.get(area.id) ?? []).filter((id) => id !== area.id),
      curated: data.names[area.id] === area.name,
    });
  }
  const titleOf = new Map(data.sections.map((section) => [section.key, section.title]));

  // --- act sections ----------------------------------------------------------------------------------------------
  const placedIn = new Map<number, CampaignSectionKey>();
  const layouts = new Map<CampaignSectionKey, { layout: SectionLayout; areaIds: number[]; unplacedIds: number[] }>();
  for (const grid of data.grids) {
    const parsed = parseGrid(grid.grid);
    problems.push(...parsed.problems.map((text) => `${grid.key}: ${text}`));
    const cells: ResolvedCell[] = [];
    for (const cell of parsed.cells) {
      const known = cell.ids.filter((id) => {
        if (byId.has(id)) return true;
        problems.push(`${grid.key}: grid id ${String(id)} is not in areas.json`);
        return false;
      });
      const firstId = known.at(0);
      if (firstId === undefined) continue;
      if (cell.kind === 'ghost') {
        const home = campaignAreas.get(firstId)?.section;
        if (home === undefined || home === grid.key) {
          problems.push(`${grid.key}: ghost @${String(firstId)} must point at an area drawn on another tab`);
          continue;
        }
        cells.push({
          ...cell,
          ids: known,
          folded: false,
          text: campaignAreas.get(firstId)?.name ?? '',
          ghostOf: { key: home, title: titleOf.get(home) ?? home },
        });
        continue;
      }
      const group = cell.kind === 'station' ? (twins.get(firstId) ?? known) : known;
      for (const id of group) {
        const home = campaignAreas.get(id)?.section;
        if (home !== grid.key) problems.push(`${grid.key}: area ${label(id)} belongs to ${String(home)}`);
        const already = placedIn.get(id);
        if (already !== undefined) problems.push(`${grid.key}: area ${label(id)} is placed twice (also in ${already})`);
        placedIn.set(id, grid.key);
      }
      const names = group.map((id) => campaignAreas.get(id)?.name ?? '');
      const folded = group.length > 1 && cell.kind === 'station';
      cells.push({
        ...cell,
        kind: folded ? 'stack' : cell.kind,
        ids: group,
        folded,
        text: folded ? `${names[0] ?? ''} ×${String(group.length)}` : cell.kind === 'stack' ? baseName(names[0] ?? '') : (names[0] ?? ''),
      });
    }
    const unplacedIds = areas
      .filter((area) => campaignAreas.get(area.id)?.section === grid.key && !placedIn.has(area.id))
      .map((area) => area.id);
    for (const id of unplacedIds) problems.push(`${grid.key}: area ${label(id)} is not placed: shown on the unplaced strip`);
    const { layout, problems: layoutProblems } = layoutGridSection({
      grid,
      rows: parsed.rows,
      cols: parsed.cols,
      cells,
      unplaced: unplacedIds.map((id) => ({ id, text: campaignAreas.get(id)?.name ?? String(id) })),
      edges,
    });
    problems.push(...layoutProblems);
    const reading = [...cells].filter((cell) => cell.kind !== 'ghost').sort((a, b) => a.row - b.row || a.col - b.col);
    layouts.set(grid.key, { layout, areaIds: [...reading.flatMap((cell) => cell.ids), ...unplacedIds], unplacedIds });
  }

  // --- maps board ------------------------------------------------------------------------------------------------
  const mapAreas = areas.filter((area) => campaignAreas.get(area.id)?.section === 'maps');
  const board = layoutMapsBoard(mapAreas, edges, (id) => campaignAreas.get(id)?.name ?? String(id));
  layouts.set('maps', { layout: board.layout, areaIds: [...board.order], unplacedIds: [] });

  // --- sections --------------------------------------------------------------------------------------------------
  const drawnOrder = [...ACT_KEYS, 'maps' as const].flatMap((key) => layouts.get(key)?.areaIds ?? []);
  const rank = new Map(drawnOrder.map((id, i) => [id, i]));
  const byRank = (a: number, b: number) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER) || a - b;
  const listOnly = (key: CampaignSectionKey): number[] => {
    if (key === 'special')
      return [...campaignAreas.values()]
        .filter((area) => area.special && area.section !== 'portals')
        .map((a) => a.id)
        .sort(byRank);
    // Portals: every cube portal target that is not an endgame map entry, the unique map, unknown entrances
    const cubeTargets = edges.filter((edge) => edge.kind === 'cube' && byId.get(edge.to)?.mapItem === undefined).map((edge) => edge.to);
    const others = [...campaignAreas.values()]
      .filter((area) => area.section === 'portals' || area.area.uniqueMap === true || area.entryUnknown === true)
      .map((area) => area.id);
    return [...new Set([...cubeTargets, ...others])];
  };
  const sections: CampaignSection[] = data.sections.map((def) => {
    const drawn = layouts.get(def.key);
    if (drawn !== undefined) {
      return {
        key: def.key,
        title: def.title,
        areaIds: drawn.areaIds,
        layout: drawn.layout,
        unplacedIds: drawn.unplacedIds,
        notes: def.notes,
      };
    }
    if (def.key !== 'special' && def.key !== 'portals') problems.push(`section ${def.key} has no grid`);
    return { key: def.key, title: def.title, areaIds: listOnly(def.key), layout: null, unplacedIds: [], notes: def.notes };
  });
  for (const key of new Set([...campaignAreas.values()].map((area) => area.section))) {
    if (!data.sections.some((def) => def.key === key)) problems.push(`areas belong to section ${key}, which has no definition`);
  }

  return { sections, areas: campaignAreas, edges, problems };
}

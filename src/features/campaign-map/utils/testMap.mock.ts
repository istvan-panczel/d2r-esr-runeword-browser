/** Small hand-made campaign map pieces for the page utils' tests. */
import type { Area } from '@/features/game-data/engine/schema';
import type { CampaignArea, CampaignEdge, CampaignMap, CampaignSection, CampaignSectionKey } from '../engine/types';

export function mockArea(id: number, name: string, overrides: Partial<Area> = {}): Area {
  return {
    id,
    name,
    act: 0,
    waypoint: false,
    level: [1, 2, 3],
    density: null,
    uniques: null,
    connections: [],
    terrain: 'outdoor',
    ...overrides,
  };
}

export function mockCampaignArea(
  id: number,
  name: string,
  section: CampaignSectionKey = 'act1',
  overrides: Partial<Omit<CampaignArea, 'area'>> & { readonly area?: Partial<Area> } = {}
): CampaignArea {
  const { area, ...rest } = overrides;
  return {
    id,
    name,
    area: mockArea(id, name, area),
    section,
    terrain: area?.terrain ?? 'outdoor',
    special: false,
    bosses: [],
    quests: [],
    notes: [],
    teleport: [],
    twins: [],
    curated: true,
    ...rest,
  };
}

export function edge(from: number, to: number, overrides: Partial<CampaignEdge> = {}): CampaignEdge {
  return { from, to, kind: 'passage', oneWay: false, source: 'tables', ...overrides };
}

export function mockSection(key: CampaignSectionKey, areaIds: readonly number[]): CampaignSection {
  return { key, title: key, areaIds, layout: null, unplacedIds: [], notes: [] };
}

export function mockMap(areas: readonly CampaignArea[], edges: readonly CampaignEdge[] = []): CampaignMap {
  const keys = [...new Set(areas.map((area) => area.section))];
  return {
    sections: keys.map((key) =>
      mockSection(
        key,
        areas.filter((area) => area.section === key).map((area) => area.id)
      )
    ),
    areas: new Map(areas.map((area) => [area.id, area])),
    edges,
    problems: [],
  };
}

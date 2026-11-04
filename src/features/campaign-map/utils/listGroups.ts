/**
 * Groups of the list view: one group for an act or card section; the Endgame Maps list by tier and map zone.
 */
import type { CampaignArea, CampaignSection } from '../engine/types';

export interface AreaListGroup {
  readonly key: string;
  /** Null for the single group of an act */
  readonly title: string | null;
  readonly ids: readonly number[];
}

/**
 * The id a twin family is shown under (its lowest id: the folded map station and the list row; Tal Rasha's Tomb 67 →
 * 66); any other id is itself
 */
export function twinRepresentative(areas: ReadonlyMap<number, CampaignArea>, id: number): number {
  return Math.min(id, ...(areas.get(id)?.twins ?? []));
}

/** The ids of a list without the later twin rows (Tal Rasha's Tomb ×7 is one row, like on the map) */
export function withoutLaterTwins(ids: readonly number[], areas: ReadonlyMap<number, CampaignArea>): number[] {
  return ids.filter((id) => twinRepresentative(areas, id) === id);
}

/** The section's areas in display order, grouped (maps: "Tier 1 · Chasm of Horrors", "Unique map · Goblin Realm") */
export function areaListGroups(
  section: Pick<CampaignSection, 'key' | 'areaIds'>,
  areas: ReadonlyMap<number, CampaignArea>
): AreaListGroup[] {
  if (section.key !== 'maps') return [{ key: 'all', title: null, ids: section.areaIds }];
  const groups = new Map<string, { title: string; ids: number[] }>();
  for (const id of section.areaIds) {
    const area = areas.get(id)?.area;
    const tier = area?.tier === undefined ? (area?.uniqueMap === true ? 'Unique map' : 'Other') : `Tier ${String(area.tier)}`;
    const title = area?.group === undefined ? tier : `${tier} · ${area.group}`;
    const group = groups.get(title);
    if (group === undefined) groups.set(title, { title, ids: [id] });
    else group.ids.push(id);
  }
  return [...groups.values()].map((group) => ({ key: group.title, title: group.title, ids: group.ids }));
}

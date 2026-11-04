/**
 * Campaign map search: finds an area by its name, official name, map zone, boss, quest or quest item. Pure.
 */
import { normaliseItemName } from '@/core/utils/itemName';
import type { CampaignArea } from '../engine/types';
import { areaBosses } from './areaFacts';

export type SearchMatchKind = 'area' | 'official' | 'zone' | 'boss' | 'quest' | 'item';

export interface CampaignSearchHit {
  readonly id: number;
  /** What matched */
  readonly kind: SearchMatchKind;
  /** The matched text ("Khalim's Heart" when the item matched) */
  readonly text: string;
}

export const SEARCH_RESULT_LIMIT = 12;

/** The texts an area is found by, best kind first */
export function searchTexts(area: CampaignArea, itemName: (code: string) => string | undefined): { kind: SearchMatchKind; text: string }[] {
  const texts: { kind: SearchMatchKind; text: string }[] = [{ kind: 'area', text: area.name }];
  if (area.officialName !== undefined) texts.push({ kind: 'official', text: area.officialName });
  for (const boss of areaBosses(area)) texts.push({ kind: 'boss', text: boss });
  for (const quest of area.quests) {
    const name = quest.itemCode === undefined ? undefined : itemName(quest.itemCode);
    if (name !== undefined) texts.push({ kind: 'item', text: name });
    texts.push({ kind: 'quest', text: quest.quest });
  }
  if (area.area.group !== undefined) texts.push({ kind: 'zone', text: area.area.group });
  return texts;
}

/** 0 exact, 1 prefix, 2 a later word starts with it, 3 anywhere; null when it does not match */
function matchRank(text: string, needle: string): number | null {
  const at = text.indexOf(needle);
  if (at === -1) return null;
  if (text === needle) return 0;
  if (at === 0) return 1;
  if (text.split(/[\s'"(-]+/).some((word) => word.startsWith(needle))) return 2;
  return 3;
}

/**
 * Areas matching `query` (case-insensitive substring over `normaliseItemName`), best first: by rank (exact, prefix, word
 * prefix, substring), then the kind of text (area name before boss before quest…), then the map's area order. One hit
 * per area (its best text), one per twin family.
 */
export function searchCampaignMap(
  areas: Iterable<CampaignArea>,
  query: string,
  itemName: (code: string) => string | undefined,
  limit = SEARCH_RESULT_LIMIT
): CampaignSearchHit[] {
  const needle = normaliseItemName(query);
  if (needle === '') return [];
  const kindOrder: readonly SearchMatchKind[] = ['area', 'official', 'item', 'boss', 'quest', 'zone'];
  const hits: { hit: CampaignSearchHit; rank: number; kind: number; order: number }[] = [];
  let order = 0;
  for (const area of areas) {
    order++;
    // Twins (Tal Rasha's Tomb ×7) are one station: only the first is a hit
    if (area.twins.some((twin) => twin < area.id)) continue;
    let best: { hit: CampaignSearchHit; rank: number; kind: number } | null = null;
    for (const { kind, text } of searchTexts(area, itemName)) {
      const rank = matchRank(normaliseItemName(text), needle);
      if (rank === null) continue;
      const kindIndex = kindOrder.indexOf(kind);
      if (best === null || rank < best.rank || (rank === best.rank && kindIndex < best.kind)) {
        best = { hit: { id: area.id, kind, text }, rank, kind: kindIndex };
      }
    }
    if (best !== null) hits.push({ ...best, order });
  }
  hits.sort((a, b) => a.rank - b.rank || a.kind - b.kind || a.order - b.order);
  return hits.slice(0, limit).map((entry) => entry.hit);
}

export const SEARCH_KIND_LABELS: Record<SearchMatchKind, string> = {
  area: 'Area',
  official: 'Official name',
  zone: 'Map zone',
  boss: 'Boss',
  quest: 'Quest',
  item: 'Quest item',
};

import type { Gemword } from '@/core/db/models';
import type { GemQuality } from '@/core/db';
import type { GemGroup } from '../types';

/**
 * Builds a gem selection where ONLY gems of the given quality are selected.
 * Used by the per-quality quick-select buttons (e.g. "Chipped" selects all
 * chipped gems and deselects everything else).
 */
export function buildGemQualitySelection(gemGroups: readonly GemGroup[], quality: GemQuality): Record<string, boolean> {
  const selection: Record<string, boolean> = {};
  for (const group of gemGroups) {
    for (const gem of group.gems) {
      selection[gem.name] = gem.quality === quality;
    }
  }
  return selection;
}

export function matchesGemwordSearch(gemword: Gemword, searchTerms: readonly string[]): boolean {
  if (searchTerms.length === 0) return true;

  const { weaponsGloves, helmsBoots, armorShieldsBelts } = gemword.columnAffixes;
  const affixTexts = [...weaponsGloves, ...helmsBoots, ...armorShieldsBelts].map((affix) => affix.rawText);
  const searchableText = [gemword.name, ...gemword.gems, ...gemword.allowedItems, ...affixTexts].join(' ').toLowerCase();

  return searchTerms.every((term) => searchableText.includes(term));
}

export function matchesGemwordSockets(gemword: Gemword, socketCount: number | null): boolean {
  if (socketCount === null) return true;
  return gemword.sockets === socketCount;
}

export function matchesGemwordMaxReqLevel(gemword: Gemword, maxReqLevel: number | null): boolean {
  if (maxReqLevel === null) return true;
  return gemword.reqLevel <= maxReqLevel;
}

export function matchesGemwordItemTypes(gemword: Gemword, selectedItemTypes: Record<string, boolean>): boolean {
  if (Object.keys(selectedItemTypes).length === 0) return true;
  return gemword.allowedItems.some((itemType) => selectedItemTypes[itemType]);
}

export function matchesGemSelection(gemword: Gemword, selectedGems: Record<string, boolean>): boolean {
  if (Object.keys(selectedGems).length === 0) return true;
  return gemword.gems.every((gemName) => selectedGems[gemName]);
}

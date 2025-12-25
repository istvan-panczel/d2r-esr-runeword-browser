import type { SocketableBonuses } from '@/core/db/models';
import type { UnifiedSocketable } from '../types';

/**
 * Convert bonus affixes to searchable text.
 */
export function bonusesToSearchText(bonuses: SocketableBonuses): string {
  const allAffixes = [...bonuses.weaponsGloves, ...bonuses.helmsBoots, ...bonuses.armorShieldsBelts];
  return allAffixes
    .map((a) => a.rawText)
    .join(' ')
    .toLowerCase();
}

/**
 * Check if item matches search terms (AND logic).
 * All terms must be present in the searchable text (name + bonuses).
 */
export function matchesSearch(item: UnifiedSocketable, searchTerms: readonly string[]): boolean {
  if (searchTerms.length === 0) return true;

  const searchableText = `${item.name} ${bonusesToSearchText(item.bonuses)}`.toLowerCase();
  return searchTerms.every((term) => searchableText.includes(term));
}

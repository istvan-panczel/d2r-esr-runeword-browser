import type { Runeword, EsrRune, LodRune, KanjiRune, SocketableBonuses } from '@/core/db/models';
import { getRelevantCategories } from './itemCategoryMapping';

export type RuneBonusMap = Map<string, SocketableBonuses>;
export type RuneCategoryMap = Map<string, string[]>;
export type RunePriorityMap = Map<string, number>;

/**
 * Parse search text into terms, supporting quoted phrases for exact matching.
 * - Quoted phrases like "life stolen per hit" are kept as single terms
 * - Unquoted words are split by whitespace
 * - All terms are lowercased
 *
 * Examples:
 * - "life resist" → ["life", "resist"]
 * - '"life stolen per hit"' → ["life stolen per hit"]
 * - 'defense "life stolen" resist' → ["defense", "life stolen", "resist"]
 */
export function parseSearchTerms(searchText: string): string[] {
  const terms: string[] = [];
  const text = searchText.toLowerCase();

  // Regex to match quoted phrases or individual words
  // - "([^"]+)" matches content inside quotes (captured in group 1)
  // - (\S+) matches non-whitespace sequences (captured in group 2)
  const regex = /"([^"]+)"|(\S+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // match[1] is quoted content (without quotes), match[2] is unquoted word
    // One of them will always be defined based on the regex alternation
    const rawTerm = match[1] || match[2];
    const term = rawTerm.trim();
    if (term) {
      terms.push(term);
    }
  }

  return terms;
}

/**
 * Build searchable text from rune bonuses for a runeword.
 */
export function getRuneBonusesText(runeword: Runeword, runeBonusMap: RuneBonusMap): string {
  const relevantCategories = getRelevantCategories(runeword.allowedItems);
  const bonusTexts: string[] = [];

  for (const runeName of runeword.runes) {
    const bonuses = runeBonusMap.get(runeName);
    if (bonuses) {
      for (const category of relevantCategories) {
        for (const affix of bonuses[category]) {
          bonusTexts.push(affix.rawText);
        }
      }
    }
  }

  return bonusTexts.join(' ');
}

/**
 * Check if a runeword matches the search terms (AND logic).
 */
export function matchesSearch(runeword: Runeword, searchTerms: readonly string[], runeBonusMap: RuneBonusMap): boolean {
  if (searchTerms.length === 0) return true;

  const affixText = runeword.affixes.map((a) => a.rawText).join(' ');
  const runeBonusText = getRuneBonusesText(runeword, runeBonusMap);
  const searchableText = `${runeword.name} ${affixText} ${runeBonusText}`.toLowerCase();

  return searchTerms.every((term) => searchableText.includes(term));
}

/**
 * Check if a runeword matches the socket count filter.
 */
export function matchesSockets(runeword: Runeword, socketCount: number | null): boolean {
  if (socketCount === null) return true;
  return runeword.sockets === socketCount;
}

/**
 * Check if a runeword matches the item type filter.
 */
export function matchesItemTypes(runeword: Runeword, selectedItemTypes: Record<string, boolean>): boolean {
  // If no item types are initialized yet, show all
  if (Object.keys(selectedItemTypes).length === 0) return true;

  // Show runeword if ANY of its allowedItems matches a selected item type
  return runeword.allowedItems.some((item) => selectedItemTypes[item]);
}

/**
 * Build a map from rune name to its categories.
 * A rune can exist in multiple categories (e.g., Ko Rune in both ESR and LoD).
 */
export function buildRuneCategoryMap(
  esrRunes: readonly EsrRune[],
  lodRunes: readonly LodRune[],
  kanjiRunes: readonly KanjiRune[]
): RuneCategoryMap {
  const map = new Map<string, string[]>();

  for (const rune of esrRunes) {
    const existing = map.get(rune.name) ?? [];
    existing.push('esrRunes');
    map.set(rune.name, existing);
  }
  for (const rune of lodRunes) {
    const existing = map.get(rune.name) ?? [];
    existing.push('lodRunes');
    map.set(rune.name, existing);
  }
  for (const rune of kanjiRunes) {
    const existing = map.get(rune.name) ?? [];
    existing.push('kanjiRunes');
    map.set(rune.name, existing);
  }

  return map;
}

/**
 * Check if a runeword matches the rune filter.
 * A runeword matches if ALL its runes are selected in at least one category.
 */
export function matchesRunes(runeword: Runeword, selectedRunes: Record<string, boolean>, runeCategoryMap: RuneCategoryMap): boolean {
  // If no runes are initialized yet, show all
  if (Object.keys(selectedRunes).length === 0) return true;

  // Hide runeword if ANY of its runes are unchecked in ALL of their categories
  return runeword.runes.every((rune) => {
    const categories = runeCategoryMap.get(rune) ?? [];
    // Rune matches if it's selected in at least one of its categories
    return categories.some((category) => selectedRunes[`${category}:${rune}`]);
  });
}

/**
 * Build a priority map for sorting runewords by their highest rune.
 * Priority order: ESR (tier 1-7) → Kanji → LoD (order 1-33)
 * Lower priority = appears first in the list
 */
export function buildRunePriorityMap(
  esrRunes: readonly EsrRune[],
  kanjiRunes: readonly KanjiRune[],
  lodRunes: readonly LodRune[]
): RunePriorityMap {
  const priorityMap = new Map<string, number>();

  // ESR runes: priority 100-799 (tier * 100)
  for (const rune of esrRunes) {
    priorityMap.set(rune.name, rune.tier * 100);
  }

  // Kanji runes: priority 800 (all equal)
  for (const rune of kanjiRunes) {
    priorityMap.set(rune.name, 800);
  }

  // LoD runes: priority 900 + order (901-933)
  for (const rune of lodRunes) {
    priorityMap.set(rune.name, 900 + rune.order);
  }

  return priorityMap;
}

/**
 * Get the sort key for a runeword based on its highest priority rune.
 */
export function getRunewordSortKey(runeword: Runeword, priorityMap: RunePriorityMap): number {
  if (runeword.runes.length === 0) return 0;
  return Math.max(...runeword.runes.map((r) => priorityMap.get(r) ?? 0));
}

/**
 * Build a map of rune names to their bonuses for search.
 */
export function buildRuneBonusMap(
  esrRunes: readonly EsrRune[],
  lodRunes: readonly LodRune[],
  kanjiRunes: readonly KanjiRune[]
): RuneBonusMap {
  const map = new Map<string, SocketableBonuses>();

  for (const rune of esrRunes) {
    map.set(rune.name, rune.bonuses);
  }
  for (const rune of lodRunes) {
    map.set(rune.name, rune.bonuses);
  }
  for (const rune of kanjiRunes) {
    map.set(rune.name, rune.bonuses);
  }

  return map;
}

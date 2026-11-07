import type { Runeword, EsrRune, LodRune, KanjiRune, Gem, SocketableBonuses } from '@/core/db/models';
import { getRelevantCategories, getItemCategory } from '@/core/utils/itemCategoryMapping';
import { hasColumnDifferences } from '@/core/utils/columnAffixes';
import { socketRangeOverlaps, type SocketRange } from '@/core/utils/socketRange';
import type { SocketableMatchMode } from '@/core/utils/filterUrlParams';

export type RuneBonusMap = Map<string, SocketableBonuses>;
export type GemBonusMap = Map<string, SocketableBonuses>;
export type RuneCategoryMap = Map<string, string[]>;

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
 * Build searchable text from gem bonuses for a runeword.
 */
export function getGemBonusesText(runeword: Runeword, gemBonusMap: GemBonusMap): string {
  const gems = 'gems' in runeword ? runeword.gems : [];
  if (gems.length === 0) return '';

  const relevantCategories = getRelevantCategories(runeword.allowedItems);
  const bonusTexts: string[] = [];

  for (const gemName of gems) {
    const bonuses = gemBonusMap.get(gemName);
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
 * Build a map of gem names to their bonuses for search.
 */
export function buildGemBonusMap(gems: Iterable<Gem>): GemBonusMap {
  const map = new Map<string, SocketableBonuses>();
  for (const gem of gems) {
    map.set(gem.name, gem.bonuses);
  }
  return map;
}

/**
 * Check if a runeword matches the search terms (AND logic).
 */
export function matchesSearch(
  runeword: Runeword,
  searchTerms: readonly string[],
  runeBonusMap: RuneBonusMap,
  gemBonusMap?: GemBonusMap
): boolean {
  if (searchTerms.length === 0) return true;

  // Search all column affixes to catch column-specific bonuses, fall back to legacy affixes if columns are empty
  const { weaponsGloves, helmsBoots, armorShieldsBelts } = runeword.columnAffixes;
  const allColumnAffixes = [...weaponsGloves, ...helmsBoots, ...armorShieldsBelts];
  const affixText =
    allColumnAffixes.length > 0 ? allColumnAffixes.map((a) => a.rawText).join(' ') : runeword.affixes.map((a) => a.rawText).join(' ');
  // The page's socketable bonuses (ESR 3.3+); old cached rows: the rune / gem bonuses of the relevant categories
  const socketableText =
    runeword.socketableBonuses !== undefined && runeword.socketableBonuses.length > 0
      ? runeword.socketableBonuses.flatMap((group) => group.affixes.map((a) => a.rawText)).join(' ')
      : `${getRuneBonusesText(runeword, runeBonusMap)} ${gemBonusMap ? getGemBonusesText(runeword, gemBonusMap) : ''}`;
  const searchableText = `${runeword.name} ${affixText} ${socketableText}`.toLowerCase();

  return searchTerms.every((term) => searchableText.includes(term));
}

/**
 * Check if a runeword matches the socket filter.
 * Recipes accepting optional jewels have a socket range (e.g. "3-6 Socket"); they match
 * when any count within [sockets, socketsMax] falls inside the filter range. Others match
 * only when their exact `sockets` count does.
 */
export function matchesSockets(runeword: Runeword, socketRange: SocketRange | null): boolean {
  return socketRangeOverlaps(socketRange, runeword.sockets, runeword.socketsMax);
}

/**
 * Check if a runeword matches the max required level filter.
 * Returns true if runeword's reqLevel is at or below the filter value.
 */
export function matchesMaxReqLevel(runeword: Runeword, maxReqLevel: number | null): boolean {
  if (maxReqLevel === null) return true;
  // Handle backwards compatibility for runewords without reqLevel field
  if (!('reqLevel' in runeword)) return true;
  return runeword.reqLevel <= maxReqLevel;
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
  esrRunes: Iterable<EsrRune>,
  lodRunes: Iterable<LodRune>,
  kanjiRunes: Iterable<KanjiRune>
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
 * - `all` (strict, default): every rune of the runeword is selected in at least one of its categories
 *   (hidden if ANY of its runes is unchecked everywhere), i.e. it can be made from the selected runes.
 * - `any`: at least one rune of the runeword is selected ("which words use Ber?").
 * Runewords without runes are never hidden by the rune filter.
 */
export function matchesRunes(
  runeword: Runeword,
  selectedRunes: Record<string, boolean>,
  runeCategoryMap: RuneCategoryMap,
  mode: SocketableMatchMode = 'all'
): boolean {
  // If no runes are initialized yet, show all
  if (Object.keys(selectedRunes).length === 0) return true;
  if (runeword.runes.length === 0) return true;

  // Rune matches if it's selected in at least one of its categories
  const isSelected = (rune: string) => {
    const categories = runeCategoryMap.get(rune) ?? [];
    return categories.some((category) => selectedRunes[`${category}:${rune}`]);
  };

  return mode === 'any' ? runeword.runes.some(isSelected) : runeword.runes.every(isSelected);
}

/**
 * Check if a runeword matches the tier points filter.
 * For each tier with a non-null max, the runeword's tier point total for that
 * (category, tier) must not exceed the max. If the runeword has no runes from
 * that tier, it passes.
 */
export function matchesTierPoints(runeword: Runeword, maxTierPoints: Record<string, number | null>): boolean {
  for (const [tierKey, maxValue] of Object.entries(maxTierPoints)) {
    if (maxValue === null) continue;

    // tierKey format: "esrRunes:1" or "lodRunes:2"
    const separatorIndex = tierKey.indexOf(':');
    if (separatorIndex === -1) continue;
    const category = tierKey.substring(0, separatorIndex);
    const tier = parseInt(tierKey.substring(separatorIndex + 1), 10);

    const entry = runeword.tierPointTotals.find((t) => t.category === category && t.tier === tier);
    if (entry && entry.totalPoints > maxValue) {
      return false;
    }
  }
  return true;
}

/**
 * Build a map of rune names to their bonuses for search.
 */
export function buildRuneBonusMap(esrRunes: Iterable<EsrRune>, lodRunes: Iterable<LodRune>, kanjiRunes: Iterable<KanjiRune>): RuneBonusMap {
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

/**
 * Screen order of the runewords list: one list for ESR, Kanji and LoD by required level, ties by name
 * A→Z (case-insensitive, so the source's lowercase "hand of Justice" sorts under H), then variant.
 */
export function compareRunewordsByLevel(
  a: Pick<Runeword, 'reqLevel' | 'name' | 'variant'>,
  b: Pick<Runeword, 'reqLevel' | 'name' | 'variant'>
): number {
  return a.reqLevel - b.reqLevel || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.variant - b.variant;
}

/**
 * Expands runewords with differing column bonuses into separate entries per item category.
 * E.g., Machine (Weapon, Charm) with different bonuses → two entries: Machine (Weapon) and Machine (Charm).
 * Only splits when runeword bonuses differ; rune bonuses naturally differ per item type.
 */
export function expandRunewordsByColumn(runewords: readonly Runeword[]): readonly Runeword[] {
  const result: Runeword[] = [];

  for (const rw of runewords) {
    const categories = getRelevantCategories(rw.allowedItems);

    if (!hasColumnDifferences(rw.columnAffixes, categories)) {
      result.push(rw);
      continue;
    }

    // Split into separate entries per category
    for (const category of categories) {
      const itemsInCategory = rw.allowedItems.filter((item) => getItemCategory(item) === category);
      const excludedInCategory = rw.excludedItems.filter((item) => getItemCategory(item) === category);
      const affixes = rw.columnAffixes[category];

      if (itemsInCategory.length === 0) continue;

      result.push({
        ...rw,
        allowedItems: itemsInCategory,
        excludedItems: excludedInCategory,
        affixes,
      });
    }
  }

  return result;
}

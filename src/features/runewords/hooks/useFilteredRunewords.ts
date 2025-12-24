import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import type { Runeword, EsrRune, LodRune, KanjiRune, SocketableBonuses } from '@/core/db/models';
import { selectSearchText, selectSocketCount, selectSelectedItemTypes, selectSelectedRunes } from '../store/runewordsSlice';
import { getRelevantCategories } from '../utils/itemCategoryMapping';

type RuneBonusMap = Map<string, SocketableBonuses>;

/**
 * Build searchable text from rune bonuses for a runeword.
 */
function getRuneBonusesText(runeword: Runeword, runeBonusMap: RuneBonusMap): string {
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

function matchesSearch(runeword: Runeword, searchTerms: readonly string[], runeBonusMap: RuneBonusMap): boolean {
  if (searchTerms.length === 0) return true;

  const affixText = runeword.affixes.map((a) => a.rawText).join(' ');
  const runeBonusText = getRuneBonusesText(runeword, runeBonusMap);
  const searchableText = `${runeword.name} ${affixText} ${runeBonusText}`.toLowerCase();

  return searchTerms.every((term) => searchableText.includes(term));
}

function matchesSockets(runeword: Runeword, socketCount: number | null): boolean {
  if (socketCount === null) return true;
  return runeword.sockets === socketCount;
}

function matchesItemTypes(runeword: Runeword, selectedItemTypes: Record<string, boolean>): boolean {
  // If no item types are initialized yet, show all
  if (Object.keys(selectedItemTypes).length === 0) return true;

  // Show runeword if ANY of its allowedItems matches a selected item type
  return runeword.allowedItems.some((item) => selectedItemTypes[item]);
}

type RuneCategoryMap = Map<string, string[]>;

/**
 * Build a map from rune name to its categories.
 * A rune can exist in multiple categories (e.g., Ko Rune in both ESR and LoD).
 */
function buildRuneCategoryMap(
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

function matchesRunes(runeword: Runeword, selectedRunes: Record<string, boolean>, runeCategoryMap: RuneCategoryMap): boolean {
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
function buildRunePriorityMap(
  esrRunes: readonly EsrRune[],
  kanjiRunes: readonly KanjiRune[],
  lodRunes: readonly LodRune[]
): Map<string, number> {
  const priorityMap = new Map<string, number>();

  // ESR runes: priority 100-799 (tier * 100 + index within tier)
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
function getRunewordSortKey(runeword: Runeword, priorityMap: Map<string, number>): number {
  if (runeword.runes.length === 0) return 0;
  return Math.max(...runeword.runes.map((r) => priorityMap.get(r) ?? 0));
}

/**
 * Build a map of rune names to their bonuses for search.
 */
function buildRuneBonusMap(esrRunes: readonly EsrRune[], lodRunes: readonly LodRune[], kanjiRunes: readonly KanjiRune[]): RuneBonusMap {
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

export function useFilteredRunewords(): readonly Runeword[] | undefined {
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const selectedRunes = useSelector(selectSelectedRunes);

  const data = useLiveQuery(async () => {
    const [runewords, esrRunes, lodRunes, kanjiRunes] = await Promise.all([
      db.runewords.toArray(),
      db.esrRunes.toArray(),
      db.lodRunes.toArray(),
      db.kanjiRunes.toArray(),
    ]);
    return { runewords, esrRunes, lodRunes, kanjiRunes };
  }, []);

  if (!data) return undefined;

  const { runewords, esrRunes, lodRunes, kanjiRunes } = data;
  const priorityMap = buildRunePriorityMap(esrRunes, kanjiRunes, lodRunes);
  const runeBonusMap = buildRuneBonusMap(esrRunes, lodRunes, kanjiRunes);
  const runeCategoryMap = buildRuneCategoryMap(esrRunes, lodRunes, kanjiRunes);

  const searchTerms = searchText
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  const filtered = runewords.filter((runeword) => {
    if (!matchesSearch(runeword, searchTerms, runeBonusMap)) return false;
    if (!matchesSockets(runeword, socketCount)) return false;
    if (!matchesItemTypes(runeword, selectedItemTypes)) return false;
    if (!matchesRunes(runeword, selectedRunes, runeCategoryMap)) return false;
    return true;
  });

  // Sort by highest rune priority (lowest priority first)
  return filtered.sort((a, b) => getRunewordSortKey(a, priorityMap) - getRunewordSortKey(b, priorityMap));
}

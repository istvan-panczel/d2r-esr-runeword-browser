import type { Runeword, Affix, TierPointTotal, RuneCategory } from '@/core/db';
import { parseRunewordAffixes } from './shared/parserUtils';

export interface RunePointInfo {
  points: number;
  tier: number;
  category: RuneCategory;
}

export type RunePointsLookup = Map<string, RunePointInfo>;

// Maps rune name to its required level
export type RuneReqLevelLookup = Map<string, number>;

// Maps rune name to its priority for sorting (ESR: 100-700, Kanji: 800, LoD: 901-933)
export type RunePriorityLookup = Map<string, number>;

// Threshold for LoD runewords (priority >= 900 means LoD)
const LOD_PRIORITY_THRESHOLD = 900;
// Offset added to LoD runewords to sort them after ESR/Kanji
const LOD_SORT_KEY_OFFSET = 10000;

interface RawRuneword {
  name: string;
  variant: number;
  sockets: number;
  reqLevel: number;
  sortKey: number;
  runes: string[];
  allowedItems: string[];
  excludedItems: string[];
  affixes: Affix[];
  tierPointTotals: TierPointTotal[];
}

interface AllowedItemsResult {
  allowedItems: string[];
  excludedItems: string[];
}

/**
 * Extracts runeword name from the first column cell.
 * Format: <font color="#908858"><b>Stone</b></font><br><br>(2 Socket)<br><br>
 */
export function extractName(cell: Element): string {
  const fontTag = cell.querySelector('font[color="#908858"] b, FONT[color="#908858"] b');
  if (fontTag?.textContent) {
    return fontTag.textContent.trim();
  }
  return '';
}

/**
 * Extracts socket count from the first column cell.
 * Format: (N Socket)
 */
export function extractSockets(cell: Element): number {
  const text = cell.textContent;
  if (!text) return 0;
  const match = /\((\d+)\s*Socket\)/i.exec(text);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extracts rune names from the ingredients cell.
 *
 * Two formats exist:
 * 1. ESR format: Each rune is in its own <FONT COLOR="...">X Rune</FONT> tag
 * 2. LoD format: Runes are plain text separated by <br> inside a wrapper font
 *
 * We first try to extract from nested FONT tags (ESR format).
 * If that yields no results, we fall back to parsing br-separated text (LoD format).
 * Normalizes whitespace to handle rune names split across lines in HTML.
 */
export function extractRunes(cell: Element): string[] {
  const fontTags = cell.querySelectorAll('FONT[color], font[color]');
  const runes: string[] = [];

  for (const tag of fontTags) {
    // Skip wrapper elements that contain child FONT tags (ESR format)
    if (tag.querySelector('FONT, font')) continue;

    // Check if this is a wrapper with br-separated runes (LoD format)
    // by looking for <br> in innerHTML
    const innerHTML = tag.innerHTML;
    if (innerHTML.includes('<br>') || innerHTML.includes('<BR>')) {
      // LoD format: split by <br> and extract rune names
      const parts = innerHTML.split(/<br\s*\/?>/i);
      for (const part of parts) {
        // Strip any remaining HTML tags and normalize whitespace
        const text = part
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.endsWith(' Rune')) {
          runes.push(text);
        }
      }
    } else {
      // ESR format: single rune in this FONT tag
      const rawText = tag.textContent;
      if (!rawText) continue;

      // Normalize whitespace (handles rune names split across lines like "Ist\n  Rune")
      const runeName = rawText.replace(/\s+/g, ' ').trim();
      if (runeName.endsWith(' Rune')) {
        runes.push(runeName);
      }
    }
  }

  return runes;
}

/**
 * Extracts allowed items and excluded items from the third column.
 * Items are plain text separated by <br>
 * Format: "Staff<br><br>Excluded:<br>Orb<br>Sorceress Mana Blade<br>"
 */
export function extractAllowedItems(cell: Element): AllowedItemsResult {
  const html = cell.innerHTML;
  const items = html
    .split(/<br\s*\/?>/i)
    .map((item) => item.replace(/<[^>]*>/g, '').trim())
    .filter((item) => item.length > 0);

  const excludedIndex = items.findIndex((item) => item === 'Excluded:');

  if (excludedIndex === -1) {
    return { allowedItems: items, excludedItems: [] };
  }

  return {
    allowedItems: items.slice(0, excludedIndex),
    excludedItems: items.slice(excludedIndex + 1),
  };
}

/**
 * Finds the first non-empty bonus cell and extracts runeword affixes.
 * Columns 4-6 contain bonuses for different item types.
 * We take the first cell that has actual bonuses (before <br><br>).
 * Expects cells to have at least 6 elements (indices 0-5).
 */
export function extractAffixes(cells: NodeListOf<Element>): Affix[] {
  // Cells 3, 4, 5 are columns 4-6 (0-indexed)
  const bonusCells = [cells[3], cells[4], cells[5]];

  for (const cell of bonusCells) {
    const affixes = parseRunewordAffixes(cell);
    if (affixes.length > 0) {
      return affixes;
    }
  }

  return [];
}

interface TierPointEntry {
  tier: number;
  category: RuneCategory;
  totalPoints: number;
}

/**
 * Calculates tier point totals from a list of rune names.
 * Groups points by (category, tier) and sums them.
 */
export function calculateTierPointTotals(runes: string[], runePointsLookup: RunePointsLookup): TierPointTotal[] {
  // Map of "category:tier" -> total points
  const totals = new Map<string, TierPointEntry>();

  for (const runeName of runes) {
    const info = runePointsLookup.get(runeName);
    if (!info) continue; // Skip unknown runes (e.g., Kanji runes don't have points)

    const key = `${info.category}:${String(info.tier)}`;
    const existing = totals.get(key);
    if (existing) {
      existing.totalPoints += info.points;
    } else {
      totals.set(key, { tier: info.tier, category: info.category, totalPoints: info.points });
    }
  }

  // Convert to array and sort by category then tier
  return Array.from(totals.values()).sort((a: TierPointEntry, b: TierPointEntry) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.tier - b.tier;
  });
}

/**
 * Calculates the required level for a runeword.
 * Returns the highest required level among all runes in the runeword.
 */
export function calculateReqLevel(runes: string[], runeReqLevelLookup: RuneReqLevelLookup): number {
  let maxReqLevel = 0;
  for (const runeName of runes) {
    const reqLevel = runeReqLevelLookup.get(runeName);
    if (reqLevel !== undefined && reqLevel > maxReqLevel) {
      maxReqLevel = reqLevel;
    }
  }
  return maxReqLevel;
}

/**
 * Calculates the sort key for a runeword.
 * ESR/Kanji runewords: reqLevel (0-9999)
 * LoD runewords: 10000 + reqLevel (10000+)
 *
 * A runeword is considered LoD if its highest-priority rune has priority >= 900.
 */
export function calculateSortKey(runes: string[], reqLevel: number, runePriorityLookup: RunePriorityLookup): number {
  let maxPriority = 0;
  for (const runeName of runes) {
    const priority = runePriorityLookup.get(runeName);
    if (priority !== undefined && priority > maxPriority) {
      maxPriority = priority;
    }
  }

  const isLodRuneword = maxPriority >= LOD_PRIORITY_THRESHOLD;
  return isLodRuneword ? LOD_SORT_KEY_OFFSET + reqLevel : reqLevel;
}

/**
 * Parses runewords from runewords.htm HTML.
 * Each row becomes a separate runeword entry with its variant number.
 * @param html The runewords.htm HTML content
 * @param runePointsLookup Optional lookup map for calculating tier point totals
 * @param runeReqLevelLookup Optional lookup map for calculating required level
 * @param runePriorityLookup Optional lookup map for calculating sort key
 */
export function parseRunewordsHtml(
  html: string,
  runePointsLookup?: RunePointsLookup,
  runeReqLevelLookup?: RuneReqLevelLookup,
  runePriorityLookup?: RunePriorityLookup
): Runeword[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rawRunewords: RawRuneword[] = [];
  const variantCounters = new Map<string, number>();

  const rows = doc.querySelectorAll('tr.recipeRow');

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) continue;

    // We've verified length >= 6, so indices 0-5 are valid
    const nameCell = cells[0];
    const ingredientsCell = cells[1];
    const allowedItemsCell = cells[2];

    const name = extractName(nameCell);
    if (!name) continue;

    // Assign variant number (incrementing per runeword name)
    const variantNum = (variantCounters.get(name) ?? 0) + 1;
    variantCounters.set(name, variantNum);

    const sockets = extractSockets(nameCell);
    const runes = extractRunes(ingredientsCell);
    const { allowedItems, excludedItems } = extractAllowedItems(allowedItemsCell);
    const affixes = extractAffixes(cells);

    // Calculate tier point totals if lookup is provided
    const tierPointTotals = runePointsLookup ? calculateTierPointTotals(runes, runePointsLookup) : [];

    // Calculate required level (highest reqLevel among all runes)
    const reqLevel = runeReqLevelLookup ? calculateReqLevel(runes, runeReqLevelLookup) : 0;

    // Calculate sort key (ESR/Kanji: 0-9999, LoD: 10000+)
    const sortKey = runePriorityLookup ? calculateSortKey(runes, reqLevel, runePriorityLookup) : reqLevel;

    rawRunewords.push({
      name,
      variant: variantNum,
      sockets,
      reqLevel,
      sortKey,
      runes,
      allowedItems,
      excludedItems,
      affixes,
      tierPointTotals,
    });
  }

  // Convert to readonly Runeword type
  const runewords: Runeword[] = rawRunewords.map((rw) => ({
    name: rw.name,
    variant: rw.variant,
    sockets: rw.sockets,
    reqLevel: rw.reqLevel,
    sortKey: rw.sortKey,
    runes: rw.runes as readonly string[],
    allowedItems: rw.allowedItems as readonly string[],
    excludedItems: rw.excludedItems as readonly string[],
    affixes: rw.affixes as readonly Affix[],
    tierPointTotals: rw.tierPointTotals as readonly TierPointTotal[],
  }));

  console.log(`Parsed ${String(runewords.length)} runewords`);
  return runewords;
}

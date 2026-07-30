import type { Runeword, Affix, SocketableBonuses, TierPointTotal, RuneCategory } from '@/core/db';
import { parseRecipeAffixes } from './shared/parserUtils';
import { isGemName } from './gemsParser';

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

// Offset added to LoD runewords to sort them after ESR/Kanji
const LOD_SORT_KEY_OFFSET = 10000;

interface RawRuneword {
  name: string;
  variant: number;
  sockets: number;
  socketsMax?: number;
  reqLevel: number;
  sortKey: number;
  runes: string[];
  gems: string[];
  ingredients: string[];
  allowedItems: string[];
  excludedItems: string[];
  affixes: Affix[];
  columnAffixes: SocketableBonuses;
  tierPointTotals: TierPointTotal[];
  jewelInfo?: string;
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

export interface ExtractedSockets {
  sockets: number;
  socketsMax?: number;
}

/**
 * Extracts the socket count from the first column cell.
 *
 * Two formats exist:
 * 1. Fixed: `(N Socket)` — the recipe always uses exactly N sockets.
 * 2. Range: `(N-M Socket)` — the recipe accepts optional jewels on top of its runes
 *    (see `jewelInfo`), so the item may have between N and M sockets.
 *
 * `sockets` is always the base/minimum count (equal to the number of listed runes/gems);
 * `socketsMax` is only set when the source shows a range.
 */
export function extractSocketRange(cell: Element): ExtractedSockets {
  const text = cell.textContent;
  if (!text) return { sockets: 0 };

  const rangeMatch = /\((\d+)\s*-\s*(\d+)\s*Socket\)/i.exec(text);
  if (rangeMatch) {
    const sockets = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return max > sockets ? { sockets, socketsMax: max } : { sockets };
  }

  const match = /\((\d+)\s*Socket\)/i.exec(text);
  return match ? { sockets: parseInt(match[1], 10) } : { sockets: 0 };
}

/**
 * Extracts the base socket count from the first column cell.
 * @see extractSocketRange for the full extraction including the optional maximum.
 */
export function extractSockets(cell: Element): number {
  return extractSocketRange(cell).sockets;
}

export interface ExtractedIngredients {
  runes: string[];
  gems: string[];
  ingredients: string[];
  jewelInfo?: string;
}

/**
 * Extracts all ingredients (runes and gems) from the ingredients cell, preserving original order.
 *
 * Two formats exist:
 * 1. ESR format: Each item is in its own <FONT COLOR="...">X Rune</FONT> or <FONT COLOR="...">Perfect Topaz</FONT> tag
 * 2. LoD format: Items are plain text separated by <br> inside a wrapper font
 *
 * Items are classified as runes (ending with " Rune") or gems (matching isGemName).
 */
export function extractIngredients(cell: Element): ExtractedIngredients {
  const fontTags = cell.querySelectorAll('FONT[color], font[color]');
  const runes: string[] = [];
  const gems: string[] = [];
  const ingredients: string[] = [];

  const classifyAndAdd = (text: string): void => {
    if (text.endsWith(' Rune')) {
      runes.push(text);
      ingredients.push(text);
    } else if (isGemName(text)) {
      gems.push(text);
      ingredients.push(text);
    }
  };

  for (const tag of fontTags) {
    // Skip wrapper elements that contain child FONT tags (ESR format)
    if (tag.querySelector('FONT, font')) continue;

    // Check if this is a wrapper with br-separated items (LoD format)
    // by looking for <br> in innerHTML
    const innerHTML = tag.innerHTML;
    if (innerHTML.includes('<br>') || innerHTML.includes('<BR>')) {
      // LoD format: split by <br> and extract item names
      const parts = innerHTML.split(/<br\s*\/?>/i);
      for (const part of parts) {
        // Strip any remaining HTML tags and normalize whitespace
        const text = part
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) classifyAndAdd(text);
      }
    } else {
      // ESR format: single item in this FONT tag
      const rawText = tag.textContent;
      if (!rawText) continue;

      // Normalize whitespace (handles names split across lines like "Ist\n  Rune")
      const itemName = rawText.replace(/\s+/g, ' ').trim();
      if (itemName) classifyAndAdd(itemName);
    }
  }

  // Extract optional jewel info (e.g. "(0-3) Jewels") from Kanji runewords
  const cellText = cell.textContent.replace(/\s+/g, ' ');
  const jewelMatch = /\(\d+(?:-\d+)?\) Jewels?/.exec(cellText);
  const jewelInfo = jewelMatch ? jewelMatch[0] : undefined;

  return { runes, gems, ingredients, jewelInfo };
}

/**
 * Extracts rune names from the ingredients cell (backward-compatible wrapper).
 * @see extractIngredients for full extraction including gems.
 */
export function extractRunes(cell: Element): string[] {
  return extractIngredients(cell).runes;
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
    .map((item) =>
      item
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
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

interface ExtractedAffixes {
  affixes: Affix[];
  columnAffixes: SocketableBonuses;
}

/**
 * Extracts runeword affixes from all 3 bonus columns (weapon/helm/armor).
 * Columns 4-6 contain bonuses for different item types.
 *
 * Returns both the legacy `affixes` (first non-empty column, for backward compat)
 * and `columnAffixes` with all 3 columns separately.
 *
 * Most runewords have identical bonuses across columns, but 9 runewords
 * have item-type-specific bonuses (e.g., Machine, Lightning, Gluttony).
 */
export function extractAffixes(cells: NodeListOf<Element>): ExtractedAffixes {
  // Cells 3, 4, 5 are columns 4-6 (0-indexed)
  const weaponsGloves = parseRecipeAffixes(cells[3]);
  const helmsBoots = parseRecipeAffixes(cells[4]);
  const armorShieldsBelts = parseRecipeAffixes(cells[5]);

  // Legacy: first non-empty column
  const affixes = weaponsGloves.length > 0 ? weaponsGloves : helmsBoots.length > 0 ? helmsBoots : armorShieldsBelts;

  return {
    affixes,
    columnAffixes: { weaponsGloves, helmsBoots, armorShieldsBelts },
  };
}

interface TierPointEntry {
  tier: number;
  category: RuneCategory;
  totalPoints: number;
}

/**
 * Calculates tier point totals from a list of rune names.
 * Groups points by (category, tier) and sums them.
 *
 * For shared runes (e.g. Ko exists in both ESR and LoD), uses isLod to pick
 * the correct category via category-prefixed keys ("lodRunes:Ko Rune").
 */
export function calculateTierPointTotals(runes: string[], runePointsLookup: RunePointsLookup, isLod?: boolean): TierPointTotal[] {
  // Map of "category:tier" -> total points
  const totals = new Map<string, TierPointEntry>();

  const preferredCategory = isLod ? 'lodRunes' : 'esrRunes';

  for (const runeName of runes) {
    // Try category-specific key first to resolve shared runes correctly
    const info = runePointsLookup.get(`${preferredCategory}:${runeName}`) ?? runePointsLookup.get(runeName);
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

// Maps gem name to its required level
export type GemReqLevelLookup = Map<string, number>;

/**
 * Calculates the required level for a runeword.
 * Returns the highest required level among all runes and gems in the runeword.
 */
export function calculateReqLevel(
  runes: string[],
  runeReqLevelLookup: RuneReqLevelLookup,
  gems?: string[],
  gemReqLevelLookup?: GemReqLevelLookup
): number {
  let maxReqLevel = 0;
  for (const runeName of runes) {
    const reqLevel = runeReqLevelLookup.get(runeName);
    if (reqLevel !== undefined && reqLevel > maxReqLevel) {
      maxReqLevel = reqLevel;
    }
  }
  if (gems && gemReqLevelLookup) {
    for (const gemName of gems) {
      const reqLevel = gemReqLevelLookup.get(gemName);
      if (reqLevel !== undefined && reqLevel > maxReqLevel) {
        maxReqLevel = reqLevel;
      }
    }
  }
  return maxReqLevel;
}

/**
 * Calculates the sort key for a runeword.
 * ESR/Kanji runewords: reqLevel (0-9999)
 * LoD runewords: 10000 + reqLevel (10000+)
 *
 * A runeword is LoD if it contains at least one rune that is exclusively LoD
 * (exists in LoD but not in ESR/Kanji). Shared runes like Ko (both ESR and LoD)
 * do not by themselves make a runeword LoD.
 *
 * The lookup contains category-prefixed keys ("lodRunes:Ko Rune", "esrRunes:Ko Rune")
 * to distinguish shared runes.
 */
export function calculateSortKey(runes: string[], reqLevel: number, runePriorityLookup: RunePriorityLookup): number {
  let hasLodExclusiveRune = false;

  for (const runeName of runes) {
    const lodPriority = runePriorityLookup.get(`lodRunes:${runeName}`);
    if (lodPriority === undefined) continue; // Not a LoD rune at all

    // It's a LoD rune — check if it also exists in ESR or Kanji
    const esrPriority = runePriorityLookup.get(`esrRunes:${runeName}`);
    const kanjiPriority = runePriorityLookup.get(`kanjiRunes:${runeName}`);
    if (esrPriority === undefined && kanjiPriority === undefined) {
      // Exclusively LoD — this makes the runeword LoD
      hasLodExclusiveRune = true;
      break;
    }
  }

  return hasLodExclusiveRune ? LOD_SORT_KEY_OFFSET + reqLevel : reqLevel;
}

/**
 * Parses runewords from runewords.htm HTML.
 * Each row becomes a separate runeword entry with its variant number.
 * @param html The runewords.htm HTML content
 * @param runePointsLookup Optional lookup map for calculating tier point totals
 * @param runeReqLevelLookup Optional lookup map for calculating required level
 * @param runePriorityLookup Optional lookup map for calculating sort key
 * @param gemReqLevelLookup Optional lookup map for gem required levels
 */
export function parseRunewordsHtml(
  html: string,
  runePointsLookup?: RunePointsLookup,
  runeReqLevelLookup?: RuneReqLevelLookup,
  runePriorityLookup?: RunePriorityLookup,
  gemReqLevelLookup?: GemReqLevelLookup
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

    const { sockets, socketsMax } = extractSocketRange(nameCell);
    const { runes, gems, ingredients, jewelInfo } = extractIngredients(ingredientsCell);
    const { allowedItems, excludedItems } = extractAllowedItems(allowedItemsCell);
    const { affixes, columnAffixes } = extractAffixes(cells);

    // Calculate required level (highest reqLevel among all runes and gems)
    const reqLevel = runeReqLevelLookup ? calculateReqLevel(runes, runeReqLevelLookup, gems, gemReqLevelLookup) : 0;

    // Calculate sort key (ESR/Kanji: 0-9999, LoD: 10000+)
    const sortKey = runePriorityLookup ? calculateSortKey(runes, reqLevel, runePriorityLookup) : reqLevel;

    // Calculate tier point totals if lookup is provided.
    // Pass isLod so shared runes (e.g. Ko) resolve to the correct category.
    const isLod = sortKey >= LOD_SORT_KEY_OFFSET;
    const tierPointTotals = runePointsLookup ? calculateTierPointTotals(runes, runePointsLookup, isLod) : [];

    rawRunewords.push({
      name,
      variant: variantNum,
      sockets,
      socketsMax,
      reqLevel,
      sortKey,
      runes,
      gems,
      ingredients,
      allowedItems,
      excludedItems,
      affixes,
      columnAffixes,
      tierPointTotals,
      jewelInfo,
    });
  }

  // Convert to readonly Runeword type
  const runewords: Runeword[] = rawRunewords.map((rw) => ({
    name: rw.name,
    variant: rw.variant,
    sockets: rw.sockets,
    reqLevel: rw.reqLevel,
    sortKey: rw.sortKey,
    runes: rw.runes,
    gems: rw.gems,
    ingredients: rw.ingredients,
    allowedItems: rw.allowedItems,
    excludedItems: rw.excludedItems,
    affixes: rw.affixes,
    columnAffixes: rw.columnAffixes,
    tierPointTotals: rw.tierPointTotals,
    ...(rw.socketsMax !== undefined && { socketsMax: rw.socketsMax }),
    ...(rw.jewelInfo !== undefined && { jewelInfo: rw.jewelInfo }),
  }));

  console.log(`Parsed ${String(runewords.length)} runewords`);
  return runewords;
}

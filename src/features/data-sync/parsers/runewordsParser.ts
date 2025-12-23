import type { Runeword, Affix } from '@/core/db';
import { parseRunewordAffixes } from './shared/parserUtils';

interface RawRuneword {
  name: string;
  variant: number;
  sockets: number;
  runes: string[];
  allowedItems: string[];
  excludedItems: string[];
  affixes: Affix[];
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
 * Runes are in <FONT COLOR="...">X Rune</FONT> tags separated by <br>
 * We skip wrapper font tags (those that contain child FONT elements).
 */
export function extractRunes(cell: Element): string[] {
  const fontTags = cell.querySelectorAll('FONT[color], font[color]');
  const runes: string[] = [];

  for (const tag of fontTags) {
    // Skip wrapper elements that contain child FONT tags
    if (tag.querySelector('FONT, font')) continue;

    const runeName = tag.textContent;
    if (runeName && runeName.trim().endsWith(' Rune')) {
      runes.push(runeName.trim());
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

/**
 * Parses runewords from runewords.htm HTML.
 * Each row becomes a separate runeword entry with its variant number.
 */
export function parseRunewordsHtml(html: string): Runeword[] {
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

    rawRunewords.push({
      name,
      variant: variantNum,
      sockets,
      runes,
      allowedItems,
      excludedItems,
      affixes,
    });
  }

  // Convert to readonly Runeword type
  const runewords: Runeword[] = rawRunewords.map((rw) => ({
    name: rw.name,
    variant: rw.variant,
    sockets: rw.sockets,
    runes: rw.runes as readonly string[],
    allowedItems: rw.allowedItems as readonly string[],
    excludedItems: rw.excludedItems as readonly string[],
    affixes: rw.affixes as readonly Affix[],
  }));

  console.log(`Parsed ${String(runewords.length)} runewords`);
  return runewords;
}

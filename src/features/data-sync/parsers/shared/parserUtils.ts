import type { Affix, SocketableBonuses } from '@/core/db';

export interface NormalizedRuneName {
  name: string;
  points?: number;
}

/**
 * Normalizes a rune name by stripping "(X points)" suffix if present.
 * Returns the clean name and extracted points value.
 *
 * Examples:
 *   "I Rune (1 points)" -> { name: "I Rune", points: 1 }
 *   "I Rune"            -> { name: "I Rune", points: undefined }
 *   "Ru Rune"           -> { name: "Ru Rune", points: undefined }
 */
export function normalizeRuneName(rawName: string): NormalizedRuneName {
  const match = /^(.+?)\s*\((\d+)\s*points?\)$/i.exec(rawName.trim());
  if (match) {
    return { name: match[1].trim(), points: parseInt(match[2], 10) };
  }
  return { name: rawName.trim(), points: undefined };
}

/**
 * Extracts required level from text containing "Req Lvl: N"
 */
export function parseReqLevel(text: string): number {
  const match = /Req Lvl:\s*(\d+)/i.exec(text);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extracts numeric value from affix text.
 * Handles ranges (e.g., "10-20") and single numbers.
 */
export function extractValue(text: string): number | readonly [number, number] | null {
  // Range pattern: "Adds 10-20 Fire Damage"
  const rangeMatch = /(\d+)-(\d+)/.exec(text);
  if (rangeMatch) {
    return [parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)] as const;
  }

  // Single number pattern
  const singleMatch = /[+-]?(\d+)/.exec(text);
  if (singleMatch) {
    return parseInt(singleMatch[1], 10);
  }

  return null;
}

/**
 * Detects the value type of an affix based on its text.
 */
export function detectValueType(text: string): 'flat' | 'percent' | 'range' | 'none' {
  if (/\d+-\d+/.test(text)) return 'range';
  if (/%/.test(text)) return 'percent';
  if (/[+-]?\d+/.test(text)) return 'flat';
  return 'none';
}

/**
 * Parses affixes from a table cell's innerHTML.
 * Splits on <br> tags and creates Affix objects.
 */
export function parseAffixes(cell: Element): Affix[] {
  const html = cell.innerHTML;
  if (!html.trim()) return [];

  return html
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]*>/g, ''))
    .map((line) => decodeHtmlEntities(line))
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((rawText) => ({
      rawText,
      pattern: rawText.replace(/[+-]?\d+/g, '#'),
      value: extractValue(rawText),
      valueType: detectValueType(rawText),
    }));
}

/**
 * Parses the three bonus categories from a header row.
 * Bonuses are in the row after the column headers row.
 */
export function parseBonuses(headerRow: Element): SocketableBonuses {
  const bonusRow = headerRow.nextElementSibling?.nextElementSibling;
  if (!bonusRow) {
    return { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: [] };
  }

  const cells = bonusRow.querySelectorAll('td');
  const cell0 = cells[0] as Element | undefined;
  const cell1 = cells[1] as Element | undefined;
  const cell2 = cells[2] as Element | undefined;

  return {
    weaponsGloves: cell0 ? parseAffixes(cell0) : [],
    helmsBoots: cell1 ? parseAffixes(cell1) : [],
    armorShieldsBelts: cell2 ? parseAffixes(cell2) : [],
  };
}

/**
 * Checks if a header cell has a colored inner FONT tag.
 * Structure: <font...><b><FONT COLOR="...">Name</FONT></b></font>
 */
export function hasColoredInnerFont(headerCell: Element): boolean {
  const innerFont = headerCell.querySelector('b font[color], b FONT[color]');
  return innerFont !== null;
}

/**
 * Gets the color attribute from the inner FONT tag.
 * Returns null if no colored inner font exists.
 */
export function getInnerFontColor(headerCell: Element): string | null {
  const innerFont = headerCell.querySelector('b font[color], b FONT[color]');
  return innerFont?.getAttribute('color')?.toUpperCase() ?? null;
}

/**
 * Gets the item name from a header cell.
 * Handles both colored inner fonts and plain text in <b> tags.
 */
export function getItemName(headerCell: Element): string {
  // Try colored inner font first
  const innerFont = headerCell.querySelector('b font[color], b FONT[color]');
  if (innerFont?.textContent) {
    return innerFont.textContent.trim();
  }

  // Fall back to <b> tag text content
  const bTag = headerCell.querySelector('b');
  if (bTag?.textContent) {
    return bTag.textContent.trim();
  }

  return '';
}

/**
 * Normalizes whitespace in text by collapsing multiple spaces/newlines to single space.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Decodes common HTML entities that remain after stripping HTML tags from innerHTML.
 * When using innerHTML to split on <br> tags, entities like &amp; stay encoded.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Parses affixes from a runeword bonus cell, extracting ONLY
 * the runeword bonuses (before the <br><br> separator).
 *
 * Runeword cells contain: [runeword bonuses]<br><br>[rune bonuses]
 * We only want the runeword bonuses.
 */
export function parseRunewordAffixes(cell: Element): Affix[] {
  const html = cell.innerHTML;
  if (!html.trim()) return [];

  // Split on double <br> (separator between runeword and rune bonuses)
  // Handle variations: <br><br>, <br/><br/>, <br /><br />, etc.
  const parts = html.split(/<br\s*\/?>\s*<br\s*\/?>/i);

  // Take only the first part (runeword bonuses)
  const runewordBonusesHtml = parts[0] ?? '';

  return runewordBonusesHtml
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]*>/g, ''))
    .map((line) => decodeHtmlEntities(line))
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0)
    .map((rawText) => ({
      rawText,
      pattern: rawText.replace(/[+-]?\d+/g, '#'),
      value: extractValue(rawText),
      valueType: detectValueType(rawText),
    }));
}

import type { LodRune } from '@/core/db';
import { parseReqLevel, parseBonuses, hasColoredInnerFont, getItemName } from './shared/parserUtils';
import { LOD_RUNE_NAMES } from '../constants/constants.ts';

/**
 * Checks if a name is a LoD rune.
 * LoD runes end with " Rune" and match one of the standard LoD rune names.
 */
export function isLodRuneName(name: string): boolean {
  if (!name.endsWith(' Rune')) return false;
  const runeName = name.replace(' Rune', '');
  return LOD_RUNE_NAMES.includes(runeName);
}

/**
 * Gets the order of a LoD rune (1-based, El = 1, Zod = 33)
 */
export function getLodRuneOrder(name: string): number {
  const runeName = name.replace(' Rune', '');
  const index = LOD_RUNE_NAMES.indexOf(runeName);
  return index >= 0 ? index + 1 : 0;
}

export function parseLodRunesHtml(html: string): LodRune[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const lodRunes: LodRune[] = [];

  const headerCells = doc.querySelectorAll('td[colspan="3"]');

  for (const headerCell of headerCells) {
    const headerRow = headerCell.parentElement;
    if (!headerRow) continue;

    // LoD runes do NOT have colored inner font (plain text in <b> tag)
    if (hasColoredInnerFont(headerCell)) continue;

    const name = getItemName(headerCell);
    if (!name || !isLodRuneName(name)) continue;

    const order = getLodRuneOrder(name);
    if (order === 0) continue;

    const headerText = headerCell.textContent;
    const reqLevel = headerText ? parseReqLevel(headerText) : 0;

    const bonuses = parseBonuses(headerRow);

    lodRunes.push({
      name,
      order,
      reqLevel,
      bonuses,
    });
  }

  // Sort by order to ensure correct sequence
  lodRunes.sort((a, b) => a.order - b.order);

  console.log(`Parsed ${String(lodRunes.length)} LoD runes`);
  return lodRunes;
}

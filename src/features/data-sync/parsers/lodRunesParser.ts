import type { LodRune } from '@/core/db';
import { parseReqLevel, parseBonuses, hasColoredInnerFont, getItemName, normalizeRuneName } from './shared/parserUtils';
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

// LoD rune tier boundaries
const LOD_LOW_TIER_MAX_ORDER = 11; // El(1) to Amn(11)
const LOD_MID_TIER_MAX_ORDER = 22; // Sol(12) to Um(22)
// High tier: Mal(23) to Zod(33)

/**
 * Gets the tier of a LoD rune based on its order.
 * - Tier 1 (Low): El to Amn (order 1-11)
 * - Tier 2 (Mid): Sol to Um (order 12-22)
 * - Tier 3 (High): Mal to Zod (order 23-33)
 */
export function getLodRuneTier(order: number): number {
  if (order <= LOD_LOW_TIER_MAX_ORDER) return 1;
  if (order <= LOD_MID_TIER_MAX_ORDER) return 2;
  return 3;
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

    const rawName = getItemName(headerCell);
    if (!rawName) continue;

    // Normalize name to strip "(X points)" suffix if present
    const { name, points } = normalizeRuneName(rawName);
    if (!isLodRuneName(name)) continue;

    const order = getLodRuneOrder(name);
    if (order === 0) continue;

    const headerText = headerCell.textContent;
    const reqLevel = headerText ? parseReqLevel(headerText) : 0;

    const bonuses = parseBonuses(headerRow);

    lodRunes.push({
      name,
      order,
      tier: getLodRuneTier(order),
      reqLevel,
      points,
      bonuses,
    });
  }

  // Sort by order to ensure correct sequence
  lodRunes.sort((a, b) => a.order - b.order);

  console.log(`Parsed ${String(lodRunes.length)} LoD runes`);
  return lodRunes;
}

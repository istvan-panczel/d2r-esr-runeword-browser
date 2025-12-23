import type { EsrRune } from '@/core/db';
import { parseReqLevel, parseBonuses, hasColoredInnerFont, getInnerFontColor, getItemName } from './shared/parserUtils';
import { isGemName } from './gemsParser';
import { isLodRuneName } from './lodRunesParser';
import { isCrystalName } from './crystalsParser';

// ESR rune colors mapped to tier numbers
const ESR_COLOR_TO_TIER: Record<string, number> = {
  WHITE: 1,
  RED: 2,
  YELLOW: 3,
  ORANGE: 4,
  GREEN: 5,
  GOLD: 6,
  PURPLE: 7,
};

/**
 * Checks if a name is an ESR rune.
 * ESR runes: have colored inner font (not BLUE), end with " Rune",
 * and are not LoD runes, gems, or crystals.
 */
export function isEsrRuneName(name: string, color: string | null): boolean {
  if (!name.endsWith(' Rune')) return false;
  if (!color) return false;
  if (color === 'BLUE') return false; // Kanji runes are blue
  if (isLodRuneName(name)) return false;
  if (isGemName(name)) return false;
  if (isCrystalName(name)) return false;
  return true;
}

export function parseEsrRunesHtml(html: string): EsrRune[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const esrRunes: EsrRune[] = [];

  const headerCells = doc.querySelectorAll('td[colspan="3"]');

  for (const headerCell of headerCells) {
    const headerRow = headerCell.parentElement;
    if (!headerRow) continue;

    // ESR runes must have colored inner font
    if (!hasColoredInnerFont(headerCell)) continue;

    const name = getItemName(headerCell);
    if (!name) continue;

    const color = getInnerFontColor(headerCell);
    if (!isEsrRuneName(name, color)) continue;

    // Derive tier from color
    const tier = color ? (ESR_COLOR_TO_TIER[color] ?? 1) : 1;

    const headerText = headerCell.textContent;
    const reqLevel = headerText ? parseReqLevel(headerText) : 0;

    const bonuses = parseBonuses(headerRow);

    esrRunes.push({
      name,
      tier,
      color: color ?? '',
      reqLevel,
      bonuses,
    });
  }

  console.log(`Parsed ${String(esrRunes.length)} ESR runes`);
  return esrRunes;
}

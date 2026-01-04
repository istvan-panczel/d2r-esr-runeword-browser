import type { EsrRune } from '@/core/db';
import { parseReqLevel, parseBonuses, hasColoredInnerFont, getInnerFontColor, getItemName, normalizeRuneName } from './shared/parserUtils';
import { isGemName } from './gemsParser';
import { isCrystalName } from './crystalsParser';
import { ESR_COLOR_TO_TIER } from '../constants/constants.ts';

/**
 * Checks if a name is an ESR rune.
 * ESR runes: have colored inner font (not BLUE), end with " Rune",
 * and are not gems or crystals.
 * Note: Some rune names (like "Ko") exist in both ESR and LoD - the color distinguishes them.
 */
export function isEsrRuneName(name: string, color: string | null): boolean {
  if (!name.endsWith(' Rune')) return false;
  if (!color) return false;
  if (color === 'BLUE') return false; // Kanji runes are blue
  if (isGemName(name)) return false;
  if (isCrystalName(name)) return false;
  return true;
}

export function parseEsrRunesHtml(html: string): EsrRune[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const esrRunes: EsrRune[] = [];
  let order = 0;

  const headerCells = doc.querySelectorAll('td[colspan="3"]');

  for (const headerCell of headerCells) {
    const headerRow = headerCell.parentElement;
    if (!headerRow) continue;

    // ESR runes must have colored inner font
    if (!hasColoredInnerFont(headerCell)) continue;

    const rawName = getItemName(headerCell);
    if (!rawName) continue;

    // Normalize name to strip "(X points)" suffix if present
    const { name, points } = normalizeRuneName(rawName);

    const color = getInnerFontColor(headerCell);
    if (!isEsrRuneName(name, color)) continue;

    // Derive tier from color
    const tier = color ? (ESR_COLOR_TO_TIER[color] ?? 1) : 1;

    const headerText = headerCell.textContent;
    const reqLevel = headerText ? parseReqLevel(headerText) : 0;

    const bonuses = parseBonuses(headerRow);

    order += 1;
    esrRunes.push({
      name,
      order,
      tier,
      color: color ?? '',
      reqLevel,
      points,
      bonuses,
    });
  }

  console.log(`Parsed ${String(esrRunes.length)} ESR runes`);
  return esrRunes;
}

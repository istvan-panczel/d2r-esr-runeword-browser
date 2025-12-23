import type { Gem, GemType, GemQuality } from '@/core/db';
import { parseReqLevel, parseBonuses, getInnerFontColor, getItemName } from './shared/parserUtils';

const GEM_TYPES: readonly GemType[] = ['Amethyst', 'Sapphire', 'Emerald', 'Ruby', 'Diamond', 'Topaz', 'Skull', 'Obsidian'];
const GEM_QUALITIES: readonly GemQuality[] = ['Chipped', 'Flawed', 'Standard', 'Flawless', 'Blemished', 'Perfect'];

function extractGemTypeAndQuality(name: string): { type: GemType; quality: GemQuality } | null {
  for (const gemType of GEM_TYPES) {
    if (name.includes(gemType)) {
      // Check for quality prefix
      for (const quality of GEM_QUALITIES) {
        if (quality === 'Standard') {
          // Standard has no prefix - it's just the gem type name
          if (name === gemType) {
            return { type: gemType, quality: 'Standard' };
          }
        } else if (name.startsWith(quality)) {
          return { type: gemType, quality };
        }
      }
    }
  }
  return null;
}

export function isGemName(name: string): boolean {
  return GEM_TYPES.some((type) => name.includes(type));
}

export function parseGemsHtml(html: string): Gem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const gems: Gem[] = [];

  // Find all header rows (rows with colspan="3" containing item names)
  const headerCells = doc.querySelectorAll('td[colspan="3"]');

  for (const headerCell of headerCells) {
    const headerRow = headerCell.parentElement;
    if (!headerRow) continue;

    const name = getItemName(headerCell);
    if (!name || !isGemName(name)) continue;

    const color = getInnerFontColor(headerCell) ?? '';

    // Extract type and quality
    const typeQuality = extractGemTypeAndQuality(name);
    if (!typeQuality) continue;

    // Extract required level
    const headerText = headerCell.textContent;
    const reqLevel = headerText ? parseReqLevel(headerText) : 0;

    // Extract bonuses
    const bonuses = parseBonuses(headerRow);

    gems.push({
      name,
      type: typeQuality.type,
      quality: typeQuality.quality,
      color,
      reqLevel,
      bonuses,
    });
  }

  console.log(`Parsed ${String(gems.length)} gems`);
  return gems;
}

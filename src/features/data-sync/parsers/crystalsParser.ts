import type { Crystal, CrystalType, CrystalQuality } from '@/core/db';
import { parseReqLevel, parseBonuses, getInnerFontColor, getItemName } from './shared/parserUtils';

const CRYSTAL_TYPES: readonly CrystalType[] = [
  'Shadow Quartz',
  'Frozen Soul',
  'Bleeding Stone',
  'Burning Sulphur',
  'Dark Azurite',
  'Bitter Peridot',
  'Pulsing Opal',
  'Enigmatic Cinnabar',
  'Tomb Jade',
  'Solid Mercury',
  'Storm Amber',
  'Tainted Tourmaline',
];

const CRYSTAL_QUALITIES: readonly CrystalQuality[] = ['Chipped', 'Flawed', 'Standard'];

/**
 * Checks if a name contains a crystal type.
 */
export function isCrystalName(name: string): boolean {
  return CRYSTAL_TYPES.some((type) => name.includes(type));
}

/**
 * Extracts crystal type and quality from a crystal name.
 */
function extractCrystalTypeAndQuality(name: string): { type: CrystalType; quality: CrystalQuality } | null {
  for (const crystalType of CRYSTAL_TYPES) {
    if (name.includes(crystalType)) {
      // Check for quality prefix
      for (const quality of CRYSTAL_QUALITIES) {
        if (quality === 'Standard') {
          // Standard has no prefix - it's just the crystal type name
          if (name === crystalType) {
            return { type: crystalType, quality: 'Standard' };
          }
        } else if (name.startsWith(quality)) {
          return { type: crystalType, quality };
        }
      }
    }
  }
  return null;
}

export function parseCrystalsHtml(html: string): Crystal[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const crystals: Crystal[] = [];

  const headerCells = doc.querySelectorAll('td[colspan="3"]');

  for (const headerCell of headerCells) {
    const headerRow = headerCell.parentElement;
    if (!headerRow) continue;

    const name = getItemName(headerCell);
    if (!name || !isCrystalName(name)) continue;

    const typeQuality = extractCrystalTypeAndQuality(name);
    if (!typeQuality) continue;

    const color = getInnerFontColor(headerCell) ?? '';

    const headerText = headerCell.textContent;
    const reqLevel = headerText ? parseReqLevel(headerText) : 0;

    const bonuses = parseBonuses(headerRow);

    crystals.push({
      name,
      type: typeQuality.type,
      quality: typeQuality.quality,
      color,
      reqLevel,
      bonuses,
    });
  }

  console.log(`Parsed ${String(crystals.length)} crystals`);
  return crystals;
}

import { v4 as uuidv4 } from 'uuid';
import type { Affix, Gem, GemType, GemQuality, SocketableBonuses } from '@/core/db';

const GEM_TYPES: readonly GemType[] = ['Amethyst', 'Sapphire', 'Emerald', 'Ruby', 'Diamond', 'Topaz', 'Skull', 'Obsidian'];
const GEM_QUALITIES: readonly GemQuality[] = ['Chipped', 'Flawed', 'Standard', 'Flawless', 'Blemished', 'Perfect'];

function parseReqLevel(text: string): number {
  const match = /Req Lvl:\s*(\d+)/i.exec(text);
  return match ? parseInt(match[1], 10) : 0;
}

function parseAffixes(cell: Element): Affix[] {
  // Use innerHTML to preserve <br> tags, then split on them
  const html = cell.innerHTML;
  if (!html.trim()) return [];

  return html
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]*>/g, '').trim()) // Strip any remaining HTML tags
    .filter((line) => line.length > 0)
    .map((rawText) => ({
      id: uuidv4(),
      rawText,
      pattern: rawText.replace(/[+-]?\d+/g, '#'),
      value: extractValue(rawText),
      valueType: detectValueType(rawText),
    }));
}

function extractValue(text: string): number | readonly [number, number] | null {
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

function detectValueType(text: string): 'flat' | 'percent' | 'range' | 'none' {
  if (/\d+-\d+/.test(text)) return 'range';
  if (/%/.test(text)) return 'percent';
  if (/[+-]?\d+/.test(text)) return 'flat';
  return 'none';
}

function parseBonuses(headerRow: Element): SocketableBonuses {
  // The bonuses are in the row after the column headers row
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

function isGemName(name: string): boolean {
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

    // Extract name and color from the inner FONT tag (inside <b> tag)
    // Structure: <font color="GRAY"><b><FONT COLOR="GREEN">Name</FONT></b></font>
    const innerFontTag = headerCell.querySelector('b font[color], b FONT[color]');
    if (!innerFontTag) continue;

    const name = innerFontTag.textContent.trim();
    if (!name || !isGemName(name)) continue;

    const color = innerFontTag.getAttribute('color') ?? '';

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

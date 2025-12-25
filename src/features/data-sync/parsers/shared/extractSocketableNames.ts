import { getItemName, getInnerFontColor, hasColoredInnerFont } from './parserUtils';

export interface ExtractedSocketable {
  readonly name: string;
  readonly color: string | null;
  readonly isRune: boolean;
}

/**
 * Extracts all socketable names from the gems HTML.
 * This is used for completeness verification - ensuring no socketables are missed by parsers.
 *
 * The HTML structure has header cells with colspan="3" containing item names.
 * Colors indicate rune type:
 * - No colored inner font → LoD rune
 * - BLUE → Kanji rune
 * - Other colors (WHITE, RED, YELLOW, etc.) → ESR rune
 * - Non-runes → gems or crystals
 */
export function extractAllSocketableNames(html: string): ExtractedSocketable[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const socketables: ExtractedSocketable[] = [];

  const headerCells = doc.querySelectorAll('td[colspan="3"]');

  for (const headerCell of headerCells) {
    const name = getItemName(headerCell);
    if (!name) continue;

    // Determine color
    let color: string | null = null;
    if (hasColoredInnerFont(headerCell)) {
      color = getInnerFontColor(headerCell);
    }

    const isRune = name.endsWith(' Rune');

    socketables.push({ name, color, isRune });
  }

  return socketables;
}

/**
 * Groups extracted socketables by their expected parser category.
 */
export function categorizeSocketables(socketables: ExtractedSocketable[]): {
  lodRunes: string[];
  kanjiRunes: string[];
  esrRunes: string[];
  nonRunes: string[]; // gems and crystals
} {
  const lodRunes: string[] = [];
  const kanjiRunes: string[] = [];
  const esrRunes: string[] = [];
  const nonRunes: string[] = [];

  for (const { name, color, isRune } of socketables) {
    if (isRune) {
      if (color === null) {
        // No color = LoD rune
        lodRunes.push(name);
      } else if (color === 'BLUE') {
        // Blue = Kanji rune
        kanjiRunes.push(name);
      } else {
        // Other colors = ESR rune
        esrRunes.push(name);
      }
    } else {
      // Non-runes are gems or crystals
      nonRunes.push(name);
    }
  }

  return { lodRunes, kanjiRunes, esrRunes, nonRunes };
}

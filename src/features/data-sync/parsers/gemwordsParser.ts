import type { Affix, Gemword, SocketableBonuses } from '@/core/db';
import { extractName, extractSockets, extractAllowedItems, type GemReqLevelLookup } from './runewordsParser';
import { isGemName } from './gemsParser';
import { parseRecipeAffixes } from './shared/parserUtils';

interface ExtractedGemwordAffixes {
  readonly affixes: Affix[];
  readonly columnAffixes: SocketableBonuses;
}

export interface ExtractedGemwordIngredients {
  readonly gems: string[];
  readonly jewelInfo?: string;
}

export function extractGemwordIngredients(cell: Element): ExtractedGemwordIngredients {
  const lines = cell.innerHTML
    .split(/<br\s*\/?>/i)
    .map((line) =>
      line
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((line) => line.length > 0);

  // Some gemword recipes also require a jewel, listed as a plain "Jewel" line
  const jewelInfo = lines.find((line) => /^Jewels?$/i.test(line));

  return {
    gems: lines.filter((line) => isGemName(line)),
    jewelInfo,
  };
}

export function calculateGemwordReqLevel(gems: readonly string[], gemReqLevelLookup?: GemReqLevelLookup): number {
  if (!gemReqLevelLookup) return 0;

  let maxReqLevel = 0;
  for (const gemName of gems) {
    const reqLevel = gemReqLevelLookup.get(gemName);
    if (reqLevel !== undefined && reqLevel > maxReqLevel) {
      maxReqLevel = reqLevel;
    }
  }
  return maxReqLevel;
}

function extractGemwordAffixes(cells: NodeListOf<Element>): ExtractedGemwordAffixes {
  // Gemword cells contain [gemword bonuses]<br><br>[gem bonuses]; keep only the gemword's own bonuses
  const weaponsGloves = parseRecipeAffixes(cells[3]);
  const helmsBoots = parseRecipeAffixes(cells[4]);
  const armorShieldsBelts = parseRecipeAffixes(cells[5]);
  const affixes = weaponsGloves.length > 0 ? weaponsGloves : helmsBoots.length > 0 ? helmsBoots : armorShieldsBelts;

  return {
    affixes,
    columnAffixes: { weaponsGloves, helmsBoots, armorShieldsBelts },
  };
}

export function parseGemwordsHtml(html: string, gemReqLevelLookup?: GemReqLevelLookup): Gemword[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const gemwords: Gemword[] = [];
  const variantCounters = new Map<string, number>();
  const rows = doc.querySelectorAll('tr.recipeRow');

  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) continue;

    const name = extractName(cells[0]);
    if (!name) continue;

    const variant = (variantCounters.get(name) ?? 0) + 1;
    variantCounters.set(name, variant);

    const sockets = extractSockets(cells[0]);
    const { gems, jewelInfo } = extractGemwordIngredients(cells[1]);
    const { allowedItems } = extractAllowedItems(cells[2]);
    const { affixes, columnAffixes } = extractGemwordAffixes(cells);
    const reqLevel = calculateGemwordReqLevel(gems, gemReqLevelLookup);

    gemwords.push({
      name,
      variant,
      sockets,
      reqLevel,
      sortKey: reqLevel,
      gems,
      ingredients: gems,
      allowedItems,
      affixes,
      columnAffixes,
      ...(jewelInfo !== undefined && { jewelInfo }),
    });
  }

  console.log(`Parsed ${String(gemwords.length)} gemwords`);
  return gemwords;
}

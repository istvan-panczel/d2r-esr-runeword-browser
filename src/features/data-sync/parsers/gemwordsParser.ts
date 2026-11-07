import type { Gemword } from '@/core/db';
import { extractName, extractSockets, extractAllowedItems, type GemReqLevelLookup } from './runewordsParser';
import { isGemName } from './gemsParser';
import { parseReqLevel } from './shared/parserUtils';
import { extractRecipeRowBonuses, recipeRowLayout } from './shared/recipeRowBonuses';
import { stripHtmlTags } from '@/lib/html';

export interface ExtractedGemwordIngredients {
  readonly gems: string[];
  readonly jewelInfo?: string;
}

function extractGemwordIngredients(cell: Element): ExtractedGemwordIngredients {
  const lines = cell.innerHTML
    .split(/<br\s*\/?>/i)
    .map((line) => stripHtmlTags(line).replace(/\s+/g, ' ').trim())
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

/**
 * Parses gemwords.htm in either table layout (see `RecipeTableLayout`; the ESR 3.3+ one adds the "Socketable Bonuses"
 * groups). Old layout: each bonus column holds [gemword bonuses]<br><br>[random pools]<br><br>[gem bonuses], of which
 * only the gemword's own bonuses and pools are kept; 3.3+: the "Bonuses" column holds just the bonuses and pools.
 */
export function parseGemwordsHtml(html: string, gemReqLevelLookup?: GemReqLevelLookup): Gemword[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const gemwords: Gemword[] = [];
  const variantCounters = new Map<string, number>();
  const seenRows = new Set<string>();
  const rows = doc.querySelectorAll('tr.recipeRow');

  for (const row of rows) {
    // ESR 3.2 lists a few recipes (America, Canada, China) twice with identical markup
    if (seenRows.has(row.innerHTML)) continue;
    seenRows.add(row.innerHTML);

    const cells = row.querySelectorAll('td');
    if (recipeRowLayout(cells) === null) continue;

    const name = extractName(cells[0]);
    if (!name) continue;

    const variant = (variantCounters.get(name) ?? 0) + 1;
    variantCounters.set(name, variant);

    const sockets = extractSockets(cells[0]);
    const { gems, jewelInfo } = extractGemwordIngredients(cells[1]);
    const { allowedItems } = extractAllowedItems(cells[2]);
    const { affixes, columnAffixes, columnBonusPools, socketableBonuses } = extractRecipeRowBonuses(cells, allowedItems);
    // The level the ESR 3.3+ page prints ("Req Lvl: N"; it matches the gems' highest on every row), else the gems' highest
    const pageReqLevel = parseReqLevel(cells[0].textContent);
    const reqLevel = pageReqLevel > 0 ? pageReqLevel : calculateGemwordReqLevel(gems, gemReqLevelLookup);

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
      columnBonusPools,
      ...(jewelInfo !== undefined && { jewelInfo }),
      ...(socketableBonuses !== undefined && { socketableBonuses }),
    });
  }

  console.log(`Parsed ${String(gemwords.length)} gemwords`);
  return gemwords;
}

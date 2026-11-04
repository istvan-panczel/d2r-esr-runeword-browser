import type { Affix, ColumnBonusPools, Gemword, SocketableBonuses } from '@/core/db';
import { extractName, extractSockets, extractAllowedItems, type GemReqLevelLookup } from './runewordsParser';
import { isGemName } from './gemsParser';
import { parseRecipeAffixes, parseRecipeBonusPools } from './shared/parserUtils';
import { stripHtmlTags } from '@/lib/html';

interface ExtractedGemwordAffixes {
  readonly affixes: Affix[];
  readonly columnAffixes: SocketableBonuses;
  readonly columnBonusPools: ColumnBonusPools;
}

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

function extractGemwordAffixes(cells: NodeListOf<Element>): ExtractedGemwordAffixes {
  // Gemword cells contain [gemword bonuses]<br><br>[gem bonuses]; keep only the gemword's own bonuses.
  // Since ESR 3.2 most non-Charm rows also list "1-2 of the following:" random pools in between
  const weaponsGloves = parseRecipeAffixes(cells[3]);
  const helmsBoots = parseRecipeAffixes(cells[4]);
  const armorShieldsBelts = parseRecipeAffixes(cells[5]);
  const affixes = weaponsGloves.length > 0 ? weaponsGloves : helmsBoots.length > 0 ? helmsBoots : armorShieldsBelts;

  return {
    affixes,
    columnAffixes: { weaponsGloves, helmsBoots, armorShieldsBelts },
    columnBonusPools: {
      weaponsGloves: parseRecipeBonusPools(cells[3]),
      helmsBoots: parseRecipeBonusPools(cells[4]),
      armorShieldsBelts: parseRecipeBonusPools(cells[5]),
    },
  };
}

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
    if (cells.length < 6) continue;

    const name = extractName(cells[0]);
    if (!name) continue;

    const variant = (variantCounters.get(name) ?? 0) + 1;
    variantCounters.set(name, variant);

    const sockets = extractSockets(cells[0]);
    const { gems, jewelInfo } = extractGemwordIngredients(cells[1]);
    const { allowedItems } = extractAllowedItems(cells[2]);
    const { affixes, columnAffixes, columnBonusPools } = extractGemwordAffixes(cells);
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
      columnBonusPools,
      ...(jewelInfo !== undefined && { jewelInfo }),
    });
  }

  console.log(`Parsed ${String(gemwords.length)} gemwords`);
  return gemwords;
}

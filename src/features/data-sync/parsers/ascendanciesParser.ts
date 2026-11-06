import type { Ascendancy, AscendancyChallenge, AscendancyRecipe, AscendancyTier } from '@/core/db';
import { stripHtmlTags } from '@/lib/html';
import { decodeHtmlEntities, extractCellLines, mergeWrappedLines } from './shared/parserUtils';

/**
 * Cleans a text string: strips HTML tags, decodes entities, normalizes whitespace, trims.
 */
function cleanText(html: string): string {
  return decodeHtmlEntities(stripHtmlTags(html)).replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the ascendancy name from the image div.
 * Looks for <font color="orange" size="4">NAME Ascendancy</font>.
 */
function extractName(imageDiv: Element): string {
  const nameFont = imageDiv.querySelector('font[color="orange"][size="4"]');
  if (!nameFont?.textContent) return '';
  return nameFont.textContent.trim().replace(/\s*Ascendancy\s*$/, '');
}

/**
 * Extracts the image URL from the image div.
 */
function extractImageUrl(imageDiv: Element): string {
  const img = imageDiv.querySelector('img');
  return img?.getAttribute('src') ?? '';
}

/**
 * Extracts tiers and bonuses from the text div.
 * Splits on <font color="orange">Tier N</font> labels in the innerHTML.
 */
function extractTiers(textDiv: Element): AscendancyTier[] {
  // Find the font element that contains the tier data (the one with size="-1")
  const contentFont = textDiv.querySelector('font[size="-1"]');
  if (!contentFont) return [];

  const html = contentFont.innerHTML;

  // Split on tier labels: <font color="orange">Tier N</font>, optionally with a
  // footnote marker ("Tier 3*", since ESR 3.2). The regex captures the tier number
  const tierRegex = /<font\s+color="orange"\s*>\s*Tier\s+(\d+)\s*\**\s*<\/font>/gi;

  const tiers: AscendancyTier[] = [];
  const matches: Array<{ tierNum: number; index: number; matchLength: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = tierRegex.exec(html)) !== null) {
    matches.push({
      tierNum: parseInt(match[1], 10),
      index: match.index,
      matchLength: match[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].matchLength;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const segment = html.slice(start, end);

    // Split on <br> tags
    const lines = segment.split(/<br\s*\/?>/i);

    // Re-join hard-wrapped bonuses (empty lines act as separators and are dropped)
    const bonuses = mergeWrappedLines(lines.map((line) => cleanText(line)));

    tiers.push({
      tier: matches[i].tierNum,
      bonuses,
    });
  }

  return tiers;
}

/**
 * Identifies which child div is the "image div" (contains name + image)
 * vs the "text div" (contains tiers + bonuses).
 *
 * The image div has flex-direction: column in its style.
 */
function identifyDivs(flexContainer: Element): { imageDiv: Element; textDiv: Element } | null {
  const children = Array.from(flexContainer.children).filter((el) => el.tagName === 'DIV');
  if (children.length < 2) return null;

  const imageDiv = children.find((div) => (div.getAttribute('style') ?? '').includes('flex-direction'));
  const textDiv = children.find((div) => div !== imageDiv);

  if (!imageDiv || !textDiv) return null;
  return { imageDiv, textDiv };
}

// ─── Challenges ──────────────────────────────────────────────────────────────

/** The heading of a challenge section: `<h3>Tier 1 Challenge</h3>` */
const CHALLENGE_HEADING = /^Tier\s+(\d+)\s+Challenge$/i;

/** Elements that end a challenge section: the next heading */
const SECTION_END_TAGS: ReadonlySet<string> = new Set(['H1', 'H2', 'H3']);

/** The non-empty visual lines of a cell (split on <br>, whitespace normalised) */
function cellLines(cell: Element): string[] {
  return extractCellLines(cell)
    .map((line) => line.text)
    .filter((text) => text.length > 0);
}

function rowCells(row: Element): Element[] {
  return Array.from(row.children).filter((el) => el.tagName === 'TD' || el.tagName === 'TH');
}

/** The "Input | Output" header row of a recipe table */
function isInputOutputHeader(row: Element): boolean {
  const texts = rowCells(row).map((cell) => cleanText(cell.textContent));
  return texts.length >= 2 && /^inputs?$/i.test(texts[0]) && /^outputs?$/i.test(texts[1]);
}

/** The tables between a challenge heading and the next heading (also inside wrapper elements without a heading) */
function sectionTables(heading: Element): Element[] {
  const tables: Element[] = [];
  for (let el = heading.nextElementSibling; el && !SECTION_END_TAGS.has(el.tagName); el = el.nextElementSibling) {
    if (el.tagName === 'TABLE') {
      tables.push(el);
    } else {
      if (el.querySelector('h1, h2, h3')) break;
      tables.push(...Array.from(el.querySelectorAll('table')));
    }
  }
  return tables;
}

/** Paragraphs of a description table: one per <br>-separated line, hard-wrapped lines re-joined */
function extractDescription(table: Element): string[] {
  const cell = table.querySelector('td');
  if (!cell) return [];
  return mergeWrappedLines(extractCellLines(cell).map((line) => line.text));
}

function extractRecipes(table: Element): AscendancyRecipe[] | null {
  const rows = Array.from(table.querySelectorAll('tr'));
  const headerIndex = rows.findIndex(isInputOutputHeader);
  if (headerIndex === -1) return null;
  const recipes: AscendancyRecipe[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const cells = rowCells(row);
    if (cells.length < 2) continue;
    const inputs = cellLines(cells[0]);
    const outputs = cellLines(cells[1]);
    if (inputs.length > 0 && outputs.length > 0) recipes.push({ inputs, outputs });
  }
  return recipes;
}

/**
 * The "Tier N Challenge" sections: each `<h3>` heading is followed by a description table (one cell of prose) and an
 * Input/Output recipe table. Any section that is missing or changed shape is skipped (the cards do not depend on it).
 */
function extractChallenges(doc: Document): AscendancyChallenge[] {
  const challenges = new Map<number, AscendancyChallenge>();
  for (const heading of Array.from(doc.querySelectorAll('h3'))) {
    const match = CHALLENGE_HEADING.exec(cleanText(heading.textContent));
    if (!match) continue;
    const tier = parseInt(match[1], 10);
    if (challenges.has(tier)) continue;

    let description: string[] = [];
    const recipes: AscendancyRecipe[] = [];
    for (const table of sectionTables(heading)) {
      const tableRecipes = extractRecipes(table);
      if (tableRecipes) {
        recipes.push(...tableRecipes);
      } else if (description.length === 0) {
        description = extractDescription(table);
      }
    }
    if (description.length === 0 && recipes.length === 0) continue;
    challenges.set(tier, { tier, description, recipes });
  }
  return Array.from(challenges.values()).sort((a, b) => a.tier - b.tier);
}

/** The ascendancy a recipe unlocks: its only output line is "<Name> Ascendancy Stone" */
function unlockedAscendancy(recipe: AscendancyRecipe): string | null {
  if (recipe.outputs.length !== 1) return null;
  const match = /^(.+?)\s+Ascendancy\s+Stone$/i.exec(recipe.outputs[0]);
  return match ? match[1].toLowerCase() : null;
}

/** Ascendancy name (lower case) → the inputs of the recipe that makes its stone (first recipe wins) */
function unlockInputsByName(challenges: readonly AscendancyChallenge[]): Map<string, readonly string[]> {
  const byName = new Map<string, readonly string[]>();
  for (const recipe of challenges.flatMap((challenge) => challenge.recipes)) {
    const name = unlockedAscendancy(recipe);
    if (name !== null && !byName.has(name)) byName.set(name, recipe.inputs);
  }
  return byName;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export interface ParsedAscendanciesPage {
  readonly ascendancies: Ascendancy[];
  /** Empty when the page has no recognisable challenge section */
  readonly challenges: AscendancyChallenge[];
}

/**
 * Parses the ascendancy cards and footnotes of a parsed page.
 */
function extractAscendancies(doc: Document, unlockInputs: ReadonlyMap<string, readonly string[]>): Ascendancy[] {
  // Find all top-level flex containers (one per ascendancy)
  const flexDivs = Array.from(doc.querySelectorAll('div[style*="justify-content: space-around"]'));

  if (flexDivs.length === 0) return [];

  // Walk through the document to associate footnotes with ascendancies.
  // Footnotes are <font size="-2"> elements that appear after each flex div.
  // Build a map: flexDiv index → footnote strings
  const footnoteMap = new Map<number, string[]>();

  // For each flex div, find footnote siblings that follow it
  for (let i = 0; i < flexDivs.length; i++) {
    const footnotes: string[] = [];
    let sibling = flexDivs[i].nextSibling;

    // Walk siblings until we hit the next flex div (or another div) or run out
    while (sibling) {
      if (sibling instanceof Element) {
        // Stop if we hit another div (probably the next ascendancy container or a separator)
        if (sibling.tagName === 'DIV') break;

        // Check if it's a footnote: <font size="-2">
        if (sibling.tagName === 'FONT' && sibling.getAttribute('size') === '-2') {
          const text = sibling.textContent.replace(/\s+/g, ' ').trim();
          if (text.length > 0) {
            footnotes.push(text);
          }
        }
      }
      sibling = sibling.nextSibling;
    }

    footnoteMap.set(i, footnotes);
  }

  const ascendancies: Ascendancy[] = [];

  for (let i = 0; i < flexDivs.length; i++) {
    const divs = identifyDivs(flexDivs[i]);
    if (!divs) continue;

    const name = extractName(divs.imageDiv);
    if (!name) continue;

    const imageUrl = extractImageUrl(divs.imageDiv);
    const tiers = extractTiers(divs.textDiv);
    const footnotes = footnoteMap.get(i) ?? [];

    ascendancies.push({ name, imageUrl, tiers, footnotes, unlockInputs: unlockInputs.get(name.toLowerCase()) ?? [] });
  }

  return ascendancies;
}

/**
 * Parses ascendancies.htm: the ascendancy cards (with each one's unlock recipe from the Tier 1 Challenge table) and the
 * Tier 1–5 challenges.
 */
export function parseAscendanciesPage(html: string): ParsedAscendanciesPage {
  if (!html) return { ascendancies: [], challenges: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let challenges: AscendancyChallenge[] = [];
  try {
    challenges = extractChallenges(doc);
  } catch (error) {
    // The challenges are an extra: a page whose challenge section breaks the parser still yields the cards
    console.warn('[HTML] Could not parse the ascendancy challenges:', error);
  }
  return { ascendancies: extractAscendancies(doc, unlockInputsByName(challenges)), challenges };
}

/**
 * Parses the ascendancies.htm HTML and returns an array of Ascendancy objects.
 */
export function parseAscendancies(html: string): Ascendancy[] {
  return parseAscendanciesPage(html).ascendancies;
}

import type { Ascendancy, AscendancyTier } from '@/core/db';
import { stripHtmlTags } from '@/lib/html';
import { decodeHtmlEntities, mergeWrappedLines } from './shared/parserUtils';

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

/**
 * Parses the ascendancies.htm HTML and returns an array of Ascendancy objects.
 */
export function parseAscendancies(html: string): Ascendancy[] {
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

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

    ascendancies.push({ name, imageUrl, tiers, footnotes });
  }

  return ascendancies;
}

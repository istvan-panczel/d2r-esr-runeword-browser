import type { Ascendancy, AscendancyChallenge, AscendancySection, AscendancyTier } from '@/core/db';
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

/** A heading that looks like a challenge but is not a readable one ("Tier X Challenge"): never an extra section */
const CHALLENGE_LIKE_HEADING = /\bchallenge\b/i;

/** Elements that end a challenge section: the next heading */
const SECTION_END_TAGS: ReadonlySet<string> = new Set(['H1', 'H2', 'H3']);

/** The first table between a heading and the next heading (also inside a wrapper element without a heading) */
function sectionTable(heading: Element): Element | null {
  for (let el = heading.nextElementSibling; el && !SECTION_END_TAGS.has(el.tagName); el = el.nextElementSibling) {
    if (el.tagName === 'TABLE') return el;
    if (el.querySelector('h1, h2, h3')) return null;
    const table = el.querySelector('table');
    if (table) return table;
  }
  return null;
}

/** Paragraphs of a description table: one per <br>-separated line, hard-wrapped lines re-joined */
function extractDescription(table: Element): string[] {
  const cell = table.querySelector('td');
  if (!cell) return [];
  return mergeWrappedLines(extractCellLines(cell).map((line) => line.text));
}

/** The paragraphs of the description table under a heading; empty when there is none */
function headingDescription(heading: Element): string[] {
  const table = sectionTable(heading);
  return table ? extractDescription(table) : [];
}

interface ParsedSections {
  readonly challenges: AscendancyChallenge[];
  readonly sections: AscendancySection[];
}

/**
 * The `<h3>` sections with a one-cell description table: "Tier N Challenge" ones become challenges, any other one (the
 * "Lich King Bonus", ESR 3.3.04) an extra section in page order. A heading with nothing readable under it is skipped,
 * as is the cards' "Ascendancies" heading (no table follows it). Since ESR 3.3.04 the page has no recipe tables; an
 * older page's Input/Output tables after the description are ignored.
 */
function extractSections(doc: Document): ParsedSections {
  const challenges = new Map<number, AscendancyChallenge>();
  const sections = new Map<string, AscendancySection>();
  for (const heading of Array.from(doc.querySelectorAll('h3'))) {
    const title = cleanText(heading.textContent);
    const match = CHALLENGE_HEADING.exec(title);
    if (match) {
      const tier = parseInt(match[1], 10);
      if (challenges.has(tier)) continue;
      const description = headingDescription(heading);
      if (description.length > 0) challenges.set(tier, { tier, description });
    } else if (title.length > 0 && !CHALLENGE_LIKE_HEADING.test(title) && !sections.has(title)) {
      const description = headingDescription(heading);
      if (description.length > 0) sections.set(title, { title, order: sections.size, description });
    }
  }
  return {
    challenges: Array.from(challenges.values()).sort((a, b) => a.tier - b.tier),
    sections: Array.from(sections.values()),
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export interface ParsedAscendanciesPage {
  readonly ascendancies: Ascendancy[];
  /** Empty when the page has no recognisable challenge section */
  readonly challenges: AscendancyChallenge[];
  /** The other sections of the challenge part (the Lich King Bonus); empty when there are none */
  readonly sections: AscendancySection[];
}

/**
 * Parses the ascendancy cards and footnotes of a parsed page.
 */
function extractAscendancies(doc: Document): Ascendancy[] {
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

/**
 * Parses ascendancies.htm: the ascendancy cards, the Tier 1–5 challenges and the other sections of the challenge part
 * (the Lich King Bonus).
 */
export function parseAscendanciesPage(html: string): ParsedAscendanciesPage {
  if (!html) return { ascendancies: [], challenges: [], sections: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let parsed: ParsedSections = { challenges: [], sections: [] };
  try {
    parsed = extractSections(doc);
  } catch (error) {
    // The challenges are an extra: a page whose challenge section breaks the parser still yields the cards
    console.warn('[HTML] Could not parse the ascendancy challenges:', error);
  }
  return { ascendancies: extractAscendancies(doc), ...parsed };
}

/**
 * Parses the ascendancies.htm HTML and returns an array of Ascendancy objects.
 */
export function parseAscendancies(html: string): Ascendancy[] {
  return parseAscendanciesPage(html).ascendancies;
}

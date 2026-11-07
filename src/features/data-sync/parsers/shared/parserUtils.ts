import type { Affix, BonusPool, SocketableBonusGroup, SocketableBonusGroupType, SocketableBonuses } from '@/core/db';

/** The entity decoder lives in `@/lib/html` (shared with the Node scripts); re-exported for the parsers. */
export { decodeHtmlEntities } from '@/lib/html';

export interface NormalizedRuneName {
  name: string;
  points?: number;
}

/**
 * Normalizes a rune name by stripping "(X points)" suffix if present.
 * Returns the clean name and extracted points value.
 *
 * Examples:
 *   "I Rune (1 points)" -> { name: "I Rune", points: 1 }
 *   "I Rune"            -> { name: "I Rune", points: undefined }
 *   "Ru Rune"           -> { name: "Ru Rune", points: undefined }
 */
export function normalizeRuneName(rawName: string): NormalizedRuneName {
  const match = /^(.+?)\s*\((\d+)\s*points?\)$/i.exec(rawName.trim());
  if (match) {
    return { name: match[1].trim(), points: parseInt(match[2], 10) };
  }
  return { name: rawName.trim(), points: undefined };
}

/**
 * Extracts required level from text containing "Req Lvl: N"
 */
export function parseReqLevel(text: string): number {
  const match = /Req Lvl:\s*(\d+)/i.exec(text);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extracts numeric value from affix text.
 * Handles ranges (e.g., "10-20") and single numbers.
 */
export function extractValue(text: string): number | readonly [number, number] | null {
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

/**
 * Detects the value type of an affix based on its text.
 */
export function detectValueType(text: string): 'flat' | 'percent' | 'range' | 'none' {
  if (/\d+-\d+/.test(text)) return 'range';
  if (/%/.test(text)) return 'percent';
  if (/[+-]?\d+/.test(text)) return 'flat';
  return 'none';
}

/**
 * Parses affixes from a table cell's innerHTML.
 * Splits the cell into visual lines (on <br> tags), re-joins hard-wrapped lines
 * (see {@link mergeWrappedCellLines}) and creates Affix objects.
 */
export function parseAffixes(cell: Element): Affix[] {
  return mergeWrappedCellLines(extractCellLines(cell))
    .map((line) => line.text)
    .filter((text) => text.length > 0)
    .map(toAffix);
}

function toAffix(rawText: string): Affix {
  return {
    rawText,
    pattern: rawText.replace(/[+-]?\d+/g, '#'),
    value: extractValue(rawText),
    valueType: detectValueType(rawText),
  };
}

/**
 * Parses the three bonus categories from a header row.
 * Bonuses are in the row after the column headers row.
 */
export function parseBonuses(headerRow: Element): SocketableBonuses {
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

/**
 * Checks if a header cell has a colored inner FONT tag.
 * Structure: <font...><b><FONT COLOR="...">Name</FONT></b></font>
 */
export function hasColoredInnerFont(headerCell: Element): boolean {
  const innerFont = headerCell.querySelector('b font[color], b FONT[color]');
  return innerFont !== null;
}

/**
 * Gets the color attribute from the inner FONT tag.
 * Returns null if no colored inner font exists.
 */
export function getInnerFontColor(headerCell: Element): string | null {
  const innerFont = headerCell.querySelector('b font[color], b FONT[color]');
  return innerFont?.getAttribute('color')?.toUpperCase() ?? null;
}

/**
 * Gets the item name from a header cell.
 * Handles both colored inner fonts and plain text in <b> tags.
 */
export function getItemName(headerCell: Element): string {
  // Try colored inner font first
  const innerFont = headerCell.querySelector('b font[color], b FONT[color]');
  if (innerFont?.textContent) {
    return innerFont.textContent.trim();
  }

  // Fall back to <b> tag text content
  const bTag = headerCell.querySelector('b');
  if (bTag?.textContent) {
    return bTag.textContent.trim();
  }

  return '';
}

/**
 * Normalizes whitespace in text by collapsing multiple spaces/newlines to single space.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parses affixes from a recipe (runeword/gemword) bonus cell, extracting ONLY
 * the recipe's own bonuses (before the <br><br> separator).
 *
 * Recipe cells contain: [recipe bonuses]<br><br>[ingredient bonuses]
 * (rune bonuses for runewords, gem bonuses for gemwords).
 * We only want the recipe bonuses. Hard-wrapped lines are re-joined
 * (see {@link mergeWrappedCellLines}).
 */
export function parseRecipeAffixes(cell: Element): Affix[] {
  const [recipeLines = []] = splitCellLineGroups(extractCellLines(cell));

  return mergeWrappedCellLines(recipeLines)
    .map((line) => line.text)
    .filter((text) => text.length > 0)
    .map(toAffix);
}

/** Header line that starts a random bonus pool, e.g. "1-2 of the following:". */
const BONUS_POOL_HEADER = /\bof the following:?$/i;

/** The non-empty <br><br> groups of a cell, hard-wrapped lines re-joined. */
function cellTextGroups(cell: Element): string[][] {
  return splitCellLineGroups(extractCellLines(cell))
    .map((group) =>
      mergeWrappedCellLines(group)
        .map((line) => line.text)
        .filter((text) => text.length > 0)
    )
    .filter((group) => group.length > 0);
}

const isPoolGroup = (group: readonly string[]): boolean => group.length > 0 && BONUS_POOL_HEADER.test(group[0]);

const toPool = ([label, ...lines]: readonly string[]): BonusPool => ({ label, affixes: lines.map(toAffix) });

/**
 * Parses the random bonus pools of a pre-ESR 3.3 recipe bonus cell (gemwords since ESR 3.2).
 *
 * Such cells contain: [recipe bonuses]<br><br>[pool]<br><br>...[pool]<br><br>[ingredient bonuses],
 * where each pool starts with an "N-M of the following:" header line. A pool is any group between
 * the first (recipe bonuses) and last (ingredient bonuses) non-empty groups whose first line is
 * such a header. Cells without pools return []. The ESR 3.3 "Bonuses" cell has no ingredient
 * group: see {@link parseRecipeBonusesCell}.
 */
export function parseRecipeBonusPools(cell: Element): BonusPool[] {
  return cellTextGroups(cell).slice(1, -1).filter(isPoolGroup).map(toPool);
}

export interface RecipeBonusesCell {
  readonly affixes: Affix[];
  readonly pools: BonusPool[];
}

/**
 * Parses the ESR 3.3+ "Bonuses" cell of a runewords.htm / gemwords.htm row: only the recipe's own bonuses (the rune /
 * gem bonuses moved to the "Socketable Bonuses" cell), so no group is dropped. Groups starting with an
 * "N-M of the following:" header are random bonus pools (gemwords); every other group is the recipe's own bonuses,
 * e.g. Able's "+500% Enhanced Defense ...<br><br>Requirements -100%".
 */
export function parseRecipeBonusesCell(cell: Element): RecipeBonusesCell {
  const groups = cellTextGroups(cell);
  return {
    affixes: groups.filter((group) => !isPoolGroup(group)).flatMap((group) => group.map(toAffix)),
    pools: groups.filter(isPoolGroup).map(toPool),
  };
}

/**
 * Splits a socketable bonus group label into its item types, e.g.
 * "Weapon (except Orb, Staff, Wand) / Missile / Mythical Arcane Staff" →
 * Weapon (except Orb, Staff, Wand), Missile (no exceptions), Mythical Arcane Staff (no exceptions).
 * The "/" separators inside the "(except ...)" parentheses (none so far) are not split on.
 */
export function parseSocketableGroupLabel(label: string): SocketableBonusGroupType[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of label) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === '/' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);

  return parts
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = /^(.*?)\s*\(\s*except\s+(.*?)\s*\)$/i.exec(part);
      if (!match) return { name: part, except: [] };
      return {
        name: match[1].trim(),
        except: match[2]
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0),
      };
    });
}

/**
 * Parses the ESR 3.3+ "Socketable Bonuses" cell of a runewords.htm / gemwords.htm row: the combined rune / gem
 * bonuses, either one plain list (one unlabelled group: every allowed base gets it) or one
 * `<div class="rws-group">` per item-type label (`<div class="rws-label">`) followed by its list. Groups without
 * any bonus line are dropped; a cell without any returns [].
 */
export function parseSocketableBonusGroups(cell: Element): SocketableBonusGroup[] {
  const groupElements = Array.from(cell.querySelectorAll('.rws-group'));
  if (groupElements.length === 0) {
    const affixes = parseAffixes(cell);
    return affixes.length > 0 ? [{ label: '', itemTypes: [], affixes }] : [];
  }

  return groupElements.flatMap((groupElement): SocketableBonusGroup[] => {
    const labelElement = groupElement.querySelector('.rws-label');
    const label = normalizeWhitespace(labelElement?.textContent ?? '');
    // The bonus lines are the group's content after its label
    const content = groupElement.cloneNode(true) as Element;
    content.querySelector('.rws-label')?.remove();
    const affixes = parseAffixes(content);
    if (affixes.length === 0) return [];
    return [{ label, itemTypes: parseSocketableGroupLabel(label), affixes }];
  });
}

/**
 * One visual line of a table cell (text between two <br> elements).
 */
export interface CellLine {
  /** Whitespace-normalised text of the line ('' for an empty line). */
  readonly text: string;
  /** True when the line's text sits inside a <font color="orange"> element. */
  readonly orange: boolean;
}

function isOrangeFont(node: Node): boolean {
  return node instanceof Element && node.tagName === 'FONT' && node.getAttribute('color')?.trim().toLowerCase() === 'orange';
}

function hasOrangeAncestor(node: Node, root: Node): boolean {
  for (let current = node.parentNode; current && current !== root; current = current.parentNode) {
    if (isOrangeFont(current)) return true;
  }
  return isOrangeFont(root);
}

/**
 * Splits an element into its visual lines by walking the DOM: text nodes are
 * accumulated until a <br> element ends the line. Unlike splitting innerHTML on
 * <br>, this keeps track of which lines are inside a <font color="orange">
 * element even when the font spans several <br>-separated lines.
 *
 * Empty lines are kept (as text '') so callers can detect <br><br> group
 * separators — see {@link splitCellLineGroups}. A line counts as orange when any
 * of its non-whitespace text is inside an orange font (attribute value is
 * matched case-insensitively, quoted or not).
 */
export function extractCellLines(root: Node): CellLine[] {
  const lines: CellLine[] = [];
  let text = '';
  let orange = false;

  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = child.textContent ?? '';
        text += value;
        if (value.trim().length > 0 && hasOrangeAncestor(child, root)) orange = true;
      } else if (child instanceof Element) {
        if (child.tagName === 'BR') {
          lines.push({ text: normalizeWhitespace(text), orange });
          text = '';
          orange = false;
        } else {
          walk(child);
        }
      }
    }
  };

  walk(root);
  lines.push({ text: normalizeWhitespace(text), orange });
  return lines;
}

/**
 * Splits visual lines into groups separated by <br><br> (an empty line between
 * two <br> elements). A leading empty line (cell starting with a single <br>) is
 * not a separator. Separator lines are dropped; a leading or trailing empty line
 * stays in its group (callers filter empty text anyway).
 */
export function splitCellLineGroups(lines: readonly CellLine[]): CellLine[][] {
  const groups: CellLine[][] = [[]];
  lines.forEach((line, index) => {
    const isSeparator = line.text.length === 0 && index > 0 && index < lines.length - 1;
    if (isSeparator) {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(line);
    }
  });
  return groups;
}

/**
 * Lowercase function words that, when they end a line, mean the sentence continues on
 * the next line: conjunctions, prepositions and articles/determiners. Deliberately NOT
 * extended with verbs or other content words: a few upstream wraps after a verb
 * ("...attacks deal⏎10 additional damage") stay split rather than growing a tuned list.
 * Matched case-sensitively so Title Case affix endings ("+1 To All") never trigger it.
 */
const CONTINUATION_WORDS: ReadonlySet<string> = new Set([
  // conjunctions / subordinators
  'and',
  'or',
  'but',
  'when',
  'while',
  'if',
  'than',
  'that',
  'as',
  // prepositions
  'with',
  'per',
  'to',
  'of',
  'for',
  'from',
  'by',
  'in',
  'on',
  'at',
  'into',
  'during',
  'after',
  'before',
  'until',
  'against',
  'upon',
  'over',
  'under',
  'within',
  'without',
  // articles / determiners (not 'you': it often ends a complete line, e.g. "...and return to you")
  'the',
  'a',
  'an',
  'your',
  'all',
  'each',
  'every',
  'no',
  'not',
]);

/**
 * Decides whether `next` is a hard-wrapped continuation of `previous`.
 *
 * The ESR pages hard-wrap long (usually orange) affixes with <br> mid-sentence.
 * A line continues the previous one when:
 * - it starts with a lowercase letter, or
 * - the previous line ends with a comma, or
 * - the previous line ends with a lowercase function word (and, or, per, for, ...).
 *
 * A line ending in a full stop followed by a capitalised line is never merged, so two
 * separate sentences stay separate.
 */
export function isWrappedContinuation(previous: string, next: string): boolean {
  if (previous.length === 0 || next.length === 0) return false;
  if (/^[a-z]/.test(next)) return true;
  if (previous.endsWith(',')) return true;
  const lastWord = /(?:^|[^A-Za-z'])([a-z]+)$/.exec(previous)?.[1];
  return lastWord !== undefined && CONTINUATION_WORDS.has(lastWord);
}

/**
 * Re-joins hard-wrapped visual lines (see {@link isWrappedContinuation}).
 * Lines are only merged when both have the same colour (orange vs non-orange),
 * and never across an empty line (<br><br> group separator). Merged text is
 * joined with a single space. Empty lines are preserved in the output.
 */
export function mergeWrappedCellLines(lines: readonly CellLine[]): CellLine[] {
  const merged: CellLine[] = [];
  for (const line of lines) {
    const previous = merged.at(-1);
    if (previous && previous.orange === line.orange && isWrappedContinuation(previous.text, line.text)) {
      merged[merged.length - 1] = { text: normalizeWhitespace(`${previous.text} ${line.text}`), orange: previous.orange };
    } else {
      merged.push(line);
    }
  }
  return merged;
}

/**
 * Plain-text variant of {@link mergeWrappedCellLines} for lines without colour
 * information. Empty strings act as group separators and are dropped from the result.
 */
export function mergeWrappedLines(lines: readonly string[]): string[] {
  return mergeWrappedCellLines(lines.map((text) => ({ text: normalizeWhitespace(text), orange: false })))
    .map((line) => line.text)
    .filter((text) => text.length > 0);
}

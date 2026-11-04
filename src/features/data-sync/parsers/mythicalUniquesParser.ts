import type { MythicalUnique } from '@/core/db';
import { decodeHtmlEntities, extractCellLines, mergeWrappedCellLines } from './shared/parserUtils';
import { stripHtmlTags } from '@/lib/html';

/**
 * Parses Mythical Unique items from the ESR unique_mythicals.htm page.
 *
 * HTML structure:
 * - Each category: <td colspan="4" bgcolor="#402040"><b>CategoryName</b></td>
 * - Column headers row: Name | Stats | Properties | Notes
 * - Data rows (4 cells): name cell | stats cell | properties cell | notes cell
 *
 * Key differences from htmUniqueItemsParser:
 * - 4 columns instead of 3 (Notes column)
 * - Properties contain orange-highlighted special properties (<FONT COLOR="ORANGE">)
 * - Name cell contains images and base item links (no item codes)
 * - Single page with 4 categories (not 3 separate pages)
 */
export function parseMythicalUniques(html: string): MythicalUnique[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const items: MythicalUnique[] = [];

  // Find all category header cells: td with colspan="4" and bgcolor="#402040"
  const headerCells = doc.querySelectorAll('td[colspan="4"][bgcolor="#402040"]');

  for (const headerCell of headerCells) {
    const bTag = headerCell.querySelector('b');
    if (!bTag) continue;
    const categoryName = bTag.textContent.trim();
    if (!categoryName) continue;

    // Skip column header rows (Name, Stats, Properties, Notes)
    if (['Name', 'Stats', 'Properties', 'Notes'].includes(categoryName)) continue;

    // Navigate up to the table containing this category
    const table = headerCell.closest('table');
    if (!table) continue;

    // Get all rows in the table, skip first 2 (category header + column headers)
    const rows = table.querySelectorAll('tr');

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) continue;

      const nameCell = cells[0];
      const statsCell = cells[1];
      const propsCell = cells[2];
      const notesCell = cells[3];

      // Parse name cell
      const { name, baseItem, baseItemLink, imageUrl } = parseNameCell(nameCell);
      if (!name) continue;

      // Parse stats cell
      const { itemLevel, reqLevel } = parseStatsCell(statsCell);

      // Parse properties cell (separates orange special properties from regular ones)
      const { properties, specialProperties } = parsePropertiesCell(propsCell);

      // Parse notes cell
      const notes = parseNotesCell(notesCell);

      items.push({
        name,
        baseItem,
        baseItemLink,
        category: categoryName,
        itemLevel,
        reqLevel,
        properties,
        specialProperties,
        notes,
        imageUrl,
      });
    }
  }

  return items;
}

interface ParsedNameCell {
  name: string;
  baseItem: string;
  baseItemLink: string;
  imageUrl: string;
}

function parseNameCell(cell: Element): ParsedNameCell {
  const result: ParsedNameCell = {
    name: '',
    baseItem: '',
    baseItemLink: '',
    imageUrl: '',
  };

  // Item name is inside <b> tag — may have a leading <br> before the name
  const bTag = cell.querySelector('b');
  if (!bTag) return result;

  const bHtml = bTag.innerHTML;
  const parts = bHtml.split(/<br\s*\/?>/i);

  // Find the first non-empty part as the item name (skip leading empty segments from <br>)
  for (const part of parts) {
    const cleaned = stripHtmlTags(part).replace(/\s+/g, ' ').trim();
    if (cleaned.length > 0) {
      result.name = cleaned;
      break;
    }
  }

  // Base item: look for <a> tag first, then styled font
  const anchor = bTag.querySelector('a');
  if (anchor) {
    result.baseItem = anchor.textContent.replace(/\s+/g, ' ').trim();
    result.baseItemLink = anchor.getAttribute('href') ?? '';
  } else {
    // Dedicated Drops items use styled <font> instead of <a>
    const styledFont = bTag.querySelector('font[style]');
    if (styledFont) {
      result.baseItem = styledFont.textContent.replace(/\s+/g, ' ').trim();
    } else if (parts.length > 1) {
      // Fallback: extract from second part, strip HTML
      result.baseItem = stripHtmlTags(parts.slice(1).join(' ')).replace(/\s+/g, ' ').trim();
    }
  }

  // Image URL from <img> tag (can be inside or outside <b>)
  const img = cell.querySelector('img');
  if (img) {
    result.imageUrl = img.getAttribute('src') ?? '';
  }

  return result;
}

interface ParsedStatsCell {
  itemLevel: number;
  reqLevel: number;
}

function parseStatsCell(cell: Element): ParsedStatsCell {
  const text = cell.textContent;

  const itemLevelMatch = /Item Level:\s*(\d+)/i.exec(text);
  const reqLevelMatch = /Required Level:\s*(\d+)/i.exec(text);

  return {
    itemLevel: itemLevelMatch ? parseInt(itemLevelMatch[1], 10) : 0,
    reqLevel: reqLevelMatch ? parseInt(reqLevelMatch[1], 10) : 0,
  };
}

interface ParsedProperties {
  properties: string[];
  specialProperties: string[];
}

/**
 * Splits the properties cell into regular and special (orange) properties.
 *
 * The orange state is tracked per visual line by walking the DOM, because a single
 * <FONT COLOR="ORANGE"> element usually spans several <br>-separated lines (and may even
 * start with a <br>). Hard-wrapped lines are re-joined within each colour run.
 */
function parsePropertiesCell(cell: Element): ParsedProperties {
  const properties: string[] = [];
  const specialProperties: string[] = [];

  for (const line of mergeWrappedCellLines(extractCellLines(cell))) {
    if (line.text.length === 0) continue;
    if (line.orange) {
      specialProperties.push(line.text);
    } else {
      properties.push(line.text);
    }
  }

  return { properties, specialProperties };
}

function parseNotesCell(cell: Element): string[] {
  const html = cell.innerHTML;
  if (!html.trim()) return [];

  return html
    .split(/<br\s*\/?>/i)
    .map((line) => stripHtmlTags(line))
    .map((line) => decodeHtmlEntities(line))
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

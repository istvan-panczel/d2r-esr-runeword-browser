/**
 * ESR's official Weapon Mastery page (docs/weapon_mastery.html in the clone) → the page's side of masteries.json
 * `pageRules`, `pageDiffs` and `pageNotes`.
 *
 * The page has an intro (drop odds and rules in prose), a General Recipes table and a Specializations table: one row
 * per specialisation, with the weapon and ingredients on the left and, on the right, the skills lines (orange) with
 * their effect lines and sometimes a grey "*…" footnote. The generator compares the rows with the game files (the
 * files win); from the page itself it only keeps the drop odds and the footnotes.
 */
import { cellParagraphs, tableRows } from './skillInfoPage.ts';

/** Path of the page inside the ESR clone */
export const MASTERY_PAGE_FILE = 'docs/weapon_mastery.html';

export interface MasteryPageEffect {
  heading: string;
  lines: string[];
}

export interface MasteryPageRow {
  /** The weapon as the page names it ("Stag Bow Variant", "Sorceress Orb") */
  weapon: string;
  /** Ingredient names after the awakened token */
  ingredients: string[];
  effects: MasteryPageEffect[];
  /** Footnotes without their "*" ("this damage bonus does not apply for discharge procs") */
  notes: string[];
}

export interface MasteryPage {
  /** "endgame map bosses (25% chance, not scaled by /players)" */
  mapBossChance?: number;
  /** "weapon mastery token (up to 75%, not scaled by /players)" */
  zakarumChance?: number;
  rows: MasteryPageRow[];
  warnings: string[];
}

const SPECIALIZATIONS_ANCHOR = '<a name="specializations">';
const FOOTNOTE = /<font\b[^>]*color="gray"[^>]*>\s*\*([\s\S]*?)<\/font>/gi;
const HEADING = /<font\b[^>]*color="orange"[^>]*>([\s\S]*?)<\/font>/i;

const textOf = (html: string) => cellParagraphs(html).join(' ');

function readEffects(cell: string): { effects: MasteryPageEffect[]; notes: string[] } {
  const notes = [...cell.matchAll(FOOTNOTE)].map((match) => textOf(match[1]));
  const effects: MasteryPageEffect[] = [];
  for (const piece of cell.replace(FOOTNOTE, '').split(/<br\s*\/?>/i)) {
    const heading = HEADING.exec(piece);
    if (heading !== null) {
      effects.push({ heading: textOf(heading[1]), lines: [] });
      continue;
    }
    const line = textOf(piece).replace(/\*$/, '').trim();
    if (line !== '') effects.at(-1)?.lines.push(line);
  }
  return { effects, notes };
}

export function parseMasteryPage(html: string): MasteryPage {
  const warnings: string[] = [];
  const start = html.indexOf(SPECIALIZATIONS_ANCHOR);
  if (start === -1) warnings.push(`${MASTERY_PAGE_FILE}: no specializations table found`);
  const intro = textOf(start === -1 ? html : html.slice(0, start));
  const chance = (pattern: RegExp, what: string) => {
    const match = pattern.exec(intro);
    if (match === null) warnings.push(`${MASTERY_PAGE_FILE}: no ${what} sentence found`);
    return match === null ? undefined : Number(match[1]);
  };
  const mapBossChance = chance(/map bosses \((\d+)% chance, not scaled by \/players\)/i, 'map boss drop chance');
  const zakarumChance = chance(/\(up to (\d+)%,? not scaled by \/players\)/i, 'Corrupted Zakarum drop chance');
  const rows =
    start === -1
      ? []
      : tableRows(html.slice(start)).flatMap((cells): MasteryPageRow[] => {
          if (cells.length !== 2) return [];
          const [weapon = '', ...rest] = cellParagraphs(cells[0]);
          return [
            {
              weapon,
              ingredients: rest.filter((line) => !/weapon mastery token/i.test(line)),
              ...readEffects(cells[1]),
            },
          ];
        });
  return {
    ...(mapBossChance === undefined ? {} : { mapBossChance }),
    ...(zakarumChance === undefined ? {} : { zakarumChance }),
    rows,
    warnings,
  };
}

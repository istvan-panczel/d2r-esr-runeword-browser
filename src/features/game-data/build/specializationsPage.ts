/**
 * ESR's official Specializations page (docs/specializations.htm in the clone, the same file as
 * https://easternsunresurrected.com/specializations.htm) → the page's side of specializations.json `pageDiffs`.
 *
 * The page has an intro (how to unlock, the four trees with a one-line summary each, the respec rule) and a copy of
 * the in-game window: one tab label per tree (`spw-tab`), one page per tab (`spw-page<n>`) holding a perk per
 * `spw-perk` block with its tooltip (`spw-tip-title`, `spw-tip-text`, `spw-tip-hint`). The generator only compares
 * these with the game files (the files win); nothing from the page is shown except the tree summaries.
 */
import { cellParagraphs } from './skillInfoPage.ts';

/** Path of the page inside the ESR clone */
export const SPECIALIZATIONS_PAGE_FILE = 'docs/specializations.htm';

export interface SpecializationsPagePerk {
  title: string;
  text: string;
  /** The grey unlearn line ("Shift + Click to Unlearn. Costs 5 Respec Points.") */
  hint: string;
}

export interface SpecializationsPageTree {
  name: string;
  perks: SpecializationsPagePerk[];
}

/** The numbers and summaries the intro states; a field is undefined when its sentence is missing or reads differently */
export interface SpecializationsPageIntro {
  /** "Transmute 10 Mystical Shards" */
  shards?: number;
  /** "levels 45, 60, 75 and 90" */
  pointLevels?: number[];
  /** "you get 3 points if you use it at level 63" */
  example?: { points: number; level: number };
  /** "Each specialization has 15 perks, 3 perks per row" */
  perksPerTree?: number;
  perksPerRow?: number;
  /** "You can have a maximum of 5 points" */
  maxPoints?: number;
  /** "This requires 5 respec points (equivalent to 20 dragon stones)" */
  respecPoints?: number;
  respecDragonStones?: number;
  /** "Alchemist - Specialized in potions." → name → "Specialized in potions." */
  summaries: Map<string, string>;
}

export interface SpecializationsPage {
  intro: SpecializationsPageIntro;
  trees: SpecializationsPageTree[];
  /** Problems with the page itself (no tabs, a tab without a page) */
  warnings: string[];
}

const text = (html: string) => cellParagraphs(html).join(' ');
const numbers = (list: string) => [...list.matchAll(/\d+/g)].map((match) => Number(match[0]));

/** The intro: the paragraph lines before the window markup */
function readIntro(html: string): SpecializationsPageIntro {
  const start = html.search(/Mystical Shards/i);
  const end = html.search(/class="spw-wrap"/);
  const lines = start === -1 ? [] : cellParagraphs(html.slice(start, end === -1 ? undefined : end));
  const all = lines.join('\n');
  const intro: SpecializationsPageIntro = { summaries: new Map() };
  const shards = /Transmute (\d+) Mystical Shards/i.exec(all);
  if (shards !== null) intro.shards = Number(shards[1]);
  const levels = /at levels ([\d, and]+\d)/i.exec(all);
  if (levels !== null) intro.pointLevels = numbers(levels[1]);
  const example = /get (\d+) points if you use it at level (\d+)/i.exec(all);
  if (example !== null) intro.example = { points: Number(example[1]), level: Number(example[2]) };
  const perks = /has (\d+) perks, (\d+) perks per row/i.exec(all);
  if (perks !== null) {
    intro.perksPerTree = Number(perks[1]);
    intro.perksPerRow = Number(perks[2]);
  }
  const max = /maximum of (\d+) points/i.exec(all);
  if (max !== null) intro.maxPoints = Number(max[1]);
  const respec = /requires (\d+) respec points(?: \(equivalent to (\d+) dragon stones\))?/i.exec(all);
  if (respec !== null) {
    intro.respecPoints = Number(respec[1]);
    const stones = respec.at(2);
    if (stones !== undefined) intro.respecDragonStones = Number(stones);
  }
  for (const line of lines) {
    const summary = /^([A-Z][A-Za-z]+) - (Specialized .+)$/.exec(line);
    if (summary !== null) intro.summaries.set(summary[1], summary[2]);
  }
  return intro;
}

/** Splits a page's HTML at each `spw-perk` block and reads its tooltip */
function readPerks(pageHtml: string): SpecializationsPagePerk[] {
  return pageHtml
    .split(/<div class="spw-perk"/)
    .slice(1)
    .map((block) => ({
      title: text(/<div class="spw-tip-title">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ''),
      text: text(/<div class="spw-tip-text">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ''),
      hint: text(/<div class="spw-tip-hint">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ''),
    }));
}

export function parseSpecializationsPage(html: string): SpecializationsPage {
  const warnings: string[] = [];
  const tabs = [...html.matchAll(/<label for="spw-tab(\d+)"[^>]*>([\s\S]*?)<\/label>/g)].map((match) => ({
    index: Number(match[1]),
    name: text(match[2]),
  }));
  if (tabs.length === 0) warnings.push(`${SPECIALIZATIONS_PAGE_FILE}: no tree tabs (spw-tab) found`);
  // Each page runs to the next page's start (the perk blocks are nested divs, so no closing tag is matched)
  const starts = [...html.matchAll(/<div class="spw-page spw-page(\d+)">/g)].map((match) => ({ index: Number(match[1]), at: match.index }));
  const trees = tabs.map((tab) => {
    const at = starts.findIndex((start) => start.index === tab.index);
    if (at === -1) {
      warnings.push(`${SPECIALIZATIONS_PAGE_FILE}: tab ${tab.name} has no page (spw-page${String(tab.index)})`);
      return { name: tab.name, perks: [] };
    }
    return { name: tab.name, perks: readPerks(html.slice(starts[at].at, starts[at + 1]?.at)) };
  });
  return { intro: readIntro(html), trees, warnings };
}

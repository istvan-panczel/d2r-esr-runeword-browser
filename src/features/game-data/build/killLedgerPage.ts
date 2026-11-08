/**
 * ESR's official Kill Ledger page (docs/kill_ledger.htm in the clone, the same file as
 * https://easternsunresurrected.com/kill_ledger.htm) → the page's side of killledger.json `pageDiffs`.
 *
 * The page has an intro, then two two-column tables: the kill bonuses (left cell: the ledger, "(At least 500 kills)"
 * and the ingredients; right cell: the ledger and the bonus lines) and the boss bonuses (left cell ending in
 * "<boss> just killed"). The generator only compares these with the game files; nothing from the page is shown.
 */
import { cellParagraphs, tableRows } from './skillInfoPage.ts';

/** Path of the page inside the ESR clone */
export const KILL_LEDGER_PAGE_FILE = 'docs/kill_ledger.htm';

export interface KillLedgerPageRow {
  ingredients: string[];
  bonus: string[];
}

export interface KillLedgerPageTier extends KillLedgerPageRow {
  kills: number;
}

export interface KillLedgerPageBoss extends KillLedgerPageRow {
  name: string;
}

export interface KillLedgerPage {
  /** "You have 60 seconds to transmute"; undefined when the sentence is missing */
  windowSeconds?: number;
  tiers: KillLedgerPageTier[];
  bosses: KillLedgerPageBoss[];
  /** Problems with the page itself (no rows, a row of neither kind) */
  warnings: string[];
}

const LEDGER_LINE = /^kill ledger$/i;
const KILLS_LINE = /^\(At least ([\d.,]+) kills\)$/i;
const BOSS_LINE = /^(.+?) just killed$/i;

export function parseKillLedgerPage(html: string): KillLedgerPage {
  const warnings: string[] = [];
  const tiers: KillLedgerPageTier[] = [];
  const bosses: KillLedgerPageBoss[] = [];
  for (const [left = '', right = ''] of tableRows(html)) {
    const lines = cellParagraphs(left).filter((line) => !LEDGER_LINE.test(line));
    const bonus = cellParagraphs(right).filter((line) => !LEDGER_LINE.test(line));
    const killsLine = lines.find((line) => KILLS_LINE.test(line));
    const bossLine = BOSS_LINE.exec(lines.at(-1) ?? '');
    if (killsLine !== undefined) {
      const ingredients = lines.filter((line) => !KILLS_LINE.test(line));
      tiers.push({ kills: Number(killsLine.replace(/\D/g, '')), ingredients, bonus });
    } else if (bossLine !== null) {
      bosses.push({ name: bossLine[1], ingredients: lines.slice(0, -1), bonus });
    } else {
      warnings.push(`${KILL_LEDGER_PAGE_FILE}: row "${lines.join(' / ')}" is neither a kill nor a boss bonus`);
    }
  }
  if (tiers.length === 0) warnings.push(`${KILL_LEDGER_PAGE_FILE}: no kill bonuses found`);
  if (bosses.length === 0) warnings.push(`${KILL_LEDGER_PAGE_FILE}: no boss bonuses found`);
  const windowMatch = /You have (\d+) seconds to transmute/i.exec(cellParagraphs(html).join(' '));
  return { ...(windowMatch === null ? {} : { windowSeconds: Number(windowMatch[1]) }), tiers, bosses, warnings };
}

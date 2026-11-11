/**
 * Whether a skill's aura / passive stat columns land on the character that has the skill, shared by the charsheet.json
 * builder (which keeps only those columns) and the computed character sheet (src/features/character/engine/sheet/).
 *
 * - A summon skill's stats go to the summon (`summon` column set): never the owner.
 * - `aurafilter` bit 0x8000 (IgnoreAllies in the D2 aurafilter table) makes an aura enemy-only: Conviction on an item
 *   does not lower its wearer's resists. VERIFIED on SpinToWin (2026-11-11 ground truth).
 * - An item aura (`item_aura`) otherwise reaches its wearer (VERIFIED: the Kill Ledger's hidden auras, Fanaticism).
 * - A skill the character casts reaches the character when it is an aura (`aura` = 1) or has no target filter at all
 *   (`aurafilter` 0: warcries, armors, Fade, Burst of Speed, shapes); a filter without the aura flag aims the stats at
 *   others (curses: `aurafilter` 3 / 2). INFERRED from the data; no buffed ground truth exists.
 */
import type { SkillCalcRow } from './schema.ts';

/** D2 aurafilter IgnoreAllies */
export const AURA_FILTER_IGNORE_ALLIES = 0x8000;

const num = (value: string | number | undefined): number => (typeof value === 'number' ? value : 0);

export function affectsOwner(row: SkillCalcRow, use: 'item-aura' | 'cast'): boolean {
  if (row.summon !== undefined && row.summon !== '') return false;
  const filter = num(row.aurafilter);
  if ((filter & AURA_FILTER_IGNORE_ALLIES) !== 0) return false;
  if (use === 'item-aura') return true;
  return num(row.aura) === 1 || filter === 0;
}

/** Text helpers for the formula condition: the insert helper's call text and the rule list's short form. */
import type { StatLayerKind } from '@/features/game-data/engine/statLayers';
import type { FormulaFunction } from '../engine/formula';

/** Longest formula the rule summary shows before "…". */
export const FORMULA_SUMMARY_LENGTH = 40;

/** `formula: (stat('item_fastercastrate')>=10)&&…`, whitespace runs collapsed. */
export function formulaSummary(formula: string): string {
  const flat = formula.replace(/\s+/g, ' ').trim();
  return `formula: ${flat.length > FORMULA_SUMMARY_LENGTH ? `${flat.slice(0, FORMULA_SUMMARY_LENGTH - 1)}…` : flat}`;
}

export interface FormulaCallInput {
  readonly fn: FormulaFunction;
  /** An itemstatcost name or row id. */
  readonly stat: string | number;
  /** The picked param (a skill id, a tab or class layer, skill × 64 + level, or a plain number). */
  readonly param?: number;
  /** The stat's layer kind, if it is layered. */
  readonly kind?: StatLayerKind;
  /** skills.txt name of a skill id. */
  readonly skillName: (id: number) => string | undefined;
}

/**
 * The call the insert helper writes: `stat('name')`, `stat(39)`, `stat('item_nonclassskill', 'Teleport')` (a skill
 * stat's param by its skills.txt name when known), `stat('item_skillonhit', 30233)` (skill-event and charged stats
 * keep the exact skill and level; a skill name would match any level), `statMax('name')`.
 * `statMax` and `statSum` take no param.
 */
export function formulaCallText({ fn, stat, param, kind, skillName }: FormulaCallInput): string {
  const statText = typeof stat === 'number' ? String(stat) : `'${stat}'`;
  if (param === undefined || fn === 'statMax' || fn === 'statSum') return `${fn}(${statText})`;
  const name = kind === 'skill' ? skillName(param) : undefined;
  // A name with a quote cannot be written in single quotes (quotes have no escapes): two skills.txt names have one
  // ("Hydra Baal's Vile Whisper", "Ars Dul'Mephistos Aura"), so those are written as their id.
  const paramText = name === undefined || name.includes("'") ? String(param) : `'${name}'`;
  return `${fn}(${statText}, ${paramText})`;
}

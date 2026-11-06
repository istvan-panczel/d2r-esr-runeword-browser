/**
 * Skill-level calculator: evaluates a skill's tooltip lines (damage, radius, duration, mana, aura bonuses, synergy
 * bonuses …) at any skill level from the formulas in skillcalc.json. Pure TypeScript, used by the bundle builder (Node)
 * and the browser. See docs/features/SKILLS.md ("Skill levels").
 *
 * Public API:
 *
 *   const index = indexSkillCalc(bundle);                      // once per loaded bundle (cached)
 *   const skill = index.record('Fire Ball');                   // SkillCalcSkill | undefined
 *   const ctx = defaultContext(skill, { level: 30 });          // hard points min(30, 20), char level 110, no synergies
 *   const ctx2 = defaultContext(skill, { level: 30, synergyPoints: maxSynergyPoints(skill, index) });
 *   evaluateSkill(skill, index, ctx);                          // SkillLineResult[] for that state
 *   skillTable(skill, index, [1, 20, 30, 50, 110], { synergyPoints, charLevel });  // SkillTableRow[], a column per level
 *   synergyInputs(skill, index);                               // [{ id, max, listed }] for the per-synergy point inputs
 *   itemTriggerInfo(skill);                                    // can item procs (chance to cast) cast it?
 *
 * A line (`SkillLineResult`) carries its `key` (stable across levels: `desc2`, `dsc2-1`, `dsc3-3`), `block` ('level' =
 * the per-level tooltip block, 'fixed' = the pinned dsc2 lines, 'synergy' = the dsc3 "Receives Bonuses From" block),
 * the formatted `text`, its `values` and the text split into `before` / `span` / `after` around the numbers.
 * `unavailable` marks a value that reached a formula the calculator refuses for this input (never show a number then).
 */
import type { SkillCalcBundle, SkillCalcSkill } from '../schema.ts';
import { createSource, type SkillCalcContext, type SkillCalcSource } from './evaluate.ts';
import { evaluateSkill, tooltipOrder, type SkillLineBlock, type SkillLineResult } from './lines.ts';

export {
  evaluateSkill,
  evaluateLine,
  lineBlock,
  oneDecimal,
  tooltipOrder,
  ENGINE_LINE_TYPES,
  LINE_TYPES,
  TEXT_LINE_TYPES,
} from './lines.ts';
export type { EvaluatedLine, SkillLineBlock, SkillLineResult } from './lines.ts';
export {
  applyPercent,
  BASE_SKILLS,
  CalcRun,
  createSource,
  diminishing,
  emptyReads,
  levelDamageBonus,
  levelLengthBonus,
  manaCost,
} from './evaluate.ts';
export type { CalcReads, SkillCalcContext, SkillCalcSource } from './evaluate.ts';
export { compileCalc, formatCalc, parseCalc } from './parse.ts';
export type { CalcNode, CompiledCalc } from './parse.ts';

/** The highest skill and character level the calculator offers (the owner's "theoretical max") */
export const MAX_LEVEL = 110;
/** Character level used for lines that scale with it, unless the user sets one */
export const DEFAULT_CHAR_LEVEL = 110;
/** The compact table's columns */
export const DEFAULT_TABLE_LEVELS: readonly number[] = [1, 20, 30, 50, 110];
/** Hard points a synergy gets in the "max synergies" state when its row has no maxlvl */
const DEFAULT_SYNERGY_POINTS = 20;

export interface SkillCalcIndex extends SkillCalcSource {
  bundle: SkillCalcBundle;
  /** The skill's record by skills.txt id (skilldetails.json id) */
  record(id: string): SkillCalcSkill | undefined;
}

const indexes = new WeakMap<SkillCalcBundle, SkillCalcIndex>();

/** Lookup structures over a loaded bundle (cached per bundle object) */
export function indexSkillCalc(bundle: SkillCalcBundle): SkillCalcIndex {
  let index = indexes.get(bundle);
  if (index === undefined) {
    const source = createSource(bundle.rows, bundle.missiles, bundle.texts);
    const records = new Map(bundle.skills.map((skill) => [skill.id, skill]));
    index = { ...source, bundle, record: (id) => records.get(id) };
    indexes.set(bundle, index);
  }
  return index;
}

export interface SkillCalcOptions {
  /** Skill level with +skills (1..MAX_LEVEL) */
  level: number;
  /** Own hard points; default min(level, maxHardPoints) (0 for item skills); clamped to that range */
  hardPoints?: number;
  /** Character level; default DEFAULT_CHAR_LEVEL */
  charLevel?: number;
  /** Hard points per synergy skill id; missing = 0 */
  synergyPoints?: Readonly<Record<string, number>>;
}

/** The evaluation context of a bare character (no items, no ascendancy: every stat 0) with the given points */
export function defaultContext(skill: SkillCalcSkill, options: SkillCalcOptions): SkillCalcContext {
  const level = Math.max(0, Math.trunc(options.level));
  const cap = Math.min(level, skill.maxHardPoints);
  return {
    level,
    hardPoints: Math.max(0, Math.min(cap, Math.trunc(options.hardPoints ?? cap))),
    charLevel: Math.trunc(options.charLevel ?? DEFAULT_CHAR_LEVEL),
    skillHardPoints: options.synergyPoints ?? {},
    skillLevels: {},
    stats: {},
  };
}

export interface SynergyInputInfo {
  /** skills.txt id */
  id: string;
  /** Hard-point cap (skills.txt maxlvl) */
  max: number;
  /** Named by the tooltip's "Receives Bonuses From" lines; false = a class skill the formulas read without listing it */
  listed: boolean;
}

/**
 * The skills a user can put hard points into: the listed synergies, then the unlisted ones (other class skills the
 * shown lines read), each with its hard-point cap (skills.txt maxlvl)
 */
export function synergyInputs(skill: SkillCalcSkill, source: SkillCalcSource): SynergyInputInfo[] {
  const input = (id: string, listed: boolean): SynergyInputInfo => {
    const max = source.skill(id)?.maxlvl;
    return { id, max: typeof max === 'number' && max > 0 ? max : DEFAULT_SYNERGY_POINTS, listed };
  };
  return [...(skill.synergies ?? []).map((id) => input(id, true)), ...(skill.unlistedSynergies ?? []).map((id) => input(id, false))];
}

/** Every synergy input (listed and unlisted) at its cap (the "max synergies" state) */
export function maxSynergyPoints(skill: SkillCalcSkill, source: SkillCalcSource): Record<string, number> {
  return Object.fromEntries(synergyInputs(skill, source).map(({ id, max }) => [id, max]));
}

export interface SkillTableRow {
  key: string;
  block: SkillLineBlock;
  type: number;
  /** The line at the last column with its numbers replaced by "…" ("Fire Damage: …", "Radius: … yards") */
  label: string;
  /** One cell per requested level */
  cells: SkillLineResult[];
  /** The text differs between the columns */
  varies: boolean;
  readsCharLevel: boolean;
  readsHardPoints: boolean;
}

/**
 * The skill's lines at several levels (one cell per level, same options at every level; hard points follow the level
 * unless `hardPoints` is given), in tooltip order. Rows unavailable at every requested level are left out.
 */
export function skillTable(
  skill: SkillCalcSkill,
  source: SkillCalcSource,
  levels: readonly number[],
  options: Omit<SkillCalcOptions, 'level'> = {}
): SkillTableRow[] {
  const columns = levels.map((level) => evaluateSkill(skill, source, defaultContext(skill, { ...options, level })));
  return tooltipOrder(skill.lines).flatMap((line, i): SkillTableRow[] => {
    const cells = columns.map((column) => column[i]);
    const last = cells.filter((cell) => cell.unavailable !== true).at(-1);
    if (last === undefined) return [];
    const label = last.span === '' ? last.text : `${last.before}…${last.after}`;
    return [
      {
        key: line.key,
        block: last.block,
        type: line.type,
        label,
        cells,
        varies: new Set(cells.map((cell) => cell.text)).size > 1,
        readsCharLevel: line.ulvl === true,
        readsHardPoints: line.blvl === true,
      },
    ];
  });
}

export interface ItemTriggerInfo {
  /** yes: the skill has an item-cast function; unknown: the data does not say */
  value: 'yes' | 'unknown';
  reason: string;
}

/**
 * Whether item events (chance to cast on striking / when struck / …) can cast the skill. skills.txt `ItemEffect` is the
 * server function the game runs when an item triggers the skill. A blank ItemEffect is not a definite "no": ESR grants
 * some skills without one as chance-to-cast procs.
 */
export function itemTriggerInfo(skill: SkillCalcSkill): ItemTriggerInfo {
  if (skill.itemEffect !== undefined)
    return {
      value: 'yes',
      reason: `skills.txt ItemEffect ${String(skill.itemEffect)}: the skill has a function for casts triggered by items`,
    };
  return { value: 'unknown', reason: 'skills.txt ItemEffect is blank: the game data does not say how an item-triggered cast behaves' };
}

/**
 * Pure helpers of the skill detail card's per-level values (the skill calculator, `engine/skillCalc/`): the level and
 * synergy state with its URL form, the table levels, the column labels, the synergy texts, the "Granted by" headline
 * values and the builds mapping. See docs/features/SKILLS.md ("Page").
 */
import { DEFAULT_CHAR_LEVEL, DEFAULT_TABLE_LEVELS, defaultContext, evaluateSkill, MAX_LEVEL } from '@/features/game-data/engine/skillCalc';
import type { SkillCalcSource, SkillLineResult, SkillTableRow } from '@/features/game-data/engine/skillCalc';
import type { SkillCalcSkill, SkillGrant, SkillSynergy } from '@/features/game-data/engine/schema';

export { DEFAULT_CHAR_LEVEL, MAX_LEVEL };

/** The calculator's skill level until the user picks one (a maxed skill without +skills) */
export const DEFAULT_SKILL_LEVEL = 20;
/** Quick level buttons and the compact table's columns (110 = the community's theoretical max) */
export const QUICK_LEVELS: readonly number[] = DEFAULT_TABLE_LEVELS;
/** Every level up to this one gets a row in the full table, then every FULL_TABLE_STEP-th */
const FULL_TABLE_DENSE = 20;
const FULL_TABLE_STEP = 5;
/** URL guards: synergy lists longer than this (ESR's longest: 21 inputs, Elemental Nova) or values above this are cut */
const SYNERGY_LIST_MAX = 40;
const SYNERGY_POINTS_MAX = 99;

/**
 * Synergy hard points: `'max'` = every synergy input at its cap; a list = points per input in `synergyInputs` order (the
 * listed synergies, then the unlisted ones; missing entries = 0); a record = points by skill id (the builds pages: the
 * build's own allocation).
 */
export type SynergySetting = 'max' | readonly number[] | Readonly<Record<string, number>>;

export interface SkillLevelState {
  /** Skill level with +skills (1..MAX_LEVEL) */
  readonly level: number;
  /** Character level (1..MAX_LEVEL), only read by skills that scale with it */
  readonly charLevel: number;
  readonly synergy: SynergySetting;
}

/** What the card's controls change; `synergy: null` = back to the default (none on the Skills page, the build's points in builds) */
export interface SkillLevelPatch {
  readonly level?: number;
  readonly charLevel?: number;
  readonly synergy?: 'max' | readonly number[] | null;
}

export interface SynergyInput {
  readonly id: string;
  readonly max: number;
  /** false = a class skill the formulas read that the tooltip does not list ("Also affected by") */
  readonly listed?: boolean;
}

/** An integer in 1..MAX_LEVEL (fallback for anything else) */
export function clampLevel(value: number, fallback = DEFAULT_SKILL_LEVEL): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_LEVEL, Math.max(1, Math.trunc(value)));
}

/** A URL level param (`lvl`, `clvl`: digits only) as a level, or the fallback when missing or invalid */
export function parseLevelParam(value: string | null, fallback: number): number {
  if (value === null || !/^\d{1,3}$/.test(value)) return fallback;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= MAX_LEVEL ? parsed : fallback;
}

/** `syn` param: `max`, or points per synergy joined with "." (`5.0.20`); missing or invalid = no synergies */
export function parseSynergyParam(value: string | null): 'max' | readonly number[] {
  if (value === null || value === '') return [];
  if (value === 'max') return 'max';
  const parts = value.split('.').slice(0, SYNERGY_LIST_MAX);
  if (!parts.every((part) => /^\d{1,2}$/.test(part))) return [];
  return trimZeros(parts.map((part) => Math.min(SYNERGY_POINTS_MAX, Number(part))));
}

/** The `syn` param of a setting; null when it is the default (no synergies) */
export function formatSynergyParam(setting: 'max' | readonly number[]): string | null {
  if (setting === 'max') return 'max';
  const list = trimZeros(setting);
  return list.length === 0 ? null : list.join('.');
}

function trimZeros(list: readonly number[]): number[] {
  const out = [...list];
  while (out.length > 0 && out.at(-1) === 0) out.pop();
  return out;
}

function isList(setting: SynergySetting): setting is readonly number[] {
  return Array.isArray(setting);
}

/** The setting as hard points by synergy id, each clamped to 0..its cap (ids the skill does not list are dropped) */
export function resolveSynergyPoints(inputs: readonly SynergyInput[], setting: SynergySetting): Record<string, number> {
  const points: Record<string, number> = {};
  inputs.forEach(({ id, max }, i) => {
    const raw = setting === 'max' ? max : isList(setting) ? (setting[i] ?? 0) : (setting[id] ?? 0);
    const value = Math.max(0, Math.min(max, Math.trunc(raw)));
    if (value > 0) points[id] = value;
  });
  return points;
}

/** The positional list after one synergy's input changed (the other inputs keep what they showed) */
export function withSynergyPoints(inputs: readonly SynergyInput[], setting: SynergySetting, id: string, value: number): number[] {
  const current = resolveSynergyPoints(inputs, setting);
  return trimZeros(
    inputs.map((input) => (input.id === id ? Math.max(0, Math.min(input.max, Math.trunc(value))) : (current[input.id] ?? 0)))
  );
}

/**
 * The Values list's columns: the quick levels, plus the selected level when it is not one of them (its column gives
 * the current values and is not drawn as a quick level)
 */
export function valueTableLevels(level: number): readonly number[] {
  return QUICK_LEVELS.includes(level) ? QUICK_LEVELS : [...QUICK_LEVELS, level];
}

/** The full table's levels: 1..20, then every 5th up to MAX_LEVEL, plus the selected level where it is missing */
export function fullTableLevels(selected: number): number[] {
  const levels: number[] = [];
  for (let level = 1; level <= MAX_LEVEL; level += level < FULL_TABLE_DENSE ? 1 : FULL_TABLE_STEP) levels.push(level);
  if (!levels.includes(selected) && selected >= 1 && selected <= MAX_LEVEL) levels.push(selected);
  return levels.sort((a, b) => a - b);
}

/** Table rows that change with the level, without the synergy block (its bonuses are per synergy point, not per level) */
export function varyingRows(rows: readonly SkillTableRow[]): SkillTableRow[] {
  return rows.filter((row) => row.varies && row.block !== 'synergy');
}

/**
 * The rows with `varies` over the quick levels only (the first QUICK_LEVELS.length cells): the selected level's extra
 * column (`valueTableLevels`) must not change which lines count as varying (the values list, the level bar, the
 * "Granted by" headline lines)
 */
export function quickRows(rows: readonly SkillTableRow[]): SkillTableRow[] {
  return rows.map((row) => ({ ...row, varies: new Set(row.cells.slice(0, QUICK_LEVELS.length).map((cell) => cell.text)).size > 1 }));
}

/** A table column / row label: the text before the number ("Fire Damage", "Radius"), else the text after it */
export function rowLabel(row: SkillTableRow): string {
  const cell = row.cells.filter((entry) => entry.unavailable !== true).at(-1);
  if (cell === undefined) return row.label;
  const before = cell.before.replace(/\s+/g, ' ').replace(/[\s:]+$/, '');
  if (before !== '') return before;
  return (
    cell.after
      .replace(/\s+/g, ' ')
      .replace(/^[\s%]+/, '')
      .trim() || row.label
  );
}

/** A table cell: the number with its unit ("5.3 yards", "-20%"), or only the number when the label is the text after it */
export function cellText(cell: SkillLineResult): string {
  if (cell.unavailable === true) return '–';
  if (cell.span === '') return cell.text;
  const before = cell.before.trim();
  return before === '' ? `${cell.span}${cell.after.startsWith('%') ? '%' : ''}` : `${cell.span}${cell.after}`.replace(/\s+/g, ' ');
}

/** A trailing text every cell shares, split into a kept "%" and the words that move into the label */
function sharedTrailing(cells: readonly SkillLineResult[]): { percent: boolean; words: string } | null {
  const afters = new Set(cells.map((cell) => cell.after.replace(/\s+/g, ' ').trim()));
  const after = afters.size === 1 ? (afters.values().next().value ?? '') : '';
  const percent = after.startsWith('%');
  const words = (percent ? after.slice(1) : after).trim();
  return /[a-z]/i.test(words) ? { percent, words } : null;
}

/**
 * A table row ready to draw: a trailing text every cell shares moves into the label ("Radius (yards)": 4, 5.3, …;
 * "Average Fire Damage (per second)") so the narrow columns hold only numbers; "%" stays in the cells.
 */
export function tableRow(row: SkillTableRow): { label: string; cells: string[] } {
  const label = rowLabel(row);
  const available = row.cells.filter((cell) => cell.unavailable !== true && cell.span !== '');
  const shared = available.every((cell) => cell.before.trim() !== '') ? sharedTrailing(available) : null;
  if (available.length === 0 || shared === null) return { label, cells: row.cells.map(cellText) };
  const suffix = shared.percent ? '%' : '';
  return {
    label: `${label} (${shared.words})`,
    cells: row.cells.map((cell) => (cell.unavailable === true ? '–' : cell.span === '' ? cellText(cell) : `${cell.span}${suffix}`)),
  };
}

/** "Mana Cost: 14.5" says nothing about what an item's level of the skill does */
function isManaRow(row: SkillTableRow): boolean {
  return /^mana cost\b/i.test(row.label);
}

/** Headline preference: damage lines, then attack rating / defense / life, then the other lines (tooltip order within each) */
function headlineRank(row: SkillTableRow): number {
  if (/damage/i.test(row.label)) return 0;
  if (/attack rating|defense|life/i.test(row.label)) return 1;
  return 2;
}

/**
 * The keys of the lines a "Granted by" row (and the skill peek) shows at its level: the first `count` per-level lines
 * that vary, mana left out, damage-like lines first
 */
export function headlineKeys(rows: readonly SkillTableRow[], count = 2): string[] {
  const candidates = varyingRows(rows).filter((row) => row.block === 'level' && !isManaRow(row));
  return candidates
    .map((row, order) => ({ row, order, rank: headlineRank(row) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, count)
    .map(({ row }) => row.key);
}

/** Those lines' texts (multi-line strings joined with " ") in the results of one level */
export function headlineTexts(results: readonly SkillLineResult[], keys: readonly string[]): string[] {
  return keys.flatMap((key) => {
    const result = results.find((entry) => entry.key === key);
    return result === undefined || result.unavailable === true || result.text === '' ? [] : [result.text.replace(/\s*\n\s*/g, ' ')];
  });
}

/**
 * The skill level an item grant gives, for the headline values: the level (a range's maximum); null for `+N levels
 * (class only)`, which adds to the character's own points rather than giving a level.
 */
export function grantLevel(grant: Pick<SkillGrant, 'how' | 'level'>): number | null {
  if (grant.how === 'skill') return null;
  const level = typeof grant.level === 'number' ? grant.level : grant.level[1];
  return level >= 1 ? clampLevel(level) : null;
}

/** A "Granted by" row's values at the item's level */
export interface GrantHeadline {
  readonly texts: readonly string[];
  /** The texts use no hard points (items give none) and differ from the calculator's default hard points */
  readonly noHardPoints: boolean;
}

const NO_HEADLINE: GrantHeadline = { texts: [], noHardPoints: false };

/**
 * The headline lines (`keys`) at an item's skill level with the page's synergy points and character level, without
 * hard points (items never give any); `noHardPoints` when the default hard points (min(level, max level)) would show
 * other values
 */
export function grantHeadline(
  record: SkillCalcSkill,
  source: SkillCalcSource,
  keys: readonly string[],
  level: number,
  options: { readonly charLevel?: number; readonly synergyPoints?: Readonly<Record<string, number>> }
): GrantHeadline {
  if (keys.length === 0) return NO_HEADLINE;
  const at = (hardPoints: { hardPoints?: number }) =>
    headlineTexts(evaluateSkill(record, source, defaultContext(record, { ...options, ...hardPoints, level })), keys);
  const texts = at({ hardPoints: 0 });
  const withDefault = at({});
  return { texts, noHardPoints: texts.join('\n') !== withDefault.join('\n') };
}

/** Each grant level's headline, every level evaluated once (many grants share a level) */
export function grantHeadlines(
  levels: readonly number[],
  headline: ((level: number) => GrantHeadline) | undefined
): ReadonlyMap<number, GrantHeadline> {
  const out = new Map<number, GrantHeadline>();
  if (headline === undefined) return out;
  for (const level of levels) if (!out.has(level)) out.set(level, headline(level));
  return out;
}

/**
 * The synergy input shown next to each "Receives bonuses from" line: the first line of each synergy skill gets it, a
 * second line of the same skill (Blizzard's two Orb of Winter bonuses) none, as both would edit the same points
 */
export function synergyLineInputs<T extends SynergyInput>(synergies: readonly SkillSynergy[], inputs: readonly T[]): (T | undefined)[] {
  const used = new Set<string>();
  return synergies.map((synergy) => {
    const id = synergy.id ?? synergy.name;
    // Case-insensitive like the bundle builder's skill lookup (an exact id first)
    const input = inputs.find((entry) => entry.id === id) ?? inputs.find((entry) => entry.id.toLowerCase() === id.toLowerCase());
    if (input === undefined || used.has(input.id)) return undefined;
    used.add(input.id);
    return input;
  });
}

/**
 * The "Receives bonuses from" texts with the calculator's values: per skilldetails.json synergy (same order), the
 * calculated line without the leading "Name: " ("+6% Fire Damage per Level"), or undefined when no line matches (the
 * page keeps the skilldetails.json text then). Each calculated line is used once.
 */
export function synergyTexts(synergies: readonly SkillSynergy[], results: readonly SkillLineResult[]): (string | undefined)[] {
  const pool = results.filter((result) => result.block === 'synergy' && result.unavailable !== true && result.values.length > 0);
  const used = new Set<SkillLineResult>();
  return synergies.map((synergy) => {
    const prefix = `${synergy.name}: `;
    const match = pool.find((result) => !used.has(result) && result.text.startsWith(prefix));
    if (match === undefined) return undefined;
    used.add(match);
    return match.text.slice(prefix.length);
  });
}

/** A build's skill level: its allocated hard points plus +skills from gear, within 1..MAX_LEVEL */
export function buildSkillLevel(hardPoints: number, gear: number): number {
  return clampLevel(Math.max(0, hardPoints) + Math.max(0, gear), 1);
}

/** The +skills from gear that give a requested level on top of the build's hard points (at least 0) */
export function gearForLevel(hardPoints: number, level: number): number {
  return Math.max(0, clampLevel(level) - Math.max(0, hardPoints));
}

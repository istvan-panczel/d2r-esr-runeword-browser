/**
 * Skill levels and the skill stat columns (passive, item aura, buff), evaluated with the game-data formula evaluator.
 *
 * - Effective level of a class skill with hard points (or a +single-skill bonus): hard + all skills + class skills + tab
 *   + single skill, + oskills. A skill without either gets only oskills (item_nonclassskill). VERIFIED on the three
 *   ground-truth saves (skill-dependent numbers match); a single-skill bonus on a skill without hard points is INFERRED.
 * - A passive skill (`passive` 1) gives its passivestat columns at its level only when it has a `passivestate`: Wisdom
 *   of Athulua has none and gives nothing (VERIFIED on Javazon).
 * - An item aura (item_aura, level = the stat's value) gives its aurastat columns evaluated on the current totals; its
 *   passivestat columns (ESR hides mechanics there: the Kill Ledger's row 827) are evaluated on the BASE (gf) attributes
 *   and the skills' HARD points (mechanism INFERRED, the numbers VERIFIED on Javazon). Enemy-only auras (aurafilter
 *   0x8000) give the owner nothing (skillEffects.ts).
 * - A buff (a selected own skill or proc) gives its aurastat and passivestat columns at its level, evaluated like an
 *   aura's aurastat columns. INFERRED, no buffed ground truth.
 */
import type { CharacterFile } from '../../parser/types';
import { BASE_SKILLS, CalcRun } from '@/features/game-data/engine/skillCalc/evaluate';
import type { CharSheetSkill } from '@/features/game-data/engine/schema';
import { addStat, getStat, mergeInto, sumStat, type StatMap } from './statMap';
import type { SheetData } from './sheetData';

export interface SkillState {
  id: number;
  hard: number;
  level: number;
  bonus: { all?: number; cls?: number; tab?: number; single?: number; oskill?: number };
}

export interface SkillLevels {
  byId: Map<number, SkillState>;
  /** skills.txt names → hard points / levels, for the formulas */
  hardByName: Record<string, number>;
  levelByName: Record<string, number>;
}

const nonZero = (parts: SkillState['bonus']): SkillState['bonus'] =>
  Object.fromEntries(Object.entries(parts).filter(([, value]) => value !== 0));

/** Effective skill levels from the summed stats (items, sets, auras, passives, buffs) */
export function skillLevels(character: CharacterFile, data: SheetData, sum: StatMap): SkillLevels {
  const { stat } = data;
  const all = sumStat(sum, stat.item_allskills);
  const cls = getStat(sum, stat.item_addclassskills, character.classId);
  const hardById = new Map(character.skills.map((skill) => [skill.skillId, skill.points]));
  const byId = new Map<number, SkillState>();
  for (const skill of data.classSkills(character.classId)) {
    const hard = hardById.get(skill.n) ?? 0;
    const single = getStat(sum, stat.item_singleskill, skill.n);
    const oskill = getStat(sum, stat.item_nonclassskill, skill.n);
    const tab = skill.tab === undefined ? 0 : getStat(sum, stat.item_addskill_tab, (character.classId << 3) | (skill.tab - 1));
    const known = hard > 0 || single > 0;
    const level = known ? hard + all + cls + tab + single + oskill : oskill;
    byId.set(skill.n, {
      id: skill.n,
      hard,
      level: Math.max(0, level),
      bonus: nonZero(known ? { all, cls, tab, single, oskill } : { oskill }),
    });
  }
  // The skills every character has (Attack, Kick, Throw …): level 1
  for (const skill of data.bundle.skills)
    if (skill.cls === undefined && BASE_SKILLS.has(skill.row.id)) byId.set(skill.n, { id: skill.n, hard: 0, level: 1, bonus: {} });
  // Oskills of other classes and item skills
  for (const [id, value] of sum.get(stat.item_nonclassskill) ?? []) {
    if (byId.has(id) || value <= 0) continue;
    byId.set(id, { id, hard: 0, level: value, bonus: { oskill: value } });
  }
  const hardByName: Record<string, number> = {};
  const levelByName: Record<string, number> = {};
  for (const state of byId.values()) {
    const name = data.skill(state.id)?.row.id;
    if (name === undefined) continue;
    if (state.hard > 0) hardByName[name] = state.hard;
    if (state.level > 0) levelByName[name] = state.level;
  }
  return { byId, hardByName, levelByName };
}

export interface EvalContext {
  charLevel: number;
  stats: Readonly<Record<string, number>>;
  hardByName: Readonly<Record<string, number>>;
  levelByName: Readonly<Record<string, number>>;
  unsupported: Set<string>;
}

/** One formula cell of a skill at a level (0 for an empty cell); unsupported reads are recorded */
export function evaluateColumn(
  data: SheetData,
  skill: CharSheetSkill,
  column: string,
  level: number,
  hard: number,
  ctx: EvalContext
): number {
  const row = data.calc.skill(skill.row.id);
  const text = row?.[column];
  if (text === undefined || text === '') return 0;
  if (typeof text === 'number') return text;
  const run = new CalcRun(data.calc, skill.row.id, {
    level,
    hardPoints: hard,
    charLevel: ctx.charLevel,
    skillHardPoints: ctx.hardByName,
    skillLevels: ctx.levelByName,
    stats: ctx.stats,
  });
  const value = run.formula(text);
  for (const what of run.reads.unsupported) ctx.unsupported.add(`${skill.row.id} ${column}: ${what}`);
  return value;
}

const PASSIVE_SLOTS = Array.from({ length: 14 }, (_, i) => i + 1);
const AURA_SLOTS = Array.from({ length: 6 }, (_, i) => i + 1);

function statOf(data: SheetData, skill: CharSheetSkill, column: string, unsupported: Set<string>): number | null {
  const name = skill.row[column];
  if (typeof name !== 'string' || name === '') return null;
  const id = data.statId(name);
  if (id === undefined) unsupported.add(`${skill.row.id} ${column}: unknown stat ${name}`);
  return id ?? null;
}

/** passivestat1-14 at a level */
export function passiveStats(data: SheetData, skill: CharSheetSkill, level: number, hard: number, ctx: EvalContext): StatMap {
  const out: StatMap = new Map();
  for (const k of PASSIVE_SLOTS) {
    const id = statOf(data, skill, `passivestat${String(k)}`, ctx.unsupported);
    if (id !== null) addStat(out, id, 0, evaluateColumn(data, skill, `passivecalc${String(k)}`, level, hard, ctx));
  }
  return out;
}

/** aurastat1-6 at a level */
export function auraStats(data: SheetData, skill: CharSheetSkill, level: number, hard: number, ctx: EvalContext): StatMap {
  const out: StatMap = new Map();
  for (const k of AURA_SLOTS) {
    const id = statOf(data, skill, `aurastat${String(k)}`, ctx.unsupported);
    if (id !== null) addStat(out, id, 0, evaluateColumn(data, skill, `aurastatcalc${String(k)}`, level, hard, ctx));
  }
  return out;
}

/** A selected buff's stats at a level: its aurastat columns, plus the passivestat columns of a non-passive skill */
export function buffStats(data: SheetData, skill: CharSheetSkill, level: number, hard: number, ctx: EvalContext): StatMap {
  const stats = auraStats(data, skill, level, hard, ctx);
  if (skill.row.passive !== 1) mergeInto(stats, passiveStats(data, skill, level, hard, ctx));
  return stats;
}

/** The stat names a skill's aura / passive columns name */
export function statNamesOf(skill: CharSheetSkill): string[] {
  const names = [
    ...AURA_SLOTS.map((k) => skill.row[`aurastat${String(k)}`]),
    ...PASSIVE_SLOTS.map((k) => skill.row[`passivestat${String(k)}`]),
  ];
  return [...new Set(names.filter((name): name is string => typeof name === 'string' && name !== ''))];
}

/** The skill's attack rating % at a level: ToHitCalc, else ToHit + (level − 1) × LevToHit */
export function skillToHit(data: SheetData, skill: CharSheetSkill, level: number, hard: number, ctx: EvalContext): number {
  if (level <= 0) return 0;
  if (skill.row.ToHitCalc !== undefined) return evaluateColumn(data, skill, 'ToHitCalc', level, hard, ctx);
  const num = (value: string | number | undefined) => (typeof value === 'number' ? value : 0);
  return num(skill.row.ToHit) + (level - 1) * num(skill.row.LevToHit);
}

/**
 * skillcalc.json: the formulas and columns the skill-level calculator (engine/skillCalc) needs to evaluate the tooltip
 * lines of every skilldetails.json skill at any level, plus the line definitions with resolved texts.
 *
 * Every line (skilldesc descline1..6, dsc2line1..5, dsc3line1..7) is evaluated at skill levels 1..110 with no synergies
 * and with every listed synergy at its cap. A line is left out (and counted) when
 * - its function needs the engine (13 summon life, 31, 34 summon damage, 56 quantity) or is unknown;
 * - a text does not resolve, or the text has more placeholders than the function fills;
 * - a formula it reaches does not parse or uses an unknown / ambiguous code, function, skill or missile;
 * - it rolls a random number (`rand(a, b)` with a < b);
 * - its value depends on the character's stats: it changes when the never-zero character stats (CHARACTER_STATS) are
 *   set to the probe values. Stats used as 0/1 toggles or gear counters stay 0 (no items, no ascendancy);
 * - every number in it is 0 at every level in both states (ESR's ascendancy / item gates: a 0-second cooldown).
 * Kept lines get `ulvl` / `blvl` when their value changes with the character level / the own hard points.
 *
 * The rows are cut to the columns the kept lines can reach on any branch (`collectFormulaRefs`); a self-check evaluates
 * the kept lines again from the cut rows (at the sample levels) and warns on any difference. See docs/features/SKILLS.md ("Skill levels").
 */
import type { SkillCalcBundle, SkillCalcLine, SkillCalcRow, SkillCalcSkill, SkillDetailsBundle } from '../engine/schema.ts';
import {
  CalcRun,
  createSource,
  defaultContext,
  ENGINE_LINE_TYPES,
  evaluateLine,
  LINE_TYPES,
  maxSynergyPoints,
  MAX_LEVEL,
  type CalcReads,
  type SkillCalcContext,
  type SkillCalcSource,
} from '../engine/skillCalc/index.ts';
import { collectFormulaRefs, MISSILE_FORMULA_COLUMNS, SKILL_FORMULA_COLUMNS, type FormulaRefs } from '../engine/skillCalc/evaluate.ts';
import { placeholderCount } from '../engine/skillCalc/text.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const numbered = (prefix: string, from: number, to: number) => range(from, to).map((n) => `${prefix}${String(n)}`);

/** skills.txt numeric columns the evaluator reads */
const SKILL_NUMBER_COLUMNS = [
  ...numbered('Param', 1, 20),
  'ToHit',
  'LevToHit',
  'HitShift',
  'MinDam',
  ...numbered('MinLevDam', 1, 5),
  'MaxDam',
  ...numbered('MaxLevDam', 1, 5),
  'EMin',
  ...numbered('EMinLev', 1, 5),
  'EMax',
  ...numbered('EMaxLev', 1, 5),
  'ELen',
  ...numbered('ELevLen', 1, 3),
  'mana',
  'lvlmana',
  'manashift',
  'maxlvl',
  'Kick',
];
const MISSILE_NUMBER_COLUMNS = [
  ...numbered('Param', 1, 5),
  ...numbered('CltParam', 1, 5),
  ...numbered('sHitPar', 1, 3),
  ...numbered('cHitPar', 1, 3),
  'dParam1',
  'dParam2',
  'HitShift',
  'MinDamage',
  ...numbered('MinLevDam', 1, 5),
  'MaxDamage',
  ...numbered('MaxLevDam', 1, 5),
  'EMin',
  ...numbered('MinELev', 1, 5),
  'EMax',
  ...numbered('MaxELev', 1, 5),
  'ELen',
  ...numbered('ELevLen', 1, 3),
];

/**
 * Stats no real character has at 0 (attributes, life / mana / stamina pools, level, experience, defense, attack rating):
 * a line whose value moves when they are set is about the character, not the skill. Pools are in 256ths and probed full.
 */
export const CHARACTER_STATS = [
  'strength',
  'dexterity',
  'vitality',
  'energy',
  'hitpoints',
  'maxhp',
  'mana',
  'maxmana',
  'stamina',
  'maxstamina',
  'level',
  'experience',
  'armorclass',
  'tohit',
] as const;
type CharacterStat = (typeof CHARACTER_STATS)[number];
const PROBES: readonly Readonly<Record<CharacterStat, number>>[] = [
  {
    strength: 150,
    dexterity: 120,
    vitality: 200,
    energy: 90,
    hitpoints: 1500 * 256,
    maxhp: 1500 * 256,
    mana: 600 * 256,
    maxmana: 600 * 256,
    stamina: 400 * 256,
    maxstamina: 400 * 256,
    level: 90,
    experience: 1_000_000_000,
    armorclass: 2500,
    tohit: 3000,
  },
  {
    strength: 31,
    dexterity: 47,
    vitality: 59,
    energy: 23,
    hitpoints: 333 * 256,
    maxhp: 333 * 256,
    mana: 211 * 256,
    maxmana: 211 * 256,
    stamina: 97 * 256,
    maxstamina: 97 * 256,
    level: 7,
    experience: 12_345,
    armorclass: 77,
    tohit: 111,
  },
];
/** Levels of the probe / flag checks (the gate check uses every level) */
const SAMPLE_LEVELS = [1, 2, 5, 9, 17, 20, 23, 29, 30, 40, 50, 60, 80, 110];
const LEVELS = range(1, MAX_LEVEL);
/** skilldesc line slots: key prefix, line column prefix, text / calc prefix, count */
const SLOTS = [
  { key: 'desc', line: 'descline', text: 'desc', count: 6 },
  { key: 'dsc2-', line: 'dsc2line', text: 'dsc2', count: 5 },
  { key: 'dsc3-', line: 'dsc3line', text: 'dsc3', count: 7 },
] as const;
/** Arguments each formatted line function fills (a text with more placeholders would print blanks) */
const FILLED_ARGS: Readonly<Partial<Record<number, number>>> = { 74: 1, 75: 2, 76: 2, 77: 3, 79: 2, 36: 1, 40: 1, 78: 1, 18: 0 };

export type HiddenReason = 'engine' | 'type' | 'string' | 'format' | 'parse' | 'unsupported' | 'random' | 'stat' | 'gated';

export interface SkillCalcInput {
  skills: TsvTable;
  skilldesc: TsvTable;
  missiles: TsvTable;
  strings: ReadonlyMap<string, string>;
  /** The skills to cover, their class and synergies */
  details: SkillDetailsBundle;
}

export interface SkillCalcBuildResult {
  bundle: SkillCalcBundle;
  hidden: Record<HiddenReason, number>;
  /** Every line left out, with the reason (not stored; for reviews and tests) */
  hiddenLines: { skill: string; key: string; reason: HiddenReason }[];
  warnings: string[];
}

function readRow(row: TsvRow, id: string, numbers: readonly string[], formulas: ReadonlySet<string>): SkillCalcRow {
  const out: SkillCalcRow = { id };
  for (const column of numbers) {
    if (!row.has(column)) continue;
    const text = row.str(column);
    if (text === '') continue;
    // Text in a numeric column (missiles.txt sHitPar2 "NU") stays text: the evaluator refuses to read it as a number
    const value = Number(text);
    if (Number.isNaN(value)) out[column] = text;
    else if (value !== 0) out[column] = value;
  }
  for (const column of formulas) {
    if (!row.has(column)) continue;
    const text = row.str(column);
    if (text !== '') out[column] = text;
  }
  return out;
}

function firstById<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) if (row.id !== '' && !map.has(row.id)) map.set(row.id, row);
  return map;
}

interface Classified {
  line: SkillCalcLine;
  hidden: HiddenReason | null;
  /** Unsupported tokens / parse messages for the warnings */
  problems: string[];
}

function union(into: CalcReads, from: CalcReads): void {
  for (const stat of from.stats) into.stats.add(stat);
  for (const skill of from.skills) into.skills.add(skill);
  for (const what of from.unsupported) into.unsupported.add(what);
  into.charLevel ||= from.charLevel;
  into.ownHardPoints ||= from.ownHardPoints;
  into.random ||= from.random;
}

/** Evaluates a line's formulas over the states and decides whether it is shown */
function classify(line: SkillCalcLine, skill: SkillCalcSkill, source: SkillCalcSource, synergies: Record<string, number>): Classified {
  const evaluate = (ctx: SkillCalcContext) => evaluateLine(line, new CalcRun(source, skill.id, ctx));
  const reads: CalcReads = {
    stats: new Set(),
    skills: new Set(),
    unsupported: new Set(),
    charLevel: false,
    ownHardPoints: false,
    random: false,
  };
  let shownNumbers = false;
  let nonZero = false;
  const baseline = new Map<number, string>();
  for (const synergyPoints of [{}, synergies]) {
    for (const level of LEVELS) {
      const { result, reads: lineReads, raw } = evaluate(defaultContext(skill, { level, synergyPoints }));
      union(reads, lineReads);
      if (result.values.length > 0) shownNumbers = true;
      if (result.values.some((value) => value !== 0)) nonZero = true;
      if (synergyPoints !== synergies) baseline.set(level, JSON.stringify(raw));
    }
  }
  const problems = [...reads.unsupported].sort();
  if (problems.some((problem) => problem.startsWith('parse:'))) return { line, hidden: 'parse', problems };
  if (problems.length > 0) return { line, hidden: 'unsupported', problems };
  if (reads.random) return { line, hidden: 'random', problems: [] };
  const differs = (level: number, ctx: SkillCalcContext) => JSON.stringify(evaluate(ctx).raw) !== baseline.get(level);
  const contextAt = (level: number) => defaultContext(skill, { level });
  for (const probe of PROBES)
    if (SAMPLE_LEVELS.some((level) => differs(level, { ...contextAt(level), stats: probe }))) return { line, hidden: 'stat', problems: [] };
  if (shownNumbers && !nonZero) return { line, hidden: 'gated', problems: [] };
  const out: SkillCalcLine = { ...line };
  if (reads.charLevel && SAMPLE_LEVELS.some((level) => [1, 55].some((charLevel) => differs(level, { ...contextAt(level), charLevel }))))
    out.ulvl = true;
  if (
    reads.ownHardPoints &&
    skill.maxHardPoints > 0 &&
    SAMPLE_LEVELS.some((level) => level > 1 && differs(level, { ...contextAt(level), hardPoints: 1 }))
  )
    out.blvl = true;
  return { line: out, hidden: null, problems: [] };
}

export function buildSkillCalcBundle(input: SkillCalcInput): SkillCalcBuildResult {
  const warnings: string[] = [];
  const { strings } = input;
  const descs = new Map<string, TsvRow>();
  for (const row of input.skilldesc.rows) {
    const id = row.str('skilldesc');
    if (id !== '' && !descs.has(id)) descs.set(id, row);
  }

  // Full rows: every calc-relevant column of every skills.txt / missiles.txt row
  const skillTsv = firstById(input.skills.rows.map((row) => ({ id: row.str('skill'), row })));
  const fullSkills = [...skillTsv.values()].map(({ id, row }) => {
    const out = readRow(row, id, SKILL_NUMBER_COLUMNS, SKILL_FORMULA_COLUMNS);
    const desc = descs.get(row.str('skilldesc'));
    for (const n of [1, 2, 3]) {
      const column = `descmissile${String(n)}`;
      const missile = desc?.has(column) === true ? desc.str(column) : '';
      if (missile !== '') out[column] = missile;
    }
    return out;
  });
  const fullMissiles = [
    ...firstById(
      input.missiles.rows.map((row) => readRow(row, row.str('Missile'), MISSILE_NUMBER_COLUMNS, MISSILE_FORMULA_COLUMNS))
    ).values(),
  ];
  const texts: string[] = [];
  const textIndex = new Map<string, number>();
  const textId = (text: string) => {
    let id = textIndex.get(text);
    if (id === undefined) {
      id = texts.length;
      texts.push(text);
      textIndex.set(text, id);
    }
    return id;
  };
  const full = createSource(fullSkills, fullMissiles, texts);

  const hidden: Record<HiddenReason, number> = {
    engine: 0,
    type: 0,
    string: 0,
    format: 0,
    parse: 0,
    unsupported: 0,
    random: 0,
    stat: 0,
    gated: 0,
  };
  const problemLines = new Map<string, string[]>();
  const hiddenLines: SkillCalcBuildResult['hiddenLines'] = [];
  const records: SkillCalcSkill[] = [];

  for (const detail of input.details.skills) {
    const tsv = skillTsv.get(detail.id);
    if (tsv === undefined) {
      warnings.push(`skillcalc: skill "${detail.id}" not in skills.txt`);
      continue;
    }
    const desc = descs.get(tsv.row.str('skilldesc'));
    const record: SkillCalcSkill = { id: detail.id, maxHardPoints: detail.cls === null ? 0 : tsv.row.num('maxlvl'), lines: [] };
    const synergies = [
      ...new Set(
        (detail.synergies ?? []).flatMap((synergy) => {
          const row = full.skill(synergy.id ?? synergy.name);
          return row === undefined || row.id === detail.id || /(Passive|Control)$/.test(row.id) ? [] : [row.id];
        })
      ),
    ];
    if (synergies.length > 0) record.synergies = synergies;
    const itemEffect = tsv.row.has('ItemEffect') ? Number(tsv.row.str('ItemEffect')) : 0;
    if (Number.isFinite(itemEffect) && itemEffect !== 0) record.itemEffect = itemEffect;
    const synergyPoints = maxSynergyPoints(record, full);
    let statLines = 0;
    let otherLines = 0;

    for (const slot of SLOTS) {
      for (let i = 1; i <= slot.count && desc !== undefined; i++) {
        const n = String(i);
        if (!desc.has(`${slot.line}${n}`)) continue;
        const type = Number(desc.str(`${slot.line}${n}`));
        if (!Number.isInteger(type) || type === 0) continue;
        const key = `${slot.key}${n}`;
        const where = `${detail.id} ${key}`;
        const hide = (reason: HiddenReason, warning?: string) => {
          hidden[reason]++;
          hiddenLines.push({ skill: detail.id, key, reason });
          if (reason === 'stat') statLines++;
          else otherLines++;
          if (warning !== undefined) warnings.push(`skillcalc: ${warning} (${where})`);
        };
        if (ENGINE_LINE_TYPES.has(type)) {
          hide('engine');
          continue;
        }
        if (!LINE_TYPES.has(type)) {
          hide('type', `line function ${String(type)} is not supported`);
          continue;
        }
        const line: SkillCalcLine = { key, type };
        let missing: string | null = null;
        for (const [part, column] of [
          ['a', `${slot.text}texta${n}`],
          ['b', `${slot.text}textb${n}`],
        ] as const) {
          const textKey = desc.str(column);
          if (textKey === '') continue;
          const text = strings.get(textKey);
          if (text === undefined) missing = textKey;
          else line[part] = textId(text);
        }
        if (missing !== null) {
          hide('string', `string "${missing}" not in the strings`);
          continue;
        }
        const ca = desc.str(`${slot.text}calca${n}`);
        const cb = desc.str(`${slot.text}calcb${n}`);
        if (ca !== '') line.ca = ca;
        if (cb !== '') line.cb = cb;
        const filled = FILLED_ARGS[type];
        const formats = (type === 36 ? [line.a, line.b] : [line.a]).map((id) => (id === undefined ? '' : (texts[id] ?? '')));
        if (filled !== undefined && formats.some((format) => placeholderCount(format) > filled)) {
          hide('format', `line function ${String(type)} fills ${String(filled)} placeholders, the text has more`);
          continue;
        }
        const result = classify(line, record, full, synergyPoints);
        if (result.hidden !== null) {
          hide(result.hidden);
          for (const problem of result.problems) problemLines.set(problem, [...(problemLines.get(problem) ?? []), where]);
          continue;
        }
        record.lines.push(result.line);
      }
    }
    if (record.lines.some((line) => line.ulvl === true)) record.scalesWithCharLevel = true;
    if (record.lines.some((line) => line.blvl === true)) record.scalesWithHardPointsOnly = true;
    if (statLines > 0) record.hiddenStatLines = statLines;
    if (otherLines > 0) record.hiddenOtherLines = otherLines;
    records.push(record);
  }
  for (const [problem, lines] of [...problemLines].sort(([a], [b]) => a.localeCompare(b))) {
    const sample = lines.slice(0, 5).join(', ');
    warnings.push(
      `skillcalc: ${problem} in ${String(lines.length)} line${lines.length === 1 ? '' : 's'} (${sample}${lines.length > 5 ? ', …' : ''})`
    );
  }

  // Cut the rows to what the kept lines can reach
  const refs: FormulaRefs = { skills: new Map(), missiles: new Map() };
  for (const record of records) {
    const row = full.skill(record.id);
    if (row === undefined) continue;
    refs.skills.set(row.id, refs.skills.get(row.id) ?? new Set());
    for (const line of record.lines)
      for (const text of [line.ca, line.cb]) if (text !== undefined) collectFormulaRefs(full, row, text, refs);
    for (const id of record.synergies ?? []) {
      const columns = refs.skills.get(id) ?? new Set();
      columns.add('maxlvl');
      refs.skills.set(id, columns);
    }
  }
  const cut = (rows: readonly SkillCalcRow[], wanted: ReadonlyMap<string, ReadonlySet<string>>) =>
    rows.flatMap((row) => {
      const columns = wanted.get(row.id);
      if (columns === undefined) return [];
      const out: SkillCalcRow = { id: row.id };
      for (const column of [...columns].sort()) {
        const value = row[column];
        if (value !== undefined) out[column] = value;
      }
      return [out];
    });
  // Texts of hidden lines are dropped; the kept ones are renumbered in order of use
  const kept: string[] = [];
  const renumber = new Map<number, number>();
  const keep = (id: number | undefined) => {
    if (id === undefined) return undefined;
    let next = renumber.get(id);
    if (next === undefined) {
      next = kept.length;
      kept.push(texts[id] ?? '');
      renumber.set(id, next);
    }
    return next;
  };
  const skills = records.map((record) => ({
    ...record,
    lines: record.lines.map((line) => {
      const out: SkillCalcLine = { ...line };
      const a = keep(line.a);
      const b = keep(line.b);
      if (a !== undefined) out.a = a;
      if (b !== undefined) out.b = b;
      return out;
    }),
  }));
  const bundle: SkillCalcBundle = {
    skills,
    rows: cut(fullSkills, refs.skills),
    missiles: cut(fullMissiles, refs.missiles),
    texts: kept,
  };

  // Self-check: the cut rows and renumbered texts give the same lines as the full ones
  const compact = createSource(bundle.rows, bundle.missiles, bundle.texts);
  for (const [i, record] of records.entries()) {
    const synergyPoints = maxSynergyPoints(record, full);
    const compactRecord = skills[i] ?? record;
    for (const points of [{}, synergyPoints]) {
      for (const level of SAMPLE_LEVELS) {
        const ctx = defaultContext(record, { level, synergyPoints: points });
        const fullRun = new CalcRun(full, record.id, ctx);
        const compactRun = new CalcRun(compact, record.id, ctx);
        for (const [j, line] of record.lines.entries()) {
          const a = evaluateLine(line, fullRun).result;
          const b = evaluateLine(compactRecord.lines[j] ?? line, compactRun).result;
          if (a.text !== b.text || a.unavailable !== b.unavailable)
            warnings.push(`skillcalc: the cut rows change ${record.id} ${line.key} at level ${String(level)}: "${a.text}" → "${b.text}"`);
        }
      }
    }
  }
  return { bundle, hidden, hiddenLines, warnings: [...new Set(warnings)] };
}

/**
 * Evaluator of the game's calc formulas for one skill of one (imaginary) character, after D2MOO
 * (`SKILLS_GetSpecialParamValue`, `SKILLS_GetMin/MaxElemDamage`, `SKILLS_GetElementalLength`, `SKILLS_GetManaCosts`,
 * `D2Common_11033`, `MISSILE_GetSpecialParamValue`, Fog `Calc.cpp`) and the D2R Data Guide code lists. Formulas are
 * compiled like the game's Fog compiler does (`parse.ts`: its precedence and ternary rules, not the conventional ones).
 *
 * - 32-bit integer arithmetic: `/` truncates toward 0 and `x / 0` = 0, `^` is a repeated multiply (exponent ≤ 0 → 1),
 *   comparisons give 1 / 0, the ternary picks a branch by `cond ≠ 0`
 * - the character: skill level `level` (with +skills), own hard points `hardPoints`, `charLevel` (`ulvl`), other skills'
 *   hard points (`skill('X'.blvl)`, the synergies) and total levels (`skill('X'.lvl)`, default = their hard points: a
 *   simplification, in game it includes the character's +skills; the base skills Attack, Kick, Throw, Unsummon, Left
 *   Hand Throw / Swing are at least 1), every stat 0 unless given
 * - `skill('X'.code)` evaluates X's column at X's level (0 when the character lacks X: params and calcs still evaluate,
 *   `ln12` / damage / mana give 0); `sklvl('X'.a.b)` evaluates X's `b` at this skill's `a`; `sksrc('X'.lvl)` (D2R) is read
 *   like `skill('X'.lvl)`; `miss('m'.code)` reads a missiles.txt code at this skill's level
 * - `rand(a, b)` with a < b is not a number a tooltip can show: it gives a and marks the result random
 * - anything else (an unknown code, function, skill or missile, a parse error, a recursion) gives 0 and is recorded in
 *   `reads.unsupported`; callers must not show such a value
 *
 * Every read is recorded (stats by name, `ulvl`, own and other skills' points) so the bundle builder can classify lines.
 */
import type { SkillCalcRow } from '../schema.ts';
import { parseCalc, type CalcNode } from './parse.ts';

export const BASE_SKILLS: ReadonlySet<string> = new Set(['Attack', 'Kick', 'Throw', 'Unsummon', 'Left Hand Throw', 'Left Hand Swing']);

/** The character a formula is evaluated for */
export interface SkillCalcContext {
  /** Skill level including +skills (`lvl`) */
  level: number;
  /** Hard points in the skill itself (`blvl`) */
  hardPoints: number;
  /** Character level (`ulvl`) */
  charLevel: number;
  /** Hard points of other skills by skills.txt id (synergies); missing = 0 */
  skillHardPoints: Readonly<Record<string, number>>;
  /** Total levels of other skills by skills.txt id; missing = their hard points (base skills at least 1) */
  skillLevels: Readonly<Record<string, number>>;
  /** Unit stats by itemstatcost name (`stat('x'.accr)`); missing = 0 */
  stats: Readonly<Record<string, number>>;
}

/** What an evaluation read */
export interface CalcReads {
  stats: Set<string>;
  /** `ulvl` */
  charLevel: boolean;
  /** The evaluated skill's own hard points (`blvl`) */
  ownHardPoints: boolean;
  /** Other skills whose hard points or level were read */
  skills: Set<string>;
  /** `rand(a, b)` with a < b */
  random: boolean;
  /** Tokens that could not be evaluated: `code:clc0`, `function:foo`, `skill:Name`, `missile:name`, `parse:…`, … */
  unsupported: Set<string>;
}

export function emptyReads(): CalcReads {
  return { stats: new Set(), charLevel: false, ownHardPoints: false, skills: new Set(), random: false, unsupported: new Set() };
}

/** Row lookup by name: exact, then case-insensitive (formulas name skills by their skills.txt id) */
export interface SkillCalcSource {
  skill(name: string): SkillCalcRow | undefined;
  missile(name: string): SkillCalcRow | undefined;
  /** A line text by its index (SkillCalcLine.a / .b) */
  text(index: number): string | undefined;
}

export function createSource(
  skills: readonly SkillCalcRow[],
  missiles: readonly SkillCalcRow[],
  texts: readonly string[] = []
): SkillCalcSource {
  const index = (rows: readonly SkillCalcRow[]) => {
    const exact = new Map<string, SkillCalcRow>();
    const lower = new Map<string, SkillCalcRow>();
    for (const row of rows) {
      if (!exact.has(row.id)) exact.set(row.id, row);
      if (!lower.has(row.id.toLowerCase())) lower.set(row.id.toLowerCase(), row);
    }
    return (name: string) => exact.get(name) ?? lower.get(name.toLowerCase());
  };
  const skill = index(skills);
  const missile = index(missiles);
  return { skill, missile, text: (i) => texts[i] };
}

// --- columns -----------------------------------------------------------------------------------------------------

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** skills.txt formula columns by calc code */
const SKILL_CALC_ENTRIES: readonly (readonly [string, string])[] = [
  ...range(1, 10).map((n) => [`clc${String(n)}`, `calc${String(n)}`] as const),
  ...range(1, 6).map((n) => [`ast${String(n)}`, `aurastatcalc${String(n)}`] as const),
  ...range(1, 14).map((n) => [`pst${String(n)}`, `passivecalc${String(n)}`] as const),
  ['len', 'auralencalc'],
  ['rng', 'aurarangecalc'],
  ['pets', 'petmax'],
  ['skpt', 'skpoints'],
];
const SKILL_CALC_CODES: Readonly<Partial<Record<string, string>>> = Object.fromEntries(SKILL_CALC_ENTRIES);

/** Columns holding formulas (kept as text in the bundle) */
export const SKILL_FORMULA_COLUMNS: ReadonlySet<string> = new Set([
  ...SKILL_CALC_ENTRIES.map(([, column]) => column),
  'ToHitCalc',
  'DmgSymPerCalc',
  'EDmgSymPerCalc',
  'ELenSymPerCalc',
]);
/**
 * missiles.txt formula columns. `Range` is a number in the Data Guide (with `LevRange`), but ESR's D2R files have no
 * LevRange and write formulas there ("90+25*lvl"): evaluated as a missile formula at the missile level.
 */
export const MISSILE_FORMULA_COLUMNS: ReadonlySet<string> = new Set(['DmgSymPerCalc', 'EDmgSymPerCalc', 'Range']);
/** skills.txt columns holding names (skilldesc descmissile1..3, copied onto the skill row) */
export const SKILL_NAME_COLUMNS: ReadonlySet<string> = new Set(['descmissile1', 'descmissile2', 'descmissile3']);

/** `ln12` / `dm12` … → the two Param numbers */
const PARAM_PAIRS: Readonly<Partial<Record<string, [number, number]>>> = {
  '12': [1, 2],
  '34': [3, 4],
  '56': [5, 6],
  '78': [7, 8],
  '91': [9, 10],
  '21': [11, 12],
};

const levColumns = (prefix: string) => range(1, 5).map((n) => `${prefix}${String(n)}`);
const SKILL_ELEM = {
  min: ['EMin', ...levColumns('EMinLev'), 'HitShift', 'EDmgSymPerCalc'],
  max: ['EMax', ...levColumns('EMaxLev'), 'HitShift', 'EDmgSymPerCalc'],
} as const;
const SKILL_PHYS = {
  min: ['Kick', 'MinDam', ...levColumns('MinLevDam'), 'DmgSymPerCalc', 'HitShift'],
  max: ['Kick', 'MaxDam', ...levColumns('MaxLevDam'), 'DmgSymPerCalc', 'HitShift'],
} as const;
const SKILL_LENGTH = ['ELen', 'ELevLen1', 'ELevLen2', 'ELevLen3', 'ELenSymPerCalc'];
const MANA = ['mana', 'lvlmana', 'manashift'];
const MISSILE_ELEM = {
  min: ['EMin', ...levColumns('MinELev'), 'HitShift', 'EDmgSymPerCalc'],
  max: ['EMax', ...levColumns('MaxELev'), 'HitShift', 'EDmgSymPerCalc'],
} as const;
const MISSILE_PHYS = {
  min: ['MinDamage', ...levColumns('MinLevDam'), 'HitShift', 'DmgSymPerCalc'],
  max: ['MaxDamage', ...levColumns('MaxLevDam'), 'HitShift', 'DmgSymPerCalc'],
} as const;
const MISSILE_LENGTH = ['ELen', 'ELevLen1', 'ELevLen2', 'ELevLen3'];

/** Missile param codes → column */
const MISSILE_PARAMS: Readonly<Partial<Record<string, string>>> = {
  ...Object.fromEntries(range(1, 5).map((n) => [`par${String(n)}`, `Param${String(n)}`])),
  ...Object.fromEntries(range(1, 5).map((n) => [`cpa${String(n)}`, `CltParam${String(n)}`])),
  ...Object.fromEntries(range(1, 3).map((n) => [`hpa${String(n)}`, `sHitPar${String(n)}`])),
  ...Object.fromEntries(range(1, 3).map((n) => [`chp${String(n)}`, `cHitPar${String(n)}`])),
  dpa1: 'dParam1',
  dpa2: 'dParam2',
};
/** Missile level codes: [first column, second column, linear (`a + (lvl-1)*b`) or the dm curve] */
const MISSILE_PAIRS: Readonly<Partial<Record<string, [string, string, 'ln' | 'dm']>>> = {
  sl12: ['Param1', 'Param2', 'ln'],
  sd12: ['Param1', 'Param2', 'dm'],
  sl34: ['Param3', 'Param4', 'ln'],
  sd34: ['Param3', 'Param4', 'dm'],
  cl12: ['CltParam1', 'CltParam2', 'ln'],
  cd12: ['CltParam1', 'CltParam2', 'dm'],
  cl34: ['CltParam3', 'CltParam4', 'ln'],
  cd34: ['CltParam3', 'CltParam4', 'dm'],
  shl1: ['sHitPar1', 'sHitPar2', 'ln'],
  shd1: ['sHitPar1', 'sHitPar2', 'dm'],
  chl1: ['cHitPar1', 'cHitPar2', 'ln'],
  chd1: ['cHitPar1', 'cHitPar2', 'dm'],
  dl12: ['dParam1', 'dParam2', 'ln'],
  dd12: ['dParam1', 'dParam2', 'dm'],
};

/** Skill codes that read a skilldesc descmissile: `m<n><what>` → the missile code it evaluates */
const DESC_MISSILE_CODES: Readonly<Partial<Record<string, string>>> = {
  en: 'edmn',
  ex: 'edmx',
  el: 'edln',
  rn: 'rang',
  eo: 'edns',
  ey: 'edxs',
};
/**
 * `m2eo`, `m2ey`, `me3o`, `me3y`: D2MOO picks the missile with `(code - 43) / 3`, which maps m2eo to descmissile1 and
 * me3o to descmissile2 (its own TODO calls it a copy-paste error). Whether D2R kept that is unknown, so they are refused.
 */
const AMBIGUOUS_MISSILE_CODES: ReadonlySet<string> = new Set(['m2eo', 'm2ey', 'me3o', 'me3y']);

/**
 * Mastery codes, refused. `math` / `madm` / `macr` are not unit stats: the engine (D2MOO `D2Common_11032`) evaluates the
 * skill's own passivecalc whose passivestat is the melee / throwing mastery to-hit / damage / crit stat (ESR uses none).
 * `mael` / `mapi` / `manc` are D2R additions the engine sources do not cover (ESR: `mael` once, Inferno Sentry).
 */
const MASTERY_CODES: ReadonlySet<string> = new Set(['math', 'madm', 'macr', 'mael', 'mapi', 'manc']);

function descMissileCode(code: string): { slot: number; code: string } | null {
  const match = /^m([123])(en|ex|el|rn|eo|ey)$/.exec(code);
  if (match === null) return null;
  const target = DESC_MISSILE_CODES[match[2]];
  return target === undefined ? null : { slot: Number(match[1]), code: target };
}

function paramCode(code: string): number | null {
  const short = /^par([1-9])$/.exec(code);
  if (short !== null) return Number(short[1]);
  const long = /^pa(1[0-9]|20)$/.exec(code);
  return long === null ? null : Number(long[1]);
}

/** The skills.txt columns a skill code reads (formula columns are followed separately); null for an unknown code */
export function skillCodeColumns(code: string): readonly string[] | null {
  if (code === 'lvl' || code === 'blvl' || code === 'ulvl' || MASTERY_CODES.has(code)) return [];
  const param = paramCode(code);
  if (param !== null) return [`Param${String(param)}`];
  const pair = /^(ln|dm)(12|34|56|78|91|21)$/.exec(code);
  if (pair !== null) {
    const [a, b] = PARAM_PAIRS[pair[2]] ?? [0, 0];
    return [`Param${String(a)}`, `Param${String(b)}`];
  }
  const calc = SKILL_CALC_CODES[code];
  if (calc !== undefined) return [calc];
  if (['edmn', 'edns', 'enma', 'enms'].includes(code)) return SKILL_ELEM.min;
  if (['edmx', 'edxs', 'exma', 'exms'].includes(code)) return SKILL_ELEM.max;
  if (code === 'edln' || code === 'edma') return SKILL_LENGTH;
  if (code === 'toht') return ['ToHitCalc', 'ToHit', 'LevToHit'];
  if (code === 'usmc' || code === 'mana' || code === 'mps') return MANA;
  if (code === 'pnma' || code === 'pnms') return SKILL_PHYS.min;
  if (code === 'pxma' || code === 'pxms') return SKILL_PHYS.max;
  const missile = descMissileCode(code);
  if (missile !== null) return [`descmissile${String(missile.slot)}`];
  return null;
}

/** The missiles.txt columns a missile code reads; null for an unknown code */
export function missileCodeColumns(code: string): readonly string[] | null {
  if (code === 'lvl') return [];
  if (code === 'rang') return ['Range'];
  const param = MISSILE_PARAMS[code];
  if (param !== undefined) return [param];
  const pair = MISSILE_PAIRS[code];
  if (pair !== undefined) return [pair[0], pair[1]];
  if (code === 'edmn' || code === 'edns') return MISSILE_ELEM.min;
  if (code === 'edmx' || code === 'edxs') return MISSILE_ELEM.max;
  if (code === 'edln') return MISSILE_LENGTH;
  if (code === 'damn' || code === 'dmns') return MISSILE_PHYS.min;
  if (code === 'damx' || code === 'dmxs') return MISSILE_PHYS.max;
  return null;
}

// --- engine helpers ----------------------------------------------------------------------------------------------

/** int32 wrap */
const i32 = (value: number) => value | 0;

/** `SKILLS_CalculateDamageBonusByLevel`: per-level damage for levels 2-8, 9-16, 17-22, 23-28 and 29+ */
export function levelDamageBonus(level: number, perLevel: readonly number[]): number {
  if (level <= 1) return 0;
  const [l1 = 0, l2 = 0, l3 = 0, l4 = 0, l5 = 0] = perLevel;
  if (level > 28) return 7 * l1 + 8 * l2 + 6 * (l3 + l4) + l5 * (level - 28);
  if (level > 22) return 7 * l1 + 8 * l2 + 6 * l3 + l4 * (level - 22);
  if (level > 16) return 7 * l1 + 8 * l2 + l3 * (level - 16);
  if (level > 8) return 7 * l1 + l2 * (level - 8);
  return l1 * (level - 1);
}

/** `D2Common_11033` (the `dm12` codes): `a + (b - a) * (110 * lvl / (lvl + 6)) / 100`, integer math, capped at b */
export function diminishing(level: number, a: number, b: number): number {
  const value = i32(a + Math.trunc(((b - a) * Math.trunc((110 * level) / (level + 6))) / 100));
  return value > b ? b : value;
}

/** Elemental length bonus per level: ELevLen1 for levels 2-8, ELevLen2 for 9-16, ELevLen3 from 17 on */
export function levelLengthBonus(level: number, perLevel: readonly number[]): number {
  const [l1 = 0, l2 = 0, l3 = 0] = perLevel;
  if (level > 16) return 7 * l1 + 8 * l2 + (level - 16) * l3;
  if (level > 8) return 7 * l1 + (level - 8) * l2;
  return l1 * (level - 1);
}

/** `DATATBLS_ApplyRatio(value, percent, 100)` */
export function applyPercent(value: number, percent: number): number {
  return i32(Math.trunc((value * percent) / 100));
}

/** `SKILLS_GetManaCosts`: (mana + (lvl - 1) * lvlmana) << manashift, in 256ths */
export function manaCost(mana: number, perLevel: number, shift: number, level: number): number {
  return i32((mana + (level - 1) * perLevel) << shift);
}

// --- evaluation --------------------------------------------------------------------------------------------------

interface Frame {
  kind: 'skill' | 'missile';
  row: SkillCalcRow;
  level: number;
  depth: number;
}

const MAX_DEPTH = 40;
/**
 * Formula nodes one `formula()` call may evaluate (reported as `steps`). ESR's formulas stay far below it; a chain of
 * columns that each read the next one twice would double the work per column without this cap.
 */
const MAX_STEPS = 200_000;

/**
 * One evaluation run for one character: `formula(text)` evaluates a cell of the skill row `ownId` at `ctx.level`, or of
 * another row / level. `reads` accumulates over every call until `resetReads()`.
 */
export class CalcRun {
  readonly reads: CalcReads = emptyReads();
  readonly #source: SkillCalcSource;
  readonly #ownId: string;
  readonly #ctx: SkillCalcContext;
  /** The formula columns being evaluated (`kind:row:column:level`): reading one again is a cycle */
  readonly #active = new Set<string>();
  #steps = 0;

  constructor(source: SkillCalcSource, ownId: string, ctx: SkillCalcContext) {
    this.#source = source;
    this.#ownId = ownId;
    this.#ctx = ctx;
  }

  get source(): SkillCalcSource {
    return this.#source;
  }

  resetReads(): void {
    Object.assign(this.reads, emptyReads());
  }

  /** Evaluates a formula in the context of the own skill row at the context level */
  formula(text: string): number {
    const row = this.#source.skill(this.#ownId);
    if (row === undefined) {
      this.reads.unsupported.add(`skill:${this.#ownId}`);
      return 0;
    }
    this.#steps = 0;
    return this.#eval(parseCalc(text), { kind: 'skill', row, level: this.#ctx.level, depth: 0 });
  }

  #unsupported(what: string): number {
    this.reads.unsupported.add(what);
    return 0;
  }

  #hardPoints(id: string): number {
    if (id === this.#ownId) {
      this.reads.ownHardPoints = true;
      return this.#ctx.hardPoints;
    }
    this.reads.skills.add(id);
    return this.#ctx.skillHardPoints[id] ?? (BASE_SKILLS.has(id) ? 1 : 0);
  }

  #level(id: string): number {
    if (id === this.#ownId) return this.#ctx.level;
    const hard = this.#hardPoints(id);
    return this.#ctx.skillLevels[id] ?? (BASE_SKILLS.has(id) ? Math.max(1, hard) : hard);
  }

  #stat(name: string): number {
    this.reads.stats.add(name);
    return this.#ctx.stats[name] ?? 0;
  }

  #column(frame: Frame, column: string): number {
    const text = frame.row[column];
    if (typeof text === 'number') return text;
    if (text === undefined || text === '') return 0;
    const key = `${frame.kind}:${frame.row.id}:${column}:${String(frame.level)}`;
    if (frame.depth >= MAX_DEPTH || this.#active.has(key)) return this.#unsupported('recursion');
    this.#active.add(key);
    try {
      return this.#eval(parseCalc(text), { ...frame, depth: frame.depth + 1 });
    } finally {
      this.#active.delete(key);
    }
  }

  /** A numeric cell; text in a numeric column (missiles.txt sHitPar2 "NU") cannot be evaluated */
  #num(row: SkillCalcRow, column: string): number {
    const value = row[column];
    if (typeof value === 'number') return value;
    if (value !== undefined && value !== '') this.#unsupported(`text:${row.id}.${column}`);
    return 0;
  }

  #has(frame: Frame, column: string): boolean {
    const value = frame.row[column];
    return value !== undefined && value !== '';
  }

  #eval(node: CalcNode, frame: Frame): number {
    if (++this.#steps > MAX_STEPS) return this.#unsupported('steps');
    switch (node.kind) {
      case 'num':
        return node.value;
      case 'code':
        return frame.kind === 'skill' ? this.#skillCode(frame, node.code) : this.#missileCode(frame, node.code);
      case 'neg':
        return i32(-this.#eval(node.arg, frame));
      case 'ternary':
        return this.#eval(node.cond, frame) !== 0 ? this.#eval(node.then, frame) : this.#eval(node.else, frame);
      case 'bin':
        return binary(node.op, this.#eval(node.left, frame), this.#eval(node.right, frame));
      case 'call':
        return this.#call(frame, node.name, node.args);
      case 'link':
        return this.#unsupported(`link:'${node.link.name}' outside a function`);
      case 'error':
        return this.#unsupported(`parse:${node.message}`);
    }
  }

  #call(frame: Frame, name: string, args: readonly CalcNode[]): number {
    if (name === 'min' || name === 'max' || name === 'rand') {
      if (args.length !== 2) return this.#unsupported(`function:${name}/${String(args.length)}`);
      const [first, second] = args;
      const a = this.#eval(first, frame);
      const b = this.#eval(second, frame);
      if (name === 'min') return Math.min(a, b);
      if (name === 'max') return Math.max(a, b);
      if (a < b) this.reads.random = true;
      return a;
    }
    const link = args.length === 1 && args[0]?.kind === 'link' ? args[0].link : null;
    if (link === null) return this.#unsupported(`function:${name}`);
    const [field, second = ''] = link.fields;
    if (name === 'stat') {
      if (link.fields.length !== 1 || (field !== 'accr' && field !== 'base'))
        return this.#unsupported(`stat:${link.name}.${link.fields.join('.')}`);
      return this.#stat(link.name);
    }
    if (name === 'miss') {
      const missile = this.#source.missile(link.name);
      if (missile === undefined) return this.#unsupported(`missile:${link.name}`);
      if (link.fields.length !== 1) return this.#unsupported(`miss:${link.fields.join('.')}`);
      return this.#missileCode({ kind: 'missile', row: missile, level: frame.level, depth: frame.depth + 1 }, field);
    }
    if (name !== 'skill' && name !== 'sksrc' && name !== 'sklvl') return this.#unsupported(`function:${name}`);
    const row = this.#source.skill(link.name);
    if (row === undefined) return this.#unsupported(`skill:${link.name}`);
    if (name === 'sklvl') {
      // sklvl('X'.a.b): X's code b at the level this skill's code a gives
      if (link.fields.length !== 2 || frame.kind !== 'skill') return this.#unsupported(`sklvl:${link.fields.join('.')}`);
      const level = this.#skillCode(frame, field);
      return this.#skillCode({ kind: 'skill', row, level, depth: frame.depth + 1 }, second);
    }
    if (link.fields.length !== 1) return this.#unsupported(`${name}:${link.fields.join('.')}`);
    if (field === 'blvl') return this.#hardPoints(row.id);
    if (field === 'lvl') return this.#level(row.id);
    if (name === 'sksrc') return this.#unsupported(`sksrc:${field}`);
    return this.#skillCode({ kind: 'skill', row, level: this.#level(row.id), depth: frame.depth + 1 }, field);
  }

  #skillCode(frame: Frame, code: string): number {
    const { row, level } = frame;
    if (code === 'lvl') return level;
    if (code === 'blvl') return this.#hardPoints(row.id);
    if (code === 'ulvl') {
      this.reads.charLevel = true;
      return this.#ctx.charLevel;
    }
    const param = paramCode(code);
    if (param !== null) return this.#num(row, `Param${String(param)}`);
    const pair = /^(ln|dm)(12|34|56|78|91|21)$/.exec(code);
    if (pair !== null) {
      const [a, b] = PARAM_PAIRS[pair[2]] ?? [0, 0];
      const pa = this.#num(row, `Param${String(a)}`);
      const pb = this.#num(row, `Param${String(b)}`);
      // dm78 has no level check in the engine
      if (level <= 0 && code !== 'dm78') return 0;
      return pair[1] === 'ln' ? i32(pa + (level - 1) * pb) : diminishing(level, pa, pb);
    }
    const calc = SKILL_CALC_CODES[code];
    if (calc !== undefined) return this.#column(frame, calc);
    switch (code) {
      case 'edmn':
      case 'enma':
        return this.#skillElem(frame, 'min') >> 8;
      case 'edmx':
      case 'exma':
        return this.#skillElem(frame, 'max') >> 8;
      case 'edns':
      case 'enms':
        return this.#skillElem(frame, 'min');
      case 'edxs':
      case 'exms':
        return this.#skillElem(frame, 'max');
      case 'edln':
      case 'edma':
        return this.#skillLength(frame);
      case 'toht':
        if (level <= 0) return 0;
        return this.#has(frame, 'ToHitCalc')
          ? this.#column(frame, 'ToHitCalc')
          : i32(this.#num(row, 'ToHit') + (level - 1) * this.#num(row, 'LevToHit'));
      case 'usmc':
        return level > 0 ? manaCost(this.#num(row, 'mana'), this.#num(row, 'lvlmana'), this.#num(row, 'manashift'), level) : 0;
      case 'mana':
        return level > 0 ? manaCost(this.#num(row, 'mana'), this.#num(row, 'lvlmana'), this.#num(row, 'manashift'), level) >> 8 : 0;
      case 'mps':
        if (level <= 0) return 0;
        return (
          (Math.trunc((25 * this.#num(row, 'mana') + (level - 1) * this.#num(row, 'lvlmana')) / 2) << this.#num(row, 'manashift')) >> 8
        );
      case 'pnma':
        return this.#skillPhys(frame, 'min') >> 8;
      case 'pxma':
        return this.#skillPhys(frame, 'max') >> 8;
      case 'pnms':
        return this.#skillPhys(frame, 'min');
      case 'pxms':
        return this.#skillPhys(frame, 'max');
    }
    if (MASTERY_CODES.has(code)) return this.#unsupported(`mastery:${code}`);
    if (AMBIGUOUS_MISSILE_CODES.has(code)) return this.#unsupported(`ambiguous:${code}`);
    const missileCode = descMissileCode(code);
    if (missileCode !== null) {
      if (level <= 0) return 0;
      const name = row[`descmissile${String(missileCode.slot)}`];
      const missile = typeof name === 'string' ? this.#source.missile(name) : undefined;
      if (missile === undefined) return this.#unsupported(`descmissile:${code}`);
      return this.#missileCode({ kind: 'missile', row: missile, level, depth: frame.depth + 1 }, missileCode.code);
    }
    return this.#unsupported(`code:${code}`);
  }

  /** `SKILLS_GetMin/MaxElemDamage` (256ths, mastery 0) */
  #skillElem(frame: Frame, which: 'min' | 'max'): number {
    const { row, level } = frame;
    if (level <= 0) return 0;
    const prefix = which === 'min' ? 'EMin' : 'EMax';
    const base =
      this.#num(row, prefix) +
      levelDamageBonus(
        level,
        levColumns(`${prefix}Lev`).map((column) => this.#num(row, column))
      );
    let damage = i32(base << this.#num(row, 'HitShift'));
    if (this.#has(frame, 'EDmgSymPerCalc') && (which === 'max' || damage > 256 || this.#num(row, 'EMinLev1') !== 0)) {
      const bonus = this.#column(frame, 'EDmgSymPerCalc');
      if (bonus !== 0) damage = i32(damage + applyPercent(damage, bonus));
    }
    return damage;
  }

  /** `SKILLS_GetElementalLength` (frames) */
  #skillLength(frame: Frame): number {
    const { row, level } = frame;
    if (level <= 0) return 0;
    let length =
      levelLengthBonus(level, [this.#num(row, 'ELevLen1'), this.#num(row, 'ELevLen2'), this.#num(row, 'ELevLen3')]) +
      this.#num(row, 'ELen');
    if (this.#has(frame, 'ELenSymPerCalc')) {
      const bonus = this.#column(frame, 'ELenSymPerCalc');
      if (bonus !== 0) length = i32(length + applyPercent(length, bonus));
    }
    return length;
  }

  /** `SKILLS_GetMin/MaxPhysDamage` without the weapon (`pnma` = skill only), 256ths */
  #skillPhys(frame: Frame, which: 'min' | 'max'): number {
    const { row, level } = frame;
    if (this.#num(row, 'Kick') !== 0) {
      // Kick skills: the player's strength + dexterity
      const value = Math.max(1, this.#stat('dexterity') + this.#stat('strength') - 20);
      return Math.trunc(value / (which === 'min' ? 4 : 3)) << 8;
    }
    const prefix = which === 'min' ? 'Min' : 'Max';
    let damage =
      this.#num(row, `${prefix}Dam`) +
      levelDamageBonus(
        level,
        levColumns(`${prefix}LevDam`).map((column) => this.#num(row, column))
      );
    if (this.#has(frame, 'DmgSymPerCalc')) {
      const bonus = this.#column(frame, 'DmgSymPerCalc');
      if (bonus !== 0) damage = i32(damage + applyPercent(damage, bonus));
    }
    return i32(damage << this.#num(row, 'HitShift'));
  }

  #missileCode(frame: Frame, code: string): number {
    const { row, level } = frame;
    if (code === 'lvl') return level;
    if (code === 'rang') return this.#column(frame, 'Range');
    const param = MISSILE_PARAMS[code];
    if (param !== undefined) return this.#num(row, param);
    const pair = MISSILE_PAIRS[code];
    if (pair !== undefined) {
      const a = this.#num(row, pair[0]);
      const b = this.#num(row, pair[1]);
      return pair[2] === 'ln' ? i32(a + (level - 1) * b) : diminishing(level, a, b);
    }
    switch (code) {
      case 'edmn':
        return this.#missileDamage(frame, MISSILE_ELEM.min, 'EDmgSymPerCalc') >> 8;
      case 'edmx':
        return this.#missileDamage(frame, MISSILE_ELEM.max, 'EDmgSymPerCalc') >> 8;
      case 'edns':
        return this.#missileDamage(frame, MISSILE_ELEM.min, 'EDmgSymPerCalc');
      case 'edxs':
        return this.#missileDamage(frame, MISSILE_ELEM.max, 'EDmgSymPerCalc');
      case 'damn':
        return this.#missileDamage(frame, MISSILE_PHYS.min, 'DmgSymPerCalc') >> 8;
      case 'damx':
        return this.#missileDamage(frame, MISSILE_PHYS.max, 'DmgSymPerCalc') >> 8;
      case 'dmns':
        return this.#missileDamage(frame, MISSILE_PHYS.min, 'DmgSymPerCalc');
      case 'dmxs':
        return this.#missileDamage(frame, MISSILE_PHYS.max, 'DmgSymPerCalc');
      case 'edln':
        return (
          levelLengthBonus(Math.max(level, 1), [this.#num(row, 'ELevLen1'), this.#num(row, 'ELevLen2'), this.#num(row, 'ELevLen3')]) +
          this.#num(row, 'ELen')
        );
    }
    return this.#unsupported(`missile code:${code}`);
  }

  /** `MISSILE_GetMin/MaxElemDamage` / `MISSILE_GetMin/MaxDamage`: the synergy % applies before the HitShift */
  #missileDamage(frame: Frame, columns: readonly string[], symColumn: string): number {
    const [base = '', ...lev] = columns.slice(0, 6);
    let damage =
      this.#num(frame.row, base) +
      levelDamageBonus(
        frame.level,
        lev.map((column) => this.#num(frame.row, column))
      );
    if (this.#has(frame, symColumn)) {
      const bonus = this.#column(frame, symColumn);
      if (bonus !== 0) damage = i32(damage + applyPercent(damage, bonus));
    }
    return i32(damage << this.#num(frame.row, 'HitShift'));
  }
}

function binary(op: string, a: number, b: number): number {
  switch (op) {
    case '+':
      return i32(a + b);
    case '-':
      return i32(a - b);
    case '*':
      return Math.imul(a, b);
    case '/':
      return b === 0 ? 0 : i32(Math.trunc(a / b));
    case '^': {
      if (b <= 0) return 1;
      let value = a;
      for (let i = 1; i < Math.min(b, 64); i++) value = Math.imul(value, a);
      return value;
    }
    case '<':
      return a < b ? 1 : 0;
    case '>':
      return a > b ? 1 : 0;
    case '<=':
      return a <= b ? 1 : 0;
    case '>=':
      return a >= b ? 1 : 0;
    case '==':
      return a === b ? 1 : 0;
    case '!=':
      return a !== b ? 1 : 0;
    default:
      return 0;
  }
}

// --- static references (bundle building) --------------------------------------------------------------------------

/** Columns of rows the formulas can read, on every branch: row id → column names */
export interface FormulaRefs {
  skills: Map<string, Set<string>>;
  missiles: Map<string, Set<string>>;
}

/**
 * Collects every row and column a formula (a cell of `row`) can read, following formula columns, `skill()` / `miss()` /
 * `sklvl()` targets and descmissiles transitively. Unknown names are skipped (the evaluator reports them).
 */
export function collectFormulaRefs(source: SkillCalcSource, row: SkillCalcRow, text: string, refs: FormulaRefs): void {
  const visited = new Set<string>();
  const add = (kind: 'skill' | 'missile', target: SkillCalcRow, column: string | null) => {
    const map = kind === 'skill' ? refs.skills : refs.missiles;
    let columns = map.get(target.id);
    if (columns === undefined) {
      columns = new Set();
      map.set(target.id, columns);
    }
    if (column !== null) columns.add(column);
  };
  const code = (kind: 'skill' | 'missile', target: SkillCalcRow, name: string) => {
    const key = `${kind}\t${target.id}\t${name}`;
    if (visited.has(key)) return;
    visited.add(key);
    add(kind, target, null);
    const columns = kind === 'skill' ? skillCodeColumns(name) : missileCodeColumns(name);
    if (columns === null) return;
    const formulas = kind === 'skill' ? SKILL_FORMULA_COLUMNS : MISSILE_FORMULA_COLUMNS;
    for (const column of columns) {
      add(kind, target, column);
      const value = target[column];
      if (formulas.has(column) && typeof value === 'string' && value !== '') walk(parseCalc(value), kind, target);
    }
    const missileCode = kind === 'skill' ? descMissileCode(name) : null;
    if (missileCode !== null) {
      const missileName = target[`descmissile${String(missileCode.slot)}`];
      const missile = typeof missileName === 'string' ? source.missile(missileName) : undefined;
      if (missile !== undefined) code('missile', missile, missileCode.code);
    }
  };
  const walk = (node: CalcNode, kind: 'skill' | 'missile', target: SkillCalcRow): void => {
    switch (node.kind) {
      case 'code':
        code(kind, target, node.code);
        return;
      case 'neg':
        walk(node.arg, kind, target);
        return;
      case 'bin':
        walk(node.left, kind, target);
        walk(node.right, kind, target);
        return;
      case 'ternary':
        walk(node.cond, kind, target);
        walk(node.then, kind, target);
        walk(node.else, kind, target);
        return;
      case 'call': {
        const link = node.args[0]?.kind === 'link' ? node.args[0].link : null;
        if (link === null) {
          for (const arg of node.args) walk(arg, kind, target);
          return;
        }
        const [first, second = ''] = link.fields;
        if (node.name === 'miss') {
          const missile = source.missile(link.name);
          if (missile !== undefined) code('missile', missile, first);
          return;
        }
        if (node.name !== 'skill' && node.name !== 'sksrc' && node.name !== 'sklvl') return;
        const other = source.skill(link.name);
        if (other === undefined) return;
        add('skill', other, null);
        if (node.name === 'sklvl') {
          code(kind, target, first);
          if (link.fields.length > 1) code('skill', other, second);
        } else code('skill', other, first);
        return;
      }
      case 'num':
      case 'link':
      case 'error':
        return;
    }
  };
  add('skill', row, null);
  walk(parseCalc(text), 'skill', row);
}

/**
 * The "What if" section of My Character, pure: what changes between the sheet with and without the what-if entries
 * (same difficulty, same buffs), the rows' editing, and the entries' memory per character (sessionStorage, tied to the
 * save like the buffs). The engine part (applying the entries, the picker lists) is sheet/whatIf.ts.
 */
import { EN_NUMBERS, statLabel } from '@/features/builds/utils/statLabels';
import type { CharacterSheet, ResistValue, WhatIfEntries, WhatIfSkill, WhatIfStat } from './sheet/types';
import { WHAT_IF_MAX_LEVEL, WHAT_IF_MAX_VALUE, type WhatIfStatOption } from './sheet/whatIf';
import { formatValue, OVERVIEW_ROW_SPECS, type RowUnit } from './sheetView';

// --- what changes --------------------------------------------------------------------------------------------------

export interface WhatIfChange {
  readonly key: string;
  readonly label: string;
  readonly before: number;
  readonly after: number;
  readonly beforeText: string;
  readonly afterText: string;
  /** "+16,836", "−5%", "+2"; null for a yes / no value */
  readonly deltaText: string | null;
}

export interface WhatIfDiff {
  /** The headline numbers that changed, in the Overview's order */
  readonly numbers: readonly WhatIfChange[];
  /** Skill levels that changed (an +all skills entry changes every skill) */
  readonly skills: readonly WhatIfChange[];
}

function deltaText(delta: number, unit: RowUnit, format: Intl.NumberFormat): string | null {
  if (unit === 'flag') return null;
  const amount = format.format(Math.abs(delta));
  // A reduction shows as "−28%": more of it is a minus
  const sign = unit === 'reduction' ? (delta > 0 ? '−' : '+') : delta > 0 ? '+' : '−';
  return `${sign}${amount}${unit === 'percent' || unit === 'reduction' ? '%' : ''}`;
}

function change(
  key: string,
  label: string,
  before: number,
  after: number,
  unit: RowUnit,
  format: Intl.NumberFormat,
  text: (value: number) => string = (value) => formatValue(value, unit, format)
): WhatIfChange[] {
  if (before === after) return [];
  return [
    { key, label, before, after, beforeText: text(before), afterText: text(after), deltaText: deltaText(after - before, unit, format) },
  ];
}

const RESIST_KEYS = [
  ['fire', 'fr', 'frm'],
  ['cold', 'cr', 'crm'],
  ['lightning', 'lr', 'lrm'],
  ['poison', 'pr', 'prm'],
  ['magic', 'mr', 'mrm'],
  ['physical', 'phr', null],
] as const;

function resistChanges(before: CharacterSheet, after: CharacterSheet, format: Intl.NumberFormat): WhatIfChange[] {
  return RESIST_KEYS.flatMap(([key, labelKey, maxKey]) => {
    const was: ResistValue = before.resists[key];
    const now: ResistValue = after.resists[key];
    const label = `${statLabel(labelKey).label} resistance`;
    const shown = change(`res:${key}`, label, was.value, now.value, 'percent', format);
    // At the cap the shown value stays: the sum above it (a buffer against curses and the penalty) still says something
    const raw = shown.length > 0 ? [] : change(`raw:${key}`, `${label}, sum before the cap`, was.raw, now.raw, 'percent', format);
    const cap = maxKey === null ? [] : change(`cap:${key}`, `${statLabel(maxKey).label} resistance`, was.cap, now.cap, 'percent', format);
    return [...shown, ...raw, ...cap];
  });
}

function attackRatingChanges(before: CharacterSheet, after: CharacterSheet, format: Intl.NumberFormat): WhatIfChange[] {
  const label = statLabel('ar').label;
  if (after.attackRating.hands.length === 0)
    return change('ar:base', `${label} (no skill)`, before.attackRating.base.value, after.attackRating.base.value, 'number', format);
  return after.attackRating.hands.flatMap((hand) => {
    const was = before.attackRating.hands.find((entry) => entry.hand === hand.hand && entry.skillId === hand.skillId);
    if (was === undefined) return [];
    const key = `ar:${hand.hand}:${String(hand.skillId)}`;
    return [
      ...change(key, `${label} (${hand.name})`, was.mainHand, hand.mainHand, 'number', format),
      ...(hand.offHand === null || was.offHand === null
        ? []
        : change(`${key}:off`, `${label} (${hand.name}, off hand)`, was.offHand, hand.offHand, 'number', format)),
    ];
  });
}

/**
 * What the what-if entries change: `before` is the sheet without them, `after` with them (same difficulty, same buffs).
 * Every headline number of the Overview that differs, labelled from the one label table (statLabels.ts) and the
 * Overview's rows, with before, after and the difference; the changed skill levels apart.
 */
export function whatIfChanges(before: CharacterSheet, after: CharacterSheet, format: Intl.NumberFormat = EN_NUMBERS): WhatIfDiff {
  const attributes = (['strength', 'dexterity', 'vitality', 'energy'] as const).flatMap((key, index) => {
    const label = statLabel((['str', 'dex', 'vit', 'ene'] as const)[index]).label;
    return change(key, label, before.attributes[key].value, after.attributes[key].value, 'number', format);
  });
  const pools = [
    ...change('life', statLabel('life').label, before.life.value, after.life.value, 'number', format),
    ...change('mana', statLabel('mana').label, before.mana.value, after.mana.value, 'number', format),
    ...change('stamina', 'Stamina', before.stamina.value, after.stamina.value, 'number', format),
  ];
  const rows = (specs: typeof OVERVIEW_ROW_SPECS) =>
    specs.flatMap((spec) => {
      const was = spec.get(before);
      const now = spec.get(after);
      // Block appears or goes only with a shield, which a what-if entry never adds
      if (was === null || now === null) return [];
      return change(spec.key, spec.label, was.value, now.value, spec.unit, format);
    });
  // The attack rating lines go where the Offense card starts (its first row is the attack rating bonus)
  const offense = OVERVIEW_ROW_SPECS.findIndex((spec) => spec.key === 'arp');
  const numbers = [
    ...attributes,
    ...pools,
    ...resistChanges(before, after, format),
    ...rows(OVERVIEW_ROW_SPECS.slice(0, offense)),
    ...attackRatingChanges(before, after, format),
    ...rows(OVERVIEW_ROW_SPECS.slice(offense)),
  ];
  const skills = after.skills.levels.flatMap((skill) => {
    const was = before.skills.levels.find((entry) => entry.skillId === skill.skillId);
    return change(`skill:${String(skill.skillId)}`, skill.name, was?.level ?? 0, skill.level, 'number', format);
  });
  return { numbers, skills };
}

/** "Defense 73,276 → 90,112 (+16,836)" */
export function changeText(entry: WhatIfChange): string {
  return `${entry.label} ${entry.beforeText} → ${entry.afterText}${entry.deltaText === null ? '' : ` (${entry.deltaText})`}`;
}

/**
 * Why the skill row at `index` is not counted, or null when it is: a lower (or repeated) row of a skill another row
 * gives, then the engine's reason (an item or a buff of the skill at a higher level, a passive, a curse)
 */
export function whatIfSkillProblem(sheet: CharacterSheet, entries: WhatIfEntries, index: number): string | null {
  const rows = entries.skills ?? [];
  const entry = rows.at(index);
  if (entry === undefined || sheet.whatIf === undefined) return null;
  const same = rows.map((row, at) => ({ row, at })).filter(({ row }) => row.skillId === entry.skillId);
  // The first row at the highest level counts (the engine keeps one per skill)
  const best = same.reduce((top, next) => (next.row.level > top.row.level ? next : top));
  if (best.at !== index) return 'another row has this skill at a higher or the same level; only one counts';
  if (sheet.whatIf.skills.some((skill) => skill.skillId === entry.skillId)) return null;
  return sheet.whatIf.skipped.find((skill) => skill.skillId === entry.skillId)?.reason ?? 'not counted';
}

// --- editing -------------------------------------------------------------------------------------------------------

/** A stat value as typed: whole, within ±WHAT_IF_MAX_VALUE; null for an unfinished or invalid text ("", "-", "1.5") */
export function parseWhatIfValue(text: string): number | null {
  if (!/^\s*-?\d+\s*$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && Math.abs(value) <= WHAT_IF_MAX_VALUE ? value : null;
}

export function addWhatIfStat(entries: WhatIfEntries, option: WhatIfStatOption): WhatIfEntries {
  const stat: WhatIfStat =
    option.param === undefined
      ? { stat: option.stat, value: option.initial }
      : { stat: option.stat, param: option.param, value: option.initial };
  return { ...entries, stats: [...(entries.stats ?? []), stat] };
}

/** Replaces the stat entry at `index` (another stat keeps the typed value) */
export function setWhatIfStat(entries: WhatIfEntries, index: number, stat: WhatIfStat): WhatIfEntries {
  return { ...entries, stats: (entries.stats ?? []).map((entry, at) => (at === index ? stat : entry)) };
}

/**
 * Changes the stat of the row at `index`, keeping the typed value; a yes / no stat takes 1, and leaving one starts the
 * new stat at its first value
 */
export function changeWhatIfStat(
  entries: WhatIfEntries,
  index: number,
  option: WhatIfStatOption,
  options: readonly WhatIfStatOption[]
): WhatIfEntries {
  const entry = entries.stats?.[index];
  if (entry === undefined) return entries;
  const wasFlag = options.some((other) => other.stat === entry.stat && other.flag);
  const value = option.flag ? 1 : wasFlag ? option.initial : entry.value;
  const stat: WhatIfStat = option.param === undefined ? { stat: option.stat, value } : { stat: option.stat, param: option.param, value };
  return setWhatIfStat(entries, index, stat);
}

export function removeWhatIfStat(entries: WhatIfEntries, index: number): WhatIfEntries {
  return { ...entries, stats: (entries.stats ?? []).filter((_, at) => at !== index) };
}

/** A skill row starts at level 20 (the Skills page's default) */
export const WHAT_IF_SKILL_LEVEL = 20;

export function addWhatIfSkill(entries: WhatIfEntries, skillId: number): WhatIfEntries {
  return { ...entries, skills: [...(entries.skills ?? []), { skillId, level: WHAT_IF_SKILL_LEVEL }] };
}

export function setWhatIfSkill(entries: WhatIfEntries, index: number, skill: WhatIfSkill): WhatIfEntries {
  const level = Math.max(1, Math.min(WHAT_IF_MAX_LEVEL, Math.floor(skill.level)));
  return { ...entries, skills: (entries.skills ?? []).map((entry, at) => (at === index ? { ...skill, level } : entry)) };
}

export function removeWhatIfSkill(entries: WhatIfEntries, index: number): WhatIfEntries {
  return { ...entries, skills: (entries.skills ?? []).filter((_, at) => at !== index) };
}

export const whatIfCount = (entries: WhatIfEntries): number => (entries.stats?.length ?? 0) + (entries.skills?.length ?? 0);

// --- memory --------------------------------------------------------------------------------------------------------

/** One character's what-if entries, with the save they were made for (`buffMemorySave`) */
export interface WhatIfMemoryEntry {
  readonly save: string;
  readonly entries: WhatIfEntries;
}

/** Rows kept per list: far more than anyone types, small enough that a tampered storage cannot slow the page */
const MAX_ROWS = 40;
const MAX_STAT_NAME = 64;
/** An itemstatcost name or a what-if group (`all-resists`): letters, digits, `_` and `-` */
const STAT_NAME = /^[\w-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function readStats(list: unknown): WhatIfStat[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_ROWS).flatMap((item: unknown): WhatIfStat[] => {
    if (!isRecord(item)) return [];
    const { stat, param, value } = item;
    if (typeof stat !== 'string' || stat.length > MAX_STAT_NAME || !STAT_NAME.test(stat)) return [];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > WHAT_IF_MAX_VALUE) return [];
    if (param === undefined) return [{ stat, value }];
    return typeof param === 'number' && Number.isSafeInteger(param) && param >= 0 ? [{ stat, param, value }] : [];
  });
}

function readSkills(list: unknown): WhatIfSkill[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_ROWS).flatMap((item: unknown): WhatIfSkill[] => {
    if (!isRecord(item)) return [];
    const { skillId, level } = item;
    if (typeof skillId !== 'number' || !Number.isSafeInteger(skillId) || skillId < 0) return [];
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > WHAT_IF_MAX_LEVEL) return [];
    return [{ skillId, level }];
  });
}

/**
 * What-if entries per character name, as kept in sessionStorage; anything malformed is dropped. A Map: a character may
 * be called "constructor" or "toString", which a plain object would answer with Object.prototype's function
 */
export function parseWhatIfMemory(text: string | null): Map<string, WhatIfMemoryEntry> {
  const memory = new Map<string, WhatIfMemoryEntry>();
  if (text === null) return memory;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return memory;
  }
  if (!isRecord(parsed)) return memory;
  for (const [name, entry] of Object.entries(parsed)) {
    if (!isRecord(entry) || typeof entry.save !== 'string' || !isRecord(entry.entries)) continue;
    const stats = readStats(entry.entries.stats);
    const skills = readSkills(entry.entries.skills);
    if (stats.length + skills.length > 0) memory.set(name, { save: entry.save, entries: { stats, skills } });
  }
  return memory;
}

/** The memory as sessionStorage keeps it (characters without an entry left out) */
export function serializeWhatIfMemory(memory: ReadonlyMap<string, WhatIfMemoryEntry>): string {
  const record = Object.create(null) as Record<string, WhatIfMemoryEntry>;
  for (const [name, entry] of memory) if (whatIfCount(entry.entries) > 0) record[name] = entry;
  return JSON.stringify(record);
}

/** The remembered entries of a character, only for the save they were made for */
export function rememberedWhatIf(memory: ReadonlyMap<string, WhatIfMemoryEntry>, name: string, save: string): WhatIfEntries | null {
  const entry = memory.get(name);
  return entry !== undefined && entry.save === save ? entry.entries : null;
}

/** The memory after a change for one character, keeping only the characters still stored */
export function updateWhatIfMemory(
  memory: ReadonlyMap<string, WhatIfMemoryEntry>,
  name: string,
  entry: WhatIfMemoryEntry,
  stored: (name: string) => boolean
): Map<string, WhatIfMemoryEntry> {
  const next = new Map([...memory].filter(([other]) => other !== name && stored(other)));
  if (whatIfCount(entry.entries) > 0) next.set(name, entry);
  return next;
}

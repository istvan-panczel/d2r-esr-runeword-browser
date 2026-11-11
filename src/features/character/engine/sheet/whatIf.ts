/**
 * "What if": stats and skills the user adds on top of the sheet to see what an upgrade would change. Nothing is written
 * to the save; the numbers they change are `unverified` like buffed ones. INFERRED, no ground truth:
 *
 * - A stat counts as if a charm in the Charm Inventory carried it: one contribution (kind `what-if`, label "What if")
 *   through the same path as item stats, so attribute and life percents, per-level stats, caps and the off-hand rules
 *   apply exactly as to an item's stat (no armour or weapon of its own: no item defense, no weapon speed).
 * - A skill counts as if an equipped item gave it as an aura at that level (`item_aura`): its aurastat columns on the
 *   current totals, its passivestat columns on the base values. Allowed for a non-passive skill whose stats reach the
 *   owner (skillEffects.ts `affectsOwner(…, 'cast')`, the test listAvailableBuffs uses), whether or not the character
 *   has it. Apart from the own-aura group, like item auras. One instance per skill: the highest level of the what-if
 *   entries, item auras and buffs of that skill counts.
 *
 * Also the pure lists for the pickers: the stats that can be added (the ones the sheet applies, grouped, labelled as an
 * item tooltip words them) and the skills (every class's, and the item-only auras that change a sheet number).
 */
import type { CharSheetSkill } from '@/features/game-data/engine/schema';
import { affectsOwner } from '@/features/game-data/engine/skillEffects';
import { statLines } from '@/features/stash/engine/items/itemText';
import type { StashStat } from '@/features/stash/parser/types';
import { CLASS_NAMES } from '@/features/skills/utils/skillRefs';
import { consumedStats } from './consumed';
import type { SheetData } from './sheetData';
import { buffStats, type EvalContext } from './skills';
import { fromSaved, type Contribution } from './statMap';
import type { AppliedWhatIf, WhatIfEntries, WhatIfSkill, WhatIfStat } from './types';

/** Stat groups the picker offers that are several stats at once, as an item tooltip folds them ("All Resists +20") */
const STAT_GROUPS: Readonly<Record<string, readonly string[]>> = {
  'all-attributes': ['strength', 'dexterity', 'vitality', 'energy'],
  'all-resists': ['fireresist', 'coldresist', 'lightresist', 'poisonresist'],
  'all-max-resists': ['maxfireresist', 'maxcoldresist', 'maxlightresist', 'maxpoisonresist'],
};

/** Labels for the stats the item text has no description for (a Map: a stored stat name may be "constructor") */
const FALLBACK_LABELS: ReadonlyMap<string, (value: string) => string> = new Map([
  ['skill_staminapercent', (value: string) => `Maximum Stamina +${value}%`],
  ['skill_armor_percent', (value: string) => `+${value}% Defense (as a skill gives it)`],
  // A yes / no stat: the picker row has no number (always 1); a hand-edited 0 or less takes it away
  ['item_ignoretargetac', (value: string) => (Number(value) > 0 ? "Ignore Target's Defense" : "No Ignore Target's Defense (taken away)")],
]);

/** No entry list: the sheet without what-if entries */
export const NO_WHAT_IF: WhatIfEntries = {};

/** The highest level a what-if skill can be given (the buff stepper's) */
export const WHAT_IF_MAX_LEVEL = 99;
/** The largest stat value a what-if entry can carry, either sign */
export const WHAT_IF_MAX_VALUE = 100_000;

const statParam = (entry: Pick<WhatIfStat, 'param'>) => entry.param ?? 0;

/** The stats an entry stands for, in item units (a group is several); null for a stat the data does not know */
export function expandWhatIfStat(data: SheetData, entry: WhatIfStat): StashStat[] | null {
  const names = Object.hasOwn(STAT_GROUPS, entry.stat) ? (STAT_GROUPS[entry.stat] ?? []) : [entry.stat];
  const stats: StashStat[] = [];
  for (const name of names) {
    const id = data.statId(name);
    if (id === undefined) return null;
    stats.push({ id, param: statParam(entry), value: entry.value });
  }
  return stats;
}

/** A stat entry as an item tooltip words it: "+100 to Strength", "All Resists +20", "Increase Maximum Life +30%" */
export function whatIfStatText(data: SheetData, entry: WhatIfStat): string {
  const value = Math.trunc(entry.value);
  const fallback = FALLBACK_LABELS.get(entry.stat);
  if (fallback !== undefined) return fallback(String(value)).replace('+-', '-');
  const stats = expandWhatIfStat(data, { ...entry, value });
  const line = stats === null ? undefined : statLines(stats, data.text).join(', ');
  if (line === undefined || line === '' || line.startsWith('Unknown stat')) return `${entry.stat} ${String(value)}`;
  // "-%d% Target Defense" with a negative value
  return line.replace(/^--/, '+');
}

/** Entries that change something: a known stat with a whole value other than 0, a skill at level 1 or more */
export function hasWhatIf(entries: WhatIfEntries | undefined): boolean {
  return (
    (entries?.stats ?? []).some((entry) => Number.isFinite(entry.value) && Math.trunc(entry.value) !== 0) ||
    (entries?.skills ?? []).some((entry) => Number.isFinite(entry.level) && entry.level >= 1)
  );
}

/**
 * A stable key of the entries (order does not matter: stats add up, a skill counts once at its highest level). JSON of
 * the sorted tuples, so no stat name can make two lists read alike
 */
export function whatIfKey(entries: WhatIfEntries | undefined): string {
  const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const stats = (entries?.stats ?? []).map((entry) => JSON.stringify([entry.stat, statParam(entry), entry.value])).sort(order);
  const skills = (entries?.skills ?? []).map((entry) => JSON.stringify([entry.skillId, entry.level])).sort(order);
  return JSON.stringify([stats, skills]);
}

/**
 * The stat entries as one charm-like contribution (stat-list units), with the entries counted; unknown stats and zero
 * values are left out (an unknown one with a note)
 */
export function whatIfContribution(
  data: SheetData,
  entries: WhatIfEntries,
  notes: string[]
): { contribution: Contribution | null; counted: AppliedWhatIf['stats'] } {
  const saved: StashStat[] = [];
  const counted: AppliedWhatIf['stats'] = [];
  for (const entry of entries.stats ?? []) {
    const value = Math.trunc(entry.value);
    if (!Number.isFinite(value) || value === 0) continue;
    const stats = expandWhatIfStat(data, { ...entry, value });
    if (stats === null) {
      notes.push(`What if: the stat ${entry.stat} is not counted: this app's game data does not know it`);
      continue;
    }
    saved.push(...stats);
    counted.push({ ...entry, value, text: whatIfStatText(data, { ...entry, value }) });
  }
  if (saved.length === 0) return { contribution: null, counted };
  const valShift = (id: number) => data.valShift(id);
  return { contribution: { kind: 'what-if', label: 'What if', stats: fromSaved(saved, valShift, new Set()) }, counted };
}

/** An aura counted like an item's: who gives it, the skill and the level */
export interface AuraGrant {
  owner: Contribution;
  skill: CharSheetSkill;
  level: number;
}

/** A skill the what-if section can count: in the data, not passive, its stats reach the owner */
function whatIfSkillProblem(skill: CharSheetSkill | undefined): string | null {
  if (skill === undefined) return 'the game data has no stats for the skill';
  if (skill.row.passive === 1) return 'it is a passive skill';
  if (!affectsOwner(skill.row, 'cast')) return 'its effects do not reach you';
  return null;
}

/** One entry per skill: the highest level (whole, 1 to the maximum), in the order first given */
export function normalizeWhatIfSkills(skills: readonly WhatIfSkill[]): WhatIfSkill[] {
  const bySkill = new Map<number, number>();
  for (const entry of skills) {
    if (!Number.isFinite(entry.level)) continue;
    const level = Math.min(WHAT_IF_MAX_LEVEL, Math.floor(entry.level));
    if (level < 1) continue;
    bySkill.set(entry.skillId, Math.max(bySkill.get(entry.skillId) ?? 0, level));
  }
  return [...bySkill].map(([skillId, level]) => ({ skillId, level }));
}

/**
 * The item auras with the what-if skills merged in: one per skill, the higher level of an item's and the what-if
 * entry's (notes say which counted). `owner` is the what-if contribution's stand-in (kind `what-if`).
 */
export function withWhatIfAuras(
  data: SheetData,
  auras: readonly AuraGrant[],
  entries: WhatIfEntries,
  notes: string[],
  skipped: AppliedWhatIf['skipped']
): AuraGrant[] {
  const out = [...auras];
  const owner: Contribution = { kind: 'what-if', label: 'What if', stats: new Map() };
  for (const { skillId, level } of normalizeWhatIfSkills(entries.skills ?? [])) {
    const skill = data.skill(skillId);
    const name = data.skillName(skillId);
    const problem = whatIfSkillProblem(skill);
    if (skill === undefined || problem !== null) {
      const reason = problem ?? 'unknown skill';
      notes.push(`What if: ${name} is not counted: ${reason}`);
      skipped.push({ skillId, level, reason });
      continue;
    }
    const at = out.findIndex((aura) => aura.skill.n === skillId);
    const item = at < 0 ? undefined : out[at];
    if (item !== undefined) {
      if (item.level >= level) {
        const reason = `an item already gives it at level ${String(item.level)}, and only one counts`;
        notes.push(`What if: ${name} (level ${String(level)}) is not counted: ${reason}`);
        skipped.push({ skillId, level, reason });
        continue;
      }
      notes.push(
        `What if: ${name} (level ${String(level)}) is counted instead of the item's (level ${String(item.level)}): only one counts`
      );
      out.splice(at, 1);
    }
    out.push({ owner, skill, level });
  }
  return out;
}

// --- picker lists --------------------------------------------------------------------------------------------------

export type WhatIfStatGroup = 'attributes' | 'pools' | 'defense' | 'resists' | 'speed' | 'attack' | 'skills' | 'other';

export const WHAT_IF_GROUP_TITLES: Readonly<Record<WhatIfStatGroup, string>> = {
  attributes: 'Attributes',
  pools: 'Life and mana',
  defense: 'Defense',
  resists: 'Resistances',
  speed: 'Speed',
  attack: 'Attack',
  skills: 'Skills',
  other: 'Other',
};

/**
 * The stats the picker offers, by group, in order. item_addclassskills is for the character's class; after the `skills`
 * group's two come the class's three skill tabs (item_addskill_tab) and each of its skills (item_singleskill)
 */
const STAT_OPTIONS: Readonly<Record<WhatIfStatGroup, readonly string[]>> = {
  attributes: [
    'strength',
    'dexterity',
    'vitality',
    'energy',
    'all-attributes',
    'strengthpercent',
    'dexteritypercent',
    'vitalitypercent',
    'energypercent',
  ],
  pools: [
    'maxhp',
    'item_maxhp_percent',
    'maxmana',
    'item_maxmana_percent',
    'maxstamina',
    'skill_staminapercent',
    'hpregen',
    'manarecoverybonus',
  ],
  defense: [
    'armorclass',
    'armor_override_percent',
    'skill_armor_percent',
    'normal_damage_reduction',
    'magic_damage_reduction',
    'toblock',
    'passive_dodge',
    'passive_avoid',
    'passive_evade',
    'item_absorbfire_percent',
    'item_absorbcold_percent',
    'item_absorblight_percent',
    'item_absorbmagic_percent',
    'item_absorbfire',
    'item_absorbcold',
    'item_absorblight',
    'item_absorbmagic',
  ],
  resists: [
    'all-resists',
    'fireresist',
    'coldresist',
    'lightresist',
    'poisonresist',
    'magicresist',
    'damageresist',
    'all-max-resists',
    'maxfireresist',
    'maxcoldresist',
    'maxlightresist',
    'maxpoisonresist',
    'maxmagicresist',
  ],
  speed: [
    'item_fasterattackrate',
    'item_fastermovevelocity',
    'item_fastergethitrate',
    'item_fasterblockrate',
    'item_fastercastrate',
    'attackrate',
    'velocitypercent',
  ],
  attack: [
    'tohit',
    'item_tohit_percent',
    'item_deadlystrike',
    'item_crushingblow',
    'item_openwounds',
    'item_fractionaltargetac',
    'item_ignoretargetac',
    'lifedrainmindam',
    'manadrainmindam',
  ],
  skills: ['item_allskills', 'item_addclassskills'],
  other: ['item_magicbonus', 'item_goldbonus'],
};

/** Stats that are a count: a new row starts at 1, the others at 10 */
const STARTS_AT_ONE = new Set(['item_allskills', 'item_addclassskills', 'item_addskill_tab', 'item_singleskill']);
/** Yes / no stats: the row has no number, the value is always 1 */
const FLAG_STATS = new Set(['item_ignoretargetac']);

export interface WhatIfStatOption {
  /** `stat` or `stat:param` */
  readonly id: string;
  readonly stat: string;
  readonly param?: number;
  readonly group: WhatIfStatGroup;
  /** The item tooltip's wording with N for the value: "+N to Strength", "All Resists +N" */
  readonly label: string;
  /** The value a new row starts with */
  readonly initial: number;
  /** A yes / no stat: the row has no number input and the value is 1 */
  readonly flag: boolean;
}

/** The id of an entry's option (matches WhatIfStatOption.id) */
export function whatIfStatId(entry: Pick<WhatIfStat, 'stat' | 'param'>): string {
  return entry.param === undefined || entry.param === 0 ? entry.stat : `${entry.stat}:${String(entry.param)}`;
}

/**
 * The class's skill tabs and skills as stats: "+N to Combat Skills (Barbarian Only)", "+N to Frenzy (Barbarian Only)".
 * The tab's param is class × 8 + tab (0 to 2), as an item stores it; a skill bonus counts only for a skill the
 * character has a point in, as on an item (skills.ts)
 */
function classSkillStats(data: SheetData, classId: number): { stat: string; param: number }[] {
  const skills = data.bundle.skills.filter((skill) => skill.cls === classId && skill.tab !== undefined);
  const tabs = [...new Set(skills.map((skill) => skill.tab ?? 0))].sort((a, b) => a - b);
  const byName = [...skills].sort((a, b) => data.skillName(a.n).localeCompare(data.skillName(b.n)) || a.n - b.n);
  return [
    ...tabs.map((tab) => ({ stat: 'item_addskill_tab', param: (classId << 3) | (tab - 1) })),
    ...byName.map((skill) => ({ stat: 'item_singleskill', param: skill.n })),
  ];
}

/**
 * The stats that can be added, grouped, labelled from the item text ("+N to Barbarian Skill Levels" with the class),
 * with the class's skill tabs and single skills in the Skills group
 */
export function listWhatIfStats(data: SheetData, classId: number): WhatIfStatOption[] {
  const sentinel = 98765;
  const options: WhatIfStatOption[] = [];
  for (const [group, names] of Object.entries(STAT_OPTIONS) as [WhatIfStatGroup, readonly string[]][]) {
    const stats: { stat: string; param?: number }[] = names.map((stat) =>
      stat === 'item_addclassskills' ? { stat, param: classId } : { stat }
    );
    if (group === 'skills') stats.push(...classSkillStats(data, classId));
    for (const { stat, param } of stats) {
      const entry = param === undefined ? { stat, value: sentinel } : { stat, param, value: sentinel };
      if (expandWhatIfStat(data, entry) === null) continue;
      const label = whatIfStatText(data, entry).replace(String(sentinel), 'N');
      // A skill or tab the item text cannot name is left out rather than listed as a raw stat name
      if (param !== undefined && label.startsWith(stat)) continue;
      options.push({
        id: whatIfStatId(entry),
        stat,
        ...(param === undefined ? {} : { param }),
        group,
        label,
        initial: STARTS_AT_ONE.has(stat) || FLAG_STATS.has(stat) ? 1 : 10,
        flag: FLAG_STATS.has(stat),
      });
    }
  }
  return options;
}

export interface WhatIfSkillOption {
  readonly skillId: number;
  readonly name: string;
  /** The class of a class skill; null for an item-only aura */
  readonly className: string | null;
  /** skills.txt `aura` 1 */
  readonly aura: boolean;
  /** Changes a number on the sheet at level 20 (Concentration only adds damage, which the sheet does not show) */
  readonly changesSheet: boolean;
}

/** The level the skill list judges a skill at (the Skills page's default) */
const LIST_LEVEL = 20;

const skillLists = new WeakMap<SheetData, WhatIfSkillOption[]>();

/**
 * The skills that can be added: every class's non-passive skills whose stats reach the owner and add, at level 20,
 * something an item tooltip can name (a control stat alone does not count: Fire Bolt's), plus the item-only auras
 * (no class) that change a sheet number. By class (item auras last), then name. Worked out once per SheetData (it
 * evaluates every skill's formulas).
 */
export function listWhatIfSkills(data: SheetData): WhatIfSkillOption[] {
  const known = skillLists.get(data);
  if (known !== undefined) return known;
  const list = skillListOf(data);
  skillLists.set(data, list);
  return list;
}

function skillListOf(data: SheetData): WhatIfSkillOption[] {
  const consumed = consumedStats(data);
  const classOrder = data.bundle.classes.map((entry) => entry.code);
  const options: (WhatIfSkillOption & { order: number })[] = [];
  for (const skill of data.bundle.skills) {
    if (whatIfSkillProblem(skill) !== null) continue;
    const ctx: EvalContext = { charLevel: 1, stats: {}, hardByName: {}, levelByName: {}, unsupported: new Set() };
    let changesSheet = false;
    let named = false;
    for (const [id, inner] of buffStats(data, skill, LIST_LEVEL, 0, ctx)) {
      const amount = [...inner.values()].reduce((sum, value) => sum + value, 0);
      if (amount === 0) continue;
      if (consumed.has(id)) changesSheet = true;
      else if (statLines([{ id, param: 0, value: amount }], data.text).some((line) => line !== '' && !line.startsWith('Unknown stat')))
        named = true;
    }
    const code = skill.cls === undefined ? undefined : classOrder.at(skill.cls);
    if (code === undefined ? !changesSheet || skill.row.aura !== 1 : !changesSheet && !named) continue;
    options.push({
      skillId: skill.n,
      name: data.skillName(skill.n),
      className: code === undefined ? null : CLASS_NAMES[code],
      aura: skill.row.aura === 1,
      changesSheet,
      order: skill.cls ?? classOrder.length,
    });
  }
  return options
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.skillId - b.skillId)
    .map(({ order: _order, ...option }) => option);
}

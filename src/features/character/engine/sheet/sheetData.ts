/**
 * The game data of the computed sheet: charsheet.json plus itemtext.json (saved stat definitions, socket fillers, base
 * requirements, skill display names), with the lookups the engine needs. Build it once per loaded bundle pair.
 */
import type { CharSheetBundle, CharSheetSkill, CharSheetStatOp, ItemTextBundle, SkillCalcRow } from '@/features/game-data/engine/schema';
import { createSource, type SkillCalcSource } from '@/features/game-data/engine/skillCalc/evaluate';
import { createTextData, type TextData } from '@/features/stash/engine/items/textData';

/** The stats the engine reads by name (checked to exist when the data is built) */
const KNOWN_STATS = [
  'strength',
  'energy',
  'dexterity',
  'vitality',
  'statpts',
  'newskills',
  'maxhp',
  'maxmana',
  'maxstamina',
  'level',
  'experience',
  'gold',
  'goldbank',
  'kill_base',
  'relic_of_knowledge',
  'respecpoints',
  'strengthpercent',
  'dexteritypercent',
  'vitalitypercent',
  'energypercent',
  'item_maxhp_percent',
  'item_maxmana_percent',
  'skill_staminapercent',
  'item_allskills',
  'item_addclassskills',
  'item_addskill_tab',
  'item_singleskill',
  'item_nonclassskill',
  'item_aura',
  'armorclass',
  'item_armor_percent',
  'item_armorpercent_perlevel',
  'item_armor_perlevel',
  'skill_armor_percent',
  'armor_override_percent',
  'tohit',
  'item_tohit_percent',
  'item_tohit_perlevel',
  'toblock',
  'item_fasterattackrate',
  'item_fastermovevelocity',
  'item_fastergethitrate',
  'item_fasterblockrate',
  'item_fastercastrate',
  'attackrate',
  'velocitypercent',
  'fireresist',
  'coldresist',
  'lightresist',
  'poisonresist',
  'magicresist',
  'maxfireresist',
  'maxcoldresist',
  'maxlightresist',
  'maxpoisonresist',
  'maxmagicresist',
  'damageresist',
  'normal_damage_reduction',
  'magic_damage_reduction',
  'item_absorbfire_percent',
  'item_absorbcold_percent',
  'item_absorblight_percent',
  'item_absorbmagic_percent',
  'item_absorbfire',
  'item_absorbcold',
  'item_absorblight',
  'item_absorbmagic',
  'passive_dodge',
  'passive_avoid',
  'passive_evade',
  'item_deadlystrike',
  'item_deadlystrike_perlevel',
  'item_crushingblow',
  'item_crushingblow_perlevel',
  'item_openwounds',
  'item_fractionaltargetac',
  'lifedrainmindam',
  'manadrainmindam',
  'hpregen',
  'manarecoverybonus',
  'item_magicbonus',
  'item_goldbonus',
  'item_charged_skill',
] as const;

export type KnownStat = (typeof KNOWN_STATS)[number];

export interface SheetData {
  readonly bundle: CharSheetBundle;
  readonly text: TextData;
  /** Skill formulas (`stat('x'.base)` reads are rewritten to `stat('x__base'.accr)`: the engine supplies the base value there) */
  readonly calc: SkillCalcSource;
  /** Ids of the stats the engine reads by name */
  readonly stat: Readonly<Record<KnownStat, number>>;
  statId(name: string): number | undefined;
  statName(id: number): string;
  valShift(id: number): number;
  op(id: number): CharSheetStatOp | undefined;
  /** op 2 / 4 / 5 stats with base `level` */
  readonly perLevelOps: readonly CharSheetStatOp[];
  skill(id: number): CharSheetSkill | undefined;
  /** Display name (itemtext.json), else the skills.txt name, else "Skill <id>" */
  skillName(id: number): string;
  /**
   * The bundles know the skill: charsheet.json has its row or itemtext.json its name (a skill an item names that gives
   * its owner nothing, e.g. an enemy-only aura, is in itemtext.json only). False for a skill of a newer ESR
   */
  knownSkill(id: number): boolean;
  /** The class skills of a class, by skills.txt row */
  classSkills(cls: number): readonly CharSheetSkill[];
}

/** `stat('x'.base)` → `stat('x__base'.accr)` (the evaluator reads `.base` like `.accr`) */
export const BASE_SUFFIX = '__base';
function rewriteBase(row: SkillCalcRow): SkillCalcRow {
  const out: SkillCalcRow = { id: row.id };
  for (const [column, value] of Object.entries(row)) {
    if (column === 'id') continue;
    out[column] = typeof value === 'string' ? value.replace(/stat\('([^']+)'\.base\)/g, `stat('$1${BASE_SUFFIX}'.accr)`) : value;
  }
  return out;
}

export function createSheetData(bundle: CharSheetBundle, itemText: ItemTextBundle): SheetData {
  const ids = new Map<string, number>();
  bundle.statNames.forEach((name, id) => {
    if (name !== '' && !ids.has(name)) ids.set(name, id);
  });
  const stat = {} as Record<KnownStat, number>;
  for (const name of KNOWN_STATS) {
    const id = ids.get(name);
    if (id === undefined) throw new Error(`charsheet.json has no stat ${name}`);
    stat[name] = id;
  }
  const ops = new Map(bundle.ops.map((op) => [op.id, op]));
  const levelId = stat.level;
  const skills = new Map(bundle.skills.map((skill) => [skill.n, skill]));
  const names = new Map(itemText.skills.map((skill) => [skill.id, skill.name]));
  const byClass = new Map<number, CharSheetSkill[]>();
  for (const skill of bundle.skills) {
    if (skill.cls === undefined) continue;
    const list = byClass.get(skill.cls) ?? [];
    list.push(skill);
    byClass.set(skill.cls, list);
  }
  return {
    bundle,
    text: createTextData(itemText),
    calc: createSource(
      bundle.skills.map((skill) => rewriteBase(skill.row)),
      []
    ),
    stat,
    statId: (name) => ids.get(name),
    statName: (id) => bundle.statNames[id] ?? `stat ${String(id)}`,
    valShift: (id) => bundle.valShift[String(id)] ?? 0,
    op: (id) => ops.get(id),
    perLevelOps: bundle.ops.filter((op) => (op.op === 2 || op.op === 4 || op.op === 5) && op.base === levelId),
    skill: (id) => skills.get(id),
    skillName: (id) => names.get(id) ?? skills.get(id)?.row.id ?? `Skill ${String(id)}`,
    knownSkill: (id) => skills.has(id) || names.has(id),
    classSkills: (cls) => byClass.get(cls) ?? [],
  };
}

/**
 * The loaded itemtext.json as the stat renderer (game-data/engine/stats) needs it, and the adapter from saved stats
 * (`StashStat`: id, packed param, raw value) to the renderer's stat entries. Internal to itemText.ts / statValues.ts.
 *
 * Saved stats differ from the generator's property entries (game-data/build/stats/expandProperty.ts):
 *
 * - event skills (descfunc 15): param `skill << 6 | level` (the full saved param: skill ids go above 1023, Long
 *   Shot 1555), value = chance → entry { param: skill, min: chance, max: level }
 * - charges (descfunc 24): param `skill << 6 | level`, value `max << 8 | charges` → a pre-rendered "(charges/max Charges)"
 *   line (the renderer writes charges/charges for game data)
 * - skill tabs (descfunc 14): param `class << 3 | tab` → the properties.txt tab number `class * 3 + tab`
 * - class skills (13), oskills / single skills (27, 28), auras (16), monster types (22), monster texts (23): the param
 *   is the id the renderer looks up
 * - values are raw: the save stores the unshifted value (ValShift is not applied), per-level stats keep their
 *   `2^op param` fraction (the renderer divides)
 * - `coldlength` is left out: the tooltip writes "Adds 10-20 Cold Damage" without the duration (the generator's docs
 *   style appends one)
 * - `secondary_mindamage` / `secondary_maxdamage` (two-hand damage): a two-hander stores its + min / max damage
 *   there instead of in `mindamage` / `maxdamage`; a list with both stores the same property twice. `foldSecondary`
 *   turns the secondary stat into the primary one when the list lacks it and drops it otherwise, per stat list, so a
 *   socketed jewel's `maxdamage` adds up with a two-hander's `secondary_maxdamage`
 */
import type { ItemTextBundle } from '@/features/game-data/engine/schema';
import { sprintf } from '@/features/game-data/engine/stats/sprintf';
import type { RenderContext } from '@/features/game-data/engine/stats/renderLines';
import type { ClassText, SkillInfo, SkillLookup, StatDef, StatEntry } from '@/features/game-data/engine/stats/types';
import type { StashStat } from '../../parser/types';

export interface TextData {
  readonly bundle: ItemTextBundle;
  /** By stat id; undefined for a stat a save cannot hold */
  readonly defs: readonly (StatDef | undefined)[];
  readonly ids: ReadonlyMap<string, number>;
  readonly render: RenderContext;
  /** The same tables with placeholder skill / class / monster type names, for the param-free stat labels */
  readonly placeholder: RenderContext;
  /** dgrp sets (dgrpfunc 19) by their group key: the member stat ids */
  readonly dgrpSets: readonly { readonly name: string; readonly def: StatDef; readonly members: readonly number[] }[];
}

const DEFAULT_DEF: Omit<StatDef, 'stat'> = {
  op: 0,
  opParam: 0,
  descpriority: 0,
  descfunc: 0,
  descval: 0,
  descstrpos: '',
  descstrneg: '',
  descstr2: '',
  dgrp: 0,
  dgrpfunc: 0,
  dgrpval: 0,
  dgrpstrpos: '',
  dgrpstrneg: '',
  dgrpstr2: '',
};

/** Stat ids the adapter treats specially (itemstatcost.txt rows, the same in vanilla and ESR) */
export const STAT_ID = {
  strength: 0,
  energy: 1,
  dexterity: 2,
  vitality: 3,
  armorPercent: 16,
  maxDamagePercent: 17,
  minDamagePercent: 18,
  minDamage: 21,
  maxDamage: 22,
  secondaryMinDamage: 23,
  secondaryMaxDamage: 24,
  armorClass: 31,
  coldLength: 56,
} as const;

/** dgrp sets named for the stat filters; the others are named by their dgrpstrpos key */
const DGRP_NAMES: Readonly<Record<string, string>> = { strModAllResistances: 'allres', Moditem2allattrib: 'allattr' };

function skillLookup(bundle: ItemTextBundle): SkillLookup {
  const skills = new Map<number, SkillInfo>(bundle.skills.map((skill) => [skill.id, { name: skill.name, cls: skill.cls ?? null }]));
  const classByCode = new Map(bundle.classes.map((cls, index) => [cls.name.slice(0, 3).toLowerCase(), index]));
  const skillId = (param: string) => (/^\d+$/.test(param) && skills.has(Number(param)) ? Number(param) : null);
  return {
    skill: (param) => {
      const id = skillId(param);
      return id === null ? null : (skills.get(id) ?? null);
    },
    skillId,
    classText: (index) => bundle.classes.at(index) ?? null,
    classIndex: (code) => classByCode.get(code) ?? null,
  };
}

/** Placeholder names for the param-free labels: "+# to [Skill] ([Class] Only)", "+# to [Class] Skill Levels" */
function placeholderSkills(bundle: ItemTextBundle): SkillLookup {
  const first = bundle.classes.at(0);
  const swap = (text: string) => (first === undefined ? text : text.replace(first.name, '[Class]'));
  const cls: ClassText = {
    name: '[Class]',
    allSkills: first === undefined ? '%+d to [Class] Skill Levels' : swap(first.allSkills),
    tabs: ['%+d to [Skill Tab]', '%+d to [Skill Tab]', '%+d to [Skill Tab]'],
    only: first === undefined ? '([Class] Only)' : swap(first.only),
  };
  return {
    skill: () => ({ name: '[Skill]', cls: 0 }),
    skillId: () => null,
    classText: () => cls,
    classIndex: () => 0,
  };
}

export function createTextData(bundle: ItemTextBundle): TextData {
  const defs = bundle.stats.map((def) => (def === null ? undefined : { ...DEFAULT_DEF, ...def }));
  const ids = new Map<string, number>();
  const byName = new Map<string, StatDef>();
  defs.forEach((def, id) => {
    if (def === undefined || ids.has(def.stat)) return;
    ids.set(def.stat, id);
    byName.set(def.stat, def);
  });
  const strings = new Map(Object.entries(bundle.strings));
  const monsterNames = bundle.monsters.map((name) => name ?? '');
  const monTypeNames = bundle.monTypes.map((name) => name ?? '');
  const render: RenderContext = { strings, skills: skillLookup(bundle), stats: byName, monsterNames, monTypeNames };
  const placeholder: RenderContext = {
    ...render,
    skills: placeholderSkills(bundle),
    monsterNames: [],
    monTypeNames: [],
  };

  const sets = new Map<string, { name: string; def: StatDef; members: number[] }>();
  defs.forEach((def, id) => {
    if (def === undefined || def.dgrp === 0 || def.dgrpfunc !== 19) return;
    const key = `${String(def.dgrp)}|${def.dgrpstrpos}`;
    const set = sets.get(key);
    // URL-safe: the page encodes stat filters as `key_op_value`
    const name = (DGRP_NAMES[def.dgrpstrpos] ?? def.dgrpstrpos).replace(/[^A-Za-z0-9-]/g, '-');
    if (set === undefined) sets.set(key, { name, def, members: [id] });
    else set.members.push(id);
  });

  return { bundle, defs, ids, render, placeholder, dgrpSets: [...sets.values()].filter((set) => set.members.length > 1) };
}

/**
 * The layer of a saved param: its low 16 bits. ESR saves 32-bit params, and random class skills (`randclassskill`,
 * property func 12) leave other bits above the skill id (`item_singleskill` 0x277C0164 = skill 356); the engine keys a
 * stat by a 16-bit layer (`layer << 16 | stat id`, engine/statLayers.ts).
 */
export function layerOf(param: number): number {
  return param & 0xffff;
}

/**
 * Event / charged param (`skill << 6 | level`) → skill id + level, from the full saved param: ESR saves skill ids above
 * 1023 (Delirium's `item_skillonattack_hidden` 0x18541 = Delirium Proc 1557, level 1), which do not fit a 16-bit layer
 */
export function skillLevel(param: number): { skill: number; level: number } {
  return { skill: param >>> 6, level: param & 63 };
}

/** One stat list with `secondary_mindamage` / `maxdamage` folded into `mindamage` / `maxdamage` (see the header) */
export function foldSecondary(stats: readonly StashStat[]): StashStat[] {
  const present = new Set(stats.map((stat) => stat.id));
  const primary = new Map<number, number>([
    [STAT_ID.secondaryMinDamage, STAT_ID.minDamage],
    [STAT_ID.secondaryMaxDamage, STAT_ID.maxDamage],
  ]);
  return stats.flatMap((stat) => {
    const id = primary.get(stat.id);
    if (id === undefined) return [stat];
    return present.has(id) ? [] : [{ ...stat, id }];
  });
}

/** Saved skill tab param (`class << 3 | tab`) → the properties.txt tab number the renderer reads (`class * 3 + tab`) */
export function tabNumber(param: number): number {
  const layer = layerOf(param);
  return (layer >> 3) * 3 + (layer & 7);
}

/** The text of an unknown stat (a stat itemtext.json does not have): kept visible so a gap shows */
export function unknownStatText(stat: StashStat): string {
  return `Unknown stat ${String(stat.id)}${stat.param === 0 ? '' : ` (${String(stat.param)})`}: ${String(stat.value)}`;
}

/** The "Level 5 Teleport (8/10 Charges)" line of a charged skill */
export function chargesText(stat: StashStat, def: StatDef, data: TextData): string {
  const { skill, level } = skillLevel(stat.param);
  const name = data.render.skills.skill(String(skill))?.name ?? String(skill);
  const format = data.render.strings.get(def.descstrpos) ?? 'Level %d %s (%d/%d Charges)';
  return sprintf(format, [level, name, stat.value & 0xff, stat.value >> 8]);
}

/**
 * Saved stats → renderer entries. `unknown` collects the stats itemtext.json does not know (rendered as
 * `unknownStatText`).
 */
export function toEntries(stats: readonly StashStat[], data: TextData): StatEntry[] {
  const entries: StatEntry[] = [];
  for (const stat of foldSecondary(stats)) {
    const def = data.defs[stat.id];
    if (def === undefined) {
      entries.push({ stat: '', param: '', min: 0, max: 0, text: unknownStatText(stat) });
      continue;
    }
    if (stat.id === STAT_ID.coldLength) continue;
    switch (def.descfunc) {
      case 15: {
        const { skill, level } = skillLevel(stat.param);
        entries.push({ stat: def.stat, param: String(skill), min: stat.value, max: level });
        break;
      }
      case 24:
        entries.push({ stat: def.stat, param: String(stat.param), min: 0, max: 0, text: chargesText(stat, def, data) });
        break;
      case 14:
        entries.push({ stat: def.stat, param: String(tabNumber(stat.param)), min: stat.value, max: stat.value });
        break;
      default:
        entries.push({ stat: def.stat, param: stat.param === 0 ? '' : String(layerOf(stat.param)), min: stat.value, max: stat.value });
    }
  }
  return entries;
}

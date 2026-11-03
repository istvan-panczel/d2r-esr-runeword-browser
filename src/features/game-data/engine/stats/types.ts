/**
 * Types of the stat renderer (descfunc.ts, renderLines.ts): shared by the generator (game-data/build/stats, which
 * expands properties into stat entries) and the browser (the stash item text, which reads saved stats).
 */

/** An itemstatcost.txt row's display columns */
export interface StatDef {
  stat: string;
  op: number;
  opParam: number;
  descpriority: number;
  descfunc: number;
  descval: number;
  descstrpos: string;
  descstrneg: string;
  descstr2: string;
  dgrp: number;
  dgrpfunc: number;
  dgrpval: number;
  dgrpstrpos: string;
  dgrpstrneg: string;
  dgrpstr2: string;
}

/**
 * One stat produced by a property. `min`/`max` is the value range, except for event skills (min = chance,
 * max = level) and charges (min = charges, max = level). `text` entries are pre-rendered (sockets, random skill,
 * fallbacks); their sort priority comes from `stat` when it exists in itemstatcost.
 */
export interface StatEntry {
  stat: string;
  param: string;
  min: number;
  max: number;
  text?: string;
}

export interface SkillInfo {
  name: string;
  /** charstats row index of the owning class, null for non-class skills */
  cls: number | null;
}

export interface ClassText {
  name: string;
  /** "%+d to Amazon Skill Levels" */
  allSkills: string;
  /** "%+d to Bow and Crossbow Skills", … in StrSkillTab1-3 order */
  tabs: [string, string, string];
  /** "(Amazon Only)" */
  only: string;
}

export interface SkillLookup {
  skill(param: string): SkillInfo | null;
  /** skills.txt row index (= `*Id`) of a skill name or numeric id param; null when no row matches */
  skillId(param: string): number | null;
  classText(index: number): ClassText | null;
  classIndex(code: string): number | null;
}

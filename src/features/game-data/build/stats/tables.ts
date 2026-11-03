/**
 * Typed rows of the tables the stat renderer reads: properties, itemstatcost, propertygroups, skills, skilldesc,
 * charstats (string keys), monstats and montype. Row index = game id (Expansion marker rows are already dropped).
 */
import type { StatDef } from '../../engine/stats/types.ts';
import type { TsvTable } from '../tsv.ts';

export type { StatDef };

export interface PropertySlot {
  func: number;
  /** itemstatcost `Stat`; '' for funcs that pick their own stats (5/6/7 damage, 20 indestructible, …) */
  stat: string;
  set: number;
  val: number;
}

export interface PropertyDef {
  code: string;
  slots: PropertySlot[];
}

export interface PropertyGroupEntry {
  prop: string;
  parMin: string;
  parMax: string;
  modMin: number;
  modMax: number;
  chance: number;
}

export interface PropertyGroupDef {
  code: string;
  pickMode: number;
  entries: PropertyGroupEntry[];
}

export interface SkillRow {
  name: string;
  charclass: string;
  skilldesc: string;
}

export interface ClassStringsRow {
  /** Class display name column ("Amazon") */
  name: string;
  allSkillsKey: string;
  tabKeys: [string, string, string];
  classOnlyKey: string;
}

export interface StatTables {
  properties: ReadonlyMap<string, PropertyDef>;
  stats: ReadonlyMap<string, StatDef>;
  groups: ReadonlyMap<string, PropertyGroupDef>;
  /** skills.txt in row order (row index = skill id) */
  skills: readonly SkillRow[];
  /** skilldesc key → `str name` string key */
  skillDescNames: ReadonlyMap<string, string>;
  /** charstats.txt in row order (row index = class id 0-7) */
  classes: readonly ClassStringsRow[];
  /** monstats.txt NameStr per row (row index = monster id) */
  monsterNames: readonly string[];
  /** montype.txt strplur per row (row index = montype id) */
  monTypeNames: readonly string[];
}

export function readProperties(table: TsvTable): Map<string, PropertyDef> {
  const result = new Map<string, PropertyDef>();
  for (const row of table.rows) {
    const code = row.str('code');
    if (code === '' || result.has(code)) continue;
    const slots: PropertySlot[] = [];
    for (let i = 1; i <= 7; i++) {
      const func = row.num(`func${String(i)}`);
      if (func === 0) continue;
      slots.push({ func, stat: row.str(`stat${String(i)}`), set: row.num(`set${String(i)}`), val: row.num(`val${String(i)}`) });
    }
    result.set(code, { code, slots });
  }
  return result;
}

export function readStats(table: TsvTable): Map<string, StatDef> {
  const result = new Map<string, StatDef>();
  for (const row of table.rows) {
    const stat = row.str('Stat');
    if (stat === '' || result.has(stat)) continue;
    result.set(stat, {
      stat,
      op: row.num('op'),
      opParam: row.num('op param'),
      descpriority: row.num('descpriority'),
      descfunc: row.num('descfunc'),
      descval: row.num('descval'),
      descstrpos: row.str('descstrpos'),
      descstrneg: row.str('descstrneg'),
      descstr2: row.str('descstr2'),
      dgrp: row.num('dgrp'),
      dgrpfunc: row.num('dgrpfunc'),
      dgrpval: row.num('dgrpval'),
      dgrpstrpos: row.str('dgrpstrpos'),
      dgrpstrneg: row.str('dgrpstrneg'),
      dgrpstr2: row.str('dgrpstr2'),
    });
  }
  return result;
}

export function readPropertyGroups(table: TsvTable): Map<string, PropertyGroupDef> {
  const result = new Map<string, PropertyGroupDef>();
  for (const row of table.rows) {
    const code = row.str('code');
    if (code === '' || result.has(code)) continue;
    const entries: PropertyGroupEntry[] = [];
    for (let i = 1; i <= 8; i++) {
      const n = String(i);
      const prop = row.str(`Prop${n}`);
      if (prop === '') continue;
      entries.push({
        prop,
        parMin: row.str(`ParMin${n}`),
        parMax: row.str(`ParMax${n}`),
        modMin: row.num(`ModMin${n}`),
        modMax: row.num(`ModMax${n}`),
        chance: row.num(`Chance${n}`),
      });
    }
    result.set(code, { code, pickMode: row.num('PickMode'), entries });
  }
  return result;
}

export function readSkills(table: TsvTable): SkillRow[] {
  return table.rows.map((row) => ({ name: row.str('skill'), charclass: row.str('charclass'), skilldesc: row.str('skilldesc') }));
}

export function readSkillDescNames(table: TsvTable): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of table.rows) {
    const key = row.str('skilldesc');
    if (key !== '' && !result.has(key)) result.set(key, row.str('str name'));
  }
  return result;
}

export function readClassStrings(table: TsvTable): ClassStringsRow[] {
  return table.rows.map((row) => ({
    name: row.str('class'),
    allSkillsKey: row.str('StrAllSkills'),
    tabKeys: [row.str('StrSkillTab1'), row.str('StrSkillTab2'), row.str('StrSkillTab3')],
    classOnlyKey: row.str('StrClassOnly'),
  }));
}

export function readColumn(table: TsvTable, column: string): string[] {
  return table.rows.map((row) => row.str(column));
}

/**
 * Skill and class lookups for the stat renderer.
 *
 * - Skill params are skill NAMES (`skills.txt` `skill` column) in affixes and runewords, numeric ids (row index) in
 *   propertygroups. Display name = skilldesc `str name` → strings, falling back to the `skill` column.
 * - Classes are the charstats.txt rows in order (0 Amazon … 7 Warlock); class code = first three letters, lowercased.
 */
import type { StatTables } from './tables.ts';

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

export function classCodeOf(name: string): string {
  return name.slice(0, 3).toLowerCase();
}

export function createSkillLookup(tables: StatTables, strings: ReadonlyMap<string, string>): SkillLookup {
  const text = (key: string) => strings.get(key) ?? key;
  const classByCode = new Map<string, number>();
  tables.classes.forEach((row, i) => classByCode.set(classCodeOf(row.name), i));

  const byName = new Map<string, number>();
  const byLowerName = new Map<string, number>();
  tables.skills.forEach((row, i) => {
    if (!byName.has(row.name)) byName.set(row.name, i);
    if (!byLowerName.has(row.name.toLowerCase())) byLowerName.set(row.name.toLowerCase(), i);
  });

  const skillId = (param: string): number | null => {
    const index = /^\d+$/.test(param) ? Number(param) : (byName.get(param) ?? byLowerName.get(param.toLowerCase()));
    return index !== undefined && index < tables.skills.length ? index : null;
  };

  const cache = new Map<string, SkillInfo | null>();
  const skill = (param: string): SkillInfo | null => {
    const cached = cache.get(param);
    if (cached !== undefined) return cached;
    const index = skillId(param);
    const row = index === null ? undefined : tables.skills.at(index);
    let info: SkillInfo | null = null;
    if (row !== undefined) {
      const nameKey = tables.skillDescNames.get(row.skilldesc);
      const name = nameKey === undefined || nameKey === '' ? undefined : strings.get(nameKey);
      info = { name: name ?? row.name, cls: classByCode.get(row.charclass) ?? null };
    }
    cache.set(param, info);
    return info;
  };

  const classText = (index: number): ClassText | null => {
    const row = tables.classes.at(index);
    if (row === undefined) return null;
    return {
      name: row.name,
      allSkills: text(row.allSkillsKey),
      tabs: [text(row.tabKeys[0]), text(row.tabKeys[1]), text(row.tabKeys[2])],
      only: text(row.classOnlyKey),
    };
  };

  return { skill, skillId, classText, classIndex: (code) => classByCode.get(code) ?? null };
}

/**
 * skills.json: the class skill trees for the builds feature's skill allocation.
 *
 * - Skills: skills.txt rows whose `charclass` is a class of types.json, placed by their skilldesc.txt row
 *   (`SkillPage` 1..3 = tab, `SkillRow`, `SkillColumn`); the name is skilldesc `str name` from the strings table.
 * - Tabs: the class tab names of types.json (charstats.txt StrSkillTab1..3, "+%d to " already stripped), without the
 *   trailing " Skills" ("Demon Skills" → "Demon"; "Curses" stays).
 * - Character level cap: experience.txt `MaxLvl` row.
 * - Skipped: class skills without a skilldesc row or with page 0 (warned; ESR has none).
 * See docs/features/GAME-DATA.md "Skills".
 */
import type { ClassInfo, SkillClassTree, SkillInfo, SkillsBundle } from '../engine/schema.ts';
import { resolveName } from './itemNames.ts';
import type { TsvTable } from './tsv.ts';

const TAB_SUFFIX = / Skills$/;
const PAGES = [1, 2, 3] as const;
/** Level cap when experience.txt has no MaxLvl row (the vanilla value) */
const DEFAULT_MAX_LEVEL = 99;

export interface SkillsInput {
  skills: TsvTable;
  skilldesc: TsvTable;
  experience: TsvTable;
  classes: readonly Pick<ClassInfo, 'code' | 'name' | 'tabs'>[];
  strings: ReadonlyMap<string, string>;
}

export interface SkillsBuildResult {
  bundle: SkillsBundle;
  /** Class skills left out (no skilldesc row or no tab page) */
  skipped: number;
  warnings: string[];
}

interface Placed extends SkillInfo {
  page: number;
}

function tabName(text: string): string {
  return text.replace(TAB_SUFFIX, '').trim();
}

function readMaxLevel(input: SkillsInput, warnings: string[]): number {
  const row = input.experience.rows.find((entry) => entry.str('Level') === 'MaxLvl');
  if (row === undefined) {
    warnings.push(`skills: experience.txt has no MaxLvl row; level cap ${String(DEFAULT_MAX_LEVEL)} assumed`);
    return DEFAULT_MAX_LEVEL;
  }
  const levels = input.classes.filter((cls) => row.has(cls.name)).map((cls) => row.num(cls.name));
  const max = levels.length === 0 ? DEFAULT_MAX_LEVEL : Math.max(...levels);
  if (levels.length !== input.classes.length || levels.some((level) => level !== max)) {
    warnings.push(`skills: experience.txt MaxLvl differs between classes (${levels.join(', ')}); ${String(max)} used`);
  }
  return max;
}

export function buildSkillsBundle(input: SkillsInput): SkillsBuildResult {
  const warnings: string[] = [];
  const descs = new Map<string, { page: number; row: number; col: number; nameKey: string }>();
  for (const row of input.skilldesc.rows) {
    const id = row.str('skilldesc');
    if (id === '' || descs.has(id)) continue;
    descs.set(id, { page: row.num('SkillPage'), row: row.num('SkillRow'), col: row.num('SkillColumn'), nameKey: row.str('str name') });
  }

  const classCodes = new Set<string>(input.classes.map((cls) => cls.code));
  const byClass = new Map<string, Placed[]>();
  let skipped = 0;
  for (const row of input.skills.rows) {
    const cls = row.str('charclass');
    const id = row.str('skill');
    if (id === '' || !classCodes.has(cls)) continue;
    const descKey = row.str('skilldesc');
    const desc = descs.get(descKey);
    if (desc === undefined || !PAGES.some((page) => page === desc.page)) {
      warnings.push(
        desc === undefined
          ? `skills: ${cls} skill "${id}" has no skilldesc row "${descKey}"`
          : `skills: ${cls} skill "${id}" has skill page ${String(desc.page)}`
      );
      skipped++;
      continue;
    }
    const name = resolveName(input.strings, desc.nameKey, id);
    if (!input.strings.has(desc.nameKey)) warnings.push(`skills: ${cls} skill "${id}" name "${desc.nameKey}" not in the strings`);
    const skill: Placed = {
      id,
      name,
      row: desc.row,
      col: desc.col,
      reqLevel: row.num('reqlevel'),
      maxLevel: row.num('maxlvl'),
      reqSkills: [row.str('reqskill1'), row.str('reqskill2'), row.str('reqskill3')].filter((req) => req !== ''),
      page: desc.page,
    };
    byClass.set(cls, [...(byClass.get(cls) ?? []), skill]);
  }

  const classes: SkillClassTree[] = input.classes.map((cls) => {
    const skills = byClass.get(cls.code) ?? [];
    const ids = new Set(skills.map((skill) => skill.id));
    const cells = new Map<string, string>();
    for (const skill of skills) {
      for (const req of skill.reqSkills) {
        if (!ids.has(req)) warnings.push(`skills: ${cls.code} skill "${skill.id}" requires unknown skill "${req}"`);
      }
      const cell = `${String(skill.page)}/${String(skill.row)}/${String(skill.col)}`;
      const other = cells.get(cell);
      if (other !== undefined) warnings.push(`skills: ${cls.code} skills "${other}" and "${skill.id}" share tab ${cell} (page/row/column)`);
      else cells.set(cell, skill.id);
    }
    return {
      code: cls.code,
      name: cls.name,
      tabs: PAGES.map((page) => {
        const raw = cls.tabs[page - 1] ?? '';
        if (raw === '') warnings.push(`skills: ${cls.code} has no name for skill tab ${String(page)}`);
        return {
          page,
          name: raw === '' ? `Tab ${String(page)}` : tabName(raw),
          skills: skills
            .filter((skill) => skill.page === page)
            .sort((a, b) => a.row - b.row || a.col - b.col)
            .map((skill): SkillInfo => ({
              id: skill.id,
              name: skill.name,
              row: skill.row,
              col: skill.col,
              reqLevel: skill.reqLevel,
              maxLevel: skill.maxLevel,
              reqSkills: skill.reqSkills,
            })),
        };
      }),
    };
  });

  return { bundle: { maxLevel: readMaxLevel(input, warnings), classes }, skipped, warnings };
}

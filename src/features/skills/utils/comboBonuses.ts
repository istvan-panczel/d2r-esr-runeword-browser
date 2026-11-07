import type { SkillComboBonus, SkillComboSkill } from '@/features/game-data/engine/schema';

/** A piece of a combo condition: plain text or one of the skills it names */
export type ComboSegment =
  { readonly text: string; readonly skill?: undefined } | { readonly text: string; readonly skill: SkillComboSkill };

/**
 * The condition split around the skill names it holds, in order ("If both ", Splintering Javelin, " and ", Eagle Eye,
 * " have 20 levels"), so the names can be links. A name the condition does not contain stays out.
 */
export function comboSegments(combo: Pick<SkillComboBonus, 'condition' | 'skills'>): ComboSegment[] {
  const segments: ComboSegment[] = [];
  let rest = combo.condition;
  for (const skill of combo.skills) {
    const at = rest.indexOf(skill.name);
    if (at === -1) continue;
    if (at > 0) segments.push({ text: rest.slice(0, at) });
    segments.push({ text: skill.name, skill });
    rest = rest.slice(at + skill.name.length);
  }
  if (rest !== '') segments.push({ text: rest });
  return segments;
}

export interface ComboSkillPoints {
  readonly name: string;
  /** The build's hard points in the skill; null when the name is not one skill ("All Elemental Armors") */
  readonly points: number | null;
}

export interface ComboStatus {
  /** active: every named skill has the level in hard points; unknown: a name is not one skill, so it is not checked */
  readonly state: 'active' | 'inactive' | 'unknown';
  readonly skills: readonly ComboSkillPoints[];
}

/** Whether a build reaches a combo bonus: ESR tests the skills' hard points (blvl), so +skills from items do not count */
export function comboStatus(combo: Pick<SkillComboBonus, 'skills' | 'level'>, pointsOf: (id: string) => number): ComboStatus {
  const skills = combo.skills.map((skill) => ({ name: skill.name, points: skill.id === undefined ? null : pointsOf(skill.id) }));
  const state = skills.some((skill) => skill.points === null)
    ? 'unknown'
    : skills.every((skill) => (skill.points ?? 0) >= combo.level)
      ? 'active'
      : 'inactive';
  return { state, skills };
}

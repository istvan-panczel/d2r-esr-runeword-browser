/**
 * Shape-shift forms and the skills they allow. A shape-shifted character (Werewolf, Werebear, Elemental Form, from its
 * own skill or an item that gives it) can use only the skills made for that form and the ones allowed in every form.
 * skills.txt says which: `restrict` blank = usable unshifted only, 1 = usable in any form, 2 = usable only in the forms
 * named by `State1-3` (a shape-shift's own state is its `aurastate`: wolf, bear, elementalform). The owner confirmed the
 * rule for ESR (2026-11-11); the numbers are still from the game files only.
 *
 * What the sheet does with it:
 * - A skill of a form (Feral Rage, Maul, Primal Savagery) counts as a buff only while one of its forms is on.
 * - A skill for the unshifted character that works while attacking with it (Frenzy's charges, Whirlwind's dodge) does
 *   not count while a form is on.
 * - A skill for the unshifted character that is cast and lasts (Holy Armor) still counts with a form: INFERRED, it
 *   was cast before changing form and the form does not end it.
 * - A proc is cast by the item, not the character: no form rule.
 */
import type { SkillCalcRow } from '@/features/game-data/engine/schema';
import { attacksWithWeapon } from './otherSet';
import type { SheetData } from './sheetData';

/** The form a character is in: the shape-shift skill and its states.txt state */
export interface Form {
  readonly skillId: number;
  /** The skill's name: "Werewolf" */
  readonly name: string;
  /** states.txt state: "wolf" */
  readonly state: string;
}

/** The form a shape-shift skill gives; null for any other skill */
export function formOf(data: SheetData, skillId: number): Form | null {
  const skill = data.skill(skillId);
  const state = skill?.row.aurastate;
  return skill?.shapeshift === true && typeof state === 'string' ? { skillId, name: data.skillName(skillId), state } : null;
}

/** The states a form-only skill (`restrict` 2) works in */
function formStates(row: SkillCalcRow): string[] {
  return [row.State1, row.State2, row.State3].filter((state): state is string => typeof state === 'string');
}

const orList = (names: readonly string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names.at(-1) ?? ''}`;

/** "Werewolf or Werebear": the shape-shifts a form-only skill needs one of; null for a skill without that rule */
export function formsNeeded(data: SheetData, skillId: number): string | null {
  const row = data.skill(skillId)?.row;
  if (row?.restrict !== 2) return null;
  const states = formStates(row);
  const names = data.bundle.skills
    .filter((skill) => skill.shapeshift === true && typeof skill.row.aurastate === 'string' && states.includes(skill.row.aurastate))
    .map((skill) => data.skillName(skill.n));
  return names.length > 0 ? orList([...new Set(names)]) : 'a shape-shifted';
}

/** A skill for the unshifted character that works only while attacking with it (off while a form is on) */
export function unshiftedAttack(data: SheetData, skillId: number): boolean {
  const row = data.skill(skillId)?.row;
  return row !== undefined && row.restrict === undefined && row.passive !== 1 && row.aura !== 1 && attacksWithWeapon(row);
}

/** Why a skill of a form cannot be used in the character's form (`null` = unshifted); null for any other skill */
function wrongForm(data: SheetData, skillId: number, form: Form | null): string | null {
  const row = data.skill(skillId)?.row;
  if (row?.restrict !== 2 || (form !== null && formStates(row).includes(form.state))) return null;
  return `it needs ${formsNeeded(data, skillId) ?? 'another'} form`;
}

/** Why a buff of the skill does not count in the character's form (`null` = unshifted); null when it counts */
export function formProblem(data: SheetData, skillId: number, form: Form | null): string | null {
  const wrong = wrongForm(data, skillId, form);
  if (wrong !== null) return wrong;
  return form !== null && unshiftedAttack(data, skillId) ? `it cannot be used in ${form.name} form` : null;
}

/** Why a skill on a mouse button cannot be used in the character's form: nothing made for the unshifted character can */
export function handFormProblem(data: SheetData, skillId: number, form: Form | null): string | null {
  const wrong = wrongForm(data, skillId, form);
  if (wrong !== null) return wrong;
  const row = data.skill(skillId)?.row;
  return form !== null && row !== undefined && row.restrict === undefined ? `it cannot be used in ${form.name} form` : null;
}

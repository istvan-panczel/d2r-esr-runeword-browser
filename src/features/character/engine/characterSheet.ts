/**
 * The sheet of a character: base attributes, hard skill points by tab and the hotkey list. Everything is what the save
 * stores (no totals: `baseAttributes` are the values without gear, skills are the hard points).
 */
import type { ItemTextBundle, SkillClassTree } from '@/features/game-data/engine/schema';
import type { CharacterFile } from '../parser/types';

export interface SheetStat {
  readonly label: string;
  readonly value: number;
}

/** The stored base stats, integers (life, mana and stamina are fixed-point in the save) */
export function baseAttributeRows(character: Pick<CharacterFile, 'baseAttributes'>): SheetStat[] {
  const { baseAttributes: base } = character;
  const rows: [string, number][] = [
    ['Base strength', base.strength],
    ['Base dexterity', base.dexterity],
    ['Base vitality', base.vitality],
    ['Base energy', base.energy],
    ['Base life', base.maxLife],
    ['Base mana', base.maxMana],
    ['Base stamina', base.maxStamina],
    ['Unspent stat points', base.statPoints],
    ['Unspent skill points', base.skillPoints],
    ['Gold on character', base.gold],
    ['Gold in personal stash', base.goldBank],
  ];
  return rows.map(([label, value]) => ({ label, value: Math.floor(value) }));
}

export interface SkillTabPoints {
  readonly name: string;
  readonly skills: readonly { readonly name: string; readonly points: number }[];
}

type SkillNames = ItemTextBundle['skills'];

/** The display name of a skills.txt row; "Skill 574" for one the data does not know (none in any real save) */
export function skillNames(skills: SkillNames): (id: number) => string {
  const byId = new Map(skills.map((skill) => [skill.id, skill.name]));
  return (id) => byId.get(id) ?? `Skill ${String(id)}`;
}

/**
 * The hard points by skill tab (tabs in game order, skills as in the tree; a tab without points is left out). A skill
 * the class tree does not list goes under "Other": the tree is matched by name.
 */
export function skillPointsByTab(
  character: Pick<CharacterFile, 'skills' | 'className'>,
  names: (id: number) => string,
  classes: readonly SkillClassTree[]
): SkillTabPoints[] {
  const tree = classes.find((entry) => entry.name === character.className);
  const invested = character.skills
    .filter((skill) => skill.points > 0)
    .map((skill) => ({ name: names(skill.skillId), points: skill.points }));
  const tabs: SkillTabPoints[] = (tree?.tabs ?? []).map((tab) => ({
    name: tab.name,
    skills: tab.skills.flatMap((skill) => invested.filter((entry) => entry.name === skill.name)),
  }));
  const listed = new Set(tabs.flatMap((tab) => tab.skills.map((skill) => skill.name)));
  const other = invested.filter((skill) => !listed.has(skill.name));
  return [...tabs, ...(other.length > 0 ? [{ name: 'Other', skills: other }] : [])].filter((tab) => tab.skills.length > 0);
}

export interface HotkeyRow {
  /** 1-based slot of the header's 16 */
  readonly slot: number;
  readonly name: string;
}

/** The assigned hotkeys, by slot */
export function hotkeyRows(character: Pick<CharacterFile, 'hotkeys'>, names: (id: number) => string): HotkeyRow[] {
  return character.hotkeys.flatMap((binding, index) =>
    binding.skillId === null ? [] : [{ slot: index + 1, name: names(binding.skillId) }]
  );
}

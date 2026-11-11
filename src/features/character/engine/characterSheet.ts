/**
 * The sheet of a character as the Overview and Skills tabs show it: what the save stores, no totals. `baseAttributes`
 * are the values without gear; life, mana and stamina "when saved" are the current values the game wrote (gear and
 * active buffs included, so they can be far above the base); skills are the hard points.
 */
import type { CharacterFile, SkillBinding } from '../parser/types';

export interface SheetStat {
  readonly label: string;
  readonly value: number;
}

export interface SheetGroup {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly SheetStat[];
  readonly note?: string;
}

const rows = (entries: readonly (readonly [string, number])[]): SheetStat[] =>
  entries.map(([label, value]) => ({ label, value: Math.floor(value) }));

/** The Overview's stat groups. Integers: life, mana and stamina are fixed-point in the save. */
export function overviewGroups(character: Pick<CharacterFile, 'baseAttributes' | 'level'>): SheetGroup[] {
  const { baseAttributes: base } = character;
  return [
    {
      key: 'attributes',
      title: 'Base attributes',
      rows: rows([
        ['Strength', base.strength],
        ['Dexterity', base.dexterity],
        ['Vitality', base.vitality],
        ['Energy', base.energy],
      ]),
      note: 'Points put in by hand and the class start values: no gear, skills or other bonuses.',
    },
    {
      key: 'pools',
      title: 'Life, mana and stamina',
      rows: rows([
        ['Base life', base.maxLife],
        ['Base mana', base.maxMana],
        ['Base stamina', base.maxStamina],
        ['Life when saved', base.life],
        ['Mana when saved', base.mana],
        ['Stamina when saved', base.stamina],
      ]),
      note: 'Base: from level and attributes only. When saved: what the game wrote at that moment, gear and active buffs included.',
    },
    {
      key: 'progress',
      title: 'Level and points',
      rows: rows([
        ['Level', character.level],
        ['Experience', base.experience],
        ['Unspent stat points', base.statPoints],
        ['Unspent skill points', base.skillPoints],
      ]),
    },
    {
      key: 'gold',
      title: 'Gold',
      rows: rows([
        ['On the character', base.gold],
        ['In the personal stash', base.goldBank],
      ]),
    },
  ];
}

type SkillNames = readonly { readonly id: number; readonly name: string }[];

/** The display name of a skills.txt row (itemtext.json `skills`); "Skill 574" for one the data does not know (none in any real save) */
export function skillNames(skills: SkillNames): (id: number) => string {
  const byId = new Map(skills.map((skill) => [skill.id, skill.name]));
  return (id) => byId.get(id) ?? `Skill ${String(id)}`;
}

/**
 * skills.txt row → skills.json id: lootfilter.json `skillNames` (the `skill` column by row, '' for a blank row), the
 * same table the build draft maps a save with.
 */
export type SkillIdTable = readonly string[];

export interface HardSkillPoints {
  /** Hard points by skills.json id, zero entries dropped */
  readonly byId: Readonly<Record<string, number>>;
  /** Rows with points the table has no id for (none in any real save) */
  readonly unmapped: readonly { readonly row: number; readonly points: number }[];
}

export function hardSkillPoints(character: Pick<CharacterFile, 'skills'>, skillIds: SkillIdTable): HardSkillPoints {
  const byId: Record<string, number> = {};
  const unmapped: { row: number; points: number }[] = [];
  for (const { skillId: row, points } of character.skills) {
    if (points <= 0) continue;
    const id = skillIds.at(row);
    if (id === undefined || id === '') unmapped.push({ row, points });
    else byId[id] = (byId[id] ?? 0) + points;
  }
  return { byId, unmapped };
}

/** A hotkey or hand skill: its slot label, the skills.txt row, the display name and the skills.json id (null: not mapped) */
export interface SkillBindingRow {
  readonly key: string;
  readonly label: string;
  readonly row: number;
  readonly name: string;
  readonly skillId: string | null;
}

/** skills.txt row of Attack, what an unassigned hand does in game */
const ATTACK_ROW = 0;

function bindingRow(key: string, label: string, row: number, names: (row: number) => string, skillIds: SkillIdTable): SkillBindingRow {
  const id = skillIds.at(row);
  return { key, label, row, name: names(row), skillId: id === undefined || id === '' ? null : id };
}

/** The assigned hotkeys, by slot ("Hotkey 1" … "Hotkey 16") */
export function hotkeyRows(
  character: Pick<CharacterFile, 'hotkeys'>,
  names: (row: number) => string,
  skillIds: SkillIdTable = []
): SkillBindingRow[] {
  return character.hotkeys.flatMap((binding, index) =>
    binding.skillId === null ? [] : [bindingRow(`hotkey:${String(index)}`, `Hotkey ${String(index + 1)}`, binding.skillId, names, skillIds)]
  );
}

/**
 * The four hand skills as stored: left and right, then the weapon swap's pair, which is left out when it equals the main
 * pair. An unassigned hand is Attack, as in game.
 */
export function handSkillRows(
  character: Pick<CharacterFile, 'handSkills'>,
  names: (row: number) => string,
  skillIds: SkillIdTable = []
): SkillBindingRow[] {
  const { left, right, swapLeft, swapRight } = character.handSkills;
  const rowOf = (binding: SkillBinding) => binding.skillId ?? ATTACK_ROW;
  const swapDiffers = rowOf(swapLeft) !== rowOf(left) || rowOf(swapRight) !== rowOf(right);
  const entries: readonly (readonly [string, string, SkillBinding])[] = [
    ['left', 'Left', left],
    ['right', 'Right', right],
    ...(swapDiffers
      ? ([
          ['swapLeft', 'Swap left', swapLeft],
          ['swapRight', 'Swap right', swapRight],
        ] as const)
      : []),
  ];
  return entries.map(([key, label, binding]) => bindingRow(key, label, rowOf(binding), names, skillIds));
}

/** The Overview's "at a glance" counts, each the summary of a tab */
export interface CharacterGlance {
  /** Items worn by the character (both weapon sets) */
  readonly equipped: number;
  /** Items in the Charm Inventory */
  readonly charms: number;
  readonly mercenary: 'none' | 'alive' | 'dead';
  readonly hardPoints: number;
  /** Skills with at least one hard point */
  readonly skillsLearned: number;
  /** Inventory, belt, cube, personal stash and anything else the player holds, corpse and golem items included */
  readonly stored: number;
}

export function characterGlance(character: Pick<CharacterFile, 'items' | 'skills' | 'mercenary'>): CharacterGlance {
  const { player, corpses, golem } = character.items;
  const count = (kinds: readonly string[]) => player.filter((item) => kinds.includes(item.location.kind)).length;
  const learned = character.skills.filter((skill) => skill.points > 0);
  return {
    equipped: count(['equipped']),
    charms: count(['charm']),
    mercenary: character.mercenary === null ? 'none' : character.mercenary.dead ? 'dead' : 'alive',
    hardPoints: learned.reduce((sum, skill) => sum + skill.points, 0),
    skillsLearned: learned.length,
    stored:
      player.filter((item) => !['equipped', 'charm', 'socketed'].includes(item.location.kind)).length +
      corpses.reduce((sum, corpse) => sum + corpse.items.length, 0) +
      (golem === null ? 0 : 1),
  };
}

import { describe, expect, it } from 'vitest';
import type { BaseAttributes, HandSkills, SkillBinding } from '../parser/types';
import { handSkillRows, hardSkillPoints, hotkeyRows, overviewGroups, skillNames } from './characterSheet';

const names = skillNames([
  { id: 0, name: 'Attack' },
  { id: 10, name: 'Whirlwind' },
  { id: 11, name: 'War Cry' },
  { id: 12, name: 'Leap' },
]);

/** skills.txt row → skills.json id; row 11 is blank */
const skillIds: string[] = [];
skillIds[0] = 'Attack';
skillIds[10] = 'Whirlwind';
skillIds[11] = '';
skillIds[12] = 'Leap';

const binding = (skillId: number | null): SkillBinding => ({ skillId, leftHand: false, raw: 0 });

describe('overview groups', () => {
  const base: BaseAttributes = {
    strength: 180,
    energy: 10,
    dexterity: 276,
    vitality: 140,
    statPoints: 2,
    skillPoints: 0,
    life: 10219.4,
    maxLife: 1189.5,
    mana: 1,
    maxMana: 111,
    stamina: 2,
    maxStamina: 257.5,
    level: 102,
    experience: 5,
    gold: 1,
    goldBank: 2,
  };
  const groups = overviewGroups({ baseAttributes: base, level: 102 });
  const value = (label: string) => groups.flatMap((group) => group.rows).find((row) => row.label === label)?.value;

  it('labels the attributes as base and rounds down the fixed-point pools', () => {
    expect(groups.map((group) => group.title)).toEqual(['Base attributes', 'Life, mana and stamina', 'Level and points', 'Gold']);
    expect(value('Strength')).toBe(180);
    expect(value('Base life')).toBe(1189);
    expect(value('Base stamina')).toBe(257);
  });

  it('shows the current life as "when saved", apart from the base', () => {
    expect(value('Life when saved')).toBe(10219);
    expect(value('Level')).toBe(102);
    expect(value('In the personal stash')).toBe(2);
  });
});

describe('hard skill points', () => {
  it('maps saved rows to skills.json ids through the row table, dropping zero entries', () => {
    const skills = [
      { skillId: 10, points: 5 },
      { skillId: 12, points: 0 },
      { skillId: 11, points: 2 },
      { skillId: 99, points: 1 },
    ];
    expect(hardSkillPoints({ skills }, skillIds)).toEqual({
      byId: { Whirlwind: 5 },
      unmapped: [
        { row: 11, points: 2 },
        { row: 99, points: 1 },
      ],
    });
  });
});

describe('skill bindings', () => {
  it('lists only the assigned hotkeys, labelled by slot, with their skills.json id', () => {
    expect(hotkeyRows({ hotkeys: [binding(10), binding(null), binding(12)] }, names, skillIds)).toEqual([
      { key: 'hotkey:0', label: 'Hotkey 1', row: 10, name: 'Whirlwind', skillId: 'Whirlwind' },
      { key: 'hotkey:2', label: 'Hotkey 3', row: 12, name: 'Leap', skillId: 'Leap' },
    ]);
    expect(names(999)).toBe('Skill 999');
  });

  it('shows the hand skills, an unassigned hand as Attack, and the swap pair only when it differs', () => {
    const same: HandSkills = { left: binding(null), right: binding(10), swapLeft: binding(0), swapRight: binding(10) };
    expect(handSkillRows({ handSkills: same }, names, skillIds).map((row) => `${row.label}: ${row.name}`)).toEqual([
      'Left: Attack',
      'Right: Whirlwind',
    ]);
    const swapped: HandSkills = { ...same, swapRight: binding(11) };
    expect(handSkillRows({ handSkills: swapped }, names, skillIds).map((row) => [row.label, row.skillId])).toEqual([
      ['Left', 'Attack'],
      ['Right', 'Whirlwind'],
      ['Swap left', 'Attack'],
      ['Swap right', null],
    ]);
  });
});

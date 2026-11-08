import { describe, expect, it } from 'vitest';
import type { SkillClassTree } from '@/features/game-data/engine/schema';
import type { BaseAttributes, SkillBinding } from '../parser/types';
import { baseAttributeRows, hotkeyRows, skillNames, skillPointsByTab } from './characterSheet';

const names = skillNames([
  { id: 10, name: 'Whirlwind' },
  { id: 11, name: 'War Cry' },
  { id: 12, name: 'Leap' },
]);

const tree = (classes: { name: string; skills: string[] }[]): SkillClassTree =>
  ({
    code: 'bar',
    name: 'Barbarian',
    tabs: classes.map((tab, index) => ({
      page: index + 1,
      name: tab.name,
      skills: tab.skills.map((name) => ({ id: name, name, row: 1, col: 1, reqLevel: 1, maxLevel: 20, reqSkills: [] })),
    })),
  }) as SkillClassTree;

describe('base attributes', () => {
  it('labels each one as base and rounds down the fixed-point ones', () => {
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
    const rows = baseAttributeRows({ baseAttributes: base });
    expect(rows.find((row) => row.label === 'Base strength')?.value).toBe(180);
    expect(rows.find((row) => row.label === 'Base life')?.value).toBe(1189);
    expect(rows.find((row) => row.label === 'Base stamina')?.value).toBe(257);
    // current life (a value carried from the game) is never shown
    expect(rows.every((row) => !row.label.includes('Life') && row.value !== 10219)).toBe(true);
  });
});

describe('skill points', () => {
  const skills = [
    { skillId: 10, points: 5 },
    { skillId: 11, points: 0 },
    { skillId: 12, points: 3 },
  ];

  it('groups the invested skills by tab, in tree order, dropping empty tabs', () => {
    const classes = [
      tree([
        { name: 'Combat', skills: ['Whirlwind'] },
        { name: 'Warcries', skills: ['War Cry'] },
        { name: 'Masteries', skills: ['Leap'] },
      ]),
    ];
    expect(skillPointsByTab({ skills, className: 'Barbarian' }, names, classes)).toEqual([
      { name: 'Combat', skills: [{ name: 'Whirlwind', points: 5 }] },
      { name: 'Masteries', skills: [{ name: 'Leap', points: 3 }] },
    ]);
  });

  it('keeps skills the tree does not list, and names unknown rows', () => {
    const classes = [tree([{ name: 'Combat', skills: ['Whirlwind'] }])];
    expect(skillPointsByTab({ skills, className: 'Barbarian' }, names, classes)).toEqual([
      { name: 'Combat', skills: [{ name: 'Whirlwind', points: 5 }] },
      { name: 'Other', skills: [{ name: 'Leap', points: 3 }] },
    ]);
    expect(names(999)).toBe('Skill 999');
  });

  it('lists only the assigned hotkeys, numbered by slot', () => {
    const binding = (skillId: number | null): SkillBinding => ({ skillId, leftHand: false, raw: 0 });
    expect(hotkeyRows({ hotkeys: [binding(10), binding(null), binding(12)] }, names)).toEqual([
      { slot: 1, name: 'Whirlwind' },
      { slot: 3, name: 'Leap' },
    ]);
  });
});

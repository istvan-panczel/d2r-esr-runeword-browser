/**
 * Skill tab ID to readable name mapping for D2R
 *
 * Skill tabs are numbered 0-20 across the 7 character classes.
 * Each class has 3 skill tabs.
 */

export interface SkillTabInfo {
  readonly name: string;
  readonly className: string;
}

/**
 * Map of skill tab IDs to their display information
 */
export const SKILL_TAB_MAP: ReadonlyMap<number, SkillTabInfo> = new Map([
  // Amazon (0-2)
  [0, { name: 'Bow and Crossbow Skills', className: 'Amazon' }],
  [1, { name: 'Passive and Magic Skills', className: 'Amazon' }],
  [2, { name: 'Javelin and Spear Skills', className: 'Amazon' }],

  // Sorceress (3-5)
  [3, { name: 'Fire Spells', className: 'Sorceress' }],
  [4, { name: 'Lightning Spells', className: 'Sorceress' }],
  [5, { name: 'Cold Spells', className: 'Sorceress' }],

  // Necromancer (6-8)
  [6, { name: 'Curses', className: 'Necromancer' }],
  [7, { name: 'Poison and Bone Spells', className: 'Necromancer' }],
  [8, { name: 'Summoning Skills', className: 'Necromancer' }],

  // Paladin (9-11)
  [9, { name: 'Combat Skills', className: 'Paladin' }],
  [10, { name: 'Offensive Auras', className: 'Paladin' }],
  [11, { name: 'Defensive Auras', className: 'Paladin' }],

  // Barbarian (12-14)
  [12, { name: 'Combat Skills', className: 'Barbarian' }],
  [13, { name: 'Combat Masteries', className: 'Barbarian' }],
  [14, { name: 'Warcries', className: 'Barbarian' }],

  // Druid (15-17)
  [15, { name: 'Summoning Skills', className: 'Druid' }],
  [16, { name: 'Shape Shifting Skills', className: 'Druid' }],
  [17, { name: 'Elemental Skills', className: 'Druid' }],

  // Assassin (18-20)
  [18, { name: 'Traps', className: 'Assassin' }],
  [19, { name: 'Shadow Disciplines', className: 'Assassin' }],
  [20, { name: 'Martial Arts', className: 'Assassin' }],
]);

/**
 * Get skill tab information by ID
 */
export function getSkillTabInfo(tabId: number): SkillTabInfo | undefined {
  return SKILL_TAB_MAP.get(tabId);
}

/**
 * Get skill tab name by ID
 */
export function getSkillTabName(tabId: number): string | undefined {
  return SKILL_TAB_MAP.get(tabId)?.name;
}

/**
 * Get skill tab class name by ID
 */
export function getSkillTabClassName(tabId: number): string | undefined {
  return SKILL_TAB_MAP.get(tabId)?.className;
}

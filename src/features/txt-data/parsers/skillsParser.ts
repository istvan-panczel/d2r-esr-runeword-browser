import { parseTsv } from '@/core/utils';
import type { TxtSkill, CharClassCode } from '@/core/db';

/**
 * Valid character class codes from skills.txt
 */
const VALID_CHAR_CLASSES = new Set<CharClassCode>(['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass', '']);

/**
 * Parse skills.txt to extract skill-to-class mappings
 * Used for translating skill properties with [Class] placeholders
 *
 * @param content - Raw content from skills.txt
 * @returns Array of skill definitions
 */
export function parseSkillsTxt(content: string): TxtSkill[] {
  const rows = parseTsv(content);

  return rows
    .filter((row) => row.skill && row.skill !== 'Expansion') // Skip empty and header marker rows
    .map((row) => {
      const charClass = row.charclass as CharClassCode;
      return {
        skill: row.skill,
        charClass: VALID_CHAR_CLASSES.has(charClass) ? charClass : '',
      };
    });
}

/**
 * Character class code to display name mapping
 */
export const CHAR_CLASS_NAMES: ReadonlyMap<CharClassCode, string> = new Map([
  ['ama', 'Amazon'],
  ['sor', 'Sorceress'],
  ['nec', 'Necromancer'],
  ['pal', 'Paladin'],
  ['bar', 'Barbarian'],
  ['dru', 'Druid'],
  ['ass', 'Assassin'],
  ['', ''],
]);

/**
 * Get the display name for a character class code
 */
export function getCharClassName(code: CharClassCode): string {
  return CHAR_CLASS_NAMES.get(code) ?? '';
}

/**
 * Build a lookup map from skill name to class code
 */
export function buildSkillClassMap(skills: readonly TxtSkill[]): Map<string, CharClassCode> {
  return new Map(skills.filter((s) => s.charClass).map((s) => [s.skill, s.charClass]));
}

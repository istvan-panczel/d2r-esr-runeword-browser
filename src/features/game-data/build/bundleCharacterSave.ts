/**
 * What the character save (.d2s) parser (src/features/character/parser) needs on top of the item tables, added to
 * stash.json: the width of every stat the `gf` section can hold (ESR's CSvBits, only those rows matter) and, for each
 * class, where its skill points start in skills.txt.
 */
import { CLASS_CODES, type CharacterClassInfo, type CharacterStatInfo } from '../engine/schema.ts';
import type { BuildResult } from './bundleTypes.ts';
import type { TsvTable } from './tsv.ts';

export interface CharacterSaveInput {
  /** Parsed with `keepExpansionRows`: the row number is the stat id */
  itemstatcost: TsvTable;
  /** Parsed with `keepExpansionRows`: the row number is the skill id a save stores */
  skills: TsvTable;
  /** Without the Expansion marker row: the row number is the class byte of a save */
  charstats: TsvTable;
}

export interface CharacterSaveData {
  characterStats: CharacterStatInfo[];
  characterClasses: CharacterClassInfo[];
}

export function buildCharacterSaveData(input: CharacterSaveInput): BuildResult<CharacterSaveData> {
  const warnings: string[] = [];

  const characterStats = input.itemstatcost.rows.flatMap((row, id): CharacterStatInfo[] => {
    const bits = row.num('CSvBits');
    return bits > 0 ? [[id, bits, row.num('ValShift')]] : [];
  });

  // The `if` section lists a class's skills in skills.txt row order: rows of a class have to be contiguous
  const characterClasses = CLASS_CODES.map((code, classId): CharacterClassInfo => {
    const rows = input.skills.rows.flatMap((row, id) => (row.str('charclass') === code ? [id] : []));
    const first = rows[0] ?? 0;
    const contiguous = rows.every((id, i) => id === first + i);
    if (rows.length === 0 || !contiguous) warnings.push(`stash: skills.txt rows of class ${code} are not contiguous`);
    const name = input.charstats.rows[classId]?.str('class') ?? '';
    if (name.slice(0, 3).toLowerCase() !== code)
      warnings.push(`stash: charstats.txt row ${String(classId)} is "${name}", expected class ${code}`);
    return [name, first, rows.length];
  });

  return { bundle: { characterStats, characterClasses }, warnings };
}

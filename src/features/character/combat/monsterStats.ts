/**
 * Monster defense and attack rating from the game tables: the rules the combat.json generator and the Combat tab share
 * (docs/features/CHARACTER-SAVE.md "Combat tab"). Pure functions, no I/O; the generator imports this file, so imports
 * keep their `.ts` extension and no `@/` alias.
 *
 * - A value is the monstats.txt column of the difficulty (`AC` / `AC(N)` / `AC(H)`, `A1TH` …) times the monlvl.txt ratio
 *   of the monster level (`L-AC*` / `L-TH*`), / 100, rounded down. monlvl.txt ends at level 110: higher levels read row 110.
 * - Champions are 2 levels above the area, uniques and their minions 3 (vanilla engine rule, INFERRED), and add the
 *   monumod.txt attack rating bonus (+75 % / +100 % / +50 % in ESR 3.3). No monumod constant touches defense.
 */
import type { CombatLevelRatios, CombatModifiers, CombatMonsterKind, PerDifficulty } from '../../game-data/engine/schema.ts';

/** 0 Normal, 1 Nightmare, 2 Hell */
export type CombatDifficulty = 0 | 1 | 2;

/** monlvl.txt ends at this level; a higher monster level reads this row */
export const MAX_MONSTER_LEVEL = 110;

/** monlvl.txt ratios as columns: `defense[difficulty][level]`, `attack[difficulty][level]` */
export interface LevelRatioTables {
  defense: PerDifficulty<number[]>;
  attack: PerDifficulty<number[]>;
}

const DIFFICULTY_LIST: readonly CombatDifficulty[] = [0, 1, 2];

/** combat.json `levelRatios` (one row per level) as columns */
export function unpackLevelRatios(rows: readonly CombatLevelRatios[]): LevelRatioTables {
  const column = (index: number) => rows.map((row) => row[index] ?? 0);
  return {
    defense: DIFFICULTY_LIST.map((difficulty) => column(difficulty)) as PerDifficulty<number[]>,
    attack: DIFFICULTY_LIST.map((difficulty) => column(3 + difficulty)) as PerDifficulty<number[]>,
  };
}

/** Columns back into combat.json `levelRatios` rows */
export function packLevelRatios(tables: LevelRatioTables): CombatLevelRatios[] {
  return tables.defense[0].map((_, level) => {
    const at = (column: readonly number[]) => column[level] ?? 0;
    return [
      at(tables.defense[0]),
      at(tables.defense[1]),
      at(tables.defense[2]),
      at(tables.attack[0]),
      at(tables.attack[1]),
      at(tables.attack[2]),
    ];
  });
}

/** The monlvl.txt ratio of a monster level (rows 0..110), the last row above it */
export function levelRatio(table: readonly number[], level: number): number {
  const row = Math.max(0, Math.min(Math.floor(level), table.length - 1));
  return table[row] ?? 0;
}

/** monstats value × monlvl ratio / 100, rounded down */
export function scaleByLevel(base: number, level: number, table: readonly number[]): number {
  return Math.floor((base * levelRatio(table, level)) / 100);
}

/** Levels a monster kind adds on top of the regular monster's (0 for a regular monster) */
export function kindLevelBonus(kind: CombatMonsterKind, modifiers: CombatModifiers): number {
  return kind === 'regular' ? 0 : modifiers[kind].level;
}

/** The +% attack rating a monster kind adds (0 for a regular monster) */
export function kindAttackBonus(kind: CombatMonsterKind, modifiers: CombatModifiers): number {
  return kind === 'regular' ? 0 : modifiers[kind].attack;
}

/** An attack rating with a +% bonus, rounded down (the rounding is INFERRED; it moves the result by less than 1) */
export function withAttackBonus(attackRating: number, percent: number): number {
  return Math.floor((attackRating * (100 + percent)) / 100);
}

/**
 * A regular monster's value re-scaled to another monster level: value × ratio(to) / ratio(from). Exact up to the
 * rounding of the stored value (less than 1.1 points off: the stored value was rounded down once).
 */
export function rescaleLevel(value: number, from: number, to: number, table: readonly number[]): number {
  const fromRatio = levelRatio(table, from);
  if (fromRatio <= 0) return value;
  return Math.floor((value * levelRatio(table, to)) / fromRatio);
}

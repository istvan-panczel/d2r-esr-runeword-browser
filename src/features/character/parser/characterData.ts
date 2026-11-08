import type { StashBundle } from '../../game-data/engine/schema.ts';
import { createStashData, type StashData } from '../../stash/parser/stashData.ts';

export interface CharacterStatDef {
  bits: number;
  shift: number;
}

export interface CharacterClassDef {
  name: string;
  /** skills.txt row of the class's first skill */
  firstSkillId: number;
  skillCount: number;
}

/** Game data lookups for the character parser (built from stash.json). */
export interface CharacterData extends StashData {
  characterStat(id: number): CharacterStatDef | undefined;
  characterClass(id: number): CharacterClassDef | undefined;
}

export function createCharacterData(bundle: Pick<StashBundle, 'stats' | 'items' | 'characterStats' | 'characterClasses'>): CharacterData {
  const stats = new Map(bundle.characterStats.map(([id, bits, shift]): [number, CharacterStatDef] => [id, { bits, shift }]));
  const classes = bundle.characterClasses.map(([name, firstSkillId, skillCount]): CharacterClassDef => ({
    name,
    firstSkillId,
    skillCount,
  }));
  return {
    ...createStashData(bundle),
    characterStat: (id) => stats.get(id),
    characterClass: (id) => classes[id],
  };
}

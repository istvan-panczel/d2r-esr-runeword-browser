/**
 * Buffs cast on the other weapon set (the pre-buff swap): switch to weapon set II (a Call to Arms, a shield with
 * +skills), cast Battle Command and Battle Orders, switch back. The buff keeps the level it was cast at while the
 * character fights with set I. INFERRED from D2's rules (a cast buff's stats are fixed when it is cast); no in-game
 * ground truth yet.
 *
 * - The other set counts with the same body gear and charms (activeItems.ts picks the set from `activeWeapon`).
 * - Only own cast skills: not an aura or a passive (an aura needs its gear equipped, a passive is always on), and no
 *   skill that attacks with the weapon in hand: skills.txt `range` h2h / rng / both (Frenzy's charges, Zeal, Smite,
 *   Feral Rage, Lightning Fury), or a `weapsel` (Whirlwind and Fire Whirlwind are range `none` but swing the weapon):
 *   their effects are up while attacking, at the fighting set's level. Cast skills are range `none` (or `loc`): Battle
 *   Orders, Shout, Enchant, Fade, Energy Shield, the armors.
 * - Not a skill whose stats belong to the weapon in hand (`passiveitype`: the Warlock's hexes "hex your weapon").
 * - A shape-shift is a cast skill like the others: taken on the set that gives the higher level (its own +skills, or an
 *   item there that gives the form), it is kept after swapping back. INFERRED from D2 (a form is a timed state and the
 *   character can swap weapons in it); which skills a form allows is forms.ts.
 */
import type { CharacterFile } from '../../parser/types';
import type { SkillCalcRow } from '@/features/game-data/engine/schema';
import { affectsOwner } from '@/features/game-data/engine/skillEffects';
import type { SheetData } from './sheetData';

/** The weapon set a save was written on (header `activeWeapon` 0 = set I) */
export const weaponSetOf = (character: Pick<CharacterFile, 'activeWeapon'>): 1 | 2 => (character.activeWeapon === 1 ? 2 : 1);

/** "I" / "II", as the game names its weapon sets */
export const weaponSetName = (set: 1 | 2): string => (set === 1 ? 'I' : 'II');

/**
 * The character holding its other weapon set (same body gear and charms), or null when nothing is equipped there: an
 * empty other set never gives a higher level than the set in hand
 */
export function otherWeaponSet(character: CharacterFile): CharacterFile | null {
  const other = weaponSetOf(character) === 1 ? 2 : 1;
  const holds = character.items.player.some((item) => item.location.kind === 'equipped' && item.location.weaponSet === other);
  return holds ? { ...character, activeWeapon: character.activeWeapon === 1 ? 0 : 1 } : null;
}

const present = (value: string | number | undefined) => value !== undefined && value !== '' && value !== 0;

/** skills.txt `range` of a skill that attacks with the weapon in hand (melee, ranged, either) */
const ATTACK_RANGES: ReadonlySet<string | number | undefined> = new Set(['h2h', 'rng', 'both']);

/** A skill that attacks with the weapon in hand: its `range`, or a `weapsel` (Whirlwind is range `none` but swings) */
export const attacksWithWeapon = (row: SkillCalcRow): boolean => ATTACK_RANGES.has(row.range) || present(row.weapsel);

/** Whether a skill can be cast on the other weapon set and kept after swapping back (see the module comment) */
export function castOnSwap(data: SheetData, skillId: number): boolean {
  const row = data.skill(skillId)?.row;
  if (row === undefined || row.passive === 1 || row.aura === 1 || !affectsOwner(row, 'cast')) return false;
  return !attacksWithWeapon(row) && !present(row.passiveitype);
}

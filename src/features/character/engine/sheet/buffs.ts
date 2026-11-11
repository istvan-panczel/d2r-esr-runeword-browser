/**
 * The buffs a character could switch on that the unbuffed sheet leaves out: its own castable skills and auras (hard
 * points, +skills or oskills) and self-buff procs of its active items, each only when its stats reach the character
 * (skillEffects.ts `affectsOwner`) and, evaluated at the level it would count at, change a number the sheet applies
 * (consumed.ts): a stat column whose formula gives 0 there (a synergy without points: Maul's run speed needs Shared
 * Savagery) does not count. Each skill is listed once: the own skill unless a proc gives a higher level, with every item
 * that procs it. Own auras and shape-shifts carry an `exclusiveGroup` (one at a time); a skill of a form carries
 * `needsForm`, an attack for the unshifted character `unshiftedOnly` (forms.ts). A cast skill the other weapon set
 * gives at a higher level (or alone) is listed at that level with `castSet` (otherSet.ts: cast there, swap back; auras
 * and procs need their gear in hand and stay with the active set). Applying them is
 * computeCharacterSheet's `options.buffs`. Shrines, elixirs and potions are out of scope. INFERRED: no buffed ground truth.
 */
import type { CharacterFile } from '../../parser/types';
import { affectsOwner } from '@/features/game-data/engine/skillEffects';
import { statLayerKind } from '@/features/game-data/engine/statLayers';
import type { CharSheetSkill } from '@/features/game-data/engine/schema';
import { skillLevel as eventSkill } from '@/features/stash/engine/items/textData';
import { consumedStats } from './consumed';
import { formsNeeded, unshiftedAttack } from './forms';
import { castOnSwap, otherWeaponSet, weaponSetOf } from './otherSet';
import type { SheetData } from './sheetData';
import { computeForBuffs, exclusiveGroupOf } from './sheet';
import { buffStats, type EvalContext } from './skills';
import type { AvailableBuff } from './types';

/** The sheet stats the buff changes at that level: applied by the sheet and not 0 (column order) */
function appliedStats(
  data: SheetData,
  skill: CharSheetSkill,
  level: number,
  hard: number,
  ctx: EvalContext,
  consumed: ReadonlySet<number>
): string[] {
  // A scratch set: the listing must not add to the unbuffed sheet's "formula not evaluated" notes
  const stats = buffStats(data, skill, level, hard, { ...ctx, unsupported: new Set() });
  const names: string[] = [];
  for (const [id, inner] of stats) {
    const amount = [...inner.values()].reduce((sum, value) => sum + value, 0);
    if (consumed.has(id) && amount !== 0) names.push(data.statName(id));
  }
  return names;
}

export function listAvailableBuffs(character: CharacterFile, data: SheetData): AvailableBuff[] {
  const { levels, setup, ctx } = computeForBuffs(character, data);
  const consumed = consumedStats(data);
  const hardOf = (skillId: number) => levels.byId.get(skillId)?.hard ?? 0;
  const withGroup = (listed: AvailableBuff): AvailableBuff => {
    const group = exclusiveGroupOf(data, listed.skillId);
    const buff = group === undefined ? listed : { ...listed, exclusiveGroup: group };
    // What the character's form allows (forms.ts); an item's proc is not the character's cast
    if (buff.kind === 'proc') return buff;
    const needsForm = formsNeeded(data, buff.skillId);
    if (needsForm !== null) return { ...buff, needsForm };
    return unshiftedAttack(data, buff.skillId) ? { ...buff, unshiftedOnly: true } : buff;
  };
  const own = new Map<number, AvailableBuff>();
  for (const state of levels.byId.values()) {
    const skill = data.skill(state.id);
    if (skill === undefined || state.level <= 0 || skill.row.passive === 1 || !affectsOwner(skill.row, 'cast')) continue;
    const stats = appliedStats(data, skill, state.level, state.hard, ctx, consumed);
    if (stats.length === 0) continue;
    own.set(state.id, {
      skillId: state.id,
      name: data.skillName(state.id),
      kind: skill.row.aura === 1 ? 'aura' : 'cast',
      level: state.level,
      stats,
    });
  }
  // Cast skills the other weapon set gives at a higher level (a tie stays with the set in hand), evaluated there
  const other = otherWeaponSet(character);
  if (other !== null) {
    const swap = computeForBuffs(other, data);
    for (const state of swap.levels.byId.values()) {
      const skill = data.skill(state.id);
      if (skill === undefined || state.level <= (levels.byId.get(state.id)?.level ?? 0) || !castOnSwap(data, state.id)) continue;
      const stats = appliedStats(data, skill, state.level, state.hard, swap.ctx, consumed);
      if (stats.length === 0) continue;
      own.set(state.id, {
        skillId: state.id,
        name: data.skillName(state.id),
        kind: 'cast',
        level: state.level,
        castSet: weaponSetOf(other),
        stats,
      });
    }
  }
  // Procs: per skill the highest level (the first item on a tie), and every item that procs it
  const procs = new Map<number, { best: AvailableBuff; items: number[] }>();
  for (const entry of setup.active) {
    for (const [id, inner] of entry.stats) {
      if (statLayerKind(data.statName(id)) !== 'event') continue;
      for (const [param, chance] of inner) {
        const { skill: skillId, level } = eventSkill(param);
        const skill = data.skill(skillId);
        if (skill === undefined || level <= 0 || !affectsOwner(skill.row, 'cast')) continue;
        const stats = appliedStats(data, skill, level, hardOf(skillId), ctx, consumed);
        if (stats.length === 0) continue;
        const buff: AvailableBuff = { skillId, name: data.skillName(skillId), kind: 'proc', level, item: entry.index, chance, stats };
        const seen = procs.get(skillId);
        if (seen === undefined) procs.set(skillId, { best: buff, items: [entry.index] });
        else {
          if (!seen.items.includes(entry.index)) seen.items.push(entry.index);
          if (level > seen.best.level) seen.best = buff;
        }
      }
    }
  }
  const buffs: AvailableBuff[] = [];
  for (const [skillId, buff] of own) {
    const proc = procs.get(skillId);
    if (proc !== undefined && proc.best.level > buff.level) continue;
    buffs.push(withGroup(proc === undefined ? buff : { ...buff, items: proc.items }));
  }
  for (const [skillId, { best, items }] of procs) {
    const mine = own.get(skillId);
    if (mine !== undefined && mine.level >= best.level) continue;
    buffs.push(withGroup({ ...best, items }));
  }
  return buffs.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

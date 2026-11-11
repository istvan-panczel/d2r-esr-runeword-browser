/**
 * The buffs a character could switch on that the unbuffed sheet leaves out: its own castable skills and auras (hard
 * points, +skills or oskills) and self-buff procs of its active items, each only when its stats reach the character
 * (skillEffects.ts `affectsOwner`) and change a number the sheet applies (consumed.ts). Each skill is listed once: the
 * own skill unless a proc gives a higher level, with every item that procs it. Own auras and shape-shifts carry an
 * `exclusiveGroup` (one at a time). Applying them is computeCharacterSheet's `options.buffs`. Shrines, elixirs and
 * potions are out of scope. INFERRED: no buffed ground truth exists yet.
 */
import type { CharacterFile } from '../../parser/types';
import { affectsOwner } from '@/features/game-data/engine/skillEffects';
import { statLayerKind } from '@/features/game-data/engine/statLayers';
import type { CharSheetSkill } from '@/features/game-data/engine/schema';
import { skillLevel as eventSkill } from '@/features/stash/engine/items/textData';
import { consumedStats } from './consumed';
import type { SheetData } from './sheetData';
import { computeForBuffs, exclusiveGroupOf } from './sheet';
import { statNamesOf } from './skills';
import type { AvailableBuff } from './types';

function relevantStats(data: SheetData, skill: CharSheetSkill, consumed: ReadonlySet<number>): string[] {
  return statNamesOf(skill).filter((name) => {
    const id = data.statId(name);
    return id !== undefined && consumed.has(id);
  });
}

export function listAvailableBuffs(character: CharacterFile, data: SheetData): AvailableBuff[] {
  const { levels, setup } = computeForBuffs(character, data);
  const consumed = consumedStats(data);
  const withGroup = (buff: AvailableBuff): AvailableBuff => {
    const group = exclusiveGroupOf(data, buff.skillId);
    return group === undefined ? buff : { ...buff, exclusiveGroup: group };
  };
  const own = new Map<number, AvailableBuff>();
  for (const state of levels.byId.values()) {
    const skill = data.skill(state.id);
    if (skill === undefined || state.level <= 0 || skill.row.passive === 1 || !affectsOwner(skill.row, 'cast')) continue;
    const stats = relevantStats(data, skill, consumed);
    if (stats.length === 0) continue;
    own.set(state.id, {
      skillId: state.id,
      name: data.skillName(state.id),
      kind: skill.row.aura === 1 ? 'aura' : 'cast',
      level: state.level,
      stats,
    });
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
        const stats = relevantStats(data, skill, consumed);
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

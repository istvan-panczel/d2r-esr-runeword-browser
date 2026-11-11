/**
 * The buffs a character could switch on that the unbuffed sheet leaves out: its own castable skills and auras (hard
 * points, +skills or oskills) and self-buff procs of its active items, each only when its stats reach the character
 * (skillEffects.ts `affectsOwner`) and change a number on the sheet. Applying them is computeCharacterSheet's
 * `options.buffs`. Shrines, elixirs and potions are out of scope. INFERRED: no buffed ground truth exists yet.
 */
import type { CharacterFile } from '../../parser/types';
import { affectsOwner } from '@/features/game-data/engine/skillEffects';
import { statLayerKind } from '@/features/game-data/engine/statLayers';
import type { CharSheetSkill } from '@/features/game-data/engine/schema';
import { skillLevel as eventSkill } from '@/features/stash/engine/items/textData';
import type { SheetData } from './sheetData';
import { computeForBuffs } from './sheet';
import { statNamesOf } from './skills';
import type { AvailableBuff } from './types';

/** Stats the sheet shows, directly or through an op (strength %, per-level stats …) */
function sheetStats(data: SheetData): Set<string> {
  const shown = new Set<string>(Object.keys(data.stat));
  for (const op of data.bundle.ops) if (op.targets.some((id) => shown.has(data.statName(id)))) shown.add(data.statName(op.id));
  for (const name of ['level', 'experience', 'gold', 'goldbank', 'kill_base', 'relic_of_knowledge', 'respecpoints', 'statpts', 'newskills'])
    shown.delete(name);
  return shown;
}

function relevantStats(skill: CharSheetSkill, shown: ReadonlySet<string>): string[] {
  return statNamesOf(skill).filter((name) => shown.has(name));
}

export function listAvailableBuffs(character: CharacterFile, data: SheetData): AvailableBuff[] {
  const { levels, setup } = computeForBuffs(character, data);
  const shown = sheetStats(data);
  const buffs: AvailableBuff[] = [];
  for (const state of levels.byId.values()) {
    const skill = data.skill(state.id);
    if (skill === undefined || state.level <= 0 || skill.row.passive === 1 || !affectsOwner(skill.row, 'cast')) continue;
    const stats = relevantStats(skill, shown);
    if (stats.length === 0) continue;
    buffs.push({
      skillId: state.id,
      name: data.skillName(state.id),
      kind: skill.row.aura === 1 ? 'aura' : 'cast',
      level: state.level,
      stats,
    });
  }
  for (const entry of setup.active) {
    const seen = new Set<number>();
    for (const [id, inner] of entry.stats) {
      if (statLayerKind(data.statName(id)) !== 'event') continue;
      for (const [param, chance] of inner) {
        const { skill: skillId, level } = eventSkill(param);
        const skill = data.skill(skillId);
        if (skill === undefined || seen.has(skillId) || level <= 0 || !affectsOwner(skill.row, 'cast')) continue;
        const stats = relevantStats(skill, shown);
        if (stats.length === 0) continue;
        seen.add(skillId);
        buffs.push({ skillId, name: data.skillName(skillId), kind: 'proc', level, item: entry.index, chance, stats });
      }
    }
  }
  return buffs.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

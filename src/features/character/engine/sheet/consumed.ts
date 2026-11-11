/**
 * Which stats the sheet applies, in one place: the stats it reads from the character's totals, the per-level stats that
 * land on them, and the op stats it applies where they sit. listAvailableBuffs lists only these, and a stat outside them
 * (a buff's, or an op the engine does not apply) becomes a warning instead of changing nothing silently.
 */
import type { CharSheetStatOp } from '@/features/game-data/engine/schema';
import type { KnownStat, SheetData } from './sheetData';
import type { Contribution } from './statMap';

/** The stats a sheet value or the skill levels read from the totals (character level) */
const SHEET_STATS = [
  'strength',
  'dexterity',
  'vitality',
  'energy',
  'strengthpercent',
  'dexteritypercent',
  'vitalitypercent',
  'energypercent',
  'maxhp',
  'maxmana',
  'maxstamina',
  'item_maxhp_percent',
  'item_maxmana_percent',
  'skill_staminapercent',
  'armorclass',
  'skill_armor_percent',
  'armor_override_percent',
  'fireresist',
  'coldresist',
  'lightresist',
  'poisonresist',
  'magicresist',
  'maxfireresist',
  'maxcoldresist',
  'maxlightresist',
  'maxpoisonresist',
  'maxmagicresist',
  'damageresist',
  'normal_damage_reduction',
  'magic_damage_reduction',
  'item_absorbfire_percent',
  'item_absorbcold_percent',
  'item_absorblight_percent',
  'item_absorbmagic_percent',
  'item_absorbfire',
  'item_absorbcold',
  'item_absorblight',
  'item_absorbmagic',
  'item_fasterattackrate',
  'item_fastermovevelocity',
  'item_fastergethitrate',
  'item_fasterblockrate',
  'item_fastercastrate',
  'attackrate',
  'velocitypercent',
  'tohit',
  'item_tohit_percent',
  'item_allskills',
  'item_addclassskills',
  'item_addskill_tab',
  'item_singleskill',
  'item_nonclassskill',
  'passive_dodge',
  'passive_avoid',
  'passive_evade',
  'item_deadlystrike',
  'item_crushingblow',
  'item_openwounds',
  'item_fractionaltargetac',
  'lifedrainmindam',
  'manadrainmindam',
  'hpregen',
  'manarecoverybonus',
  'item_magicbonus',
  'item_goldbonus',
  'toblock',
] as const satisfies readonly KnownStat[];

/** Defense stats the sheet applies on the item that carries them only (op 13 / 4 / 5: the item's own defense) */
const ITEM_DEFENSE = ['item_armor_percent', 'item_armorpercent_perlevel', 'item_armor_perlevel'] as const satisfies readonly KnownStat[];

/** Op stats the sheet applies wherever they sit: energy / vitality (op 8 / 9), the attribute and pool percents (op 11) */
const APPLIED_OPS = [
  'energy',
  'vitality',
  'strengthpercent',
  'dexteritypercent',
  'vitalitypercent',
  'energypercent',
  'item_maxhp_percent',
  'item_maxmana_percent',
  'skill_staminapercent',
] as const satisfies readonly KnownStat[];

/** Stat ids the sheet applies at the character level: SHEET_STATS and the per-level stats (op 2) that land on one */
export function consumedStats(data: SheetData): Set<number> {
  const ids = new Set<number>(SHEET_STATS.map((name) => data.stat[name]));
  for (const op of data.perLevelOps) if (op.op === 2 && op.targets.some((id) => ids.has(id))) ids.add(op.id);
  return ids;
}

/**
 * Op stats on a contribution whose op the sheet does not apply although a target is on the sheet: op 11 percents other
 * than the attribute / pool ones (`total_fire_resist`, `totalmaxhp` …), op 9 `vitality_hidden2` → hpregen, an item
 * defense stat outside an item (a set bonus, an aura). Per stat id, the summed value.
 */
export function unappliedOps(
  data: SheetData,
  contributions: readonly Contribution[],
  consumed: ReadonlySet<number>
): Map<CharSheetStatOp, number> {
  const { stat } = data;
  const applied = new Set<number>(APPLIED_OPS.map((name) => stat[name]));
  const itemDefense = new Set<number>(ITEM_DEFENSE.map((name) => stat[name]));
  const out = new Map<CharSheetStatOp, number>();
  for (const contribution of contributions) {
    const onItem = contribution.item !== undefined && (contribution.kind === 'item' || contribution.kind === 'runic');
    for (const [id, inner] of contribution.stats) {
      const op = data.op(id);
      if (op === undefined || applied.has(id) || (op.op === 2 && op.base === stat.level) || (onItem && itemDefense.has(id))) continue;
      if (!op.targets.some((target) => consumed.has(target))) continue;
      const value = [...inner.values()].reduce((sum, amount) => sum + amount, 0);
      if (value !== 0) out.set(op, (out.get(op) ?? 0) + value);
    }
  }
  return out;
}

/**
 * Stats the game stores scaled (ESR itemstatcost.txt), and what the loot filter plugin reads for them. Plugin 1.8.2 (ESR
 * 3.3 guide, "Stat values"): "Every stat a filter reads is the number the item tooltip prints, in itemStats,
 * playerStats, formulas and the {stat:} placeholders."
 * - `ValShift` 8: Life, Mana and Stamina (current and max) are stored in 256ths; +40 Life reads 40.
 * - The `*_perlevel` stats (`op` 2, 4 or 5 with `op param` 3, `op base` level) store the per-level amount in eighths;
 *   they read the value at the character's level, as "(Based on Character Level)" shows: 0.5 per level reads 0 at level
 *   1 and 49 at level 99. `item_hp_perlevel`, `item_mana_perlevel` and `item_stamina_perlevel` have both.
 * - `item_howl` and `item_fear` are stored in 128ths; they read the percent.
 * - Charges read the skill level (`utils/statParams.ts` `CHARGED_VALUE_HINT`). Everything else reads as stored.
 * Plugin 1.5.3 (ESR 3.2.x) was never checked for these; the 1.8.2 readings are the guide's, not yet verified in game.
 */
import type { StatCheck } from './types.ts';

export type StatScaleKind = 'shift' | 'perLevel' | 'shiftPerLevel' | 'percent';

export interface StatScale {
  /** itemstatcost.txt row */
  readonly id: number;
  /** itemstatcost.txt `Stat` */
  readonly name: string;
  /** What the tooltip calls it ("Life", "Strength per level") */
  readonly label: string;
  readonly kind: StatScaleKind;
}

const shift = (id: number, name: string, label: string): StatScale => ({ id, name, label, kind: 'shift' });
const perLevel = (id: number, name: string, label: string): StatScale => ({ id, name, label, kind: 'perLevel' });
const percent = (id: number, name: string, label: string): StatScale => ({ id, name, label, kind: 'percent' });

export const STAT_SCALES: readonly StatScale[] = [
  shift(6, 'hitpoints', 'Life'),
  shift(7, 'maxhp', 'Life'),
  shift(8, 'mana', 'Mana'),
  shift(9, 'maxmana', 'Mana'),
  shift(10, 'stamina', 'Stamina'),
  shift(11, 'maxstamina', 'Stamina'),
  percent(112, 'item_howl', 'Hit Causes Monster to Flee'),
  percent(213, 'item_fear', 'Fear'),
  perLevel(214, 'item_armor_perlevel', 'Defense'),
  perLevel(215, 'item_armorpercent_perlevel', 'Enhanced Defense'),
  { id: 216, name: 'item_hp_perlevel', label: 'Life', kind: 'shiftPerLevel' },
  { id: 217, name: 'item_mana_perlevel', label: 'Mana', kind: 'shiftPerLevel' },
  perLevel(218, 'item_maxdamage_perlevel', 'Maximum Damage'),
  perLevel(219, 'item_maxdamage_percent_perlevel', 'Enhanced Maximum Damage'),
  perLevel(220, 'item_strength_perlevel', 'Strength'),
  perLevel(221, 'item_dexterity_perlevel', 'Dexterity'),
  perLevel(222, 'item_energy_perlevel', 'Energy'),
  perLevel(223, 'item_vitality_perlevel', 'Vitality'),
  perLevel(224, 'item_tohit_perlevel', 'Attack Rating'),
  perLevel(225, 'item_tohitpercent_perlevel', 'Attack Rating %'),
  perLevel(226, 'item_cold_damagemax_perlevel', 'Maximum Cold Damage'),
  perLevel(227, 'item_fire_damagemax_perlevel', 'Maximum Fire Damage'),
  perLevel(228, 'item_ltng_damagemax_perlevel', 'Maximum Lightning Damage'),
  perLevel(229, 'item_pois_damagemax_perlevel', 'Maximum Poison Damage'),
  perLevel(230, 'item_resist_cold_perlevel', 'Cold Resist'),
  perLevel(231, 'item_resist_fire_perlevel', 'Fire Resist'),
  perLevel(232, 'item_resist_ltng_perlevel', 'Lightning Resist'),
  perLevel(233, 'item_resist_pois_perlevel', 'Poison Resist'),
  perLevel(238, 'item_thorns_perlevel', 'Attacker Takes Damage'),
  perLevel(239, 'item_find_gold_perlevel', 'Extra Gold'),
  perLevel(240, 'item_find_magic_perlevel', 'Magic Find'),
  { id: 242, name: 'item_stamina_perlevel', label: 'Stamina', kind: 'shiftPerLevel' },
  perLevel(244, 'item_damage_undead_perlevel', 'Damage to Undead'),
  perLevel(247, 'item_crushingblow_perlevel', 'Crushing Blow'),
  perLevel(250, 'item_deadlystrike_perlevel', 'Deadly Strike'),
  perLevel(365, 'item_magic_damagemax_perlevel', 'Maximum Magic Damage'),
  // ESR 3.3 (itemstatcost.txt 1030 to 1056)
  perLevel(1030, 'item_criticaldamage_perlevel', 'Critical Damage'),
  perLevel(1031, 'item_summmastery_perlevel', 'Summon Mastery'),
  perLevel(1032, 'item_summlife_perlevel', 'Summon Life'),
  perLevel(1033, 'item_acvsmissiles_perlevel', 'Defense vs. Missiles'),
  perLevel(1034, 'item_magpierce_perlevel', 'Magic Pierce'),
  perLevel(1036, 'item_extramag_perlevel', 'Magic Skill Damage'),
  perLevel(1037, 'item_piercefire_perlevel', 'Fire Pierce'),
  perLevel(1038, 'item_piercecold_perlevel', 'Cold Pierce'),
  perLevel(1039, 'item_pierceltng_perlevel', 'Lightning Pierce'),
  perLevel(1042, 'item_fasterattackrate_perlevel', 'Attack Speed'),
  perLevel(1043, 'item_absorb_ltng_perlevel', 'Lightning Absorb'),
  perLevel(1048, 'item_damage_demon_perlevel', 'Damage to Demons'),
  perLevel(1049, 'item_maxmana_percent_perlevel', 'Maximum Mana %'),
  perLevel(1052, 'item_piercedmg_perlevel', 'Pierce Damage'),
  perLevel(1055, 'rune_effect_current_item_perlevel', 'Socketed Effect'),
  perLevel(1056, 'item_maxhp_percent_perlevel', 'Maximum Life %'),
  perLevel(1059, 'item_piercepois_perlevel', 'Poison Pierce'),
];

/** The scale of a check's stat (an itemstatcost name or id), if the game stores it scaled. */
export function statScale(stat: StatCheck['stat']): StatScale | undefined {
  return STAT_SCALES.find((scale) => (typeof stat === 'number' ? scale.id === stat : scale.name === stat));
}

/** Whether the stat reads the value at the character's level (a per-level stat). */
export function isPerLevel(scale: StatScale): boolean {
  return scale.kind === 'perLevel' || scale.kind === 'shiftPerLevel';
}

/**
 * The validator's warning for a check on a per-level stat: what it reads depends on the character's level, so the check
 * holds from some level on (or up to some level). Undefined for the other scaled stats, which read the tooltip number.
 */
export function statScaleMessage(scale: StatScale): string | undefined {
  if (!isPerLevel(scale)) return undefined;
  return `"${scale.name}" (${scale.label} per level) reads the value at your character's level, as the tooltip's "(Based on Character Level)" shows: 0.5 per level reads 0 at level 1 and 49 at level 99, so this check depends on the character level (plugin 1.8.2, the guide).`;
}

/**
 * Stats the game stores scaled (ESR 3.2.24 itemstatcost.txt). Not verified in game: whether the loot filter plugin
 * compares (and prints with `{stat:ID}`) the stored value or the value the tooltip shows.
 * - `ValShift` 8: Life, Mana and Stamina (current and max) are stored ×256, so +40 Life is 10240 in memory.
 * - The `*_perlevel` stats (`op` 2, 4 or 5 with `op param` 3, `op base` level) store the per-level amount in eighths:
 *   the tooltip shows stored × character level / 8, and +1 per level is stored as 8.
 * - `item_hp_perlevel`, `item_mana_perlevel` and `item_stamina_perlevel` have both (`ValShift` 8 too): +1 per level
 *   may be 8 × 256 = 2048 in memory.
 */
import type { StatCheck } from './types.ts';

export type StatScaleKind = 'shift' | 'perLevel' | 'shiftPerLevel';

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

export const STAT_SCALES: readonly StatScale[] = [
  shift(6, 'hitpoints', 'Life'),
  shift(7, 'maxhp', 'Life'),
  shift(8, 'mana', 'Mana'),
  shift(9, 'maxmana', 'Mana'),
  shift(10, 'stamina', 'Stamina'),
  shift(11, 'maxstamina', 'Stamina'),
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
];

/** The scale of a check's stat (an itemstatcost name or id), if the game stores it scaled. */
export function statScale(stat: StatCheck['stat']): StatScale | undefined {
  return STAT_SCALES.find((scale) => (typeof stat === 'number' ? scale.id === stat : scale.name === stat));
}

/** The number a check compares with, for the example: the low end of a range. */
function checkNumber(value: StatCheck['value']): number {
  return typeof value === 'number' ? value : value[0];
}

const SUFFIX = 'Not verified in game; use "Check in game" on this rule to see what the plugin reads.';

/**
 * The validator's warning: how the stat is stored and what the check's number would be as the stored value. The example
 * uses the check's value when it is above 1 (a presence check `>= 1` says nothing about the scale), else +40 / +1.
 */
export function statScaleMessage(scale: StatScale, value: StatCheck['value']): string {
  const number = checkNumber(value);
  const { label, name } = scale;
  if (scale.kind === 'shift') {
    const shown = number > 1 ? number : 40;
    return `The game stores "${name}" ×256: +${String(shown)} ${label} may read as ${String(shown * 256)}. ${SUFFIX}`;
  }
  const shown = number > 1 ? number : 1;
  const stored = scale.kind === 'shiftPerLevel' ? shown * 8 * 256 : shown * 8;
  const how = scale.kind === 'shiftPerLevel' ? 'in eighths per character level, ×256' : 'in eighths per character level';
  return `The game stores "${name}" ${how} (the tooltip shows stored × level / 8): +${String(shown)} ${label} per level may read as ${String(stored)}. ${SUFFIX}`;
}

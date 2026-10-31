/**
 * Item stats the loot filter plugin reads as 0 on some items. The game never writes an op-13 stat (a percentage of a
 * base stat) into an item's full stat list when the item has that base stat (D2MOO `D2StatList`; ESR's own
 * enhanced-damage-fix plugin describes the same rule), and the plugin reads the full list. Verified in game for
 * Enhanced Damage on weapons (a magic Cruel weapon with +214% fails `>= 1` and matches `< 1`); Enhanced Defense on
 * armour and Increased Maximum Durability follow from the same rule.
 */
import type { StatCheck } from './types.ts';

export interface StatQuirk {
  /** itemstatcost.txt row */
  readonly id: number;
  /** itemstatcost.txt `Stat` */
  readonly name: string;
  /** Item types (with descendants) whose items read 0: `weap`, `armo` */
  readonly affects: readonly string[];
  /** The validator's warning */
  readonly message: string;
  /** The affix browser's short note */
  readonly note: string;
}

const ED_MESSAGE =
  "The game keeps Enhanced Damage off a weapon's stats, so the plugin reads 0 here on weapons (it should still work on jewels and charms). Reported to the mod author.";
const ED_NOTE = 'Reads 0 on weapons (the game keeps it off their stats); should still work on jewels and charms.';

export const STAT_QUIRKS: readonly StatQuirk[] = [
  {
    id: 16,
    name: 'item_armor_percent',
    affects: ['armo'],
    message:
      'The game keeps Enhanced Defense off the stats of armour with defense, so the plugin very likely reads 0 here on armour, helms and shields (it should work on jewels and charms). Reported to the mod author.',
    note: 'Very likely reads 0 on armour (the game keeps it off their stats); should work on jewels and charms.',
  },
  { id: 17, name: 'item_maxdamage_percent', affects: ['weap'], message: ED_MESSAGE, note: ED_NOTE },
  { id: 18, name: 'item_mindamage_percent', affects: ['weap'], message: ED_MESSAGE, note: ED_NOTE },
  {
    id: 75,
    name: 'item_maxdurability_percent',
    affects: ['weap', 'armo'],
    message:
      'The game likely keeps Increased Maximum Durability off the stats of items with durability, so the plugin likely reads 0 here on weapons and armour. Reported to the mod author.',
    note: 'Likely reads 0 on weapons and armour (the game keeps it off their stats).',
  },
];

/** The quirk of a check's stat (an itemstatcost name or id), if it has one. */
export function statQuirk(stat: StatCheck['stat']): StatQuirk | undefined {
  return STAT_QUIRKS.find((quirk) => (typeof stat === 'number' ? quirk.id === stat : quirk.name === stat));
}

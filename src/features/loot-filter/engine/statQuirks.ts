/**
 * Item stats the loot filter plugin reads as 0 on some items. The game never writes an op-13 stat (a percentage of a
 * base stat) into an item's full stat list when the item has that base stat (D2MOO `D2StatList`; ESR's own
 * enhanced-damage-fix plugin describes the same rule), and the plugin reads the full list. Verified in game (plugin
 * 1.5.3): Enhanced Damage reads 0 on weapons (a magic Cruel weapon with +214% fails `>= 1` and matches `< 1`) and
 * Enhanced Defense reads 0 on armour (a Godly Body Shield with +201–300% showed `{stat:16}` = 0, 2026-11-01), while
 * Enhanced Damage on a jewel reads correctly (a rare jewel showed `{stat:17}` = 58). Increased Maximum Durability
 * follows from the same rule but is not tested. Plugin 1.8.2 (ESR 3.3) reads tooltip numbers (itemstatcost descfunc,
 * op, ValShift); its guide does not say whether that fixes these, so they stay until checked in game again.
 */
import type { StatCheck } from './types.ts';

export interface StatQuirk {
  /** itemstatcost.txt row */
  readonly id: number;
  /** itemstatcost.txt `Stat` */
  readonly name: string;
  /** Item types (with descendants) whose items read 0: `weap`, `armo` */
  readonly affects: readonly string[];
  /** Seen in game (shown in red) or only inferred (shown in amber) */
  readonly confirmed: boolean;
  /** The short warning shown under a stat check row and in the affix browser and rule problems */
  readonly headline: string;
  /** The validator's warning */
  readonly message: string;
  /** The affix browser's short note */
  readonly note: string;
}

const ED_HEADLINE = 'Currently only works on jewels and charms (reads 0 on weapons)';
const ED_MESSAGE =
  "The game keeps Enhanced Damage off a weapon's stats, so the plugin reads 0 here on weapons (confirmed in game); on jewels and charms it reads correctly (confirmed on a jewel). Reported to the mod author.";
const ED_NOTE =
  'Reads 0 on weapons (the game keeps it off their stats; confirmed in game); works on jewels and charms (confirmed on a jewel).';

export const STAT_QUIRKS: readonly StatQuirk[] = [
  {
    id: 16,
    name: 'item_armor_percent',
    affects: ['armo'],
    confirmed: true,
    headline: 'Does not work on armour, helms and shields (reads 0)',
    message:
      'The game keeps Enhanced Defense off the stats of armour with defense, so the plugin reads 0 here on armour, helms and shields (confirmed in game). Reported to the mod author.',
    note: 'Reads 0 on armour (the game keeps it off their stats; confirmed in game).',
  },
  { id: 17, name: 'item_maxdamage_percent', affects: ['weap'], confirmed: true, headline: ED_HEADLINE, message: ED_MESSAGE, note: ED_NOTE },
  { id: 18, name: 'item_mindamage_percent', affects: ['weap'], confirmed: true, headline: ED_HEADLINE, message: ED_MESSAGE, note: ED_NOTE },
  {
    id: 75,
    name: 'item_maxdurability_percent',
    affects: ['weap', 'armo'],
    confirmed: false,
    headline: 'May not work on weapons and armour (likely reads 0; not tested)',
    message:
      'The game likely keeps Increased Maximum Durability off the stats of items with durability (the same rule as Enhanced Damage and Defense, not tested in game), so the plugin likely reads 0 here on weapons and armour. Reported to the mod author.',
    note: 'Likely reads 0 on weapons and armour (the same rule as Enhanced Damage; not tested in game).',
  },
];

/** The quirk of a check's stat (an itemstatcost name or id), if it has one. */
export function statQuirk(stat: StatCheck['stat']): StatQuirk | undefined {
  return STAT_QUIRKS.find((quirk) => (typeof stat === 'number' ? quirk.id === stat : quirk.name === stat));
}

/** The quirk a validator warning is about (its message is the quirk's `message`), for the rule problems list. */
export function quirkOfMessage(message: string): StatQuirk | undefined {
  return STAT_QUIRKS.find((quirk) => quirk.message === message);
}

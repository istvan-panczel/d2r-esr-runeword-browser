/**
 * The base of an item's tooltip: the stats its sockets give, its stat totals, and the base lines with their filter
 * values (damage, defense, durability, requirements, quantity, ethereal, sockets), following D2's tooltip formulas
 * with the itemtext.json base data (`bases`, `socketables`, `levels`). Internal to itemText.ts.
 *
 * - **Socket fillers** (runes, gems: compact items with no saved stats) give the gems.txt column of the parent's gem
 *   apply type (0 weapon, 1 helm, 2 shield; per item code, ESR sets body armor to 2, boots to 1 …); jewels give their
 *   saved stats. They count on runeword and gemword items too: the game applies socketed stats to every item.
 * - **Damage** (weapons): base damage (one-hand / two-hand / throw), ×1.5 when ethereal, × (100 + enhanced min / max
 *   damage %) / 100, + min / max damage; a max below the min becomes min + 1. Per-level damage depends on the
 *   character and is left out.
 * - **Requirements**: strength / dexterity = base × (100 + requirements %) / 100, −10 when ethereal; level = the highest
 *   of the base, the unique / set item, the magic / rare affixes, the automagic affix and the socketed items, + the
 *   item's "required level" stat; crafted items: the affix level + 10 + 3 per affix (D2's rule, unverified in ESR).
 *   Not applied: inferior items' damage / defense penalty (unverified, none in the fixture).
 */
import type { ItemTextBase, ItemTextSavedStat } from '@/features/game-data/engine/schema';
import type { StashItem, StashStat } from '../../parser/types';
import type { StatValue } from './itemText';
import { foldSecondary, STAT_ID, type TextData } from './textData';

const REQ_PERCENT = 91;
const LEVEL_REQ = 92;
const MAX_LEVEL = 99;

/** A code's base data; undefined for a code without any (the record only lists codes with data) */
const baseOf = (bases: Readonly<Record<string, ItemTextBase>>, code: string): ItemTextBase | undefined => bases[code];

const toStat = ([id, param, value]: ItemTextSavedStat): StashStat => ({ id, param, value });

/** The stats a socketed item gives its parent: a socket filler's gems.txt column, else its own saved stats */
export function socketStats(child: StashItem, parent: StashItem, data: TextData | null): StashStat[] {
  const columns = data?.bundle.socketables[child.code];
  if (columns === undefined) return child.stats;
  const column = columns[data?.bundle.bases[parent.code]?.gem ?? 0] ?? columns[0];
  return [...column.map(toStat), ...child.stats];
}

/**
 * The stats that count for an item's tooltip totals: its own, its runeword's and those of its sockets, each list with
 * its two-hand damage folded into min / max damage (textData.ts `foldSecondary`)
 */
export function totalStats(item: StashItem, data: TextData | null): StashStat[] {
  return [item.stats, item.runewordStats, ...item.socketed.map((child) => socketStats(child, item, data))].flatMap(foldSecondary);
}

function sumOf(stats: readonly StashStat[], id: number): number {
  return stats.reduce((sum, stat) => (stat.id === id ? sum + stat.value : sum), 0);
}

/**
 * The required level of an item: its own (the highest of the base, the unique / set item and the affixes; a crafted
 * item's affix level + 10 + 3 per affix; + its own `item_levelreq` stats) against those of its socketed items (each
 * with its own `item_levelreq`, counted once)
 */
export function requiredLevel(item: StashItem, data: TextData): number {
  const { bases, levels } = data.bundle;
  // unique / set item ids are 0-based rows (0 = Autolycus' Robes, The Perfect Cello); affix ids are 1-based, 0 = none
  const row = (list: readonly number[], id: number | null) => (id === null ? 0 : (list[id] ?? 0));
  const affix = (list: readonly number[], id: number | null) => (id === null || id === 0 ? 0 : (list[id] ?? 0));
  let affixLevel = Math.max(
    affix(levels.autoAffixes, item.autoAffixId),
    ...item.prefixIds.map((id) => affix(levels.magicPrefixes, id)),
    ...item.suffixIds.map((id) => affix(levels.magicSuffixes, id))
  );
  if (item.quality === 'crafted') affixLevel += 10 + 3 * [...item.prefixIds, ...item.suffixIds].filter((id) => id !== 0).length;
  const own =
    Math.max(
      baseOf(bases, item.code)?.lvl ?? 0,
      item.quality === 'unique' ? row(levels.uniques, item.uniqueId) : 0,
      item.quality === 'set' ? row(levels.setItems, item.setId) : 0,
      affixLevel
    ) + sumOf([...item.stats, ...item.runewordStats], LEVEL_REQ);
  return Math.min(MAX_LEVEL, Math.max(own, ...item.socketed.map((child) => requiredLevel(child, data))));
}

interface BaseText {
  readonly lines: string[];
  readonly values: StatValue[];
}

const value = (key: string, label: string, shown: number, range?: { min: number; max: number }): StatValue => ({
  key,
  statKey: key,
  statId: null,
  param: null,
  label,
  statLabel: label,
  paramLabel: null,
  value: shown,
  ...(range === undefined ? {} : { range }),
});

/** The base lines (tooltip order) and their filter values (`b.*` keys); without data the saved fields only */
export function baseText(item: StashItem, data: TextData | null): BaseText {
  const lines: string[] = [];
  const values: StatValue[] = [];
  const stats = data === null ? [] : totalStats(item, data);
  const base = data?.bundle.bases[item.code];

  if (data !== null && base !== undefined) {
    const ed = { min: sumOf(stats, STAT_ID.minDamagePercent), max: sumOf(stats, STAT_ID.maxDamagePercent) };
    const flat = { min: sumOf(stats, STAT_ID.minDamage), max: sumOf(stats, STAT_ID.maxDamage) };
    const damage = (range: [number, number] | undefined, key: string, label: string) => {
      if (range === undefined) return;
      const [baseMin, baseMax] = item.ethereal ? range.map((part) => Math.floor(part * 1.5)) : range;
      const min = Math.floor((baseMin * (100 + ed.min)) / 100) + flat.min;
      const rawMax = Math.floor((baseMax * (100 + ed.max)) / 100) + flat.max;
      const max = rawMax <= min ? min + 1 : rawMax;
      lines.push(`${label}: ${String(min)} to ${String(max)}`);
      values.push(value(key, `${label}: # to #`, max, { min, max }));
    };
    // D2's tooltip writes the throw damage above the one-hand damage
    damage(base.dt, 'b.dmgthrow', 'Throw Damage');
    damage(base.d1, 'b.dmg1', 'One-Hand Damage');
    damage(base.d2, 'b.dmg2', 'Two-Hand Damage');
  }

  if (item.defense !== null) {
    const defense = Math.floor((item.defense * (100 + sumOf(stats, STAT_ID.armorPercent))) / 100) + sumOf(stats, STAT_ID.armorClass);
    lines.push(`Defense: ${String(defense)}`);
    if (data !== null) values.push(value('b.def', 'Defense: #', defense));
  }
  // Max durability as saved: whether the tooltip adds item_maxdurability_percent (op 13) is unverified (no fixture
  // item has it), so it is not applied
  if (item.maxDurability !== null) {
    lines.push(
      item.maxDurability === 0 ? 'Indestructible' : `Durability: ${String(item.durability ?? 0)} of ${String(item.maxDurability)}`
    );
  }
  if (item.quantity !== null) lines.push(`Quantity: ${String(item.quantity)}`);

  if (data !== null) {
    const percent = sumOf(stats, REQ_PERCENT);
    const requirement = (amount: number | undefined) => {
      if (amount === undefined || amount === 0) return 0;
      return Math.max(0, Math.floor((amount * (100 + percent)) / 100) - (item.ethereal ? 10 : 0));
    };
    const dex = requirement(base?.dex);
    const str = requirement(base?.str);
    const level = requiredLevel(item, data);
    if (dex > 0) {
      lines.push(`Required Dexterity: ${String(dex)}`);
      values.push(value('b.reqdex', 'Required Dexterity: #', dex));
    }
    if (str > 0) {
      lines.push(`Required Strength: ${String(str)}`);
      values.push(value('b.reqstr', 'Required Strength: #', str));
    }
    if (level > 0) {
      lines.push(`Required Level: ${String(level)}`);
      values.push(value('b.reqlvl', 'Required Level: #', level));
    }
  }

  if (item.ethereal) lines.push('Ethereal (Cannot be Repaired)');
  if (item.sockets !== null) lines.push(`Socketed (${String(item.sockets)})`);
  return { lines, values };
}

/**
 * Which items count and what they give, as contributions (stat-list units):
 *
 * - Equipped items of the active weapon set (VERIFIED: only set I counts on the three ground-truth saves) and charms in
 *   the Charm Inventory (store page 7; charms elsewhere do nothing while charm-inv `allow_inventory_charms` is false).
 * - Charm dedup (charm-dedup plugin groups): only the first charm of a group in save order counts (the plugin keeps the
 *   lowest unit id, items loading with the character come in save order). INFERRED order, VERIFIED totals.
 * - An item's stats: its own list, its runeword list, its socketed items (a filler's gems.txt column for the host's gem
 *   apply type, a jewel's own stats) and the set bonus lists it carries, list i active with the pieces itemtext.json
 *   `setBonusPieces` names (D2: i + 2).
 * - sets.txt partial / full bonuses by pieces worn: the save holds none of them (VERIFIED on Soso's Arcanna's set).
 * - Runic Insight (archaeology_3 > 0 in gf): the runes' own modifiers pooled per stat and param over the active hosts,
 *   the percent taken once (toward zero) and split back by host (each its own truncated share, the pooling gain to the
 *   host that lost most); per-item stats (op 13) pool per host only. VERIFIED on SpinToWin.
 * - Dual wield: a weapon in each hand. A weapon is a weapons.txt code that is not a quiver (charsheet.json `quivers`:
 *   ESR lists its magic arrows / bolts in weapons.txt, but by item type they are missiles), so a bow or crossbow with a
 *   quiver, a two-handed weapon, and a weapon with a shield are one weapon. The off-hand weapon's own attack speed,
 *   deadly strike, crushing blow, target defense and to-hit (and their per-level stats) stay on that weapon (VERIFIED:
 *   SpinToWin's IAS 205 leaves out the off-hand sword's 100; the per-level attack speed INFERRED alike).
 * - Set pieces worn count distinct set items: two copies of one set ring are one piece (INFERRED: D2 counts set items
 *   by their set item id).
 */
import type { CharacterFile, CharacterItem } from '../../parser/types';
import { requiredLevel, socketStats, REQ_PERCENT } from '@/features/stash/engine/items/baseLines';
import { foldSecondary } from '@/features/stash/engine/items/textData';
import type { StashStat } from '@/features/stash/parser/types';
import type { SheetData } from './sheetData';
import { addStat, entryOf, fromSaved, type Contribution, type StatMap } from './statMap';

export interface ActiveItem {
  /** Index into character.items.player */
  index: number;
  item: CharacterItem;
  /** "head", "right hand", "charm 2,3" */
  where: string;
  charm: boolean;
  /** Own + runeword + sockets + active saved set lists */
  stats: StatMap;
  /** Socketed runes' own modifiers (Runic Insight input), saved units */
  runeStats: StashStat[];
}

export interface ItemSetup {
  weaponSet: 1 | 2;
  active: ActiveItem[];
  /** Weapon in the right hand (else the left one when the right is empty) */
  mainHand: ActiveItem | null;
  /** The second weapon when both hands hold one */
  offHand: ActiveItem | null;
  /** A hand item with a block value (armor.txt `block`) */
  shield: ActiveItem | null;
  /** Item contributions (own stats, runic shares) and set bonus contributions */
  contributions: Contribution[];
  /** The off-hand weapon's own attack stats, kept out of the totals */
  offHandLocal: StatMap;
  warnings: string[];
}

const SLOT_LABELS: Readonly<Record<string, string>> = {
  head: 'head',
  neck: 'amulet',
  torso: 'body armour',
  rightHand: 'right hand',
  leftHand: 'left hand',
  rightRing: 'right ring',
  leftRing: 'left ring',
  belt: 'belt',
  feet: 'boots',
  gloves: 'gloves',
};

/** Off-hand weapon stats that belong to that weapon's own attack (itemstatcost names) */
const WEAPON_LOCAL = [
  'item_fasterattackrate',
  'item_fasterattackrate_perlevel',
  'tohit',
  'item_tohit_percent',
  'item_tohit_perlevel',
  'item_deadlystrike',
  'item_deadlystrike_perlevel',
  'item_crushingblow',
  'item_crushingblow_perlevel',
  'item_fractionaltargetac',
];

/** A hand weapon: a weapons.txt code that is not a quiver (bow + quiver is one weapon, not dual wield) */
export function isWeapon(data: SheetData, item: CharacterItem | null): boolean {
  return item !== null && Object.hasOwn(data.bundle.weaponSpeed, item.code) && !data.bundle.quivers.includes(item.code);
}

function whereOf(item: CharacterItem): string {
  const location = item.location;
  if (location.kind === 'equipped') return SLOT_LABELS[location.slot] ?? location.slot;
  if (location.kind === 'charm' || location.kind === 'inventory') return `charm ${String(location.x)},${String(location.y)}`;
  return location.kind;
}

/** The items that count, in save order: active equipped items, then charm inventory charms (after dedup) */
function activeItems(character: CharacterFile, data: SheetData, warnings: string[]): { index: number; item: CharacterItem }[] {
  const weaponSet = character.activeWeapon === 1 ? 2 : 1;
  const groups = data.bundle.rules.charmDedup;
  const usedGroups = new Set<number>();
  const result: { index: number; item: CharacterItem }[] = [];
  character.items.player.forEach((item, index) => {
    const location = item.location;
    if (location.kind === 'equipped') {
      if (location.weaponSet === null || location.weaponSet === weaponSet) result.push({ index, item });
      return;
    }
    if (location.kind !== 'charm') return;
    const group = groups.findIndex((codes) => codes.includes(item.code));
    if (group >= 0) {
      if (usedGroups.has(group)) {
        warnings.push(`Charm ${item.code} at ${whereOf(item)} is inactive: only one charm of ${groups[group]?.join(' / ') ?? ''} counts`);
        return;
      }
      usedGroups.add(group);
    }
    result.push({ index, item });
  });
  if (data.bundle.rules.inventoryCharms)
    warnings.push('ESR counts charms in the inventory too (charm-inv allow_inventory_charms): the sheet counts only the Charm Inventory');
  return result;
}

function requirementWarnings(entry: ActiveItem, character: CharacterFile, data: SheetData, warnings: string[]): void {
  const level = requiredLevel(entry.item, data.text);
  if (level > character.level)
    warnings.push(`${entry.item.code} (${entry.where}) needs level ${String(level)}: the game may not count it, the sheet does`);
  // Strength / dexterity requirements are checked against the final attributes later (sheet.ts)
}

/** Required strength / dexterity of an item (requirement %, ethereal −10), as the stash tooltip computes them */
export function itemRequirements(item: CharacterItem, data: SheetData): { str: number; dex: number } {
  const base = entryOf(data.text.bundle.bases, item.code);
  const percent = [...item.stats, ...item.runewordStats].reduce((sum, stat) => (stat.id === REQ_PERCENT ? sum + stat.value : sum), 0);
  const req = (amount: number | undefined) =>
    amount === undefined || amount === 0 ? 0 : Math.max(0, Math.floor((amount * (100 + percent)) / 100) - (item.ethereal ? 10 : 0));
  return { str: req(base?.str), dex: req(base?.dex) };
}

export function setupItems(character: CharacterFile, data: SheetData): ItemSetup {
  const warnings: string[] = [];
  const weaponSet: 1 | 2 = character.activeWeapon === 1 ? 2 : 1;
  const listed = activeItems(character, data, warnings);
  const valShift = (id: number) => data.valShift(id);
  const layered = new Set([data.stat.item_singleskill, data.stat.item_nonclassskill, data.stat.item_aura]);
  const runes = new Set(data.bundle.rules.runicInsight?.runes ?? []);

  // Set pieces worn (equipped items only): distinct set items, two copies of one set ring are one piece
  const setIndex = (item: CharacterItem) => (item.setId === null ? -1 : (data.bundle.setItems.at(item.setId) ?? -1));
  const worn = new Map<number, Set<number>>();
  for (const { item } of listed) {
    const set = setIndex(item);
    if (item.location.kind !== 'equipped' || item.setId === null || set < 0) continue;
    worn.set(set, (worn.get(set) ?? new Set<number>()).add(item.setId));
  }
  const pieces = new Map([...worn].map(([set, ids]) => [set, ids.size]));

  const active: ActiveItem[] = listed.map(({ index, item }) => {
    const lists: StashStat[] = [...foldSecondary(item.stats), ...foldSecondary(item.runewordStats)];
    const runeStats: StashStat[] = [];
    for (const child of item.socketed) {
      lists.push(...foldSecondary(socketStats(child, item, data.text)));
      if (runes.has(child.code)) runeStats.push(...foldSecondary(socketStats({ ...child, stats: [] }, item, data.text)));
    }
    if (item.setId !== null && item.setBonusStats.length > 0) {
      const worn = pieces.get(setIndex(item)) ?? 0;
      const needs = data.text.bundle.setBonusPieces?.[String(item.setId)];
      item.setBonusStats.forEach((list, i) => {
        if (worn >= (needs?.[i] ?? i + 2)) lists.push(...foldSecondary(list));
      });
    }
    return {
      index,
      item,
      where: whereOf(item),
      charm: item.location.kind === 'charm',
      stats: fromSaved(lists, valShift, layered),
      runeStats,
    };
  });
  for (const entry of active) requirementWarnings(entry, character, data, warnings);

  const hand = (slot: 'rightHand' | 'leftHand') =>
    active.find((entry) => entry.item.location.kind === 'equipped' && entry.item.location.slot === slot) ?? null;
  const right = hand('rightHand');
  const left = hand('leftHand');
  const mainHand = isWeapon(data, right?.item ?? null) ? right : isWeapon(data, left?.item ?? null) ? left : null;
  const offHand = mainHand === right && isWeapon(data, left?.item ?? null) ? left : null;
  const shield = [right, left].find((entry) => entry !== null && (entryOf(data.bundle.armor, entry.item.code)?.block ?? 0) > 0) ?? null;

  const contributions: Contribution[] = [];
  const offHandLocal: StatMap = new Map();
  const local = new Set(WEAPON_LOCAL.flatMap((name) => data.statId(name) ?? []));
  const own = (entry: ActiveItem, stats: StatMap): StatMap => {
    if (entry !== offHand) return stats;
    const kept: StatMap = new Map();
    for (const [id, inner] of stats) for (const [param, value] of inner) addStat(local.has(id) ? offHandLocal : kept, id, param, value);
    return kept;
  };
  for (const entry of active) contributions.push({ kind: 'item', label: entry.where, item: entry.index, stats: own(entry, entry.stats) });

  // Runic Insight shares, per host
  const runic = data.bundle.rules.runicInsight;
  const learned = runic !== null && character.attributes.some((stat) => stat.id === runic.stat && stat.raw > 0);
  if (runic !== null && learned) {
    const raised = new Set(runic.stats);
    const perItem = new Set(runic.perItemStats);
    const pools = new Map<string, { id: number; param: number; hosts: Map<ActiveItem, number> }>();
    active.forEach((entry, host) => {
      for (const stat of entry.runeStats) {
        if (!raised.has(stat.id)) continue;
        const key = perItem.has(stat.id)
          ? `${String(stat.id)}:${String(stat.param)}:${String(host)}`
          : `${String(stat.id)}:${String(stat.param)}`;
        const pool = pools.get(key) ?? { id: stat.id, param: stat.param, hosts: new Map<ActiveItem, number>() };
        pool.hosts.set(entry, (pool.hosts.get(entry) ?? 0) + stat.value);
        pools.set(key, pool);
      }
    });
    const shares = new Map<ActiveItem, StashStat[]>();
    for (const pool of pools.values()) {
      const total = [...pool.hosts.values()].reduce((sum, value) => sum + value, 0);
      const pooled = Math.trunc((total * runic.percent) / 100);
      const parts = [...pool.hosts].map(([entry, value]) => {
        const exact = (value * runic.percent) / 100;
        return { entry, share: Math.trunc(exact), loss: Math.abs(exact - Math.trunc(exact)) };
      });
      let rest = pooled - parts.reduce((sum, part) => sum + part.share, 0);
      parts.sort((a, b) => b.loss - a.loss);
      for (const part of parts) {
        const step = rest > 0 ? 1 : rest < 0 ? -1 : 0;
        rest -= step;
        const bonus = part.share + step;
        if (bonus !== 0) shares.set(part.entry, [...(shares.get(part.entry) ?? []), { id: pool.id, param: pool.param, value: bonus }]);
      }
    }
    for (const [entry, stats] of shares)
      contributions.push({
        kind: 'runic',
        label: `Runic Insight (${entry.where})`,
        item: entry.index,
        stats: own(entry, fromSaved(stats, valShift, layered)),
      });
  }

  // sets.txt bonuses
  for (const [set, worn] of pieces) {
    const info = data.bundle.sets.at(set);
    if (info === undefined) continue;
    const saved: StashStat[] = [];
    for (const partial of info.partial)
      if (worn >= partial.pieces) saved.push(...partial.stats.map(([id, param, value]) => ({ id, param, value })));
    if (worn >= info.items && info.items > 0) saved.push(...info.full.map(([id, param, value]) => ({ id, param, value })));
    if (saved.length > 0)
      contributions.push({
        kind: 'set',
        label: `${info.key} (${String(worn)}/${String(info.items)})`,
        stats: fromSaved(saved, valShift, layered),
      });
  }

  return { weaponSet, active, mainHand, offHand, shield, contributions, offHandLocal, warnings };
}

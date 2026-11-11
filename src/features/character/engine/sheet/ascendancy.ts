/**
 * The character's ascendancy (ESR 3.3.04+: the ascendancy panel plugin, charsheet.json `ascendancies` from
 * celestialrayone.ascendancies.toml). A save holds four character stats: the ascendancy (1-based index in the toml's
 * window order, 0 = none), the progress bits (0–4 = tiers 1–5, 5 = the Lich King bonus, 6 = ascended once), the
 * Primordial Soulstones and the Orb of Creation. The plugin applies the unlocked tiers' properties on the host in every
 * game; nothing of them is saved, so the sheet adds them as one contribution.
 *
 * An older save (before 3.3.04) holds an Ascendancy Stone instead: when a character with no ascendancy enters a game
 * holding one, the plugin turns it into the saved stats (the stone's uniqueitems row picks the ascendancy, its tier
 * stats the tiers) and removes it. The sheet does the same: the stone in the Charm Inventory first, else one anywhere
 * on the character (the plugin says "holding"; INFERRED), read through the same toml data, and the stone's own stats
 * no longer count (activeItems.ts leaves it out).
 */
import type { CharSheetAscendancies, CharSheetAscendancy } from '@/features/game-data/engine/schema';
import type { CharacterFile, CharacterItem } from '../../parser/types';

/** progress_stat bits (toml header) */
const TIER_BITS = 5;
const LICH_KING_BIT = 5;
const ASCENDED_BIT = 6;

export interface SheetAscendancy {
  /** Where it was read: the save's ascendancy stats, or an old Ascendancy Stone the game converts on the next login */
  source: 'save' | 'stone';
  /** The saved index (1-based, window order); 0 = none chosen */
  index: number;
  /** null when none is chosen, or this app's data does not know the saved index */
  name: string | null;
  /** Unlocked tiers, ascending */
  tiers: number[];
  lichKing: boolean;
  /** The character has ascended at least once (progress bit 6) */
  ascendedOnce: boolean;
  soulstones: number;
  /** Soulstones that unlock `soulstoneTier` (the toml's soulstone_cap) */
  soulstoneCap: number;
  soulstoneTier: number;
  /** The Orb of Creation is consumed (the panel is open) */
  orbConsumed: boolean;
  /** Index into `character.items.player` of the stone it was read from (source `stone`) */
  stoneItem?: number;
}

/** The toml entry of an ascendancy that the sheet applies; null for none or an unknown index */
export function ascendancyEntry(ascendancy: SheetAscendancy, data: CharSheetAscendancies): CharSheetAscendancy | null {
  return ascendancy.index > 0 ? (data.list.at(ascendancy.index - 1) ?? null) : null;
}

function savedValue(character: Pick<CharacterFile, 'attributes'>, id: number): number {
  return character.attributes.find((attribute) => attribute.id === id)?.raw ?? 0;
}

function itemValue(item: CharacterItem, id: number): number {
  return item.stats.reduce((sum, stat) => (stat.id === id ? sum + stat.value : sum), 0);
}

/** The stone the plugin converts: a known stone in the Charm Inventory first, else the first one anywhere on the character */
function legacyStone(
  items: readonly CharacterItem[],
  data: CharSheetAscendancies
): { index: number; item: CharacterItem; entry: CharSheetAscendancy } | null {
  const stones = items.flatMap((item, index) => {
    if (item.code !== data.legacy.item) return [];
    const entry = data.list.find((candidate) => candidate.legacyUnique === item.uniqueId);
    return entry === undefined ? [] : [{ index, item, entry }];
  });
  return stones.find((stone) => stone.item.location.kind === 'charm') ?? stones.at(0) ?? null;
}

/**
 * The character's ascendancy from the saved stats, else from an old stone; null when the save has neither (no orb
 * consumed, no ascendancy, no stone) or the bundle has no ascendancy data.
 */
export function readAscendancy(
  character: Pick<CharacterFile, 'attributes' | 'items'>,
  data: CharSheetAscendancies | null
): SheetAscendancy | null {
  if (data === null) return null;
  const index = savedValue(character, data.stats.ascendancy);
  const progress = savedValue(character, data.stats.progress);
  const soulstones = savedValue(character, data.stats.soulstones);
  const orb = savedValue(character, data.stats.orb);
  const base = { soulstoneCap: data.soulstoneCap, soulstoneTier: data.soulstoneTier };
  if (index > 0)
    return {
      source: 'save',
      index,
      name: data.list.at(index - 1)?.name ?? null,
      tiers: Array.from({ length: TIER_BITS }, (_, bit) => bit).flatMap((bit) => ((progress >> bit) & 1 ? [bit + 1] : [])),
      lichKing: ((progress >> LICH_KING_BIT) & 1) === 1,
      ascendedOnce: ((progress >> ASCENDED_BIT) & 1) === 1,
      soulstones,
      orbConsumed: orb > 0,
      ...base,
    };
  const stone = legacyStone(character.items.player, data);
  if (stone !== null) {
    const stoneSoulstones = itemValue(stone.item, data.legacy.soulstoneStat);
    const tiers = new Set([1, ...data.legacy.tierStats.flatMap((id, i) => (itemValue(stone.item, id) > 0 ? [i + 2] : []))]);
    if (data.soulstoneTier > 0 && stoneSoulstones >= data.soulstoneCap) tiers.add(data.soulstoneTier);
    return {
      source: 'stone',
      index: stone.entry.index,
      name: stone.entry.name,
      tiers: [...tiers].sort((a, b) => a - b),
      lichKing: itemValue(stone.item, data.legacy.lichKingStat) > 0,
      ascendedOnce: true,
      // A save from before 3.3.04 has no saved count; the stone's is the one the plugin takes over
      soulstones: Math.max(soulstones, stoneSoulstones),
      orbConsumed: true,
      stoneItem: stone.index,
      ...base,
    };
  }
  // The orb consumed (or a renounced ascendancy's leftovers) without a chosen ascendancy
  if (progress > 0 || soulstones > 0 || orb > 0)
    return {
      source: 'save',
      index: 0,
      name: null,
      tiers: [],
      lichKing: ((progress >> LICH_KING_BIT) & 1) === 1,
      ascendedOnce: ((progress >> ASCENDED_BIT) & 1) === 1,
      soulstones,
      orbConsumed: orb > 0,
      ...base,
    };
  return null;
}

/**
 * The saved stats the plugin applies for the unlocked tiers (and the Lich King bonus), item units: each tier's
 * properties and its `class-skills` value as the character's class skill stat
 */
export function ascendancyStats(
  ascendancy: SheetAscendancy,
  classId: number,
  data: CharSheetAscendancies
): { id: number; param: number; value: number }[] {
  const entry = ascendancyEntry(ascendancy, data);
  if (entry === null) return [];
  const stats: { id: number; param: number; value: number }[] = [];
  let classSkills = 0;
  for (const tier of ascendancy.tiers) {
    const bonus = entry.tiers.at(tier - 1);
    if (bonus === undefined) continue;
    classSkills += bonus.classSkills;
    stats.push(...bonus.stats.map(([id, param, value]) => ({ id, param, value })));
  }
  const classStat = data.classSkills.at(classId);
  if (classSkills !== 0 && classStat !== undefined) stats.push({ id: classStat[0], param: classStat[1], value: classSkills });
  if (ascendancy.lichKing) stats.push(...data.lichKing.map(([id, param, value]) => ({ id, param, value })));
  return stats;
}

/** "tiers 1–4", "tier 1", "tiers 1, 2 and 5" */
export function tiersText(tiers: readonly number[]): string {
  if (tiers.length === 0) return 'no tier';
  if (tiers.length === 1) return `tier ${String(tiers[0])}`;
  const first = tiers[0];
  const last = tiers[tiers.length - 1];
  if (last - first === tiers.length - 1) return `tiers ${String(first)}–${String(last)}`;
  return `tiers ${tiers.slice(0, -1).join(', ')} and ${String(last)}`;
}

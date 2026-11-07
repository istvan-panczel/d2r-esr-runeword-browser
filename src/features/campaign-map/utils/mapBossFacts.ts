/**
 * The "Boss" section of an endgame map zone's detail panel, as plain data: how the zone opens, its bosses with their
 * fight, how to hurt them, the rewards from the game files (areas.json `mapBosses`) and where the official Endgame Maps
 * page says otherwise. Pure (the component only renders it).
 */
import type { MapBoss, MapBossReward } from '@/features/game-data/engine/schema';
import type { MapBossFacts, OfficialBossRewards } from '../data/mapBosses';
import type { CampaignArea, CampaignMap, CampaignNote } from '../engine/types';

export interface BossRewardLine {
  readonly key: string;
  readonly label: string;
  /** "25%", "always" */
  readonly chance: string;
  /** The players-8 chance when it differs ("50%") */
  readonly players8: string | null;
  /** Extra words after the chance ("until you have collected 10", "one at random") */
  readonly note: string | null;
  /** What the official page says instead, when it differs ("35%", "a whole key set") */
  readonly official: string | null;
}

export interface BossCard {
  readonly id: string;
  readonly name: string;
  /** The arenas it fights in (its own first) */
  readonly arenaIds: readonly number[];
  /** It fights in the selected area */
  readonly here: boolean;
  readonly fight: readonly CampaignNote[];
  readonly damage: CampaignNote | null;
  readonly uber: readonly CampaignNote[];
  readonly rewards: readonly BossRewardLine[];
  readonly otherRolls: number;
  /** "+2 Worldstone Shards", "no terrorized loot table in the files" */
  readonly terror: string;
  /** What the official page says about terrorized shards, when it differs */
  readonly terrorOfficial: string | null;
  /** Bosses of other zones whose loot table it uses (names) */
  readonly sameTableAs: readonly string[];
  /** "Eternal Hourglass of the Timeless Sands": dropped by the last of the set to die (launcher plugin) */
  readonly setDrop: { readonly unique: string; readonly with: readonly string[] } | null;
  /** No hand-written facts (a boss new in this ESR version) */
  readonly uncurated: boolean;
}

export interface ZoneBossSummary {
  readonly zone: string;
  readonly tier: number;
  /** The map item that opens the zone, and the zone's first level */
  readonly mapItemName: string | null;
  readonly entryId: number | null;
  readonly bosses: readonly BossCard[];
  /** Only this many of the bosses come (Chaos Rift: two of the tier 1 bosses) */
  readonly pick: number | null;
  /** A zone without a boss: the most unique packs of its levels in Hell */
  readonly noBoss: { readonly uniques: readonly [number, number] | null } | null;
}

/** 0.05 → "5%", 0.1667 → "16.7%", 1 → "always" */
export function chanceText(chance: number): string {
  const percent = chance * 100;
  if (percent >= 99.995) return 'always';
  const rounded = Math.round(percent * 10) / 10;
  return `${String(rounded)}%`;
}

const percentsDiffer = (files: number, page: number) => Math.abs(files * 100 - page) > 0.5;

/** "stat('…')<10" → "until you have collected 10" */
function conditionNote(condition: string | undefined): string | null {
  if (condition === undefined) return null;
  const limit = /<\s*(\d+)\s*$/.exec(condition)?.[1];
  return limit === undefined ? 'only while a condition in the files holds' : `until you have collected ${limit}`;
}

function officialFor(reward: MapBossReward, page: OfficialBossRewards, pageItem: string | undefined): string | null {
  switch (reward.kind) {
    case 'orb':
      return page.orb !== undefined && percentsDiffer(reward.chance[0], page.orb) ? `${String(page.orb)}%` : null;
    case 'map': {
      if (page.map === undefined) return null;
      const tierDiffers = !(reward.tiers ?? []).includes(page.map.tier);
      if (!tierDiffers && !percentsDiffer(reward.chance[0], page.map.chance)) return null;
      return tierDiffers ? `tier ${String(page.map.tier)} map, ${String(page.map.chance)}%` : `${String(page.map.chance)}%`;
    }
    case 'key': {
      if (page.key === undefined) return null;
      const oneKey = reward.expected === undefined;
      if (page.key.set === true && oneKey) return `a whole key set, ${String(page.key.chance)}%`;
      return percentsDiffer(reward.chance[0], page.key.chance) ? `${String(page.key.chance)}%` : null;
    }
    case 'item':
      return pageItem !== undefined && pageItem !== reward.label ? `calls it ${pageItem}` : null;
    case 'token':
    case 'soulstone':
      return null;
  }
}

function rewardLines(boss: MapBoss, page: OfficialBossRewards | undefined): BossRewardLine[] {
  // The page's item names the files do not have, paired in order with the files' items the page does not name
  const items = boss.rewards.filter((reward) => reward.kind === 'item');
  const pageOnly = (page?.items ?? []).filter((name) => !items.some((reward) => reward.label === name));
  const unnamed = items.filter((reward) => !(page?.items ?? []).includes(reward.label));
  return boss.rewards.map((reward, index) => {
    const players8 = reward.chance[1] !== reward.chance[0] ? chanceText(reward.chance[1]) : null;
    const note =
      reward.kind === 'soulstone'
        ? conditionNote(reward.condition)
        : reward.kind === 'key'
          ? reward.expected === undefined
            ? 'one of the three, at random'
            : 'several keys'
          : reward.kind === 'token' && players8 === null
            ? 'players setting does not raise it'
            : null;
    const pageItem = reward.kind === 'item' && pageOnly.length > 0 && unnamed.length === 1 ? pageOnly[0] : undefined;
    return {
      key: `${reward.kind}-${String(index)}`,
      label: reward.label,
      chance: chanceText(reward.chance[0]),
      players8,
      note,
      official: page === undefined ? null : officialFor(reward, page, pageItem),
    };
  });
}

function terrorText(boss: MapBoss): string {
  if (boss.terrorShards === null) return 'no terrorized loot table in the files';
  const shards = boss.terrorShards;
  const base = shards === 0 ? 'no Worldstone Shards' : `+${String(shards)} Worldstone Shard${shards === 1 ? '' : 's'}`;
  const missing = boss.terrorMissing ?? [];
  return missing.length === 0 ? base : `${base}, but without the ${missing.join(' or ')} roll`;
}

function terrorOfficial(boss: MapBoss, page: OfficialBossRewards | undefined): string | null {
  if (page === undefined) return null;
  const shards = boss.terrorShards ?? 0;
  if (page.terror === 'one' && shards !== 1) return 'one shard';
  if (page.terror === 'none' && shards > 0) return 'no shards from tier 5 bosses';
  return null;
}

export function bossCard(boss: MapBoss, facts: MapBossFacts | undefined, here: boolean, nameOfBoss: (id: string) => string): BossCard {
  return {
    id: boss.id,
    name: boss.name,
    arenaIds: boss.arenas,
    here,
    fight: facts?.fight ?? [],
    damage: facts?.damage ?? null,
    uber: facts?.uber ?? [],
    rewards: rewardLines(boss, facts?.page),
    otherRolls: boss.otherRolls,
    terror: terrorText(boss),
    terrorOfficial: terrorOfficial(boss, facts?.page),
    sameTableAs: (boss.sameTableAs ?? []).map(nameOfBoss),
    setDrop: boss.setDrop === undefined ? null : { unique: boss.setDrop.unique, with: boss.setDrop.with.map(nameOfBoss) },
    uncurated: facts === undefined,
  };
}

/** The boss summary of a tiered endgame map zone, for any of its levels; null outside the tiered maps */
export function zoneBossSummary(
  map: CampaignMap,
  area: CampaignArea,
  bosses: readonly MapBoss[],
  facts: Readonly<Record<string, MapBossFacts>>
): ZoneBossSummary | null {
  const { tier, group } = area.area;
  if (tier === undefined || group === undefined) return null;
  const zoneAreas = [...map.areas.values()].filter((other) => other.area.tier !== undefined && other.area.group === group);
  const byId = new Map(bosses.map((boss) => [boss.id, boss]));
  const nameOfBoss = (id: string) => byId.get(id)?.name ?? id;
  const ids = [...new Set(zoneAreas.flatMap((other) => other.area.mapBosses ?? []))];
  const entry = zoneAreas.find((other) => other.area.mapItem !== undefined);
  const pick = zoneAreas.find((other) => other.area.mapBossPick !== undefined)?.area.mapBossPick ?? null;
  const cards = ids.flatMap((id) => {
    const boss = byId.get(id);
    return boss === undefined
      ? []
      : [bossCard(boss, Object.hasOwn(facts, id) ? facts[id] : undefined, (area.area.mapBosses ?? []).includes(id), nameOfBoss)];
  });
  const hellPacks = zoneAreas.flatMap((other) => (other.area.uniques === null ? [] : [other.area.uniques[2]]));
  const uniques: readonly [number, number] | null =
    hellPacks.length === 0 ? null : [Math.min(...hellPacks.map(([min]) => min)), Math.max(...hellPacks.map(([, max]) => max))];
  return {
    zone: group,
    tier,
    mapItemName: entry?.area.mapItemName ?? null,
    entryId: entry?.id ?? null,
    bosses: cards,
    pick,
    noBoss: cards.length === 0 ? { uniques } : null,
  };
}

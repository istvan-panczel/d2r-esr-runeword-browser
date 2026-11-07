/**
 * areas.json `mapBosses`: the endgame map bosses and their Hell rewards, worked out from the game files.
 *
 * - Which bosses: the `*Map Boss` comment of a boss arena (areas.json `boss`) matched to a monstats row by in-game
 *   name (case and spacing ignored); "Guardians of Time" and "Double T<n> Bosses" are expanded (ARENA_ALIASES).
 * - Rewards: the boss's `TreasureClass(H)`, split into the rolls of its negative-picks tree. A roll that can give gold
 *   is the generic loot table (`otherRolls`); the others are rewards, classified by the items they reach (orb, map,
 *   Pandemonium key, Weapon Mastery Token, Primordial Soulstone, or a named item). Chances: treasureClassOdds.ts.
 * - Terrorized: `TreasureClassDesecrated(H)` adds Worldstone Shards (`terrorShards`); a reward it no longer reaches is
 *   listed in `terrorMissing`.
 * - Set drops: the launcher plugin rules (boss-set-unique-drop) whose monsters are all map bosses.
 */
import type { Area, MapBoss, MapBossReward, MapBossRewardKind } from '../engine/schema.ts';
import { resolveName } from './itemNames.ts';
import type { BossSetRule } from './pluginUniques.ts';
import { chanceOfAny, createTcOdds, expectedCounts, readTcRows, type TcOdds } from './treasureClassOdds.ts';
import type { TsvTable } from './tsv.ts';

export const ORB_OF_ANOINTMENT = 'um7';
export const WEAPON_MASTERY_TOKEN = 'u23';
export const PRIMORDIAL_SOULSTONE = 'u19';
export const WORLDSTONE_SHARD = 'wss';
export const PANDEMONIUM_KEYS: readonly string[] = ['pk1', 'pk2', 'pk3'];
/** A roll that can give gold is the generic loot table (every "Boss Base" TC starts with gold) */
const GOLD = 'gld';

/**
 * `*Map Boss` comments that name a group: monstats ids, or "the bosses of tier-N arenas, N of them at a time". The
 * Chaos Rift preset decides which two tier-1 bosses come; the tables do not say.
 */
const DOUBLE_BOSSES = /^Double T(\d) Bosses$/i;
const ARENA_ALIASES: ReadonlyMap<string, readonly (string | undefined)[]> = new Map([
  ['Guardians of Time', ['talictheeternal', 'madawctheeternal', 'korlictheeternal']],
]);

const KIND_ORDER: readonly MapBossRewardKind[] = ['item', 'orb', 'map', 'key', 'token', 'soulstone'];

export interface MapBossesInput {
  areas: readonly Area[];
  /** monstats.txt without its Expansion rows (row index = hcIdx) */
  monstats: TsvTable;
  treasureclassex: TsvTable;
  /** Item code → in-game name (misc, weapons, armor) */
  itemNames: ReadonlyMap<string, string>;
  /** uniqueitems.txt index → in-game name */
  uniqueNames: ReadonlyMap<string, string>;
  strings: ReadonlyMap<string, string>;
  setRules: readonly BossSetRule[];
}

export interface MapBossesResult {
  mapBosses: MapBoss[];
  /** The areas with `mapBosses`, `mapBossPick` and `mapItemName` filled in */
  areas: Area[];
  warnings: string[];
}

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** One roll of a boss treasure class: a positive-picks sub-TC or an item, rolled `times` times */
interface Roll {
  readonly ref: string;
  readonly times: number;
}

/** The leaf rolls of a negative-picks tree (`X Boss Main` → `X Boss` → its rolls) */
function leafRolls(odds: TcOdds, tc: string, times = 1, depth = 0): Roll[] {
  const row = odds.rows.get(tc);
  if (row === undefined || row.picks >= 0 || depth > 8) return [{ ref: tc, times }];
  let remaining = -row.picks;
  return row.entries.flatMap((entry) => {
    if (remaining <= 0) return [];
    const count = Math.min(entry.prob, remaining);
    remaining -= count;
    return leafRolls(odds, entry.ref, times * count, depth + 1);
  });
}

export function buildMapBosses(input: MapBossesInput): MapBossesResult {
  const warnings: string[] = [];
  const odds = createTcOdds(readTcRows(input.treasureclassex));
  const mapTiers = new Map(
    input.areas.flatMap((area) => (area.mapItem !== undefined && area.tier !== undefined ? [[area.mapItem, area.tier]] : []))
  );
  const refName = (ref: string) => input.uniqueNames.get(ref) ?? input.itemNames.get(ref) ?? ref;

  const monsters = new Map<string, { id: string; name: string; tc: string; terrorTc: string; hcIdx: number }>();
  const byName = new Map<string, string>();
  input.monstats.rows.forEach((row, hcIdx) => {
    const id = row.str('Id');
    if (id === '') return;
    const name = resolveName(input.strings, row.str('NameStr'), id);
    monsters.set(id, { id, name, tc: row.str('TreasureClass(H)'), terrorTc: row.str('TreasureClassDesecrated(H)'), hcIdx });
    // Map bosses carry a Hell TC; the first such row wins a shared name
    if (row.str('TreasureClass(H)') !== '' && !byName.has(normalise(name))) byName.set(normalise(name), id);
  });

  // --- arenas → bosses ---------------------------------------------------------------------------------------------
  const arenaBosses = new Map<number, string[]>();
  const doubles: { area: Area; tier: number; count: number }[] = [];
  for (const area of input.areas) {
    if (area.boss === undefined) continue;
    const double = DOUBLE_BOSSES.exec(area.boss);
    if (double !== null) {
      doubles.push({ area, tier: Number(double[1]), count: 2 });
      continue;
    }
    const ids = ARENA_ALIASES.get(area.boss) ?? [byName.get(normalise(area.boss))];
    const known = ids.filter((id): id is string => id !== undefined && monsters.has(id));
    if (known.length < ids.length || known.length === 0) {
      warnings.push(`areas: map boss "${area.boss}" (levels.txt ${String(area.id)}) matches no monstats row with a Hell treasure class`);
      continue;
    }
    arenaBosses.set(area.id, known);
  }
  const tierOf = (areaId: number) => input.areas.find((area) => area.id === areaId)?.tier;
  for (const { area, tier, count } of doubles) {
    const ids = [...arenaBosses].filter(([arena]) => tierOf(arena) === tier).flatMap(([, ids]) => ids);
    if (ids.length < count)
      warnings.push(`areas: "${area.boss ?? ''}" (levels.txt ${String(area.id)}) finds ${String(ids.length)} tier ${String(tier)} bosses`);
    else arenaBosses.set(area.id, ids);
  }

  // --- rewards -----------------------------------------------------------------------------------------------------
  const kindOf = (refs: ReadonlySet<string>): MapBossRewardKind | 'other' | null => {
    if (refs.size === 0) return null;
    if (refs.has(GOLD)) return 'other';
    const all = (test: (ref: string) => boolean) => [...refs].every(test);
    if (all((ref) => ref === ORB_OF_ANOINTMENT)) return 'orb';
    if (all((ref) => mapTiers.has(ref))) return 'map';
    if (all((ref) => PANDEMONIUM_KEYS.includes(ref))) return 'key';
    if (all((ref) => ref === WEAPON_MASTERY_TOKEN)) return 'token';
    if (all((ref) => ref === PRIMORDIAL_SOULSTONE)) return 'soulstone';
    return 'item';
  };

  const rewardsOf = (tc: string, label: string) => {
    const picks1 = odds.picks(tc, 1);
    const picks8 = odds.picks(tc, 8);
    const rewards: (MapBossReward & { refs: ReadonlySet<string> })[] = [];
    let otherRolls = 0;
    const reward = (kind: MapBossRewardKind, rewardLabel: string, refs: readonly string[], extra: Partial<MapBossReward> = {}) => {
      const set = new Set(refs);
      const chance: [number, number] = [round(chanceOfAny(picks1, set)), round(chanceOfAny(picks8, set))];
      const counts = expectedCounts(picks1);
      const expected = round([...set].reduce((sum, ref) => sum + (counts.get(ref) ?? 0), 0));
      rewards.push({ kind, label: rewardLabel, chance, ...(expected > chance[0] + 0.0001 ? { expected } : {}), ...extra, refs: set });
    };
    const seen = new Set<string>();
    for (const roll of leafRolls(odds, tc)) {
      const refs = odds.reachableRefs(roll.ref);
      const kind = kindOf(refs);
      if (kind === null) continue;
      if (kind === 'other') {
        otherRolls += roll.times;
        continue;
      }
      if (kind === 'item') {
        // One reward per distinct name (Frostmourne, Lich King's Essence)
        const byItemName = new Map<string, string[]>();
        for (const ref of refs) byItemName.set(refName(ref), [...(byItemName.get(refName(ref)) ?? []), ref]);
        for (const [name, nameRefs] of byItemName) {
          if (seen.has(`item:${name}`)) continue;
          seen.add(`item:${name}`);
          reward('item', name, nameRefs);
        }
        continue;
      }
      if (seen.has(kind)) continue;
      seen.add(kind);
      const conditions = odds.conditions(roll.ref);
      const condition = conditions.length > 0 ? { condition: conditions.join(' & ') } : {};
      if (kind === 'map') {
        const tiers = [...new Set([...refs].map((ref) => mapTiers.get(ref) ?? 0))].sort((a, b) => a - b);
        const tierText = tiers.length === 1 ? String(tiers[0]) : `${String(tiers[0])}–${String(tiers.at(-1))}`;
        reward('map', `Tier ${tierText} map`, [...refs], { tiers, ...condition });
      } else if (kind === 'key') reward('key', 'Pandemonium key', [...refs], condition);
      else reward(kind, refName([...refs][0] ?? ''), [...refs], condition);
    }
    if (otherRolls === 0) warnings.push(`areas: map boss table "${tc}" (${label}) has no generic loot roll`);
    rewards.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    return { rewards, otherRolls };
  };

  // Set drops: rules whose monsters are all map bosses
  const hcIds = new Map([...monsters.values()].map((monster) => [monster.hcIdx, monster.id]));
  const bossIds = new Set([...arenaBosses.values()].flat());
  const setDrops = new Map<string, { unique: string; with: string[] }>();
  for (const rule of input.setRules) {
    const ids = rule.monsters.map((hcIdx) => hcIds.get(hcIdx));
    if (!ids.every((id): id is string => id !== undefined && bossIds.has(id))) continue;
    const unique = input.uniqueNames.get(rule.unique);
    if (unique === undefined) {
      warnings.push(`areas: boss set drop "${rule.unique}" is not a uniqueitems.txt index`);
      continue;
    }
    for (const id of ids) setDrops.set(id, { unique, with: ids.filter((other) => other !== id) });
  }

  // --- bosses, in arena order ----------------------------------------------------------------------------------------
  const mapBosses: MapBoss[] = [];
  const done = new Set<string>();
  const ownArena = new Map<string, number>();
  for (const [arena, ids] of arenaBosses)
    if (!doubles.some((double) => double.area.id === arena)) for (const id of ids) ownArena.set(id, arena);
  for (const [, ids] of arenaBosses) {
    for (const id of ids) {
      if (done.has(id)) continue;
      done.add(id);
      const monster = monsters.get(id);
      const arena = ownArena.get(id);
      if (monster === undefined || arena === undefined) continue;
      const { rewards, otherRolls } = rewardsOf(monster.tc, monster.name);
      let terrorShards: number | null = null;
      let terrorMissing: string[] = [];
      if (monster.terrorTc !== '') {
        const terrorPicks = odds.picks(monster.terrorTc, 1);
        terrorShards = round(expectedCounts(terrorPicks).get(WORLDSTONE_SHARD) ?? 0);
        const terrorRefs = odds.reachableRefs(monster.terrorTc);
        terrorMissing = rewards.filter((entry) => ![...entry.refs].some((ref) => terrorRefs.has(ref))).map((entry) => entry.label);
      }
      const ownGroup = input.areas.find((area) => area.id === arena)?.group;
      const sameTableAs = [...monsters.values()]
        .filter((other) => other.id !== id && other.tc === monster.tc && bossIds.has(other.id))
        .filter((other) => {
          const otherArena = ownArena.get(other.id);
          return otherArena !== undefined && input.areas.find((area) => area.id === otherArena)?.group !== ownGroup;
        })
        .map((other) => other.id);
      const setDrop = setDrops.get(id);
      mapBosses.push({
        id,
        name: monster.name,
        arenas: [...arenaBosses].filter(([, list]) => list.includes(id)).map(([areaId]) => areaId),
        tier: tierOf(arena) ?? 0,
        treasureClass: monster.tc,
        ...(sameTableAs.length > 0 ? { sameTableAs } : {}),
        rewards: rewards.map(({ refs: _refs, ...entry }) => entry),
        otherRolls,
        terrorShards,
        ...(terrorMissing.length > 0 ? { terrorMissing } : {}),
        ...(setDrop === undefined ? {} : { setDrop }),
      });
    }
  }

  const pick = new Map(doubles.map((double) => [double.area.id, double.count]));
  const areas = input.areas.map((area): Area => {
    const ids = arenaBosses.get(area.id);
    const mapItemName = area.mapItem === undefined ? undefined : input.itemNames.get(area.mapItem);
    return {
      ...area,
      ...(mapItemName === undefined ? {} : { mapItemName }),
      ...(ids === undefined ? {} : { mapBosses: ids }),
      ...(ids !== undefined && pick.has(area.id) ? { mapBossPick: pick.get(area.id) } : {}),
    };
  });
  return { mapBosses, areas, warnings };
}

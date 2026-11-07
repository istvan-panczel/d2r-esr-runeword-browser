/**
 * `::map-bosses[3]`: the rewards of one tier's endgame map bosses, from areas.json `mapBosses` (worked out from the
 * treasure classes, see game-data `build/bundleMapBosses.ts`). One row per boss (bosses with the same rewards share a
 * row): orb, next map, key, named drops, terrorized shards, players 1 with players 8 in brackets. What every boss of
 * the tier shares (Weapon Mastery Token, Primordial Soulstone) goes into the caption.
 */
import type { MapBoss, MapBossReward } from '../../../game-data/engine/schema.ts';
import type { DirectiveResolver } from './types.ts';

/** 0.05 → "5%", 1 → "always" (the campaign map panel's wording) */
function chance(value: number): string {
  const percent = value * 100;
  return percent >= 99.995 ? 'always' : `${String(Math.round(percent * 10) / 10)}%`;
}

function chances(reward: MapBossReward): string {
  const [one, eight] = reward.chance;
  return one === eight ? chance(one) : `${chance(one)} (${chance(eight)})`;
}

const ofKind = (boss: MapBoss, kind: MapBossReward['kind']) => boss.rewards.filter((reward) => reward.kind === kind);
const cell = (rewards: readonly MapBossReward[], text: (reward: MapBossReward) => string) =>
  rewards.length === 0 ? '–' : rewards.map(text).join(', ');

function sharedText(reward: MapBossReward): string {
  const limit = reward.condition === undefined ? undefined : /<\s*(\d+)\s*$/.exec(reward.condition)?.[1];
  return `${reward.label} ${chances(reward)}${limit === undefined ? '' : ` (until you have collected ${limit})`}`;
}

export const resolveMapBosses: DirectiveResolver = (arg, ctx) => {
  const tier = Number(arg);
  if (arg === null || !Number.isInteger(tier) || tier < 1) return { error: '::map-bosses needs a map tier: ::map-bosses[1]' };
  if (ctx.mapBosses === null) return { error: '::map-bosses needs areas.json (run npm run game-data:generate)' };
  const bosses = ctx.mapBosses.filter((boss) => boss.tier === tier);
  if (bosses.length === 0) return { error: `::map-bosses: areas.json has no tier ${String(tier)} map boss` };

  const shared = [...new Set(bosses.flatMap((boss) => [...ofKind(boss, 'token'), ...ofKind(boss, 'soulstone')].map(sharedText)))];
  const withItems = bosses.some((boss) => ofKind(boss, 'item').length > 0);
  const rows: { names: string[]; cells: string[] }[] = [];
  for (const boss of bosses) {
    const cells = [
      cell(ofKind(boss, 'orb'), chances),
      cell(ofKind(boss, 'map'), (reward) => `${reward.label.replace(/ map$/, '')} ${chances(reward)}`),
      cell(ofKind(boss, 'key'), (reward) => `${chances(reward)}${reward.expected === undefined ? '' : ' (a set)'}`),
      ...(withItems ? [cell(ofKind(boss, 'item'), (reward) => `${reward.label} ${chances(reward)}`)] : []),
      boss.terrorShards === null ? 'no terrorized table' : `+${String(boss.terrorShards)}`,
    ];
    const same = rows.find((row) => row.cells.join('|') === cells.join('|'));
    if (same === undefined) rows.push({ names: [boss.name], cells });
    else same.names.push(boss.name);
  }
  return {
    kind: 'table',
    caption: `Tier ${String(tier)} map bosses in Hell, players 1 (players 8). Each also drops: ${shared.join('; ')}`,
    header: ['Boss', 'Orb of Anointment', 'Map', 'Key', ...(withItems ? ['Named drop'] : []), 'Shards when terrorized'],
    rows: rows.map((row) => [row.names.length > 1 ? `${row.names.join(', ')} (each)` : (row.names[0] ?? ''), ...row.cells]),
  };
};

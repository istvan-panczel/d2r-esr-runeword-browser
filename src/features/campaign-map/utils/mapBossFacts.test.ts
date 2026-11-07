import { describe, expect, it } from 'vitest';
import type { Area, MapBoss } from '@/features/game-data/engine/schema';
import type { MapBossFacts } from '../data/mapBosses';
import { chanceText, zoneBossSummary } from './mapBossFacts';
import { mockCampaignArea, mockMap } from './testMap.mock';

const herald: MapBoss = {
  id: 'herald',
  name: 'Herald Of Doom',
  arenas: [175],
  tier: 3,
  treasureClass: 'Labyrinth Of Suffering Boss',
  sameTableAs: ['avatar'],
  rewards: [
    { kind: 'orb', label: 'Orb of Anointment', chance: [0.1, 0.1961] },
    { kind: 'map', label: 'Tier 3 map', chance: [0.25, 0.5], tiers: [3] },
    { kind: 'key', label: 'Pandemonium key', chance: [0.25, 0.5] },
    { kind: 'token', label: 'Weapon Mastery Token', chance: [0.25, 0.25] },
    { kind: 'soulstone', label: 'Primordial Soulstone', chance: [1, 1], condition: "stat('ascendancy_tier_4_count_new'.accr)<10" },
  ],
  otherRolls: 11,
  terrorShards: 2,
};
const avatar: MapBoss = { ...herald, id: 'avatar', name: 'Avatar Of The Night', arenas: [162], tier: 2, sameTableAs: ['herald'] };
const mephisto: MapBoss = {
  id: 'meph',
  name: 'Mephisto the Invincible',
  arenas: [198],
  tier: 5,
  treasureClass: 'Mephisto the Invincible Boss',
  rewards: [
    { kind: 'item', label: "Mephisto's Demonic Brain", chance: [1, 1] },
    { kind: 'key', label: 'Pandemonium key', chance: [0.5, 0.9545] },
  ],
  otherRolls: 26,
  terrorShards: 3,
  terrorMissing: ["Mephisto's Demonic Brain"],
};
const lucion: MapBoss = {
  ...mephisto,
  id: 'lucion',
  name: 'Lucion',
  arenas: [211],
  rewards: [],
  terrorShards: null,
  terrorMissing: undefined,
};

const FACTS: Record<string, MapBossFacts> = {
  herald: {
    fight: [{ text: 'meteors', source: 'endgame' }],
    page: { orb: 15, map: { tier: 4, chance: 25 }, key: { chance: 50 }, terror: 'one' },
  },
  meph: {
    fight: [],
    damage: { text: 'Pick up a light orb', source: 'endgame' },
    page: { key: { chance: 50, set: true }, items: ["Mephisto's Demonic Horn"], terror: 'none' },
  },
};

const zone = (id: number, name: string, group: string, tier: number, area: Partial<Area> = {}) =>
  mockCampaignArea(id, name, 'maps', { area: { group, tier, ...area } });
const map = mockMap([
  zone(166, 'Endless Abyss Level 1', 'Endless Abyss', 3, { mapItem: 'z10', mapItemName: 'Endless Abyss (Tier 3)' }),
  zone(175, 'Endless Abyss Level 10', 'Endless Abyss', 3, { mapBosses: ['herald'] }),
  zone(193, 'Eye of the Storm', 'Eye of the Storm', 5, { mapItem: 'z17' }),
  zone(198, 'The Spiral of Souls Level 2', 'Eye of the Storm', 5, { mapBosses: ['meph'] }),
  zone(211, 'Altar', 'Reliquary', 5, { mapBosses: ['lucion'] }),
  zone(143, 'Crypt of Damnation', 'Crypt of Damnation', 1, {
    mapItem: 'z03',
    uniques: [
      [1, 2],
      [3, 4],
      [60, 80],
    ],
  }),
  mockCampaignArea(1, 'Rogue Encampment'),
]);
const BOSSES = [herald, avatar, mephisto, lucion];
const summaryOf = (id: number) => {
  const area = map.areas.get(id);
  if (area === undefined) throw new Error(`no area ${String(id)}`);
  return zoneBossSummary(map, area, BOSSES, FACTS);
};

describe('chanceText', () => {
  it('rounds to one decimal and reads 100% as always', () => {
    expect(chanceText(0.05)).toBe('5%');
    expect(chanceText(0.1667)).toBe('16.7%');
    expect(chanceText(0.9545)).toBe('95.5%');
    expect(chanceText(1)).toBe('always');
  });
});

describe('zoneBossSummary', () => {
  it('is null outside the tiered maps', () => {
    expect(summaryOf(1)).toBeNull();
  });

  it('gives every level of a zone its opening map item and its boss, open only in the arena', () => {
    const entry = summaryOf(166);
    expect(entry?.mapItemName).toBe('Endless Abyss (Tier 3)');
    expect(entry?.entryId).toBe(166);
    expect(entry?.bosses.map((boss) => [boss.id, boss.here])).toEqual([['herald', false]]);
    expect(summaryOf(175)?.bosses[0]?.here).toBe(true);
  });

  it('formats the rewards and lists where the official page differs', () => {
    const card = summaryOf(175)?.bosses[0];
    expect(card?.rewards.map((line) => [line.label, line.chance, line.players8, line.note, line.official])).toEqual([
      ['Orb of Anointment', '10%', '19.6%', null, '15%'],
      ['Tier 3 map', '25%', '50%', null, 'tier 4 map, 25%'],
      ['Pandemonium key', '25%', '50%', 'one of the three, at random', '50%'],
      ['Weapon Mastery Token', '25%', null, 'players setting does not raise it', null],
      ['Primordial Soulstone', 'always', null, 'until you have collected 10', null],
    ]);
    expect(card?.sameTableAs).toEqual(['Avatar Of The Night']);
    expect(card?.terror).toBe('+2 Worldstone Shards');
    expect(card?.terrorOfficial).toBe('one shard');
    expect(card?.uncurated).toBe(false);
  });

  it('pairs a renamed item, flags a key set the files do not drop, and terrorized tables that skip a roll', () => {
    const card = summaryOf(193)?.bosses[0];
    expect(card?.damage?.text).toBe('Pick up a light orb');
    expect(card?.rewards.map((line) => line.official)).toEqual(["calls it Mephisto's Demonic Horn", 'a whole key set, 50%']);
    expect(card?.terror).toBe("+3 Worldstone Shards, but without the Mephisto's Demonic Brain roll");
    expect(card?.terrorOfficial).toBe('no shards from tier 5 bosses');
  });

  it('marks a boss without hand-written facts and a boss without a terrorized table', () => {
    const card = summaryOf(211)?.bosses[0];
    expect(card?.uncurated).toBe(true);
    expect(card?.terror).toBe('no terrorized loot table in the files');
  });

  it('says a zone has no boss, with its Hell unique packs', () => {
    expect(summaryOf(143)?.bosses).toEqual([]);
    expect(summaryOf(143)?.noBoss).toEqual({ uniques: [60, 80] });
  });
});

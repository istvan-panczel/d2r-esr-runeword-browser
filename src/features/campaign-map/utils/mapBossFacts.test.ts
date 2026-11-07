import { describe, expect, it } from 'vitest';
import type { Area, MapBoss, MapBossReward } from '@/features/game-data/engine/schema';
import { PERK_DROPS, type MapBossFacts } from '../data/mapBosses';
import { bossCard, chanceText, zoneBossSummary } from './mapBossFacts';
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
    { kind: 'item', label: 'Alien Artefact', chance: [0.02, 0.02] },
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
  rewards: [{ kind: 'item', label: 'Alien Artefact', chance: [0.02, 0.02] }],
  terrorShards: null,
  terrorMissing: undefined,
};

const FACTS: Record<string, MapBossFacts> = {
  herald: {
    fight: [{ text: 'meteors', source: 'endgame' }],
    page: { orb: 15, map: { tier: 4, chance: 25 }, key: { chance: 50 }, terror: 'always' },
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
  zone(148, 'Cellar of Pain Level 1', 'Cellar of Pain', 1, { mapItem: 'z01' }),
  zone(149, 'Cellar of Pain Level 2', 'Cellar of Pain', 1, { mapBosses: ['whisper'] }),
  zone(156, 'Chaos Rift Level 1', 'Chaos Rift', 2, { mapItem: 'z06' }),
  zone(159, 'Chaos Rift Level 4', 'Chaos Rift', 2, { mapBosses: ['whisper'], mapBossPick: 2 }),
  mockCampaignArea(1, 'Rogue Encampment'),
]);
const whisper: MapBoss = { ...herald, id: 'whisper', name: "Lucion's Whisper", arenas: [149, 159], tier: 1, sameTableAs: undefined };
const BOSSES = [herald, avatar, mephisto, lucion, whisper];
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
      ['Primordial Soulstone', 'always', null, 'until your Ascendancy Stone holds 10', null],
    ]);
    expect(card?.sameTableAs).toEqual(['Avatar Of The Night']);
    // The page's "always a shard" is not a count: no comparison
    expect(card?.terror).toBe('+2 Worldstone Shards');
    expect(card?.terrorUnconfirmed).toBe(false);
    expect(card?.uncurated).toBe(false);
  });

  it('pairs a renamed item past a perk drop, flags the perk, a key set the files do not drop, and terrorized tables that skip a roll', () => {
    const card = summaryOf(193)?.bosses[0];
    expect(card?.damage?.text).toBe('Pick up a light orb');
    expect(card?.rewards.map((line) => [line.label, line.chance, line.official])).toEqual([
      ["Mephisto's Demonic Brain", 'always', "calls it Mephisto's Demonic Horn"],
      ['Alien Artefact', '2%', PERK_DROPS['Alien Artefact']],
      ['Pandemonium key', '50%', 'a whole key set, 50%'],
    ]);
    expect(card?.terror).toBe(
      "the files list +3 Worldstone Shards, without the Mephisto's Demonic Brain roll; the official page says tier 5 bosses drop none (an engine limit)"
    );
    expect(card?.terrorUnconfirmed).toBe(true);
  });

  it('marks a boss without hand-written facts and a boss without a terrorized table', () => {
    const card = summaryOf(211)?.bosses[0];
    expect(card?.uncurated).toBe(true);
    // The perk note comes from the Specializations page, not from the boss's hand-written page figures
    expect(card?.rewards.map((line) => line.official)).toEqual([PERK_DROPS['Alien Artefact']]);
    expect(card?.terror).toBe('monstats sets no terrorized loot table for this boss, so he likely drops his normal one');
    expect(card?.terrorUnconfirmed).toBe(true);
  });

  it('names a page item only against the one file item the page does not name', () => {
    const card = (rewards: MapBoss['rewards'], items: readonly string[]) =>
      bossCard({ ...mephisto, rewards }, { fight: [], page: { items, terror: 'none' } }, true, (id) => id).rewards.map(
        (line) => line.official
      );
    const brain: MapBossReward = { kind: 'item', label: "Mephisto's Demonic Brain", chance: [1, 1] };
    const artefact: MapBossReward = { kind: 'item', label: 'Alien Artefact', chance: [0.02, 0.02] };
    const skull: MapBossReward = { kind: 'item', label: "Rathma's Eternal Skull", chance: [1, 1] };
    // The perk drop does not count as a second unnamed item, in either order
    expect(card([artefact, brain], ["Mephisto's Demonic Horn"])).toEqual([
      PERK_DROPS['Alien Artefact'],
      "calls it Mephisto's Demonic Horn",
    ]);
    // A file item the page names keeps no note; the other one is paired
    expect(card([skull, brain], ["Rathma's Eternal Skull", "Mephisto's Demonic Horn"])).toEqual([null, "calls it Mephisto's Demonic Horn"]);
    // Two unnamed file items: no guess
    expect(card([brain, { ...skull, label: 'Frostmourne' }], ["Mephisto's Demonic Horn"])).toEqual([null, null]);
  });

  it('links a boss to its arena inside the selected zone (Chaos Rift), else to its own', () => {
    const rift = summaryOf(156);
    expect(rift?.pick).toBe(2);
    expect(rift?.bosses[0]?.zoneArena).toBe(159);
    expect(summaryOf(148)?.bosses[0]?.zoneArena).toBe(149);
    expect(summaryOf(166)?.bosses[0]?.zoneArena).toBe(175);
  });

  it('says a zone has no boss, with its Hell unique packs', () => {
    expect(summaryOf(143)?.bosses).toEqual([]);
    expect(summaryOf(143)?.noBoss).toEqual({ uniques: [60, 80] });
  });
});

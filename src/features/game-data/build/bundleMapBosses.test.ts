import { describe, expect, it } from 'vitest';
import type { Area } from '../engine/schema.ts';
import { buildMapBosses } from './bundleMapBosses.ts';
import { parseTsv } from './tsv.ts';

const table = (rows: string[][]) => parseTsv(rows.map((row) => row.join('\t')).join('\n'));

const area = (id: number, tier: number, group: string, extra: Partial<Area> = {}): Area => ({
  id,
  name: `${group} ${String(id)}`,
  act: 4,
  group,
  tier,
  waypoint: false,
  level: [100, 100, 100],
  density: null,
  uniques: null,
  connections: [],
  terrain: 'dungeon',
  ...extra,
});

const AREAS: Area[] = [
  area(10, 1, 'Cellar', { mapItem: 'z01' }),
  area(11, 1, 'Cellar', { boss: "Lucion's Whisper" }),
  area(20, 1, 'Chasm', { mapItem: 'z02', boss: "Diablo's Hellhound" }),
  area(30, 2, 'Rift', { mapItem: 'z05', boss: 'Double T1 Bosses' }),
  area(40, 2, 'Labyrinth', { mapItem: 'z06', boss: 'Avatar of the Night' }),
  area(50, 3, 'Abyss', { mapItem: 'z09', boss: 'Herald of Doom' }),
  area(60, 5, 'Icecrown', { mapItem: 'z17', boss: 'Guardians of Time' }),
  area(70, 5, 'Sanctum', { boss: 'Nobody Here' }),
];

const TC_HEADER = ['Treasure Class', 'Picks', 'NoDrop', 'Item1', 'Prob1', 'Item2', 'Prob2', 'Item3', 'Prob3', 'Item4', 'Prob4'];
const TCS = [
  TC_HEADER,
  ['Nothing', '0'],
  ['Orb T1', '1', '52', 'um7', '5', 'Nothing', '43'],
  ['Orb T2', '1', '52', 'um7', '10', 'Nothing', '38'],
  ['Map T2', '1', '8', 'z05', '2', 'z06', '2', 'Nothing', '4'],
  ['Map T3', '1', '8', 'z09', '4', 'Nothing', '4'],
  ['Map T5', '1', '8', 'z17', '4', 'Nothing', '4'],
  ['Random Key', '1', '', 'pk1', '1', 'pk2', '1', 'pk3', '1'],
  ['Key T1', '1', '8', 'Random Key', '4', 'Nothing', '4'],
  ['Key Set', '-3', '', 'pk1', '1', 'pk2', '1', 'pk3', '1'],
  ['Key Set Roll', '1', '1', 'Key Set', '1'],
  ['Token', '1', '', 'u23', '1', 'Nothing', '3'],
  ['Soulstone', '1', '', 'u19', '1'],
  ['Base', '1', '150', '"gld,mul=2048"', '15', 'gear', '150'],
  ['T1 Boss', '-8', '', 'Orb T1', '1', 'Map T2', '1', 'Key T1', '1', 'Base', '5'],
  ['T2 Boss', '-5', '', 'Orb T2', '1', 'Map T3', '1', 'Key T1', '1', 'Base', '2'],
  ['T2 Boss Terror', '-3', '', 'wss', '2', 'T2 Boss', '1'],
  ['Ancient Boss', '-5', '', 'Map T5', '1', 'Key Set Roll', '1', 'Token', '1', 'Soulstone', '1'],
  ['Ancient Base', '1', '', 'gld', '1'],
  ['Ancient Main', '-4', '', 'Ancient Unique', '1', 'Ancient Boss', '1', 'Ancient Base', '2'],
  ['Ancient Unique', '1', '', 'Frostmourne', '1', 'Essence Fire', '1', 'Essence Cold', '1'],
];

const MONSTATS = [
  ['Id', 'NameStr', 'TreasureClass(H)', 'TreasureClassDesecrated(H)'],
  ['dummy0', 'Dummy', '', ''],
  ['lucionwhisper', 'LucionWhisper', 'T1 Boss', 'T1 Boss'],
  ['diablohellhound', 'DiabloHellhound', 'T1 Boss', ''],
  ['avatarofthenight', 'AvatarOfTheNight', 'T2 Boss', 'T2 Boss Terror'],
  ['heraldofdoom', 'HeraldOfDoom', 'T2 Boss', 'T2 Boss Terror'],
  ['talictheeternal', 'Talic', 'Ancient Main', 'Ancient Boss'],
  ['madawctheeternal', 'Madawc', 'Ancient Main', 'Ancient Main'],
  ['korlictheeternal', 'Korlic', 'Ancient Main', 'Ancient Main'],
];

const STRINGS = new Map([
  ['LucionWhisper', "Lucion's Whisper"],
  ['DiabloHellhound', "Diablo's Hellhound"],
  ['AvatarOfTheNight', 'Avatar Of The Night'],
  ['HeraldOfDoom', 'Herald Of Doom'],
  ['Talic', 'Talic The Eternal'],
  ['Madawc', 'Madawc The Eternal'],
  ['Korlic', 'Korlic The Eternal'],
]);

const result = buildMapBosses({
  areas: AREAS,
  monstats: table(MONSTATS),
  treasureclassex: table(TCS),
  itemNames: new Map([
    ['um7', 'Orb of Anointment'],
    ['u23', 'Weapon Mastery Token'],
    ['u19', 'Primordial Soulstone'],
    ['z01', 'Cellar of Pain (Tier 1)'],
  ]),
  uniqueNames: new Map([
    ['Frostmourne', 'Frostmourne'],
    ['Essence Fire', "Lich King's Essence"],
    ['Essence Cold', "Lich King's Essence"],
    ['Eternal Hourglass', 'Eternal Hourglass of the Timeless Sands'],
  ]),
  strings: STRINGS,
  // hcIdx = row index: talic 5, madawc 6, korlic 7
  setRules: [
    { monsters: [5, 6, 7], unique: 'Eternal Hourglass' },
    { monsters: [5, 99], unique: 'Eternal Hourglass' },
  ],
});
const boss = (id: string) => result.mapBosses.find((entry) => entry.id === id);
const areaOf = (id: number) => result.areas.find((entry) => entry.id === id);

describe('buildMapBosses', () => {
  it('matches arena comments to monsters by in-game name, case ignored, and expands the group comments', () => {
    expect(result.mapBosses.map((entry) => entry.id)).toEqual([
      'lucionwhisper',
      'diablohellhound',
      'avatarofthenight',
      'heraldofdoom',
      'talictheeternal',
      'madawctheeternal',
      'korlictheeternal',
    ]);
    expect(areaOf(11)?.mapBosses).toEqual(['lucionwhisper']);
    expect(areaOf(60)?.mapBosses).toEqual(['talictheeternal', 'madawctheeternal', 'korlictheeternal']);
    // Chaos Rift: two of the tier 1 bosses
    expect(areaOf(30)?.mapBosses).toEqual(['lucionwhisper', 'diablohellhound']);
    expect(areaOf(30)?.mapBossPick).toBe(2);
    expect(boss('lucionwhisper')?.arenas).toEqual([11, 30]);
    expect(boss('lucionwhisper')?.tier).toBe(1);
    expect(result.warnings).toEqual(['areas: map boss "Nobody Here" (levels.txt 70) matches no monstats row with a Hell treasure class']);
  });

  it('names the map items', () => {
    expect(areaOf(10)?.mapItemName).toBe('Cellar of Pain (Tier 1)');
    expect(areaOf(11)?.mapItemName).toBeUndefined();
  });

  it('classifies the rolls and works out the chances at players 1 and 8', () => {
    const whisper = boss('lucionwhisper');
    expect(whisper?.otherRolls).toBe(5);
    expect(whisper?.rewards).toEqual([
      { kind: 'orb', label: 'Orb of Anointment', chance: [0.05, 0.098] },
      { kind: 'map', label: 'Tier 2 map', chance: [0.25, 0.5], tiers: [2] },
      { kind: 'key', label: 'Pandemonium key', chance: [0.25, 0.5] },
    ]);
  });

  it('splits a named-item pool by name, reads conditions, and marks multi-item rolls with their expected count', () => {
    const talic = boss('talictheeternal');
    expect(talic?.rewards.map((reward) => [reward.kind, reward.label, reward.chance[0]])).toEqual([
      ['item', 'Frostmourne', 0.3333],
      ['item', "Lich King's Essence", 0.6667],
      ['map', 'Tier 5 map', 0.25],
      ['key', 'Pandemonium key', 0.5],
      ['token', 'Weapon Mastery Token', 0.25],
      ['soulstone', 'Primordial Soulstone', 1],
    ]);
    expect(talic?.rewards.find((reward) => reward.kind === 'key')?.expected).toBe(1.5);
    expect(talic?.otherRolls).toBe(2);
  });

  it('reads the terrorized table: shards added and rewards it leaves out', () => {
    expect(boss('avatarofthenight')?.terrorShards).toBe(2);
    expect(boss('lucionwhisper')?.terrorShards).toBe(0);
    expect(boss('diablohellhound')?.terrorShards).toBeNull();
    expect(boss('talictheeternal')?.terrorMissing).toEqual(['Frostmourne', "Lich King's Essence"]);
    expect(boss('madawctheeternal')?.terrorMissing).toBeUndefined();
  });

  it('flags a boss using another zone’s table, not one sharing its own zone’s', () => {
    expect(boss('heraldofdoom')?.sameTableAs).toEqual(['avatarofthenight']);
    expect(boss('lucionwhisper')?.sameTableAs).toEqual(['diablohellhound']);
    expect(boss('talictheeternal')?.sameTableAs).toBeUndefined();
  });

  it('attaches plugin set drops whose monsters are all map bosses', () => {
    expect(boss('madawctheeternal')?.setDrop).toEqual({
      unique: 'Eternal Hourglass of the Timeless Sands',
      with: ['talictheeternal', 'korlictheeternal'],
    });
    expect(boss('lucionwhisper')?.setDrop).toBeUndefined();
  });
});

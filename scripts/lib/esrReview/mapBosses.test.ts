import { describe, expect, it } from 'vitest';
import type { MapBossFacts } from '../../../src/features/campaign-map/data/mapBosses.ts';
import { bossCard } from '../../../src/features/campaign-map/utils/mapBossFacts.ts';
import type { MapBoss } from '../../../src/features/game-data/engine/schema.ts';
import { mapBossesOf, mapBossPageCheck, mapBossPageLines } from './mapBosses.ts';

const boss = (orb: number, terrorShards: number | null = 1): MapBoss => ({
  id: 'hound',
  name: "Diablo's Hellhound",
  arenas: [141],
  tier: 1,
  treasureClass: 'Chasm Of Horror Boss',
  rewards: [
    { kind: 'orb', label: 'Orb of Anointment', chance: [orb, orb] },
    { kind: 'map', label: 'Tier 2 map', chance: [0.25, 0.5], tiers: [2] },
  ],
  otherRolls: 6,
  terrorShards,
});

const facts: Record<string, MapBossFacts> = {
  hound: { fight: [], page: { orb: 5, map: { tier: 2, chance: 25 } } },
};

describe('mapBossPageLines', () => {
  it('has no line when the files match the page', () => {
    expect(mapBossPageLines([boss(0.05)], facts, bossCard)).toEqual([]);
  });

  it('names a reward whose chance differs from the page', () => {
    expect(mapBossPageLines([boss(0.1)], facts, bossCard)).toEqual(["Diablo's Hellhound: Orb of Anointment 10% in the files, page: 5%"]);
  });

  it('names a boss without a terrorized table and a boss without facts', () => {
    expect(mapBossPageLines([boss(0.05, null)], facts, bossCard)[0]).toMatch(
      /^Diablo's Hellhound: terrorized: monstats sets no terrorized/
    );
    expect(mapBossPageLines([boss(0.05)], {}, bossCard)).toEqual(["Diablo's Hellhound (hound): no entry in data/mapBosses.ts"]);
  });

  it('reads the bundle section', () => {
    expect(mapBossesOf({ mapBosses: [boss(0.05)] })).toHaveLength(1);
    expect(mapBossesOf(null)).toEqual([]);
  });
});

describe('mapBossPageCheck', () => {
  it('is ok when the differences are the same, a finding for new ones, info for gone ones', () => {
    expect(mapBossPageCheck(['a'], ['a']).status).toBe('ok');
    expect(mapBossPageCheck(['a'], ['a', 'b'])).toMatchObject({ status: 'finding', details: ['+ b'] });
    expect(mapBossPageCheck(['a', 'b'], ['a'])).toMatchObject({ status: 'info', details: ['- b'] });
  });
});

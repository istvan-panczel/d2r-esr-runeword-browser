import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { CombatArea, CombatBundle } from '@/features/game-data/engine/schema';
import { hitChance } from '@/features/modifiers/utils/modifierMath';
import {
  attackRatingNeeded,
  bossTarget,
  buildCombatSections,
  chanceToBeHit,
  chanceToHit,
  defenseNeeded,
  editedFor,
  neededValues,
  poolTarget,
  prepareCombatData,
  reducedDefense,
  type CombatPlayer,
  type CombatRow,
} from './combatRows';

// The committed bundle (ESR 3.3.03); bundleIntegrity.test.ts checks it matches the generator
const bundle = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data/combat.json'), 'utf-8')) as CombatBundle;
const data = prepareCombatData(bundle);

const areaNamed = (name: string, tier?: number): CombatArea => {
  const area = bundle.areas.find((entry) => entry.name === name && entry.tier === tier);
  if (area === undefined) throw new Error(`no area ${name}`);
  return area;
};
const bossNamed = (id: string) => {
  const boss = bundle.bosses.find((entry) => entry.id === id);
  if (boss === undefined) throw new Error(`no boss ${id}`);
  return boss;
};
const hellPool = (area: CombatArea) => {
  const pool = area.pools[2];
  if (pool === null) throw new Error(`${area.name} has no Hell pool`);
  return pool;
};

/** The sanity player of the research notes (test-fixtures ground truth _hit-chance/sanity.py) */
const STRONG: CombatPlayer = { attackRating: 61_474, defense: 73_276 };

describe('combat.json worked examples', () => {
  it('Worldstone Keep Level 2 (Hell): monster level 88; the Death Knight (attack rating 52,189) is its weakest attacker', () => {
    const pool = hellPool(areaNamed('Worldstone Keep Level 2'));
    expect(pool[0]).toBe(88);
    expect(pool[2]).toEqual([2580, 3548, 4677]);
    expect(pool[3]?.[0]).toBe(52_189);
  });

  it('Chasm of Horrors (Tier 1): monster level 100, defense 4,685, attack rating 620,520', () => {
    const pool = hellPool(areaNamed('Chasm of Horrors', 1));
    expect(pool.slice(0, 4)).toEqual([100, 4, [4685, 4685, 4685], [620_520, 620_520, 620_520]]);
  });

  it('bosses: The Lich King, the tier 1 map bosses, Baal', () => {
    expect(bossNamed('thelichking').stats[2]).toEqual([110, 10_500, 2_743_440]);
    for (const boss of bundle.bosses.filter((entry) => entry.group === 'map' && entry.tier === 1))
      expect(boss.stats[2]).toEqual([110, 4200, 1_567_680]);
    expect(bossNamed('baalcrab').stats[2]).toEqual([99, 6293, 153_660]);
  });

  it('champion / unique bonuses from monumod.txt, levels +2 / +3', () => {
    expect(bundle.modifiers).toEqual({
      champion: { level: 2, attack: 75 },
      unique: { level: 3, attack: 100 },
      minion: { level: 3, attack: 50 },
    });
  });

  it('maps are Hell only, five tiers at monster level 100 to 108', () => {
    const maps = bundle.areas.filter((area) => area.tier !== undefined);
    for (const area of maps) expect(area.pools.slice(0, 2)).toEqual([null, null]);
    expect([...new Set(maps.map((area) => `${String(area.tier)}:${String(hellPool(area)[0])}`))].sort()).toEqual([
      '1:100',
      '2:102',
      '3:104',
      '4:106',
      '5:108',
    ]);
  });
});

describe('poolTarget', () => {
  const t1 = hellPool(areaNamed('Chasm of Horrors', 1));

  it('a champion is two levels up with +75% attack rating, a unique three with +100%', () => {
    const champion = poolTarget(data, t1, 2, 'champion', null);
    expect(champion.level).toBe(102);
    // harbingerofpestillence at monster level 102, straight from the tables: AC(H) 250 × L-AC(H) 1918 / 100
    expect(champion.defense[1]).toBe(Math.floor((250 * 1918) / 100));
    const unique = poolTarget(data, t1, 2, 'unique', null);
    expect(unique.level).toBe(103);
    expect(unique.attack?.[1]).toBeGreaterThan(2 * 620_520);
  });

  it('a regular pool is passed through', () => {
    const regular = poolTarget(data, t1, 2, 'regular', [20, 100]);
    expect(regular.defense).toEqual([4685, 4685, 4685]);
    expect(regular.attack).toEqual([620_520, 620_520, 620_520]);
    expect(regular.randomBonus).toEqual([20, 100]);
  });
});

describe('sanity targets (AR 61,474, defense 73,276)', () => {
  const t1 = hellPool(areaNamed('Chasm of Horrors', 1));

  it('hits a Tier 1 regular 86% and is hit by it 76%', () => {
    const target = poolTarget(data, t1, 2, 'regular', null);
    expect(chanceToHit(data, target, STRONG, 'regular')?.median).toBe(86);
    expect(chanceToBeHit(data, target, STRONG)?.median).toBe(76);
  });

  it('Tier 1 champions and uniques hit it 88 to 90%', () => {
    for (const kind of ['champion', 'unique'] as const) {
      const beHit = chanceToBeHit(data, poolTarget(data, t1, 2, kind, null), STRONG)?.median ?? 0;
      expect(beHit).toBeGreaterThanOrEqual(88);
      expect(beHit).toBeLessThanOrEqual(90);
    }
  });

  it('Hell Act 5 regulars (median) never hit it, the strongest 2% at most but in one area; the Lich King 95%', () => {
    const act5 = bundle.areas.filter((area) => area.tier === undefined && area.act === 4 && area.pools[2] !== null);
    expect(act5.length).toBeGreaterThan(10);
    const above2: string[] = [];
    for (const area of act5) {
      const beHit = chanceToBeHit(data, poolTarget(data, hellPool(area), 2, 'regular', null), STRONG);
      expect(beHit?.median, area.name).toBe(0);
      if ((beHit?.high ?? 0) > 2) above2.push(`${area.name} ${String(beHit?.high)}`);
    }
    // ESR 3.3.03: Nosliwyaj's Reign (Frost Pool 1) has a monster type with attack rating 248,734
    expect(above2).toEqual(["Nosliwyaj's Reign 12"]);
    const lich = bossTarget(bossNamed('thelichking'), 2);
    expect(lich && chanceToBeHit(data, lich, STRONG)?.median).toBe(95);
  });

  it('defense 2,430 is hit 92 to 100% by the median monster of every Hell Act 5 area and map', () => {
    const weak: CombatPlayer = { defense: 2430 };
    const hell = bundle.areas.filter((area) => (area.tier !== undefined || area.act === 4) && area.pools[2]?.[3] != null);
    for (const area of hell) {
      const median = chanceToBeHit(data, poolTarget(data, hellPool(area), 2, 'regular', null), weak)?.median ?? 0;
      expect(median, area.name).toBeGreaterThanOrEqual(92);
    }
  });
});

describe('target defense modifiers', () => {
  it('−% Target Defense lowers defense, halved against uniques and bosses', () => {
    expect(reducedDefense(1000, 40, false)).toBe(600);
    expect(reducedDefense(1000, 40, true)).toBe(800);
    expect(reducedDefense(1000, 150, false)).toBe(0);
    const t1 = poolTarget(data, hellPool(areaNamed('Chasm of Horrors', 1)), 2, 'regular', null);
    const with50 = chanceToHit(data, t1, { attackRating: 61_474, targetDefenseReductionPercent: 50 }, 'regular')?.median;
    expect(with50).toBe(hitChance(61_474, Math.floor(4685 / 2), data.facts));
  });

  it('Ignore Target’s Defense hits 100% and is flagged as unsure on bosses', () => {
    const player: CombatPlayer = { attackRating: 1000, ignoreTargetDefense: true };
    const sections = buildCombatSections(data, player, { difficulty: 2, kind: 'regular' });
    const rows: CombatRow[] = sections.flatMap((section) => section.groups.flatMap((group) => group.rows));
    expect(rows.every((row) => row.hit?.median === 100)).toBe(true);
    expect(rows.filter((row) => row.ignoreDefenseUnsure).every((row) => row.key.startsWith('boss:'))).toBe(true);
    expect(rows.some((row) => row.ignoreDefenseUnsure)).toBe(true);
  });
});

describe('buildCombatSections', () => {
  it('Hell: campaign by act, maps by tier, bosses; Normal has no maps and only act bosses', () => {
    const hell = buildCombatSections(data, STRONG, { difficulty: 2, kind: 'regular' });
    expect(hell.map((section) => section.key)).toEqual(['campaign', 'maps', 'bosses']);
    expect(hell[0]?.groups.map((group) => group.title)).toEqual(['Act 1', 'Act 2', 'Act 3', 'Act 4', 'Act 5']);
    expect(hell[1]?.groups.map((group) => group.title)).toEqual(['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5']);
    const normal = buildCombatSections(data, STRONG, { difficulty: 0, kind: 'regular' });
    expect(normal.map((section) => section.key)).toEqual(['campaign', 'bosses']);
    expect(normal[1]?.groups.map((group) => group.key)).toEqual(['act']);
  });

  it('without a player every chance is null', () => {
    const rows = buildCombatSections(data, {}, { difficulty: 1, kind: 'champion' }).flatMap((section) =>
      section.groups.flatMap((group) => group.rows)
    );
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.every((row) => row.hit === null && row.beHit === null)).toBe(true);
  });

  it('casters-only pools have no chance to be hit', () => {
    const rows = buildCombatSections(data, STRONG, { difficulty: 2, kind: 'regular' }).flatMap((section) =>
      section.groups.flatMap((group) => group.rows)
    );
    for (const row of rows) if (row.target.attack === null) expect(row.beHit).toBeNull();
  });
});

describe('needed values', () => {
  it('attack rating for 75% / 95% hits is the curve inverted (r = 8 and r ≈ 37.5 above the pivot)', () => {
    const ar75 = attackRatingNeeded(75, 4685, data);
    expect(ar75).not.toBeNull();
    expect(hitChance(ar75 ?? 0, 4685, data.facts)).toBe(75);
    expect(hitChance((ar75 ?? 0) - 1, 4685, data.facts)).toBe(74);
    expect(Math.round((ar75 ?? 0) / 4685)).toBe(8);
  });

  it('defense for at most 25% / 5% to be hit is the smallest such defense', () => {
    for (const chance of [25, 5]) {
      const defense = defenseNeeded(chance, 620_520, data);
      expect(defense).not.toBeNull();
      expect(hitChance(620_520, defense ?? 0, data.facts)).toBeLessThanOrEqual(chance);
      expect(hitChance(620_520, (defense ?? 0) - 1, data.facts)).toBeGreaterThan(chance);
    }
    expect(defenseNeeded(100, 1000, data)).toBe(0);
  });

  it('neededValues against a boss halves −% Target Defense and has a defense goal per chance', () => {
    const lich = bossTarget(bossNamed('thelichking'), 2);
    if (lich === null) throw new Error('no Lich King in Hell');
    const plain = neededValues(data, lich, {}, 'regular');
    const reduced = neededValues(data, lich, { targetDefenseReductionPercent: 50 }, 'regular');
    expect(plain.attackRating.map((entry) => entry.chance)).toEqual([75, 95]);
    expect(reduced.attackRating[0]?.typical).toBe(attackRatingNeeded(75, 7875, data));
    expect(plain.defense.map((entry) => entry.chance)).toEqual([25, 5]);
    expect(plain.defense[0]?.typical).toBe(defenseNeeded(25, 2_743_440, data));
  });
});

describe('editedFor', () => {
  it('keeps an edit while the character value it was typed over stays the same', () => {
    expect(editedFor(null, 100)).toBeNull();
    expect(editedFor({ value: '5000', over: 100 }, 100)).toBe('5000');
    expect(editedFor({ value: '5000', over: 100 }, 200)).toBeNull();
    expect(editedFor({ value: true, over: undefined }, undefined)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { Area, MapBoss, ModifierFact } from '../engine/schema.ts';
import { buildCombatBundle, readModifiers } from './bundleCombat.ts';
import { parseTsv } from './tsv.ts';

const table = (rows: (string | number)[][]) => parseTsv(rows.map((row) => row.map(String).join('\t')).join('\n'));

// monlvl.txt: every ratio 100 (values pass through), but level 100 doubles defense and level 102 / 103 triple / quadruple
const MONLVL = table([
  ['Level', 'L-AC', 'L-AC(N)', 'L-AC(H)', 'L-TH', 'L-TH(N)', 'L-TH(H)'],
  ...Array.from({ length: 111 }, (_, level) => {
    const hell = level === 100 ? 200 : level === 102 ? 300 : level === 103 ? 400 : 100;
    return [level, 100, 100, hell, 100, 100, hell];
  }),
]);

const MON_HEADER = ['Id', 'MonType', 'MonProp', 'NameStr', 'boss', 'noRatio', 'Level', 'Level(N)', 'Level(H)'];
const STAT_COLUMNS = ['AC', 'A1TH', 'A2TH', 'S1TH'];
const mon = (id: string, type: string, boss: number, levels: [number, number, number], ac: number, th: [number, number, number]) => [
  id,
  type,
  'prop',
  id,
  boss,
  '',
  ...levels,
  ...[0, 1, 2].flatMap(() => [ac, ...th]),
];
const MONSTATS = table([
  [...MON_HEADER, ...['', '(N)', '(H)'].flatMap((suffix) => STAT_COLUMNS.map((column) => `${column}${suffix}`))],
  mon('zombie', 'zombie', 0, [2, 40, 80], 10, [100, 0, 0]),
  mon('archer', 'skeleton', 0, [4, 40, 80], 20, [50, 200, 0]),
  mon('caster', 'skeleton', 0, [6, 40, 80], 30, [0, 0, 0]),
  mon('treasuregoblin', 'treasuregoblin', 0, [110, 110, 110], 99, [999, 0, 0]),
  mon('corruptedzakarumarcher', 'corruptrogue', 0, [25, 56, 88], 99, [999, 0, 0]),
  mon('clone', 'human', 1, [44, 68, 92], 99, [999, 0, 0]),
  mon('mapmon', 'demon', 0, [100, 100, 100], 50, [1000, 0, 0]),
  mon('andariel', 'demon', 1, [13, 51, 88], 220, [940, 0, 0]),
  mon('uberandariel', 'demon', 1, [110, 110, 110], 150, [500, 0, 0]),
  mon('mapboss', 'demon', 1, [110, 110, 110], 200, [4000, 0, 0]),
]);

const LEVELS = table([
  [
    'Id',
    'Name',
    ...Array.from({ length: 25 }, (_, i) => `mon${String(i + 1)}`),
    ...Array.from({ length: 25 }, (_, i) => `nmon${String(i + 1)}`),
  ],
  [
    2,
    'Blood Moor',
    'zombie',
    'archer',
    'caster',
    'treasuregoblin',
    ...Array<string>(21).fill(''),
    'zombie',
    'archer',
    'clone',
    'corruptedzakarumarcher',
  ],
  [140, 'T1 L1', ...Array<string>(25).fill(''), 'mapmon', 'treasuregoblin'],
  [141, 'T1 L2', ...Array<string>(25).fill(''), 'mapmon'],
  [213, 'Goblin Realm', ...Array<string>(25).fill(''), 'treasuregoblin'],
]);

const MONPROP = table([
  [
    'Id',
    'prop1',
    'chance1',
    'min1',
    'max1',
    'prop1 (N)',
    'chance1 (N)',
    'min1 (N)',
    'max1 (N)',
    'prop1 (H)',
    'chance1 (H)',
    'min1 (H)',
    'max1 (H)',
  ],
  ['prop', 'monrandombonus', 20, 20, 20, 'monrandombonus', 30, 40, 40, 'monrandombonus', 40, 60, 60],
]);

const MONUMOD = [
  ['uniquemod', 'id', 'constants', '*constant desc'],
  ['a', '0', '75', 'Champion Attack Rating % Bonus'],
  ['b', '1', '100', 'Unique Attack Rating % Bonus'],
  ['c', '2', '50', 'Minion of Unique Attack Rating % Bonus'],
]
  .map((row) => row.join('\t'))
  .join('\n');

const area = (id: number, name: string, extra: Partial<Area> = {}): Area => ({
  id,
  name,
  act: 0,
  waypoint: false,
  level: [1, 40, 80],
  density: null,
  uniques: null,
  connections: [],
  terrain: 'outdoor',
  ...extra,
});
const AREAS: Area[] = [
  area(1, 'Rogue Encampment', { level: null }),
  area(2, 'Blood Moor'),
  area(140, 'Chasm L1', { act: 4, tier: 1, group: 'Chasm', level: [100, 100, 100] }),
  area(141, 'Chasm L2', { act: 4, tier: 1, group: 'Chasm', level: [100, 100, 100] }),
  area(213, 'The Hidden Vault', { act: 4, uniqueMap: true, group: 'Goblin Realm', level: [106, 106, 106] }),
];
const MAP_BOSSES = [{ id: 'mapboss', name: 'Map Boss', tier: 1 }] as MapBoss[];
const CURVE = {
  key: 'attackRating.curve',
  label: 'curve',
  value: {},
  origin: 'esr-config',
  source: { file: 'x', key: 'curve' },
} as ModifierFact;

const build = () =>
  buildCombatBundle({
    levels: LEVELS,
    monstats: MONSTATS,
    monprop: MONPROP,
    monlvl: MONLVL,
    monumodText: MONUMOD,
    areas: AREAS,
    mapBosses: MAP_BOSSES,
    curve: CURVE,
    strings: new Map(),
  });

describe('buildCombatBundle', () => {
  const result = build();
  const { bundle } = result;

  it('reads the monumod constants by description and the level ratios per level', () => {
    expect(bundle.modifiers).toEqual({
      champion: { level: 2, attack: 75 },
      unique: { level: 3, attack: 100 },
      minion: { level: 3, attack: 50 },
    });
    expect(bundle.levelRatios).toHaveLength(111);
    expect(bundle.levelRatios[100]).toEqual([100, 100, 200, 100, 100, 200]);
  });

  it('leaves goblins, Corrupted Zakarum spawns and boss rows out of a pool; Normal uses the monsters’ own levels', () => {
    const blood = bundle.areas.find((entry) => entry.id === 2);
    // Normal: zombie (lvl 2), archer (4), caster (6, no attack); best attack per monster (archer: A2TH 200)
    expect(blood?.pools[0]).toEqual([4, 3, [10, 20, 30], [100, 100, 200], { range: [2, 6], casters: 1 }]);
    // Nightmare: zombie and archer only (clone and Zakarum left out), area level
    expect(blood?.pools[1]).toEqual([40, 2, [10, 10, 20], [100, 100, 200]]);
    expect(result.counts.combatExcludedGoblins).toBe(1);
    expect(result.counts.combatExcludedSpecial).toBe(1);
    expect(result.counts.combatExcludedBosses).toBe(1);
  });

  it('merges a map zone into one Hell-only entry and drops a goblin-only map', () => {
    const maps = bundle.areas.filter((entry) => entry.levels !== undefined);
    expect(maps).toEqual([
      { id: 140, name: 'Chasm', act: 4, tier: 1, levels: [140, 141], pools: [null, null, [100, 1, [100, 100, 100], [2000, 2000, 2000]]] },
    ]);
    expect(result.counts.combatMapZonesDropped).toBe(1);
    expect(bundle.areas.some((entry) => entry.name === 'Rogue Encampment')).toBe(false);
  });

  it('keeps the common random spawn bonus as the default', () => {
    expect(bundle.randomBonus).toEqual({
      campaign: [
        [20, 20],
        [30, 40],
        [40, 60],
      ],
      maps: [40, 60],
    });
  });

  it('bosses: act bosses in every difficulty at their own level, the others in Hell', () => {
    expect(bundle.bosses.map((boss) => [boss.id, boss.group])).toEqual([
      ['andariel', 'act'],
      ['uberandariel', 'uber'],
      ['mapboss', 'map'],
    ]);
    expect(bundle.bosses[0]?.stats).toEqual([
      [13, 220, 940],
      [51, 220, 940],
      [88, 220, 940],
    ]);
    expect(bundle.bosses[1]?.stats).toEqual([null, null, [110, 150, 500]]);
    expect(bundle.bosses[2]?.tier).toBe(1);
  });

  it('warns about missing bosses and worked examples instead of failing', () => {
    expect(result.warnings).toContain('combat: boss duriel is not in monstats.txt');
    expect(result.warnings.some((warning) => warning.startsWith('combat: worked example The Lich King'))).toBe(true);
  });

  it('throws without the hit curve', () => {
    expect(() =>
      buildCombatBundle({
        levels: LEVELS,
        monstats: MONSTATS,
        monprop: MONPROP,
        monlvl: MONLVL,
        monumodText: MONUMOD,
        areas: AREAS,
        mapBosses: [],
        curve: undefined,
        strings: new Map(),
      })
    ).toThrow(/attackRating.curve/);
  });
});

describe('readModifiers', () => {
  it('falls back to the vanilla bonuses with a warning', () => {
    const warnings: string[] = [];
    expect(readModifiers('uniquemod\tid\n', (message) => warnings.push(message)).champion).toEqual({ level: 2, attack: 75 });
    expect(warnings).toHaveLength(1);
  });
});

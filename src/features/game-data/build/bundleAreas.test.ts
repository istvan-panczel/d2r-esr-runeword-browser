import { describe, expect, it } from 'vitest';
import { buildAreasBundle, levelTerrain, mapTierLevel, readUniquePacks } from './bundleAreas.ts';

const MONSTER_COLUMNS = ['mon1', 'mon2', 'nmon1', 'umon1'];
const COLUMNS = [
  'Name',
  '*Map Boss',
  '*IsInside',
  'Id',
  'Act',
  'LevelType',
  'Teleport',
  'QuestFlag',
  'QuestFlagEx',
  ...['Vis0', 'Vis1', 'Vis2', 'Vis3', 'Vis4', 'Vis5', 'Vis6', 'Vis7'],
  'MonLvl',
  'MonLvl(N)',
  'MonLvl(H)',
  'MonLvlEx',
  'MonLvlEx(N)',
  'MonLvlEx(H)',
  'MonDen',
  'MonDen(N)',
  'MonDen(H)',
  'MonUMin',
  'MonUMax',
  'MonUMin(N)',
  'MonUMax(N)',
  'MonUMin(H)',
  'MonUMax(H)',
  ...MONSTER_COLUMNS,
  'Waypoint',
  'LevelName',
  'LevelGroup',
  'PreventTownPortal',
];

interface RowSpec {
  name: string;
  boss?: string;
  inside?: boolean;
  id: string;
  act?: string;
  /** LevelType (default 2: outdoor, tower inside) */
  type?: string;
  teleport?: string;
  quest?: [string, string];
  vis?: [string, string];
  /** MonLvl N/NM/H then MonLvlEx N/NM/H */
  lvl?: string[];
  den?: string[];
  uniques?: string[];
  mon?: string;
  waypoint?: string;
  levelName?: string;
  group?: string;
  noTp?: boolean;
}

function row(spec: RowSpec): string[] {
  return [
    spec.name,
    spec.boss ?? '',
    spec.inside === true ? '1' : '0',
    spec.id,
    spec.act ?? '0',
    spec.type ?? '2',
    spec.teleport ?? '1',
    ...(spec.quest ?? ['0', '0']),
    ...(spec.vis ?? ['0', '0']),
    ...['0', '0', '0', '0', '0', '0'],
    ...(spec.lvl ?? ['', '', '', '', '', '']),
    ...(spec.den ?? ['0', '0', '0']),
    ...(spec.uniques ?? ['', '', '', '', '', '']),
    spec.mon ?? '',
    '',
    '',
    '',
    spec.waypoint ?? '255',
    spec.levelName ?? '',
    spec.group ?? '',
    spec.noTp === true ? '1' : '0',
  ];
}

const text = (rows: string[][]) => [COLUMNS, ...rows].map((cells) => cells.join('\t')).join('\n');
const LEVELS = text([
  row({ name: 'Null', id: '0', vis: ['0', '0'] }),
  row({ name: 'Act 1 - Town', id: '1', type: '1', waypoint: '0', levelName: 'Rogue Encampment', vis: ['2', '2'], noTp: true }),
  row({
    name: 'Act 1 - Wilderness 1',
    id: '2',
    vis: ['1', '3'],
    lvl: ['1', '26', '51', '2', '38', '68'],
    den: ['520', '1000', '1500'],
    uniques: ['2', '4', '6', '5', '8', '10'],
    mon: 'zombie1',
    levelName: 'Blood Moor',
  }),
  row({
    name: 'Act 1 - Tower 1',
    id: '3',
    inside: true,
    teleport: '2',
    quest: ['11', '0'],
    vis: ['2', '0'],
    lvl: ['7', '32', '57', '8', '40', '72'],
    levelName: 'Forgotten Tower',
  }),
  ['Expansion', ...COLUMNS.slice(1).map(() => '')],
  row({
    name: 'Act 5 - Colossal Summit',
    id: '4',
    act: '4',
    type: '31',
    quest: ['26', '40'],
    lvl: ['39', '64', '89', '45', '68', '91'],
    mon: 'x',
    levelName: 'ColossalSummit',
  }),
  row({
    name: 'Tier 1 Map - Chasm of Horror Prep Zone',
    id: '5',
    act: '4',
    vis: ['0', '6'],
    lvl: ['100', '100', '100', '100', '100', '100'],
    levelName: 'Chasm of Horrors',
    group: 'Tier 1 Map - Chasm of Horrors',
  }),
  row({
    name: 'Tier 1 Map - Chasm of Horror Level 1',
    id: '6',
    act: '4',
    type: '3',
    inside: true,
    vis: ['5', '7'],
    lvl: ['100', '100', '100', '100', '100', '100'],
    den: ['2000', '2000', '2000'],
    uniques: ['30', '40', '30', '40', '30', '40'],
    mon: 'harbinger',
    levelName: 'Chasm of Horrors Level 1',
    group: 'Tier 1 Map - Chasm of Horrors',
  }),
  row({
    name: 'Tier 1 Map - Chasm of Horror Level 2',
    boss: "Diablo's Hellhound",
    id: '7',
    act: '4',
    type: '99',
    inside: true,
    teleport: '0',
    vis: ['6', '6'],
    lvl: ['100', '100', '100', '102', '102', '102'],
    levelName: 'Chasm of Horrors Level 2',
    group: 'Tier 2 Map - Chasm of Horrors',
  }),
  row({
    name: 'Unique Map - Goblin Realm',
    id: '8',
    act: '4',
    type: '31',
    vis: ['99', '0'],
    lvl: ['106', '106', '106', '106', '106', '106'],
    den: ['1500', '1500', '1500'],
    mon: 'goblin',
    levelName: 'The Hidden Vault',
  }),
  // A removed level (REMOVED_LEVELS; 36 is missing): left out, its one-way links not counted
  row({
    name: 'Act 1 - Jail 2',
    id: '30',
    vis: ['2', '0'],
    lvl: ['10', '35', '60', '11', '40', '70'],
    mon: 'x',
    levelName: 'Jail Level 2',
  }),
  // A tier map entrance without "Prep Zone" in its name and without monsters, and the map level it enters
  row({
    name: 'Tier 5 Map - The Icecrown Citadel',
    id: '10',
    act: '4',
    inside: true,
    vis: ['11', '0'],
    lvl: ['108', '108', '108', '108', '108', '108'],
    levelName: 'The Icecrown Citadel',
    group: 'Tier 5 Map - Icecrown Citadel',
  }),
  row({
    name: 'Tier 5 Map - The Icecrown Citadel',
    id: '11',
    act: '4',
    type: '33',
    inside: true,
    vis: ['10', '0'],
    lvl: ['108', '108', '108', '108', '108', '108'],
    mon: 'x',
    waypoint: '26',
    levelName: 'The Icecrown Citadel',
    group: 'Tier 5 Map - Icecrown Citadel',
  }),
  // A Vis link the target does not list back
  row({ name: 'Act 1 - Wilderness 9', id: '12', vis: ['2', '0'], lvl: ['1', '1', '1', '1', '1', '1'], mon: 'x', levelName: 'Lost Farm' }),
]);
const CUBEMAIN = [
  ['description', 'enabled', 'input 1', 'output'],
  ['Tier 1 Map Chasm of Horror', '1', 'z01', '"Red Portal,lvl=5,qty=1"'],
  ['Tier 5 Map Icecrown Citadel', '1', 'z18', 'Red Portal,lvl=10,qty=1'],
  ['Unique Map - Goblin Realm', '1', 'z99', 'Red Portal,lvl=8,qty=1'],
  ['Disabled', '0', 'zz1', 'Red Portal,lvl=6,qty=1'],
  ['Unknown level', '1', 'z77', 'Red Portal,lvl=999,qty=1'],
  ['Cow portal', '1', '"leg,tbk"', 'Cow Portal'],
]
  .map((cells) => cells.join('\t'))
  .join('\n');
const STRINGS = new Map([
  ['Rogue Encampment', 'Rogue Encampment'],
  ['Blood Moor', 'Blood Moor'],
  ['Forgotten Tower', 'Forgotten Tower'],
  ['Chasm of Horrors Level 1', 'Chasm of Horrors Level 1'],
  ['Chasm of Horrors Level 2', 'Chasm of Horrors Level 2'],
  ['The Hidden Vault', 'The Hidden Vault'],
  ['The Icecrown Citadel', 'The Icecrown Citadel'],
  ['Lost Farm', 'Lost Farm (Endgame Zone)'],
]);

const result = buildAreasBundle({ levelsText: LEVELS, cubemainText: CUBEMAIN, strings: STRINGS });
const byId = new Map(result.bundle.areas.map((area) => [area.id, area]));

describe('buildAreasBundle', () => {
  it('leaves out the null row, the Expansion marker, the map entrances and the removed levels', () => {
    expect(result.bundle.areas.map((area) => area.id)).toEqual([1, 2, 3, 4, 6, 7, 8, 11, 12]);
    expect(result.hidden).toEqual({ prepZones: 2, removed: 1, other: 1 });
    expect(result.uniquesMinsThenMaxes).toBe(1);
  });

  it('reads the expansion monster level, density and unique packs per difficulty', () => {
    expect(byId.get(2)).toEqual({
      id: 2,
      name: 'Blood Moor',
      act: 0,
      waypoint: false,
      level: [2, 38, 68],
      density: [520, 1000, 1500],
      uniques: [
        [2, 5],
        [4, 8],
        [6, 10],
      ],
      connections: [1, 3],
      terrain: 'outdoor',
    });
  });

  it('keeps towns with a waypoint and no level, and areas without monsters without a level', () => {
    expect(byId.get(1)).toMatchObject({ name: 'Rogue Encampment', waypoint: true, level: null, density: null, uniques: null });
    expect(byId.get(1)?.preventTownPortal).toBe(true);
    expect(byId.get(1)?.connections).toEqual([2]);
    expect(byId.get(3)?.level).toBeNull();
  });

  it('falls back to the internal name without its act prefix when the string is missing', () => {
    expect(byId.get(4)?.name).toBe('Colossal Summit');
  });

  it('reads map tiers, zone groups and bosses, and drops connections to hidden rows', () => {
    expect(byId.get(6)).toMatchObject({ tier: 1, group: 'Chasm of Horrors', level: [100, 100, 100], connections: [7] });
    expect(byId.get(7)).toMatchObject({ tier: 1, boss: "Diablo's Hellhound", level: [102, 102, 102], density: null, connections: [6] });
    expect(byId.get(8)).toMatchObject({ uniqueMap: true, group: 'Goblin Realm', name: 'The Hidden Vault', connections: [] });
    expect(byId.get(8)?.tier).toBeUndefined();
  });

  it("puts each map item on the level its red portal enters: the entrance's Vis target, else the portal level itself", () => {
    expect(byId.get(6)?.mapItem).toBe('z01');
    expect(byId.get(11)).toMatchObject({ tier: 5, group: 'Icecrown Citadel', mapItem: 'z18', connections: [] });
    expect(byId.get(8)?.mapItem).toBe('z99');
    expect(result.bundle.areas.filter((area) => area.mapItem !== undefined)).toHaveLength(3);
  });

  it('gives map rows no waypoint (their Waypoint slot is a copy)', () => {
    expect(byId.get(11)?.waypoint).toBe(false);
  });

  it('keeps a Vis link only when both rows list each other', () => {
    expect(byId.get(2)?.connections).toEqual([1, 3]);
    expect(byId.get(12)?.connections).toEqual([]);
    expect(result.oneWayVis).toBe(1);
  });

  it('reads the terrain, teleport rule, quest gate and endgame zone flag', () => {
    expect(result.bundle.areas.map((area) => [area.id, area.terrain])).toEqual([
      [1, 'town'],
      [2, 'outdoor'],
      [3, 'tower'],
      [4, 'outdoor'],
      [6, 'cave'],
      [7, 'dungeon'],
      [8, 'outdoor'],
      [11, 'cave'],
      [12, 'outdoor'],
    ]);
    expect(byId.get(3)).toMatchObject({ teleport: 'restricted', questGate: 11 });
    expect(byId.get(7)?.teleport).toBe('off');
    expect(byId.get(2)?.teleport).toBeUndefined();
    expect(byId.get(4)?.questGate).toBe(40);
    expect(byId.get(12)).toMatchObject({ name: 'Lost Farm (Endgame Zone)', endgameZone: true });
    expect(byId.get(2)?.endgameZone).toBeUndefined();
  });

  it('warns about a map tier that disagrees with its level or LevelGroup, unknown levels and level types, and unexpected one-way links', () => {
    expect(result.warnings).toEqual([
      'areas: removed level 36 is no longer in levels.txt; update REMOVED_LEVELS',
      'areas: cubemain red portal of z77 (lvl=999) leads to no listed level',
      'areas: levels.txt 7 (Tier 1 Map - Chasm of Horror Level 2) is tier 1 but its LevelGroup "Tier 2 Map - Chasm of Horrors" says tier 2',
      'areas: levels.txt 7 (Tier 1 Map - Chasm of Horror Level 2) is tier 1 (level 100) but has monster level 102/102/102',
      'areas: levels.txt 7 (Tier 1 Map - Chasm of Horror Level 2) has the unknown LevelType 99; shown as dungeon',
      'areas: levels.txt 8 (Unique Map - Goblin Realm) Vis names unknown level 99',
      'areas: levels.txt 12 (Act 1 - Wilderness 9) links to levels.txt 2, which does not link back; dropped',
    ]);
  });

  it('warns when levels.txt lacks the *IsInside or *Map Boss comment column', () => {
    const header = (LEVELS.split('\n')[0] ?? '').split('\t');
    const without = (name: string) => {
      const index = header.indexOf(name);
      return LEVELS.split('\n')
        .map((line) =>
          line
            .split('\t')
            .filter((_, i) => i !== index)
            .join('\t')
        )
        .join('\n');
    };
    const warningsWithout = (name: string) =>
      buildAreasBundle({ levelsText: without(name), cubemainText: CUBEMAIN, strings: STRINGS }).warnings.filter((text) =>
        text.includes('column')
      );
    expect(warningsWithout('*IsInside')).toEqual(['areas: levels.txt has no *IsInside column; read as empty']);
    expect(warningsWithout('*Map Boss')).toEqual(['areas: levels.txt has no *Map Boss column; read as empty']);
    expect(result.warnings.filter((text) => text.includes('column'))).toEqual([]);
  });

  it('numbers the map tier levels 100 to 108', () => {
    expect([1, 2, 3, 4, 5].map(mapTierLevel)).toEqual([100, 102, 104, 106, 108]);
  });
});

describe('levelTerrain', () => {
  it('splits the outdoor level types by IsInside and knows no other types', () => {
    expect(levelTerrain(2, false)).toBe('outdoor');
    expect(levelTerrain(2, true)).toBe('tower');
    expect(levelTerrain(22, true)).toBe('temple');
    expect(levelTerrain(31, true)).toBe('temple');
    expect(levelTerrain(10, true)).toBe('tomb');
    expect(levelTerrain(19, true)).toBe('special');
    expect(levelTerrain(29, false)).toBe('town');
    expect(levelTerrain(36, false)).toBeNull();
  });
});

describe('readUniquePacks', () => {
  it('re-reads a vanilla row stored mins then maxes', () => {
    expect(readUniquePacks([2, 4, 6, 5, 8, 10])).toEqual({
      packs: [
        [2, 5],
        [4, 8],
        [6, 10],
      ],
      minsThenMaxes: true,
      ok: true,
    });
  });

  it('keeps an ESR row pairwise per the header', () => {
    expect(readUniquePacks([30, 40, 30, 40, 30, 40])).toEqual({
      packs: [
        [30, 40],
        [30, 40],
        [30, 40],
      ],
      minsThenMaxes: false,
      ok: true,
    });
  });

  it('keeps the pairwise values and flags the row when both readings are inverted', () => {
    expect(readUniquePacks([5, 1, 5, 1, 5, 1])).toEqual({
      packs: [
        [5, 1],
        [5, 1],
        [5, 1],
      ],
      minsThenMaxes: false,
      ok: false,
    });
  });
});

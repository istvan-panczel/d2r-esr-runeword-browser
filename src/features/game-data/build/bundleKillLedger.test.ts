import { describe, expect, it } from 'vitest';
import type { Area, CubeRecipe, MapBoss } from '../engine/schema.ts';
import { bossKey, buildKillLedgerBundle, type KillLedgerInput } from './bundleKillLedger.ts';
import type { CubeMod, CubeRow } from './cube/cubeRows.ts';
import { parseTsv, type TsvTable } from './tsv.ts';

const tsv = (name: string, columns: readonly string[], rows: readonly (readonly string[])[]): TsvTable =>
  parseTsv([columns, ...rows].map((row) => row.join('\t')).join('\n'), `${name}.txt`);

const mod = (code: string, min = 1): CubeMod => ({ mod: code, param: '', min, max: min });

interface RecipeSpec {
  line: number;
  family: string;
  description: string;
  inputs: readonly (readonly [string, number])[];
  mods: readonly CubeMod[];
  value?: number;
  outputCode?: string;
}

const row = (spec: RecipeSpec): CubeRow => ({
  line: spec.line,
  description: spec.description,
  cls: '',
  minDiff: 0,
  inputs: [],
  outputs: [{ spec: 'useitem', mods: [...spec.mods] }],
  condition: spec.value === undefined ? null : { op: 6, param: 508, value: spec.value },
});

const recipe = (spec: RecipeSpec): CubeRecipe => ({
  id: spec.line,
  family: spec.family,
  group: 0,
  description: spec.description,
  inputs: spec.inputs.map(([text, qty]) => ({
    text: qty > 1 ? `${String(qty)}× ${text}` : text,
    code: text,
    qty,
    quals: [],
    kind: 'item',
  })),
  outputs: [{ text: 'The same item', code: spec.outputCode ?? null, bonus: [], details: [] }],
  conditions: [],
  qualities: [],
});

const LEDGER: readonly [string, number] = ['Kill Ledger', 1];

const SPECS: readonly RecipeSpec[] = [
  // Tier rows are out of file order: the bundle sorts by kills
  {
    line: 10,
    family: 'kill-ledger-tiers',
    description: 'Kill Ledger Tier 2',
    inputs: [LEDGER, ['Blemished Gem', 1]],
    mods: [mod('all-speeds', 10), mod('mythicaldesc', -1), mod('mythicaldesc', 1), mod('kill-ledger-tier-2')],
    value: 5000,
  },
  {
    line: 11,
    family: 'kill-ledger-tiers',
    description: 'Kill Ledger Tier 1',
    inputs: [LEDGER, ['Flawless Gem', 1]],
    mods: [mod('res-all', 10), mod('kill-ledger-tier-1')],
    value: 500,
  },
  {
    line: 20,
    family: 'kill-ledger-bosses',
    description: 'Kill Ledger Lucion Whisper',
    inputs: [LEDGER, ['Flawed Cinnabar', 2]],
    mods: [mod('regen', 500), mod('kill-ledger-lucion-whisper')],
    value: 50,
  },
  {
    line: 21,
    family: 'kill-ledger-bosses',
    description: 'Kill Ledger Eternal Ancients',
    inputs: [LEDGER, ['Maple Leaf', 1], ['Flawed Tainted Tourmaline', 1]],
    mods: [mod('red-dmg%', 5), mod('kill-ledger-eternal-ancients')],
    value: 60,
  },
  {
    line: 22,
    family: 'kill-ledger-bosses',
    description: "Kill Ledger Rathma + Kor'nac",
    inputs: [LEDGER, ['Maple Leaf', 1]],
    mods: [mod('curse-res', 15), mod('kill-ledger-rathma')],
    value: 208,
  },
  {
    line: 23,
    family: 'kill-ledger-bosses',
    description: 'Kill Ledger Rathma',
    inputs: [LEDGER, ['Maple Leaf', 1]],
    mods: [mod('curse-res', 15), mod('kill-ledger-rathma')],
    value: 99,
  },
  {
    line: 30,
    family: 'starter-pack',
    description: "Adventurer's Pack",
    inputs: [['Starter Pack', 1]],
    mods: [],
    outputCode: 'Kill Ledger',
  },
  {
    line: 31,
    family: 'starter-pack',
    description: "Adventurer's Pack",
    inputs: [['Starter Pack', 1]],
    mods: [],
    outputCode: 'Kill Ledger',
  },
  {
    line: 32,
    family: 'starter-pack',
    description: "Another Adventurer's Pack",
    inputs: [
      ['Tome of Identify', 1],
      ['Tome of Town Portal', 1],
    ],
    mods: [],
    outputCode: 'ag8',
  },
];

// Skills: row n is skill id n; other kill_check skills (buffs) are ignored
const SKILLS = tsv(
  'skills',
  ['skill', 'aurastat1', 'aurastatcalc1', 'auralencalc'],
  [
    ['Boss Cooldown Buff', 'kill_check', '200', '3'],
    ['Just Killed Boss', 'kill_check', 'lvl', '1500'],
    ['Just Killed Rathma', 'kill_check', 'clc1?100:99', '1500'],
    ['Just Killed Kornac', 'kill_check', 'clc1?110:109', '1500'],
  ]
);

const MONPROP = tsv(
  'monprop',
  ['Id', 'prop1', 'par1', 'max1', 'prop1 (H)', 'par1 (H)', 'max1 (H)'],
  [
    ['lucionwhisper', 'death-skill', '1', '50', 'death-skill', '1', '50'],
    ['talic', 'death-skill', '1', '60', '', '', ''],
    ['madawc', 'death-skill', '1', '60', '', '', ''],
    ['rathma', 'death-skill', '2', '1', '', '', ''],
    ['kornac', 'death-skill', '3', '1', '', '', ''],
    ['cooldown', 'death-skill', '0', '1', '', '', ''],
  ]
);

const MISC = tsv('misc', ['code', 'spelldescstr'], [['led', 'leddesc']]);

/** Row index = hcIdx, as the ascendancies config counts them */
const MONSTATS = tsv('monstats', ['Id'], [['skeleton1'], ['lucionwhisper'], ['talic'], ['madawc'], ['rathma'], ['kornac']]);

/** The ascendancies plugin's kill credit (ESR 3.3.04): the same values as the monprop death skills above */
const ASCENDANCIES = `[ascendancies]
# Kill credit ([[kill_credit]]): kill_check_stat on a timed state, for this many frames
kill_check_stat = 508
kill_credit_frames = 1500

[[kill_credit]]
name = "Lucion's Whisper"
monsters = [1]
value = 50

[[kill_credit]]
name = "Eternal Ancients"
monsters = [3, 2]
value = 60

[[kill_credit]]
name = "Rathma"
monsters = [4]
value = 99
value_above = 100
maxhp_above = 2000000000

[[kill_credit]]
name = "Kor'nac the Hollow Apostle"
monsters = [5]
value = 109
value_above = 110
`;

const NO_DEATH_SKILLS = tsv('monprop', ['Id', 'prop1', 'par1', 'max1'], []);

const bossEntry = (id: string, name: string, arenas: number[], tier: number): MapBoss => ({
  id,
  name,
  arenas,
  tier,
  treasureClass: 'x',
  rewards: [],
  otherRolls: 0,
  terrorShards: null,
});

const MAP_BOSSES: readonly MapBoss[] = [
  bossEntry('lucionwhisper', "Lucion's Whisper", [149, 159], 1),
  bossEntry('talic', 'Talic The Eternal', [203], 5),
  bossEntry('madawc', 'Madawc The Eternal', [203], 5),
  bossEntry('rathma', 'Rathma', [206], 5),
];

const area = (id: number, name: string, tier: number, extra: Partial<Area> = {}) => ({ id, name, tier, ...extra }) as Area;

const AREAS: readonly Area[] = [
  area(149, 'Cellar of Pain Level 2', 1),
  area(159, 'Chaos Rift Level 4', 2, { mapBossPick: 2 }),
  area(203, 'The Edge of Eternity', 5),
  area(206, 'The Crepuscular Basilica', 5),
];

const PAGE = `<table>
<tr><td>Kill Ledger<br>(At least 500 kills)<br>Any Flawless Gem<br></td><td>Kill Ledger<br>+10% to All Resistances<br></td></tr>
<tr><td>Kill Ledger<br>(At least 5000 kills)<br>Any Blemished Gem<br></td><td>Kill Ledger<br>+10% to All Speeds<br></td></tr>
<tr><td colspan="2">You have 60 seconds to transmute</td></tr>
<tr><td>Kill Ledger<br>2x Flawed Cinnabar<br>Lucion Whisper just killed<br></td><td>Kill Ledger<br>Replenish Life +500<br></td></tr>
<tr><td>Kill Ledger<br>Maple Leaf<br>Flawed Tourmaline<br>Any Eternal Ancient just killed<br></td><td>Kill Ledger<br>Physical Resist: +5%<br></td></tr>
<tr><td>Kill Ledger<br>Maple Leaf<br>Rathma just killed<br></td><td>Kill Ledger<br>Curse Duration Reduced by 15%<br></td></tr>
</table>`;

function input(overrides: Partial<KillLedgerInput> = {}): KillLedgerInput {
  return {
    page: PAGE,
    cube: {
      recipes: SPECS.map(recipe),
      icons: { 'Kill Ledger': 'u:Kill Ledger', 'Starter Pack': 'i:ag8', 'Flawless Gem': 't:gem3', 'Flawed Cinnabar': 'i:xl7' },
    },
    cubeRows: SPECS.map(row),
    renderMods: (mods) => mods.map((entry) => `${entry.mod} +${String(entry.min)}`),
    monprop: MONPROP,
    monstats: MONSTATS,
    ascendanciesConfig: null,
    skills: SKILLS,
    misc: MISC,
    strings: new Map([['leddesc', '+1%% to Magic per 50 Energy Points\nTracks the amount of enemies you have slain']]),
    areas: AREAS,
    mapBosses: MAP_BOSSES,
    nameOf: (code) => (code === 'Kill Ledger' ? 'Kill Ledger' : code === 'ag8' ? 'Starter Pack' : code),
    ...overrides,
  };
}

describe('buildKillLedgerBundle', () => {
  const { bundle, warnings, counts } = buildKillLedgerBundle(input());

  it('reads the item, its source and its tooltip lines in reading order', () => {
    expect(bundle.item).toEqual({
      name: 'Kill Ledger',
      icon: 'u:Kill Ledger',
      source: {
        pack: { name: 'Starter Pack', qty: 1, icon: 'i:ag8' },
        classes: 2,
        remake: [
          { name: 'Tome of Identify', qty: 1, icon: null },
          { name: 'Tome of Town Portal', qty: 1, icon: null },
        ],
      },
      tooltip: ['Tracks the amount of enemies you have slain', '+1% to Magic per 50 Energy Points'],
    });
    expect(bundle.windowSeconds).toBe(60);
  });

  it('sorts tiers by kills and leaves the markers and hint lines out of the bonus', () => {
    expect(bundle.tiers.map((tier) => [tier.tier, tier.kills, tier.bonus, tier.ingredients])).toEqual([
      [1, 500, ['res-all +10'], [{ name: 'Flawless Gem', qty: 1, icon: 't:gem3' }]],
      [2, 5000, ['all-speeds +10'], [{ name: 'Blemished Gem', qty: 1, icon: null }]],
    ]);
  });

  it('groups a boss by its marker and resolves the monster, map tier and areas', () => {
    expect(bundle.bosses.map((boss) => boss.id)).toEqual(['lucion-whisper', 'eternal-ancients', 'rathma']);
    expect(bundle.bosses[0]).toEqual({
      id: 'lucion-whisper',
      name: "Lucion's Whisper",
      monsters: [{ id: 'lucionwhisper', name: "Lucion's Whisper" }],
      tier: 1,
      areas: [
        { id: 149, name: 'Cellar of Pain Level 2', tier: 1 },
        { id: 159, name: 'Chaos Rift Level 4', tier: 2, random: true },
      ],
      killValues: [50],
      ingredients: [{ name: 'Flawed Cinnabar', qty: 2, icon: 'i:xl7' }],
      bonus: ['regen +500'],
    });
    const ancients = bundle.bosses[1];
    expect(ancients.name).toBe('Eternal Ancients');
    expect(ancients.monsters.map((monster) => monster.id)).toEqual(['talic', 'madawc']);
    const rathma = bundle.bosses[2];
    expect(rathma.name).toBe('Rathma');
    expect(rathma.monsters).toEqual([{ id: 'rathma', name: 'Rathma' }]);
    expect(rathma.killValues).toEqual([208, 99]);
  });

  it('lists where the official page differs', () => {
    expect(bundle.pageDiffs).toEqual([
      { subject: "Lucion's Whisper name", files: "Lucion's Whisper", page: 'Lucion Whisper' },
      { subject: 'Eternal Ancients ingredients', files: 'Maple Leaf + Flawed Tainted Tourmaline', page: 'Maple Leaf + Flawed Tourmaline' },
    ]);
    expect(warnings).toEqual([]);
    expect(counts).toEqual({ killLedgerTiers: 2, killLedgerBosses: 3, killLedgerPageDiffs: 2 });
  });

  it('warns about a kill value without a monster and an unknown boss label', () => {
    const rows = SPECS.map(row);
    const recipes = SPECS.map(recipe);
    const noMonster: RecipeSpec = {
      line: 40,
      family: 'kill-ledger-bosses',
      description: 'Kill Ledger Someone New',
      inputs: [LEDGER],
      mods: [mod('kill-ledger-someone-new')],
      value: 777,
    };
    const wrongLabel: RecipeSpec = {
      line: 41,
      family: 'kill-ledger-bosses',
      description: 'Kill Ledger Nobody',
      inputs: [LEDGER],
      mods: [mod('kill-ledger-nobody')],
      value: 50,
    };
    const result = buildKillLedgerBundle(
      input({
        cube: { recipes: [...recipes, recipe(noMonster), recipe(wrongLabel)], icons: {} },
        cubeRows: [...rows, row(noMonster), row(wrongLabel)],
      })
    );
    expect(result.warnings).toEqual([
      'killledger: Kill Ledger Someone New: kill value 777 matches no monster',
      "killledger: Kill Ledger Nobody: unknown boss label (the kill value belongs to Lucion's Whisper)",
      'killledger: Someone New: unknown boss label (no monster)',
      "killledger: docs/kill_ledger.htm: no boss row for Lucion's Whisper",
    ]);
  });

  it('warns about a page row that matches no boss and a missing page', () => {
    const extraRow = PAGE.replace('</table>', '<tr><td>Kill Ledger<br>Maple Leaf<br>Ghost just killed<br></td><td>x</td></tr></table>');
    expect(buildKillLedgerBundle(input({ page: extraRow })).warnings).toEqual([
      'killledger: docs/kill_ledger.htm: boss row "Ghost" matches no boss in the files',
    ]);
    expect(buildKillLedgerBundle(input({ page: null })).warnings).toEqual([
      'killledger: docs/kill_ledger.htm missing in the ESR clone: no page comparison',
    ]);
  });
});

describe('buildKillLedgerBundle with the ascendancies plugin kill credit (ESR 3.3.04)', () => {
  const fromConfig = buildKillLedgerBundle(input({ monprop: NO_DEATH_SKILLS, ascendanciesConfig: ASCENDANCIES }));

  it('finds the same bosses, values and window as the old death skills', () => {
    const fromMonprop = buildKillLedgerBundle(input());
    expect(fromConfig.warnings).toEqual([]);
    expect(fromConfig.bundle.windowSeconds).toBe(60);
    expect(fromConfig.bundle.bosses.map((boss) => [boss.id, boss.monsters.map((monster) => monster.id).sort(), boss.killValues])).toEqual(
      fromMonprop.bundle.bosses.map((boss) => [boss.id, boss.monsters.map((monster) => monster.id).sort(), boss.killValues])
    );
  });

  it('uses the config before the death skills and the death skills without the config', () => {
    expect(buildKillLedgerBundle(input({ monprop: NO_DEATH_SKILLS })).bundle.bosses).toEqual([]);
    expect(buildKillLedgerBundle(input({ ascendanciesConfig: ASCENDANCIES })).bundle.bosses).toEqual(fromConfig.bundle.bosses);
  });

  it('warns about a monster index that is not in monstats.txt', () => {
    const broken = ASCENDANCIES.replace('monsters = [1]', 'monsters = [99]');
    expect(buildKillLedgerBundle(input({ monprop: NO_DEATH_SKILLS, ascendanciesConfig: broken })).warnings).toContain(
      'killledger: ascendancies.toml kill credit "Lucion\'s Whisper": monsters [99] not all in monstats.txt'
    );
  });
});

describe('bossKey', () => {
  it('ignores possessives, order, "any", "the" and plurals', () => {
    expect(bossKey('Lucion Whisper')).toBe(bossKey("Lucion's Whisper"));
    expect(bossKey('Fallen Ancient Angel')).toBe(bossKey('Ancient Fallen Angel'));
    expect(bossKey('Any Eternal Ancient')).toBe(bossKey('Eternal Ancients'));
    expect(bossKey('The Lich King')).toBe(bossKey('Lich King'));
  });
});

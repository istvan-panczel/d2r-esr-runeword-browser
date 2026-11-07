import { describe, expect, it } from 'vitest';
import type { CubeFamilyInfo, EnhanceBundle } from '../engine/schema.ts';
import { buildSpecializationsBundle, describedNumbers, fileNumbers, type SpecializationsInput } from './bundleSpecializations.ts';
import type { CubeRow } from './cube/cubeRows.ts';
import { parseTsv } from './tsv.ts';

const tsv = (name: string, header: readonly string[], rows: readonly (readonly string[])[]) =>
  parseTsv([header, ...rows].map((cells) => cells.join('\t')).join('\n'), name);

const CONFIG = `
[specializations]
points_stat = 1
point_levels = [45, 60]
unlock_points = 1
max_points = 3
perks_per_row = 3
respec_stat = 0
unlearn_cost = 5
unlearn_hint = "@d2r:Hint"
unlock_stat = 5

[[specialization]]
name = "Alchemist"
stats = [2, 3, 4]
titles = ["@d2r:A1", "@d2r:A2", "@d2r:A3"]
descriptions = ["@d2r:A1d", "@d2r:A2d", "@d2r:A3d"]

[[specialization]]
name = "Archaeologist"
stats = [6, 7, 8]
titles = ["@d2r:R1", "@d2r:R2", "@d2r:R3"]
descriptions = ["@d2r:R1d", "@d2r:R2d", "@d2r:R3d"]
`;

const ARCHAEOLOGY = `
[archaeology]
enabled = true

# Containers Opened (archaeology_1)
[containers]
enabled = true
perk_stat = 6
percent_per_container = 5
window_seconds = 15
total_damage_stats = [398, 489]
item_types = ["weap", "armo"]
`;

const STRINGS = new Map([
  ['SpecializationsAlchemist', 'Alchemist'],
  ['SpecializationsArchaeologist', 'Archaeologist'],
  ['Hint', 'Shift + Click to Unlearn. Costs %d Respec Points.'],
  ['A1', 'Efficient Remedies'],
  ['A1d', 'Increase the effect of healing potions by 20%.'],
  ['A2', 'Hidden Elixirs'],
  ['A2d', "You can find utility potions that don't normally drop."],
  ['A3', 'Gem Infusion'],
  ['A3d', 'You can craft a random utility potion.'],
  ['R1', 'Looter’s Rush'],
  ['R1d', 'Gain 5% total damage for every container you opened in the past 15 seconds.'],
  ['R2', 'Deep Pockets'],
  ['R2d', 'Increase the quantity of items dropped by 10%.'],
  ['R3', 'Alien Artefacts'],
  ['R3d', 'Every boss you kill has a 2% chance to drop an artefact.'],
  ['u42desc', 'ÿc4Transmute 10 shards\nRadiates with power...'],
  ['hp1', 'ÿc1*ÿc0HP1'],
  ['Clone', 'Clone'],
  ['Boss', 'Boss'],
]);

const STATS = [
  'respecpoints',
  'specializationpoints',
  'alchemy_1',
  'alchemy_4',
  'alchemy_8',
  'tokencap',
  'archaeology_1',
  'archaeology_4',
  'archaeology_15',
];

const NAMES = new Map([
  ['u42', 'Mystical Shard'],
  ['u43', 'Mystical Tesseract'],
  ['toa', 'Token of Absolution'],
  ['ppp', 'Dragon Stone'],
  ['hp1', 'Minor Healing Potion'],
  ...[1, 2, 3, 4, 5].map((n): [string, string] => [`aa${String(n)}`, 'Alien Artefact']),
]);

const TOKEN_FORMULA = "(stat('tokencap'.accr)<1)?(1+(stat('level'.accr)>44)+(stat('level'.accr)>59)):0";

const tcColumns = [
  'Treasure Class',
  'Picks',
  'NoDrop',
  ...[...Array(10).keys()].flatMap((i) => [`Item${String(i + 1)}`, `Prob${String(i + 1)}`]),
  'ConditionCalc',
];
const tc = (name: string, picks: number, entries: readonly [string, number][], condition = '') => {
  const cells = [...Array(10).keys()].flatMap((i) => {
    const entry = entries[i];
    return entry === undefined ? ['', ''] : [entry[0], String(entry[1])];
  });
  return [name, String(picks), '', ...cells, condition];
};

const cubeRow = (line: number, inputs: string[], output: string, condition: CubeRow['condition'] = null): CubeRow => ({
  line,
  description: `row ${String(line)}`,
  cls: '',
  minDiff: 0,
  inputs,
  outputs: [{ spec: output, mods: [] }],
  condition,
});
const tesseract = cubeRow(2, ['u42,qty=10'], 'u43');
const absolution = cubeRow(3, ['ppp,qty=4'], 'toa');
const infusion = cubeRow(4, ['gem5', 'rnd'], 'Utility Elixir', { op: 6, param: 4, value: 1 });

const family = (id: string, label: string): CubeFamilyInfo => ({ id, label, section: 'other', order: 0, rowCount: 1, raw: true });

const PAGE = `
<font face="arial,helvetica" size="-1">
Mystical Shards drop from strong monsters in endgame level zones.<br>
Transmute 12 Mystical Shards to create a Mystical Tesseract, which unlocks specializations and grants a specialization point.<br>
More points are unlocked automatically at levels 45 and 60.<br>
If your character is already over those levels, the Mystical Tesseract grants points according to your level (e.g. you get 3 points if you use it at level 63).<br>
<font color="orange">Alchemist</font> - Specialized in potions.<br>
You can respec individual perks by shift clicking a perk. This requires 5 respec points (equivalent to 20 dragon stones).<br>
</font>
<div class="spw-wrap">
<label for="spw-tab1" class="spw-tab spw-tab1">Alchemist</label>
<label for="spw-tab2" class="spw-tab spw-tab2">Archaeologist</label>
<div class="spw-page spw-page1">
  <div class="spw-perk"><div class="spw-tip"><div class="spw-tip-title">Efficient Remedies</div><div class="spw-tip-text">Increase the effect of healing potions by 25%.</div><div class="spw-tip-hint">Shift + Click to Unlearn.<br>Costs 5 Respec Points.</div></div></div>
</div>
<div class="spw-page spw-page2"></div>
</div>`;

function input(overrides: Partial<SpecializationsInput> = {}): SpecializationsInput {
  return {
    sources: {
      config: CONFIG,
      perkConfigs: [
        { file: 'celestialrayone.archaeology.toml', text: ARCHAEOLOGY },
        { file: 'celestialrayone.alchemy.toml', text: null },
      ],
      page: PAGE,
      sheets: ['alchemist.sprite', 'background.sprite'],
    },
    itemstatcost: tsv(
      'itemstatcost',
      ['Stat'],
      STATS.map((stat) => [stat])
    ),
    misc: tsv(
      'misc',
      ['name', 'code', 'namestr', 'spelldescstr', 'stat1', 'calc1', 'stat2', 'calc2'],
      [
        ['Mystical Shard', 'u42', 'u42', 'u42desc', '', '', '', ''],
        ['Mystical Tesseract', 'u43', 'u43', '', 'specializationpoints', TOKEN_FORMULA, 'tokencap', "stat('tokencap'.accr)<1"],
        ['Token of Absolution', 'toa', 'toa', '', 'respecpoints', '1', '', ''],
        ['Minor Healing Potion', 'hp1', 'hp1', '', '', "stat('maxhp'.accr)*(100+(stat('alchemy_1'.accr)>0)*20)/100", '', ''],
      ]
    ),
    skills: tsv('skills', ['skill', 'calc1'], [['Aura', "((stat('alchemy_1'.accr)>0)?11:10)"]]),
    treasureclassex: tsv('treasureclassex', tcColumns, [
      tc('Mystical Shard', 1, [['u42', 1]], "(stat('tokencap'.accr)<1)"),
      tc('Shard Chance', 1, [
        ['Mystical Shard', 1],
        ['hp1', 19],
      ]),
      tc('Clone TC', -1, [['Shard Chance', 1]]),
      tc('Elixir Hidden', 1, [['hp1', 1]], "(stat('alchemy_4'.accr)>0)"),
      tc('Elixir', 1, [
        ['hp1', 3],
        ['Elixir Hidden', 1],
      ]),
      tc('Artefacts', 1, [['aa1', 1]]),
      tc('Boss TC', -1, [['Artefacts', 1]]),
    ]),
    monstats: tsv(
      'monstats',
      ['Id', 'NameStr', 'TreasureClass'],
      [
        ['clone1', 'Clone', 'Clone TC'],
        ['boss1', 'Boss', 'Boss TC'],
      ]
    ),
    superuniques: tsv('superuniques', ['Superunique', 'Name', 'TC'], []),
    levels: tsv('levels', ['Name', 'Id', 'LevelName', 'mon1'], [['Act 1 - Lair', '7', 'Lair', 'clone1']]),
    areaNames: new Map([[7, 'Lair (Endgame Zone)']]),
    cubeRows: [tesseract, absolution, infusion],
    familyRows: new Map([
      ['specializations', [tesseract]],
      ['potions', [infusion]],
    ]),
    perkChecks: (row) => (row === infusion ? [{ perk: { title: 'Gem Infusion', tree: 'Alchemist' }, has: true }] : []),
    cube: { families: [family('specializations', 'Specializations'), family('potions', 'Potions')] },
    enhance: { anointmentSlots: [], sanctification: {} as EnhanceBundle['sanctification'] },
    masteries: {},
    strings: STRINGS,
    nameOf: (code) => NAMES.get(code) ?? code,
    ...overrides,
  };
}

describe('buildSpecializationsBundle', () => {
  const { bundle, warnings, counts } = buildSpecializationsBundle(input());
  const [alchemist, archaeologist] = bundle.trees;
  const perk = (slug: string) => bundle.trees.flatMap((tree) => tree.perks).find((entry) => entry.slug === slug);

  it('reads the rules from the plugin config, the unlock items from misc.txt and cubemain', () => {
    expect(bundle.rules).toMatchObject({
      pointLevels: [45, 60],
      unlockPoints: 1,
      maxPoints: 3,
      perksPerRow: 3,
      unlearnCost: 5,
      unlearnHint: 'Shift + Click to Unlearn. Costs 5 Respec Points.',
      respecToken: { code: 'toa', name: 'Token of Absolution', recipe: { code: 'ppp', name: 'Dragon Stone', qty: 4 } },
      shard: { code: 'u42', name: 'Mystical Shard', description: ['Transmute 10 shards', 'Radiates with power...'] },
      token: { code: 'u43', name: 'Mystical Tesseract', shards: 10, family: 'specializations', levels: [45, 60] },
      shardsOnlyBeforeUnlock: true,
    });
  });

  it('lists the monsters that roll the shard, with the chance per kill and their areas', () => {
    expect(bundle.rules.shardDrops).toEqual([{ name: 'Clone', chance: 0.05, areas: [{ id: 7, name: 'Lair (Endgame Zone)' }] }]);
  });

  it('builds the trees in tab order, perks row by row, with kebab slugs and icon keys only where a sheet exists', () => {
    expect(bundle.trees.map((tree) => [tree.slug, tree.name, tree.summary])).toEqual([
      ['alchemist', 'Alchemist', 'Specialized in potions.'],
      ['archaeologist', 'Archaeologist', undefined],
    ]);
    expect(alchemist.perks.map((entry) => [entry.slug, entry.row, entry.column, entry.statName, entry.icon])).toEqual([
      ['efficient-remedies', 1, 1, 'alchemy_1', 'alchemist-1'],
      ['hidden-elixirs', 1, 2, 'alchemy_4', 'alchemist-2'],
      ['gem-infusion', 1, 3, 'alchemy_8', 'alchemist-3'],
    ]);
    expect(archaeologist.perks.map((entry) => entry.slug)).toEqual(['looters-rush', 'deep-pockets', 'alien-artefacts']);
    expect(archaeologist.perks[0].icon).toBeUndefined();
  });

  it('links each perk to what reads its stat: formulas, treasure classes, cube families and plugin sections', () => {
    expect(perk('efficient-remedies')).toMatchObject({ items: ['Minor Healing Potion'], skillRows: 1 });
    expect(perk('hidden-elixirs')?.drops).toEqual([{ tc: 'Elixir Hidden', items: ['Minor Healing Potion'], picks: 1, shares: [0.25] }]);
    expect(perk('gem-infusion')?.cube).toEqual([{ family: 'potions', label: 'Potions', rows: 1, has: true }]);
    expect(perk('looters-rush')?.plugin).toEqual({
      file: 'celestialrayone.archaeology.toml',
      section: 'containers',
      values: [
        { key: 'percent_per_container', value: 5 },
        { key: 'window_seconds', value: 15 },
        { key: 'item_types', value: 'weap, armo' },
      ],
    });
  });

  it('notes a perk nothing reads and the item claims the files do not back', () => {
    expect(perk('deep-pockets')?.notes).toEqual([
      'Nothing in the game tables or the launcher configs reads its stat (archaeology_4), so the files do not show how it works.',
    ]);
    expect(perk('alien-artefacts')?.notes).toEqual([
      'In the files, Alien Artefact drops from 1 monster without the perk: no treasure class checks its stat (archaeology_15).',
    ]);
    expect(warnings).toEqual([
      'specializations: celestialrayone.alchemy.toml missing in the ESR clone',
      'specializations: Archaeologist › Deep Pockets (archaeology_4): no table or launcher config reads it',
      'specializations: Archaeologist › Alien Artefacts (archaeology_15): Alien Artefact (aa1, aa2, aa3, aa4, aa5) drop from 1 monster with no perk condition',
      'specializations: Archaeologist: no icon sheet archaeologist.sprite',
    ]);
  });

  it('records where the official page reads differently (the files win)', () => {
    expect(bundle.pageDiffs).toEqual([
      { subject: 'Alchemist perks', files: '3', page: '1', tree: 'alchemist' },
      {
        subject: 'Alchemist › Efficient Remedies description',
        files: 'Increase the effect of healing potions by 20%.',
        page: 'Increase the effect of healing potions by 25%.',
        tree: 'alchemist',
        perk: 'efficient-remedies',
      },
      { subject: 'Archaeologist perks', files: '3', page: '0', tree: 'archaeologist' },
      // Point levels (45 and 60), the level 63 example (1 + 2 levels passed) and the 20 Dragon Stones agree
      { subject: 'Mystical Shards per Tesseract', files: '10', page: '12' },
    ]);
    expect(counts).toMatchObject({ specializationTrees: 2, specializationPerks: 6, specializationIcons: 3, specializationPageDiffs: 4 });
  });

  it('flags a description number the files do not give', () => {
    const strings = new Map([...STRINGS, ['A1d', 'Increase the effect of healing potions by 30%.']]);
    const result = buildSpecializationsBundle(input({ strings }));
    expect(result.bundle.trees[0].perks[0].notes).toEqual(['The description says 30%; the files give 10, 20.']);
    expect(result.warnings).toContain(
      'specializations: Alchemist › Efficient Remedies (alchemy_1): the description says 30 %, the files 10, 20'
    );
  });

  it('builds nothing without the plugin config', () => {
    const result = buildSpecializationsBundle(input({ sources: { config: null, perkConfigs: [], page: null, sheets: [] } }));
    expect(result.bundle.trees).toEqual([]);
    expect(result.warnings).toEqual(['specializations: celestialrayone.specializations.toml missing in the ESR clone: no specialisations']);
  });
});

describe('describedNumbers / fileNumbers', () => {
  it('reads the percentages of a description', () => {
    expect(describedNumbers('25% more base damage and 10% more spell damage, 25% again, 3 range')).toEqual([25, 10]);
  });

  it('collects plugin numbers (a per_percent setting means 1 %), formula numbers and drop shares', () => {
    const plugin = {
      file: 'x.toml',
      section: 's',
      values: [
        { key: 'points_per_percent', value: 25 },
        { key: 'radius', value: -1 },
      ],
    };
    expect([...fileNumbers(plugin, new Set([20]), [{ tc: 'T', items: [], picks: 2, shares: [0.15] }])].sort((a, b) => a - b)).toEqual([
      1, 15, 20, 25,
    ]);
  });
});

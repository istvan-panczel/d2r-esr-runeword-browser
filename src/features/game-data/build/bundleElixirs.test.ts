import { describe, expect, it } from 'vitest';
import { calcStatNames, evaluateElixirCalc, fillValue, framesToSeconds } from '../engine/elixirs.ts';
import type { CubeRecipe } from '../engine/schema.ts';
import type { StatEntry } from '../engine/stats/types.ts';
import { buildElixirsBundle, kebabSlug, perkGate, rollChances, sourceLabel, subsets, type ElixirsInputs } from './bundleElixirs.ts';
import type { CubeRow } from './cube/cubeRows.ts';
import { readTcRows } from './treasureClassOdds.ts';
import { parseTsv } from './tsv.ts';

const tsv = (header: readonly string[], rows: readonly (readonly (string | number)[])[]) =>
  parseTsv([header.join('\t'), ...rows.map((row) => row.map(String).join('\t'))].join('\n'));

const M = "*(100+stat('utilitypotionmultiplier'.accr)+(stat('alchemy_2'.accr)>0)*5)/100";
const G = "*125*(100+stat('utilitypotionmultiplier'.accr)+(stat('alchemy_2'.accr)>0)*5)/10000";
const LEN = "1125*(100+stat('utilitypotionduration'.accr))/100";

const MISC_HEADER = [
  'name',
  'code',
  'namestr',
  'type',
  'type2',
  'state',
  'len',
  'spelldesc',
  'spelldescstr',
  'UsageConditionCalc',
  'stat1',
  'calc1',
  'stat2',
  'calc2',
  'stat3',
  'calc3',
  'stat4',
  'calc4',
  'stat5',
  'calc5',
  'stat6',
  'calc6',
];

const miscRow = (code: string, type2: string, state: string, stats: [string, string][], extra: Partial<Record<string, string>> = {}) => {
  const cells: Record<string, string> = {
    name: code,
    code,
    namestr: code,
    type: 'upot',
    type2,
    state,
    len: LEN,
    spelldesc: '2',
    spelldescstr: `${state}desc`,
    UsageConditionCalc: '',
    ...Object.fromEntries(
      stats.flatMap(([stat, calc], i) => [[`stat${String(i + 1)}`, stat] as const, [`calc${String(i + 1)}`, calc] as const])
    ),
    ...extra,
  };
  return MISC_HEADER.map((column) => cells[column] ?? '');
};

const MISC = tsv(MISC_HEADER, [
  ['Rejuvenation Potion', 'rvs', 'rvs', 'rpot', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  [
    'Stamina Potion',
    'vps',
    'vps',
    'spot',
    'upot',
    'staminapot',
    LEN,
    '',
    '',
    '',
    'staminarecoverybonus',
    `5000${M}`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  miscRow('01p', 'relx', 'elixirofattributes', [
    ['strength', `(10+stat('level'.accr))${M}`],
    ['dexterity', `(10+stat('level'.accr))${M}`],
  ]),
  miscRow('03p', 'relx', 'elixirofphasing', [
    ['item_fractionaltargetac', `(5+stat('level'.accr)/5)${M}`],
    ['phasing', '1'],
  ]),
  miscRow('14p', 'relx', 'elixirofthegiant', [['strengthpercent', `(5+stat('level'.accr)/4)${M}`]]),
  miscRow('18p', 'gelx', 'elixirofattributes', [
    ['strength', `(10+stat('level'.accr))${G}`],
    ['dexterity', `(10+stat('level'.accr))${G}`],
  ]),
  miscRow('35p', '', 'elixirofreincarnation', [['elixir_of_reincarnation', '1']], {
    len: '2000000000',
    spelldesc: '1',
    spelldescstr: 'elixirofreincarnationdesc',
    UsageConditionCalc: "(stat('elixir_of_reincarnation'.accr)<1)",
  }),
]);

const TC_HEADER = ['Treasure Class', 'Picks', 'NoDrop', 'Item1', 'Prob1', 'Item2', 'Prob2', 'Item3', 'Prob3', 'ConditionCalc'];
const TREASURE = tsv(TC_HEADER, [
  ['Utility Elixir Regular A', 1, '', '01p', 1, '03p', 1, '', '', ''],
  ['Utility Elixir Regular Hidden', 1, '', '14p', 1, '', '', '', '', "(stat('alchemy_4'.accr)>0)"],
  ['Utility Elixir Regular', 1, '', 'Utility Elixir Regular A', 2, 'Utility Elixir Regular Hidden', 1, '', '', ''],
  ['Utility Elixir Greater', 1, '', '18p', 1, '', '', '', '', "(stat('alchemy_12'.accr)>0)"],
  ['Utility Elixir', 1, '', 'Utility Elixir Regular', 3, 'Utility Elixir Greater', 1, '', '', ''],
  ['Unstable Mixtures', 1, '', 'Utility Elixir', 1, '', '', '', '', "(stat('alchemy_5'.accr)>0)"],
  ['Rejuvenation Regular', 1, '', 'rvs', 85, 'Unstable Mixtures', 15, '', '', ''],
  ['Potion 1 Regular', 1, '', 'Rejuvenation Regular', 1, '', '', '', '', ''],
  ['Potion 1 Single', 1, '', 'Potion 1 Regular', 99, 'Utility Elixir', 1, '', '', ''],
  ['Potion 1 Double', 2, '', 'Potion 1 Single', 1, '', '', '', '', "(stat('alchemy_6'.accr)>0)"],
  ['Potion 1', 1, '', 'Potion 1 Single', 1, 'Potion 1 Double', 1, '', '', ''],
  ['Potion 7 Single', 1, '', 'Potion 1 Regular', 95, 'Utility Elixir', 5, '', '', ''],
  ['Potion 7', 1, '', 'Potion 7 Single', 1, '', '', '', '', ''],
  ['Act 1 Junk', 1, 25, 'Potion 1', 8, '', '', '', '', ''],
  ['Act 1 (H) Junk', 1, 25, 'Potion 7', 8, '', '', '', '', ''],
  ['Act 2 (H) Junk', 1, 25, 'Potion 7', 8, '', '', '', '', ''],
  ['Act 3 (H) Junk', 1, 25, 'Potion 7', 8, '', '', '', '', ''],
  ['Act 4 (H) Junk', 1, 25, 'Potion 7', 8, '', '', '', '', ''],
  ['Act 5 (H) Junk', 1, 25, 'Potion 7', 8, '', '', '', '', ''],
]);

// itemstatcost row = stat id
const STATS = [
  'level',
  'item_randomize',
  'alchemy_2',
  'alchemy_4',
  'alchemy_5',
  'alchemy_6',
  'alchemy_8',
  'alchemy_9',
  'alchemy_10',
  'alchemy_12',
];
const ITEMSTATCOST = tsv(
  ['Stat'],
  STATS.map((stat) => [stat])
);

const PERK_TITLES: Record<string, string> = {
  '1_2': 'Volatile Concoctions',
  '2_1': 'Hidden Elixirs',
  '2_2': 'Unstable Mixtures',
  '2_3': 'Bountiful Brews',
  '3_2': 'Gem Infusion',
  '3_3': 'Compounded Synergy',
  '4_1': 'Savvy Elixirs',
  '4_3': 'Alchemical Excellence',
  '5_1': 'Elixir of Reincarnation',
};

const STRINGS = new Map<string, string>([
  ['01p', 'Elixir of Attributes'],
  ['03p', 'Elixir of Phasing'],
  ['14p', 'Elixir of the Giant'],
  ['18p', 'Greater Elixir of Attributes'],
  ['35p', 'Elixir of Reincarnation'],
  ['rvs', 'Rejuv Potion'],
  ['vps', '*Stam'],
  ['elixirofattributesdesc', 'Grants +%d to All Attributes for 45 seconds'],
  ['elixirofphasingdesc', 'Grants -%d%% Target Defense and Phasing for 45 seconds'],
  ['elixirofthegiantdesc', 'Grants +%d%% Bonus to Strength for 45 seconds'],
  ['elixirofreincarnationdesc', 'a 1 second invincibility.\nConsuming this elixir saves you'],
  ['SpecializationsAlchemist', 'Alchemist'],
  ...Object.entries(PERK_TITLES).flatMap(([key, title]) => [
    [`SpecializationsAlchemist${key}Title`, title] as const,
    [`SpecializationsAlchemist${key}Desc`, `${title} description`] as const,
  ]),
]);

const ALCHEMY_TOML = `
[perks]
compounded_synergy = 7
savvy_elixirs      = 8

[values]
compounded_synergy_percent = 5
savvy_elixirs_chance       = 25

[[reincarnation]]
state               = 677
cooldown_seconds    = 300
invulnerable_frames = 25
sweep_items         = ["35p"]

[find_potion]
enabled = true
rvs = "Rejuvenation Regular"
`;

const recipe = (id: number, output: { text: string; code: string }, conditions: string[]): CubeRecipe => ({
  id,
  family: 'potions',
  group: 0,
  description: `row ${String(id)}`,
  inputs: [
    { text: 'Randomizing Stone', code: 'rnd', qty: 1, quals: [], kind: 'item' },
    { text: 'Perfect Gem', code: 'gem5', qty: 1, quals: [], kind: 'type' },
  ],
  outputs: [{ ...output, bonus: [], details: [] }],
  conditions,
  qualities: [],
});

const cubeRow = (line: number, condition: CubeRow['condition']): CubeRow => ({
  line,
  description: '',
  cls: '',
  minDiff: 0,
  inputs: ['rnd', 'gem5'],
  outputs: [],
  condition,
});

/** Writes each stat as "<stat> <value>" (one line per stat), like the stat renderer would */
const renderStats = (entries: readonly StatEntry[]) =>
  entries.flatMap((entry) => (entry.stat === 'elixir_of_reincarnation' ? [] : [`+${String(entry.min)} ${entry.stat}`]));

function inputs(overrides: Partial<ElixirsInputs> = {}): ElixirsInputs {
  return {
    misc: MISC,
    treasureclassex: TREASURE,
    itemstatcost: ITEMSTATCOST,
    experience: tsv(['Level', 'Amazon'], [['MaxLvl', 110]]),
    shrines: tsv(['Name', 'Code'], [['Refilling Shrine', 1]]),
    strings: STRINGS,
    cubeRows: [cubeRow(2308, { op: 4, param: 9, value: 0 }), cubeRow(2309, { op: 15, param: 1, value: 384 }), cubeRow(2310, null)],
    cubeRecipes: [
      recipe(2308, { text: 'Regular Elixirs', code: 'relx' }, [
        'Needs the Alchemist perk Gem Infusion',
        'Only without the Alchemist perk Alchemical Excellence',
      ]),
      recipe(2309, { text: 'Greater Elixirs', code: 'gelx' }, [
        'Needs the Alchemist perk Gem Infusion',
        'Needs the Alchemist perk Alchemical Excellence',
        'Random roll ≥ 384 (of 0 to 511)',
      ]),
      recipe(2310, { text: 'Regular Elixirs', code: 'relx' }, [
        'Needs the Alchemist perk Gem Infusion',
        'Needs the Alchemist perk Alchemical Excellence',
      ]),
    ],
    alchemyConfig: ALCHEMY_TOML,
    renderStats,
    ...overrides,
  };
}

describe('elixir formulas', () => {
  it('evaluate on whole numbers, left to right, truncating every division', () => {
    const knowledge = "(25+stat('level'.accr)/3*2)" + M;
    expect(evaluateElixirCalc(knowledge, { level: 10 })).toBe(31);
    expect(evaluateElixirCalc(knowledge, { level: 11 })).toBe(31);
    expect(evaluateElixirCalc(`(1+stat('level'.accr)/10)${G}`, { level: 110 })).toBe(15);
    // Volatile Concoctions adds 5 to the effectiveness percent
    expect(evaluateElixirCalc(`(10+stat('level'.accr))${M}`, { level: 90, alchemy_2: 1 })).toBe(105);
    expect(evaluateElixirCalc(`(10+stat('level'.accr))${M}`, { level: 90, utilitypotionmultiplier: 20 })).toBe(120);
    expect(evaluateElixirCalc(LEN, { utilitypotionduration: 10 })).toBe(1237);
    expect(evaluateElixirCalc("skill('Attack'.blvl)", {})).toBeNull();
  });

  it('list the stats a formula reads', () => {
    expect(calcStatNames(`(10+stat('level'.accr))${M}`)).toEqual(['level', 'utilitypotionmultiplier', 'alchemy_2']);
  });

  it('turn frames into seconds and fill line values', () => {
    expect(framesToSeconds(1125)).toBe(45);
    expect(framesToSeconds(1237)).toBe(49.5);
    expect(fillValue('+{v}% Bonus to Strength', 12)).toBe('+12% Bonus to Strength');
  });
});

describe('helpers', () => {
  it('kebabSlug lower-cases and joins words with dashes', () => {
    expect(kebabSlug('Greater Elixir of the Giant')).toBe('greater-elixir-of-the-giant');
    expect(kebabSlug('Scribe’s Blessing')).toBe('scribes-blessing');
  });

  it('perkGate reads a perk check and nothing else', () => {
    expect(perkGate("(stat('alchemy_4'.accr)>0)")).toBe('alchemy_4');
    expect(perkGate("stat('alchemy_3'.accr)>0")).toBe('alchemy_3');
    expect(perkGate("(stat('level'.accr)>=90)")).toBeNull();
    expect(perkGate("(stat('alchemy_4'.accr)<1)")).toBeNull();
    expect(perkGate('')).toBeNull();
  });

  it('rollChances leaves out the classes whose perk the killer lacks', () => {
    const rows = readTcRows(TREASURE);
    expect(Object.fromEntries(rollChances(rows, 'Utility Elixir', () => false))).toEqual({ '01p': 0.5, '03p': 0.5 });
    const all = rollChances(rows, 'Utility Elixir', () => true);
    expect(all.get('14p')).toBeCloseTo(0.25);
    expect(all.get('18p')).toBeCloseTo(0.25);
    expect(all.get('01p')).toBeCloseTo(0.25);
  });

  it('sourceLabel names the difficulty and acts from the classes above', () => {
    const rows = readTcRows(TREASURE);
    const parents = new Map<string, ReturnType<typeof rows.get>[]>();
    for (const row of rows.values()) for (const entry of row.entries) parents.set(entry.ref, [...(parents.get(entry.ref) ?? []), row]);
    const list = new Map([...parents].map(([key, value]) => [key, value.filter((row) => row !== undefined)]));
    expect(sourceLabel('Potion 1 Single', list)).toBe('Normal Act 1');
    expect(sourceLabel('Potion 7 Single', list)).toBe('Hell');
    expect(sourceLabel('Unknown', list)).toBe('Unknown');
  });

  it('subsets lists the empty set first', () => {
    expect(subsets(['a', 'b'])).toEqual([[], ['a'], ['b'], ['a', 'b']]);
  });
});

describe('buildElixirsBundle', () => {
  const { bundle, warnings } = buildElixirsBundle(inputs());
  const byCode = new Map(bundle.elixirs.map((elixir) => [elixir.code, elixir]));

  it('reads every upot item with its variant, pair, tooltip and effects', () => {
    // The test config leaves Serendipity out
    expect(warnings).toEqual(['elixirs: alchemy.toml [perks] serendipity missing']);
    expect(bundle.maxLevel).toBe(110);
    expect(bundle.elixirs.map((elixir) => elixir.code)).toEqual(['01p', '03p', '14p', '18p', '35p']);
    expect(bundle.otherUtilityPotions).toEqual(['Stamina Potion']);
    expect(byCode.get('01p')).toMatchObject({
      name: 'Elixir of Attributes',
      slug: 'elixir-of-attributes',
      variant: 'regular',
      pair: '18p',
      tooltip: 'Grants +%d to All Attributes for 45 seconds',
      tooltipFormula: `(10+stat('level'.accr))${M}`,
      seconds: 45,
      effects: [{ lines: ['+{v} strength', '+{v} dexterity'], stats: ['strength', 'dexterity'], values: [11, 120] }],
    });
    expect(byCode.get('18p')?.effects[0]?.values).toEqual([13, 150]);
    // A fixed stat keeps its own line, without a value
    expect(byCode.get('03p')?.effects[1]).toEqual({ lines: ['+1 phasing'], formula: null, stats: ['phasing'], values: null });
  });

  it('reads the special elixir: bottom-up tooltip, no length, usage condition, its perk', () => {
    const special = byCode.get('35p');
    expect(special?.variant).toBe('special');
    expect(special?.tooltip).toBe('Consuming this elixir saves you a 1 second invincibility.');
    expect(special?.tooltipFormula).toBeUndefined();
    expect(special?.seconds).toBeUndefined();
    expect(special?.usageCondition).toBe("(stat('elixir_of_reincarnation'.accr)<1)");
    expect(special?.perk).toBe('alchemy_13');
    expect(special?.dropPerks).toBeUndefined();
    expect(special?.recipes).toBeUndefined();
  });

  it('gates drops by the perk classes on the way down and lists the odds per perk set', () => {
    expect(byCode.get('01p')?.dropPerks).toEqual([]);
    expect(byCode.get('14p')?.dropPerks).toEqual(['alchemy_4']);
    expect(byCode.get('18p')?.dropPerks).toEqual(['alchemy_12']);
    expect(bundle.drops.odds.map((entry) => entry.perks)).toEqual([[], ['alchemy_4'], ['alchemy_12'], ['alchemy_4', 'alchemy_12']]);
    expect(bundle.drops.odds[0]?.chances).toEqual({ '01p': 0.5, '03p': 0.5 });
  });

  it('lists the potion picks that become elixir rolls, perk routes included', () => {
    expect(bundle.drops.sources).toEqual([
      { tc: 'Rejuvenation Regular', label: 'Rejuv Potion', chance: 15, perk: 'alchemy_5' },
      { tc: 'Potion 1 Single', label: 'Normal Act 1', chance: 1 },
      { tc: 'Potion 7 Single', label: 'Hell', chance: 5 },
    ]);
  });

  it('maps the recipes onto the elixirs of their output type', () => {
    expect(bundle.recipes.map((entry) => entry.id)).toEqual([2308, 2309, 2310]);
    expect(byCode.get('01p')?.recipes).toEqual([2308, 2310]);
    expect(byCode.get('18p')?.recipes).toEqual([2309]);
  });

  it('collects the perks with what the files do with them', () => {
    const facts = Object.fromEntries(bundle.perks.map((perk) => [perk.title, perk.facts]));
    expect(bundle.perks.map((perk) => perk.key)).toEqual([
      'alchemy_2',
      'alchemy_4',
      'alchemy_5',
      'alchemy_6',
      'alchemy_8',
      'alchemy_9',
      'alchemy_10',
      'alchemy_12',
      'alchemy_13',
    ]);
    expect(bundle.perks[1]).toMatchObject({ slug: 'hidden-elixirs', row: 2, column: 1, tree: 'Alchemist' });
    expect(facts['Volatile Concoctions']).toEqual(['Every elixir formula in misc.txt counts it as +5% Utility Potion Effectiveness.']);
    expect(facts['Hidden Elixirs']?.[0]).toMatch(
      /^Drops only with it: Elixir of the Giant \(treasure class Utility Elixir Regular Hidden, 1 of 3/
    );
    expect(facts['Unstable Mixtures']).toEqual([
      '15% of the Rejuv Potion picks become an elixir roll instead (Rejuvenation Regular).',
      'It works on the rejuvenation potions Find Potion makes too: the alchemy plugin sends them through the same treasure classes.',
    ]);
    expect(facts['Bountiful Brews']?.[0]).toMatch(/make 1\.5 picks on average/);
    expect(facts['Gem Infusion']).toEqual([
      'Needed for the cube recipe Randomizing Stone + Perfect Gem → Regular Elixirs or Greater Elixirs.',
    ]);
    expect(facts['Alchemical Excellence']).toContain(
      'With it, 25% of these transmutes give Greater Elixirs (a Randomizing Stone roll of at least 384 of 0 to 511, cubemain line 2309).'
    );
    expect(facts['Savvy Elixirs']).toEqual(['25% chance that a utility potion is not used up; its effect still applies (alchemy plugin).']);
    expect(facts['Elixir of Reincarnation']).toEqual([
      'Gives the Elixir of Reincarnation; cubemain.txt has no recipe that makes it and no treasure class drops it.',
      'The mod author (2026-11-07): the missing recipe is a bug of 3.3; the next patch adds it, so until then the elixir cannot be had.',
      'On a hit that would kill you it restores full life and mana instead, makes you invulnerable for 1 s, and starts a 300 s cooldown (alchemy plugin).',
    ]);
  });

  it('warns when the config or the root class is missing, or a line hides its value', () => {
    const result = buildElixirsBundle(
      inputs({ alchemyConfig: null, treasureclassex: tsv(TC_HEADER, []), renderStats: (entries) => entries.map(() => 'no value') })
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'elixirs: d2rloader/config/celestialrayone.alchemy.toml missing; plugin perks left out',
        'elixirs: treasureclassex.txt has no "Utility Elixir" class',
        'elixirs: Elixir of Attributes (strength, dexterity) renders without its value: no value / no value',
      ])
    );
  });
});

import { describe, it, expect } from 'vitest';
import { buildEnhanceBundle, type EnhanceContext } from './bundleEnhance.ts';
import { parseTsv } from './tsv.ts';

const COLUMNS = [
  'description',
  'enabled',
  'op',
  'param',
  'value',
  'input 1',
  'input 2',
  'input 3',
  'input 4',
  'output',
  ...[1, 2, 3, 4, 5].flatMap((i) => [
    `mod ${String(i)}`,
    `mod ${String(i)} chance`,
    `mod ${String(i)} param`,
    `mod ${String(i)} min`,
    `mod ${String(i)} max`,
  ]),
];

type Mod = [code: string, min: number, max: number, chance?: number, param?: string];

interface Row {
  description?: string;
  enabled?: 0 | 1;
  cond?: [op: number, param: number, value: number];
  inputs: string[];
  output: string;
  mods?: Mod[];
}

function cubemain(rows: Row[]): string {
  const lines = rows.map((row) => {
    const cells: Record<string, string> = {
      description: row.description ?? 'row',
      enabled: String(row.enabled ?? 1),
      op: row.cond === undefined ? '' : String(row.cond[0]),
      param: row.cond === undefined ? '' : String(row.cond[1]),
      value: row.cond === undefined ? '' : String(row.cond[2]),
      output: row.output,
    };
    row.inputs.forEach((input, i) => (cells[`input ${String(i + 1)}`] = input.includes(',') ? `"${input}"` : input));
    (row.mods ?? []).forEach(([code, min, max, chance, param], i) => {
      const prefix = `mod ${String(i + 1)}`;
      cells[prefix] = code;
      cells[`${prefix} min`] = String(min);
      cells[`${prefix} max`] = String(max);
      cells[`${prefix} chance`] = chance === undefined ? '100' : String(chance);
      cells[`${prefix} param`] = param ?? '';
    });
    return COLUMNS.map((column) => cells[column] ?? '').join('\t');
  });
  return [COLUMNS.join('\t'), ...lines].join('\n');
}

const UNIQUES = ['index\tprop1\tmin1\tmax1', 'Vessel of Souls\tsoul-counter\t100\t100'].join('\n');

const NAMES: Record<string, string> = {
  wss: 'Worldstone Shard',
  um7: 'Orb of Anointment',
  um1: 'Horn',
  hrt: 'Heart',
  brz: 'Brain',
  gpw: 'Blemished Diamond',
  m21: 'Mythical Razor Axe',
  lcha: 'Grand Charm',
  ocha: 'Odd Charm',
};

const ctx: EnhanceContext = {
  nameOf: (token) => NAMES[token] ?? token,
  isA: (code, parent) => code === parent || (code === 'ocha' && parent === 'char'),
  statIdsOf: (property) => ({ str: [0], dex: [2] })[property] ?? [],
  renderMods: (mods) => ({
    lines: mods.map((mod) => `${mod.code} ${String(mod.min)}-${String(mod.max)}`),
    warnings: mods.filter((mod) => mod.code === 'unreadable').map((mod) => `unknown property "${mod.code}"`),
  }),
};

const build = (rows: Row[]) => buildEnhanceBundle({ cubemain: parseTsv(cubemain(rows)), uniqueitems: parseTsv(UNIQUES) }, ctx);

/** Step 2 corruption row: marker + clear the dummy + bonus */
const corrupt = (input: string, value: number, bonus: Mod[], output = 'useitem'): Row => ({
  cond: [18, 504, value],
  inputs: [input],
  output,
  mods: [['corrupted', 1, 1], ['corrupted_dummy', -value, -value], ...bonus],
});

describe('buildEnhanceBundle: corruption', () => {
  const rows: Row[] = [
    { description: 'Check if already Corrupted', cond: [18, 503, 1], inputs: ['any', 'wss'], output: 'void' },
    { cond: [16, 504, 0], inputs: ['weap,uni', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 4]] },
    { cond: [16, 504, 0], inputs: ['weap,rar', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 4]] },
    { cond: [16, 504, 0], inputs: ['ring,nor,nru', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 5, 8]] },
    corrupt('weap,uni', 1, [['dmg%', 150, 200]]),
    corrupt('weap,uni', 2, [['att', 400, 500]]),
    corrupt('weap,uni', 3, [['allskills', 1, 1, 25]]),
    corrupt('weap,uni', 4, [], 'usetype,rar'),
    corrupt('weap,rar', 1, [['dmg%', 150, 200]]),
    corrupt('weap,rar', 2, [['att', 300, 500]]),
    corrupt('weap,rar', 3, [['allskills', 1, 1, 25]]),
    corrupt('weap,rar', 4, [], 'usetype,rar'),
    // Charm: subtype brick row overrides the plain one
    { cond: [16, 504, 0], inputs: ['char,uni', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 3]] },
    corrupt('char,uni', 1, [['dmg%', 10, 20]]),
    corrupt('char,uni', 2, [['str', 1, 2]]),
    corrupt('ocha,uni', 3, [], 'lcha,rar'),
    corrupt('char,uni', 3, [], 'usetype,rar'),
  ];
  const { bundle, warnings } = build(rows);

  it('reads the two-step dummy pattern into one slot with the roll range and rate', () => {
    const weapon = bundle.corruptionSlots.find((slot) => slot.slot === 'weapon');
    expect(weapon).toMatchObject({ typeCode: 'weap', rollRange: 4, outcomes: 3, successRate: 0.75, qualities: ['uni', 'rar'] });
    expect(weapon?.brick).toMatchObject({ rolls: 1, rate: 0.25 });
    expect(bundle.corruption.reagent).toEqual({ code: 'wss', name: 'Worldstone Shard' });
    expect(warnings).toEqual([]);
  });

  it('dedupes the outcome list across qualities and keeps differing values as variants', () => {
    const outcomes = bundle.corruptionOutcomes.filter((outcome) => outcome.slot === 'weapon');
    expect(outcomes.map((outcome) => outcome.roll)).toEqual([1, 2, 3]);
    expect(outcomes[0]).toEqual({
      slot: 'weapon',
      roll: 1,
      mods: [{ code: 'dmg%', param: null, min: 150, max: 200 }],
      lines: ['dmg% 150-200'],
    });
    expect(outcomes[1]?.variants).toEqual([
      { qualities: ['rar'], mods: [{ code: 'att', param: null, min: 300, max: 500 }], lines: ['att 300-500'] },
    ]);
  });

  it('hides the marker and dummy mods and writes a chance below 100 % on its own line', () => {
    const third = bundle.corruptionOutcomes.find((outcome) => outcome.slot === 'weapon' && outcome.roll === 3);
    expect(third?.mods).toEqual([{ code: 'allskills', param: null, min: 1, max: 1, chance: 25 }]);
    expect(third?.lines).toEqual(['allskills 1-1 (25% chance)']);
  });

  it('lists qualities with a roll row but no outcome rows separately', () => {
    expect(bundle.corruptionSlots.find((slot) => slot.slot === 'ring')).toBeUndefined();
    const withRollOnly = build([
      ...rows,
      { cond: [16, 504, 0], inputs: ['ring,uni', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 5, 8]] },
      corrupt('ring,uni', 5, [['str', 1, 1]]),
    ]).bundle.corruptionSlots.find((slot) => slot.slot === 'ring');
    expect(withRollOnly?.rollOnlyQualities).toEqual(['nor']);
  });

  it('writes brick results per quality, with more specific subtype rows', () => {
    const weapon = bundle.corruptionSlots.find((slot) => slot.slot === 'weapon');
    expect(weapon?.brick.results.map((result) => [result.quality, result.result])).toEqual([
      ['uni', 'Rare item of the same type'],
      ['rar', 'Rare item of the same type'],
    ]);
    const charm = bundle.corruptionSlots.find((slot) => slot.slot === 'charm');
    expect(charm).toMatchObject({ outcomes: 2, rollRange: 3 });
    expect(charm?.successRate).toBeCloseTo(2 / 3);
    expect(charm?.brick.results).toContainEqual({ quality: 'uni', type: 'ocha', typeName: 'Odd Charm', result: 'Rare Grand Charm' });
  });

  it('derives the repeatable-corruption note from a named item with its own roll and an op=15 blocker', () => {
    const named: Row[] = [
      { cond: [15, 503, 10], inputs: ['Harbinger', 'wss'], output: 'void' },
      { cond: [16, 504, 0], inputs: ['Harbinger', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 4]] },
      corrupt('Harbinger', 1, [['dmg%', 150, 200]]),
      corrupt('Harbinger', 2, [['att', 400, 500]]),
      corrupt('Harbinger', 3, [['allskills', 1, 1, 25]]),
    ];
    expect(build([...named, ...rows]).bundle.corruption.notes).toEqual([
      'Harbinger can be corrupted repeatedly, up to 10 times (the Weapon outcomes).',
    ]);
  });
});

describe('buildEnhanceBundle: anointment', () => {
  const anoint = (input: string, value: number, description: string, bonus: Mod[]): Row => ({
    description,
    cond: [18, 286, value],
    inputs: [input],
    output: 'useitem',
    mods: [['anointed', 1, 1], ['anointed_dummy', -value, -value], ...bonus],
  });
  const { bundle } = build([
    { description: 'Check if Already Anointed', cond: [18, 285, 1], inputs: ['any', 'um7'], output: 'void' },
    { description: 'Trap Anointment - Unique Weapon', inputs: ['weap,uni', 'um7'], output: 'void' },
    { cond: [16, 286, 0], inputs: ['weap,nru,sock', 'um7'], output: 'useitem', mods: [['anointed_dummy', 1, 1]] },
    { cond: [16, 286, 0], inputs: ['weap,nru', 'um7'], output: 'useitem', mods: [['anointed_dummy', 1, 2]] },
    anoint('weap,nru', 1, 'Anointment - Weapon 1 (of Abyss)', [['str', 5, 10]]),
    anoint('weap,nru', 2, 'Anointment - Weapon 3 (Sockets)', [['sock', 3, 3]]),
    { cond: [16, 286, 0], inputs: ['char,uni', 'um1', 'um2', 'um3'], output: 'useitem', mods: [['anointed_dummy', 1, 1]] },
    anoint('char,uni', 1, 'Anointment - Unique Charm 1', [['dmg%', 40, 50]]),
  ]);

  it('uses the row value as the roll and the description suffix as the label', () => {
    expect(
      bundle.anointmentOutcomes.filter((outcome) => outcome.pool === 'weapon').map((outcome) => [outcome.roll, outcome.label])
    ).toEqual([
      [1, 'of Abyss'],
      [2, 'Sockets'],
    ]);
    expect(bundle.anointmentOutcomes.find((outcome) => outcome.pool === 'charm')).toMatchObject({ roll: 1, lines: ['dmg% 40-50'] });
    expect(bundle.anointmentOutcomes.find((outcome) => outcome.pool === 'charm')?.label).toBeUndefined();
  });

  it('derives the rules: blocked uniques, no runewords, a shorter socketed range', () => {
    expect(bundle.anointmentSlots).toEqual([{ slot: 'weapon', typeCode: 'weap', label: 'Weapon', rollRange: 2, socketedRollRange: 1 }]);
    expect(bundle.anointment).toMatchObject({ reagent: { code: 'um7' }, blockedQualities: ['uni'], noRunewords: true });
    expect(bundle.anointment.charmReagents.map((reagent) => reagent.code)).toEqual(['um1', 'um2', 'um3']);
  });
});

describe('buildEnhanceBundle: Vessel of Souls', () => {
  const V = 'Vessel of Souls';
  const recipe = (
    op: 15 | 18,
    value: number,
    cost: number,
    materials: string[],
    bonus: Mod[],
    tierMarker = false,
    enabled: 0 | 1 = 1
  ): Row => ({
    enabled,
    cond: [op, 507, value],
    inputs: [V, ...materials],
    output: 'useitem',
    mods: [
      ...bonus,
      ['soul-counter', -cost, -cost],
      ...(op === 18 && tierMarker ? ([['mythicaldesc', 1, 1, undefined, '999']] as Mod[]) : []),
    ],
  });
  const { bundle, warnings } = build([
    { cond: [16, 504, 0], inputs: ['weap,uni', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 4]] },
    { description: 'Prevent Vessel of Souls Corrupt', cond: [15, 507, 1], inputs: [V, 'wss'], output: 'void' },
    // Tier 1: 100 → 60 (cost 10, exact row at 70)
    recipe(18, 70, 10, ['hrt,qty=2', 'brz'], [['str', 5, 10]], true),
    recipe(15, 70, 10, ['hrt,qty=2', 'brz'], [['str', 5, 10]]),
    recipe(18, 70, 10, ['hrt,qty=2', 'gpw'], [['dex', 5, 10]], true),
    recipe(15, 70, 10, ['hrt,qty=2', 'gpw'], [['dex', 5, 10]]),
    // Tier 2 gate, then tier 2: 60 → 0, with a real recipe whose name contains "trap"
    { description: 'Tier 2 - Trap 1', cond: [15, 507, 61], inputs: [V, 'any'], output: 'void' },
    { description: 'Tier 2 - Trap 2', cond: [15, 507, 61], inputs: [V, 'any,qty=2'], output: 'void' },
    { description: 'Tier 2 - str max 2 trap', cond: [15, 0, 39], inputs: [V, 'hrt,qty=2', 'brz,qty=2'], output: 'void' },
    { ...recipe(18, 20, 20, ['hrt,qty=2', 'brz,qty=2'], [['str', 20, 30]], true), description: 'Tier 2 - str' },
    { ...recipe(15, 20, 20, ['hrt,qty=2', 'brz,qty=2'], [['str', 20, 30]]), description: 'Tier 2 - str' },
    { ...recipe(18, 20, 20, ['hrt', 'brz'], [['trap-limit', 1, 1]], true), description: 'Tier 2 - trap-limit' },
    recipe(18, 20, 20, ['hrt', 'gpw'], [['oskill', 1, 10, undefined, '561']], true, 0),
    {
      cond: [18, 507, 20],
      inputs: [V, 'um7'],
      output: 'useitem',
      mods: [
        ['anointed_dummy', 1, 178],
        ['soul-counter', -20, -20],
      ],
    },
    // Completion
    {
      description: 'Anointment - Vessel of Souls 1 (of Abyss)',
      cond: [18, 286, 1],
      inputs: [V],
      output: 'useitem',
      mods: [
        ['anointed', 1, 1],
        ['anointed_dummy', -1, -1],
        ['str', 1, 2],
      ],
    },
    { description: 'Transform Anoint Trap', cond: [18, 286, 1], inputs: [V, 'gpw'], output: 'void' },
    { description: 'Transform', cond: [18, 507, 0], inputs: [V, 'gpw'], output: 'm21,mod', mods: [['tinkerflag2', 50, 75]] },
  ]);

  it('reads the start souls and the tiers from the gates and the exact (op=18) rows', () => {
    expect(bundle.vessel).toEqual({ item: V, startSouls: 100 });
    expect(bundle.vesselTiers).toEqual([
      { tier: 1, startSouls: 100, endSouls: 60 },
      { tier: 2, startSouls: 60, endSouls: 0 },
    ]);
    expect(warnings).toEqual([]);
  });

  it('dedupes the op=15/op=18 pairs and skips void rows and disabled rows (not names with "trap")', () => {
    expect(bundle.vesselRecipes.map((entry) => [entry.tier, entry.lines.join(' / ') || '(anointment)'])).toEqual([
      [1, 'str 5-10'],
      [1, 'dex 5-10'],
      [2, 'str 20-30'],
      [2, 'trap-limit 1-1'],
      [2, '(anointment)'],
    ]);
    expect(bundle.vesselRecipes[0]).toMatchObject({
      materials: [
        { code: 'hrt', name: 'Heart', qty: 2 },
        { code: 'brz', name: 'Brain', qty: 1 },
      ],
      soulCost: 10,
    });
    expect(bundle.vesselRecipes.at(-1)?.anointmentRolls).toBe(178);
  });

  it('joins a cap row on the same materials and one of the recipe stats', () => {
    expect(bundle.vesselRecipes.filter((entry) => entry.maxTimes !== undefined).map((entry) => [entry.tier, entry.maxTimes])).toEqual([
      [2, 2],
    ]);
  });

  it('lists the completion transforms and notes that the Vessel cannot be corrupted with souls', () => {
    expect(bundle.vesselTransforms).toEqual([
      {
        materials: [{ code: 'gpw', name: 'Blemished Diamond', qty: 1 }],
        output: { code: 'm21', name: 'Mythical Razor Axe' },
        keepsMods: true,
      },
    ]);
    expect(bundle.corruption.notes).toEqual(['Vessel of Souls cannot be corrupted while it still has souls.']);
  });
});

describe('buildEnhanceBundle: sanctification', () => {
  /** Step 2: marker + clear the dummy + the bonus */
  const sanctify = (value: number, bonus: Mod[]): Row => ({
    description: `Jewel Sanctification ${String(value)}`,
    cond: [18, 236, value],
    inputs: ['jewl'],
    output: 'useitem',
    mods: [['sanctified', 1, 1], ['sanctified-dummy', -value, -value], ...bonus],
  });
  const rows: Row[] = [
    { description: 'Check if already Sanctified - Jewel', cond: [18, 234, 1], inputs: ['jewl', 'u18'], output: 'void' },
    { cond: [16, 236, 0], inputs: ['jewl', 'u18'], output: 'useitem', mods: [['sanctified-dummy', 1, 4]] },
    sanctify(1, [
      ['res-fire-max', 1, 1],
      ['str', 15, 25],
    ]),
    sanctify(2, [
      ['res-fire-max', 1, 1],
      ['dex', 15, 25],
    ]),
    sanctify(3, [
      ['res-cold-max', 1, 1],
      ['str', 15, 25],
    ]),
    sanctify(4, [
      ['res-cold-max', 1, 1],
      ['dex', 15, 25],
    ]),
    // Another dummy's outcome row on the jewel is not a sanctification
    { cond: [18, 999, 5], inputs: ['jewl'], output: 'useitem', mods: [['str', 1, 1]] },
  ];
  const { bundle, warnings } = build(rows);

  it('reads the reagent, the item and the roll range from the roll row, and the one-time blocker', () => {
    expect(bundle.sanctification).toEqual({
      reagent: { code: 'u18', name: 'u18' },
      item: { code: 'jewl', name: 'jewl' },
      rollRange: 4,
      once: true,
    });
    expect(warnings).toEqual([]);
  });

  it('lists one outcome per roll with the marker and dummy mods hidden', () => {
    expect(bundle.sanctificationOutcomes.map((outcome) => outcome.roll)).toEqual([1, 2, 3, 4]);
    expect(bundle.sanctificationOutcomes[0]).toEqual({
      roll: 1,
      mods: [
        { code: 'res-fire-max', param: null, min: 1, max: 1 },
        { code: 'str', param: null, min: 15, max: 25 },
      ],
      lines: ['res-fire-max 1-1', 'str 15-25'],
    });
  });

  it('counts the outcomes of each bonus, by its column in the rows', () => {
    expect(bundle.sanctificationBonuses).toEqual([
      { line: 'res-fire-max 1-1', outcomes: 2 },
      { line: 'res-cold-max 1-1', outcomes: 2 },
      { line: 'str 15-25', outcomes: 2 },
      { line: 'dex 15-25', outcomes: 2 },
    ]);
  });

  it('warns when the outcome rows do not cover the roll range; without a roll row there is no sanctification', () => {
    expect(build(rows.slice(0, 4)).warnings).toEqual(['enhance: sanctification has 2 outcome rows for 4 rolls']);
    expect(build([]).bundle.sanctificationOutcomes).toEqual([]);
  });
});

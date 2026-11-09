import { describe, it, expect } from 'vitest';
import { ENHANCE_QUALITIES } from '../engine/schema.ts';
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
  cm4: 'Odd Charm',
  cm6: 'Odd Charm',
};

const ctx: EnhanceContext = {
  nameOf: (token) => NAMES[token] ?? token,
  isA: (code, parent) =>
    code === parent ||
    (code === 'ocha' && parent === 'char') ||
    (
      [
        ['ajav', 'weap'],
        ['jave', 'weap'],
        ['ajav', 'jave'],
        ['circ', 'helm'],
        ['cm4', 'char'],
        ['cm6', 'char'],
        ['shld', 'armo'],
      ] as const
    ).some(([own, of]) => own === code && of === parent),
  // Two ESR 3.3 perks (itemstatcost ids): Sanctimonious and Hallowed Accessories
  perkOf: (statId) =>
    ({ 960: { title: 'Sanctimonious', tree: 'Blacksmith' }, 971: { title: 'Hallowed Accessories', tree: 'Jeweler' } })[statId] ?? null,
  statIdsOf: (property) => ({ str: [0], dex: [2], 'item-upgraded': [284] })[property] ?? [],
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

  it('lists a subtype brick once when two item codes share its name and result', () => {
    const charm = build([
      { cond: [16, 504, 0], inputs: ['char,uni', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 3]] },
      corrupt('char,uni', 1, [['dmg%', 10, 20]]),
      corrupt('char,uni', 2, [['str', 1, 2]]),
      corrupt('cm6,uni', 3, [], 'cm6,rar'),
      corrupt('cm4,uni', 3, [], 'cm4,rar'),
      corrupt('char,uni', 3, [], 'usetype,rar'),
    ]).bundle.corruptionSlots.find((slot) => slot.slot === 'charm');
    expect(charm?.brick.results.filter((result) => result.typeName === 'Odd Charm')).toEqual([
      { quality: 'uni', type: 'cm6', typeName: 'Odd Charm', result: 'Rare Odd Charm' },
    ]);
  });

  describe('ESR 3.3.03: a quality-less roll row and an op 15 brick row', () => {
    const brick = (input: string, value: number): Row => ({ ...corrupt(input, value, [], 'usetype,rar'), cond: [15, 504, value] });
    const { bundle: wide, warnings: wideWarnings } = build([
      { cond: [16, 504, 0], inputs: ['weap,nru', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 4]] },
      { cond: [16, 504, 0], inputs: ['armo,nru', 'wss'], output: 'useitem', mods: [['corrupted_dummy', 1, 4]] },
      corrupt('weap,nru', 1, [['dmg%', 150, 200]]),
      corrupt('weap,nru', 2, [['att', 400, 500]]),
      corrupt('weap,nru', 3, [['allskills', 1, 1]]),
      brick('weap,nru', 4),
      corrupt('shld,low,nru', 2, [['str', 1, 1]]),
      corrupt('shld,nru', 1, [['dmg%', 10, 20]]),
      corrupt('shld,nru', 2, [['str', 5, 5]]),
      corrupt('shld,nru', 3, [['dex', 5, 5]]),
      brick('shld,nru', 4),
      // Corruption Legacy Roll: op 15, but `useitem`, so no brick
      { cond: [15, 504, 41], inputs: ['shld,nru'], output: 'useitem', mods: [['corrupted_dummy', -40, -40]] },
    ]);

    it('reads the shared roll as every quality, joined to the slot cell, with the brick rate from the op 15 row', () => {
      const weapon = wide.corruptionSlots.find((slot) => slot.slot === 'weapon');
      expect(weapon).toMatchObject({
        qualities: [...ENHANCE_QUALITIES],
        rollOnlyQualities: [],
        rollRange: 4,
        outcomes: 3,
        successRate: 0.75,
        brick: { rolls: 1, rate: 0.25 },
      });
      expect(weapon?.brick.results).toHaveLength(ENHANCE_QUALITIES.length);
      expect(new Set(weapon?.brick.results.map((result) => result.result))).toEqual(new Set(['Rare item of the same type']));
      expect(wideWarnings).toEqual([]);
    });

    it('applies a quality-less roll of a parent type to its slots and keeps a quality row as a variant of its roll', () => {
      const shield = wide.corruptionSlots.find((slot) => slot.slot === 'shield');
      expect(shield).toMatchObject({ rollRange: 4, outcomes: 3, brick: { rolls: 1, rate: 0.25 } });
      const second = wide.corruptionOutcomes.find((outcome) => outcome.slot === 'shield' && outcome.roll === 2);
      expect(second?.lines).toEqual(['str 5-5']);
      expect(second?.variants).toEqual([{ qualities: ['low'], mods: [{ code: 'str', param: null, min: 1, max: 1 }], lines: ['str 1-1'] }]);
    });
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
  // ESR 3.3: one pool per item type, class types first; a perk allows a second anointment
  const { bundle } = build([
    { description: 'Trap Anointment - Unique Weapon', inputs: ['weap,uni', 'um7'], output: 'void' },
    { cond: [3, 960, 1], inputs: ['ajav,nru', 'um7'], output: 'useitem', mods: [['anointed_dummy', 1, 2]] },
    { description: 'Check if Already Anointed', cond: [18, 285, 1], inputs: ['any', 'um7'], output: 'void' },
    { cond: [16, 286, 0], inputs: ['ajav,nru,sock', 'um7'], output: 'useitem', mods: [['anointed_dummy', 1, 1]] },
    { cond: [16, 286, 0], inputs: ['ajav,nru', 'um7'], output: 'useitem', mods: [['anointed_dummy', 1, 2]] },
    { cond: [16, 286, 0], inputs: ['jave,nru', 'um7'], output: 'useitem', mods: [['anointed_dummy', 1, 1]] },
    { cond: [16, 286, 0], inputs: ['circ,nru', 'um7'], output: 'useitem', mods: [['anointed_dummy', 1, 1]] },
    anoint('ajav,nru', 1, 'Anointment - Amazon Javelin 1 (of Abyss)', [['str', 5, 10]]),
    anoint('ajav,nru', 2, 'Anointment - Amazon Javelin 2 (Sockets)', [['sock', 3, 3]]),
    anoint('jave,nru', 1, 'Anointment - Javelin 1 (of Abyss)', [['str', 5, 10]]),
    anoint('circ,nru', 1, 'Anointment - Circlet 1 (of the Wizard)', [['cast2', 30, 30]]),
    { cond: [16, 286, 0], inputs: ['char,uni', 'um1', 'um2', 'um3'], output: 'useitem', mods: [['anointed_dummy', 1, 1]] },
    anoint('char,uni', 1, 'Anointment - Unique Charm 1', [['dmg%', 40, 50]]),
  ]);

  it('uses the row value as the roll and the description suffix as the label', () => {
    expect(bundle.anointmentOutcomes.filter((outcome) => outcome.pool === 'ajav').map((outcome) => [outcome.roll, outcome.label])).toEqual([
      [1, 'of Abyss'],
      [2, 'Sockets'],
    ]);
    expect(bundle.anointmentOutcomes.find((outcome) => outcome.pool === 'charm')).toMatchObject({ roll: 1, lines: ['dmg% 40-50'] });
    expect(bundle.anointmentOutcomes.find((outcome) => outcome.pool === 'charm')?.label).toBeUndefined();
  });

  it('derives the rules: blocked uniques, no runewords, a shorter socketed range', () => {
    expect(bundle.anointmentSlots).toEqual([
      {
        slot: 'ajav',
        typeCode: 'ajav',
        label: 'ajav',
        group: 'weapon',
        rollRange: 2,
        socketedRollRange: 1,
        secondPerk: { title: 'Sanctimonious', tree: 'Blacksmith' },
      },
      { slot: 'jave', typeCode: 'jave', label: 'jave', group: 'weapon', rollRange: 1, socketedRollRange: null },
      { slot: 'circ', typeCode: 'circ', label: 'circ', group: 'helm', rollRange: 1, socketedRollRange: null },
    ]);
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

  it('flags a fixed anointment roll as stored instead of giving a roll count (ESR 3.3.03)', () => {
    const stored = build([
      recipe(18, 90, 10, ['hrt'], [['str', 5, 10]], true),
      {
        cond: [18, 507, 100],
        inputs: [V, 'um7'],
        output: 'useitem',
        mods: [
          ['anointed_dummy', 200, 200],
          ['soul-counter', -10, -10],
        ],
      },
    ]).bundle.vesselRecipes.at(-1);
    expect(stored?.storesAnointment).toBe(true);
    expect(stored?.anointmentRolls).toBeUndefined();
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

  it('takes the item without a perk trap and lists the perk-gated items with the same outcomes (ESR 3.3)', () => {
    const amulet = (row: Row): Row => ({ ...row, inputs: row.inputs.map((input) => (input === 'jewl' ? 'amul' : input)) });
    const perkRows: Row[] = [
      { description: 'Trap Amulet Sanctification', cond: [6, 971, 0], inputs: ['amul', 'u18'], output: 'void' },
      ...rows.slice(0, 6).map(amulet),
    ];
    const result = build([...perkRows, ...rows]);
    expect(result.bundle.sanctification.item).toEqual({ code: 'jewl', name: 'jewl' });
    expect(result.bundle.sanctification.perkItems).toEqual({
      items: [{ code: 'amul', name: 'amul' }],
      perk: { title: 'Hallowed Accessories', tree: 'Jeweler' },
    });
    expect(result.warnings).toEqual([]);
  });

  it('warns when the outcome rows do not cover the roll range; without a roll row there is no sanctification', () => {
    expect(build(rows.slice(0, 4)).warnings).toEqual(['enhance: sanctification has 2 outcome rows for 4 rolls']);
    expect(build([]).bundle.sanctificationOutcomes).toEqual([]);
  });
});

describe('buildEnhanceBundle: Standard of Heroes', () => {
  const upgrade = (charm: string, bonus: Mod[], cond: Row['cond'] = [17, 284, 1], reagent = 'std'): Row => ({
    description: `Standard of Heroes ${charm}`,
    cond,
    inputs: [charm, reagent],
    output: 'useitem',
    mods: [['item-upgraded', 1, 1], ...bonus],
  });
  const rows: Row[] = [
    upgrade('Hellfire Torch', [['all-stats-percent', 2, 3]]),
    upgrade('The Perfect Cell,upg', [
      ['hp', 30, 40],
      ['mana', 30, 40],
    ]),
  ];

  it('lists one outcome per charm with the marker hidden and the upg qualifier ignored', () => {
    const { bundle, warnings } = build(rows);
    expect(bundle.standardOfHeroes).toEqual({ reagent: { code: 'std', name: 'std' }, once: true });
    expect(bundle.standardOfHeroesOutcomes).toEqual([
      {
        charm: { code: 'Hellfire Torch', name: 'Hellfire Torch' },
        mods: [{ code: 'all-stats-percent', param: null, min: 2, max: 3 }],
        lines: ['all-stats-percent 2-3'],
      },
      {
        charm: { code: 'The Perfect Cell', name: 'The Perfect Cell' },
        mods: [
          { code: 'hp', param: null, min: 30, max: 40 },
          { code: 'mana', param: null, min: 30, max: 40 },
        ],
        lines: ['hp 30-40', 'mana 30-40'],
      },
    ]);
    expect(warnings).toEqual([]);
  });

  it("leaves out Tyrael's Might, which sets the same marker with four inputs, and rows without the marker", () => {
    const tyrael: Row = {
      description: 'Tyrael Might Aura str to dex',
      cond: [17, 284, 1],
      inputs: ["Tyrael's Might", 'gbk', 'ggb', 'hh2'],
      output: 'useitem',
      mods: [['item-upgraded', 1, 1]],
    };
    const plain: Row = {
      description: 'Not an upgrade',
      cond: [17, 284, 1],
      inputs: ['Yello Jello', 'std'],
      output: 'useitem',
      mods: [['str', 1, 1]],
    };
    expect(build([tyrael, plain, ...rows]).bundle.standardOfHeroesOutcomes.map((outcome) => outcome.charm.code)).toEqual([
      'Hellfire Torch',
      'The Perfect Cell',
    ]);
  });

  it('warns about a second reagent, not showing its row', () => {
    const { bundle, warnings } = build([...rows, upgrade('Annihilus', [['str', 1, 1]], [17, 284, 1], 'xyz')]);
    expect(bundle.standardOfHeroesOutcomes).toHaveLength(2);
    expect(warnings).toEqual(['enhance: Standard of Heroes row "Standard of Heroes Annihilus" has another reagent and is not shown']);
  });

  it('warns when a row is no longer gated on the marker, and then does not claim once', () => {
    const { bundle, warnings } = build([...rows, upgrade('Annihilus', [['str', 1, 1]], [18, 284, 0])]);
    expect(bundle.standardOfHeroes.once).toBe(false);
    expect(bundle.standardOfHeroesOutcomes).toHaveLength(3);
    expect(warnings).toEqual(['enhance: Standard of Heroes row "Standard of Heroes Annihilus" is not gated on its marker']);
  });

  it('is empty without any row', () => {
    const { bundle } = build([]);
    expect(bundle.standardOfHeroes).toEqual({ reagent: { code: '', name: '' }, once: false });
    expect(bundle.standardOfHeroesOutcomes).toEqual([]);
  });
});

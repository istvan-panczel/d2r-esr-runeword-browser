import { describe, expect, it } from 'vitest';
import {
  buildCubeBundle,
  failSafeNotes,
  GAME_CHECK_TEXT,
  labelDisagrees,
  RAW_ROW_LIMIT,
  rollOdds,
  statConditionText,
  type CubeContext,
} from './bundleCube.ts';
import { fallbackFamilyId, fallbackPrefix, hiddenReason } from './cube/cubeCatalog.ts';
import { buildCubeTables, type CubeMod } from './cube/cubeRows.ts';

function tsv(rows: string[][]): string {
  return rows.map((row) => row.join('\t')).join('\r\n');
}

const HEADER = [
  'description',
  'enabled',
  'min diff',
  'op',
  'param',
  'value',
  'class',
  'numinputs',
  'input 1',
  'input 2',
  'input 3',
  'output',
  'lvl',
  'plvl',
  'ilvl',
  'mod 1',
  'mod 1 min',
  'mod 1 max',
  'mod 2',
  'mod 2 min',
  'mod 2 max',
  'output b',
  '*eol',
];

interface RowOptions {
  enabled?: boolean;
  minDiff?: number;
  condition?: [number, number, number];
  cls?: string;
  mod?: [string, number];
  mod2?: [string, number];
  outputB?: string;
  /** `lvl`, `plvl`, `ilvl` of output a (0 = unset) */
  level?: [number, number, number];
}

function row(description: string, inputs: string[], output: string, options: RowOptions = {}): string[] {
  const [op = 0, param = 0, value = 0] = options.condition ?? [];
  const [first = '', second = '', third = ''] = inputs;
  const [mod = '', amount = 0] = options.mod ?? [];
  const [mod2 = '', amount2 = 0] = options.mod2 ?? [];
  return [
    description,
    options.enabled === false ? '0' : '1',
    String(options.minDiff ?? 0),
    options.condition === undefined ? '' : String(op),
    String(param),
    String(value),
    options.cls ?? '',
    String(inputs.length),
    first,
    second,
    third,
    output,
    ...(options.level ?? [0, 0, 0]).map((level) => (level === 0 ? '' : String(level))),
    mod,
    mod === '' ? '' : String(amount),
    mod === '' ? '' : String(amount),
    mod2,
    mod2 === '' ? '' : String(amount2),
    mod2 === '' ? '' : String(amount2),
    options.outputB ?? '',
    '0',
  ];
}

const MISC = tsv([
  ['name', 'code', 'namestr', 'type'],
  ['Perfect Amethyst', 'gpv', 'gpv', 'gem5'],
  ['Perfect Ruby', 'gpr', 'gpr', 'gem5'],
  ['Key', 'key', 'key', 'key'],
  ['Thawing Potion', 'wms', 'wms', 'potn'],
  ['Kill Ledger', 'kl0', 'kl0', 'misc'],
  ['Anvil Stone', 'qqq', 'qqq', 'misc'],
  ['Multi Stocker', 'ms0', 'ms0', 'stk'],
  ['Gem Can', 'kv0', 'kv0', 'can9'],
  ['Map', 'map', 'map', 'misc'],
  ['Weapons Crate', 'u22', 'u22', 'misc'],
  ['Socket Donut', 'sdn', 'sdn', 'misc'],
  ['Rune Stocker Low', 's01', 's01', 'can2'],
  ['Rune Stocker Low', 's02', 's02', 'can2'],
  ['Scroll of Identify', 'isc', 'isc', 'scro'],
  ['Spider Silk', 'sss', 'sss', 'dstn'],
  ['Perfect Emerald', 'ggb', 'ggb', 'gem5'],
  ['Jewel', 'jew', 'jew', 'jewl'],
  ['Helm', 'cap', 'cap', 'helm'],
  ['Skull Cap', 'skp', 'skp', 'helm'],
]);
const ARMOR = tsv([
  ['name', 'code', 'namestr', 'type'],
  ['Quilted Armor', 'qui', 'qui', 'tors'],
]);
const WEAPONS = tsv([
  ['name', 'code', 'namestr', 'type'],
  ['Short Sword', 'ssd', 'ssd', 'swor'],
  ['Long Bow', 'lbw', 'lbw', 'bow'],
]);
const ITEMTYPES = tsv([
  ['ItemType', 'Code'],
  ['Weapon', 'weap'],
  ['Armor', 'tors'],
  ['Perfect Gem', 'gem5'],
  ['Charm', 'char'],
  ['Gem Can 8', 'can9'],
  ['Rune Can', 'can2'],
  ['Jewel', 'jewl'],
  ['Helm', 'helm'],
]);
const STRINGS = JSON.stringify(
  [
    ['gpv', 'Perfect Amethyst'],
    ['gpr', 'Perfect Ruby'],
    ['key', 'Key'],
    ['wms', 'Thawing Potion'],
    ['kl0', 'Kill Ledger'],
    ['qqq', 'Anvil Stone'],
    ['ms0', 'Multi Stocker'],
    ['kv0', 'Gem Can'],
    ['qui', 'Quilted Armor'],
    ['ssd', 'Short Sword'],
    ['lbw', 'Long Bow'],
    ['Red Portal', 'Red Portal'],
    ['s01', 'Rune Stocker'],
    ['s02', 'Rune Stocker'],
    ['isc', 'Scroll of Identify'],
    ['sss', "Spider's Silk"],
    ['ggb', 'Perfect Emerald'],
    ['jew', 'Jewel'],
    ['cap', 'Helm'],
    ['skp', 'Skull Cap'],
  ].map(([Key, enUS]) => ({ Key, enUS }))
);

/** Stub bonus text: "code +N" */
function stubRenderMods(mods: readonly CubeMod[]): string[] {
  return mods.map((mod) => `${mod.mod} +${String(mod.max)}`);
}

/**
 * itemstatcost rows by id: 92 item_levelreq, 508 kill_check, 470 some hidden marker, 236 the sanctification roll,
 * 431 the random roll, 836 / 837 rune stocker counters, 280 the forging flag, 284 item_upgraded
 */
const STAT_NAMES = new Map([
  [92, 'item_levelreq'],
  [236, 'item_sanctification_dummy'],
  [280, 'item_craftflag'],
  [284, 'item_upgraded'],
  [431, 'item_randomize'],
  [470, 'item_corrupted_dummy'],
  [508, 'kill_check'],
  [836, 'rune_01'],
  [837, 'rune_02'],
]);

/** Stocker counters of the fixture: rune points by property code */
const COUNTERS: Readonly<Partial<Record<string, string>>> = { 'rune-01': 'I Rune', 'rune-02': 'U Rune', 'rune-03': 'Shi Rune' };

function build(rows: string[][]) {
  const tables = buildCubeTables(
    {
      tables: { cubemain: tsv([HEADER, ...rows]), misc: MISC, armor: ARMOR, weapons: WEAPONS, itemtypes: ITEMTYPES },
      strings: [{ name: 'item-names.json', text: STRINGS }],
    },
    stubRenderMods
  );
  const ctx: CubeContext = {
    tables: { ...tables, levelName: (id) => (id === 147 ? 'Cellar of Pain' : null), counterName: (mod) => COUNTERS[mod] ?? null },
    typeCodes: new Set(['weap', 'tors', 'gem5', 'char', 'can9', 'can2', 'jewl', 'helm']),
    statNames: STAT_NAMES,
    setNames: new Set(["Tal Rasha's Lidless Eye"]),
    uniqueNames: new Set(['Hacker', 'Axe of the Elements']),
  };
  return buildCubeBundle(ctx);
}

describe('buildCubeBundle', () => {
  it('hides enhance rows, traps, void outputs, OLD rows, stockers and dummy rolls, but keeps the Anvil Stone stocker row', () => {
    const { bundle } = build([
      row('Unique Corruption - Weapon 1', ['"weap,uni"'], 'useitem', { condition: [18, 470, 1] }),
      row('Add Corruption Dummy Stat - Unique Weapon', ['"weap,uni"', 'wss'], 'useitem'),
      row('Anointment - Weapon 3 (of Abyss)', ['weap'], 'useitem'),
      row('Vessel of Souls Tier 1 - str', ['Vessel of Souls', 'gpv'], 'useitem'),
      row('Kill Ledger Trap', ['kl0'], 'useitem'),
      row('Blocker', ['kl0', 'key'], 'void'),
      row('Coupon Output OLD (Delete later)', ['key'], 'gpv'),
      row('Multi Stocker Input Ruby', ['ms0', 'gpr'], 'useitem'),
      row('Moon Rune', ['kv0', 'gpr'], 'useitem'),
      row('Add Something Dummy Stat', ['key'], 'useitem'),
      row('Multi Stocker 3 Perfect Gems +1 Anvil Stone', ['ms0', 'gpr'], 'qqq'),
      row('Disabled', ['key'], 'gpv', { enabled: false }),
    ]);
    expect(bundle.hidden).toEqual({ enhance: 4, traps: 2, old: 1, stockers: 2, dummy: 1 });
    expect(bundle.families.map((family) => [family.id, family.rowCount])).toEqual([['anvil-stone', 1]]);
  });

  it('assigns rows to the guide families first, then the cube families, then a fallback by description prefix', () => {
    const { bundle, fallback } = build([
      // Matches both the guide's unique-charm-upgrades and the cube-only unique-reroll pattern
      row('Unique Reroll ES Charm Exc', ['"char,uni"', 'gpv'], 'usetype,uni'),
      row('Unique Reroll ES Weapon Exc', ['Axe of the Elements', 'gpv'], 'Axe of the Elements'),
      row('Unique Reroll ES Weapon Exc', ['Hacker', 'gpv'], 'Hacker'),
      row('Mystery Crate', ['u22'], 'lbw,nor', { outputB: 'ssd,nor' }),
      row('Mystery Crate', ['u22'], 'ssd,nor'),
      row('Something New: 3 Keys', ['"key,qty=3"'], 'gpv'),
    ]);
    expect(bundle.families.map((family) => family.id)).toEqual([
      'unique-charm-upgrades',
      'unique-reroll',
      'other:mystery-crate',
      'other:something-new',
    ]);
    expect(fallback).toEqual([
      { id: 'other:mystery-crate', rows: 2 },
      { id: 'other:something-new', rows: 1 },
    ]);
    // The rerolls of named uniques merge into one row; their names stay searchable on small families' recipes
    const reroll = bundle.rows.filter((entry) => entry.family === 'unique-reroll');
    expect(reroll).toEqual([
      expect.objectContaining({
        inputs: ['Axe of the Elements / Hacker', 'Perfect Amethyst'],
        output: 'The same item, rerolled',
        variants: 2,
      }),
    ]);
    expect(bundle.recipes.filter((recipe) => recipe.family === 'unique-reroll').map((recipe) => recipe.inputs[0]?.kind)).toEqual([
      'unique',
      'unique',
    ]);
  });

  it('normalises fallback prefixes', () => {
    expect(fallbackPrefix('Negative MF Charm: SC + Decipherer')).toBe('Negative MF Charm');
    expect(fallbackPrefix("Anya's Gift (nor) 1st")).toBe("Anya's Gift");
    expect(fallbackPrefix('Introductory Book Cycle 3')).toBe('Introductory Book Cycle #');
    expect(fallbackFamilyId("Anya's Gift D-Stone")).toBe('other:anya-s-gift-d-stone');
    expect(fallbackFamilyId('Introductory Book Cycle #')).toBe('other:introductory-book-cycle-n');
  });

  it('parses the cells of small families: kinds, quantities, qualifiers, rem, lvl= and bonuses', () => {
    const { bundle } = build([
      row('Unsocket Weap', ['"weap,sock"', 'key'], 'useitem,rem'),
      row('Tier 1 Map Cellar of Pain', ['map'], 'Red Portal,lvl=147,qty=1', { minDiff: 2 }),
      row('Mystery Box: 2 Gems', ['"gem5,qty=2"', 'any'], 'useitem', { mod: ['hp', 5] }),
    ]);
    const recipe = (description: string) => bundle.recipes.find((entry) => entry.description === description);
    const [unsocket, portal, box] = [recipe('Unsocket Weap'), recipe('Tier 1 Map Cellar of Pain'), recipe('Mystery Box: 2 Gems')];
    // The id is the cubemain line (the header is line 1); families are listed by section (maps before sockets)
    expect(unsocket?.id).toBe(2);
    expect(bundle.recipes.map((entry) => entry.id)).toEqual([3, 2, 4]);
    expect(unsocket?.inputs).toEqual([
      { text: 'Weapon (socketed)', code: 'weap', qty: 1, quals: ['sock'], kind: 'type' },
      { text: 'Key', code: 'key', qty: 1, quals: [], kind: 'item' },
    ]);
    expect(unsocket?.outputs).toEqual([{ text: 'The same item', code: null, bonus: [], details: ['socketed items come out'] }]);
    expect(portal?.outputs).toEqual([{ text: 'Red Portal', code: 'Red Portal', bonus: [], details: ['to Cellar of Pain'] }]);
    expect(portal?.conditions).toEqual(['Hell only']);
    expect(box?.inputs.map((input) => [input.text, input.qty, input.kind])).toEqual([
      ['2× Perfect Gem', 2, 'type'],
      ['Any item', 1, 'any'],
    ]);
    expect(box?.outputs[0]?.bonus).toEqual(['hp +5']);
  });

  it('maps the shown cell texts to icon tokens: items and types by code, uniques and sets by name, none for the rest', () => {
    const { bundle } = build([
      row('Unique Reroll ES Weapon Exc', ['Axe of the Elements', 'gpv'], 'Axe of the Elements'),
      row('Unique Reroll ES Weapon Exc', ['Hacker', 'gpv'], 'Hacker'),
      row('Unsocket Weap', ['"weap,sock"', 'key'], 'useitem,rem'),
      row('Mystery Box: 2 Gems', ['"gem5,qty=2"', 'any'], "Tal Rasha's Lidless Eye"),
      row('Tier 1 Map Cellar of Pain', ['map'], 'Red Portal,lvl=147,qty=1'),
      row('Something New: 3 Keys', ['"key,qty=3"'], '"qui,nor"'),
    ]);
    // Keyed without the count; `any`, `useitem` and string keys (Red Portal) get none
    expect(bundle.icons).toEqual({
      'Axe of the Elements': 'u:Axe of the Elements',
      Hacker: 'u:Hacker',
      Key: 'i:key',
      Map: 'i:map',
      'Perfect Amethyst': 'i:gpv',
      'Perfect Gem': 't:gem5',
      'Quilted Armor': 'i:qui',
      "Tal Rasha's Lidless Eye": "s:Tal Rasha's Lidless Eye",
      'Weapon (socketed)': 't:weap',
    });
  });

  it('words the stat checks: named flags first, then "{stat} {op} {value}"', () => {
    expect(statConditionText(18, 'item_craftflag', 0)).toBe('No forging mod');
    expect(statConditionText(18, 'item_craftflag', 12)).toBe('Has a forging mod');
    expect(statConditionText(18, 'item_craftflag2', 0)).toBe('No jewel forging');
    expect(statConditionText(18, 'item_mercflag', 0)).toBe('Not merc-only');
    expect(statConditionText(18, 'item_mercflag', 3)).toBe('Merc-only item');
    expect(statConditionText(18, 'weaponmastery', 0)).toBe('No weapon mastery token applied');
    expect(statConditionText(18, 'weaponmastery', 1)).toBe('Weapon mastery token applied');
    expect(statConditionText(17, 'item_upgraded', 1)).toBe('Not upgraded yet');
    expect(statConditionText(18, 'item_levelreq', 0)).toBe('Only items without an added level requirement');
    expect(statConditionText(3, 'kill_base', 10000)).toBe('Kill count ≥ 10,000');
    expect(statConditionText(18, 'soul_counter', 0)).toBe('No souls remaining');
    expect(statConditionText(15, 'item_numsockets', 1)).toBe('Sockets ≥ 1');
    expect(statConditionText(16, 'item_fastercastrate', 120)).toBe('Faster cast rate ≤ 120');
    expect(statConditionText(15, 'item_tinkerflag2', 2)).toBe('Tinkering points ≥ 2');
    expect(statConditionText(15, 'junk_09', 25)).toBe('Stocker count junk_09 ≥ 25');
    expect(statConditionText(18, 'item_cannotbefrozen', 1)).toBe('Cannotbefrozen = 1');
    // op 28 has no stat; an unknown op is not worded
    expect(statConditionText(28, 'strength', 0)).toBeNull();
  });

  it('gives merged rows and recipes the output item level and qualities', () => {
    const { bundle } = build([
      row('Magic Weapon Reroll', ['"weap,mag"', 'gpv'], 'usetype,mag', { level: [0, 60, 60] }),
      row('Magic Weapon Reroll', ['"weap,mag"', 'gpr'], 'usetype,mag', { level: [0, 60, 60] }),
      row('Unique Reroll ES Weapon Exc', ['Hacker', 'gpv'], 'Hacker', { level: [99, 0, 0] }),
      row('Weapons Crate', ['u22'], "Tal Rasha's Lidless Eye", { level: [0, 0, 100] }),
    ]);
    const merged = (family: string) => bundle.rows.find((entry) => entry.family === family);
    expect(merged('magic-rare-reroll')).toEqual(
      expect.objectContaining({
        outputLevel: 'Item level 60% of character level + 60% of input item level',
        qualities: ['magic'],
        variants: 2,
      })
    );
    expect(merged('unique-reroll')).toEqual(expect.objectContaining({ outputLevel: 'Item level 99', qualities: ['unique'] }));
    const crate = bundle.recipes.find((entry) => entry.description === 'Weapons Crate');
    expect(crate?.qualities).toEqual(['set']);
    expect(crate?.outputs[0]?.level).toBe('Item level 100% of input item level');
  });

  it('gives D-stoning rows the total their cap condition stops at, none without a condition', () => {
    const { bundle } = build([
      row('DS + Any Weapon', ['weap', 'gpr'], 'useitem', { condition: [16, 584, 116], mod: ['swing2', 5], mod2: ['swing2-cap', 5] }),
      row('DS + Any Weapon', ['weap', 'gpr'], 'useitem', { condition: [16, 584, 117], mod: ['swing2', 4], mod2: ['swing2-cap', 4] }),
      row('FH + Any Weapon', ['weap', 'gpv'], 'useitem', { mod: ['dmg%', 12] }),
    ]);
    const rows = bundle.rows.filter((entry) => entry.family === 'dstoning');
    // ≤ 116: +5 up to 120, then neither row applies
    expect(rows.map((entry) => [entry.inputs.join(' + '), entry.dstoneCaps])).toEqual([
      ['Weapon + Perfect Ruby', ['swing2 +120']],
      ['Weapon + Perfect Amethyst', undefined],
    ]);
  });

  it('links the sanctification outcome row to the Enhance page tab, not the roll row', () => {
    const { bundle } = build([
      row('Add Sanctification Dummy Stat - Jewel', ['jewl', 'u18'], 'useitem', { condition: [16, 236, 0], mod: ['sanctified-dummy', 2] }),
      row('Jewel Sanctification 1', ['jewl'], 'useitem', { condition: [18, 236, 1], mod: ['str', 15] }),
      row('Jewel Sanctification 2', ['jewl'], 'useitem', { condition: [18, 236, 2], mod: ['dex', 15] }),
    ]);
    const rows = bundle.rows.filter((entry) => entry.family === 'legendary-consumables');
    expect(rows.map((entry) => [entry.inputs, entry.enhanceTab])).toEqual([
      [['Jewel', 'u18'], undefined],
      [['That jewel, on its own'], 'sanctification'],
    ]);
  });

  it("links the Standard of Heroes rows to the Enhance tab without the charms' (upgraded), but not Tyrael's rows", () => {
    const { bundle } = build([
      row('Standard of Heroes Hellfire Torch', ['Hellfire Torch', 'std'], 'useitem', {
        condition: [17, 284, 1],
        mod: ['item-upgraded', 1],
      }),
      row('Standard of Heroes The Perfect Cell', ['"The Perfect Cell,upg"', 'std'], 'useitem', {
        condition: [17, 284, 1],
        mod: ['item-upgraded', 1],
      }),
      row('Tyrael Might Aura str to dex', ["Tyrael's Might", 'gpv', 'key'], 'useitem', {
        condition: [17, 284, 1],
        mod: ['item-upgraded', 1],
      }),
      row('Tyrael Might Aura dex to str', ["Tyrael's Might", 'gpr', 'key'], 'useitem', {
        condition: [17, 284, 1],
        mod: ['item-upgraded', 1],
      }),
    ]);
    const charms = bundle.rows.filter((entry) => entry.family === 'unique-charm-upgrades');
    expect(charms.map((entry) => [entry.inputs, entry.enhanceTab])).toEqual([[['Hellfire Torch / The Perfect Cell', 'std'], 'standard']]);
    expect(bundle.recipes.find((recipe) => recipe.description.endsWith('The Perfect Cell'))?.inputs[0]?.text).toBe('The Perfect Cell');
    expect(bundle.rows.filter((entry) => entry.family === 'tyrael-boon').map((entry) => entry.enhanceTab)).toEqual([undefined]);
  });

  it('keeps "(upgraded)" on rows that do not set the upgrade marker', () => {
    const { bundle } = build([row('Standard of Heroes Skull', ['"The Perfect Cell,upg"', 'std'], 'useitem', { mod: ['str', 1] })]);
    expect(bundle.rows.map((entry) => entry.inputs[0])).toEqual(['The Perfect Cell (upgraded)']);
  });

  it('renders the readable conditions: class, difficulty, boss kills and the stat checks', () => {
    const { bundle } = build([
      row('Kill Ledger Rathma', ['kl0', 'gpv'], 'useitem', { condition: [6, 508, 99] }),
      row('Berserker Ascend to Tier 5 Rathma', ['key', 'map'], 'useitem', { condition: [6, 508, 99], cls: 'bar' }),
      row('Berserker Ascend to Tier 5 Who', ['key', 'gpr'], 'useitem', { condition: [6, 508, 7], minDiff: 1 }),
      row('[SECRET31] Gloves: Set Belt + Elixir', ['key', 'gpr', 'gpv'], 'useitem', { condition: [18, 92, 0] }),
      row('[SECRET32] Hidden marker', ['key', 'gpv'], 'useitem', { condition: [16, 470, 0] }),
    ]);
    const byLine = [...bundle.recipes].sort((a, b) => a.id - b.id);
    expect(byLine.map((recipe) => recipe.conditions)).toEqual([
      ['Needs a recorded Rathma kill'],
      ['Barbarian only', 'Needs a recorded Rathma kill'],
      ['Nightmare or Hell', 'Needs a recorded boss kill (#7)'],
      ['Only items without an added level requirement'],
      ['Corrupted dummy ≤ 0'],
    ]);
    expect(bundle.groups.filter((group) => group.family === 'secret').map((group) => group.label)).toEqual([
      'Secret Recipe 31',
      'Secret Recipe 32',
    ]);
  });

  it(`keeps raw rows only for families with at most ${String(RAW_ROW_LIMIT)} rows and orders families by section`, () => {
    const big = Array.from({ length: RAW_ROW_LIMIT + 1 }, (_, i) =>
      row(`Unique Reroll ES Armor Eli`, [`Unique ${String(i)}`, 'gpv'], `Unique ${String(i)}`)
    );
    const { bundle } = build([row('Tyrael Might Aura str to dex', ["Tyrael's Might", 'gpv'], 'useitem'), ...big]);
    expect(bundle.families.map((family) => [family.id, family.section, family.raw, family.order])).toEqual([
      ['unique-reroll', 'uni', false, 0],
      ['tyrael-boon', 'tyrael', true, 1],
    ]);
    expect(bundle.recipes.map((recipe) => recipe.family)).toEqual(['tyrael-boon']);
    const group = bundle.groups.find((entry) => entry.family === 'unique-reroll');
    expect(group?.rowCount).toBe(RAW_ROW_LIMIT + 1);
    expect(group?.inputNames).toHaveLength(RAW_ROW_LIMIT + 1);
    expect(group?.outputNames).toHaveLength(RAW_ROW_LIMIT + 1);
    expect(bundle.sections.map((section) => section.id)).toEqual(['uni', 'tyrael']);
  });

  it('lists the Trap Assassin starter weapon: only "Trap" blockers are hidden as traps', () => {
    const starter = {
      line: 2,
      description: 'Starter Weapon for Trap Assassin:',
      cls: '',
      minDiff: 0,
      inputs: ['tkni,mag'],
      outputs: [{ spec: 'usetype,mag', mods: [] }],
      condition: null,
    };
    expect(hiddenReason(starter, false)).toBeNull();
    expect(hiddenReason({ ...starter, description: 'Kill Ledger Trap' }, false)).toBe('traps');
    expect(hiddenReason({ ...starter, description: 'Trap Too High Req Lvl' }, false)).toBe('traps');
    const { bundle } = build([row('Starter Weapon for Trap Assassin:', ['"weap,mag"', 'gpv'], 'usetype,mag', { mod: ['ass', 1] })]);
    expect(bundle.families.map((family) => family.id)).toEqual(['magic-rare-reroll']);
  });

  it('words stocker counters, random rolls, the use counter and op 28 for players', () => {
    const names = (stat: string) => (stat === 'junk_09' ? "Devil's Food Point" : stat === 'item_02' ? 'Ancient Decipherer' : null);
    expect(statConditionText(15, 'junk_09', 25, names)).toBe("Stored Devil's Food Points ≥ 25");
    expect(statConditionText(15, 'item_02', 32, names)).toBe('Stored Ancient Decipherer points ≥ 32');
    expect(statConditionText(18, 'item_randomize', 0)).toBe('Not used yet');
    expect(statConditionText(18, 'item_randomize', 9)).toBe('Use counter = 9');
    expect(statConditionText(16, 'item_randomize', 254)).toBe('Random roll ≤ 254 (of 0 to 511)');
    // Alchemical Excellence: a Randomizing Stone roll of 384 … 511; on Anya's Gift op 15 is the use counter
    expect(statConditionText(15, 'item_randomize', 384, undefined, true)).toBe('Random roll ≥ 384 (of 0 to 511)');
    expect(statConditionText(15, 'item_randomize', 2)).toBe('Use counter ≥ 2');
    expect(statConditionText(18, 'stancedancecontrol', 0)).toBe('Not applied to this stone yet');
    const { bundle } = build([row('Cow Portal: Club + 1 TP Tome', ['key', 'map'], 'Red Portal', { condition: [28, 0, 0] })]);
    expect(bundle.recipes[0]?.conditions).toEqual([GAME_CHECK_TEXT]);
  });

  it('shows the conditions a merged row does not share with its group, and the ingredients handed back', () => {
    const { bundle } = build([
      row('Tyrael Might Aura str to dex', ["Tyrael's Might", 'gpv', 'key'], 'useitem', { condition: [17, 284, 1], outputB: 'key' }),
      row('Tyrael Might Aura dex to str', ["Tyrael's Might", 'gpr', 'key'], 'useitem', { condition: [17, 284, 1], outputB: 'key' }),
      row('Tyrael Might Aura enr to vit', ["Tyrael's Might", 'gpr', 'map'], 'useitem'),
    ]);
    const rows = bundle.rows.filter((entry) => entry.family === 'tyrael-boon');
    expect(bundle.groups.find((group) => group.family === 'tyrael-boon')?.conditions).toEqual([]);
    expect(rows.map((entry) => [entry.inputs.join(' + '), entry.conditions, entry.returned])).toEqual([
      ["Tyrael's Might + Perfect Amethyst / Perfect Ruby + Key", ['Not upgraded yet'], 'Key'],
      ["Tyrael's Might + Perfect Ruby + Map", undefined, undefined],
    ]);
  });

  it('marks a condition only some merged variants have, and leaves out per-variant selectors past three', () => {
    const { bundle } = build([
      row('Secret thing [SECRET50] a', ['key', 'gpv'], 'useitem'),
      row('[SECRET50] Armor', ['"weap,mag"', 'gpv'], 'useitem', { condition: [18, 92, 1] }),
      row('[SECRET50] Armor', ['"tors,mag"', 'gpv'], 'useitem', { condition: [3, 92, 1] }),
    ]);
    const merged = bundle.rows.find((entry) => entry.family === 'secret' && entry.variants === 2);
    expect(merged?.conditions).toEqual(['Added level requirement = 1 (some variants)', 'Added level requirement ≥ 1 (some variants)']);
  });

  it('shows class crafts per slot with their bonuses, one group per class', () => {
    const craft = (slot: string, mod: string) =>
      row(
        `magic ${slot} + jewel + spider's silk + perfect emerald -> amazon ${slot}`,
        [`"${slot},mag"`, 'jew', 'sss', 'ggb'],
        'usetype,crf',
        {
          mod: ['ama', 1],
          mod2: [mod, 30],
        }
      );
    const { bundle } = build([craft('helm', 'enr'), craft('weap', 'dmg%')]);
    expect(bundle.groups.filter((group) => group.family === 'class-craft').map((group) => group.label)).toEqual(['Amazon craft']);
    expect(bundle.rows.filter((entry) => entry.family === 'class-craft').map((entry) => [entry.inputs[0], entry.output])).toEqual([
      ['Any Magic Helm', 'Crafted item of the same type (ama +1, enr +30)'],
      ['Magic Weapon', 'Crafted item of the same type (ama +1, dmg% +30)'],
    ]);
  });

  it('lists the stocker upgrades in their own family and keeps storing hidden', () => {
    const { bundle } = build([
      row('Rune Stocker Input', ['s01', 'r01'], 'useitem', { mod: ['rune-01', 1] }),
      row('Rune Stocker Upgrade', ['s01', 'isc'], 'useitem', {
        condition: [15, 836, 2],
        mod: ['rune-01', -2],
        mod2: ['rune-02', 1],
        outputB: 'isc',
      }),
      row('Rune Stocker Upgrade', ['s02', 'isc'], 'useitem', {
        condition: [15, 837, 2],
        mod: ['rune-02', -2],
        mod2: ['rune-03', 1],
        outputB: 'isc',
      }),
    ]);
    expect(bundle.hidden.stockers).toBe(1);
    expect(bundle.families.map((family) => [family.id, family.section, family.notes])).toEqual([
      ['stocker-upgrades', 'gem', ['Cube the stocker alone to cycle the selected rune or decal.']],
    ]);
    expect(bundle.rows.map((entry) => [entry.inputs, entry.output, entry.returned, entry.variants])).toEqual([
      [
        ['Rune Stocker (set to the rune to upgrade)', 'Scroll of Identify'],
        'The same Rune Stocker (2 points of that rune → 1 point of the next rune)',
        'Scroll of Identify',
        2,
      ],
    ]);
  });

  it('puts every numbered secret recipe in the secret family', () => {
    const { bundle } = build([
      row('[SECRET26] 16 DS + 16 P-Gems -> Maple Leaf', ['"gem5,qty=16"', 'key'], 'map'),
      row('Maple Leaf: Unique Charm + Key + any rejuv pot', ['"char,uni"', 'key'], 'map'),
    ]);
    expect(bundle.families.map((family) => [family.id, family.rowCount])).toEqual([
      ['unique-charm-upgrades', 1],
      ['secret', 1],
    ]);
  });

  it('reads the odds of a random roll pool from its thresholds (Secret Recipe 25: 50 / 30 / 20)', () => {
    const ore = (output: string, value: number) => row('[SECRET25] Smash Ore', ['map', 'key'], output, { condition: [16, 431, value] });
    const { bundle } = build([ore('gpv', 254), ore('gpr', 407), ore('qqq', 511)]);
    expect(bundle.rows[0]?.odds).toEqual(['50%: Perfect Amethyst', '30%: Perfect Ruby', '20%: Anvil Stone']);
    // A threshold range that is not 2^n (an unknown roll range) gives no odds
    const ctx = { statNames: STAT_NAMES } as unknown as CubeContext;
    const rows = (values: number[]) =>
      values.map((value, i) => ({
        line: i,
        description: '',
        cls: '',
        minDiff: 0,
        inputs: [],
        outputs: [],
        condition: { op: 16, param: 431, value },
      }));
    expect(rollOdds(rows([10, 20]), ctx)).toBeUndefined();
    expect(rollOdds(rows([511]), ctx)).toBeUndefined();
  });

  it('reads the fail-safe level requirement limits from the blockers', () => {
    const blocker = (line: number, target: string, reagent: string, value: number) => ({
      line,
      description: 'Trap Too High Req Lvl',
      cls: '',
      minDiff: 0,
      inputs: [target, reagent],
      outputs: [{ spec: 'void', mods: [] }],
      condition: { op: 15, param: 92, value },
    });
    const notes = failSafeNotes(
      [
        blocker(1, 'weap,eli', 'dstn', 58),
        blocker(2, 'weap,exc', 'dstn', 79),
        blocker(3, 'weap,bas', 'dstn', 99),
        blocker(4, 'ring', 'dstn', 99),
        blocker(5, 'armo,eli', 'gem5', 55),
      ],
      STAT_NAMES
    );
    expect(notes.get('dstoning')).toBe(
      "Fail-safe: does nothing once the item's added level requirement is at least 58 (elite), 79 (exceptional) or 99 (normal tier, rings)."
    );
    expect(notes.get('gem-meld')).toBe("Fail-safe: does nothing once the item's added level requirement is at least 55 (elite).");
  });

  it('replaces a group label that names an ingredient the rows do not take', () => {
    expect(labelDisagrees('Belt Upgrade: Sash + Thawing Potion', ['Sash', 'Stamina Potion'])).toBe(true);
    expect(labelDisagrees('magic mask + jewel + rune # + perfect amethyst -> caster helm', ['Magic Mask', 'Perfect Sapphire'])).toBe(true);
    expect(labelDisagrees('Magic Jewel Reroll: B-Gem', ['Magic Jewel', 'Perfect Gem'])).toBe(true);
    expect(labelDisagrees('Unique Jewel: # P-Gem + Key', ['Unique Jewel', '5× Perfect Gem', 'Key'])).toBe(false);
  });
});

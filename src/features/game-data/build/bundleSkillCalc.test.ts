import { describe, expect, it } from 'vitest';
import type { SkillDetailsBundle } from '../engine/schema.ts';
import { defaultContext, evaluateSkill, indexSkillCalc } from '../engine/skillCalc/index.ts';
import { buildSkillCalcBundle } from './bundleSkillCalc.ts';
import { parseTsv } from './tsv.ts';

/** Rows as column → value records, so a test names only the cells it needs */
function table(columns: readonly string[], rows: readonly Record<string, string>[]) {
  return parseTsv([columns.join('\t'), ...rows.map((row) => columns.map((column) => row[column] ?? '').join('\t'))].join('\n'));
}

const SKILL_COLUMNS = [
  'skill',
  'charclass',
  'skilldesc',
  'maxlvl',
  'ItemEffect',
  'calc1',
  'calc2',
  'calc3',
  'aurastatcalc1',
  'Param1',
  'Param2',
  'Param8',
  'mana',
  'lvlmana',
  'manashift',
  'EMin',
  'EMax',
  'HitShift',
  'EDmgSymPerCalc',
];
const DESC_COLUMNS = [
  'skilldesc',
  'descmissile1',
  ...[1, 2, 3, 4, 5, 6].flatMap((i) => [
    `descline${String(i)}`,
    `desctexta${String(i)}`,
    `desctextb${String(i)}`,
    `desccalca${String(i)}`,
    `desccalcb${String(i)}`,
  ]),
  ...[1, 2].flatMap((i) => [
    `dsc2line${String(i)}`,
    `dsc2texta${String(i)}`,
    `dsc2textb${String(i)}`,
    `dsc2calca${String(i)}`,
    `dsc2calcb${String(i)}`,
  ]),
  ...[1, 2].flatMap((i) => [
    `dsc3line${String(i)}`,
    `dsc3texta${String(i)}`,
    `dsc3textb${String(i)}`,
    `dsc3calca${String(i)}`,
    `dsc3calcb${String(i)}`,
  ]),
];
const MISSILE_COLUMNS = ['Missile', 'Range', 'EMin', 'EMax', 'HitShift', 'Param1'];

const STRINGS = new Map([
  ['Mana', 'Mana Cost: %d'],
  ['Dmg', 'Fire Damage: %d-%d'],
  ['Life', 'Life: %d'],
  ['Heal', 'Heals: %d'],
  ['Cd1', 'Cooldown: %d second'],
  ['CdN', 'Cooldown: %d seconds'],
  ['Hdr', '%s Receives Bonuses From:'],
  ['Syn', '%s: %+d%% Fire Damage per Level'],
  ['NameBolt', 'Bolt'],
  ['NameBlast', 'Blast'],
  ['Clvl', 'Bonus: %d'],
  ['Hard', 'Hard bonus: %d%%'],
  ['Note', 'Bottom\nTop'],
  ['Dur', 'Duration: %d'],
]);

const details: SkillDetailsBundle = {
  items: [],
  skills: [
    {
      id: 'Blast',
      name: 'Blast',
      cls: 'sor',
      page: 1,
      reqLevel: 1,
      maxLevel: 20,
      description: [],
      synergies: [{ name: 'Bolt' }, { name: 'Bolt' }, { name: 'Eschuta Passive' }, { name: 'Any Other Curse' }],
    },
    { id: 'Proc', name: 'Proc', cls: null, page: null, reqLevel: 1, maxLevel: 20, description: [] },
    { id: 'Nova', name: 'Nova', cls: 'sor', page: 1, reqLevel: 1, maxLevel: 20, description: [] },
    { id: 'Charge', name: 'Charge', cls: 'sor', page: 1, reqLevel: 1, maxLevel: 15, description: [] },
    { id: 'Axe', name: 'Axe', cls: 'bar', page: 1, reqLevel: 1, maxLevel: 20, description: [] },
  ],
};

function build() {
  return buildSkillCalcBundle({
    skills: table(SKILL_COLUMNS, [
      {
        skill: 'Blast',
        charclass: 'sor',
        skilldesc: 'blast',
        maxlvl: '20',
        ItemEffect: '1',
        calc1: "skill('Eschuta Passive'.lvl)>0",
        calc2: "lvl*(100+stat('maxhp'.accr)/25600)/100",
        calc3: "(blvl>5)*10+lvl+stat('weaponmastery'.accr)",
        aurastatcalc1: 'clc0',
        Param1: '7',
        Param8: '6',
        mana: '10',
        lvlmana: '1',
        manashift: '7',
        EMin: '10',
        EMax: '20',
        HitShift: '8',
        EDmgSymPerCalc: "skill('Bolt'.blvl)*par8",
      },
      { skill: 'Bolt', charclass: 'sor', skilldesc: 'bolt', maxlvl: '20', Param2: '99' },
      { skill: 'Eschuta Passive', maxlvl: '1' },
      { skill: 'Proc', skilldesc: 'proc', maxlvl: '20', Param1: '3' },
      { skill: 'Unused', Param1: '1' },
      { skill: 'Nova', charclass: 'sor', skilldesc: 'nova', maxlvl: '20' },
      { skill: 'Charge', charclass: 'sor', maxlvl: '15' },
      { skill: 'Axe', charclass: 'bar', maxlvl: '20' },
    ]),
    skilldesc: table(DESC_COLUMNS, [
      {
        skilldesc: 'blast',
        descmissile1: 'blastmissile',
        descline1: '36',
        desctexta1: 'Mana',
        desccalca1: 'usmc',
        desccalcb1: '256',
        descline2: '75',
        desctexta2: 'Dmg',
        desccalca2: 'enma',
        desccalcb2: 'exma',
        descline3: '13',
        desctexta3: 'Life',
        desccalca3: '1',
        descline4: '74',
        desctexta4: 'Heal',
        desccalca4: 'clc2',
        descline5: '74',
        desctexta5: 'Clvl',
        desccalca5: "ulvl*clc1+lvl+miss('blastmissile'.rang)",
        descline6: '74',
        desctexta6: 'Hard',
        desccalca6: 'clc3',
        dsc2line1: '36',
        dsc2texta1: 'Cd1',
        dsc2textb1: 'CdN',
        dsc2calca1: 'max(0,25-25)+clc1*25',
        dsc2calcb1: '25',
        dsc2line2: '74',
        dsc2texta2: 'Dur',
        dsc2calca2: 'ast1',
        dsc3line1: '40',
        dsc3texta1: 'Hdr',
        dsc3textb1: 'NameBlast',
        dsc3calca1: '2',
        dsc3line2: '76',
        dsc3texta2: 'Syn',
        dsc3textb2: 'NameBolt',
        dsc3calca2: 'par8',
      },
      { skilldesc: 'bolt' },
      { skilldesc: 'proc', descline1: '74', desctexta1: 'Missing', desccalca1: '1', descline2: '18', desctexta2: 'Note' },
      {
        skilldesc: 'nova',
        // non-zero only with points in Charge (same class, not listed): kept, Charge becomes an unlisted synergy
        descline1: '74',
        desctexta1: 'Heal',
        desccalca1: "(skill('Charge'.blvl)>0)*5+stat('item_bogus '.accr)",
        // another class's skill: kept, not an input
        descline2: '74',
        desctexta2: 'Heal',
        desccalca2: "(skill('Axe'.blvl)>0)*5",
        // an ascendancy passive: stays hidden
        descline3: '74',
        desctexta3: 'Heal',
        desccalca3: "(skill('Eschuta Passive'.lvl)>0)*5",
        // reads Bolt (same class) only behind that always-0 gate: kept, but Bolt's points change nothing (no input)
        descline4: '74',
        desctexta4: 'Heal',
        desccalca4: "(skill('Eschuta Passive'.lvl)>0)*skill('Bolt'.blvl)+3",
        dsc2line1: '74',
        dsc2texta1: 'Dur',
        dsc2calca1: '5&&1',
      },
    ]),
    missiles: table(MISSILE_COLUMNS, [
      { Missile: 'blastmissile', Range: '10+lvl', EMin: '1', HitShift: '8', Param1: '5' },
      { Missile: 'other', Range: '3' },
    ]),
    strings: STRINGS,
    details,
    statNames: new Set(['weaponmastery', 'maxhp']),
  });
}

describe('buildSkillCalcBundle', () => {
  const { bundle, hidden, hiddenLines, warnings } = build();
  const blast = bundle.skills.find((skill) => skill.id === 'Blast');

  it('keeps the evaluable lines and counts the hidden ones by reason', () => {
    expect(blast?.lines.map((line) => line.key)).toEqual(['desc1', 'desc2', 'desc5', 'desc6', 'dsc3-1', 'dsc3-2']);
    expect(hiddenLines).toEqual([
      { skill: 'Blast', key: 'desc3', reason: 'engine' },
      { skill: 'Blast', key: 'desc4', reason: 'stat' },
      { skill: 'Blast', key: 'dsc2-1', reason: 'gated' },
      { skill: 'Blast', key: 'dsc2-2', reason: 'unsupported' },
      { skill: 'Proc', key: 'desc1', reason: 'string' },
      { skill: 'Nova', key: 'desc3', reason: 'gated' },
    ]);
    expect(hidden).toMatchObject({ engine: 1, stat: 1, gated: 2, unsupported: 1, string: 1 });
    expect(blast).toMatchObject({ hiddenStatLines: 1, hiddenOtherLines: 3, itemEffect: 1, maxHardPoints: 20 });
    expect(warnings).toEqual([
      'skillcalc: string "Missing" not in the strings (Proc desc1)',
      'skillcalc: code:clc0 in 1 line (Blast dsc2-2)',
      'skillcalc: stat "item_bogus " is not in itemstatcost.txt (Nova desc1)',
      'skillcalc: stopped at "&" (position 1): the game ignores the rest in "5&&1" (Nova dsc2-1)',
    ]);
  });

  it('keeps a line that is non-zero only when a class skill it reads has points, and lists unlisted same-class reads', () => {
    const nova = bundle.skills.find((skill) => skill.id === 'Nova');
    expect(nova?.lines.map((line) => line.key)).toEqual(['desc1', 'desc2', 'desc4', 'dsc2-1']);
    // Bolt is read too, but only behind a gate that is always 0: an input that could never change a value is left out
    expect(nova?.unlistedSynergies).toEqual(['Charge']);
    expect(nova?.synergies).toBeUndefined();
    expect(blast?.unlistedSynergies).toBeUndefined();
    expect(bundle.rows.find((row) => row.id === 'Charge')).toEqual({ id: 'Charge', maxlvl: 15 });
  });

  it('flags the lines that move with the character level or the own hard points', () => {
    // desc5 reads ulvl, but only times a passive gate that stays 0
    expect(blast?.lines.find((line) => line.key === 'desc5')?.ulvl).toBeUndefined();
    expect(blast?.lines.find((line) => line.key === 'desc6')).toMatchObject({ blvl: true });
    expect(blast).toMatchObject({ scalesWithHardPointsOnly: true });
    expect(blast?.scalesWithCharLevel).toBeUndefined();
  });

  it('takes the synergy inputs from the dsc3 lines, without passives, duplicates or unknown names', () => {
    expect(blast?.synergies).toEqual(['Bolt']);
    const proc = bundle.skills.find((skill) => skill.id === 'Proc');
    expect(proc).toMatchObject({ maxHardPoints: 0, lines: [{ key: 'desc2', type: 18 }] });
    expect(proc?.synergies).toBeUndefined();
  });

  it('cuts the rows to the columns the kept lines reach and stores each text once', () => {
    expect(bundle.rows.map((row) => row.id)).toEqual(['Blast', 'Bolt', 'Eschuta Passive', 'Proc', 'Nova', 'Charge', 'Axe']);
    expect(Object.keys(bundle.rows[0] ?? {}).sort()).toEqual(
      ['id', 'EDmgSymPerCalc', 'EMax', 'EMin', 'HitShift', 'Param8', 'calc1', 'calc3', 'mana', 'lvlmana', 'manashift'].sort()
    );
    expect(bundle.rows[1]).toEqual({ id: 'Bolt', maxlvl: 20 });
    expect(bundle.missiles).toEqual([{ id: 'blastmissile', Range: '10+lvl' }]);
    expect(bundle.texts).toEqual([
      'Mana Cost: %d',
      'Fire Damage: %d-%d',
      'Bonus: %d',
      'Hard bonus: %d%%',
      '%s Receives Bonuses From:',
      'Blast',
      '%s: %+d%% Fire Damage per Level',
      'Bolt',
      'Bottom\nTop',
      'Heals: %d',
      'Duration: %d',
    ]);
  });

  it('evaluates from the cut bundle', () => {
    const index = indexSkillCalc(bundle);
    const record = index.record('Blast');
    expect(record).toBeDefined();
    if (record === undefined) return;
    const lines = evaluateSkill(record, index, defaultContext(record, { level: 20, synergyPoints: { Bolt: 20 } }));
    expect(lines.map((line) => line.text)).toEqual([
      'Hard bonus: 30%',
      'Bonus: 50',
      'Fire Damage: 22-44',
      'Mana Cost: 14.5',
      'Blast Receives Bonuses From:',
      'Bolt: +6% Fire Damage per Level',
    ]);
    const proc = index.record('Proc');
    if (proc !== undefined) expect(evaluateSkill(proc, index, defaultContext(proc, { level: 1 }))[0]?.text).toBe('Top\nBottom');
  });
});

import { describe, expect, it } from 'vitest';
import { computeCharacterSheet, listAvailableBuffs } from './sheet';
import { charSheetBundle, equipped, item, itemTextBundle, sheetData as data, testCharacter } from './sheet/testSheet.mock';
import type { CharacterSheet, SheetOptions, WhatIfEntries } from './sheet/types';
import { listWhatIfStats } from './sheet/whatIf';
import { createSheetCache } from './sheetCache';
import { buffMemorySave, sheetText } from './sheetView';
import { computeSheetView } from './sheetViewState';
import {
  addWhatIfSkill,
  addWhatIfStat,
  changeText,
  changeWhatIfStat,
  parseWhatIfMemory,
  parseWhatIfValue,
  rememberedWhatIf,
  removeWhatIfSkill,
  removeWhatIfStat,
  serializeWhatIfMemory,
  setWhatIfSkill,
  setWhatIfStat,
  updateWhatIfMemory,
  whatIfChanges,
  whatIfCount,
  whatIfSkillProblem,
} from './whatIfView';

const L = 256;
const BARBARIAN = 4;
const BATTLE_ORDERS = 570;
const BATTLE_COMMAND = 582;
const WHIRLWIND = 590;
const BUNDLES = { charsheet: charSheetBundle, itemtext: itemTextBundle };

const hero = () =>
  testCharacter({
    classId: BARBARIAN,
    level: 80,
    difficulty: 2,
    attributes: { strength: 100, dexterity: 60, vitality: 200, energy: 25, maxhp: 600 * L, maxmana: 100 * L },
    skills: { [WHIRLWIND]: 20, [BATTLE_ORDERS]: 1 },
    handSkills: { left: WHIRLWIND },
    items: [item('cap', equipped('head'), [['fireresist', 300]], { defense: 100 })],
  });

const sheet = (whatIf: WhatIfEntries, options: SheetOptions = {}): CharacterSheet =>
  computeCharacterSheet(hero(), data, { ...options, whatIf });

describe('whatIfChanges', () => {
  it('lists the changed headline numbers with before, after and the difference, labelled from the shared table', () => {
    const before = sheet({});
    const after = sheet({
      stats: [
        { stat: 'strength', value: 50 },
        { stat: 'item_fasterattackrate', value: 20 },
        { stat: 'dexterity', value: 40 },
      ],
    });
    const { numbers, skills } = whatIfChanges(before, after);
    expect(skills).toEqual([]);
    expect(numbers.map((entry) => entry.label)).toEqual([
      'Strength',
      'Dexterity',
      'Defense',
      'Increased attack speed (IAS)',
      'Attack rating (Whirlwind)',
    ]);
    const strength = numbers[0];
    expect(strength).toMatchObject({ before: 100, after: 150, beforeText: '100', afterText: '150', deltaText: '+50' });
    expect(changeText(numbers[3] ?? strength)).toBe('Increased attack speed (IAS) 0% → 20% (+20%)');
    const defense = numbers.find((entry) => entry.key === 'def');
    expect(defense?.after).toBe(defense === undefined ? 0 : defense.before + 10);
  });

  it('shows a resist at the cap by its sum, and a raised cap', () => {
    const before = sheet({});
    const after = sheet({
      stats: [
        { stat: 'fireresist', value: 20 },
        { stat: 'maxcoldresist', value: 5 },
      ],
    });
    expect(whatIfChanges(before, after).numbers.map((entry) => [entry.label, entry.beforeText, entry.afterText])).toEqual([
      ['Fire resistance, sum before the cap', `${String(before.resists.fire.raw)}%`, `${String(before.resists.fire.raw + 20)}%`],
      ['Max cold resistance', '75%', '80%'],
    ]);
  });

  it('puts the skill levels apart, and nothing when nothing changes', () => {
    const before = sheet({});
    const after = sheet({ skills: [{ skillId: BATTLE_COMMAND, level: 1 }] });
    const diff = whatIfChanges(before, after);
    expect(diff.numbers.map((entry) => entry.key)).toContain('sk');
    expect(diff.skills.find((entry) => entry.label === 'Whirlwind')).toMatchObject({ before: 20, after: 21, deltaText: '+1' });
    expect(whatIfChanges(before, before)).toEqual({ numbers: [], skills: [] });
  });

  it('compares with the same buffs on: only the what-if part shows', () => {
    const buffs = [{ skillId: BATTLE_ORDERS }];
    const before = sheet({}, { buffs });
    const after = sheet({ stats: [{ stat: 'strength', value: 1 }] }, { buffs });
    expect(whatIfChanges(before, after).numbers.map((entry) => entry.key)).toEqual(['strength']);
  });

  it('words a negative change and a reduction', () => {
    const before = sheet({});
    const after = sheet({
      stats: [
        { stat: 'strength', value: -30 },
        { stat: 'item_fractionaltargetac', value: 15 },
      ],
    });
    const numbers = whatIfChanges(before, after).numbers;
    expect(numbers.find((entry) => entry.key === 'strength')?.deltaText).toBe('−30');
    expect(numbers.find((entry) => entry.key === 'td')).toMatchObject({ beforeText: '0%', afterText: '−15%', deltaText: '−15%' });
  });
});

describe('editing the entries', () => {
  it('adds, changes and removes rows', () => {
    const options = listWhatIfStats(data, BARBARIAN);
    const strength = options.find((option) => option.id === 'strength');
    const classSkills = options.find((option) => option.stat === 'item_addclassskills');
    if (strength === undefined || classSkills === undefined) throw new Error('options');
    let entries: WhatIfEntries = addWhatIfStat({}, strength);
    entries = addWhatIfStat(entries, classSkills);
    expect(entries.stats).toEqual([
      { stat: 'strength', value: 10 },
      { stat: 'item_addclassskills', param: BARBARIAN, value: 1 },
    ]);
    entries = setWhatIfStat(entries, 0, { stat: 'strength', value: -5 });
    entries = removeWhatIfStat(entries, 1);
    entries = addWhatIfSkill(entries, BATTLE_ORDERS);
    entries = setWhatIfSkill(entries, 0, { skillId: BATTLE_ORDERS, level: 250 });
    expect(entries).toEqual({ stats: [{ stat: 'strength', value: -5 }], skills: [{ skillId: BATTLE_ORDERS, level: 99 }] });
    expect(whatIfCount(entries)).toBe(2);
    expect(whatIfCount(removeWhatIfSkill(entries, 0))).toBe(1);
  });

  it('reads a typed value only when it is a whole number in range', () => {
    expect(parseWhatIfValue('50')).toBe(50);
    expect(parseWhatIfValue(' -12 ')).toBe(-12);
    for (const text of ['', '-', '1.5', '1e3', 'abc', '100001', '--1']) expect(parseWhatIfValue(text)).toBeNull();
  });
});

describe('what-if memory', () => {
  const entries: WhatIfEntries = { stats: [{ stat: 'strength', value: 100 }], skills: [{ skillId: 543, level: 6 }] };

  it('drops anything malformed', () => {
    expect(parseWhatIfMemory(null)).toEqual(new Map());
    expect(parseWhatIfMemory('not json')).toEqual(new Map());
    expect(parseWhatIfMemory('[1]')).toEqual(new Map());
    const parsed = parseWhatIfMemory(
      JSON.stringify({
        Hero: {
          save: '1:2',
          entries: {
            stats: [
              { stat: 'strength', value: 100 },
              { stat: '', value: 1 },
              { stat: 'x', value: 1.5 },
              { stat: 'y', value: 1e9 },
              { stat: 'z', param: -1, value: 1 },
              7,
            ],
            skills: [
              { skillId: 543, level: 6 },
              { skillId: 1, level: 0 },
              { skillId: 'a', level: 3 },
              { skillId: 2, level: 100 },
            ],
          },
        },
        Bad: 3,
        NoSave: { entries },
        NoEntries: { save: '1:2' },
        Empty: { save: '1:2', entries: { stats: [], skills: [] } },
      })
    );
    expect([...parsed.keys()]).toEqual(['Hero']);
    expect(parsed.get('Hero')).toEqual({ save: '1:2', entries });
  });

  it('keeps characters called like Object.prototype members apart (a Map, not a plain object)', () => {
    let memory = new Map<string, { save: string; entries: WhatIfEntries }>();
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty'])
      memory = updateWhatIfMemory(memory, name, { save: '1:2', entries }, () => true);
    const back = parseWhatIfMemory(serializeWhatIfMemory(memory));
    expect([...back.keys()].sort()).toEqual(['__proto__', 'constructor', 'hasOwnProperty', 'toString']);
    expect(rememberedWhatIf(back, 'constructor', '1:2')).toEqual(entries);
    expect(rememberedWhatIf(parseWhatIfMemory('{}'), 'toString', '1:2')).toBeNull();
  });

  it('belongs to the save it was made for, and forgets characters no longer stored', () => {
    const save = buffMemorySave({ lastSavedAt: 100 }, 5);
    const memory = updateWhatIfMemory(new Map(), 'Hero', { save, entries }, () => true);
    expect(rememberedWhatIf(memory, 'Hero', save)).toEqual(entries);
    expect(rememberedWhatIf(memory, 'Hero', buffMemorySave({ lastSavedAt: 101 }, 5))).toBeNull();
    expect(rememberedWhatIf(memory, 'Hero', buffMemorySave({ lastSavedAt: 100 }, 6))).toBeNull();
    const next = updateWhatIfMemory(memory, 'Other', { save, entries }, (name) => name !== 'Hero');
    expect([...next.keys()]).toEqual(['Other']);
    expect(updateWhatIfMemory(next, 'Other', { save, entries: {} }, () => true).size).toBe(0);
    // A row with a zero value is still a row: kept
    expect(updateWhatIfMemory(new Map(), 'Hero', { save, entries: { stats: [{ stat: 'strength', value: 0 }] } }, () => true).size).toBe(1);
  });
});

describe('the sheet with what-if entries on the page', () => {
  it('caches per what-if entries (order-free) and gives the sheets to compare', () => {
    const calls: SheetOptions[] = [];
    const cache = createSheetCache({
      createData: () => data,
      compute: (character, sheetData, options = {}) => {
        calls.push(options);
        return computeCharacterSheet(character, sheetData, options);
      },
      listBuffs: listAvailableBuffs,
    });
    const character = hero();
    const whatIf: WhatIfEntries = {
      stats: [
        { stat: 'strength', value: 50 },
        { stat: 'dexterity', value: 5 },
      ],
    };
    const view = computeSheetView(cache, BUNDLES, character, 2, [], whatIf);
    if (view.status !== 'ready') throw new Error(view.message);
    expect(view.sheet.whatIf?.stats).toHaveLength(2);
    expect(view.unbuffed?.whatIf).toBeUndefined();
    expect(view.withoutWhatIf).toBe(view.unbuffed);
    expect(view.whatIf).toBe(whatIf);
    expect(calls).toEqual([{ difficulty: 2, whatIf }, { difficulty: 2 }]);
    const reordered = computeSheetView(cache, BUNDLES, character, 2, [], { stats: [...(whatIf.stats ?? [])].reverse() });
    if (reordered.status !== 'ready') throw new Error(reordered.message);
    expect(reordered.sheet).toBe(view.sheet);
    expect(calls).toHaveLength(2);
    // Rows that change nothing (a value of 0) are the plain sheet
    const zero = computeSheetView(cache, BUNDLES, character, 2, [], { stats: [{ stat: 'strength', value: 0 }] });
    if (zero.status !== 'ready') throw new Error(zero.message);
    expect(zero.sheet).toBe(view.unbuffed);
    expect(zero.unbuffed).toBeNull();
    expect(zero.withoutWhatIf).toBeNull();
    // With a buff on: the what-if diff's base keeps the buff, the struck-through base has neither
    const buffed = computeSheetView(cache, BUNDLES, character, 2, [{ skillId: BATTLE_ORDERS }], whatIf);
    if (buffed.status !== 'ready') throw new Error(buffed.message);
    expect(buffed.withoutWhatIf?.buffs.map((buff) => buff.skillId)).toEqual([BATTLE_ORDERS]);
    expect(buffed.withoutWhatIf?.whatIf).toBeUndefined();
    expect(buffed.unbuffed).toBe(view.unbuffed);
  });

  it('Copy as text says so and lists the entries', () => {
    const text = sheetText(sheet({ stats: [{ stat: 'strength', value: 100 }], skills: [{ skillId: 543, level: 6 }] }), {
      className: 'Barbarian',
    });
    const lines = text.split('\n');
    expect(lines[0]).toContain('Hell resists, unbuffed, with what-if entries)');
    expect(lines.at(-1)).toBe("What if: +100 to Strength, Concentration 6 (not the character's real numbers)");
    expect(sheetText(sheet({}), { className: 'Barbarian' })).not.toContain('What if');
  });
});

describe('review fixes', () => {
  it('says why a skill row is not counted', () => {
    const entries: WhatIfEntries = {
      skills: [
        { skillId: BATTLE_ORDERS, level: 5 },
        { skillId: BATTLE_ORDERS, level: 9 },
        { skillId: BATTLE_ORDERS, level: 9 },
        { skillId: 568, level: 3 },
        { skillId: BATTLE_COMMAND, level: 2 },
      ],
    };
    const result = sheet(entries);
    expect([0, 1, 2, 3, 4].map((index) => whatIfSkillProblem(result, entries, index))).toEqual([
      'another row has this skill at a higher or the same level; only one counts',
      null,
      'another row has this skill at a higher or the same level; only one counts',
      'it is a passive skill',
      null,
    ]);
    const beaten = computeCharacterSheet(hero(), data, {
      buffs: [{ skillId: BATTLE_ORDERS, level: 30 }],
      whatIf: { skills: [{ skillId: BATTLE_ORDERS, level: 5 }] },
    });
    expect(whatIfSkillProblem(beaten, { skills: [{ skillId: BATTLE_ORDERS, level: 5 }] }, 0)).toBe(
      'your buff counts at level 30, and only one counts'
    );
    expect(whatIfSkillProblem(sheet({}), {}, 0)).toBeNull();
  });

  it('changing a row to or from a yes / no stat sets its value', () => {
    const options = listWhatIfStats(data, BARBARIAN);
    const pick = (stat: string) => {
      const option = options.find((candidate) => candidate.stat === stat);
      if (option === undefined) throw new Error(stat);
      return option;
    };
    let entries: WhatIfEntries = { stats: [{ stat: 'strength', value: 40 }] };
    entries = changeWhatIfStat(entries, 0, pick('dexterity'), options);
    expect(entries.stats).toEqual([{ stat: 'dexterity', value: 40 }]);
    entries = changeWhatIfStat(entries, 0, pick('item_ignoretargetac'), options);
    expect(entries.stats).toEqual([{ stat: 'item_ignoretargetac', value: 1 }]);
    entries = changeWhatIfStat(entries, 0, pick('maxhp'), options);
    expect(entries.stats).toEqual([{ stat: 'maxhp', value: 10 }]);
    expect(changeWhatIfStat(entries, 5, pick('maxhp'), options)).toBe(entries);
  });

  it('keeps only plain stat names from storage', () => {
    const parsed = parseWhatIfMemory(
      JSON.stringify({
        Hero: {
          save: '1:2',
          entries: {
            stats: [
              { stat: 'all-resists', value: 5 },
              { stat: 'strength:0=5,x', value: 1 },
              { stat: 'a b', value: 1 },
              { stat: '<img>', value: 1 },
            ],
          },
        },
      })
    );
    expect(parsed.get('Hero')?.entries.stats).toEqual([{ stat: 'all-resists', value: 5 }]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { computeCharacterSheet, listAvailableBuffs } from './sheet';
import { charSheetBundle, equipped, item, itemTextBundle, sheetData as data, testCharacter } from './sheet/testSheet.mock';
import type { AvailableBuff, ResistValue } from './sheet/types';
import { createSheetCache } from './sheetCache';
import {
  attackChoices,
  attributeRows,
  bonusPartsText,
  buffGroups,
  buffsKey,
  formatValue,
  handRows,
  ledgerBossName,
  mercenaryView,
  resistScrollsText,
  overviewRows,
  parseBuffMemory,
  poolRows,
  resistReadout,
  resistReadouts,
  setBuffLevel,
  sheetText,
  skillBonusById,
  sourceLines,
  toggleBuff,
  weakestStatus,
} from './sheetView';

const L = 256;
const BATTLE_ORDERS = 570;
const SHOUT = 563;
const FRENZY = 574;

const barbarian = () =>
  testCharacter({
    level: 50,
    attributes: { strength: 50, dexterity: 57, maxhp: 100 * L, maxmana: 50 * L, maxstamina: 80 * L },
    skills: { [BATTLE_ORDERS]: 1, [SHOUT]: 1, [FRENZY]: 1 },
    handSkills: { left: FRENZY },
    items: [
      item(
        'cap',
        equipped('head'),
        [
          ['strength', 10],
          ['fireresist', 40],
          ['item_magicbonus', 25],
        ],
        { defense: 100 }
      ),
      item('hax', equipped('rightHand', 1), [['item_tohit_percent', 50]]),
    ],
  });

const resist = (value: number, raw: number, cap: number, penalty: number): ResistValue => ({
  value,
  raw,
  cap,
  penalty,
  sources: [],
  status: 'verified',
});

describe('formatValue', () => {
  it('formats numbers, percents, bonuses, flags and reductions with a real minus sign', () => {
    expect(formatValue(61474, 'number')).toBe('61,474');
    expect(formatValue(79, 'percent')).toBe('79%');
    expect(formatValue(-25, 'percent')).toBe('−25%');
    expect(formatValue(10, 'bonus')).toBe('+10');
    expect(formatValue(1, 'flag')).toBe('Yes');
    expect(formatValue(0, 'flag')).toBe('No');
    expect(formatValue(28, 'reduction')).toBe('−28%');
    expect(formatValue(0, 'reduction')).toBe('0%');
  });

  it('weakestStatus picks unverified over inferred over verified', () => {
    expect(weakestStatus('verified', 'inferred')).toBe('inferred');
    expect(weakestStatus('inferred', 'unverified', 'verified')).toBe('unverified');
    expect(weakestStatus('verified')).toBe('verified');
  });
});

describe('resistReadout', () => {
  it('reads over the cap, at the cap, below it and below zero', () => {
    const over = resistReadout('fire', 'Fire', resist(79, 111, 79, -150), 2);
    expect(over).toMatchObject({ state: 'over', margin: 32, stateText: 'Over the cap by 32' });
    expect(over.detailText).toBe('Sum 261, Hell penalty −150, raw 111, cap 79');
    expect(resistReadout('cold', 'Cold', resist(75, 75, 75, -150), 2)).toMatchObject({ state: 'at', margin: 0, stateText: 'At the cap' });
    expect(resistReadout('poison', 'Poison', resist(45, 45, 75, -150), 2)).toMatchObject({
      state: 'below',
      margin: 30,
      stateText: '30 below the cap',
    });
    expect(resistReadout('lightning', 'Lightning', resist(-20, -20, 75, -80), 1)).toMatchObject({
      state: 'negative',
      margin: 95,
      stateText: '95 below the cap',
    });
  });

  it('leaves the penalty out of the detail when there is none (magic, physical, Normal)', () => {
    expect(resistReadout('magic', 'Magic', resist(38, 38, 79, 0), 2).detailText).toBe('Sum 38, cap 79');
  });

  it('shows the unbuffed value only when it differs', () => {
    expect(resistReadout('fire', 'Fire', resist(60, 60, 75, 0), 0, resist(50, 50, 75, 0)).unbuffedText).toBe('50%');
    expect(resistReadout('fire', 'Fire', resist(60, 60, 75, 0), 0, resist(60, 60, 75, 0)).unbuffedText).toBeNull();
  });

  it('reads all six from a sheet, following its difficulty', () => {
    const character = barbarian();
    const normal = resistReadouts(computeCharacterSheet(character, data, { difficulty: 0 }), null);
    const hell = resistReadouts(computeCharacterSheet(character, data, { difficulty: 2 }), null);
    expect(normal.map((entry) => entry.key)).toEqual(['fire', 'cold', 'lightning', 'poison', 'magic', 'physical']);
    expect(normal[0]?.shown).toBe(40);
    expect(hell[0]?.shown).toBe(40 + (charSheetBundle.rules.resistPenalty[2] ?? 0));
    expect(hell[0]?.detailText).toContain('Hell penalty');
  });
});

describe('overview rows', () => {
  it('builds the attribute, pool and stat rows with the unbuffed value beside a changed one', () => {
    const character = barbarian();
    const plain = computeCharacterSheet(character, data);
    const buffed = computeCharacterSheet(character, data, { buffs: [{ skillId: BATTLE_ORDERS }] });
    const attributes = attributeRows(plain, null);
    expect(attributes[0]).toMatchObject({ label: 'Strength', base: 50, text: '60', bonusText: '+10', unbuffedText: null });
    const pools = poolRows(buffed, plain, { life: 150, mana: 10.5, stamina: 80 });
    expect(pools[0]).toMatchObject({ key: 'life', unbuffedText: String(plain.life.value), saved: 150, savedAbove: true });
    expect(pools[1]).toMatchObject({ saved: 10, savedText: '10', savedAbove: false });
    expect(buffed.life.value).toBeGreaterThan(plain.life.value);
    const rows = overviewRows(plain, null);
    expect(rows.find.find((row) => row.key === 'mf')?.text).toBe('25%');
    expect(rows.offense.find((row) => row.key === 'itd')?.text).toBe('No');
    // No absorb on the gear: no absorb rows; block only with a shield
    expect(rows.absorb).toEqual([]);
    expect(rows.defense.some((row) => row.key === 'blk')).toBe(false);
  });

  it('builds the hand skill rows and the Combat tab choices', () => {
    const sheet = computeCharacterSheet(barbarian(), data);
    const [frenzy] = handRows(sheet, null);
    expect(frenzy).toMatchObject({ label: data.skillName(FRENZY), hand: 'Left mouse button', offHand: null });
    // The sources add up to the line
    expect(frenzy?.value.sources.reduce((sum, source) => sum + source.value, 0)).toBe(frenzy?.mainHand);
    expect(attackChoices(sheet)).toEqual([
      {
        key: `left:${String(FRENZY)}:main`,
        label: `${data.skillName(FRENZY)} (left), ${String(frenzy?.mainHand)}`,
        attackRating: frenzy?.mainHand,
      },
    ]);
    const bare = computeCharacterSheet(testCharacter({}), data);
    expect(attackChoices(bare)).toEqual([
      { key: 'base', label: `No skill, ${String(bare.attackRating.base.value)}`, attackRating: bare.attackRating.base.value },
    ]);
  });

  it('names item sources by the item and keeps the slot beside it', () => {
    const sheet = computeCharacterSheet(barbarian(), data);
    const lines = sourceLines(sheet.attributes.strength, (index) => (index === 0 ? 'Shako' : null));
    expect(lines.map(({ label, where, kind, text }) => ({ label, where, kind, text }))).toEqual([
      { label: 'Base (save)', where: null, kind: 'Save', text: '+50' },
      { label: 'Shako', where: 'Head', kind: 'Item', text: '+10' },
    ]);
    const pool = sourceLines({ sources: [{ kind: 'attribute', label: 'Vitality above base', value: 12.25 }] }, () => null);
    expect(pool[0]?.text).toBe('+12.3');
  });
});

describe('buffs', () => {
  const buff = (skillId: number, kind: AvailableBuff['kind'], level = 5): AvailableBuff => ({
    skillId,
    name: `Skill ${String(skillId)}`,
    kind,
    level,
    stats: [],
  });

  it('groups the available buffs by kind, skipping empty groups', () => {
    const groups = buffGroups([buff(1, 'proc'), buff(2, 'cast'), buff(3, 'cast')]);
    expect(groups.map((group) => [group.kind, group.buffs.map((entry) => entry.skillId)])).toEqual([
      ['cast', [2, 3]],
      ['proc', [1]],
    ]);
  });

  it('toggles buffs, keeps a proc at its item level and lets a level be chosen', () => {
    let selections = toggleBuff([], buff(2, 'cast'), true);
    selections = toggleBuff(selections, buff(9, 'proc', 7), true);
    expect(selections).toEqual([{ skillId: 2 }, { skillId: 9, level: 7 }]);
    selections = setBuffLevel(selections, buff(2, 'cast'), 12.7);
    expect(selections).toEqual([
      { skillId: 2, level: 12 },
      { skillId: 9, level: 7 },
    ]);
    expect(setBuffLevel(selections, buff(2, 'cast'), null)).toEqual([{ skillId: 2 }, { skillId: 9, level: 7 }]);
    expect(setBuffLevel(selections, buff(9, 'proc', 7), null)).toEqual([
      { skillId: 2, level: 12 },
      { skillId: 9, level: 7 },
    ]);
    expect(toggleBuff(selections, buff(2, 'cast'), false)).toEqual([{ skillId: 9, level: 7 }]);
  });

  it('keys a selection independent of its order', () => {
    expect(buffsKey([{ skillId: 9, level: 7 }, { skillId: 2 }])).toBe(buffsKey([{ skillId: 2 }, { skillId: 9, level: 7 }]));
    expect(buffsKey([])).toBe('');
  });

  it('reads the session memory, dropping malformed entries', () => {
    expect(parseBuffMemory(null)).toEqual({});
    expect(parseBuffMemory('not json')).toEqual({});
    expect(parseBuffMemory('[1]')).toEqual({});
    expect(
      parseBuffMemory(
        JSON.stringify({ SpinToWin: [{ skillId: 570 }, { skillId: 'x' }, { skillId: 563, level: 4 }, { skillId: 1, level: -1 }], Bad: 3 })
      )
    ).toEqual({ SpinToWin: [{ skillId: 570 }, { skillId: 563, level: 4 }, { skillId: 1 }] });
  });
});

describe('skillBonusById', () => {
  it('maps the sheet levels to skills.json ids with the bonus over the hard points', () => {
    const character = testCharacter({ skills: { [FRENZY]: 3 }, items: [item('cap', equipped('head'), [['item_allskills', 2]])] });
    const sheet = computeCharacterSheet(character, data);
    const ids: string[] = [];
    ids[FRENZY] = 'frenzy';
    expect(skillBonusById(sheet, ids).get('frenzy')).toEqual({ level: 5, hard: 3, bonus: 2, parts: { all: 2 } });
    expect(bonusPartsText({ all: 10, cls: 2, oskill: 0 })).toBe('all skills +10, class skills +2');
    expect(bonusPartsText({})).toBe('');
  });
});

describe('sheetText', () => {
  it('states the difficulty and whether buffs are counted', () => {
    const character = barbarian();
    const plain = sheetText(computeCharacterSheet(character, data, { difficulty: 2 }), { className: 'Barbarian' });
    const lines = plain.split('\n');
    expect(lines[0]).toBe(`${character.name}, level 50 Barbarian (ESR, Hell resists, unbuffed)`);
    expect(lines[1]).toBe('Str 60, Dex 57, Vit 0, Ene 0');
    expect(plain).toContain('MF 25%');
    expect(plain).not.toContain('Buffs:');
    const buffed = sheetText(computeCharacterSheet(character, data, { buffs: [{ skillId: SHOUT }] }), { className: 'Barbarian' });
    expect(buffed.split('\n')[0]).toContain('Normal resists, with buffs');
    expect(buffed).toContain(`Buffs: ${data.skillName(SHOUT)} 1 (buffed numbers not yet checked in game)`);
  });
});

describe('createSheetCache', () => {
  it('computes once per character, difficulty and buff set, whatever the buff order', () => {
    const compute = vi.fn(computeCharacterSheet);
    const listBuffs = vi.fn(listAvailableBuffs);
    const cache = createSheetCache({ createData: vi.fn(() => data), compute, listBuffs });
    const sheetData = cache.data(charSheetBundle, itemTextBundle);
    expect(cache.data(charSheetBundle, itemTextBundle)).toBe(sheetData);
    const character = barbarian();
    const first = cache.sheet(sheetData, character, 2, [{ skillId: SHOUT }, { skillId: BATTLE_ORDERS }]);
    expect(cache.sheet(sheetData, character, 2, [{ skillId: BATTLE_ORDERS }, { skillId: SHOUT }])).toBe(first);
    cache.sheet(sheetData, character, 1, []);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(compute).toHaveBeenLastCalledWith(character, sheetData, { difficulty: 1 });
    expect(cache.availableBuffs(sheetData, character)).toBe(cache.availableBuffs(sheetData, character));
    expect(listBuffs).toHaveBeenCalledTimes(1);
  });
});

describe('facts', () => {
  it('describes the mercenary, saying nothing it does not know', () => {
    expect(
      mercenaryView({
        typeId: 2,
        name: 'Rogue Scout',
        subtype: 'Elemental',
        act: 1,
        difficulty: 1,
        experience: 1234567,
        level: 98,
        dead: false,
      })
    ).toEqual({ title: 'Rogue Scout (Elemental)', hired: 'Act 1, hired in Nightmare', level: 'Level 98', experience: '1,234,567' });
    expect(
      mercenaryView({ typeId: 41, name: null, subtype: null, act: null, difficulty: null, experience: 0, level: null, dead: true })
    ).toEqual({ title: 'Mercenary type 41', hired: null, level: null, experience: '0' });
  });

  it('names Kill Ledger bosses and the Anya scrolls read', () => {
    expect(ledgerBossName('lucion_whisper')).toBe('Lucion Whisper');
    expect(ledgerBossName('the_lich_king')).toBe('The Lich King');
    expect(ledgerBossName('herald_of_doom')).toBe('Herald of Doom');
    expect(resistScrollsText([true, true, false])).toBe('Normal, Nightmare');
    expect(resistScrollsText([false, false, false])).toBeNull();
  });
});

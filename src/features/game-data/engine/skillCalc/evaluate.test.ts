import { describe, expect, it } from 'vitest';
import type { SkillCalcRow } from '../schema.ts';
import {
  applyPercent,
  CalcRun,
  collectFormulaRefs,
  createSource,
  diminishing,
  levelDamageBonus,
  levelLengthBonus,
  manaCost,
  type FormulaRefs,
  type SkillCalcContext,
} from './evaluate.ts';
import { parseCalc } from './parse.ts';

const ctx = (patch: Partial<SkillCalcContext> = {}): SkillCalcContext => ({
  level: 1,
  hardPoints: 1,
  charLevel: 110,
  skillHardPoints: {},
  skillLevels: {},
  stats: {},
  ...patch,
});

const ROWS: SkillCalcRow[] = [
  {
    id: 'Test',
    Param1: 10,
    Param2: 3,
    Param3: 20,
    Param4: 50,
    Param8: 6,
    calc1: '6+lvl/10',
    calc2: 'clc1*2',
    calc3: 'clc4',
    calc4: 'clc3',
  },
  {
    id: 'Fire Ball',
    HitShift: 8,
    EMin: 10,
    EMinLev1: 2,
    EMinLev2: 4,
    EMinLev3: 6,
    EMinLev4: 8,
    EMinLev5: 10,
    EMax: 20,
    EMaxLev1: 4,
    EMaxLev2: 6,
    EMaxLev3: 8,
    EMaxLev4: 10,
    EMaxLev5: 12,
    mana: 10,
    lvlmana: 1,
    manashift: 7,
    Param8: 6,
    EDmgSymPerCalc: "((100+(skill('Fire Bolt'.blvl)+skill('Molten Focus'.blvl)*2)*par8)*(100+skill('Attack'.clc3))/100)-100",
    descmissile1: 'fireball',
  },
  { id: 'Fire Bolt', maxlvl: 20 },
  { id: 'Molten Focus', maxlvl: 20 },
  { id: 'Attack', calc3: "stat('item_damage_total'.accr)" },
  { id: 'Frost', ELen: 25, ELevLen1: 5, ELevLen2: 4, ELevLen3: 3, ELenSymPerCalc: "skill('Fire Bolt'.blvl)*10" },
  { id: 'Bones', MinDam: 2, MaxDam: 4, MinLevDam1: 1, MaxLevDam1: 2, HitShift: 8, DmgSymPerCalc: '50' },
  { id: 'Kick', Kick: 1 },
  { id: 'Summoner', Param1: 5, Param2: 1 },
  { id: 'Missiles', descmissile1: 'fireball', descmissile2: 'bolt' },
];
const MISSILES: SkillCalcRow[] = [
  { id: 'fireball', EMin: 4, MinELev1: 2, EMax: 8, MaxELev1: 2, HitShift: 6, EDmgSymPerCalc: '100', Range: '90+25*lvl', Param1: 7 },
  { id: 'bolt', EMin: 1, EMax: 2, HitShift: 8 },
];
const source = createSource(ROWS, MISSILES);

function run(text: string, patch: Partial<SkillCalcContext> = {}, own = 'Test') {
  const calc = new CalcRun(source, own, ctx(patch));
  return { value: calc.formula(text), reads: calc.reads };
}
const value = (text: string, patch: Partial<SkillCalcContext> = {}, own = 'Test') => run(text, patch, own).value;

describe('parseCalc', () => {
  it('follows the usual precedence, left to right', () => {
    expect(value('2+3*4')).toBe(14);
    expect(value('(2+3)*4')).toBe(20);
    expect(value('10-3-2')).toBe(5);
    expect(value('100/10/5')).toBe(2);
    expect(value('2^3^2')).toBe(64);
    expect(value('-2^2')).toBe(4);
    expect(value('1+2>2')).toBe(1);
    expect(value('"5 + 5"')).toBe(10);
  });

  it('reads the ternary as the loosest operator and nests it to the right', () => {
    expect(value('1>0?10:20')).toBe(10);
    expect(value('0?1:0?2:3')).toBe(3);
    expect(value('(1?2:3)+4')).toBe(6);
    expect(value('2*(0?5:7)')).toBe(14);
  });

  it('returns an error node for broken formulas instead of throwing', () => {
    expect(parseCalc("stat('x'.accr')>1")).toMatchObject({ kind: 'error' });
    expect(parseCalc('(1+2')).toMatchObject({ kind: 'error' });
    expect(parseCalc('+3')).toMatchObject({ kind: 'error' });
    expect(parseCalc('')).toEqual({ kind: 'num', value: 0 });
    expect(run("stat('x'.accr')>1").reads.unsupported.size).toBe(1);
  });

  it('marks a minus right after ? : or , as ambiguous and refuses it', () => {
    expect(parseCalc('1?1:-2')).toMatchObject({ kind: 'ternary', else: { kind: 'neg', ambiguous: true } });
    expect([...run('0?1:-2').reads.unsupported]).toEqual(['ambiguous: minus after ? : or ,']);
    expect(value('-2+5')).toBe(3);
    expect(parseCalc('-(1>0)?2:3')).toMatchObject({ kind: 'ternary', cond: { kind: 'neg' } });
    expect(parseCalc('-(1>0)?2:3')).not.toMatchObject({ cond: { ambiguous: true } });
    expect(value('-(1>0)?2:3')).toBe(2);
    expect(value('3*(-2)')).toBe(-6);
  });
});

describe('arithmetic', () => {
  it('is 32-bit integer math with truncating division and x/0 = 0', () => {
    expect(value('7/2')).toBe(3);
    expect(value('-7/2')).toBe(-3);
    expect(value('5/0')).toBe(0);
    expect(value('5/(1-1)+1')).toBe(1);
    expect(value('65536*65536')).toBe(0);
    expect(value('2147483647+1')).toBe(-2147483648);
    expect(value('3^0')).toBe(1);
  });

  it('gives 1 / 0 for comparisons and evaluates min / max', () => {
    expect([value('3==3'), value('3!=3'), value('2<=1'), value('2>=2')]).toEqual([1, 0, 0, 1]);
    expect(value('min(3,7)+max(3,7)')).toBe(10);
    expect(run('min(3)').reads.unsupported.has('function:min/1')).toBe(true);
  });

  it('marks rand(a, b) with a < b as random and gives a when a >= b', () => {
    expect(run('rand(5,5)')).toMatchObject({ value: 5, reads: { random: false } });
    expect(run('rand(1,100)')).toMatchObject({ value: 1, reads: { random: true } });
  });
});

describe('skill codes', () => {
  it('reads params, the linear and diminishing pairs, calc columns and the levels', () => {
    expect(value('par1+par8')).toBe(16);
    expect(value('ln12', { level: 5 })).toBe(10 + 4 * 3);
    expect(value('ln12', { level: 0 })).toBe(0);
    expect(value('dm34', { level: 60 })).toBe(50);
    expect(value('clc2', { level: 20 })).toBe(16);
    expect(run('blvl+lvl+ulvl', { level: 7, hardPoints: 3, charLevel: 50 })).toMatchObject({
      value: 60,
      reads: { ownHardPoints: true, charLevel: true },
    });
  });

  it('reports recursion and unknown codes as unsupported', () => {
    expect(run('clc3').reads.unsupported.has('recursion')).toBe(true);
    expect([...run('clc0+ln43+par34').reads.unsupported].sort()).toEqual(['code:clc0', 'code:ln43', 'code:par34']);
    expect([...run("skill('Nope'.blvl)+foo(1)").reads.unsupported].sort()).toEqual(['function:foo', 'skill:Nope']);
  });

  it('reads other skills: hard points for blvl, total level for lvl, their columns at their level', () => {
    const synergies = { skillHardPoints: { 'Fire Bolt': 20 }, skillLevels: { 'Molten Focus': 7 } };
    expect(value("skill('Fire Bolt'.blvl)+skill('fire bolt'.lvl)", synergies)).toBe(40);
    expect(value("skill('Molten Focus'.lvl)+skill('Molten Focus'.blvl)", synergies)).toBe(7);
    // Base skills are level 1; a skill the character lacks is evaluated at level 0
    expect(value("skill('Attack'.lvl)+skill('Kick'.blvl)")).toBe(2);
    expect(value("skill('Summoner'.ln12)+skill('Summoner'.par1)")).toBe(5);
    expect(value("skill('Summoner'.ln12)", { skillHardPoints: { Summoner: 3 } })).toBe(7);
    expect(value("skill('Test'.blvl)", { hardPoints: 4 })).toBe(4);
    // Summoner's ln12 at this skill's par1 (10)
    expect(value("sklvl('Summoner'.par1.ln12)")).toBe(14);
    expect(run("sksrc('Fire Bolt'.lvl)").reads.skills.has('Fire Bolt')).toBe(true);
    expect(run("stat('strength'.accr)+stat('energy'.base)", { stats: { strength: 30 } })).toMatchObject({
      value: 30,
      reads: { stats: new Set(['strength', 'energy']) },
    });
  });
});

describe('damage, length and mana', () => {
  it('adds the per-level damage in the 2-8 / 9-16 / 17-22 / 23-28 / 29+ brackets', () => {
    const lev = [2, 4, 6, 8, 10];
    expect([1, 2, 8, 9, 16, 17, 22, 23, 28, 29, 50].map((level) => levelDamageBonus(level, lev))).toEqual([
      0, 2, 14, 18, 46, 52, 82, 90, 130, 140, 350,
    ]);
  });

  it('caps the diminishing curve at the second param (level 60 and up)', () => {
    expect(diminishing(1, 10, 100)).toBe(23);
    expect(diminishing(59, 10, 100)).toBe(99);
    expect(diminishing(60, 10, 100)).toBe(100);
    expect(diminishing(110, 10, 100)).toBe(100);
    // a decreasing pair collapses to the second param
    expect(diminishing(1, 100, 10)).toBe(10);
  });

  it('adds the elemental length per level for 2-8, 9-16 and 17+', () => {
    expect([1, 8, 9, 16, 17, 20].map((level) => levelLengthBonus(level, [5, 4, 3]))).toEqual([0, 35, 39, 67, 70, 79]);
    expect(value('edln', { level: 17 }, 'Frost')).toBe(25 + 70);
    expect(value('edln', { level: 17, skillHardPoints: { 'Fire Bolt': 10 } }, 'Frost')).toBe(95 + 95);
  });

  it('computes mana in 256ths and the skill elemental damage with its synergy percent', () => {
    expect(manaCost(10, 1, 7, 20)).toBe(3712);
    expect(applyPercent(80, 480)).toBe(384);
    expect(value('usmc', { level: 20 }, 'Fire Ball')).toBe(3712);
    expect(value('mana', { level: 20 }, 'Fire Ball')).toBe(14);
    expect(value('usmc', { level: 0 }, 'Fire Ball')).toBe(0);
    expect(
      [1, 20, 30, 50].map((level) => `${String(value('enma', { level }, 'Fire Ball'))}-${String(value('exma', { level }, 'Fire Ball'))}`)
    ).toEqual(['10-20', '80-128', '160-228', '360-468']);
    const synergies = { skillHardPoints: { 'Fire Bolt': 20, 'Molten Focus': 20 } };
    // (20 + 20 × 2) × 6 = +360%
    expect(value('edmn', { level: 20, ...synergies }, 'Fire Ball')).toBe(80 + 288);
    expect(value('edmx', { level: 0 }, 'Fire Ball')).toBe(0);
  });

  it('computes skill-only physical damage, with the kick formula reading strength and dexterity', () => {
    expect(value('pnma', { level: 2 }, 'Bones')).toBe(4);
    expect(value('pxma', { level: 2 }, 'Bones')).toBe(9);
    expect(run('pnma', {}, 'Kick')).toMatchObject({ value: 0, reads: { stats: new Set(['dexterity', 'strength']) } });
    expect(value('pxma', { stats: { strength: 50, dexterity: 30 } }, 'Kick')).toBe(20);
  });

  it('reads descmissiles and missile codes at the skill level', () => {
    // fireball: (4 + 2) + 100% = 12 << 6 = 768 → 3
    expect(value('m1en', { level: 2 }, 'Missiles')).toBe(3);
    expect(value('m1eo', { level: 2 }, 'Missiles')).toBe(768);
    expect(value("miss('fireball'.rang)+miss('fireball'.par1)", { level: 2 })).toBe(140 + 7);
    expect(value('m1en', { level: 0 }, 'Missiles')).toBe(0);
    expect(run('m2eo', { level: 2 }, 'Missiles').reads.unsupported.has('ambiguous:m2eo')).toBe(true);
    expect(run("miss('fireball'.rad)").reads.unsupported.has('missile code:rad')).toBe(true);
    expect(run('m2en', { level: 2 }, 'Missiles').value).toBe(1);
  });
});

describe('collectFormulaRefs', () => {
  it('follows formula columns, other skills, missiles and every branch', () => {
    const refs: FormulaRefs = { skills: new Map(), missiles: new Map() };
    const fireBall = source.skill('Fire Ball');
    expect(fireBall).toBeDefined();
    if (fireBall === undefined) return;
    collectFormulaRefs(source, fireBall, "lvl>5?enma:m1en+skill('Summoner'.ln12)", refs);
    expect([...(refs.skills.get('Fire Ball') ?? [])].sort()).toEqual(
      ['EDmgSymPerCalc', 'EMin', 'EMinLev1', 'EMinLev2', 'EMinLev3', 'EMinLev4', 'EMinLev5', 'HitShift', 'Param8', 'descmissile1'].sort()
    );
    expect([...refs.skills.keys()].sort()).toEqual(['Attack', 'Fire Ball', 'Fire Bolt', 'Molten Focus', 'Summoner']);
    expect([...(refs.skills.get('Attack') ?? [])]).toEqual(['calc3']);
    expect([...(refs.skills.get('Summoner') ?? [])].sort()).toEqual(['Param1', 'Param2']);
    expect([...(refs.missiles.get('fireball') ?? [])].sort()).toEqual(
      ['EDmgSymPerCalc', 'EMin', 'HitShift', 'MinELev1', 'MinELev2', 'MinELev3', 'MinELev4', 'MinELev5'].sort()
    );
  });
});

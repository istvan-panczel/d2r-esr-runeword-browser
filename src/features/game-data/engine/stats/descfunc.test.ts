import { describe, it, expect } from 'vitest';
import { renderStat, type DescContext } from './descfunc.ts';
import { createSkillLookup } from '../../build/stats/skills.ts';
import { TEST_STRINGS, testTables } from '../../build/stats/testContext.mock.ts';
import type { StatDef, StatEntry } from './types.ts';

const tables = testTables();
const strings = new Map([
  ...TEST_STRINGS,
  ['bare', 'to Light Radius'],
  ['bareneg', 'Light Radius Reduced'],
  ['pct', 'Increased Attack Speed'],
  ['minus', 'Damage Reduced by'],
]);
const ctx: DescContext = {
  strings,
  skills: createSkillLookup(tables, strings),
  monsterNames: tables.monsterNames,
  monTypeNames: tables.monTypeNames,
};

function def(descfunc: number, descstrpos: string, extra: Partial<StatDef> = {}): StatDef {
  return {
    stat: 's',
    op: 0,
    opParam: 0,
    descpriority: 0,
    descfunc,
    descval: 1,
    descstrpos,
    descstrneg: extra.descstrneg ?? descstrpos,
    descstr2: '',
    dgrp: 0,
    dgrpfunc: 0,
    dgrpval: 0,
    dgrpstrpos: '',
    dgrpstrneg: '',
    dgrpstr2: '',
    ...extra,
  };
}
const entry = (min: number, max = min, param = ''): StatEntry => ({ stat: 's', param, min, max });
const render = (d: StatDef, e: StatEntry) => renderStat(e, d, ctx);

describe('renderStat by descfunc', () => {
  it('0: hidden', () => {
    expect(render(def(0, 'ModStr1a'), entry(5))).toEqual([]);
  });

  it('1: +V S1 (bare label by descval, printf string, descstrneg, range)', () => {
    expect(render(def(1, 'bare'), entry(2))).toEqual(['+2 to Light Radius']);
    expect(render(def(1, 'bare', { descval: 2 }), entry(2))).toEqual(['to Light Radius +2']);
    expect(render(def(1, 'bare', { descval: 0 }), entry(2))).toEqual(['to Light Radius']);
    expect(render(def(1, 'bare', { descstrneg: 'bareneg' }), entry(-2))).toEqual(['-2 Light Radius Reduced']);
    expect(render(def(1, 'ModStr1a'), entry(5, 10))).toEqual(['+(5 to 10) to Strength']);
  });

  it('2: V% S1; 3: V S1', () => {
    expect(render(def(2, 'pct'), entry(20))).toEqual(['20% Increased Attack Speed']);
    expect(render(def(2, 'ModStr4m'), entry(20))).toEqual(['+20% Increased Attack Speed']);
    expect(render(def(3, 'minus', { descval: 2 }), entry(3, 5))).toEqual(['Damage Reduced by (3 to 5)']);
    expect(render(def(3, 'minus', { descval: 2 }), entry(-5, -3))).toEqual(['Damage Reduced by -(3 to 5)']);
  });

  it('5: V×100/128 %', () => {
    expect(render(def(5, 'ModStr6b', { descval: 2 }), entry(128))).toEqual(['Regenerate Stamina 100%']);
    expect(render(def(5, 'ModStr6b', { descval: 2 }), entry(64, 128))).toEqual(['Regenerate Stamina (50 to 100)%']);
  });

  it('6-10 append S2', () => {
    const s2 = { descstr2: 'increaseswithplaylevelX' };
    expect(render(def(6, 'bare', s2), entry(1))).toEqual(['+1 to Light Radius (Based on Character Level)']);
    expect(render(def(7, 'pct', s2), entry(10))).toEqual(['10% Increased Attack Speed (Based on Character Level)']);
  });

  it('11: repair durability, 1 per 100 / V seconds as the game writes it', () => {
    // Secret Recipe 37's rep-dur 5: the official page's "Repairs 1 Durability In 20 Sec"
    expect(render(def(11, 'ModStre9t'), entry(5))).toEqual(['Repairs 1 durability in 20 seconds']);
    // of Self-Repair (3): 100 / 3 rounds down; Aanna's Touch (100): the docs' "in 1 seconds"
    expect(render(def(11, 'ModStre9t'), entry(3))).toEqual(['Repairs 1 durability in 33 seconds']);
    expect(render(def(11, 'ModStre9t'), entry(100))).toEqual(['Repairs 1 durability in 1 seconds']);
    expect(render(def(11, 'ModStre9t'), entry(200))).toEqual(['Repairs 2 durability per second']);
  });

  it('12: +V S1, V omitted when 1', () => {
    expect(render(def(12, 'ModStr3l', { descval: 2 }), entry(1))).toEqual(['Freezes target']);
    expect(render(def(12, 'ModStr3l', { descval: 2 }), entry(3))).toEqual(['Freezes target +3']);
  });

  it('13: class skill levels from charstats', () => {
    expect(render(def(13, 'ModStr3a'), entry(2, 2, '1'))).toEqual(['+2 to Sorceress Skill Levels']);
    expect(render(def(13, 'ModStr3a'), entry(1, 2, '0'))).toEqual(['+(1 to 2) to Amazon Skill Levels']);
  });

  it('14: skill tab + class only (class = ⌊p/3⌋, tab = p % 3)', () => {
    expect(render(def(14, 'StrSklTabItem1'), entry(3, 3, '3'))).toEqual(['+3 to Fire Skills (Sorceress Only)']);
    expect(render(def(14, 'StrSklTabItem1'), entry(1, 2, '2'))).toEqual(['+(1 to 2) to Javelin and Spear Skills (Amazon Only)']);
  });

  it('15: chance, level, skill', () => {
    expect(render(def(15, 'ItemExpansiveChanc1'), entry(10, 5, 'Fire Bolt'))).toEqual(['10% Chance to Cast Level 5 Fire Bolt on Striking']);
  });

  it('16: aura level and skill (numeric id param)', () => {
    expect(render(def(16, 'ModitemAura'), entry(12, 12, '3'))).toEqual(['Level 12 Teleport Aura When Equipped']);
  });

  it('19: sprintf, per-level value / 2^op param + S2', () => {
    expect(render(def(19, 'ModStr1a'), entry(-5))).toEqual(['-5 to Strength']);
    const perLevel = def(19, 'ModStr1f', { op: 4, opParam: 3, descstr2: 'increaseswithplaylevelX' });
    expect(render(perLevel, entry(5))).toEqual(['+0.625 to Maximum Damage to Attacks (Based on Character Level)']);
    expect(render(def(19, 'ModStre9s'), entry(1))).toEqual(['Indestructible']);
  });

  it('20: -V% S1; bare flags without a value', () => {
    expect(render(def(20, 'ModStr5o'), entry(25))).toEqual(['-25% Target Defense']);
    expect(render(def(20, 'Corrupted', { descval: 0 }), entry(1))).toEqual(['Corrupted']);
    expect(render(def(20, 'minus', { descval: 1 }), entry(10, 20))).toEqual(['-(10 to 20)% Damage Reduced by']);
  });

  it('21: -V S1', () => {
    expect(render(def(21, 'minus', { descval: 2 }), entry(4))).toEqual(['Damage Reduced by -4']);
  });

  it('22: V% S1 [montype]', () => {
    expect(render(def(22, 'ModitemAttratvsM'), entry(50, 50, '1'))).toEqual(['+50% to Attack Rating versus Undead']);
  });

  it("23: sprintf(S1, V, monster); descval 0 drops the value and ESR's leading dot, lines bottom-up", () => {
    expect(render(def(23, 'Moditemreanimas'), entry(25, 25, '1'))).toEqual(['25% Reanimate as: Zombie']);
    expect(render(def(23, 'mythicalitemdesc', { descval: 0 }), entry(1, 1, '2'))).toEqual(['First line', 'second line']);
  });

  it('24: charges (min = charges, max = level)', () => {
    expect(render(def(24, 'ModStre10d'), entry(20, 3, 'Teleport'))).toEqual(['Level 3 Teleport (20/20 Charges)']);
  });

  it('27: +V to skill (class only); 28: +V to skill', () => {
    expect(render(def(27, 'ItemModifierClassSkill'), entry(2, 2, 'Critical Strike'))).toEqual(['+2 to Critical Strike (Amazon Only)']);
    expect(render(def(27, 'ItemModifierClassSkill'), entry(1, 3, 'Attack'))).toEqual(['+(1 to 3) to Attack']);
    expect(render(def(28, 'ItemModifierNonClassSkill'), entry(3, 3, 'teleport'))).toEqual(['+3 to Teleport']);
  });
});

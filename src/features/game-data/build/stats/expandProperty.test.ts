import { describe, it, expect } from 'vitest';
import { expandProperty, type ModInput } from './expandProperty.ts';
import { createSkillLookup } from './skills.ts';
import { TEST_STRINGS, testTables } from './testContext.mock.ts';

const tables = testTables();
const ctx = { properties: tables.properties, strings: TEST_STRINGS, skills: createSkillLookup(tables, TEST_STRINGS) };
const mod = (code: string, min: number, max: number, param: string | null = null): ModInput => ({ code, param, min, max });
const expand = (m: ModInput) => expandProperty(m, ctx);
const stats = (m: ModInput) => expand(m).entries.map((entry) => [entry.stat, entry.param, entry.min, entry.max]);

describe('expandProperty', () => {
  it('func 1/2/8/13: stat = min–max', () => {
    expect(stats(mod('str', 5, 10))).toEqual([['strength', '', 5, 10]]);
    expect(stats(mod('ac%', 10, 20))).toEqual([['item_armor_percent', '', 10, 20]]);
    expect(stats(mod('swing2', 20, 20))).toEqual([['item_fasterattackrate', '', 20, 20]]);
    expect(stats(mod('dur%', 10, 10))).toEqual([['item_maxdurability_percent', '', 10, 10]]);
  });

  it('func 3 reuses the previous value (res-all)', () => {
    expect(stats(mod('res-all', 5, 10)).map(([stat, , min, max]) => [stat, min, max])).toEqual([
      ['fireresist', 5, 10],
      ['lightresist', 5, 10],
      ['coldresist', 5, 10],
      ['poisonresist', 5, 10],
    ]);
  });

  it('func 5/6/7: min damage, max damage, enhanced damage on both', () => {
    expect(stats(mod('dmg-min', 3, 3))).toEqual([['mindamage', '', 3, 3]]);
    expect(stats(mod('dmg-max', 4, 6))).toEqual([['maxdamage', '', 4, 6]]);
    expect(stats(mod('dmg%', 50, 60)).map(([stat]) => stat)).toEqual(['item_maxdamage_percent', 'item_mindamage_percent']);
  });

  it('func 15/16/17: min only, max only, param as value', () => {
    expect(stats(mod('dmg-cold', 10, 20, '75'))).toEqual([
      ['coldmindam', '75', 10, 10],
      ['coldmaxdam', '75', 20, 20],
      ['coldlength', '', 75, 75],
    ]);
    expect(stats(mod('dmg/lvl', 0, 0, '8'))).toEqual([['item_maxdamage_perlevel', '', 8, 8]]);
  });

  it('func 10/11/19/22/24 keep the param as stat layer', () => {
    expect(stats(mod('skilltab', 1, 2, '4'))).toEqual([['item_addskill_tab', '4', 1, 2]]);
    expect(stats(mod('hit-skill', 10, 5, 'Fire Bolt'))).toEqual([['item_skillonhit', 'Fire Bolt', 10, 5]]);
    expect(stats(mod('charged', 20, 3, 'Teleport'))).toEqual([['item_charged_skill', 'Teleport', 20, 3]]);
    expect(stats(mod('oskill', 2, 2, 'Teleport'))).toEqual([
      ['item_nonclassskill', 'Teleport', 2, 2],
      ['item_nonclassskill_display', 'Teleport', 2, 2],
    ]);
  });

  it('func 10 without a param takes the tab from `val` (war-tab-rand)', () => {
    expect(stats(mod('war-tab-rand', 1, 1))).toEqual([
      ['item_addskill_tab', '21', 1, 1],
      ['item_addskill_tab', '22', 1, 1],
      ['item_addskill_tab', '23', 1, 1],
    ]);
    expect(stats(mod('skilltab', 2, 2, '20'))).toEqual([['item_addskill_tab', '20', 2, 2]]);
  });

  it('func 21: class skills with the class from `val`; func 20 indestructible', () => {
    expect(stats(mod('sor', 1, 1))).toEqual([['item_addclassskills', '1', 1, 1]]);
    expect(stats(mod('indestruct', 1, 1))).toEqual([['item_indesctructible', '', 1, 1]]);
  });

  it('func 12/14/23 produce text', () => {
    expect(expand(mod('skill-rand', 2, 3, '3')).entries[0]?.text).toBe('+3 to a random Sorceress Skill');
    expect(expand(mod('sock', 2, 4)).entries[0]?.text).toBe('Socketed (2 to 4)');
    expect(expand(mod('ethereal', 1, 1)).entries[0]?.text).toBe('Ethereal (Cannot be Repaired)');
  });

  it('falls back to "code param min–max" with a warning for unsupported funcs and unknown codes', () => {
    for (const m of [mod('affix-rand', 1, 5), mod('ac/time', 1, 5, '7'), mod('unknown-func', 1, 1), mod('nope', 2, 2, 'x')]) {
      const result = expand(m);
      expect(result.warnings).toHaveLength(1);
    }
    expect(expand(mod('ac/time', 1, 5, '7')).entries[0]?.text).toBe('ac/time 7 (1 to 5)');
    expect(expand(mod('nope', 2, 2, 'x')).warnings).toEqual(['unknown property "nope"']);
  });
});

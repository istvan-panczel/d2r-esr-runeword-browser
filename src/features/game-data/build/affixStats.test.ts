import { describe, expect, it } from 'vitest';
import { createAffixStatResolver, isTechnicalStat, labelFromDescription, propertyStats, statLabel } from './affixStats.ts';
import { createPropertyLayerResolver } from './bundleLootFilterSkills.ts';
import { createSkillLookup } from './stats/skills.ts';
import { TEST_STRINGS, testStatIndex, testTables } from './stats/testContext.mock.ts';

const { properties } = testTables();
const index = testStatIndex();
const statsOf = (code: string) => {
  const def = properties.get(code);
  if (def === undefined) throw new Error(`no property ${code}`);
  return propertyStats(def);
};

describe('propertyStats', () => {
  it('maps the stat-less damage funcs the way the engine writes them', () => {
    expect(statsOf('dmg%')).toEqual(['item_maxdamage_percent', 'item_mindamage_percent']);
    expect(statsOf('dmg-min')).toEqual(['mindamage']);
    expect(statsOf('dmg-max')).toEqual(['maxdamage']);
    expect(statsOf('indestruct')).toEqual(['item_indesctructible']);
  });

  it('uses the stat columns of the other funcs, deduplicated', () => {
    expect(statsOf('str')).toEqual(['strength']);
    expect(statsOf('res-all')).toEqual(['fireresist', 'lightresist', 'coldresist', 'poisonresist']);
    expect(statsOf('dmg-cold')).toEqual(['coldmindam', 'coldmaxdam', 'coldlength']);
    expect(statsOf('oskill')).toEqual(['item_nonclassskill', 'item_nonclassskill_display']);
  });

  it('writes no stat for ethereal (an item flag) and leaves unknown funcs unmapped', () => {
    expect(statsOf('ethereal')).toEqual([]);
    expect(statsOf('affix-rand')).toBeNull();
    expect(statsOf('unknown-func')).toBeNull();
  });
});

describe('isTechnicalStat', () => {
  it('drops tinkering, jewel flag and companion stats, keeps real ones', () => {
    expect(
      ['item_tinkerflag2', 'item_jewelflag', 'item_randomize', 'item_aura_display', 'strength_cap', 'item_skillonhit_hidden'].map(
        isTechnicalStat
      )
    ).toEqual([true, true, true, true, true, true]);
    expect(['item_aura', 'strength', 'vitality_hidden2', 'item_maxdamage_percent'].map(isTechnicalStat)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('labelFromDescription', () => {
  it('strips format tokens, signs and edge words', () => {
    expect(labelFromDescription('+%d%% Enhanced Damage')).toBe('Enhanced Damage');
    expect(labelFromDescription('%+d to Strength')).toBe('Strength');
    expect(labelFromDescription('Damage Reduced by')).toBe('Damage Reduced');
    expect(labelFromDescription('Attacker Takes Damage of %d')).toBe('Attacker Takes Damage');
    expect(labelFromDescription('%d%% Chance to cast level %d %s on striking')).toBe('Chance to cast on striking');
    expect(labelFromDescription('ÿc3Tinkering Points: %d')).toBe('Tinkering Points');
    expect(labelFromDescription('%s')).toBe('');
  });
});

describe('statLabel', () => {
  it('uses overrides, the description, a per-level suffix and the name as the fallback', () => {
    expect(statLabel('item_maxdamage_percent', index, TEST_STRINGS)).toBe('Enhanced Maximum Damage');
    expect(statLabel('item_maxdamage_perlevel', index, TEST_STRINGS)).toBe('Maximum Damage to Attacks (per level)');
    expect(statLabel('item_addclassskills', index, TEST_STRINGS)).toBe('Class Skill Levels');
    expect(statLabel('coldlength', index, TEST_STRINGS)).toBe('Cold Length');
    expect(statLabel('item_elemskill', index, TEST_STRINGS)).toBe('item_elemskill');
  });
});

describe('createAffixStatResolver', () => {
  it('resolves mods to sorted distinct ids, drops technical stats and warns once per unmapped property', () => {
    const resolver = createAffixStatResolver(properties, index, TEST_STRINGS);
    const id = (name: string) => index.get(name)?.id ?? -1;
    expect(resolver.statsOf([{ prop: 'str' }, { prop: 'all-stats' }, { prop: 'tinkerflag2' }])).toEqual(
      [id('strength'), id('energy'), id('dexterity'), id('vitality')].sort((a, b) => a - b)
    );
    expect(resolver.statsOf([{ prop: 'aura' }])).toEqual([id('item_aura')]);
    expect(resolver.statsOf([{ prop: 'affix-rand' }, { prop: 'affix-rand' }, { prop: 'nope' }])).toEqual([]);
    expect(resolver.warnings()).toEqual([
      'affix stats: property "affix-rand" is not mapped to item stats',
      'affix stats: property "nope" is not mapped to item stats',
    ]);
    expect(resolver.listed().map((stat) => stat.name)).toEqual(['strength', 'energy', 'dexterity', 'vitality', 'item_aura']);
    expect(resolver.listed().find((stat) => stat.name === 'item_aura')?.label).toBe('Aura When Equipped');
  });

  it('lists the params of the layered stats it keeps, by stat then param, and none without a layer resolver', () => {
    const tables = testTables();
    const layers = createPropertyLayerResolver(properties, index, createSkillLookup(tables, TEST_STRINGS).skillId);
    const resolver = createAffixStatResolver(properties, index, TEST_STRINGS, layers);
    const id = (name: string) => index.get(name)?.id ?? -1;
    const mods = [
      { prop: 'oskill', param: 'Teleport', min: 1, max: 1 },
      { prop: 'sor', param: null, min: 1, max: 1 },
      { prop: 'skilltab', param: '4', min: 1, max: 1 },
      { prop: 'oskill', param: 'Teleport', min: 2, max: 2 },
      { prop: 'hit-skill', param: 'Fire Bolt', min: 5, max: 3 },
      { prop: 'str', param: null, min: 5, max: 5 },
    ];
    expect(resolver.layersOf(mods)).toEqual(
      [
        { stat: id('item_nonclassskill'), param: 3 },
        { stat: id('item_addclassskills'), param: 1 },
        { stat: id('item_addskill_tab'), param: 9 },
        { stat: id('item_skillonhit'), param: 2 * 64 + 3 },
      ].sort((a, b) => a.stat - b.stat)
    );
    expect(createAffixStatResolver(properties, index, TEST_STRINGS).layersOf(mods)).toEqual([]);
  });
});

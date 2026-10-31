import { describe, it, expect } from 'vitest';
import { readStatIndex } from './affixStats.ts';
import {
  buildLootFilterSkills,
  createPropertyLayerResolver,
  propertyGroupSources,
  setBonusSources,
  type LayerSource,
} from './bundleLootFilterSkills.ts';
import type { ModInput } from './stats/expandProperty.ts';
import { createSkillLookup } from './stats/skills.ts';
import type { PropertyDef, PropertyGroupDef } from './stats/tables.ts';
import { TEST_STRINGS, testTables } from './stats/testContext.mock.ts';
import { parseTsv } from './tsv.ts';

const table = (rows: string[][], keepExpansionRows = false) =>
  parseTsv(rows.map((row) => row.join('\t')).join('\n'), 'table', { keepExpansionRows });

/** Row index = stat id */
const itemstatcost = table(
  [
    ['Stat', 'Encode', 'descfunc', 'descstrpos'],
    ['strength', '', '1', ''],
    ['item_addskill_tab', '', '14', ''],
    ['item_addclassskills', '', '13', ''],
    ['item_singleskill', '1', '27', ''],
    ['item_nonclassskill', '1', '', ''],
    ['item_nonclassskill_display', '1', '28', ''],
    ['item_skillonhit', '2', '15', ''],
    ['item_charged_skill', '3', '24', ''],
    ['item_skillonhit_hidden', '2', '', ''],
    ['item_skillonnewthing', '2', '15', ''],
    ['item_aura', '', '', ''],
  ],
  true
);
const statIndex = readStatIndex(itemstatcost);

const def = (code: string, ...slots: [number, string, number?][]): [string, PropertyDef] => [
  code,
  { code, slots: slots.map(([func, stat, val]) => ({ func, stat, set: 0, val: val ?? 0 })) },
];
const properties = new Map<string, PropertyDef>([
  def('str', [1, 'strength']),
  def('skilltab', [10, 'item_addskill_tab']),
  def('war-tab-rand', [10, 'item_addskill_tab', 21], [10, 'item_addskill_tab', 22]),
  def('sor', [21, 'item_addclassskills', 1]),
  def('randclassskill', [36, 'item_addclassskills', 3]),
  def('skill', [22, 'item_singleskill']),
  def('oskill', [22, 'item_nonclassskill'], [24, 'item_nonclassskill_display']),
  def('aura', [22, 'item_aura']),
  def('skill-rand', [12, 'item_singleskill']),
  def('hit-skill', [11, 'item_skillonhit']),
  def('hit-skill-hidden', [11, 'item_skillonhit_hidden']),
  def('charged', [19, 'item_charged_skill']),
  def('odd', [1, 'item_singleskill']),
]);

const SKILL_IDS = new Map([
  ['Attack', 0],
  ['Critical Strike', 1],
  ['Fire Bolt', 2],
  ['Teleport', 3],
  ['Long Shot', 1555],
]);
const skillId = (param: string) => (/^\d+$/.test(param) ? (Number(param) < 4 ? Number(param) : null) : (SKILL_IDS.get(param) ?? null));
const resolve = createPropertyLayerResolver(properties, statIndex, skillId);
const mod = (code: string, min: number, max: number, param: string | null = null): ModInput => ({ code, param, min, max });

describe('createPropertyLayerResolver', () => {
  it('func 10: the properties.txt tab number from the param, else the slot val', () => {
    expect(resolve(mod('skilltab', 1, 2, '20'))).toEqual({ layers: [{ stat: 1, param: 50 }], warnings: [] });
    expect(resolve(mod('war-tab-rand', 1, 1)).layers).toEqual([
      { stat: 1, param: 56 },
      { stat: 1, param: 57 },
    ]);
    expect(resolve(mod('skilltab', 1, 1, '30')).warnings).toEqual(['"skilltab" 30: skill tab 30 is not a class tab']);
  });

  it('func 21: the class from val; func 36: every class of min–max', () => {
    expect(resolve(mod('sor', 1, 1)).layers).toEqual([{ stat: 2, param: 1 }]);
    expect(resolve(mod('randclassskill', 0, 2)).layers.map((layer) => layer.param)).toEqual([0, 1, 2]);
    expect(resolve(mod('randclassskill', 7, 8)).warnings).toEqual(['"randclassskill": class id 8 is not a class']);
  });

  it('func 22/24: the skill id of a name or numeric param, without the _display companion', () => {
    expect(resolve(mod('skill', 1, 3, 'Fire Bolt')).layers).toEqual([{ stat: 3, param: 2 }]);
    expect(resolve(mod('oskill', 1, 1, '3')).layers).toEqual([{ stat: 4, param: 3 }]);
    expect(resolve(mod('aura', 5, 5, 'Nope'))).toEqual({ layers: [], warnings: ['"aura" Nope: unknown skill "Nope"'] });
  });

  it('func 12: every skill id of min–max, nothing for ranges above 64', () => {
    expect(resolve(mod('skill-rand', 1, 3, '2')).layers.map((layer) => layer.param)).toEqual([1, 2, 3]);
    expect(resolve(mod('skill-rand', 418, 697, '3'))).toEqual({ layers: [], warnings: [] });
  });

  it('func 11/19: skill << 6 | level (max), warning for level 0 and skill ids above 1023', () => {
    expect(resolve(mod('hit-skill', 10, 5, 'Fire Bolt')).layers).toEqual([{ stat: 6, param: 2 * 64 + 5 }]);
    expect(resolve(mod('charged', 20, 3, 'Teleport')).layers).toEqual([{ stat: 7, param: 3 * 64 + 3 }]);
    expect(resolve(mod('hit-skill', 10, 0, 'Teleport')).warnings).toEqual(['"hit-skill" Teleport: level 0 outside 1-63']);
    expect(resolve(mod('hit-skill', 10, 1, 'Long Shot')).warnings).toEqual([
      '"hit-skill" Long Shot: skill id 1555 above 1023 does not fit a stat param (skill << 6 | level)',
    ]);
  });

  it('skips plain stats, hidden companions and unknown properties; warns for an unread func', () => {
    expect(resolve(mod('str', 5, 5))).toEqual({ layers: [], warnings: [] });
    expect(resolve(mod('hit-skill-hidden', 10, 0, 'Long Shot'))).toEqual({ layers: [], warnings: [] });
    expect(resolve(mod('some-group', 1, 1))).toEqual({ layers: [], warnings: [] });
    expect(resolve(mod('odd', 1, 1)).warnings).toEqual(['"odd": func 1 on layered stat "item_singleskill" is not read']);
  });
});

describe('propertyGroupSources', () => {
  it('lists every entry, one per param of a numeric range', () => {
    const groups = new Map<string, PropertyGroupDef>([
      [
        'tabs',
        {
          code: 'tabs',
          pickMode: 1,
          entries: [
            { prop: 'skilltab', parMin: '21', parMax: '23', modMin: 1, modMax: 2, chance: 1 },
            { prop: 'str', parMin: '', parMax: '', modMin: 5, modMax: 5, chance: 1 },
          ],
        },
      ],
    ]);
    expect(propertyGroupSources(groups)).toEqual([
      {
        label: 'propertygroup tabs',
        mods: [mod('skilltab', 1, 2, '21'), mod('skilltab', 1, 2, '22'), mod('skilltab', 1, 2, '23'), mod('str', 5, 5)],
      },
    ]);
  });
});

describe('setBonusSources', () => {
  it('reads the partial and full set bonuses of every set but the retired ones', () => {
    const sets = table([
      [
        'index',
        'PCode2a',
        'PParam2a',
        'PMin2a',
        'PMax2a',
        'PCode3b',
        'PParam3b',
        'PMin3b',
        'PMax3b',
        'FCode1',
        'FParam1',
        'FMin1',
        'FMax1',
      ],
      ['Waves', 'hit-skill', 'Bone Wave', '5', '30', '', '', '', '', 'str', '', '10', '10'],
      ['Old_old', 'oskill', 'Teleport', '1', '1', '', '', '', '', '', '', '', ''],
      ['Bare', '', '', '', '', 'oskill', 'Fire Bolt', '2', '2', '', '', '', ''],
    ]);
    expect(setBonusSources(sets)).toEqual([
      { label: 'set bonus Waves', mods: [mod('hit-skill', 5, 30, 'Bone Wave'), mod('str', 10, 10)] },
      { label: 'set bonus Bare', mods: [mod('oskill', 2, 2, 'Fire Bolt')] },
    ]);
  });
});

describe('buildLootFilterSkills', () => {
  // The mock stat tables: 0 Attack, 1 Critical Strike (ama), 2 Fire Bolt (sor), 3 Teleport (sor)
  const lookup = createSkillLookup(testTables(), TEST_STRINGS);
  const skills = table([
    ['skill', 'charclass', 'skilldesc'],
    ['Attack', '', 'attack'],
    ['Critical Strike', 'ama', 'critical strike'],
    ['Fire Bolt', 'sor', 'fire bolt'],
    ['Teleport', 'sor', 'teleport'],
  ]);
  const skilldesc = table([
    ['skilldesc', 'SkillPage'],
    ['attack', '0'],
    ['critical strike', '1'],
    ['fire bolt', '2'],
    ['teleport', '0'],
  ]);
  const build = (sources: LayerSource[]) =>
    buildLootFilterSkills({
      skills,
      skilldesc,
      itemstatcost,
      lookup,
      layers: createPropertyLayerResolver(properties, statIndex, lookup.skillId),
      sources,
    });

  it('lists the class tree skills and the skills the sources name, by id, with their class', () => {
    const { bundle } = build([
      { label: 'unique A', mods: [mod('oskill', 1, 1, 'Teleport'), mod('hit-skill', 5, 4, 'Attack')] },
      { label: 'set B', mods: [mod('sor', 1, 1), mod('skilltab', 1, 1, '3')] },
    ]);
    expect(bundle.skills).toEqual([
      { id: 0, name: 'Attack' },
      { id: 1, name: 'Critical Strike', cls: 'ama' },
      { id: 2, name: 'Fire Bolt', cls: 'sor' },
      { id: 3, name: 'Teleport', cls: 'sor' },
    ]);
  });

  it('collects the distinct known params of the skill, event and charged stats, sorted', () => {
    const { bundle } = build([
      {
        label: 'unique A',
        mods: [mod('charged', 20, 5, 'Teleport'), mod('hit-skill', 5, 4, 'Fire Bolt'), mod('oskill', 1, 1, 'Teleport')],
      },
      { label: 'unique B', mods: [mod('hit-skill', 5, 2, 'Fire Bolt'), mod('hit-skill', 5, 4, 'Fire Bolt'), mod('skill', 1, 1, '1')] },
      { label: 'affix p1', mods: [mod('sor', 1, 1), mod('skilltab', 1, 1, '3')] },
    ]);
    expect(bundle.knownLayers).toEqual([
      { stat: 3, layers: [1] },
      { stat: 4, layers: [3] },
      { stat: 6, layers: [2 * 64 + 2, 2 * 64 + 4] },
      { stat: 7, layers: [3 * 64 + 5] },
    ]);
  });

  it('warns once per message with the source label, and for layered-looking stats missing from STAT_LAYER_KINDS', () => {
    const { warnings } = build([{ label: 'runeword X', mods: [mod('hit-skill', 5, 0, 'Teleport'), mod('hit-skill', 5, 0, 'Teleport')] }]);
    expect(warnings).toEqual([
      'lootfilter skills: stat 9 "item_skillonnewthing" (Encode 2, descfunc 15) is not in STAT_LAYER_KINDS',
      'lootfilter skills: runeword X: "hit-skill" Teleport: level 0 outside 1-63',
    ]);
  });
});

describe('createSkillLookup().skillId', () => {
  const lookup = createSkillLookup(testTables(), TEST_STRINGS);
  it('finds a skill by name (any case) or row id', () => {
    expect(lookup.skillId('Fire Bolt')).toBe(2);
    expect(lookup.skillId('teleport')).toBe(3);
    expect(lookup.skillId('1')).toBe(1);
    expect(lookup.skillId('4')).toBeNull();
    expect(lookup.skillId('Nope')).toBeNull();
  });
});

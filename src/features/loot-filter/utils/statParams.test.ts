import { describe, expect, it } from 'vitest';
import { filterPickerOptions } from './pickerSearch';
import {
  anyKnownLevelChecks,
  buildStatParamData,
  className,
  classOptions,
  EMPTY_STAT_PARAMS,
  knownLevels,
  noParamEntryHint,
  sameParamEncoding,
  skillLabel,
  skillOptions,
  statParamKind,
  statParamLabel,
  tabOptions,
} from './statParams';
import { TEST_DATA, TEST_TYPES } from './testLookup.mock';

const params = buildStatParamData(TEST_DATA, TEST_TYPES);

describe('buildStatParamData', () => {
  it('knows the layered stats by id and by name, a name also without the data', () => {
    expect(statParamKind(188, params)).toBe('tab');
    expect(statParamKind(83, params)).toBe('class');
    expect(statParamKind(204, params)).toBe('charged');
    expect(statParamKind(0, params)).toBeUndefined();
    expect(statParamKind('item_skillonhit', EMPTY_STAT_PARAMS)).toBe('event');
    expect(statParamKind(198, EMPTY_STAT_PARAMS)).toBeUndefined();
  });

  it('puts the classes in class id order and keeps the known layers per stat', () => {
    expect(params.classes.map((info) => info?.code)).toEqual(['ama', 'sor', undefined, undefined, undefined, undefined, 'ass', undefined]);
    expect(className('ass', params)).toBe('Assassin');
    expect(params.knownLayers.get(107)).toEqual([47, 258]);
  });

  it('names a skill with its id when several skills share the name', () => {
    expect(skillLabel(47, params)).toBe('Fire Ball');
    expect(skillLabel(124, params)).toBe('Chain Lightning #124');
    expect(skillLabel(1, params)).toBeUndefined();
  });
});

describe('statParamLabel', () => {
  it('names tabs, classes, skills and skill levels', () => {
    expect(statParamLabel('tab', 0, params)).toBe('Bow and Crossbow Skills (Amazon)');
    expect(statParamLabel('tab', 50, params)).toBe('Martial Arts (Assassin)');
    expect(statParamLabel('class', 6, params)).toBe('Assassin');
    expect(statParamLabel('skill', 472, params)).toBe('Orb of Winter');
    expect(statParamLabel('event', (472 << 6) | 13, params)).toBe('Orb of Winter lvl 13');
    expect(statParamLabel('charged', (36 << 6) | 3, params)).toBe('Fire Bolt lvl 3');
  });

  it('is undefined for params that do not decode or that the data does not name', () => {
    // 21 is the properties.txt tab number, not a layer; tab 3 does not exist; class 2 is not in the test data
    expect(statParamLabel('tab', 21, params)).toBeUndefined();
    expect(statParamLabel('tab', 3, params)).toBeUndefined();
    expect(statParamLabel('class', 2, params)).toBeUndefined();
    // Level 0
    expect(statParamLabel('event', 472 << 6, params)).toBeUndefined();
    expect(statParamLabel('skill', 47, EMPTY_STAT_PARAMS)).toBeUndefined();
  });
});

describe('picker options', () => {
  it('lists every tab by class with the layer as value, found by class or tab name', () => {
    const tabs = tabOptions(params);
    expect(tabs.map((option) => option.value)).toEqual(['0', '1', '2', '8', '9', '10', '48', '49', '50']);
    expect(tabs.find((option) => option.value === '50')).toMatchObject({ label: 'Martial Arts', group: 'Assassin', detail: '50' });
    expect(filterPickerOptions(tabs, 'martial').matches.map((option) => option.value)).toEqual(['50']);
    expect(filterPickerOptions(tabs, 'assassin').matches).toHaveLength(3);
    expect(tabOptions(EMPTY_STAT_PARAMS)).toEqual([]);
  });

  it('lists the classes by class id', () => {
    expect(classOptions(params).map((option) => [option.value, option.label])).toEqual([
      ['0', 'Amazon'],
      ['1', 'Sorceress'],
      ['6', 'Assassin'],
    ]);
  });

  it('keeps class skills by class for skill stats, with "on items" in the detail', () => {
    // 97: nothing known in the test data; class skills by class, then the others
    expect(skillOptions(97, 'skill', params).map((option) => [option.value, option.group])).toEqual([
      ['166', 'Sorceress'],
      ['47', 'Sorceress'],
      ['36', 'Sorceress'],
      ['472', 'Sorceress'],
      ['258', 'Assassin'],
      ['124', 'Other skills'],
      ['500', 'Other skills'],
    ]);
    const single = skillOptions(107, 'skill', params);
    // item_singleskill: class skills only, the known ones marked
    expect(single.map((option) => [option.value, option.group])).toEqual([
      ['166', 'Sorceress'],
      ['47', 'Sorceress'],
      ['36', 'Sorceress'],
      ['472', 'Sorceress'],
      ['258', 'Assassin'],
    ]);
    expect(single[1]).toMatchObject({ label: 'Fire Ball', detail: '#47 · Sorceress · on items' });
    expect(filterPickerOptions(single, 'assassin').matches.map((option) => option.value)).toEqual(['258']);
    // A non-class skill on items gets its own group
    const withNova = buildStatParamData({ ...TEST_DATA, knownLayers: [{ stat: 97, layers: [500] }] }, TEST_TYPES);
    expect(
      skillOptions(97, 'skill', withNova)
        .slice(-2)
        .map((option) => [option.value, option.group])
    ).toEqual([
      ['500', 'On items'],
      ['124', 'Other skills'],
    ]);
  });

  it('shows the known levels of event skills on items', () => {
    const options = skillOptions(198, 'event', params);
    expect(options.slice(0, 2).map((option) => [option.label, option.group, option.detail])).toEqual([
      ['Fire Bolt', 'On items', '#36 · Sorceress · lvl 3'],
      ['Orb of Winter', 'On items', '#472 · Sorceress · lvl 13, 25'],
    ]);
    expect(filterPickerOptions(options, 'orb of winter').matches.map((option) => option.value)).toEqual(['472']);
  });
});

describe('known levels', () => {
  it('decodes the levels of a skill and writes one check per level', () => {
    expect(knownLevels(198, 472, params)).toEqual([13, 25]);
    expect(knownLevels(198, 47, params)).toEqual([]);
    expect(knownLevels(undefined, 472, params)).toEqual([]);
    const check = { stat: 'item_skillonhit', param: (472 << 6) | 13, op: '>=', value: 1 } as const;
    expect(anyKnownLevelChecks(check, 198, 472, params)).toEqual([
      { ...check, param: (472 << 6) | 13 },
      { ...check, param: (472 << 6) | 25 },
    ]);
  });

  it('keeps a param across stats of the same encoding only', () => {
    expect(sameParamEncoding('event', 'charged')).toBe(true);
    expect(sameParamEncoding('skill', 'skill')).toBe(true);
    expect(sameParamEncoding(undefined, undefined)).toBe(true);
    expect(sameParamEncoding('tab', 'class')).toBe(false);
    expect(sameParamEncoding('skill', undefined)).toBe(false);
  });
});

describe('noParamEntryHint', () => {
  it('says a Test tab entry without param is param 0', () => {
    expect(noParamEntryHint('tab', params)).toBe(
      'No param: the test takes this entry as param 0 (Bow and Crossbow Skills (Amazon)). Pick the skill tab the item has.'
    );
    expect(noParamEntryHint('event', params)).toBe(
      'No param: the test takes this entry as param 0. Pick the skill and level the item has.'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { buildStatParamData, className, EMPTY_STAT_PARAMS, skillLabel, statParamKind, statParamLabel } from './statParams';
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

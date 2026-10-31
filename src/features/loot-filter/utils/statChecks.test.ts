import {
  exceptionOf,
  expandsAcrossLevels,
  formatStatCheck,
  invertStatCheck,
  newExceptionCheck,
  newStatCheck,
  readsExceptions,
  ruleExceptions,
  parseStatInput,
  removeStatCheck,
  replaceStatCheck,
  replaceStatCheckWithMany,
  setStatOp,
  setStatParam,
  setStatValue,
} from './statChecks';
import { EMPTY_LOOKUP } from './lookup';
import { TEST_LOOKUP } from './testLookup.mock';

describe('stat check helpers', () => {
  it('starts a row with no stat, >= 1', () => {
    expect(newStatCheck('strength')).toEqual({ stat: 'strength', op: '>=', value: 1 });
  });

  it('reads a typed stat as an id or a name', () => {
    expect(parseStatInput(' 194 ')).toBe(194);
    expect(parseStatInput('item_numsockets')).toBe('item_numsockets');
    expect(parseStatInput('  ')).toBeNull();
    expect(parseStatInput('-1')).toBe('-1');
  });

  it('turns the value into a pair for between and back', () => {
    const between = setStatOp({ stat: 'strength', value: 5 }, 'between');
    expect(between).toEqual({ stat: 'strength', op: 'between', value: [5, 5] });
    expect(setStatOp({ stat: 'strength', op: 'between', value: [3, 9] }, '<')).toEqual({ stat: 'strength', op: '<', value: 3 });
  });

  it('sets values, params and rows', () => {
    expect(setStatValue({ stat: 0, value: [1, 2] }, 1, 8)).toEqual({ stat: 0, value: [1, 8] });
    expect(setStatValue({ stat: 0, value: 1 }, 0, 4)).toEqual({ stat: 0, value: 4 });
    expect(setStatParam({ stat: 0, param: 3, value: 1 }, undefined)).toEqual({ stat: 0, value: 1 });
    expect(setStatParam({ stat: 0, value: 1 }, 2)).toEqual({ stat: 0, value: 1, param: 2 });
    const list = [
      { stat: 0, value: 1 },
      { stat: 1, value: 2 },
    ];
    expect(replaceStatCheck(list, 1, { stat: 2, value: 3 })).toEqual([list[0], { stat: 2, value: 3 }]);
    expect(removeStatCheck(list, 0)).toEqual([list[1]]);
    expect(removeStatCheck([list[0]], 0)).toBeUndefined();
  });

  it('formats a check with the stat name when known', () => {
    expect(formatStatCheck({ stat: 194, op: '>=', value: 2 }, TEST_LOOKUP)).toBe('item_numsockets ≥2');
    expect(formatStatCheck({ stat: 194, value: 2 }, EMPTY_LOOKUP)).toBe('#194 ≥2');
    expect(formatStatCheck({ stat: 'strength', param: 1, op: 'between', value: [5, 10] }, TEST_LOOKUP)).toBe('strength[1] 5–10');
    expect(formatStatCheck({ stat: '', op: '==', value: 0 }, TEST_LOOKUP)).toBe('? ==0');
  });

  it('names the param of a layered stat when the data does', () => {
    expect(formatStatCheck({ stat: 'item_addskill_tab', param: 50, value: 1 }, TEST_LOOKUP)).toBe(
      'item_addskill_tab[Martial Arts (Assassin)] ≥1'
    );
    expect(formatStatCheck({ stat: 198, param: 30221, value: 1 }, TEST_LOOKUP)).toBe('item_skillonhit[Orb of Winter lvl 13] ≥1');
    // Duplicate skill names carry the id; an unknown or undecodable param stays a number
    expect(formatStatCheck({ stat: 107, param: 166, value: 1 }, TEST_LOOKUP)).toBe('item_singleskill[Chain Lightning #166] ≥1');
    expect(formatStatCheck({ stat: 188, param: 21, value: 1 }, TEST_LOOKUP)).toBe('item_addskill_tab[21] ≥1');
    expect(formatStatCheck({ stat: 'item_addskill_tab', param: 50, value: 1 }, EMPTY_LOOKUP)).toBe('item_addskill_tab[50] ≥1');
  });
});

describe('any known level', () => {
  const a = { stat: 'a', value: 1 };
  const b = { stat: 'b', value: 1 };
  it('replaces one row with several in its place', () => {
    const levels = [
      { stat: 'x', param: 1, value: 1 },
      { stat: 'x', param: 2, value: 1 },
    ];
    expect(replaceStatCheckWithMany([a, { stat: 'x', value: 1 }, b], 1, levels)).toEqual([a, ...levels, b]);
  });

  it('expands a presence check in an any-of list and an exception check in an all-of list', () => {
    expect(expandsAcrossLevels({ stat: 'x', value: 1 }, true)).toBe(true);
    expect(expandsAcrossLevels({ stat: 'x', op: 'between', value: [1, 2] }, false)).toBe(false);
    expect(expandsAcrossLevels({ stat: 'x', op: '<', value: 1 }, false)).toBe(true);
    expect(expandsAcrossLevels({ stat: 'x', op: '!=', value: 1 }, true)).toBe(false);
  });
});

describe('exceptions on hide rules', () => {
  it('inverts every op but between, keeping stat and param', () => {
    const pairs = [
      ['>=', '<'],
      ['>', '<='],
      ['==', '!='],
      ['!=', '=='],
      ['<', '>='],
      ['<=', '>'],
    ] as const;
    for (const [op, inverse] of pairs) {
      expect(invertStatCheck({ stat: 'strength', param: 2, op, value: 5 })).toEqual({ stat: 'strength', param: 2, op: inverse, value: 5 });
    }
    expect(invertStatCheck({ stat: 0, value: 1 })).toEqual({ stat: 0, op: '<', value: 1 });
    expect(invertStatCheck({ stat: 0, op: 'between', value: [1, 5] })).toBeUndefined();
  });

  it('round-trips: inverting twice gives the check back (with an explicit op)', () => {
    const check = { stat: 'item_demondamage_percent', op: '>=', value: 1 } as const;
    const inverted = invertStatCheck(check);
    expect(inverted).toEqual(newExceptionCheck('item_demondamage_percent'));
    expect(inverted === undefined ? undefined : invertStatCheck(inverted)).toEqual(check);
  });

  it('reads <, <= and != checks as exceptions, the others as plain conditions', () => {
    expect(exceptionOf({ stat: 0, op: '<', value: 1 })).toEqual({ stat: 0, op: '>=', value: 1 });
    expect(exceptionOf({ stat: 0, op: '<=', value: 4 })).toEqual({ stat: 0, op: '>', value: 4 });
    expect(exceptionOf({ stat: 0, op: '!=', value: 3 })).toEqual({ stat: 0, op: '==', value: 3 });
    for (const op of ['>=', '>', '==', 'between'] as const) {
      expect(exceptionOf({ stat: 0, op, value: op === 'between' ? [1, 2] : 1 })).toBeUndefined();
    }
    expect(exceptionOf({ stat: 0, value: 1 })).toBeUndefined();
  });

  it('collects a hide rule’s exceptions: any from itemStats, all from itemStatsAnyOf only when every check there is one', () => {
    const plain = { stat: 'item_numsockets', op: '>=', value: 1 } as const;
    expect(
      ruleExceptions({
        itemStats: [plain, newExceptionCheck('item_demondamage_percent')],
        itemStatsAnyOf: [newExceptionCheck('a'), { stat: 'b', op: '<=', value: 2 }],
      })
    ).toEqual({
      any: [{ stat: 'item_demondamage_percent', op: '>=', value: 1 }],
      all: [
        { stat: 'a', op: '>=', value: 1 },
        { stat: 'b', op: '>', value: 2 },
      ],
      mixedAll: false,
    });
    expect(ruleExceptions({ itemStatsAnyOf: [plain, newExceptionCheck('a')] })).toEqual({ any: [], all: [], mixedAll: true });
    expect(ruleExceptions({})).toEqual({ any: [], all: [], mixedAll: false });
  });

  it('reads exceptions only on rules that hide without "hide if other conditions fail"', () => {
    expect(readsExceptions({ hide: true })).toBe(true);
    expect(readsExceptions({ hide: true, hideIfOtherConditionsFail: false })).toBe(true);
    expect(readsExceptions({ hide: true, hideIfOtherConditionsFail: true })).toBe(false);
    expect(readsExceptions({ hideIfOtherConditionsFail: true })).toBe(false);
    expect(readsExceptions({})).toBe(false);
  });
});

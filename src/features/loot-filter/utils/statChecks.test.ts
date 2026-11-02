import { EMPTY_LOOT_FILTER_REFERENCE } from '../engine/reference';
import type { LootFilterReference, StatCheck } from '../engine/types';
import {
  EXCEPTION_ROW_OPS,
  exceptionOf,
  exceptionPlacement,
  expandsAcrossLevels,
  isExceptionCheck,
  moveExceptions,
  plainCheckCount,
  ruleStatQuirk,
  statCheckRows,
  storedException,
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

describe('the Except control owns a hide rule’s exception rows', () => {
  const plain = { stat: 'item_numsockets', op: '>=', value: 1 } as const;
  const teleport = newExceptionCheck('item_singleskill');
  const demon = newExceptionCheck('item_demondamage_percent');

  it('tells exception checks from plain ones', () => {
    expect(isExceptionCheck(teleport)).toBe(true);
    expect(isExceptionCheck({ stat: 0, op: '!=', value: 3 })).toBe(true);
    expect(isExceptionCheck(plain)).toBe(false);
    expect(isExceptionCheck({ stat: 0, value: 1 })).toBe(false);
    expect(plainCheckCount([plain, teleport, { stat: 0, op: 'between', value: [1, 2] }])).toBe(2);
    expect(plainCheckCount(undefined)).toBe(0);
  });

  it('shows an exception in its natural form and stores the opposite of every row op', () => {
    expect(invertStatCheck(teleport)).toEqual({ stat: 'item_singleskill', op: '>=', value: 1 });
    for (const op of EXCEPTION_ROW_OPS) {
      const shown: StatCheck = { stat: 'x', param: 54, op, value: 3 };
      const stored = storedException(shown);
      expect(isExceptionCheck(stored)).toBe(true);
      expect(invertStatCheck(stored)).toEqual(shown);
    }
    // A shown row without op is `>= 1`
    expect(storedException({ stat: 'x', value: 1 })).toEqual({ stat: 'x', op: '<', value: 1 });
  });

  it('maps the shown rows back to their place in the full list', () => {
    const list = [plain, teleport, { stat: 'b', op: '>', value: 2 } as const, demon];
    expect(statCheckRows(list, isExceptionCheck)).toEqual([
      { check: teleport, index: 1 },
      { check: demon, index: 3 },
    ]);
    const plainRows = statCheckRows(list, (check) => !isExceptionCheck(check));
    expect(plainRows.map((row) => row.index)).toEqual([0, 2]);
    // Editing the second shown exception (in natural form) changes only its own place
    const [, second] = statCheckRows(list, isExceptionCheck);
    expect(replaceStatCheck(list, second.index, storedException({ stat: 'item_demondamage_percent', op: '>=', value: 5 }))).toEqual([
      plain,
      teleport,
      list[2],
      { stat: 'item_demondamage_percent', op: '<', value: 5 },
    ]);
    expect(removeStatCheck(list, plainRows[1].index)).toEqual([plain, teleport, demon]);
    expect(statCheckRows(undefined, isExceptionCheck)).toEqual([]);
  });

  it('reads the mode from where the exceptions are', () => {
    expect(exceptionPlacement({})).toBeUndefined();
    expect(exceptionPlacement({ itemStats: [plain], itemStatsAnyOf: [plain] })).toBeUndefined();
    expect(exceptionPlacement({ itemStats: [plain, teleport] })).toBe('any');
    expect(exceptionPlacement({ itemStats: [plain], itemStatsAnyOf: [teleport] })).toBe('all');
    expect(exceptionPlacement({ itemStats: [demon], itemStatsAnyOf: [teleport] })).toBe('both');
  });

  it('moves every exception to the other list in order, leaving the plain checks', () => {
    expect(moveExceptions({ itemStats: [teleport, plain, demon] }, 'all')).toEqual({
      itemStats: [plain],
      itemStatsAnyOf: [teleport, demon],
    });
    expect(moveExceptions({ itemStats: [teleport, demon] }, 'all')).toEqual({ itemStats: undefined, itemStatsAnyOf: [teleport, demon] });
    expect(moveExceptions({ itemStats: [plain], itemStatsAnyOf: [demon, teleport] }, 'any')).toEqual({
      itemStats: [plain, demon, teleport],
      itemStatsAnyOf: undefined,
    });
  });

  it('gathers exceptions from both lists into the picked one', () => {
    expect(moveExceptions({ itemStats: [demon], itemStatsAnyOf: [teleport] }, 'any')).toEqual({
      itemStats: [demon, teleport],
      itemStatsAnyOf: undefined,
    });
    expect(moveExceptions({ itemStats: [demon], itemStatsAnyOf: [teleport] }, 'all')).toEqual({
      itemStats: undefined,
      itemStatsAnyOf: [teleport, demon],
    });
  });

  it('changes nothing when there is nothing to move', () => {
    expect(moveExceptions({}, 'all')).toEqual({});
    expect(moveExceptions({ itemStats: [plain], itemStatsAnyOf: [teleport] }, 'all')).toEqual({});
    expect(moveExceptions({ itemStats: [teleport] }, 'any')).toEqual({});
  });
});

describe('stat quirks on a rule', () => {
  const reference: LootFilterReference = {
    ...EMPTY_LOOT_FILTER_REFERENCE,
    itemCodeTypes: new Map([
      ['hax', new Set(['axe', 'weap'])],
      ['jew', new Set(['jewl', 'misc'])],
    ]),
  };
  const ed = { stat: 'item_maxdamage_percent', value: 1 };

  it('shows a quirk only when the rule can match an affected item', () => {
    expect(ruleStatQuirk(ed, { itemTypes: ['weap'] }, reference)?.headline).toBe(
      'Currently only works on jewels and charms (reads 0 on weapons)'
    );
    expect(ruleStatQuirk({ stat: 17, value: 1 }, {}, reference)?.confirmed).toBe(true);
    expect(ruleStatQuirk(ed, { itemCodes: ['jew'] }, reference)).toBeUndefined();
    expect(ruleStatQuirk({ stat: 'item_numsockets', value: 1 }, {}, reference)).toBeUndefined();
  });

  it('shows it always without item data, softer for the untested durability quirk', () => {
    expect(ruleStatQuirk(ed, { itemCodes: ['jew'] }, EMPTY_LOOT_FILTER_REFERENCE)).toBeDefined();
    expect(ruleStatQuirk({ stat: 75, value: 1 }, {}, undefined)?.confirmed).toBe(false);
  });
});

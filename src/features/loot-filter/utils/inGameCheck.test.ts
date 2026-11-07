import { evaluateFilter, type TestItem } from '../engine/evaluate';
import { parseLootFilter } from '../engine/parse';
import type { LootFilter, LootFilterRule } from '../engine/types';
import {
  checkedStats,
  checkText,
  IN_GAME_CHECK_MARK,
  inGameCheckRule,
  isInGameCheckRule,
  NO_STATS_REASON,
  wrongShapeReason,
} from './inGameCheck';
import { EMPTY_LOOKUP } from './lookup';
import { TEST_LOOKUP } from './testLookup.mock';

function filterOf(rules: readonly LootFilterRule[], extra: Partial<LootFilter> = {}): LootFilter {
  return { formatVersion: 1, rules, leadingComments: [], ...extra };
}

describe('checkedStats and checkText', () => {
  it('lists every stat of the four lists once per stat and param, by id, with short labels', () => {
    const rule: LootFilterRule = {
      itemStats: [
        { stat: 'item_numsockets', op: '>=', value: 2 },
        { stat: 194, op: '<', value: 5 },
        { stat: 'item_addskill_tab', param: 8, value: 1 },
      ],
      itemStatsAnyOf: [
        { stat: 188, param: 50, value: 1 },
        { stat: 'strength', op: '<', value: 1 },
      ],
      playerStats: [{ stat: 'strength', op: '>=', value: 10 }],
    };
    const stats = checkedStats(rule, TEST_LOOKUP);
    expect(stats.map((stat) => stat.label)).toEqual(['Sock', 'Tab:8', 'Tab:50', 'Str', 'Char Str']);
    expect(checkText(stats)).toBe('[Sock {stat:194} | Tab:8 {stat:188,8} | Tab:50 {stat:188,50} | Str {stat:0} | Char Str {playerStat:0}]');
    expect(stats[1]?.description).toBe('item_addskill_tab (188) param 8 Fire Skills (Sorceress)');
  });

  it('keeps the stat name without game data, and strips item_ from unknown labels', () => {
    const stats = checkedStats(
      {
        itemStats: [
          { stat: 'item_fastercastrate', value: 20 },
          { stat: 'item_new_stat', value: 1 },
          { stat: 999, value: 1 },
        ],
      },
      EMPTY_LOOKUP
    );
    expect(checkText(stats)).toBe('[FCR {stat:item_fastercastrate} | new_stat {stat:item_new_stat} | #999 {stat:999}]');
  });
});

describe('inGameCheckRule', () => {
  const source: LootFilterRule = {
    itemTypes: ['weap'],
    quality: ['magic', 'rare'],
    location: ['onGround', 'stored'],
    activeInLevels: [1, 2],
    itemStats: [{ stat: 'item_maxdamage_percent', op: '<', value: 1 }],
    hide: true,
    hideIfOtherConditionsFail: true,
    sound: 'x.mp3',
    comment: 'hide magic weapons without ED',
  };

  it('copies the conditions but not the stat checks or actions, and prints the values in a name prefix', () => {
    const result = inGameCheckRule(filterOf([{ itemCodes: ['r33'] }, source]), 1, EMPTY_LOOKUP);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.field).toBe('namePrefix');
    expect(result.rule).toEqual({
      itemTypes: ['weap'],
      quality: ['magic', 'rare'],
      location: ['onGround', 'stored'],
      activeInLevels: [1, 2],
      namePrefix: '[ED {stat:item_maxdamage_percent}] ',
      comment: `${IN_GAME_CHECK_MARK} for the rule below: compare these numbers with the item tooltip, then delete this rule. ED = item_maxdamage_percent`,
    });
    expect(isInGameCheckRule(result.rule)).toBe(true);
    expect(isInGameCheckRule(source)).toBe(false);
    // Test rules made before the wording dropped the rule number are still recognised.
    expect(isInGameCheckRule({ comment: 'In-game check for rule 3 (the rule below): compare these numbers' })).toBe(true);
  });

  it('uses the suffix when the rule or its style sets a prefix, and a chat line when it sets both', () => {
    const styled = filterOf([{ ...source, useStyle: 'S', hide: undefined }], { styles: { S: { namePrefix: 'ÿc1' } } });
    const suffix = inGameCheckRule(styled, 0, TEST_LOOKUP);
    expect(suffix.ok && suffix.field).toBe('nameSuffix');
    expect(suffix.ok && suffix.rule.nameSuffix).toBe(' [ED {stat:item_maxdamage_percent}]');

    const both = inGameCheckRule(filterOf([{ ...source, namePrefix: 'a', nameSuffix: 'b' }]), 0, TEST_LOOKUP);
    expect(both.ok && both.rule.chatMessage).toBe('{name} [ED {stat:item_maxdamage_percent}]');
  });

  it('refuses a rule without stat checks', () => {
    expect(inGameCheckRule(filterOf([{ itemCodes: ['r33'], hide: true }]), 0, TEST_LOOKUP)).toEqual({ ok: false, reason: NO_STATS_REASON });
    expect(inGameCheckRule(filterOf([]), 0, TEST_LOOKUP).ok).toBe(false);
  });

  it('refuses a rule with wrong-shaped keys, which the copy would leave out', () => {
    const wrong: LootFilterRule = { ...source, passthrough: { sockets: 'two' } };
    expect(inGameCheckRule(filterOf([wrong]), 0, TEST_LOOKUP)).toEqual({ ok: false, reason: wrongShapeReason(['sockets']) });
    expect(wrongShapeReason(['activeInLevels'])).toBe('This rule has a wrong-shaped key (activeInLevels); fix it first.');
    expect(wrongShapeReason(['sockets', 'sound'])).toBe('This rule has wrong-shaped keys (sockets, sound); fix it first.');
    // A wrong-shaped comment does not count (the plugin ignores comments), nor does an unknown key.
    expect(inGameCheckRule(filterOf([{ ...source, passthrough: { comment: 1, highlight: 'x' } }]), 0, TEST_LOOKUP).ok).toBe(true);
  });

  it('accepts a rule whose file wrote a single-number activeInLevels, keeping the level', () => {
    const { filter } = parseLootFilter(
      JSON.stringify({
        formatVersion: 1,
        filterLevels: [{ id: 4, name: 'Maps' }],
        rules: [{ itemTypes: ['weap'], activeInLevels: 4, itemStats: [{ stat: 'item_maxdamage_percent', op: '<', value: 1 }], hide: true }],
      })
    );
    const result = inGameCheckRule(filter, 0, TEST_LOOKUP);
    expect(result.ok).toBe(true);
    expect(result.ok && result.rule.activeInLevels).toEqual([4]);
  });

  it('changes nothing but the name when inserted before its rule', () => {
    const rule: LootFilterRule = { itemCodes: ['r33'], itemStats: [{ stat: 194, op: '>=', value: 2 }], labelBackground: [1, 2, 3] };
    const filter = filterOf([rule]);
    const result = inGameCheckRule(filter, 0, TEST_LOOKUP);
    if (!result.ok) throw new Error(result.reason);
    const item: TestItem = {
      code: 'r33',
      typeAncestors: ['rune', 'misc'],
      quality: 2,
      baseTier: null,
      itemLevel: 50,
      sockets: 1,
      maxSockets: 0,
      isFullySocketed: false,
      isEthereal: false,
      isIdentified: true,
      isRuneword: false,
      uniqueOrSetId: null,
      stats: [{ stat: 194, value: 1 }],
      name: 'Zod Rune',
      location: 'onGround',
    };
    const context = { playerStats: [], difficulty: 0, area: 2, filterLevel: 1, statIds: TEST_LOOKUP.statIds };
    const before = evaluateFilter(filter, item, context);
    const after = evaluateFilter({ ...filter, rules: [result.rule, rule] }, item, context);
    // The rule's check fails (1 socket), the test rule still prints the value.
    expect(before.matched).toBe(false);
    expect(after.name).toBe('[Sock 1] Zod Rune');
    expect({ ...after, trace: [], name: '', namePrefix: undefined, matched: false }).toEqual({
      ...before,
      trace: [],
      name: '',
      namePrefix: undefined,
    });
  });
});

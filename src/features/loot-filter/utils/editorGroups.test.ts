import { describe, expect, it } from 'vitest';
import { readLootFilter } from '../engine/parse';
import type { Diagnostic, LootFilterRule, LootFilterStyle, RuleActions, RuleConditions } from '../engine/types';
import { createBlankFilter } from './blankFilter';
import {
  ACTION_GROUP_OF,
  ACTION_GROUPS,
  actionGroupKeys,
  actionGroupSummary,
  actionGroupUsage,
  CONDITION_GROUP_OF,
  CONDITION_GROUPS,
  conditionGroupKeys,
  conditionGroupSummary,
  conditionGroupUsage,
  isBlankRule,
  setsCondition,
  type SummaryPart,
} from './editorGroups';
import { BASIC_ACTIONS, BASIC_CONDITIONS } from './ruleView';
import { TEST_LOOKUP } from './testLookup.mock';

const warning = (path: string): Diagnostic => ({ severity: 'warning', message: 'x', path });
const text = (summary: readonly SummaryPart[]) => summary.map((part) => part.text).join(' · ');

describe('group keys', () => {
  it('puts every condition and action key of the Basic / Advanced tables in exactly one group', () => {
    expect(Object.keys(CONDITION_GROUP_OF).sort()).toEqual(Object.keys(BASIC_CONDITIONS).sort());
    expect(Object.keys(ACTION_GROUP_OF).sort()).toEqual(Object.keys(BASIC_ACTIONS).sort());
    const conditionKeys = CONDITION_GROUPS.flatMap((group) => conditionGroupKeys(group.id));
    expect(new Set(conditionKeys).size).toBe(conditionKeys.length);
    const actionKeys = ACTION_GROUPS.flatMap((group) => actionGroupKeys(group.id));
    expect(new Set(actionKeys).size).toBe(actionKeys.length);
  });

  it('matches the editor sections', () => {
    expect(actionGroupKeys('visibility')).toEqual(['hide', 'show', 'hideIfOtherConditionsFail', 'chatMessageWhenHidden']);
    expect(actionGroupKeys('sound')).toEqual(['sound', 'soundVolume']);
    expect(conditionGroupKeys('whereWhen')).toEqual(['areas', 'excludeAreas', 'location', 'activeInLevels', 'difficulty']);
  });
});

describe('conditionGroupUsage', () => {
  it('counts a value, a wrong-shaped value and a diagnostic', () => {
    const rule: LootFilterRule = { itemCodes: ['r33'], passthrough: { quality: 'bogus' } };
    const usage = conditionGroupUsage(rule, [warning('rules/0/difficulty')]);
    expect([...usage.inUse].sort()).toEqual(['items', 'properties', 'whereWhen']);
    expect([...usage.flagged]).toEqual(['whereWhen']);
  });

  it('finds nothing on an empty rule', () => {
    expect(conditionGroupUsage({}).inUse.size).toBe(0);
  });
});

describe('actionGroupUsage', () => {
  const style: RuleActions = { sound: 'other.mp3', icon: { iconName: 'rune' } };

  it("counts a rule's own keys, its style's keys, passthrough and diagnostics", () => {
    const rule: LootFilterRule = { itemCodes: ['r33'], useStyle: 'MidRune', replaceName: 'ÿc4Pul', passthrough: { droplight: 3 } };
    const usage = actionGroupUsage({ actions: rule, style, diagnostics: [warning('rules/2/chatMessage')], owner: 'rule' });
    expect([...usage.inUse].sort()).toEqual(['chat', 'droplight', 'icon', 'name', 'sound', 'style']);
    expect([...usage.flagged]).toEqual(['chat']);
  });

  it("leaves a rule's comment out (it is edited above the conditions) and a style's in, under Notes", () => {
    expect(actionGroupUsage({ actions: { comment: 'x' }, owner: 'rule' }).inUse.size).toBe(0);
    const styleOwner: LootFilterStyle = { comment: 'x' };
    expect([...actionGroupUsage({ actions: styleOwner, owner: 'style' }).inUse]).toEqual(['notes']);
  });

  it('marks the new rule shape { show: true } as using Visibility only', () => {
    expect([...actionGroupUsage({ actions: { show: true }, owner: 'rule' }).inUse]).toEqual(['visibility']);
  });
});

describe('isBlankRule (items-first start)', () => {
  it('is blank for both new rule shapes: {} and { show: true }', () => {
    expect(isBlankRule({})).toBe(true);
    expect(isBlankRule({ show: true })).toBe(true);
    expect(isBlankRule({ show: true, comment: 'my rule' })).toBe(true);
  });

  it('is blank for a disabled blank rule (the enable flag is editor-only, not a condition)', () => {
    expect(isBlankRule({ disabled: true })).toBe(true);
    expect(isBlankRule({ disabled: true, itemCodes: ['r33'] })).toBe(false);
  });

  it('is not blank once any condition is set, items or not', () => {
    const conditions: RuleConditions[] = [{ itemCodes: ['r33'] }, { quality: 'unique' }, { itemLevel: { min: 1 } }, { activeInLevels: [] }];
    for (const rule of conditions) expect(isBlankRule(rule)).toBe(false);
  });

  it('is not blank when the rule already does something besides show', () => {
    expect(isBlankRule({ hide: true })).toBe(false);
    expect(isBlankRule({ useStyle: 'Rune' })).toBe(false);
    expect(isBlankRule({ sound: 'tink.mp3' })).toBe(false);
  });

  it('skips the items-first step for a third-party rule with unknown or wrong-shaped keys, or with a diagnostic', () => {
    expect(isBlankRule({ passthrough: { minLevel: 5 } })).toBe(false);
    expect(isBlankRule({ passthrough: { itemCodes: 'r33' } })).toBe(false);
    expect(isBlankRule({}, [warning('rules/0/sound')])).toBe(false);
  });

  it('stays blank with the whole-rule warning every new {} rule gets', () => {
    expect(isBlankRule({}, [{ ...warning('rules/4'), message: 'The rule has neither conditions nor actions', rule: 4 }])).toBe(true);
    expect(isBlankRule({ disabled: true }, [warning('disabledRules/0/rule')])).toBe(true);
  });

  it('reads an uploaded rule with only unknown keys as not blank', () => {
    const { filter, diagnostics } = readLootFilter({ formatVersion: 1, rules: [{ itemName: 'Pul Rune', colour: 4 }] });
    const [rule] = filter.rules;
    expect(rule.passthrough).toEqual({ itemName: 'Pul Rune', colour: 4 });
    expect(isBlankRule(rule)).toBe(false);
    // The editor passes the rule's own diagnostics too.
    expect(isBlankRule(rule, diagnostics)).toBe(false);
  });

  it('has no rule to start on in a brand-new blank filter (the editor shows its empty state)', () => {
    expect(createBlankFilter('New').rules).toEqual([]);
  });
});

describe('setsCondition', () => {
  it('ends the items-first step only when a condition gets a value', () => {
    expect(setsCondition({ itemCodes: ['r33'] })).toBe(true);
    expect(setsCondition({ itemCodes: undefined })).toBe(false);
    expect(setsCondition({ comment: 'x' })).toBe(false);
    expect(setsCondition({ show: true })).toBe(false);
  });
});

describe('actionGroupSummary', () => {
  it("summarises Sully's Pul decal rule (a coloured replaceName) without colour codes", () => {
    const own: RuleActions = { replaceName: { enUS: 'ÿc4Pul', deDE: 'ÿc4Pul' } };
    expect(text(actionGroupSummary('name', { own }))).toBe('“Pul” gold');
    expect(text(actionGroupSummary('chat', { own }))).toBe('none');
    expect(text(actionGroupSummary('sound', { own }))).toBe('none');
  });

  it('names a name-colour-only replaceName and quotes prefix and suffix', () => {
    const own: RuleActions = { replaceName: 'ÿc9{name}', namePrefix: 'ÿc1* ', nameSuffix: ' ({sockets})' };
    expect(text(actionGroupSummary('name', { own }))).toBe('yellow name · prefix “*” red · suffix “({sockets})”');
  });

  it('shows the sound with its volume', () => {
    expect(text(actionGroupSummary('sound', { own: { sound: 'Rune.flac', soundVolume: 80 } }))).toBe('Rune.flac, 80%');
    expect(text(actionGroupSummary('sound', { own: { soundVolume: 40 } }))).toBe('volume 40%');
    expect(text(actionGroupSummary('sound', { own: { sound: 12 } }))).toBe('12');
  });

  it('gives label colours, the icon tint and the droplight colour as swatches', () => {
    const own: RuleActions = {
      labelBackground: [0, 0, 0, 255],
      labelBorder: { color: [255, 165, 0, 255], width: 1 },
      icon: { iconName: 'rune', iconSize: 35, color: [255, 0, 0] },
      droplight: { color: [255, 140, 0] },
    };
    expect(actionGroupSummary('label', { own })).toEqual([
      { text: 'background', swatch: [0, 0, 0, 255] },
      { text: 'border 1 px', swatch: [255, 165, 0, 255] },
    ]);
    expect(actionGroupSummary('icon', { own })).toEqual([{ text: 'rune, 35 px', swatch: [255, 0, 0] }]);
    expect(actionGroupSummary('droplight', { own })).toEqual([{ text: 'on', swatch: [255, 140, 0] }]);
    expect(text(actionGroupSummary('droplight', { own: { droplight: {} } }))).toBe('white beam');
  });

  it("shows a style's values and says when a group comes from the style only", () => {
    const style: RuleActions = { sound: 'other.mp3', soundVolume: 15, chatMessage: 'ÿc8Rune: {name}' };
    const own: RuleActions = { useStyle: 'MidRune', soundVolume: 50 };
    expect(text(actionGroupSummary('style', { own, style }))).toBe('MidRune');
    expect(text(actionGroupSummary('sound', { own, style }))).toBe('other.mp3, 50%');
    expect(text(actionGroupSummary('chat', { own, style }))).toBe('“Rune: {name}” orange · from style MidRune');
    expect(text(actionGroupSummary('style', { own: { useStyle: 'Gone' } }))).toBe('Gone (missing)');
  });

  it('lists the visibility flags and cuts a long chat line', () => {
    expect(text(actionGroupSummary('visibility', { own: { show: true } }))).toBe('show');
    expect(text(actionGroupSummary('visibility', { own: { hide: true, chatMessageWhenHidden: 'ÿc5Hidden: {name}' } }))).toBe(
      'hide · chat when hidden “Hidden: {name}” gray'
    );
    const long = actionGroupSummary('chat', { own: { chatMessage: 'x'.repeat(100) } });
    expect(long[0].text.length).toBeLessThanOrEqual(62);
    expect(long[0].text.endsWith('…”')).toBe(true);
  });
});

describe('conditionGroupSummary', () => {
  const rule: LootFilterRule = {
    itemCodes: ['r33', 'r32', 'r31'],
    quality: 'unique',
    sockets: 3,
    location: ['stored'],
    activeInLevels: [1, 3],
  };

  it('uses the rule list wording per group', () => {
    expect(conditionGroupSummary('items', rule, TEST_LOOKUP, false)).toBe('Zod Rune, Cham Rune +1');
    expect(conditionGroupSummary('properties', rule, TEST_LOOKUP, false)).toBe('unique · 3 sockets');
    expect(conditionGroupSummary('whereWhen', rule, TEST_LOOKUP, false)).toBe('stored · L1,3');
  });

  it('reads an empty Which items as every item and other empty groups as none', () => {
    expect(conditionGroupSummary('items', {}, TEST_LOOKUP, false)).toBe('every item');
    expect(conditionGroupSummary('stats', {}, TEST_LOOKUP, false)).toBe('none');
  });
});

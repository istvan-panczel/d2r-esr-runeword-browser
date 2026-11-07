import { describe, expect, it } from 'vitest';
import type { Diagnostic, LootFilterRule, LootFilterStyle } from '../engine/types';
import {
  ACTION_EDITOR_FIELDS,
  actionFieldGate,
  BASIC_ACTIONS,
  BASIC_CONDITIONS,
  HIDE_ONLY_STATS,
  conditionFields,
  diagnosticKeys,
  nameColorCode,
  nameColorText,
  ruleFieldGate,
  type ActionFieldGate,
  type ConditionField,
} from './ruleView';

const shown = (gate: ReturnType<typeof ruleFieldGate>, fields: readonly ConditionField[]) =>
  fields.filter((field) => gate.condition(field) !== 'hidden');
const shownActions = (gate: ActionFieldGate) => ACTION_EDITOR_FIELDS.filter((field) => gate.action(field) !== 'hidden');

const warning = (path: string): Diagnostic => ({ severity: 'warning', message: 'x', path });
const styleWarning = (style: string, key: string): Diagnostic => ({ ...warning(`styles/${style}/${key}`), style });

describe('ruleFieldGate, Basic view', () => {
  it('shows the common conditions and actions of an empty rule', () => {
    const gate = ruleFieldGate({ view: 'basic', rule: {}, hides: false });
    expect(shown(gate, conditionFields(false))).toEqual([
      'itemCodes',
      'itemTypes',
      'uniqueOrSetIds',
      'quality',
      'sockets',
      'isEthereal',
      'itemStats',
    ]);
    expect(shownActions(gate)).toEqual(['useStyle', 'hide', 'labelBackground', 'labelBorder', 'chatMessage', 'sound', 'icon']);
    expect(gate.hiddenConditions).toBe(18);
    expect(gate.hiddenActions).toBe(8);
  });

  it('shows an Advanced field that holds a value, tagged, and counts only the hidden ones', () => {
    const rule: LootFilterRule = { itemLevel: { min: 80 }, activeInLevels: [1, 2], droplight: {}, useStyle: 'Mythical' };
    const gate = ruleFieldGate({ view: 'basic', rule, hides: false });
    expect(gate.condition('itemLevel')).toBe('advanced');
    expect(gate.condition('activeInLevels')).toBe('advanced');
    expect(gate.condition('baseTier')).toBe('hidden');
    expect(gate.condition('itemCodes')).toBe('shown');
    expect(gate.action('droplight')).toBe('advanced');
    expect(gate.action('useStyle')).toBe('shown');
    expect(gate.hiddenConditions).toBe(16);
    expect(gate.hiddenActions).toBe(7);
  });

  it('counts a wrong-shaped value and a diagnostic as set', () => {
    const rule: LootFilterRule = { passthrough: { maxSockets: 'four' } };
    const gate = ruleFieldGate({
      view: 'basic',
      rule,
      hides: false,
      diagnostics: [warning('rules/0/difficulty'), warning('rules/0/notify')],
    });
    expect(gate.condition('maxSockets')).toBe('advanced');
    expect(gate.condition('difficulty')).toBe('advanced');
    expect(gate.action('notify')).toBe('advanced');
  });

  it('replaces the item stat lists of a hide rule with the hide-only box, shown only with plain checks', () => {
    const exceptionsOnly: LootFilterRule = { hide: true, itemStats: [{ stat: 'item_fastercastrate', op: '<', value: 1 }] };
    expect(conditionFields(true)).toContain(HIDE_ONLY_STATS);
    expect(conditionFields(true)).not.toContain('itemStats');
    expect(conditionFields(true)).not.toContain('itemStatsAnyOf');
    expect(ruleFieldGate({ view: 'basic', rule: exceptionsOnly, hides: true }).condition(HIDE_ONLY_STATS)).toBe('hidden');
    // A diagnostic on an exception stays with the Except control; one on a plain check opens the box.
    expect(
      ruleFieldGate({ view: 'basic', rule: exceptionsOnly, hides: true, diagnostics: [warning('rules/0/itemStats/0')] }).condition(
        HIDE_ONLY_STATS
      )
    ).toBe('hidden');

    const plain: LootFilterRule = { hide: true, itemStatsAnyOf: [{ stat: 'item_fastercastrate', op: '>=', value: 10 }] };
    expect(ruleFieldGate({ view: 'basic', rule: plain, hides: true }).condition(HIDE_ONLY_STATS)).toBe('advanced');
  });

  it('leaves a replaceName that only recolours the name to Name colour', () => {
    expect(ruleFieldGate({ view: 'basic', rule: { replaceName: 'ÿc9{name}' }, hides: false }).action('replaceName')).toBe('hidden');
    expect(ruleFieldGate({ view: 'basic', rule: { replaceName: 'ÿc9* {name}' }, hides: false }).action('replaceName')).toBe('advanced');
    expect(ruleFieldGate({ view: 'basic', rule: { replaceName: { enUS: 'ÿc9{name}' } }, hides: false }).action('replaceName')).toBe(
      'advanced'
    );
  });
});

describe('ruleFieldGate, Advanced view', () => {
  it('shows every field and hides nothing', () => {
    const gate = ruleFieldGate({ view: 'advanced', rule: {}, hides: true });
    expect(shown(gate, conditionFields(true))).toEqual(conditionFields(true));
    expect(shownActions(gate)).toEqual(ACTION_EDITOR_FIELDS);
    expect(gate.hiddenConditions).toBe(0);
    expect(gate.hiddenActions).toBe(0);
  });
});

describe('actionFieldGate (a style)', () => {
  it('shows the Basic actions of an empty style, as for a rule', () => {
    const gate = actionFieldGate({ view: 'basic', actions: {} });
    expect(shownActions(gate)).toEqual(['useStyle', 'hide', 'labelBackground', 'labelBorder', 'chatMessage', 'sound', 'icon']);
    expect(gate.hiddenActions).toBe(8);
    expect(gate.view).toBe('basic');
  });

  it('shows a set Advanced action tagged, and leaves a name-only recolour to Name colour', () => {
    const style: LootFilterStyle = { replaceName: 'ÿc8{name}', droplight: { color: [255, 128, 0] }, namePrefix: 'ÿc1* ' };
    const gate = actionFieldGate({ view: 'basic', actions: style });
    expect(gate.action('droplight')).toBe('advanced');
    expect(gate.action('namePrefix')).toBe('advanced');
    expect(gate.action('replaceName')).toBe('hidden');
    expect(gate.action('labelBackground')).toBe('shown');
    expect(gate.hiddenActions).toBe(6);
  });

  it('counts a wrong-shaped value and a diagnostic on the style as set', () => {
    const style: LootFilterStyle = { passthrough: { notify: 'yes' } };
    const gate = actionFieldGate({ view: 'basic', actions: style, diagnostics: [styleWarning('Rune', 'droplight')] });
    expect(gate.action('notify')).toBe('advanced');
    expect(gate.action('droplight')).toBe('advanced');
    expect(gate.action('nameSuffix')).toBe('hidden');
  });

  it('keeps a recolouring replaceName visible when a diagnostic points at it', () => {
    const gate = actionFieldGate({
      view: 'basic',
      actions: { replaceName: 'ÿc8{name}' },
      diagnostics: [styleWarning('a/b', 'replaceName')],
    });
    expect(gate.action('replaceName')).toBe('advanced');
  });

  it('shows every action in the Advanced view', () => {
    const gate = actionFieldGate({ view: 'advanced', actions: {} });
    expect(shownActions(gate)).toEqual(ACTION_EDITOR_FIELDS);
    expect(gate.hiddenActions).toBe(0);
  });

  it('gives a rule the same action gate as ruleFieldGate', () => {
    const rule: LootFilterRule = { itemLevel: { min: 1 }, notify: true, replaceName: 'ÿc4{name}' };
    const ruleGate = ruleFieldGate({ view: 'basic', rule, hides: false });
    const gate = actionFieldGate({ view: 'basic', actions: rule });
    expect(ACTION_EDITOR_FIELDS.map((field) => gate.action(field))).toEqual(ACTION_EDITOR_FIELDS.map((field) => ruleGate.action(field)));
    expect(gate.hiddenActions).toBe(ruleGate.hiddenActions);
  });

  it("counts a key the rule's style sets as set: it shows in Basic, tagged when Advanced", () => {
    const style: LootFilterStyle = { namePrefix: '* ', droplight: {}, replaceName: 'ÿc4{name}', useStyle: 'Other' };
    const gate = ruleFieldGate({ view: 'basic', rule: { useStyle: 'Gold' }, hides: false, style });
    expect(gate.action('namePrefix')).toBe('advanced');
    expect(gate.action('droplight')).toBe('advanced');
    expect(gate.action('nameSuffix')).toBe('hidden');
    // A name colour from the style belongs to Name colour; a custom name from it shows Replace name.
    expect(gate.action('replaceName')).toBe('hidden');
    expect(ruleFieldGate({ view: 'basic', rule: {}, hides: false, style: { replaceName: 'Shiny' } }).action('replaceName')).toBe(
      'advanced'
    );
    expect(ruleFieldGate({ view: 'basic', rule: { replaceName: 'Mine' }, hides: false, style }).action('replaceName')).toBe('advanced');
  });
});

describe('the field tables', () => {
  it('match the owner decision for Basic', () => {
    const basicConditions = Object.entries(BASIC_CONDITIONS)
      .filter(([, basic]) => basic)
      .map(([key]) => key);
    expect(basicConditions).toEqual(['itemCodes', 'itemTypes', 'uniqueOrSetIds', 'quality', 'sockets', 'isEthereal', 'itemStats']);
    const basicActions = Object.entries(BASIC_ACTIONS)
      .filter(([, basic]) => basic)
      .map(([key]) => key);
    expect(basicActions).toEqual([
      'useStyle',
      'hide',
      'labelBackground',
      'labelBorder',
      'chatMessage',
      'sound',
      'soundVolume',
      'icon',
      'comment',
    ]);
  });
});

describe('nameColorCode and nameColorText', () => {
  it('reads a name-only recolour and writes it back', () => {
    expect(nameColorCode('ÿc9{name}')).toBe('9');
    expect(nameColorCode('ÿcP{name}')).toBe('P');
    expect(nameColorCode(nameColorText(';'))).toBe(';');
    expect(nameColorText('4')).toBe('ÿc4{name}');
  });

  it('is undefined for anything else', () => {
    for (const value of [undefined, '{name}', 'ÿc9{name} ', 'ÿc9Rune', 'ÿcZ{name}', 'ÿc9ÿc1{name}']) {
      expect(nameColorCode(value)).toBeUndefined();
    }
    expect(nameColorCode({ enUS: 'ÿc9{name}' })).toBeUndefined();
  });
});

describe('diagnosticKeys', () => {
  it('takes the rule key of enabled and disabled rule paths', () => {
    expect([...diagnosticKeys([warning('rules/3/itemLevel/min'), warning('disabledRules/0/rule/sound'), warning('rules/2')])]).toEqual([
      'itemLevel',
      'sound',
    ]);
  });

  it('takes the style key of a style path, a name with a slash included', () => {
    expect([
      ...diagnosticKeys([
        styleWarning('Rune', 'sound'),
        styleWarning('a/b', 'labelBorder/width'),
        { ...warning('styles/Rune'), style: 'Rune' },
      ]),
    ]).toEqual(['sound', 'labelBorder']);
  });
});

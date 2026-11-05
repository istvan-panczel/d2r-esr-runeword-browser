import { describe, expect, it } from 'vitest';
import { parseLootFilter } from '../engine/parse';
import { validateLootFilter } from '../engine/validate';
import {
  aiStarterState,
  parseStarterChoice,
  readAiOpenFilter,
  starterChoiceValue,
  starterFromRules,
  starterFromText,
  type AiStarterChoice,
} from './aiStarter';

describe('starterFromText', () => {
  it('counts the rules, disabled ones included', () => {
    const text = '{ "formatVersion": 1, "rules": [{ "hide": true }], "disabledRules": [{ "at": 0, "rule": { "hide": true } }] }';
    expect(starterFromText('Mine', text)).toEqual({ ok: true, starter: { label: 'Mine', text, ruleCount: 2 } });
  });

  it('refuses text that is not valid JSON', () => {
    const result = starterFromText('Broken', '{ "rules": [ }');
    expect(result.ok).toBe(false);
  });
});

describe('starterFromRules', () => {
  it('makes a one-level filter of the picked rules and their styles that reads back cleanly', () => {
    const starter = starterFromRules({
      rules: [{ comment: 'High runes', itemCodes: ['r83'], useStyle: 'Valuable' }],
      styles: { Valuable: { labelBorder: { color: [255, 0, 0], width: 2 } } },
    });
    expect(starter.label).toBe('1 example rule');
    expect(starter.ruleCount).toBe(1);
    expect(starter.fromExamples).toBe(true);
    const parsed = parseLootFilter(starter.text);
    expect(parsed.diagnostics).toEqual([]);
    expect(validateLootFilter(parsed.filter)).toEqual([]);
    expect(parsed.filter.styles).toEqual({ Valuable: { labelBorder: { color: [255, 0, 0], width: 2 } } });
  });

  it('leaves the styles out when there are none', () => {
    expect(parseLootFilter(starterFromRules({ rules: [], styles: {} }, 'Nothing').text).filter.styles).toBeUndefined();
  });
});

describe('the router state of Improve with AI', () => {
  it('round-trips the open filter and ignores anything else', () => {
    expect(readAiOpenFilter(aiStarterState({ name: 'Mine', text: '{}' }))).toEqual({ name: 'Mine', text: '{}' });
    expect(readAiOpenFilter(null)).toBeNull();
    expect(readAiOpenFilter({ aiStarter: { name: 1, text: '{}' } })).toBeNull();
    expect(readAiOpenFilter({ other: true })).toBeNull();
  });
});

describe('starter choice values', () => {
  it('round-trips every choice and falls back to none', () => {
    const choices: AiStarterChoice[] = [
      { kind: 'none' },
      { kind: 'template', template: 'sullys-qol' },
      { kind: 'entry', entryId: 'abc' },
      { kind: 'open' },
      { kind: 'upload' },
      { kind: 'rules' },
    ];
    for (const choice of choices) expect(parseStarterChoice(starterChoiceValue(choice), ['sullys-qol', 'example'])).toEqual(choice);
    expect(parseStarterChoice('template:gone', ['sullys-qol'])).toEqual({ kind: 'none' });
    expect(parseStarterChoice('junk', [])).toEqual({ kind: 'none' });
  });
});

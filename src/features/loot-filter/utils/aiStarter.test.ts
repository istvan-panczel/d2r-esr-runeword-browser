import { describe, expect, it } from 'vitest';
import { RequestState } from '@/core/types';
import { parseLootFilter } from '../engine/parse';
import { validateLootFilter } from '../engine/validate';
import {
  aiStarterState,
  needsSavedFilterFetch,
  parseStarterChoice,
  readAiOpenFilter,
  savedFilterStarter,
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
      { kind: 'saved', savedId: '0b6c3a52-1d9e-4c8e-9f3a-6a1f2b3c4d5e' },
      { kind: 'open' },
      { kind: 'upload' },
      { kind: 'rules' },
    ];
    for (const choice of choices) expect(parseStarterChoice(starterChoiceValue(choice), ['sullys-qol', 'example'])).toEqual(choice);
    expect(parseStarterChoice('template:gone', ['sullys-qol'])).toEqual({ kind: 'none' });
    expect(parseStarterChoice('junk', [])).toEqual({ kind: 'none' });
  });
});

describe('a saved filter as the starter', () => {
  const ID = '0b6c3a52-1d9e-4c8e-9f3a-6a1f2b3c4d5e';
  const OTHER = '9f0e1d2c-3b4a-4596-8877-665544332211';
  const TEXT = '{ "formatVersion": 1, "rules": [{ "hide": true }, { "notify": true }] }';
  const loaded = { detail: { id: ID, name: 'My saved filter', content: TEXT }, status: RequestState.SUCCESS, notFound: false };

  it('uses the fetched file once the detail is this filter', () => {
    expect(savedFilterStarter(ID, loaded)).toEqual({ ok: true, starter: { label: 'My saved filter', text: TEXT, ruleCount: 2 } });
  });

  it('is loading while the detail is on its way, not asked for yet, or another filter', () => {
    expect(savedFilterStarter(ID, { detail: null, status: RequestState.LOADING, notFound: false })).toBe('loading');
    expect(savedFilterStarter(ID, { detail: null, status: RequestState.IDLE, notFound: false })).toBe('loading');
    expect(savedFilterStarter(ID, { ...loaded, detail: { ...loaded.detail, id: OTHER } })).toBe('loading');
  });

  it('says why it cannot be used: a failed fetch, a filter that is gone, a file that is not JSON', () => {
    const failed = savedFilterStarter(ID, { detail: null, status: RequestState.ERROR, notFound: false });
    expect(failed).toMatchObject({ ok: false, message: expect.stringContaining('Could not load') as unknown });
    const gone = savedFilterStarter(ID, { detail: null, status: RequestState.SUCCESS, notFound: true });
    expect(gone).toMatchObject({ ok: false, message: expect.stringContaining('no longer exists') as unknown });
    const broken = savedFilterStarter(ID, { ...loaded, detail: { ...loaded.detail, content: '{ "rules": [ }' } });
    expect(broken).toMatchObject({ ok: false });
  });

  it('fetches unless this filter is already loaded', () => {
    expect(needsSavedFilterFetch(ID, loaded)).toBe(false);
    expect(needsSavedFilterFetch(OTHER, loaded)).toBe(true);
    expect(needsSavedFilterFetch(ID, { ...loaded, status: RequestState.LOADING })).toBe(true);
    expect(needsSavedFilterFetch(ID, { detail: null, status: RequestState.ERROR, notFound: false })).toBe(true);
    expect(needsSavedFilterFetch(ID, { detail: null, status: RequestState.IDLE, notFound: false })).toBe(true);
  });
});

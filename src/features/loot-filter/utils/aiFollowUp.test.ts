import { describe, expect, it } from 'vitest';
import type { Diagnostic, LootFilter } from '../engine/types';
import {
  aiFilterName,
  FOLLOW_UP_CLOSE,
  MAX_LISTED_PROBLEMS,
  problemLine,
  problemsMessage,
  resendMessage,
  ruleLabelOfPath,
} from './aiFollowUp';

const filter: LootFilter = {
  formatVersion: 1,
  rules: [
    { comment: 'High runes', itemCodes: ['r99'] },
    { comment: 'Old rule', disabled: true, hide: true },
    { itemCodes: ['r51'], hide: true },
  ],
  leadingComments: [],
};

const unknownCode: Diagnostic = { severity: 'warning', message: 'Unknown item code "r99"', path: 'rules/0/itemCodes/0', rule: 0 };
const noStyle: Diagnostic = { severity: 'error', message: 'There is no style named "Great"', path: 'rules/1/useStyle', rule: 2 };

describe('ruleLabelOfPath', () => {
  it('numbers enabled and disabled rules from 1 as the file lists them', () => {
    expect(ruleLabelOfPath('rules/0/itemCodes/0')).toBe('Rule 1');
    expect(ruleLabelOfPath('rules/11')).toBe('Rule 12');
    expect(ruleLabelOfPath('disabledRules/0/rule/hide')).toBe('Disabled rule 1');
    expect(ruleLabelOfPath('styles/Good/sound')).toBeNull();
    expect(ruleLabelOfPath('rulesX/1')).toBeNull();
  });
});

describe('problemLine', () => {
  it('names the rule with its comment, the path and the message', () => {
    expect(problemLine(unknownCode, filter)).toBe('- Rule 1 "High runes" (rules/0/itemCodes/0): Unknown item code "r99"');
    expect(problemLine(noStyle, filter)).toBe('- Rule 2 (rules/1/useStyle): There is no style named "Great"');
    expect(problemLine({ severity: 'error', message: 'Bad sound', path: 'styles/Good/sound', style: 'Good' }, filter)).toBe(
      '- Style "Good" (styles/Good/sound): Bad sound'
    );
    expect(problemLine({ severity: 'warning', message: 'Trailing commas were accepted', path: '' }, null)).toBe(
      '- Trailing commas were accepted'
    );
  });

  it('shortens long comments to one line', () => {
    const long: LootFilter = { ...filter, rules: [{ comment: `Line one\n${'x'.repeat(200)}` }] };
    const line = problemLine(unknownCode, long);
    expect(line).toContain('"Line one xxx');
    expect(line).toContain('…"');
    expect(line.length).toBeLessThan(150);
  });
});

describe('problemsMessage', () => {
  it('lists the errors before the warnings and ends with the fix instruction', () => {
    const message = problemsMessage([unknownCode, noStyle], filter) ?? '';
    expect(message).toContain('reports 1 error and 1 warning');
    expect(message.indexOf('Errors:')).toBeLessThan(message.indexOf('Warnings:'));
    expect(message.indexOf('There is no style')).toBeLessThan(message.indexOf('Unknown item code'));
    expect(message.endsWith(FOLLOW_UP_CLOSE)).toBe(true);
  });

  it('is null without problems', () => {
    expect(problemsMessage([], filter)).toBeNull();
  });

  it('lists at most MAX_LISTED_PROBLEMS and counts the rest', () => {
    const many = Array.from({ length: MAX_LISTED_PROBLEMS + 5 }, (_, index): Diagnostic => ({
      ...unknownCode,
      message: `w${String(index)}`,
    }));
    const message = problemsMessage([noStyle, ...many], filter) ?? '';
    expect(message.match(/^- Rule/gm)).toHaveLength(MAX_LISTED_PROBLEMS);
    expect(message).toContain('… and 6 more warnings');
  });
});

describe('resendMessage', () => {
  it('explains what was wrong and asks for the whole file as one json block', () => {
    expect(resendMessage({ ok: false, kind: 'none', message: '' })).toContain('could not find the filter JSON');
    expect(resendMessage({ ok: false, kind: 'syntax', message: 'Unexpected end (line 4, column 2)' })).toContain(
      'cannot be read: Unexpected end (line 4, column 2). It may have been cut off.'
    );
    expect(resendMessage({ ok: false, kind: 'notFilter', message: 'it is a list' })).toContain('not a complete filter (it is a list)');
    expect(resendMessage({ ok: false, kind: 'empty', message: '' })).toContain('ONE ```json code block');
  });
});

describe('aiFilterName', () => {
  it('takes the first line of the request, shortened at a word', () => {
    expect(aiFilterName('\n  Hammerdin filter for Hell.\nmore')).toBe('Hammerdin filter for Hell');
    expect(aiFilterName('I play a Blizzard Sorceress in Hell and want runes from Lum up')).toBe('I play a Blizzard Sorceress in Hell and…');
    expect(aiFilterName('   ')).toBe('AI filter');
  });
});

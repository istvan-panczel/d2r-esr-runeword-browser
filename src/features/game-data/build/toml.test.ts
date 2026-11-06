import { describe, expect, it } from 'vitest';
import { parseToml } from './toml.ts';

describe('parseToml', () => {
  it('reads sections, scalars and the comment block above each key', () => {
    const { entries, errors } = parseToml(
      [
        '# File header',
        '',
        'config_version = 1',
        'enabled = true # trailing comment',
        '',
        '[targets]',
        '# Random yellow-name pack leaders.',
        '# 50 -> 12.5 % of current life.',
        'unique = 25',
        '',
        '[cast-rate-cap]',
        'fcr_cap = 500',
        'ratio = 99.5',
        'neg = -1',
        'name = "strModBleed # not a comment"',
        "lit = 'a\\b'",
      ].join('\n')
    );
    expect(errors).toEqual([]);
    expect(entries.get('config_version')?.value).toBe(1);
    expect(entries.get('config_version')?.comment).toEqual([]);
    expect(entries.get('enabled')?.value).toBe(true);
    expect(entries.get('targets.unique')).toEqual({
      path: 'targets.unique',
      value: 25,
      comment: ['Random yellow-name pack leaders.', '50 -> 12.5 % of current life.'],
      line: 9,
    });
    expect(entries.get('cast-rate-cap.fcr_cap')?.value).toBe(500);
    expect(entries.get('cast-rate-cap.ratio')?.value).toBe(99.5);
    expect(entries.get('cast-rate-cap.neg')?.value).toBe(-1);
    expect(entries.get('cast-rate-cap.name')?.value).toBe('strModBleed # not a comment');
    expect(entries.get('cast-rate-cap.lit')?.value).toBe('a\\b');
  });

  it('reads nested and multi-line arrays and numbers arrays of tables', () => {
    const { entries, errors } = parseToml(
      [
        'claw_item_types = ["h2h"]',
        'pairs = [',
        '    [357, 511], # Valkyrie',
        '    [423, 511],',
        ']',
        '[[rule]]',
        'unique = "Hellfire Torch"',
        '[[rule]]',
        'unique = "Annihilus"',
      ].join('\r\n')
    );
    expect(errors).toEqual([]);
    expect(entries.get('claw_item_types')?.value).toEqual(['h2h']);
    expect(entries.get('pairs')?.value).toEqual([
      [357, 511],
      [423, 511],
    ]);
    expect(entries.get('rule[0].unique')?.value).toBe('Hellfire Torch');
    expect(entries.get('rule[1].unique')?.value).toBe('Annihilus');
  });

  it('keeps an unreadable value as raw text and reports it', () => {
    const { entries, errors } = parseToml('when = 1979-05-27T07:32:00Z\ninline = { a = 1 }');
    expect(errors).toHaveLength(2);
    expect(entries.get('when')?.value).toBe('1979-05-27T07:32:00Z');
    expect(entries.get('inline')?.value).toBe('{ a = 1 }');
  });
});

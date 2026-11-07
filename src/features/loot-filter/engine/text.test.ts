import { PLACEHOLDERS, findPlaceholder, listPlaceholders, resolveText, splitColorRuns, textLanguages, withLanguage } from './text.ts';

describe('resolveText', () => {
  it('resolves strings and per-language texts with fallbacks', () => {
    expect(resolveText(undefined)).toBeUndefined();
    expect(resolveText('Rune', 'deDE')).toBe('Rune');
    expect(resolveText({ enUS: 'Rune', deDE: 'Rune DE' }, 'deDE')).toBe('Rune DE');
    expect(resolveText({ enUS: 'Rune', deDE: 'Rune DE' }, 'frFR')).toBe('Rune');
    expect(resolveText({ deDE: 'Nur Deutsch' })).toBe('Nur Deutsch');
    expect(resolveText({})).toBeUndefined();
  });
});

describe('splitColorRuns', () => {
  it('splits on colour codes and line breaks, carrying the colour over a break', () => {
    expect(splitColorRuns('Drop: ÿc4{name}\nÿc;x ÿc')).toEqual([
      { kind: 'text', color: null, text: 'Drop: ' },
      { kind: 'text', color: '4', text: '{name}' },
      { kind: 'break' },
      { kind: 'text', color: ';', text: 'x ÿc' },
    ]);
  });

  it('skips empty runs between consecutive codes', () => {
    expect(splitColorRuns('ÿc1ÿc2*')).toEqual([{ kind: 'text', color: '2', text: '*' }]);
    expect(splitColorRuns('')).toEqual([]);
    expect(splitColorRuns('a\n\nb')).toEqual([
      { kind: 'text', color: null, text: 'a' },
      { kind: 'break' },
      { kind: 'break' },
      { kind: 'text', color: null, text: 'b' },
    ]);
  });
});

describe('placeholders', () => {
  it('lists the placeholders in a text', () => {
    expect(listPlaceholders('ÿc1[{stat:36}% Phys Res] {name} {string:r01} {nope')).toEqual(['{stat:36}', '{name}', '{string:r01}']);
  });

  it('recognises every placeholder of the guide and nothing else', () => {
    expect(findPlaceholder('{name}')?.token).toBe('{name}');
    expect(findPlaceholder('{stat:item_numsockets,0}')?.token).toBe('{stat:ID}');
    expect(findPlaceholder('{playerStat:12}')?.token).toBe('{playerStat:ID}');
    expect(findPlaceholder('{level}')?.contexts).toEqual(['levelChangeFormat']);
    expect(findPlaceholder('{red}')).toBeUndefined();
    expect(PLACEHOLDERS.map((p) => p.token)).toContain('{link}');
  });
});

describe('per-language texts', () => {
  it('edits one language and keeps the others', () => {
    const text = { enUS: 'Rune', deDE: 'Rune', frFR: 'Rune' };
    expect(withLanguage(text, 'enUS', 'High rune')).toEqual({ enUS: 'High rune', deDE: 'Rune', frFR: 'Rune' });
    expect(withLanguage(text, 'zhTW', '符文')).toEqual({ ...text, zhTW: '符文' });
    expect(withLanguage(text, 'deDE', '')).toEqual({ enUS: 'Rune', frFR: 'Rune' });
    expect(withLanguage({ enUS: 'x' }, 'enUS', '')).toBeUndefined();
    expect(Object.keys(withLanguage({ deDE: 'a', enUS: 'b' }, 'deDE', 'c') ?? {})).toEqual(['deDE', 'enUS']);
  });

  it('lists the languages in the guide order', () => {
    expect(textLanguages({ zhTW: 'a', enUS: 'b', deDE: 'c' })).toEqual(['enUS', 'deDE', 'zhTW']);
  });
});

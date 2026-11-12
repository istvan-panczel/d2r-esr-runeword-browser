import { describe, it, expect } from 'vitest';
import { buildStringTable, nameColorCode, sortStringFiles, stripColorCodes } from './strings.ts';

function file(name: string, entries: { Key: string; enUS: string }[], bom = false) {
  return { name, text: `${bom ? '﻿' : ''}${JSON.stringify(entries.map((e, id) => ({ id, ...e, deDE: 'x' })))}` };
}

describe('stripColorCodes', () => {
  it('removes ÿc colour codes', () => {
    expect(stripColorCodes('ÿc4Hand Axeÿc0 of ÿc;Doom')).toBe('Hand Axe of Doom');
  });
});

describe('nameColorCode', () => {
  it('gives the code in effect at the last visible character (what text after the name continues in)', () => {
    expect(nameColorCode('ÿc4Ancient Scroll 1')).toBe('4');
    expect(nameColorCode('ÿc;Chipped Amethyst')).toBe(';');
    expect(nameColorCode('ÿc4Elixir of Skillÿc0')).toBe('4'); // a code after the last visible character does not count
    expect(nameColorCode('ÿc0ÿcNMoon Rune')).toBe('N');
  });

  it("gives ESR's belt names (a coloured marker, then the name after ÿc0) white", () => {
    expect(nameColorCode('ÿc1*ÿc0HP1')).toBe('0');
    expect(nameColorCode('ÿc3+ÿc0TP')).toBe('0');
    expect(nameColorCode('ÿc;*ÿc025%')).toBe('0');
  });

  it('reads multi-line names to their end (the name line is the last), a code above carrying over', () => {
    expect(nameColorCode('(I -> El)\nÿc4Ancient Decal')).toBe('4');
    expect(nameColorCode('ÿc4(I -> El)\nAncient Decal')).toBe('4');
    expect(nameColorCode('ÿc2Top\nÿc;Name\n  ')).toBe(';');
  });

  it('is undefined without a code before the end of the name', () => {
    expect(nameColorCode('El Rune')).toBeUndefined();
    expect(nameColorCode('')).toBeUndefined();
    expect(nameColorCode('ÿc4')).toBeUndefined();
    expect(nameColorCode('El Runeÿc4')).toBeUndefined();
  });
});

describe('buildStringTable', () => {
  it('reads files with and without a UTF-8 BOM', () => {
    const { strings } = buildStringTable([
      file('a.json', [{ Key: 'k1', enUS: 'One' }], true),
      file('b.json', [{ Key: 'k2', enUS: 'Two' }]),
    ]);
    expect(strings.get('k1')).toBe('One');
    expect(strings.get('k2')).toBe('Two');
  });

  it('strips colour codes from values and keeps the colour the display line ends in', () => {
    const { strings, colors } = buildStringTable([
      file('item-names.json', [
        { Key: 'hax', enUS: 'ÿc3Hand Axe' },
        { Key: 'axe', enUS: 'Axe' },
      ]),
      file('item-runes.json', [{ Key: 'hax', enUS: 'ÿc9Hand Axe' }]),
    ]);
    expect(strings.get('hax')).toBe('Hand Axe');
    expect(colors.get('hax')).toBe('9'); // the winning file's entry
    expect(colors.has('axe')).toBe(false);
  });

  it('resolves duplicates by file priority and warns only when the text differs', () => {
    const { strings, warnings } = buildStringTable([
      file('chinese-overlay.json', [{ Key: 'skc', enUS: 'Chipped Quartz' }]),
      file('item-gems.json', [{ Key: 'skc', enUS: 'Chipped Skull' }]),
      file('item-names.json', [
        { Key: 'same', enUS: 'Same' },
        { Key: 'dup', enUS: 'From names' },
      ]),
      file('item-runes.json', [
        { Key: 'same', enUS: 'Same' },
        { Key: 'dup', enUS: 'From runes' },
      ]),
    ]);
    expect(strings.get('dup')).toBe('From runes');
    expect(strings.get('skc')).toBe('Chipped Skull');
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes('"dup"') && w.includes('item-runes.json'))).toBe(true);
    expect(warnings.some((w) => w.includes('"same"'))).toBe(false);
  });

  it('keeps the first entry for duplicates inside one file', () => {
    const { strings, warnings } = buildStringTable([
      file('ui.json', [
        { Key: 'k', enUS: 'first' },
        { Key: 'k', enUS: 'second' },
      ]),
    ]);
    expect(strings.get('k')).toBe('first');
    expect(warnings).toHaveLength(1);
  });

  it('keeps the numeric id of the entry each key resolved to', () => {
    const { ids } = buildStringTable([
      { name: 'item-names.json', text: '[{"id":5,"Key":"dup","enUS":"Names"},{"id":6,"Key":"own","enUS":"Own"}]' },
      { name: 'item-runes.json', text: '[{"id":63086,"Key":"dup","enUS":"Cow"},{"Key":"noId","enUS":"x"}]' },
    ]);
    expect(ids.get('dup')).toBe(63086);
    expect(ids.get('own')).toBe(6);
    expect(ids.has('noId')).toBe(false);
  });

  it('skips malformed entries', () => {
    const { strings } = buildStringTable([{ name: 'x.json', text: '[{"Key":"a"},null,{"Key":"b","enUS":"B"}]' }]);
    expect([...strings.keys()]).toEqual(['b']);
  });
});

describe('sortStringFiles', () => {
  it('orders priority files first, the rest alphabetically, chinese-overlay last', () => {
    const names = [
      'ui.json',
      'chinese-overlay.json',
      'skills.json',
      'bnet.json',
      'item-names.json',
      'item-modifiers.json',
      'item-nameaffixes.json',
      'item-runes.json',
    ];
    expect(sortStringFiles(names.map((name) => ({ name }))).map((f) => f.name)).toEqual([
      'item-runes.json',
      'item-nameaffixes.json',
      'item-modifiers.json',
      'item-names.json',
      'skills.json',
      'bnet.json',
      'ui.json',
      'chinese-overlay.json',
    ]);
  });
});

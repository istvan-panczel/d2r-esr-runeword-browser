import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseLootFilter } from './parse.ts';
import { serializeLootFilter, toPlainJson } from './serialize.ts';
import type { LootFilter } from './types.ts';

const base: LootFilter = { formatVersion: 1, rules: [], leadingComments: [] };

describe('serializeLootFilter', () => {
  it('writes leading comments, canonical key order and a trailing newline', () => {
    const filter: LootFilter = {
      ...base,
      leadingComments: ['// My filter', '//   second'],
      rules: [{ hide: true, itemTypes: ['pots'], activeInLevels: [2], comment: 'potions' }],
      defaultLevel: 1,
      filterLevels: [{ id: 1, name: 'Leveling' }],
      title: 'T',
      passthrough: { zzz: true },
    };
    expect(serializeLootFilter(filter)).toBe(
      [
        '// My filter',
        '//   second',
        '{',
        '  "formatVersion": 1,',
        '  "title": "T",',
        '  "filterLevels": [',
        '    {"id": 1, "name": "Leveling"}',
        '  ],',
        '  "defaultLevel": 1,',
        '  "rules": [',
        '    {"itemTypes": ["pots"], "activeInLevels": [2], "hide": true, "comment": "potions"}',
        '  ],',
        '  "zzz": true',
        '}',
        '',
      ].join('\n')
    );
  });

  it('writes literal ÿ and escapes line breaks', () => {
    const text = serializeLootFilter({ ...base, rules: [{ chatMessage: 'ÿc4Drop\n{name}' }] });
    expect(text).toContain('{"chatMessage": "ÿc4Drop\\n{name}"}');
    expect(text).not.toContain('\\u00ff');
  });

  it('puts a long rule on one key per line, keeping small objects inline', () => {
    const rule = {
      itemCodes: ['ylg', 'yvg', 'ymg', 'ytg', 'yhg', 'yig', 'ulg', 'uvg', 'umg', 'utg', 'uhg'],
      quality: 'superior' as const,
      itemStats: [{ stat: 93, op: '>=' as const, value: 20 }],
      nameSuffix: 'ÿc1[{stat:93}% IAS]',
    };
    expect(serializeLootFilter({ ...base, rules: [rule] })).toContain(
      [
        '    {',
        '      "itemCodes": ["ylg", "yvg", "ymg", "ytg", "yhg", "yig", "ulg", "uvg", "umg", "utg", "uhg"],',
        '      "quality": "superior",',
        '      "itemStats": [{"stat": 93, "op": ">=", "value": 20}],',
        '      "nameSuffix": "ÿc1[{stat:93}% IAS]"',
        '    }',
      ].join('\n')
    );
  });

  it('wraps a long list of codes several per line', () => {
    const codes = Array.from({ length: 40 }, (_, i) => `m${String(i).padStart(2, '0')}`);
    const text = serializeLootFilter({ ...base, rules: [{ excludeItemCodes: codes, hide: true }] });
    expect(text).toContain('      "excludeItemCodes": [\n        "m00", "m01",');
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(150);
    expect(parseLootFilter(text).filter.rules[0]?.excludeItemCodes).toEqual(codes);
  });

  it('writes styles one per line, short ones inline', () => {
    const text = serializeLootFilter({ ...base, styles: { A: { sound: 'x.mp3', notify: true }, B: { droplight: {} } } });
    expect(text).toContain('  "styles": {\n    "A": {"notify": true, "sound": "x.mp3"},\n    "B": {"droplight": {}}\n  },');
  });

  it('writes passthrough keys after the typed ones, and a known one only when the typed field is unset', () => {
    const plain = toPlainJson({
      ...base,
      rules: [{ hide: true, passthrough: { sockets: 'two', hide: 'yes', future: 1 } }],
    });
    expect(plain.rules).toEqual([{ hide: true, sockets: 'two', future: 1 }]);
    expect(Object.keys((plain.rules as Record<string, unknown>[])[0] ?? {})).toEqual(['hide', 'sockets', 'future']);
  });

  it('writes a single-number activeInLevels back as a number until the levels change', () => {
    const text = [
      '{',
      '  "formatVersion": 1,',
      '  "filterLevels": [',
      '    {"id": 4, "name": "Maps"}',
      '  ],',
      '  "rules": [',
      '    {"itemCodes": ["01b"], "activeInLevels": 4, "hide": true}',
      '  ]',
      '}',
      '',
    ].join('\n');
    const { filter } = parseLootFilter(text);
    expect(serializeLootFilter(filter)).toBe(text);
    const rule = filter.rules[0] ?? {};
    const edited = (activeInLevels: readonly number[]) => toPlainJson({ ...filter, rules: [{ ...rule, activeInLevels }] }).rules;
    expect(edited([4, 5])).toEqual([{ itemCodes: ['01b'], activeInLevels: [4, 5], hide: true }]);
    expect(edited([5])).toEqual([{ itemCodes: ['01b'], activeInLevels: [5], hide: true }]);
    expect(toPlainJson({ ...filter, rules: [{ ...rule, activeInLevels: undefined }] }).rules).toEqual([{ itemCodes: ['01b'], hide: true }]);
  });

  it('lays Sully’s filter out like the source, apart from key order and wrapped stat lists', () => {
    const source = readFileSync(resolve(__dirname, '../../../../public/loot-filters/sullys-qol-filter.json'), 'utf-8');
    const text = serializeLootFilter(parseLootFilter(source).filter);
    const oneLineRules = (s: string) => s.split('\n').filter((line) => line.startsWith('    {"')).length;
    expect(text.startsWith("// Sully's QoL Filter")).toBe(true);
    // Sully writes some one-line rules and styles longer than the serializer's line width (12 of 113 when last checked).
    expect(Math.abs(oneLineRules(text) - oneLineRules(source))).toBeLessThanOrEqual(15);
    // The Ancient Scroll hide rule keeps its single-number `"activeInLevels": 4`, now in canonical key order.
    expect(text).toMatch(/\n {6}"activeInLevels": 4,\n {6}"hide": true\n/);
    expect(text.split('"activeInLevels": 4').length - 1).toBe(source.split('"activeInLevels": 4').length - 1);
  });

  it('writes disabled rules to disabledRules after rules, with their index in the full list', () => {
    const filter: LootFilter = {
      ...base,
      rules: [{ itemCodes: ['r01'], hide: true, disabled: true }, { itemCodes: ['r02'] }, { itemCodes: ['r03'], disabled: true }],
      passthrough: { zzz: true },
    };
    expect(toPlainJson(filter)).toEqual({
      formatVersion: 1,
      rules: [{ itemCodes: ['r02'] }],
      disabledRules: [
        { at: 0, rule: { itemCodes: ['r01'], hide: true } },
        { at: 2, rule: { itemCodes: ['r03'] } },
      ],
      zzz: true,
    });
    expect(serializeLootFilter(filter)).toContain(
      [
        '  "rules": [',
        '    {"itemCodes": ["r02"]}',
        '  ],',
        '  "disabledRules": [',
        '    {"at": 0, "rule": {"itemCodes": ["r01"], "hide": true}},',
      ].join('\n')
    );
  });

  it('round-trips the previewed formula next to the stat lists', () => {
    const text = [
      '{',
      '  "formatVersion": 1,',
      '  "rules": [',
      '    {"location": ["onGround"], "formula": "(stat(\'item_fastercastrate\')>=10)", "itemTypes": ["ring"], "playerStats": [{"stat": "level", "value": 10}], "hide": true}',
      '  ]',
      '}',
    ].join('\n');
    const written = serializeLootFilter(parseLootFilter(text).filter);
    expect(written).toBe(
      [
        '{',
        '  "formatVersion": 1,',
        '  "rules": [',
        '    {',
        '      "itemTypes": ["ring"],',
        '      "playerStats": [{"stat": "level", "value": 10}],',
        '      "formula": "(stat(\'item_fastercastrate\')>=10)",',
        '      "location": ["onGround"],',
        '      "hide": true',
        '    }',
        '  ]',
        '}',
        '',
      ].join('\n')
    );
    expect(serializeLootFilter(parseLootFilter(written).filter)).toBe(written);
  });

  it('writes no disabledRules key without disabled rules, and keeps a wrong-shaped one until a rule is disabled', () => {
    expect(toPlainJson({ ...base, rules: [{ itemCodes: ['r01'] }] })).not.toHaveProperty('disabledRules');
    const wrong: LootFilter = { ...base, rules: [{ itemCodes: ['r01'] }], passthrough: { disabledRules: 'x' } };
    expect(toPlainJson(wrong).disabledRules).toBe('x');
    expect(toPlainJson({ ...wrong, rules: [{ itemCodes: ['r01'], disabled: true }] }).disabledRules).toEqual([
      { at: 0, rule: { itemCodes: ['r01'] } },
    ]);
  });
});

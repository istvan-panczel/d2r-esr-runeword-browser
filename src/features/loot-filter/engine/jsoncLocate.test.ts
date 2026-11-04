import { locateJsoncChildren, locateJsoncPath } from './jsoncLocate.ts';

/** The text at `path`, or undefined when nothing was found. */
function at(text: string, path: string): string | undefined {
  const range = locateJsoncPath(text, path);
  return range && text.slice(range.from, range.to);
}

/** Shaped like the serializer's output: leading comments, one rule per line, disabled rules with their place. */
const FILE = [
  '// My filter',
  '// second line',
  '{',
  '  "formatVersion": 1,',
  '  "title": "Mine",',
  '  "styles": {',
  '    "Valuable": { "sound": "tink.mp3", "labelBackground": [255, 255, 255] },',
  '    "Mythical/Set": { "sound": "mid.mp3" },',
  '    "Mythical": { "sound": "unique.mp3", "labelBorder": { "color": [240, 0, 0], "width": 2 } }',
  '  },',
  '  "rules": [',
  '    { "comment": "runes", "itemCodes": ["r30", "r31", "r32", "r33"], "useStyle": "Valuable" },',
  '    { "codes": "a // not a comment", "hide": true },',
  '    { "qualities": ["unique"], "replaceName": "ÿc1{name}", "useStyle": "Mythical" }',
  '  ],',
  '  "disabledRules": [{ "at": 3, "rule": { "itemCodes": ["hp1"], "hide": true } }]',
  '}',
  '',
].join('\n');

describe('locateJsoncPath', () => {
  it('finds members from the key to the end of the value, and array elements', () => {
    expect(at(FILE, 'formatVersion')).toBe('"formatVersion": 1');
    expect(at(FILE, 'rules/0')).toBe('{ "comment": "runes", "itemCodes": ["r30", "r31", "r32", "r33"], "useStyle": "Valuable" }');
    expect(at(FILE, 'rules/0/itemCodes')).toBe('"itemCodes": ["r30", "r31", "r32", "r33"]');
    expect(at(FILE, 'rules/0/itemCodes/3')).toBe('"r33"');
    expect(at(FILE, 'rules/2/useStyle')).toBe('"useStyle": "Mythical"');
    expect(at(FILE, 'styles/Valuable/sound')).toBe('"sound": "tink.mp3"');
    expect(at(FILE, 'styles/Mythical/labelBorder/color/0')).toBe('240');
    expect(at(FILE, 'disabledRules/0/rule/hide')).toBe('"hide": true');
  });

  it('skips strings with // and nested containers between it and the target', () => {
    expect(at(FILE, 'rules/1/hide')).toBe('"hide": true');
    expect(at(FILE, 'disabledRules/0/at')).toBe('"at": 3');
  });

  it('matches the longest key for style names with a slash', () => {
    expect(at(FILE, 'styles/Mythical/Set/sound')).toBe('"sound": "mid.mp3"');
    expect(at(FILE, 'styles/Mythical/Set')).toBe('"Mythical/Set": { "sound": "mid.mp3" }');
    expect(at(FILE, 'styles/Mythical/sound')).toBe('"sound": "unique.mp3"');
    // Only a whole key counts: "Mythical/Se" is no style, so the walk stops at styles/Mythical.
    expect(at(FILE, 'styles/Mythical/Se')).toBe(
      '"Mythical": { "sound": "unique.mp3", "labelBorder": { "color": [240, 0, 0], "width": 2 } }'
    );
  });

  it('compares keys after decoding escapes', () => {
    expect(at('{"\\u00ffc4": 1, "a\\"b": 2, "a\\/b": 3}', 'ÿc4')).toBe('"\\u00ffc4": 1');
    expect(at('{"\\u00ffc4": 1, "a\\"b": 2, "a\\/b": 3}', 'a"b')).toBe('"a\\"b": 2');
    expect(at('{"\\u00ffc4": 1, "a\\"b": 2, "a\\/b": 3}', 'a/b')).toBe('"a\\/b": 3');
  });

  it('takes the last of equal keys, as JSON.parse does', () => {
    expect(at('{"a": 1, "a": 2}', 'a')).toBe('"a": 2');
  });

  it('returns 0-based offsets into the text as given, a BOM included', () => {
    const text = '\uFEFF{"a": [true, null]}';
    expect(locateJsoncPath(text, 'a/1')).toEqual({ from: text.indexOf('null'), to: text.indexOf('null') + 4 });
    expect(at(text, 'a/1')).toBe('null');
  });

  it('skips comments and tolerates trailing commas', () => {
    const text = '/* a */ {\r\n  // b\r\n  "x": [1, /* , */ 2, ], // c\r\n  "y": { "z": "w", },\r\n}';
    expect(at(text, 'x/1')).toBe('2');
    expect(at(text, 'y/z')).toBe('"z": "w"');
  });

  it('returns the deepest part found when the path goes further than the text', () => {
    expect(at(FILE, 'rules/0/itemCodes/9')).toBe('"itemCodes": ["r30", "r31", "r32", "r33"]');
    expect(at(FILE, 'rules/0/missing')).toBe(at(FILE, 'rules/0'));
    expect(at(FILE, 'rules/0/useStyle/x')).toBe('"useStyle": "Valuable"');
    expect(at(FILE, 'rules/x')).toBe(at(FILE, 'rules'));
    expect(at(FILE, 'styles/Valuable/sound/0')).toBe('"sound": "tink.mp3"');
  });

  it('is undefined for the whole file and when the first segment is missing', () => {
    expect(locateJsoncPath(FILE, '')).toBeUndefined();
    expect(locateJsoncPath(FILE, 'nope')).toBeUndefined();
    expect(locateJsoncPath('', 'rules/0')).toBeUndefined();
    expect(locateJsoncPath('// only a comment', 'rules')).toBeUndefined();
    expect(locateJsoncPath('[1, 2]', 'rules')).toBeUndefined();
    expect(locateJsoncPath('"text"', 'rules')).toBeUndefined();
  });

  it('stops at broken text and keeps what it found', () => {
    // A missing comma: the members after it are not read.
    expect(at('{"a": {"b": 1 "c": 2}}', 'a/c')).toBe('"a": {"b": 1 "c": 2}');
    expect(at('{"a": [1 2]}', 'a/1')).toBe('"a": [1 2]');
    expect(at('{"a": [1,,2]}', 'a/2')).toBe('"a": [1,,2]');
    // A missing value or colon marks the key.
    expect(at('{"a": }', 'a')).toBe('"a"');
    expect(at('{"a" 1}', 'a')).toBe('"a"');
    // An unclosed container runs to the end of the text; an unclosed string to its line end.
    expect(at('{"a": {"b": [1, 2', 'a/b/1')).toBe('2');
    expect(at('{"a": {"b": [1, 2', 'a')).toBe('"a": {"b": [1, 2');
    expect(at('{"a": "abc\n, "b": 1}', 'a')).toBe('"a": "abc');
    expect(at('{"a": 1, "b', 'b')).toBe('"b');
    // A container whose brackets balance still finds what comes before the break inside.
    expect(at('{"a": {"b": 1 x, "c": 2}, "d": 3}', 'd')).toBe('"d": 3');
  });

  it('never throws or hangs on partial texts', () => {
    const prefixes = Array.from({ length: FILE.length + 1 }, (_, length) => FILE.slice(0, length));
    const paths = ['rules/2/replaceName', 'styles/Mythical/Set/sound', 'disabledRules/0/rule/itemCodes/0', 'styles/Valuable'];
    for (const text of prefixes) for (const path of paths) expect(() => locateJsoncPath(text, path)).not.toThrow();
    expect(at(FILE.slice(0, FILE.indexOf('"replaceName"') + 20), 'rules/2/replaceName')).toBe('"replaceName": "ÿc1{');
  });

  it('is fast on a large file', () => {
    const rule = '    { "comment": "a rule", "itemCodes": ["r30", "r31"], "labelBackground": [1, 2, 3], "useStyle": "Valuable" }';
    const rules = Array.from({ length: 700 }, () => rule).join(',\n');
    const text = `{\n  "formatVersion": 1,\n  "rules": [\n${rules}\n  ]\n}\n`;
    expect(text.length).toBeGreaterThan(70_000);
    const start = performance.now();
    for (let i = 0; i < 20; i++) expect(at(text, 'rules/699/useStyle')).toBe('"useStyle": "Valuable"');
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('locateJsoncChildren', () => {
  it('lists the elements of an array and the members of an object, with the ranges locateJsoncPath gives', () => {
    const rules = locateJsoncChildren(FILE, 'rules');
    expect(rules?.map((child) => child.key)).toEqual([0, 1, 2]);
    expect(rules?.map((child) => child.range)).toEqual([0, 1, 2].map((index) => locateJsoncPath(FILE, `rules/${String(index)}`)));
    const styles = locateJsoncChildren(FILE, 'styles');
    expect(styles?.map((child) => child.key)).toEqual(['Valuable', 'Mythical/Set', 'Mythical']);
    expect(styles?.[1] && FILE.slice(styles[1].range.from, styles[1].range.to)).toBe('"Mythical/Set": { "sound": "mid.mp3" }');
    expect(locateJsoncChildren(FILE, '')?.map((child) => child.key)).toEqual([
      'formatVersion',
      'title',
      'styles',
      'rules',
      'disabledRules',
    ]);
  });

  it('is undefined for a missing path or a scalar, and stops where the text breaks', () => {
    expect(locateJsoncChildren(FILE, 'nope')).toBeUndefined();
    expect(locateJsoncChildren(FILE, 'title')).toBeUndefined();
    expect(locateJsoncChildren('{"a": [1, 2 3]}', 'a')?.map((child) => child.key)).toEqual([0, 1]);
    expect(locateJsoncChildren('{"a": 1, "b": }', '')?.map((child) => child.key)).toEqual(['a', 'b']);
  });
});

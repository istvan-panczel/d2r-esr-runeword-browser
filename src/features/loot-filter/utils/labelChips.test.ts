import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLootFilter } from '../engine/parse';
import { computeLabelChips, type LabelChip } from './labelChips';

/** The line (0-based) a chip sits on. */
const lineOf = (text: string, chip: LabelChip): number => text.slice(0, chip.offset).split('\n').length - 1;

const FILE = [
  '// comment',
  '{',
  '  "formatVersion": 1,',
  '  "styles": {',
  '    "Jackpot": { "sound": "tink.mp3", "labelBackground": [255, 255, 255, 255], "labelBorder": { "color": [240, 0, 0, 230], "width": 2 } },',
  '    "Quiet": { "sound": "tink.mp3" }',
  '  },',
  '  "rules": [',
  '    { "itemCodes": ["r30"], "useStyle": "Jackpot" },',
  '    { "itemCodes": ["r31"], "replaceName": "ÿc1{name}" },',
  '    { "itemCodes": ["r32"], "useStyle": "Quiet" },',
  '    { "itemCodes": ["hp1"], "hide": true },',
  '    { "itemCodes": ["hp2"], "hide": true, "labelBackground": [10, 20, 30] },',
  '    { "itemCodes": ["r33"], "namePrefix": "ÿc4* ", "useStyle": "Jackpot", "labelBorder": { "color": [1, 2, 3], "width": -1 } },',
  '    { "itemCodes": ["r34"], "replaceName": "plain {name}" }',
  '  ],',
  '  "disabledRules": [{ "at": 2, "rule": { "itemCodes": ["r35"], "labelBackground": [0, 128, 0] } }]',
  '}',
  '',
].join('\n');

describe('computeLabelChips', () => {
  it('is undefined when the text does not parse', () => {
    expect(computeLabelChips('{"rules": [')).toBeUndefined();
  });

  it('gives one chip per rule and style that sets a label colour, on its line, in file order', () => {
    const chips = computeLabelChips(FILE) ?? [];
    const lines = FILE.split('\n');
    expect(chips.map((chip) => lines[lineOf(FILE, chip)].trim().slice(0, 32))).toEqual([
      '"Jackpot": { "sound": "tink.mp3"',
      '{ "itemCodes": ["r30"], "useStyl',
      '{ "itemCodes": ["r31"], "replace',
      '{ "itemCodes": ["hp2"], "hide": ',
      '{ "itemCodes": ["r33"], "namePre',
      '"disabledRules": [{ "at": 2, "ru',
    ]);
    expect(FILE.slice(chips[0].offset, chips[0].offset + 9)).toBe('"Jackpot"');
    expect(FILE.slice(chips[1].offset, chips[1].offset + 3)).toBe('{ "');
    expect(FILE.slice(chips[5].offset, chips[5].offset + 6)).toBe('"rule"');
  });

  it("takes a rule's colours from its style and names the style", () => {
    const chips = computeLabelChips(FILE) ?? [];
    expect(chips[0]).toEqual({
      offset: FILE.indexOf('"Jackpot"'),
      textColor: null,
      background: 'rgba(255, 255, 255, 1)',
      border: { color: `rgba(240, 0, 0, ${String(230 / 255)})`, width: 2 },
      title: 'Style Jackpot · background 255,255,255 · border 240,0,0 (2 px)',
    });
    expect(chips[1]).toMatchObject({
      background: 'rgba(255, 255, 255, 1)',
      title: 'Rule 1 · background 255,255,255 · border 240,0,0 (2 px) · style Jackpot',
    });
  });

  it('reads the text colour from the first ÿc code only', () => {
    const chips = computeLabelChips(FILE) ?? [];
    expect(chips[2]).toMatchObject({ textColor: 'rgba(255, 77, 77, 1)', background: null, border: null, title: 'Rule 2 · text ÿc1 red' });
    // Rule 8 ("plain {name}") has no code: no chip.
    expect(chips.some((chip) => chip.title.startsWith('Rule 8'))).toBe(false);
  });

  it('gives a hide rule a chip only for its colours, without text colour', () => {
    const chips = computeLabelChips(FILE) ?? [];
    // Rule 5 hides without colours (rule 3 is the disabled one, at 2).
    expect(chips.some((chip) => chip.title.startsWith('Rule 5'))).toBe(false);
    expect(chips[3]).toMatchObject({
      textColor: null,
      background: `rgba(10, 20, 30, ${String(242 / 255)})`,
      title: 'Rule 6 · hidden · background 10,20,30',
    });
  });

  it("lets a rule's own colours win over the style's", () => {
    const chips = computeLabelChips(FILE) ?? [];
    expect(chips[4]).toMatchObject({
      textColor: expect.stringMatching(/^rgba\(/) as unknown,
      background: 'rgba(255, 255, 255, 1)',
      border: { color: 'rgba(1, 2, 3, 1)', width: 0 },
      title: 'Rule 7 · text ÿc4 gold · background 255,255,255 · border 1,2,3 (-1 px) · style Jackpot',
    });
  });

  it('numbers rules over the full list, disabled ones included', () => {
    const chips = computeLabelChips(FILE) ?? [];
    expect(chips[5]).toMatchObject({
      background: `rgba(0, 128, 0, ${String(242 / 255)})`,
      title: 'Rule 3 (disabled) · background 0,128,0',
    });
  });

  describe("Sully's template", () => {
    const text = readFileSync(resolve(process.cwd(), 'public/loot-filters/sullys-qol-filter.json'), 'utf8');
    const { filter } = parseLootFilter(text);

    it('marks every Jackpot rule with a white background and a red 2 px border, on the rule line', () => {
      const chips = computeLabelChips(text) ?? [];
      const jackpot = chips.filter((chip) => chip.title.endsWith('· style Jackpot'));
      const users = filter.rules.filter(
        (rule) => rule.useStyle === 'Jackpot' && rule.labelBackground === undefined && rule.labelBorder === undefined
      );
      expect(users.length).toBeGreaterThan(0);
      expect(jackpot).toHaveLength(users.length);
      for (const chip of jackpot) {
        expect(chip).toMatchObject({
          background: 'rgba(255, 255, 255, 1)',
          border: { color: `rgba(240, 0, 0, ${String(230 / 255)})`, width: 2 },
        });
        expect(text.charAt(chip.offset)).toBe('{');
      }
    });

    it('gives each style that sets a colour a chip at its key', () => {
      const chips = computeLabelChips(text) ?? [];
      const styled = Object.entries(filter.styles ?? {}).filter(([, style]) => style.labelBackground ?? style.labelBorder);
      for (const [name] of styled) {
        const chip = chips.find((candidate) => candidate.title.startsWith(`Style ${name} ·`));
        expect(chip && text.slice(chip.offset, chip.offset + name.length + 2)).toBe(`"${name}"`);
      }
    });

    it('is quick enough to run on every edit pause', () => {
      computeLabelChips(text);
      const start = performance.now();
      for (let i = 0; i < 10; i++) computeLabelChips(text);
      expect((performance.now() - start) / 10).toBeLessThan(50);
    });
  });
});

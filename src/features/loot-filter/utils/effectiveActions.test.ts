import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLootFilter } from '../engine/parse';
import type { LootFilter } from '../engine/types';
import {
  countActions,
  countStyleUsers,
  effectiveActions,
  mergeActions,
  previewLabelText,
  qualityNameColor,
  rulePreviewColor,
  ruleNameColor,
  styleNameColor,
} from './effectiveActions';

const filter: LootFilter = {
  formatVersion: 1,
  leadingComments: [],
  styles: {
    Loud: { sound: 'tink.mp3', labelBackground: [255, 255, 255], labelBorder: { color: [255, 0, 0], width: 1 }, passthrough: { x: 1 } },
  },
  rules: [{ useStyle: 'Loud' }, { useStyle: 'Loud', hide: true }, { useStyle: 'Other' }],
};

describe('effective actions', () => {
  it('puts the rule over the style, per key', () => {
    expect(mergeActions({ sound: 'gong.mp3', namePrefix: 'X' }, { sound: 'tink.mp3', notify: true })).toEqual({
      namePrefix: 'X',
      notify: true,
      sound: 'gong.mp3',
    });
  });

  it('applies the named style and leaves out passthrough', () => {
    const actions = effectiveActions({ useStyle: 'Loud', labelBackground: [0, 0, 0, 200] }, filter);
    expect(actions).toEqual({
      useStyle: 'Loud',
      labelBackground: [0, 0, 0, 200],
      labelBorder: { color: [255, 0, 0], width: 1 },
      sound: 'tink.mp3',
    });
  });

  it('ignores a missing or unset style', () => {
    expect(effectiveActions({ useStyle: 'Nope', hide: true }, filter)).toEqual({ useStyle: 'Nope', hide: true });
    expect(effectiveActions({ notify: false }, filter)).toEqual({ notify: false });
  });

  it('builds the preview label from prefix, name and suffix', () => {
    expect(previewLabelText({})).toBe('Item Name');
    expect(previewLabelText({ namePrefix: 'ÿc1* ', nameSuffix: ' {sockets}' })).toBe('ÿc1* Item Name {sockets}');
    expect(previewLabelText({ replaceName: { deDE: 'Rune', enUS: 'ÿc8{name} Rune' } })).toBe('ÿc8Item Name Rune');
  });

  it('counts actions and style users', () => {
    expect(countActions({ comment: 'x', hide: true, sound: 1 })).toBe(2);
    expect(countStyleUsers(filter, 'Loud')).toBe(2);
    expect(countStyleUsers(filter, 'Nope')).toBe(0);
  });
});

describe('name colours', () => {
  it('gives the quality colour only when every allowed quality shares it', () => {
    expect(qualityNameColor(undefined)).toBeUndefined();
    expect(qualityNameColor('unique')).toBe('D');
    expect(qualityNameColor(7)).toBe('D');
    expect(qualityNameColor(['normal', 'superior'])).toBe('=');
    expect(qualityNameColor({ max: 'superior' })).toBe('=');
    expect(qualityNameColor(['set', 'unique'])).toBeUndefined();
    expect(qualityNameColor({ min: 'magic' })).toBeUndefined();
    expect(qualityNameColor('nope' as never)).toBeUndefined();
    expect(qualityNameColor(42)).toBeUndefined();
    expect(qualityNameColor([7, 42])).toBe('D');
  });

  it("takes a rule's first visible colour code, else its quality colour", () => {
    const styled: LootFilter = { formatVersion: 1, leadingComments: [], styles: { Red: { namePrefix: 'ÿc1' } }, rules: [] };
    expect(ruleNameColor({ replaceName: 'ÿc;Su Rune' }, styled)).toBe(';');
    expect(ruleNameColor({ replaceName: 'Ring', namePrefix: 'Mythical ', quality: 'unique' }, styled)).toBe('D');
    expect(ruleNameColor({ useStyle: 'Red', quality: 'unique' }, styled)).toBe('1');
    expect(ruleNameColor({ replaceName: 'ÿc1 ÿc4Ber' }, styled)).toBe('4');
    expect(ruleNameColor({}, styled)).toBeUndefined();
  });

  it('gives a style the colour most of its rules name items in', () => {
    const voting: LootFilter = {
      formatVersion: 1,
      leadingComments: [],
      styles: { S: {} },
      rules: [
        { useStyle: 'S', quality: 'unique' },
        { useStyle: 'S', replaceName: 'ÿc1Ber' },
        { useStyle: 'S', replaceName: 'ÿc1Jah' },
        { useStyle: 'S' },
        { useStyle: 'T', replaceName: 'ÿc2X' },
      ],
    };
    expect(styleNameColor(voting, 'S')).toBe('1');
    expect(styleNameColor(voting, 'T')).toBe('2');
    expect(styleNameColor(voting, 'Nope')).toBeUndefined();
  });

  it("draws a rule's preview in its quality colour, else its style's", () => {
    const voting: LootFilter = {
      formatVersion: 1,
      leadingComments: [],
      styles: { S: {} },
      rules: [{ useStyle: 'S', replaceName: 'ÿc;Su Rune' }],
    };
    expect(rulePreviewColor({ useStyle: 'S' }, voting)).toBe(';');
    expect(rulePreviewColor({ useStyle: 'S', quality: 'unique' }, voting)).toBe('D');
    expect(rulePreviewColor({ useStyle: 'Nope' }, voting)).toBeUndefined();
    expect(rulePreviewColor({}, voting)).toBeUndefined();
  });

  // Sully's report: his style previews all drew white text. His styles set no name colour; his rules do.
  it("colours the previews of Sully's styles from his rules", () => {
    const file = 'src/features/loot-filter/engine/__fixtures__/sullys-qol-filter-0.9.2.json';
    const sully = parseLootFilter(readFileSync(resolve(process.cwd(), file), 'utf8')).filter;
    expect(styleNameColor(sully, 'Mythical')).toBe('D');
    expect(styleNameColor(sully, 'Jackpot')).toBe('1');
    expect(styleNameColor(sully, 'PurpleRune')).toBe(';');
    expect(styleNameColor(sully, 'GoldPlate')).toBe('6');
    expect(styleNameColor(sully, 'SetLabel')).toBe('C');
  });
});

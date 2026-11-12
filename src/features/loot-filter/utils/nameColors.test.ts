import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { parseLootFilter } from '../engine/parse';
import type { LootFilter, LootFilterRule } from '../engine/types';
import { buildLookup, EMPTY_LOOKUP } from './lookup';
import { qualityNameColor, ruleItemColor, ruleLabelNameColor, rulePreviewColor, styleNameColors } from './nameColors';

const readJson = (path: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
const lookup = buildLookup(
  readJson('public/game-data/lootfilter.json') as LootFilterDataBundle,
  readJson('public/game-data/types.json') as TypesBundle
);

const empty: LootFilter = { formatVersion: 1, leadingComments: [], rules: [] };
const itemColor = (rule: LootFilterRule, filter: LootFilter = empty) => ruleItemColor(rule, filter, lookup);

describe('qualityNameColor', () => {
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

  it("takes the filter's qualityColors", () => {
    expect(qualityNameColor('unique', { unique: 'ÿc;' })).toBe(';');
    expect(qualityNameColor(['set', 'unique'], { set: 'ÿc4' })).toBe('4'); // gold 4 and unique D draw alike
  });
});

describe('ruleItemColor', () => {
  it("names a rule's items in their own colour: ESR names, vanilla runes orange, quest gold", () => {
    expect(itemColor({ itemCodes: ['r36'] })).toBe('4'); // ÿc4No Rune
    expect(itemColor({ itemCodes: ['r84'] })).toBe('N'); // ÿcNMoon Rune
    expect(itemColor({ itemCodes: ['r50'] })).toBe(';'); // ÿc;Null Rune
    expect(itemColor({ itemCodes: ['gcv'] })).toBe(';'); // ÿc;Chipped Amethyst
    expect(itemColor({ itemCodes: ['01a'] })).toBe('4'); // ÿc4Ancient Scroll 1
    expect(itemColor({ itemCodes: ['r51', 'r83'] })).toBe('J'); // El, Zod: no code
    expect(itemColor({ itemCodes: ['vip', 'hst', 'box'] })).toBe('>'); // quest column, whatever the type
    // Inferred: only the quest column makes a name gold, so Key of Terror (type ques without it) is a plain white name
    expect(itemColor({ itemCodes: ['pk1'] })).toBe('=');
    expect(itemColor({ itemCodes: ['gld'] })).toBe('H');
  });

  it('reads the quality, ethereal and sockets conditions', () => {
    expect(itemColor({ itemCodes: ['hax'] })).toBeUndefined(); // any quality
    expect(itemColor({ itemCodes: ['hax'], quality: 'unique' })).toBe('D');
    expect(itemColor({ itemCodes: ['hax'], quality: ['normal', 'superior'] })).toBe('=');
    expect(itemColor({ itemCodes: ['hax'], quality: 'normal', sockets: { min: 2 } })).toBe('K');
    expect(itemColor({ itemCodes: ['hax'], quality: 'normal', sockets: [0, 2] })).toBe('=');
    expect(itemColor({ itemCodes: ['hax'], quality: 'normal', isEthereal: true })).toBe('I');
    expect(itemColor({ itemCodes: ['hax'], quality: 'unique', isEthereal: true, sockets: 3 })).toBe('D');
    expect(itemColor({ quality: 'magic' })).toBe('B');
    expect(itemColor({ quality: 'unique' }, { ...empty, qualityColors: { unique: 'ÿc;' } })).toBe(';');
    expect(itemColor({})).toBeUndefined();
  });

  it("names a base's uniques and sets in their rows' shared colour", () => {
    expect(itemColor({ itemCodes: ['ore'], quality: 'unique' })).toBe('7'); // the Uni Ore rows: ÿc7Ore
    expect(itemColor({ itemCodes: ['ore'] })).toBe('7'); // a shadow base: only its unique rows drop
    expect(itemColor({ itemCodes: ['ast'], quality: 'unique' })).toBe('@'); // ÿc@… Ascendancy Stone, over quest gold
    expect(itemColor({ itemCodes: ['ast'] })).toBeUndefined(); // quest gold unless unique
    expect(itemColor({ itemCodes: ['ast'], quality: 'normal' })).toBe('>');
    expect(itemColor({ itemCodes: ['hax'], quality: 'unique' })).toBe('D'); // its uniques have no colour code
  });

  it('reads uniqueOrSetIds against both tables, the quality telling which', () => {
    expect(itemColor({ uniqueOrSetIds: [674] })).toBe('7'); // Ore
    expect(itemColor({ uniqueOrSetIds: [1100, 1101] })).toBe('@');
    expect(itemColor({ uniqueOrSetIds: [674], quality: 'set' })).toBe('C'); // no set row 674: no vote, the quality tells
    const shared = lookup.sets.find((set) => lookup.uniqueOrSet(set.id, 'unique') !== undefined);
    if (shared === undefined) throw new Error('no id in both tables');
    expect(itemColor({ uniqueOrSetIds: [shared.id], quality: 'set' })).toBe('C');
    expect(itemColor({ uniqueOrSetIds: [shared.id], quality: 'unique' })).toBe('D');
    expect(itemColor({ uniqueOrSetIds: [shared.id] })).toBeUndefined(); // the unique gold or the set green
    expect(itemColor({ uniqueOrSetIds: [999999], itemCodes: ['r84'] })).toBe('N'); // no row: the codes tell
    expect(ruleItemColor({ uniqueOrSetIds: [674] }, empty, EMPTY_LOOKUP)).toBeUndefined();
  });

  it('takes the colour most of the codes have, ties to the first listed; undefined when most have none', () => {
    expect(itemColor({ itemCodes: ['r51', 'r84', 'r85'] })).toBe('N');
    expect(itemColor({ itemCodes: ['r84', 'r51'] })).toBe('N');
    expect(itemColor({ itemCodes: ['r51', 'r84'] })).toBe('J');
    expect(itemColor({ itemCodes: ['hax', 'axe', 'r51'] })).toBeUndefined();
  });

  it('reads the items of the item types when the rule lists no codes', () => {
    expect(itemColor({ itemTypes: ['rune'] })).toBe('J'); // most runes are vanilla
    expect(itemColor({ itemTypes: ['weap'] })).toBeUndefined(); // any quality
    expect(itemColor({ itemTypes: ['weap', 'armo'], quality: ['normal', 'superior'], sockets: { min: 2 } })).toBe('K');
    expect(itemColor({ itemTypes: ['char'], quality: 'magic' })).toBe('B');
    expect(itemColor({ itemTypes: ['gema'] })).toBe(';');
    expect(itemColor({ itemTypes: ['nope'], quality: 'set' })).toBe('C');
  });

  it('degrades without the game data: codes tell nothing, types tell what they are, the quality still tells', () => {
    expect(ruleItemColor({ itemCodes: ['r36'] }, empty, EMPTY_LOOKUP)).toBeUndefined();
    expect(ruleItemColor({ itemTypes: ['rune'] }, empty, EMPTY_LOOKUP)).toBe('J');
    expect(ruleItemColor({ itemCodes: ['r36'], quality: 'unique' }, empty)).toBe('D');
  });
});

/** A filter built from zero: styles without a name colour, rules with and without renames, qualities, codes. */
const scratch: LootFilter = {
  formatVersion: 1,
  leadingComments: [],
  styles: {
    Runes: { labelBorder: { color: [255, 168, 0], width: 1 } },
    Loud: { sound: 'tink.mp3' },
    Tagged: { nameSuffix: 'ÿc1 [tag]' },
    Starred: { namePrefix: 'ÿc1* ' },
    Fresh: { labelBackground: [40, 0, 60] },
    Unused: {},
  },
  rules: [
    { itemCodes: ['r51'], useStyle: 'Runes' },
    { itemCodes: ['r84'], useStyle: 'Runes' },
    { itemCodes: ['r52'], useStyle: 'Runes' },
    { itemTypes: ['weap'], quality: 'magic', hide: true, useStyle: 'Loud' },
    { itemTypes: ['armo'], quality: 'magic', hide: true, useStyle: 'Loud' },
    { quality: 'set', useStyle: 'Loud' },
    { quality: 'unique', useStyle: 'Loud' },
    { quality: 'unique', useStyle: 'Tagged' },
    { quality: 'rare', useStyle: 'Starred' },
    { itemCodes: ['r83'], replaceName: 'ÿc;Zod', useStyle: 'Fresh' },
    { itemTypes: ['weap'], useStyle: 'Fresh' },
  ],
};

describe('ruleLabelNameColor', () => {
  it('takes the colour code where the name stands, else the first visible text, else the rule items’ colour', () => {
    expect(ruleLabelNameColor({ quality: 'unique', useStyle: 'Tagged' }, scratch, lookup)).toBe('D');
    expect(ruleLabelNameColor({ quality: 'rare', useStyle: 'Starred' }, scratch, lookup)).toBe('1');
    expect(ruleLabelNameColor({ itemCodes: ['r83'], replaceName: 'ÿc;Zod' }, scratch, lookup)).toBe(';');
    expect(ruleLabelNameColor({ itemCodes: ['r83'], replaceName: 'Zod ÿc1!' }, scratch, lookup)).toBe('J');
    expect(ruleLabelNameColor({ itemCodes: ['r83'], namePrefix: 'ÿc1' }, scratch, lookup)).toBe('1');
    expect(ruleLabelNameColor({ quality: 'unique', hide: true }, scratch, lookup)).toBeUndefined();
    expect(ruleLabelNameColor({ itemTypes: ['weap'] }, scratch, lookup)).toBeUndefined();
  });
});

describe('styleNameColors', () => {
  const colors = styleNameColors(scratch, lookup);

  it('gives each style the colour most of its rules draw the name in', () => {
    expect(colors.get('Runes')).toBe('J'); // El and Ral orange, Moon turquoise
    expect(colors.get('Starred')).toBe('1');
    expect(colors.get('Fresh')).toBe(';'); // the weapons rule tells nothing
  });

  it('skips rules that hide the label, and breaks ties for the earlier rule', () => {
    expect(colors.get('Loud')).toBe('C'); // set before unique; the two hidden magic rules do not count
  });

  it('skips disabled rules (they never reach the game)', () => {
    const withDisabled: LootFilter = {
      ...scratch,
      rules: [...scratch.rules, ...[1, 2, 3].map(() => ({ itemCodes: ['r84'], useStyle: 'Runes', disabled: true as const }))],
    };
    expect(styleNameColors(withDisabled, lookup).get('Runes')).toBe('J');
    expect(styleNameColors({ ...scratch, rules: [{ quality: 'unique', useStyle: 'Unused', disabled: true }] }, lookup).has('Unused')).toBe(
      false
    );
  });

  it('draws the name segment in the item colour, not the colour a suffix sets', () => {
    expect(colors.get('Tagged')).toBe('D');
  });

  it('has no entry for a style no rule tells about', () => {
    expect(colors.has('Unused')).toBe(false);
    expect(styleNameColors(scratch).get('Runes')).toBeUndefined(); // without the data runes by code tell nothing
  });
});

describe('rulePreviewColor', () => {
  it("uses the rule's item colour, and its style's colour only when the rule tells nothing", () => {
    expect(rulePreviewColor({ useStyle: 'Runes' }, scratch, lookup)).toBe('J'); // a new rule with just a style
    expect(rulePreviewColor({ useStyle: 'Runes', quality: 'normal', itemCodes: ['hax'] }, scratch, lookup)).toBe('=');
    expect(rulePreviewColor({ useStyle: 'Runes', itemCodes: ['r84'] }, scratch, lookup)).toBe('N');
    expect(rulePreviewColor({ useStyle: 'Loud', itemTypes: ['weap'] }, scratch, lookup)).toBe('C');
    expect(rulePreviewColor({ useStyle: 'Nope' }, scratch, lookup)).toBeUndefined();
    expect(rulePreviewColor({}, scratch, lookup)).toBeUndefined();
  });
});

// Sully's report: his style previews all drew white text. His styles set no name colour; his rules do.
describe("Sully's filter", () => {
  const file = 'src/features/loot-filter/engine/__fixtures__/sullys-qol-filter-0.9.2.json';
  const sully = parseLootFilter(readFileSync(resolve(process.cwd(), file), 'utf8')).filter;
  if (sully === null) throw new Error('fixture did not parse');
  const rule = (id: string): LootFilterRule => {
    const found = sully.rules.find((entry) => entry.comment?.startsWith(`${id} |`) === true);
    if (found === undefined) throw new Error(`no rule ${id}`);
    return found;
  };
  const colors = styleNameColors(sully, lookup);
  const preview = (id: string) => rulePreviewColor(rule(id), sully, lookup, colors);

  it("colours his rules' previews by their items", () => {
    expect(preview('R260')).toBe('>'); // QuestLabel: quest items
    expect(preview('R267')).toBe('K'); // BaseSockets: white bases with 2+ sockets
    expect(preview('R269')).toBe('I'); // BaseTop: ethereal elite white bases
    expect(preview('R157')).toBe('D'); // Mythical: a unique
    expect(preview('R231')).toBe('N'); // the ESR runes r84-r97 are turquoise
    expect(preview('R226')).toBe(';'); // Su Rune, renamed ÿc;Su Rune, is purple in ESR too
    expect(ruleLabelNameColor(rule('R226'), sully, lookup)).toBe(';');
    // Lem, Pul, Um (orange), their decals (gold) and the eastern runes Ni-Mo and Hu (ÿc2, green): most are green
    expect(preview('R259')).toBe('2');
  });

  it('colours the previews of his styles from his rules', () => {
    expect(colors.get('Mythical')).toBe('D');
    expect(colors.get('Jackpot')).toBe('1');
    expect(colors.get('PurpleRune')).toBe(';');
    expect(colors.get('GoldPlate')).toBe('6');
    expect(colors.get('SetLabel')).toBe('C');
    expect(colors.get('QuestLabel')).toBe('>');
    expect(colors.get('BaseSockets')).toBe('K');
    expect(colors.get('MidRune')).toBe('2');
  });
});

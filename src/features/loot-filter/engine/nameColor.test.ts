import { isBrokenItem, itemNameColor, qualityColorCode, sameLabelColor, type NameColorItem } from './nameColor.ts';

const NORMAL = 2;
const MAGIC = 4;
const SET = 5;
const UNIQUE = 7;

const item = (fields: Partial<NameColorItem> = {}): NameColorItem => ({
  quality: NORMAL,
  typeAncestors: ['axe', 'weap'],
  isEthereal: false,
  sockets: 0,
  ...fields,
});

describe('itemNameColor', () => {
  it('names an item in its quality colour', () => {
    expect(itemNameColor(item())).toBe('=');
    expect(itemNameColor(item({ quality: MAGIC }))).toBe('B');
    expect(itemNameColor(item({ quality: UNIQUE }))).toBe('D');
    expect(itemNameColor(item({ quality: 9 }))).toBe('A');
    expect(itemNameColor(item({ quality: 42 }))).toBe('=');
  });

  it("takes the filter's qualityColors when an entry is one colour code", () => {
    expect(itemNameColor(item({ quality: UNIQUE }), { unique: 'ÿc;' })).toBe(';');
    expect(itemNameColor(item(), { normal: 'ÿc5' })).toBe('5');
    expect(itemNameColor(item({ quality: UNIQUE }), { unique: 'purple' })).toBe('D');
    expect(itemNameColor(item({ quality: UNIQUE }), { unique: 'ÿcW' })).toBe('D');
    expect(itemNameColor(item({ quality: UNIQUE }), { unique: 'ÿc;ÿc1' })).toBe('D');
  });

  it("names a white item in its base name's own colour (ESR names), before every other colour", () => {
    const noRune = item({ typeAncestors: ['rune', 'sock', 'misc'], baseNameColor: '4' });
    expect(itemNameColor(noRune)).toBe('4');
    expect(itemNameColor({ ...noRune, isQuest: true, sockets: 2 }, { normal: 'ÿc1' })).toBe('4');
    expect(itemNameColor(item({ baseNameColor: ';', quality: 3 }))).toBe(';');
  });

  it("names a unique or set item in the unique's own colour, not the base's; other qualities in neither", () => {
    const ore = item({ quality: UNIQUE, baseNameColor: '4', uniqueNameColor: '7' });
    expect(itemNameColor(ore)).toBe('7');
    expect(itemNameColor({ ...ore, quality: SET })).toBe('7');
    expect(itemNameColor(item({ quality: UNIQUE, baseNameColor: '4' }))).toBe('D');
    expect(itemNameColor({ ...ore, quality: MAGIC })).toBe('B');
  });

  it('keeps quest gold, rune orange, the potion and gold colours over the quality colour and its override', () => {
    expect(itemNameColor(item({ isQuest: true, quality: UNIQUE }), { unique: 'ÿc1' })).toBe('>');
    expect(itemNameColor(item({ typeAncestors: ['rune', 'sock', 'misc'] }), { normal: 'ÿc1' })).toBe('J');
    expect(itemNameColor(item({ typeAncestors: ['hpot', 'poti', 'misc'] }))).toBe('E');
    expect(itemNameColor(item({ typeAncestors: ['mpot', 'poti', 'misc'] }))).toBe('F');
    expect(itemNameColor(item({ typeAncestors: ['rpot', 'hpot', 'mpot', 'poti', 'misc'] }))).toBe('G');
    expect(itemNameColor(item({ typeAncestors: ['gold', 'misc'] }), { normal: 'ÿc1' })).toBe('H');
  });

  it('grays socketed and ethereal white items only (socketed first), over the normal-quality override', () => {
    expect(itemNameColor(item({ sockets: 3 }), { normal: 'ÿc1' })).toBe('K');
    expect(itemNameColor(item({ isEthereal: true, quality: 1 }))).toBe('I');
    expect(itemNameColor(item({ isEthereal: true, sockets: 2 }))).toBe('K');
    expect(itemNameColor(item({ isEthereal: true, sockets: 4, quality: UNIQUE }))).toBe('D');
    expect(itemNameColor(item({ sockets: 2, quality: MAGIC }))).toBe('B');
  });

  it('draws a broken item red, after the name, quest and type colours', () => {
    expect(itemNameColor(item({ isBroken: true, quality: UNIQUE }))).toBe('1');
    expect(itemNameColor(item({ isBroken: true, sockets: 2 }))).toBe('1');
    expect(itemNameColor(item({ isBroken: true, isQuest: true }))).toBe('>');
  });
});

describe('isBrokenItem', () => {
  it('is broken at durability 0 of a maximum above 0, unless indestructible', () => {
    expect(isBrokenItem([])).toBe(false);
    expect(isBrokenItem([{ stat: 72, value: 0 }])).toBe(false);
    expect(
      isBrokenItem([
        { stat: 72, value: 0 },
        { stat: 73, value: 30 },
      ])
    ).toBe(true);
    expect(
      isBrokenItem([
        { stat: 72, value: 4 },
        { stat: 73, value: 30 },
      ])
    ).toBe(false);
    expect(
      isBrokenItem([
        { stat: 72, value: 0 },
        { stat: 73, value: 30 },
        { stat: 152, value: 1 },
      ])
    ).toBe(false);
  });
});

describe('label colour helpers', () => {
  it('reads a quality colour, the override first', () => {
    expect(qualityColorCode(6)).toBe('?');
    expect(qualityColorCode(6, { rare: 'ÿc9' })).toBe('9');
    expect(qualityColorCode(0)).toBeUndefined();
  });

  it('tells codes the label draws alike', () => {
    expect(sameLabelColor('I', 'K')).toBe(true);
    expect(sameLabelColor('=', 'H')).toBe(true);
    expect(sameLabelColor('=', '0')).toBe(false);
    expect(sameLabelColor('W', 'W')).toBe(true);
    expect(sameLabelColor('W', 'X')).toBe(false);
  });
});

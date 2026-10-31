import { buildPickerOptions, EMPTY_LOOKUP, itemMutedState } from './lookup';
import { filterPickerOptions } from './pickerSearch';
import { TEST_DATA, TEST_LOOKUP, TEST_TYPES } from './testLookup.mock';

describe('buildLookup', () => {
  it('names codes and ids, tolerating unknown keys', () => {
    expect(TEST_LOOKUP.itemName('r33')).toBe('Zod Rune');
    expect(TEST_LOOKUP.itemName('nope')).toBeUndefined();
    expect(TEST_LOOKUP.typeName('axe')).toBe('Axe');
    expect(TEST_LOOKUP.statName(194)).toBe('item_numsockets');
    expect(TEST_LOOKUP.statName('strength')).toBe('strength');
    expect(TEST_LOOKUP.statName('nope')).toBeUndefined();
    expect(TEST_LOOKUP.statName(300)).toBeUndefined();
    expect(TEST_LOOKUP.statId('item_numsockets')).toBe(194);
    expect(TEST_LOOKUP.statId(0)).toBe(0);
    expect(TEST_LOOKUP.areaName(40)).toBe('Lut Gholein');
    expect(TEST_LOOKUP.uniqueOrSetName(0)).toBe('The Gnasher');
    expect(TEST_LOOKUP.uniqueOrSetName(5)).toBe("Harlequin Crest / Civerb's Ward");
    expect(TEST_LOOKUP.uniqueOrSetName(9)).toBeUndefined();
  });

  it('names the params of layered stats by name or id', () => {
    expect(TEST_LOOKUP.statParamLabel('item_addskill_tab', 50)).toBe('Martial Arts (Assassin)');
    expect(TEST_LOOKUP.statParamLabel(188, 10)).toBe('Cold Skills (Sorceress)');
    expect(TEST_LOOKUP.statParamLabel(83, 1)).toBe('Sorceress');
    expect(TEST_LOOKUP.statParamLabel(107, 47)).toBe('Fire Ball');
    expect(TEST_LOOKUP.statParamLabel('item_skillonhit', 30233)).toBe('Orb of Winter lvl 25');
    expect(TEST_LOOKUP.statParamLabel(204, 2307)).toBe('Fire Bolt lvl 3');
    // Not layered, not decodable, unknown skill
    expect(TEST_LOOKUP.statParamLabel('strength', 1)).toBeUndefined();
    expect(TEST_LOOKUP.statParamLabel(188, 21)).toBeUndefined();
    expect(TEST_LOOKUP.statParamLabel(107, 9999)).toBeUndefined();
    expect(TEST_LOOKUP.statParamLabel(198, 30208)).toBeUndefined();
  });

  it('has an empty variant that knows nothing', () => {
    expect(EMPTY_LOOKUP.statParamLabel('item_addskill_tab', 50)).toBeUndefined();
    expect(EMPTY_LOOKUP.itemName('r33')).toBeUndefined();
    expect(EMPTY_LOOKUP.uniqueOrSetName(5)).toBeUndefined();
  });
});

describe('buildPickerOptions', () => {
  const options = buildPickerOptions(TEST_DATA, TEST_TYPES);

  it('marks non-spawnable items as shadow bases', () => {
    expect(options.items.find((option) => option.value === 'xyz')).toMatchObject({ muted: true, hint: 'shadow base' });
    expect(options.items.find((option) => option.value === 'hax')).toMatchObject({ muted: false, hint: undefined });
  });

  it('mutes misc items only when they never drop, and names shadow bases apart', () => {
    const misc = buildPickerOptions(
      {
        ...TEST_DATA,
        items: [
          { code: '01b', name: 'Ancient Scroll', kind: 'misc', type: 'scrl', spawnable: false, drops: true },
          { code: 'r48', name: 'Hu Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
          { code: 'xyz', name: 'Unused', kind: 'misc', type: 'rune', spawnable: false, drops: false },
          { code: 'dd1', name: 'Mythical Blade', kind: 'weapon', type: 'swor', spawnable: false, drops: true },
        ],
      },
      TEST_TYPES
    );
    expect(misc.items.map((option) => [option.value, option.muted, option.hint])).toEqual([
      ['01b', false, undefined],
      ['r48', false, undefined],
      ['xyz', true, 'never drops'],
      ['dd1', true, 'shadow base'],
    ]);
    expect(itemMutedState({ code: 'xyz', name: '', kind: 'misc', type: 'rune', spawnable: false, drops: false }).title).toMatch(
      /^Never drops/
    );
    expect(itemMutedState({ code: 'dd1', name: '', kind: 'weapon', type: 'swor', spawnable: false, drops: true }).title).toMatch(
      /^Shadow base/
    );
  });

  it('adds the code to the label of unmuted items sharing a display name, still found by the plain name', () => {
    const runes = buildPickerOptions(
      {
        ...TEST_DATA,
        items: [
          { code: 'r19', name: 'Ko Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
          { code: 'r68', name: 'Ko Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
          { code: 'r20', name: 'Fal Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
          { code: 'r32', name: 'Fu Rune', kind: 'misc', type: 'rune', spawnable: true, drops: true },
          { code: 'r48', name: 'Fu Rune', kind: 'misc', type: 'rune', spawnable: true, drops: false },
          { code: 'hax', name: 'Hand Axe', kind: 'weapon', type: 'axe', spawnable: true, drops: true },
          { code: 'p01', name: 'Hand Axe', kind: 'weapon', type: 'axe', spawnable: false, drops: false },
        ],
      },
      TEST_TYPES
    );
    expect(runes.items.map((option) => [option.label, option.hint])).toEqual([
      ['Ko Rune (r19)', undefined],
      ['Ko Rune (r68)', undefined],
      ['Fal Rune', undefined],
      ['Fu Rune', undefined],
      ['Fu Rune', 'never drops'],
      ['Hand Axe', undefined],
      ['Hand Axe', 'shadow base'],
    ]);
    expect(filterPickerOptions(runes.items, 'ko rune').matches.map((option) => option.value)).toEqual(['r19', 'r68']);
  });

  it("shows the item's type and searches its types' names and codes, type2 included", () => {
    const hax = options.items.find((option) => option.value === 'hax');
    expect(hax?.detail).toBe('hax · Axe');
    expect(hax?.search).toBe('hand axe hax');
    const withType2 = buildPickerOptions(
      {
        ...TEST_DATA,
        items: [{ code: 'hax', name: 'Hand Axe', kind: 'weapon', type: 'axe', type2: 'thro', spawnable: true, drops: true }],
      },
      {
        ...TEST_TYPES,
        types: [...TEST_TYPES.types, { ...TEST_TYPES.types[1], code: 'thro', name: 'Throwing Weapon', ancestors: ['thro'] }],
      }
    );
    expect(withType2.items[0]?.searchMore).toBe('axe axe weapon weap throwing weapon thro');
  });

  it('finds items through their type, after the name matches', () => {
    expect(filterPickerOptions(options.items, 'weapon').matches.map((option) => option.value)).toEqual(['hax', 'xyz']);
    expect(filterPickerOptions(options.items, 'axe').matches.map((option) => option.value)).toEqual(['hax', 'xyz']);
  });

  it('keeps gloves out of a "helm" search: ESR names the merc equipment type Helm', () => {
    const helmTypes = buildPickerOptions(
      {
        ...TEST_DATA,
        items: [
          { code: 'cap', name: 'Cap', kind: 'armor', type: 'helm', spawnable: true, drops: true },
          { code: 'lgl', name: 'Leather Gloves', kind: 'armor', type: 'glov', spawnable: true, drops: true },
        ],
      },
      {
        ...TEST_TYPES,
        types: [
          { ...TEST_TYPES.types[1], code: 'merc', name: 'Helm (merc)', parents: [], ancestors: ['merc'] },
          { ...TEST_TYPES.types[1], code: 'helm', name: 'Helm', parents: ['merc'], ancestors: ['helm', 'merc'] },
          { ...TEST_TYPES.types[1], code: 'glov', name: 'Gloves', parents: ['merc'], ancestors: ['glov', 'merc'] },
        ],
      }
    );
    expect(filterPickerOptions(helmTypes.items, 'helm').matches.map((option) => option.value)).toEqual(['cap']);
    expect(filterPickerOptions(helmTypes.items, 'merc').matches).toEqual([]);
    expect(filterPickerOptions(helmTypes.items, 'gloves').matches.map((option) => option.value)).toEqual(['lgl']);
  });

  it('lists type parents by name', () => {
    expect(options.types.find((option) => option.value === 'rune')?.detail).toBe('rune · in Miscellaneous');
  });

  it('drops nameless stats and groups areas by act', () => {
    expect(options.stats.map((option) => option.value)).toEqual([
      'strength',
      'item_numsockets',
      'item_addclassskills',
      'item_singleskill',
      'item_addskill_tab',
      'item_skillonhit',
      'item_charged_skill',
    ]);
    expect(options.areas.map((option) => [option.value, option.group])).toEqual([
      ['1', 'Act 1'],
      ['2', 'Act 1'],
      ['40', 'Act 2'],
    ]);
  });

  it('keeps uniques and sets apart even when they share an id', () => {
    const fives = options.uniquesAndSets.filter((option) => option.value === '5');
    expect(fives.map((option) => [option.key, option.group, option.detail])).toEqual([
      ['Unique:5', 'Uniques', 'uap · 5'],
      ['Set:5', 'Sets', 'lrg · 5'],
    ]);
  });
});

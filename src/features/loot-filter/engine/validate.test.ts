import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseLootFilter } from './parse.ts';
import type { Diagnostic, LootFilter, LootFilterReference, LootFilterRule, StatCheck } from './types.ts';
import { validateLootFilter } from './validate.ts';

const base: LootFilter = {
  formatVersion: 1,
  filterLevels: [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ],
  defaultLevel: 1,
  styles: { S: { sound: 'x.mp3' } },
  rules: [],
  leadingComments: [],
};

/** Validates a filter with one rule; returns `[severity, path]` pairs. */
function checkRule(rule: LootFilterRule, reference?: LootFilterReference): [string, string][] {
  return validateLootFilter({ ...base, rules: [rule] }, reference).map((d) => [d.severity, d.path]);
}

const reference: LootFilterReference = {
  itemCodes: new Set(['r01', 'hax', 'cap', 'dbl']),
  itemTypes: new Set(['rune', 'misc', 'weap', 'axe', 'club', 'blun', 'helm', 'armo']),
  statNames: new Set(['item_numsockets', 'item_addskill_tab', 'item_skillonhit', 'item_charged_skill']),
  statIds: new Set([194, 188, 198, 204]),
  statNamesById: new Map([
    [194, 'item_numsockets'],
    [188, 'item_addskill_tab'],
    [198, 'item_skillonhit'],
    [204, 'item_charged_skill'],
  ]),
  skillTabNames: new Map([
    [50, 'Assassin Martial Arts'],
    [56, 'Warlock Demon Skills'],
  ]),
  areaIds: new Set([1, 2]),
  soundNames: new Set(['item_rune']),
  soundRowCount: 100,
  uniqueOrSetIds: new Set([0, 1]),
  itemCodeTypes: new Map([
    ['r01', new Set(['rune', 'misc'])],
    ['hax', new Set(['axe', 'weap'])],
    ['cap', new Set(['helm', 'armo'])],
    // A base with a type2 counts as both types.
    ['dbl', new Set(['axe', 'club', 'blun', 'weap'])],
  ]),
  typeAncestors: new Map([
    ['helm', new Set(['helm', 'armo'])],
    ['axe', new Set(['axe', 'weap'])],
    ['rune', new Set(['rune', 'misc'])],
  ]),
};

/** The messages of the rule's diagnostics (`null` validates without a reference). */
function messages(rule: LootFilterRule, ref: LootFilterReference | null = reference): string[] {
  return validateLootFilter({ ...base, rules: [rule] }, ref ?? undefined).map((d) => `${d.path}: ${d.message}`);
}

describe('validateLootFilter', () => {
  it('finds no errors in Sully’s filter', () => {
    const source = readFileSync(resolve(__dirname, '../../../../public/loot-filters/sullys-qol-filter.json'), 'utf-8');
    const diagnostics = validateLootFilter(parseLootFilter(source).filter);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // It has no warnings either without a reference. Against the real game-data reference (ESR 3.2.24, Sully v0.6.3) it
    // gets 42 param warnings: its +3/4/5 skill tab rules write stat 188 without param and with the properties.txt tab
    // numbers 1 to 21, of which 14 name no skill tab layer (`class << 3 | tab`).
    expect(diagnostics).toEqual([]);
  });

  it('accepts a plain valid rule', () => {
    expect(checkRule({ itemCodes: ['r01'], useStyle: 'S', activeInLevels: [2] }, reference)).toEqual([]);
  });

  it('reports a missing style', () => {
    expect(checkRule({ itemCodes: ['r01'], useStyle: 'Nope' })).toEqual([['error', 'rules/0/useStyle']]);
  });

  it('checks "between" against the value shape', () => {
    expect(checkRule({ itemStats: [{ stat: 1, op: 'between', value: 3 }], hide: true })).toEqual([['error', 'rules/0/itemStats/0/value']]);
    expect(checkRule({ itemStats: [{ stat: 1, value: [1, 2] }], hide: true })).toEqual([['error', 'rules/0/itemStats/0/value']]);
    expect(checkRule({ itemStats: [{ stat: 1, op: 'between', value: [1, 2] }], hide: true })).toEqual([]);
  });

  it('checks levels', () => {
    const diagnostics = validateLootFilter({
      ...base,
      filterLevels: [
        { id: 1, name: 'A' },
        { id: 1, name: 'B' },
      ],
      defaultLevel: 3,
      rules: [{ hide: true, activeInLevels: [1, 5] }],
    });
    expect(diagnostics.map((d) => [d.severity, d.path, d.rule])).toEqual([
      ['error', 'filterLevels/1/id', undefined],
      ['error', 'defaultLevel', undefined],
      ['error', 'rules/0/activeInLevels/1', 0],
    ]);
    const noLevels = validateLootFilter({ formatVersion: 1, rules: [{ hide: true, activeInLevels: [1] }], leadingComments: [] });
    expect(noLevels.map((d) => d.path)).toEqual(['rules/0/activeInLevels/0']);
  });

  it('reports unknown named values', () => {
    expect(checkRule({ quality: 0, baseTier: 3, difficulty: [0, 2], hide: true })).toEqual([
      ['error', 'rules/0/quality'],
      ['error', 'rules/0/baseTier'],
    ]);
    // A model built in code may hold names the parser would refuse.
    const rule = JSON.parse('{"quality": "legendary", "hide": true}') as LootFilterRule;
    expect(checkRule(rule)).toEqual([['error', 'rules/0/quality']]);
    expect(checkRule({ quality: { min: 'unique', max: 'magic' }, hide: true })).toEqual([['warning', 'rules/0/quality']]);
  });

  it('checks colours, border width, icon size and volume', () => {
    expect(
      checkRule({
        hide: true,
        labelBackground: [0, 300, 0],
        labelBorder: { color: [1, 2, 3, 4], width: -1 },
        icon: { iconName: 'x', iconSize: 2, color: [0, 0, 0, 1.5] },
        droplight: { color: JSON.parse('[1, 2, 3, 4]') as [number, number, number] },
        soundVolume: 101,
      })
    ).toEqual([
      ['error', 'rules/0/labelBackground/1'],
      ['error', 'rules/0/labelBorder/width'],
      ['error', 'rules/0/icon/iconSize'],
      ['error', 'rules/0/icon/color/3'],
      ['error', 'rules/0/droplight/color'],
      ['error', 'rules/0/soundVolume'],
    ]);
    const top = validateLootFilter({ ...base, soundVolume: -1 });
    expect(top.map((d) => d.path)).toEqual(['soundVolume']);
  });

  it('reports an unknown stat op', () => {
    const check = JSON.parse('{"stat": 1, "op": "=>", "value": 1}') as { stat: number; value: number };
    expect(checkRule({ itemStats: [check], hide: true })).toEqual([['error', 'rules/0/itemStats/0/op']]);
  });

  it('reports a style that uses a style, and checks style actions', () => {
    const diagnostics = validateLootFilter({ ...base, styles: { S: { useStyle: 'S', soundVolume: 200 } } });
    expect(diagnostics.map((d): [string, string | undefined] => [d.path, d.style])).toEqual([
      ['styles/S/useStyle', 'S'],
      ['styles/S/soundVolume', 'S'],
    ]);
  });

  it('warns about rules that do nothing', () => {
    expect(checkRule({})).toEqual([['warning', 'rules/0']]);
    expect(checkRule({ comment: 'x' })).toEqual([['warning', 'rules/0']]);
    expect(checkRule({ itemCodes: ['r01'] })).toEqual([['warning', 'rules/0']]);
    expect(checkRule({ itemCodes: ['r01'], comment: 'only a note' })).toEqual([['warning', 'rules/0']]);
    expect(checkRule({ chatMessage: 'everything' })).toEqual([]);
  });

  it('warns about hideIfOtherConditionsFail without codes or types', () => {
    expect(checkRule({ sockets: 2, hideIfOtherConditionsFail: true })).toEqual([['warning', 'rules/0/hideIfOtherConditionsFail']]);
    expect(checkRule({ itemTypes: ['weap'], sockets: 2, hideIfOtherConditionsFail: true })).toEqual([]);
  });

  it('warns about numbers outside the guide’s ranges and empty ranges', () => {
    expect(checkRule({ itemLevel: 1000, sockets: [1, 100], maxSockets: { min: 5, max: 3 }, hide: true })).toEqual([
      ['warning', 'rules/0/itemLevel'],
      ['warning', 'rules/0/sockets/1'],
      ['warning', 'rules/0/maxSockets'],
    ]);
    expect(checkRule({ itemLevel: { min: -1 }, hide: true })).toEqual([['warning', 'rules/0/itemLevel/min']]);
  });

  it('warns about ground-only actions on a rule that does not look at the ground', () => {
    expect(checkRule({ location: ['stored'], labelBackground: [0, 0, 0], droplight: {}, namePrefix: 'x' })).toEqual([
      ['warning', 'rules/0/labelBackground'],
      ['warning', 'rules/0/droplight'],
    ]);
    expect(checkRule({ location: ['stored', 'onGround'], labelBackground: [0, 0, 0] })).toEqual([]);
  });

  it("counts a style's ground-only actions for a rule that does not look at the ground", () => {
    const filter: LootFilter = {
      ...base,
      styles: { Bg: { labelBackground: [0, 0, 0] } },
      rules: [{ location: ['stored'], useStyle: 'Bg' }],
    };
    expect(validateLootFilter(filter).map((d) => [d.severity, d.path])).toEqual([['warning', 'rules/0/labelBackground']]);
  });

  it('reports a stat check without a stat, with or without a reference', () => {
    expect(checkRule({ itemStats: [{ stat: '', value: 1 }], hide: true })).toEqual([['error', 'rules/0/itemStats/0/stat']]);
    expect(checkRule({ itemStats: [{ stat: '', value: 1 }], hide: true }, reference)).toEqual([['error', 'rules/0/itemStats/0/stat']]);
  });

  it('warns about a stat id written as a string', () => {
    const diagnostics = validateLootFilter({ ...base, rules: [{ itemStats: [{ stat: '194', value: 1 }], hide: true }] }, reference);
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'warning', path: 'rules/0/itemStats/0/stat' })]);
    expect(diagnostics[0].message).toMatch(/as a number/);
  });

  describe('stat params', () => {
    const tab = (check: Partial<StatCheck>): StatCheck => ({ stat: 'item_addskill_tab', value: 1, ...check });

    it('needs a whole param from 0 to 65535', () => {
      expect(messages({ itemStats: [{ stat: 'item_numsockets', param: 1.5, value: 1 }], hide: true })).toEqual([
        'rules/0/itemStats/0/param: "param" 1.5 is not a whole number from 0 to 65535',
      ]);
      expect(checkRule({ playerStats: [tab({ param: 70000 })], hide: true }, reference)).toEqual([
        ['error', 'rules/0/playerStats/0/param'],
      ]);
    });

    it('warns about a layered stat without param, by name without a reference and by id with one', () => {
      expect(messages({ itemStats: [tab({})], hide: true }, null)).toEqual([
        'rules/0/itemStats/0: "item_addskill_tab" has one entry per skill tab; without "param" this check is taken to hold when any skill tab passes (not verified in game: the plugin may read only param 0). Pick a skill tab to check one',
      ]);
      expect(checkRule({ playerStatsAnyOf: [{ stat: 198, value: 1 }], hide: true }, reference)).toEqual([
        ['warning', 'rules/0/playerStatsAnyOf/0'],
      ]);
      expect(checkRule({ itemStats: [{ stat: 198, value: 1 }], hide: true })).toEqual([]);
      expect(checkRule({ itemStats: [tab({ param: 50 })], hide: true }, reference)).toEqual([]);
    });

    it('warns about exceptions without param too, and says when they are not the opposite check', () => {
      const exception = messages({ itemStats: [tab({ op: '<', value: 1 })], hide: true });
      expect(exception).toEqual([
        expect.stringMatching(/^rules\/0\/itemStats\/0: "item_addskill_tab" has one entry per skill tab; .*check one$/),
      ]);
      const atLeast3 = messages({ itemStatsAnyOf: [tab({ op: '<', value: 3 })], hide: true });
      expect(atLeast3).toEqual([
        expect.stringMatching(/An exception without param is not the opposite check when the item has several entries/),
      ]);
      // Not an exception: the rule does not hide
      expect(messages({ itemStats: [tab({ op: '<', value: 3 })], namePrefix: 'x' })[0]).not.toMatch(/exception/);
    });

    it('names the layer of a properties.txt tab number', () => {
      expect(messages({ itemStats: [tab({ param: 21 })], hide: true })).toEqual([
        'rules/0/itemStats/0/param: "param" 21 names no skill tab (class × 8 + tab 0 to 2); 21 looks like the properties.txt tab number: Warlock Demon Skills is param 56',
      ]);
      expect(messages({ itemStats: [tab({ param: 99 })], hide: true })).toEqual([
        'rules/0/itemStats/0/param: "param" 99 names no skill tab (class × 8 + tab 0 to 2)',
      ]);
    });

    it('warns about event and charged params without a skill or level', () => {
      const onHit = (param: number): StatCheck => ({ stat: 'item_skillonhit', param, value: 1 });
      expect(messages({ itemStats: [onHit(25)], hide: true })).toEqual([
        expect.stringMatching(/^rules\/0\/itemStats\/0\/param: "param" 25 names skill 0/),
      ]);
      expect(messages({ itemStats: [onHit(472 << 6)], hide: true })).toEqual([expect.stringMatching(/names level 0/)]);
      expect(messages({ itemStats: [onHit((472 << 6) | 25)], hide: true })).toEqual([]);
    });

    it('warns about a charged value that is neither presence nor a multiple of 256', () => {
      const charged = (check: Partial<StatCheck>): StatCheck => ({ stat: 204, param: (472 << 6) | 25, value: 1, ...check });
      const flagged = (check: Partial<StatCheck>) => checkRule({ itemStats: [charged(check)], hide: true }, reference);
      for (const ok of [{}, { op: '>', value: 0 }, { op: '<', value: 1 }, { value: 1280 }, { op: '<', value: 2560 }] as const)
        expect(flagged(ok)).toEqual([]);
      expect(flagged({ value: 5 })).toEqual([['warning', 'rules/0/itemStats/0/value']]);
      expect(flagged({ op: '==', value: 1285 })).toEqual([['warning', 'rules/0/itemStats/0/value']]);
    });
  });

  describe('stats the plugin reads as 0', () => {
    const quirkReference: LootFilterReference = {
      ...reference,
      itemCodes: new Set([...reference.itemCodes, 'jew', 'cm1']),
      itemTypes: new Set([...reference.itemTypes, 'jewl', 'char', 'scha']),
      statNames: new Set([...reference.statNames, 'item_maxdamage_percent', 'item_armor_percent', 'item_maxdurability_percent']),
      statIds: new Set([...reference.statIds, 16, 17, 18, 75]),
      itemCodeTypes: new Map([...reference.itemCodeTypes, ['jew', new Set(['jewl', 'misc'])], ['cm1', new Set(['scha', 'char', 'misc'])]]),
    };
    const quirks = (rule: LootFilterRule, ref: LootFilterReference | null = quirkReference) => messages(rule, ref);
    const ed = (stat: string | number) => ({ stat, value: 1 });

    it('warns about Enhanced Damage (17 and 18, by name or id) in the item stat lists', () => {
      expect(quirks({ itemTypes: ['weap'], itemStats: [ed('item_maxdamage_percent')], hide: true })).toEqual([
        "rules/0/itemStats/0/stat: The game keeps Enhanced Damage off a weapon's stats, so the plugin reads 0 here on weapons (it should still work on jewels and charms). Reported to the mod author.",
      ]);
      expect(quirks({ itemStatsAnyOf: [ed(18), ed('item_numsockets'), ed(17)], hide: true }).map((m) => m.split(':')[0])).toEqual([
        'rules/0/itemStatsAnyOf/0/stat',
        'rules/0/itemStatsAnyOf/2/stat',
      ]);
    });

    it('warns about Enhanced Defense on armour and durability on weapons and armour', () => {
      expect(quirks({ itemCodes: ['cap'], itemStats: [ed(16)], hide: true })).toEqual([
        expect.stringMatching(/^rules\/0\/itemStats\/0\/stat: The game keeps Enhanced Defense off .* very likely reads 0/),
      ]);
      expect(quirks({ itemCodes: ['hax'], itemStats: [ed('item_maxdurability_percent')], hide: true })).toEqual([
        expect.stringMatching(/likely reads 0 here on weapons and armour/),
      ]);
      expect(quirks({ itemCodes: ['hax'], itemStats: [ed(16)], hide: true })).toEqual([]);
    });

    it('stays quiet when the rule’s codes and types leave out the affected items', () => {
      expect(quirks({ itemTypes: ['jewl', 'char'], itemStats: [ed(17)], hide: true })).toEqual([]);
      expect(quirks({ itemCodes: ['jew', 'cm1'], itemStats: [ed(17)], hide: true })).toEqual([]);
      expect(quirks({ itemTypes: ['axe'], excludeItemCodes: ['hax', 'dbl'], itemStats: [ed(17)], hide: true })).toEqual([]);
      expect(quirks({ excludeItemTypes: ['weap'], itemStats: [ed(17)], hide: true })).toEqual([]);
      expect(quirks({ itemCodes: ['jew', 'hax'], itemStats: [ed(17)], hide: true })).toHaveLength(1);
    });

    it('warns without item data or for an unknown code, and never in the character stat lists', () => {
      expect(quirks({ itemTypes: ['jewl'], itemStats: [ed(17)], hide: true }, null)).toHaveLength(1);
      expect(quirks({ itemCodes: ['jew', 'zzz'], itemStats: [ed(17)], hide: true }).filter((m) => m.includes('Enhanced'))).toHaveLength(1);
      expect(quirks({ playerStats: [ed(17)], playerStatsAnyOf: [ed(16)], hide: true })).toEqual([]);
    });
  });

  it('checks names against the reference only when it has them', () => {
    const rule: LootFilterRule = {
      itemCodes: ['r01', 'zzz'],
      excludeItemTypes: ['nope'],
      itemStats: [
        { stat: 'item_numsockets', value: 1 },
        { stat: 'bogus', value: 1 },
      ],
      playerStatsAnyOf: [{ stat: 999, value: 1 }],
      areas: [3],
      uniqueOrSetIds: [7],
      sound: 'bogus_sound',
    };
    expect(checkRule(rule, reference)).toEqual([
      ['warning', 'rules/0/itemStats/1/stat'],
      ['warning', 'rules/0/playerStatsAnyOf/0/stat'],
      ['warning', 'rules/0/sound'],
      ['warning', 'rules/0/itemCodes/1'],
      ['warning', 'rules/0/excludeItemTypes/0'],
      ['warning', 'rules/0/areas/0'],
      ['warning', 'rules/0/uniqueOrSetIds/0'],
    ]);
    expect(checkRule(rule)).toEqual([]);
    const empty: LootFilterReference = { ...reference, itemCodes: new Set(), statNames: new Set(), statIds: new Set() };
    expect(checkRule(rule, empty).map(([, path]) => path)).not.toContain('rules/0/itemCodes/1');
  });

  it('accepts sound names, rows and files, and rejects rows past the end', () => {
    for (const sound of ['item_rune', 12, '12', 'gong.MP3', 'a.wav', 'b.flac']) expect(checkRule({ sound }, reference)).toEqual([]);
    expect(checkRule({ sound: 100 }, reference)).toEqual([['warning', 'rules/0/sound']]);
    expect(checkRule({ sound: 'song.ogg' }, reference)).toEqual([['warning', 'rules/0/sound']]);
  });

  it('tags every rule diagnostic with its rule index', () => {
    const diagnostics: Diagnostic[] = validateLootFilter({ ...base, rules: [{ itemCodes: ['r01'], hide: true }, { useStyle: 'X' }] });
    expect(diagnostics).toEqual([expect.objectContaining({ rule: 1, path: 'rules/1/useStyle' })]);
  });

  describe('rules that never match', () => {
    it('warns when no item code is of the item types', () => {
      expect(messages({ itemCodes: ['cap', 'hax'], itemTypes: ['rune'], hide: true })).toEqual([
        'rules/0/itemTypes: None of the item codes is of the item types, so the rule never matches',
      ]);
      expect(messages({ itemCodes: ['cap', 'hax'], itemTypes: ['armo'], hide: true })).toEqual([]);
      // type2 counts: dbl is an axe and a club.
      expect(messages({ itemCodes: ['dbl'], itemTypes: ['blun'], hide: true })).toEqual([]);
      // Unknown codes are skipped; only unknown codes skip the check.
      expect(messages({ itemCodes: ['zzz'], itemTypes: ['rune'], hide: true }, { ...reference, itemCodes: new Set() })).toEqual([]);
      expect(messages({ itemCodes: ['cap'], itemTypes: ['rune'], hide: true }, null)).toEqual([]);
    });

    it('warns when every listed value is also excepted', () => {
      expect(messages({ itemCodes: ['cap'], excludeItemCodes: ['cap', 'hax'], hide: true })).toEqual([
        'rules/0/excludeItemCodes: Every item code is also an excepted item code, so the rule never matches',
      ]);
      expect(messages({ itemCodes: ['cap', 'r01'], excludeItemCodes: ['cap'], hide: true })).toEqual([]);
      expect(messages({ uniqueOrSetIds: [0, 1], excludeUniqueOrSetIds: [1, 0], hide: true })).toEqual([
        'rules/0/excludeUniqueOrSetIds: Every unique or set id is also an excepted id, so the rule never matches',
      ]);
      expect(messages({ areas: [1], excludeAreas: [1], hide: true })).toEqual([
        'rules/0/excludeAreas: Every area is also an excepted area, so the rule never matches',
      ]);
    });

    it('warns when every item type or code falls under an excepted type', () => {
      expect(messages({ itemTypes: ['helm'], excludeItemTypes: ['armo'], hide: true })).toEqual([
        'rules/0/excludeItemTypes: Every item type falls under an excepted item type, so the rule never matches',
      ]);
      // Without a reference a type still falls under itself.
      expect(messages({ itemTypes: ['helm'], excludeItemTypes: ['helm'], hide: true }, null)).toHaveLength(1);
      expect(messages({ itemTypes: ['helm', 'axe'], excludeItemTypes: ['armo'], hide: true })).toEqual([]);
      expect(
        messages({ itemCodes: ['cap', 'zzz'], excludeItemTypes: ['armo'], hide: true }, { ...reference, itemCodes: new Set() })
      ).toEqual(['rules/0/excludeItemTypes: Every item code is of an excepted item type, so the rule never matches']);
      expect(messages({ itemCodes: ['cap', 'hax'], excludeItemTypes: ['armo'], hide: true })).toEqual([]);
      expect(messages({ itemCodes: ['zzz'], excludeItemTypes: ['armo'], hide: true }, { ...reference, itemCodes: new Set() })).toEqual([]);
    });

    it('warns when unique or set ids meet a quality that is neither', () => {
      const message =
        'rules/0/uniqueOrSetIds: Unique or set ids need a unique or set item, but the quality allows neither, so the rule never matches';
      expect(messages({ uniqueOrSetIds: [0], quality: 'rare', hide: true })).toEqual([message]);
      expect(messages({ uniqueOrSetIds: [0], quality: ['magic', 2], hide: true })).toEqual([message]);
      expect(messages({ uniqueOrSetIds: [0], quality: { max: 'magic' }, hide: true })).toEqual([message]);
      expect(messages({ uniqueOrSetIds: [0], quality: { min: 'crafted' }, hide: true })).toEqual([message]);
      expect(messages({ uniqueOrSetIds: [0], quality: 'unique', hide: true })).toEqual([]);
      expect(messages({ uniqueOrSetIds: [0], quality: ['rare', 5], hide: true })).toEqual([]);
      expect(messages({ uniqueOrSetIds: [0], quality: { min: 'magic', max: 'rare' }, hide: true })).toEqual([]);
      expect(messages({ uniqueOrSetIds: [0], hide: true })).toEqual([]);
    });

    it('warns about a hide rule without conditions that is not the last rule', () => {
      const check = (rules: LootFilterRule[]) => validateLootFilter({ ...base, rules }).map((d) => `${d.path}: ${d.message}`);
      const later: LootFilterRule = { itemCodes: ['r01'], namePrefix: 'x' };
      expect(check([{ hide: true }, later, later])).toEqual([
        'rules/0/hide: Hides every ground item; the 2 rules after it never run for ground items',
      ]);
      expect(check([{ hide: true, location: ['onGround', 'stored'] }, later])).toEqual([
        'rules/0/hide: Hides every ground item; the rule after it never runs for ground items',
      ]);
      // A style's hide counts.
      expect(validateLootFilter({ ...base, styles: { H: { hide: true } }, rules: [{ useStyle: 'H' }, later] }).map((d) => d.path)).toEqual([
        'rules/0/hide',
      ]);
      expect(check([later, { hide: true }])).toEqual([]);
      expect(check([{ hide: true, activeInLevels: [2] }, later])).toEqual([]);
      expect(check([{ hide: true, location: ['stored'] }, later])).toEqual([]);
      expect(check([{ hide: true, quality: 'normal' }, later])).toEqual([]);
    });
  });
});

describe('hideIfOtherConditionsFail, empty lists and disabled rules', () => {
  const said = (rule: LootFilterRule) => validateLootFilter({ ...base, rules: [rule] }).map((d) => `${d.path}: ${d.message}`);

  it('warns that hide-if-fail without codes or types hides every ground item failing the other conditions', () => {
    expect(said({ quality: 'unique', hideIfOtherConditionsFail: true })).toEqual([
      'rules/0/hideIfOtherConditionsFail: Without "itemCodes" or "itemTypes", "hideIfOtherConditionsFail" hides every ground item that fails "quality"',
      expect.stringContaining('rules/0/hideIfOtherConditionsFail: "hideIfOtherConditionsFail" with "quality" also hides'),
    ]);
    expect(said({ sockets: 2, isEthereal: true, excludeItemTypes: ['weap'], hideIfOtherConditionsFail: true })).toEqual([
      'rules/0/hideIfOtherConditionsFail: Without "itemCodes" or "itemTypes", "hideIfOtherConditionsFail" hides every ground item that fails "sockets", "isEthereal"',
    ]);
    expect(said({ location: ['onGround'], hideIfOtherConditionsFail: true })).toEqual([
      'rules/0/hideIfOtherConditionsFail: "hideIfOtherConditionsFail" needs "itemCodes" or "itemTypes" to say which items it hides',
    ]);
    expect(said({ itemTypes: ['weap'], sockets: 2, hideIfOtherConditionsFail: true })).toEqual([]);
  });

  it('warns that hide-if-fail with quality also hides the other qualities', () => {
    expect(said({ itemTypes: ['weap'], quality: 'magic', itemStats: [{ stat: 'x', value: 1 }], hideIfOtherConditionsFail: true })).toEqual([
      'rules/0/hideIfOtherConditionsFail: "hideIfOtherConditionsFail" with "quality" also hides every other quality of these items (uniques included): any other condition failing hides the item',
    ]);
    expect(said({ itemTypes: ['weap'], quality: 'magic', hide: true })).toEqual([]);
  });

  it('leaves rules with passthrough keys alone', () => {
    expect(said({ quality: 'unique', hideIfOtherConditionsFail: true, passthrough: { sockets: 'two' } })).toEqual([]);
  });

  it('warns about every empty list condition', () => {
    expect(said({ itemCodes: [], activeInLevels: [], location: [], hide: true })).toEqual([
      'rules/0/itemCodes: "itemCodes" is an empty list: the game logs "the list is empty" and what it does then is not known; remove the key or add values',
      expect.stringMatching(/^rules\/0\/location: "location" is an empty list/),
      expect.stringMatching(/^rules\/0\/activeInLevels: "activeInLevels" is an empty list/),
    ]);
  });

  it('checks disabled rules under their file path and skips them for "hides every ground item"', () => {
    const later: LootFilterRule = { itemCodes: ['r01'], namePrefix: 'x' };
    const diagnostics = validateLootFilter({
      ...base,
      rules: [{ hide: true, disabled: true }, { hide: true }, later, { ...later, useStyle: 'Missing', disabled: true }],
    });
    expect(diagnostics.map((d) => [d.path, d.rule, d.message])).toEqual([
      ['rules/0/hide', 1, 'Hides every ground item; the rule after it never runs for ground items'],
      ['disabledRules/1/rule/useStyle', 3, 'There is no style named "Missing"'],
    ]);
  });
});

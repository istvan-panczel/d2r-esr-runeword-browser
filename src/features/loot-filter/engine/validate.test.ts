import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseLootFilter } from './parse.ts';
import type { Diagnostic, LootFilter, LootFilterReference, LootFilterRule, StatCheck } from './types.ts';
import { SHOWS_EVERY_ITEM_MESSAGE, validateLootFilter as validate } from './validate.ts';
import { diagnosticKeys } from '../utils/ruleView.ts';
import { buildLootFilterReference } from './reference.ts';
import type { LootFilterDataBundle, TypesBundle } from '../../game-data/engine/schema.ts';

/** Most rules below use `hide` as a handy action: the unidentified warning has its own tests, on `validate`. */
const validateLootFilter: typeof validate = (filter, ref) =>
  validate(filter, ref).filter((diagnostic) => !diagnostic.message.startsWith('Does not hide unidentified items'));

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
  skillIds: new Map(),
  skillDisplayNames: new Map(),
};

/** The messages of the rule's diagnostics (`null` validates without a reference). */
function messages(rule: LootFilterRule, ref: LootFilterReference | null = reference): string[] {
  return validateLootFilter({ ...base, rules: [rule] }, ref ?? undefined).map((d) => `${d.path}: ${d.message}`);
}

describe('validateLootFilter', () => {
  it('finds no errors in Sully’s filter', () => {
    const source = readFileSync(resolve(__dirname, '__fixtures__/sullys-qol-filter-0.9.2.json'), 'utf-8');
    const diagnostics = validateLootFilter(parseLootFilter(source).filter);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // It has no warnings either without a reference (stat 188 is written by id).
    expect(diagnostics).toEqual([]);
  });

  it('finds nothing in Sully’s filter against the real game data', () => {
    const json = (file: string) => JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data', file), 'utf-8')) as unknown;
    const real = buildLootFilterReference(json('lootfilter.json') as LootFilterDataBundle, json('types.json') as TypesBundle);
    const source = readFileSync(resolve(__dirname, '__fixtures__/sullys-qol-filter-0.9.2.json'), 'utf-8');
    // Up to v0.7.0 the +3/4/5 skill tab rules checked stat 188 with params 1 to 21, the properties.txt tab numbers (6
    // warnings); since v0.9.0 they read every tab with `statMax('item_addskill_tab')`, and every name, code, type and
    // area of the 689 rules is known to the game data.
    expect(validateLootFilter(parseLootFilter(source).filter, real)).toEqual([]);
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
    // A level written as a single number ("activeInLevels": 5) is checked like a list entry, at the key itself.
    const bare = validateLootFilter({ ...base, rules: [{ hide: true, activeInLevels: [5], activeInLevelsNumber: 5 }] });
    expect(bare.map((d) => [d.severity, d.path, d.message])).toEqual([
      ['error', 'rules/0/activeInLevels', 'There is no filter level with id 5'],
    ]);
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

    it('needs a whole param from 0, and warns above 65535', () => {
      expect(messages({ itemStats: [{ stat: 'item_numsockets', param: 1.5, value: 1 }], hide: true })).toEqual([
        'rules/0/itemStats/0/param: "param" 1.5 is not a whole number from 0',
      ]);
      expect(checkRule({ itemStats: [{ stat: 'item_numsockets', param: -1, value: 1 }], hide: true })).toEqual([
        ['error', 'rules/0/itemStats/0/param'],
      ]);
      expect(messages({ playerStats: [tab({ param: 70000 })], hide: true })).toEqual([
        'rules/0/playerStats/0/param: "param" 70000 is above 65535: a stat\'s layer is assumed to be 16 bits in memory, so this check likely never matches',
      ]);
    });

    it('warns about a layered stat without param, by name without a reference and by id with one', () => {
      expect(messages({ itemStats: [tab({})], hide: true }, null)).toEqual([
        'rules/0/itemStats/0: "item_addskill_tab" has one entry per skill tab; without "param" the plugin reads only the entry with param 0 (verified in game), not any skill tab. Pick a skill tab to check one',
      ]);
      expect(checkRule({ playerStatsAnyOf: [{ stat: 198, value: 1 }], hide: true }, reference)).toEqual([
        ['warning', 'rules/0/playerStatsAnyOf/0'],
      ]);
      expect(checkRule({ itemStats: [{ stat: 198, value: 1 }], hide: true })).toEqual([]);
      expect(checkRule({ itemStats: [tab({ param: 50 })], hide: true }, reference)).toEqual([]);
    });

    it('warns about exceptions without param too, with the same message', () => {
      for (const check of [tab({ op: '<', value: 1 }), tab({ op: '<', value: 3 }), tab({ op: '<=', value: 2 })]) {
        expect(messages({ itemStats: [check], hide: true })).toEqual([
          expect.stringMatching(/^rules\/0\/itemStats\/0: "item_addskill_tab" has one entry per skill tab; .*check one$/),
        ]);
      }
    });

    it('names the layer of a single properties.txt tab number', () => {
      expect(messages({ itemStats: [tab({ param: 21 })], hide: true })).toEqual([
        'rules/0/itemStats/0/param: "param" 21 names no skill tab: the plugin numbers tabs class × 8 + tab 0 to 2, as the game does (verified in game); as a properties.txt tab number (class × 3 + tab) 21 is Warlock Demon Skills, which is param 56',
      ]);
      expect(messages({ itemStats: [tab({ param: 99 })], hide: true })).toEqual([
        'rules/0/itemStats/0/param: "param" 99 names no skill tab: the plugin numbers tabs class × 8 + tab 0 to 2, as the game does (verified in game)',
      ]);
      // A decodable tab next to it: still one check of its own
      expect(messages({ itemStats: [tab({ param: 50 }), tab({ param: 99 })], hide: true })).toHaveLength(1);
    });

    it('warns once per list about several properties.txt tab numbers', () => {
      const list = [1, 8, 20, 50].map((param) => tab({ param }));
      expect(messages({ itemStatsAnyOf: list, hide: true })).toEqual([
        'rules/0/itemStatsAnyOf: These skill tab params (1–20) look like properties.txt tab numbers (class × 3 + tab). The game itself numbers tabs class × 8 + tab (Assassin Martial Arts = 50, Warlock Demon Skills = 56), and so does the plugin (verified in game): 1 of these checks matches no tab and 1 matches a different tab than their number suggests',
      ]);
      // All of them decode: no warning
      expect(messages({ itemStatsAnyOf: [1, 8].map((param) => tab({ param })), hide: true })).toEqual([]);
    });

    it('warns about event and charged params without a skill or level', () => {
      const onHit = (param: number): StatCheck => ({ stat: 'item_skillonhit', param, value: 1 });
      expect(messages({ itemStats: [onHit(25)], hide: true })).toEqual([
        expect.stringMatching(/^rules\/0\/itemStats\/0\/param: "param" 25 names skill 0/),
      ]);
      expect(messages({ itemStats: [onHit(472 << 6)], hide: true })).toEqual([expect.stringMatching(/names level 0/)]);
      expect(messages({ itemStats: [onHit((472 << 6) | 25)], hide: true })).toEqual([]);
    });

    it('warns about a charged value above the highest skill level (plugin 1.8.2 reads the skill level)', () => {
      const charged = (check: Partial<StatCheck>): StatCheck => ({ stat: 204, param: (472 << 6) | 25, value: 1, ...check });
      const flagged = (check: Partial<StatCheck>) => checkRule({ itemStats: [charged(check)], hide: true }, reference);
      for (const ok of [{}, { op: '>', value: 0 }, { op: '<', value: 1 }, { value: 5 }, { value: 63 }, { op: '<', value: 2560 }] as const)
        expect(flagged(ok)).toEqual([]);
      expect(flagged({ value: 1280 })).toEqual([['warning', 'rules/0/itemStats/0/value']]);
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
        "rules/0/itemStats/0/stat: The game keeps Enhanced Damage off a weapon's stats, so the plugin reads 0 here on weapons (confirmed in game); on jewels and charms it reads correctly (confirmed on a jewel). Reported to the mod author.",
      ]);
      expect(quirks({ itemStatsAnyOf: [ed(18), ed('item_numsockets'), ed(17)], hide: true }).map((m) => m.split(':')[0])).toEqual([
        'rules/0/itemStatsAnyOf/0/stat',
        'rules/0/itemStatsAnyOf/2/stat',
      ]);
    });

    it('warns about Enhanced Defense on armour and durability on weapons and armour', () => {
      expect(quirks({ itemCodes: ['cap'], itemStats: [ed(16)], hide: true })).toEqual([
        expect.stringMatching(/^rules\/0\/itemStats\/0\/stat: The game keeps Enhanced Defense off .* reads 0 .*confirmed in game/),
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

  describe('stats the game stores scaled', () => {
    const scaled = (rule: LootFilterRule) => messages(rule, null);

    it('says nothing about Life, Mana, Stamina, howl and fear: plugin 1.8.2 reads the tooltip number', () => {
      expect(
        scaled({
          itemStats: [
            { stat: 'maxhp', value: 40 },
            { stat: 'item_howl', value: 25 },
          ],
          hide: true,
        })
      ).toEqual([]);
      expect(
        scaled({ itemStatsAnyOf: [{ stat: 9, value: 20 }], playerStats: [{ stat: 'hitpoints', op: '<', value: 100 }], namePrefix: 'x' })
      ).toEqual([]);
    });

    it('warns about per-level stats, which read the value at the character level', () => {
      expect(scaled({ itemStats: [{ stat: 'item_strength_perlevel', value: 2 }], hide: true })).toEqual([
        expect.stringMatching(
          /^rules\/0\/itemStats\/0\/value: "item_strength_perlevel" \(Strength per level\) reads the value at your character's level/
        ),
      ]);
      expect(scaled({ itemStats: [{ stat: 216, value: 3 }], hide: true })).toEqual([expect.stringMatching(/Life per level/)]);
      expect(scaled({ itemStats: [{ stat: 'strength', value: 40 }], hide: true })).toEqual([]);
    });

    it('stays quiet on presence checks, whose result does not depend on the scale', () => {
      // Sully's rules 29 and 30 check stats 218 and 219 for >= 1 (and print {stat:218}/8 in the name).
      expect(
        scaled({
          itemStats: [
            { stat: 218, value: 1 },
            { stat: 'maxhp', op: '<', value: 1 },
          ],
          hide: true,
        })
      ).toEqual([]);
      // `!= 0` / `== 0` (and `> 0` / `<= 0`) read "there" / "not there" too.
      expect(
        scaled({
          itemStats: [
            { stat: 'maxhp', op: '!=', value: 0 },
            { stat: 'maxmana', op: '==', value: 0 },
            { stat: 7, op: '>', value: 0 },
            { stat: 9, op: '<=', value: 0 },
          ],
          namePrefix: 'x',
        })
      ).toEqual([]);
      expect(scaled({ itemStats: [{ stat: 218, op: '==', value: 40 }], namePrefix: 'x' })).toHaveLength(1);
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

    it('warns about a show rule without conditions above a hide rule', () => {
      const check = (filter: Partial<LootFilter>) => validateLootFilter({ ...base, ...filter }).map((d) => `${d.path}: ${d.message}`);
      const hideRunes: LootFilterRule = { itemTypes: ['rune'], hide: true };
      const warning = `rules/0: ${SHOWS_EVERY_ITEM_MESSAGE}`;
      expect(check({ rules: [{ show: true }, hideRunes] })).toEqual([warning]);
      expect(check({ rules: [{ show: true, location: ['onGround'] }, { itemTypes: ['rune'], namePrefix: 'y' }, hideRunes] })).toEqual([
        warning,
      ]);
      // Hide-if-fail hides too; a style's show counts, and so does a style's hide below.
      expect(check({ rules: [{ show: true }, { itemTypes: ['rune'], sockets: 2, hideIfOtherConditionsFail: true }] })).toEqual([warning]);
      expect(check({ styles: { Keep: { show: true } }, rules: [{ useStyle: 'Keep' }, hideRunes] })).toEqual([warning]);
      expect(check({ styles: { Gone: { hide: true } }, rules: [{ show: true }, { itemTypes: ['rune'], useStyle: 'Gone' }] })).toEqual([
        warning,
      ]);
      // No (enabled) hide below it: nothing to warn about.
      expect(check({ rules: [hideRunes, { show: true }] })).toEqual([]);
      expect(check({ rules: [{ show: true }, { itemTypes: ['rune'], namePrefix: 'x' }] })).toEqual([]);
      expect(check({ rules: [{ show: true }, { ...hideRunes, disabled: true }] })).toEqual([]);
      // Any condition, a location without onGround or a passthrough key: the rule picks its items.
      expect(check({ rules: [{ show: true, quality: 'unique' }, hideRunes] })).toEqual([]);
      expect(check({ rules: [{ show: true, activeInLevels: [2] }, hideRunes] })).toEqual([]);
      expect(check({ rules: [{ show: true, location: ['stored'] }, hideRunes] })).toEqual([]);
      expect(check({ rules: [{ show: true, passthrough: { itemCodes: 'r01' } }, hideRunes] })).toEqual([]);
      // About the whole rule (no key), so a new `{ "show": true }` rule keeps its items-first step.
      const [diagnostic] = validateLootFilter({ ...base, rules: [{ show: true }, hideRunes] });
      expect(diagnostic).toMatchObject({ severity: 'warning', rule: 0 });
      expect(diagnosticKeys([diagnostic])).toEqual(new Set());
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

describe('show (plugin 1.8.2)', () => {
  it('accepts show as an action', () => {
    expect(checkRule({ itemCodes: ['r01'], show: true })).toEqual([]);
  });

  it('reports a rule or style that both shows and hides', () => {
    expect(checkRule({ itemCodes: ['r01'], show: true, hide: true })).toEqual([['error', 'rules/0/show']]);
    const styled = validateLootFilter({
      ...base,
      styles: { H: { hide: true } },
      rules: [{ itemCodes: ['r01'], useStyle: 'H', show: true }],
    });
    expect(styled.map((d) => [d.severity, d.path])).toEqual([['error', 'rules/0/show']]);
    const style = validateLootFilter({ ...base, styles: { B: { hide: true, show: true } } });
    expect(style.map((d) => [d.severity, d.path])).toEqual([['error', 'styles/B/show']]);
  });
});

describe('validateLootFilter: formula', () => {
  const formulaReference: LootFilterReference = {
    ...reference,
    statNames: new Set([...reference.statNames, 'fireresist', 'item_nonclassskill', 'item_maxdamage_percent']),
    statIds: new Set([...reference.statIds, 39, 97, 17]),
    statNamesById: new Map([...reference.statNamesById, [39, 'fireresist'], [97, 'item_nonclassskill'], [17, 'item_maxdamage_percent']]),
    skillIds: new Map([
      ['teleport', 54],
      ['hex bane', 666],
    ]),
    skillDisplayNames: new Map([['hex: bane', ['Hex Bane']]]),
  };
  const said = (rule: LootFilterRule, ref: LootFilterReference | null = formulaReference) => messages(rule, ref);
  const severities = (rule: LootFilterRule) =>
    validateLootFilter({ ...base, rules: [rule] }, formulaReference).map((d) => [d.severity, d.path]);
  const ring = (formula: string, extra: LootFilterRule = {}): LootFilterRule => ({ itemTypes: ['rune'], formula, hide: true, ...extra });

  it('accepts the guide example and the author’s oskill example', () => {
    expect(said(ring("((stat('fireresist')>=10)&&((stat('fireresist')+stat(39))>=40))"))).toEqual([]);
    expect(said(ring("stat('item_nonclassskill','Teleport')>10"))).toEqual([]);
    expect(said(ring("stat('item_nonclassskill','teleport')>10"))).toEqual([]);
  });

  it('reports a syntax error with its position, and says the rule is switched off', () => {
    expect(said(ring("stat('fireresist') = 1"))).toEqual([
      "rules/0/formula: Formula: '=' is not an operator; compare with '==' (character 20). The game switches a rule with a bad formula off when the filter loads",
    ]);
    expect(severities(ring(''))).toEqual([['error', 'rules/0/formula']]);
  });

  it('reports huge formulas as syntax errors instead of overflowing the stack', () => {
    for (const formula of [`${'('.repeat(3000)}1${')'.repeat(3000)}`, `${'!'.repeat(10000)}1`, Array<string>(10000).fill('1').join('+')]) {
      expect(checkRule(ring(formula))).toContainEqual(['error', 'rules/0/formula']);
    }
  });

  it('warns about unknown stats (naming a case-only difference) and stat ids', () => {
    expect(said(ring("stat('FireResist') + stat(4000) + stat('nope')"))).toEqual([
      'rules/0/formula: Unknown stat "FireResist" at character 6; stat names are taken to be case-sensitive: "fireresist". A name the mod\'s itemstatcost.txt lacks switches the rule off in game',
      'rules/0/formula: Unknown stat id 4000 at character 27',
      'rules/0/formula: Unknown stat "nope" at character 40. A name the mod\'s itemstatcost.txt lacks switches the rule off in game',
    ]);
    // Without a reference only the syntax is checked
    expect(said(ring("stat('nope', 'Nope')"), null)).toEqual([]);
  });

  it('takes names as written and warns about spaces around them', () => {
    expect(said(ring("stat(' 39 ') + stat('item_nonclassskill', ' Teleport')"))).toEqual([
      "rules/0/formula: The name ' 39 ' at character 6 has spaces around it; names are taken as written, so it likely matches nothing",
      'rules/0/formula: Unknown stat " 39 " at character 6. A name the mod\'s itemstatcost.txt lacks switches the rule off in game',
      "rules/0/formula: The name ' Teleport' at character 43 has spaces around it; names are taken as written, so it likely matches nothing",
      "rules/0/formula: Unknown skill ' Teleport' at character 43 (formulas take the skills.txt skill column). A skill the mod's skills.txt lacks switches the rule off in game",
    ]);
  });

  it('warns about unknown skills, naming the skills.txt name of an in-game name', () => {
    expect(said(ring("stat('item_nonclassskill', 'Hex: Bane') + stat('item_nonclassskill', 'Nope')"))).toEqual([
      "rules/0/formula: Unknown skill 'Hex: Bane' at character 28: that is the in-game name; formulas take the skills.txt name, 'Hex Bane'. A skill the mod's skills.txt lacks switches the rule off in game",
      "rules/0/formula: Unknown skill 'Nope' at character 70 (formulas take the skills.txt skill column). A skill the mod's skills.txt lacks switches the rule off in game",
    ]);
  });

  it('warns about params: layered stats without one, skill names on other stats, encodings, range', () => {
    expect(said(ring("stat('item_nonclassskill') + statMax('item_nonclassskill') + playerStat('item_addskill_tab')"))).toEqual([
      'rules/0/formula: stat(\'item_nonclassskill\') at character 1 is taken to read only the entry with param 0, but "item_nonclassskill" has one entry per skill: use statMax or statSum for any skill, or add a param',
      'rules/0/formula: playerStat(\'item_addskill_tab\') at character 62 is taken to read only the entry with param 0, but "item_addskill_tab" has one entry per skill tab: use statMax or statSum for any skill tab, or add a param',
    ]);
    // The position is the function name's, also inside parentheses
    expect(said(ring("1 + (stat('item_nonclassskill'))"))).toEqual([
      expect.stringMatching(/^rules\/0\/formula: stat\('item_nonclassskill'\) at character 6 is taken/),
    ]);
    expect(said(ring("stat('fireresist', 'Teleport')"))).toEqual([
      "rules/0/formula: \"fireresist\" has no skill param: the skill name 'Teleport' at character 20 is taken to be read as the skill's id",
    ]);
    // Chance-to-cast and charges: a skill name matches any level (the guide)
    expect(said(ring("stat(198, 'Teleport') + stat('item_charged_skill', 'Teleport')"))).toEqual([]);
    expect(said(ring("stat('item_skillonhit', 3456) + stat('item_skillonhit', 12) + stat('item_addskill_tab', 20)"))).toEqual([
      expect.stringMatching(
        /^rules\/0\/formula: The param 3456 at character 25 names level 0: the param of "item_skillonhit" is skill id × 64/
      ),
      expect.stringMatching(/^rules\/0\/formula: The param 12 at character 57 names skill 0/),
      'rules/0/formula: The param 20 at character 89 names no skill tab as the game numbers them (class × 8 + tab 0 to 2)',
    ]);
    expect(said(ring("stat('fireresist', 70000) + stat('fireresist', '1') + stat('39')"))).toEqual([
      expect.stringMatching(/^rules\/0\/formula: The param 70000 at character 20 is above 65535/),
      'rules/0/formula: The param 1 at character 48 is in quotes; write a number param without them',
      'rules/0/formula: The stat id 39 at character 60 is in quotes; a row number needs none',
    ]);
  });

  it('warns about double quotes and the Enhanced Damage quirk on item stats; a too big number is an error', () => {
    expect(said(ring('stat("fireresist") > 3'))).toEqual([
      'rules/0/formula: Write names in single quotes (\'): the plugin\'s log says "names go in single quotes", so double quotes most likely switch the rule off',
    ]);
    expect(severities(ring("stat('fireresist') > 3000000000"))).toEqual([['error', 'rules/0/formula']]);
    expect(said(ring("statMax('item_maxdamage_percent') + stat(17)", { itemTypes: ['weap'] }))).toEqual([
      expect.stringMatching(/^rules\/0\/formula: The game keeps Enhanced Damage off a weapon's stats/),
    ]);
    expect(said(ring("playerStat('item_maxdamage_percent')", { itemTypes: ['weap'] }))).toEqual([]);
  });

  it('counts the formula as a condition: no "no actions" change, and a hide rule with only a formula hides no more than it', () => {
    expect(said({ itemTypes: ['rune'], formula: '1' })).toEqual(['rules/0: The rule has conditions but no actions, so it does nothing']);
    expect(said({ formula: '1' }, null)).toEqual(['rules/0: The rule has conditions but no actions, so it does nothing']);
    const diagnostics = validateLootFilter({
      ...base,
      rules: [
        { formula: '1', hide: true },
        { itemCodes: ['r01'], namePrefix: 'x' },
      ],
    });
    expect(diagnostics).toEqual([]);
  });
});

describe('hide rules on unidentified items', () => {
  const said = (rule: LootFilterRule) => validate({ ...base, rules: [rule] }).map((d) => [d.severity, d.path]);
  const armour = { itemTypes: ['armo'], quality: 'magic' } as const;
  const check = { stat: 'item_magicbonus', op: '<', value: 1 } as StatCheck;

  it('warns on a hide that reads an item stat, by stat list, formula or hide-if-fail', () => {
    expect(said({ ...armour, itemStats: [check], hide: true })).toEqual([['warning', 'rules/0/itemStats']]);
    expect(said({ ...armour, itemStatsAnyOf: [check], hide: true })).toEqual([['warning', 'rules/0/itemStatsAnyOf']]);
    expect(said({ ...armour, formula: "stat('item_magicbonus') < 1", hide: true })).toEqual([['warning', 'rules/0/formula']]);
    expect(said({ ...armour, itemStats: [check], hideIfOtherConditionsFail: true }).at(-1)).toEqual(['warning', 'rules/0/itemStats']);
    expect(
      validate({ ...base, styles: { H: { hide: true } }, rules: [{ ...armour, itemStats: [check], useStyle: 'H' }] }).map((d) => d.path)
    ).toEqual(['rules/0/itemStats']);
  });

  it('stays quiet when nothing is lost', () => {
    expect(said({ ...armour, itemStats: [{ stat: 'quantity', op: '<', value: 1 }], hide: true })).toEqual([]);
    expect(said({ ...armour, playerStats: [check], hide: true })).toEqual([]);
    expect(said({ ...armour, formula: "playerStat('item_magicbonus') < 1", hide: true })).toEqual([]);
    expect(said({ ...armour, isIdentified: true, itemStats: [check], hide: true })).toEqual([]);
    expect(said({ itemTypes: ['armo'], quality: ['normal', 'superior'], itemStats: [check], hide: true })).toEqual([]);
    expect(said({ itemTypes: ['armo'], quality: 'normal', itemStats: [check], hide: true })).toEqual([]);
    expect(said({ itemTypes: ['armo'], quality: { max: 'superior' }, itemStats: [check], hide: true })).toEqual([]);
    expect(said({ itemTypes: ['armo'], quality: { min: 2, max: 3 }, itemStats: [check], hide: true })).toEqual([]);
    expect(said({ ...armour, itemStats: [check], namePrefix: 'x' })).toEqual([]);
  });

  it('warns on a quality range that reaches magic or above', () => {
    const range = (quality: LootFilterRule['quality']) => said({ itemTypes: ['armo'], quality, itemStats: [check], hide: true });
    expect(range({ max: 'magic' })).toEqual([['warning', 'rules/0/itemStats']]);
    expect(range({ min: 'superior' })).toEqual([['warning', 'rules/0/itemStats']]);
    // An unknown quality name is an error of its own, and the hide is not taken as limited.
    expect(range({ max: 'nope' as 'magic' })).toContainEqual(['warning', 'rules/0/itemStats']);
  });

  it('flags nothing in Sully’s filter', () => {
    // Rule 99 (rule 73 up to v0.7.0) hides weapons and armour `{ "max": "superior" }` without All Skills: never unidentified.
    const source = readFileSync(resolve(__dirname, '__fixtures__/sullys-qol-filter-0.9.2.json'), 'utf-8');
    expect(validate(parseLootFilter(source).filter)).toEqual([]);
  });
});

describe('label border width', () => {
  const widths = (width: number) =>
    validate({ ...base, rules: [{ labelBorder: { color: [0, 0, 0], width }, itemCodes: ['r01'] }] }).map((d) => [d.severity, d.path]);

  it('takes a whole number from 1 to 8, as the plugin does', () => {
    expect(widths(1)).toEqual([]);
    expect(widths(8)).toEqual([]);
    for (const width of [0, 9, 1.5, -1]) expect(widths(width)).toEqual([['error', 'rules/0/labelBorder/width']]);
  });
});

describe('text checks', () => {
  const said = (filter: Partial<LootFilter>) => validate({ ...base, ...filter }).map((d) => `${d.path}: ${d.message}`);

  it('warns about placeholders and colour codes in rule and style texts, every language included', () => {
    expect(said({ rules: [{ itemCodes: ['r01'], replaceName: '{red}{name}', chatMessage: 'ÿcZ{level}' }] })).toEqual([
      'rules/0/replaceName: {red} is not a placeholder the plugin knows; it is printed as written.',
      'rules/0/chatMessage: {level} does not work in chat lines.',
      'rules/0/chatMessage: "ÿcZ" is not a colour code the game knows',
    ]);
    expect(said({ styles: { S: { namePrefix: { enUS: 'ÿc0', deDE: '{nope}' } } } })).toEqual([
      'styles/S/namePrefix: {nope} is not a placeholder the plugin knows; it is printed as written.',
    ]);
    expect(said({ rules: [{ itemCodes: ['r01'], nameSuffix: 'ÿc' }] })).toEqual([
      'rules/0/nameSuffix: "ÿc" is not a colour code the game knows',
    ]);
  });

  it('accepts every documented colour code and placeholder', () => {
    expect(
      said({ rules: [{ itemCodes: ['r01'], chatMessage: 'ÿc0 ÿc; ÿc= ÿcA ÿcV {link} {stat:7} {string:r01}', replaceName: 'ÿc4{name}' }] })
    ).toEqual([]);
  });

  it('checks the notification lines in their own context', () => {
    expect(said({ notifications: { levelChangeFormat: '{level} {filter}', dropFormat: '{link}' } })).toEqual([]);
    expect(said({ notifications: { dropFormat: '{level}' } })).toEqual([
      'notifications/dropFormat: {level} does not work in the drop line.',
    ]);
  });

  it('warns about a qualityColors value that is not one colour code', () => {
    expect(said({ qualityColors: { magic: 'ÿc3', rare: 'notacode', unique: 'ÿcZ' } })).toEqual([
      'qualityColors/rare: "notacode" is not one colour code; the plugin ignores it',
      'qualityColors/unique: "ÿcZ" is not one colour code; the plugin ignores it',
    ]);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkedLayer, evaluateFilter, expandPlaceholders, OMITTED_PARAM, wrongShapedKeys } from './evaluate';
import { parseLootFilter } from './parse';
import type { TestContext, TestItem } from './evaluate';
import type { LootFilter, LootFilterRule, LootFilterStyle } from './types';

function makeItem(overrides: Partial<TestItem> = {}): TestItem {
  return {
    code: 'r33',
    typeAncestors: ['rune', 'misc'],
    quality: 2,
    baseTier: 0,
    itemLevel: 50,
    sockets: 0,
    maxSockets: 0,
    isFullySocketed: false,
    isEthereal: false,
    isIdentified: true,
    isRuneword: false,
    uniqueOrSetId: null,
    stats: [],
    name: 'Zod Rune',
    location: 'onGround',
    ...overrides,
  };
}

function makeContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    playerStats: [],
    difficulty: 2,
    area: 2,
    filterLevel: 1,
    statIds: new Map([
      ['item_numsockets', 194],
      ['level', 12],
    ]),
    ...overrides,
  };
}

function makeFilter(rules: readonly LootFilterRule[], extra: Partial<LootFilter> = {}): LootFilter {
  return { formatVersion: 1, rules, leadingComments: [], ...extra };
}

/** Whether a single rule applies to the item. */
function applies(rule: LootFilterRule, item: TestItem = makeItem(), context: TestContext = makeContext()): boolean {
  return evaluateFilter(makeFilter([rule]), item, context).matched;
}

function failedKeys(rule: LootFilterRule, item: TestItem = makeItem(), context: TestContext = makeContext()): readonly string[] {
  return evaluateFilter(makeFilter([rule]), item, context).trace[0]?.failed ?? [];
}

describe('conditions', () => {
  it('matches item codes and their exclusions', () => {
    expect(applies({ itemCodes: ['r32', 'r33'] })).toBe(true);
    expect(applies({ itemCodes: ['r32'] })).toBe(false);
    expect(applies({ excludeItemCodes: ['r33'] })).toBe(false);
    expect(applies({ excludeItemCodes: ['r32'] })).toBe(true);
  });

  it('matches item types through parent types', () => {
    expect(applies({ itemTypes: ['misc'] })).toBe(true);
    expect(applies({ itemTypes: ['weap', 'rune'] })).toBe(true);
    expect(applies({ itemTypes: ['weap'] })).toBe(false);
    expect(applies({ excludeItemTypes: ['misc'] })).toBe(false);
    expect(applies({ excludeItemTypes: ['weap'] })).toBe(true);
  });

  it('matches quality by name, number, list and range (1-based)', () => {
    const unique = makeItem({ quality: 7 });
    expect(applies({ quality: 'unique' }, unique)).toBe(true);
    expect(applies({ quality: 7 }, unique)).toBe(true);
    expect(applies({ quality: ['set', 'unique'] }, unique)).toBe(true);
    expect(applies({ quality: { min: 'rare', max: 'unique' } }, unique)).toBe(true);
    expect(applies({ quality: { max: 'magic' } }, unique)).toBe(false);
    expect(applies({ quality: 'set' }, unique)).toBe(false);
  });

  it('matches base tier and difficulty (0-based)', () => {
    const elite = makeItem({ baseTier: 2 });
    expect(applies({ baseTier: 'elite' }, elite)).toBe(true);
    expect(applies({ baseTier: 2 }, elite)).toBe(true);
    expect(applies({ baseTier: { max: 1 } }, elite)).toBe(false);
    expect(applies({ difficulty: 'hell' })).toBe(true);
    expect(applies({ difficulty: ['normal', 'nightmare'] })).toBe(false);
    expect(applies({ difficulty: { min: 1 } })).toBe(true);
  });

  describe('base tier of items without a tier family', () => {
    // A reported rule: hide normal and exceptional bases of every quality.
    const hideLowTiers: LootFilterRule = {
      quality: ['inferior', 'normal', 'superior', 'magic', 'rare', 'unique', 'crafted', 'tempered'],
      baseTier: ['normal', 'exceptional'],
      hide: true,
    };
    const run = (item: TestItem) => evaluateFilter(makeFilter([hideLowTiers]), item, makeContext());

    it('skips an elite item instead of hiding it', () => {
      const result = run(makeItem({ code: 'uap', typeAncestors: ['helm', 'armo'], quality: 6, baseTier: 2 }));
      expect(result.hidden).toBe(false);
      expect(result.trace).toEqual([{ index: 0, outcome: 'skipped', failed: ['baseTier'], actions: {} }]);
    });

    it('skips a ring, which has no base tier', () => {
      const result = run(makeItem({ code: 'rin', typeAncestors: ['ring', 'misc'], quality: 6, baseTier: null }));
      expect(result.hidden).toBe(false);
      expect(result.trace[0]?.outcome).toBe('skipped');
    });

    it('matches no base tier, not even elite or a range, for a null tier', () => {
      const ring = makeItem({ baseTier: null });
      expect(applies({ baseTier: 'elite' }, ring)).toBe(false);
      expect(applies({ baseTier: { min: 0 } }, ring)).toBe(false);
      expect(failedKeys({ baseTier: 'normal' }, ring)).toEqual(['baseTier']);
      expect(applies({}, ring)).toBe(true);
    });

    it('expands {baseTier} to an empty string for a null tier', () => {
      expect(expandPlaceholders('[{baseTier}]', makeItem({ baseTier: null }), makeContext(), makeFilter([]))).toBe('[]');
    });
  });

  it('fails a named range bound it cannot resolve', () => {
    expect(failedKeys({ quality: { min: 'legendary' as 'unique' } }, makeItem({ quality: 7 }))).toEqual(['quality']);
  });

  it('matches numbers as one value, a list or an inclusive range', () => {
    const item = makeItem({ itemLevel: 85, sockets: 3, maxSockets: 4 });
    expect(applies({ itemLevel: 85 }, item)).toBe(true);
    expect(applies({ itemLevel: [84, 86] }, item)).toBe(false);
    expect(applies({ itemLevel: { min: 85, max: 85 } }, item)).toBe(true);
    expect(applies({ sockets: { max: 2 } }, item)).toBe(false);
    expect(applies({ maxSockets: { min: 4 } }, item)).toBe(true);
  });

  it('matches the boolean flags', () => {
    const item = makeItem({ isEthereal: true, isFullySocketed: false, isIdentified: true, isRuneword: false });
    expect(applies({ isEthereal: true }, item)).toBe(true);
    expect(applies({ isFullySocketed: true }, item)).toBe(false);
    expect(applies({ isIdentified: false }, item)).toBe(false);
    expect(applies({ isRuneword: false }, item)).toBe(true);
  });

  it('matches unique or set ids', () => {
    expect(applies({ uniqueOrSetIds: [5] }, makeItem({ uniqueOrSetId: 5 }))).toBe(true);
    expect(applies({ uniqueOrSetIds: [5] }, makeItem({ uniqueOrSetId: null }))).toBe(false);
    expect(applies({ excludeUniqueOrSetIds: [5] }, makeItem({ uniqueOrSetId: 5 }))).toBe(false);
    expect(applies({ excludeUniqueOrSetIds: [5] }, makeItem({ uniqueOrSetId: null }))).toBe(true);
  });

  it('looks at ground items unless location says otherwise', () => {
    const stored = makeItem({ location: 'stored' });
    expect(applies({}, stored)).toBe(false);
    expect(applies({ location: ['stored', 'atVendor'] }, stored)).toBe(true);
    expect(applies({ location: ['stored'] })).toBe(false);
    expect(failedKeys({ itemCodes: ['r33'] }, stored)).toEqual(['location']);
  });

  it('matches areas, excluded areas and filter levels', () => {
    expect(applies({ areas: [2, 3] })).toBe(true);
    expect(applies({ areas: [1] })).toBe(false);
    expect(applies({ excludeAreas: [2] })).toBe(false);
    expect(applies({ activeInLevels: [1, 2] })).toBe(true);
    expect(applies({ activeInLevels: [3] })).toBe(false);
  });

  it('reports every condition that failed', () => {
    expect(failedKeys({ itemCodes: ['xyz'], quality: 'unique', areas: [1], activeInLevels: [9] })).toEqual([
      'itemCodes',
      'quality',
      'areas',
      'activeInLevels',
    ]);
  });
});

describe('stat checks', () => {
  const sockets = makeItem({
    stats: [
      { stat: 194, value: 3 },
      { stat: 188, param: 2, value: 3 },
      { stat: 188, param: 5, value: 1 },
    ],
  });

  it('defaults op to >= and resolves names through statIds', () => {
    expect(applies({ itemStats: [{ stat: 'item_numsockets', value: 3 }] }, sockets)).toBe(true);
    expect(applies({ itemStats: [{ stat: 194, value: 4 }] }, sockets)).toBe(false);
  });

  it('supports every operator, between inclusive', () => {
    const check = (op: '==' | '!=' | '>' | '>=' | '<' | '<=', value: number): boolean =>
      applies({ itemStats: [{ stat: 194, op, value }] }, sockets);
    expect(check('==', 3)).toBe(true);
    expect(check('!=', 3)).toBe(false);
    expect(check('>', 2)).toBe(true);
    expect(check('<', 3)).toBe(false);
    expect(check('<=', 3)).toBe(true);
    expect(applies({ itemStats: [{ stat: 194, op: 'between', value: [3, 5] }] }, sockets)).toBe(true);
    expect(applies({ itemStats: [{ stat: 194, op: 'between', value: [4, 5] }] }, sockets)).toBe(false);
  });

  it('fails a stat name it cannot resolve and reports the key', () => {
    expect(failedKeys({ itemStats: [{ stat: 'no_such_stat', op: '>=', value: 0 }] }, sockets)).toEqual(['itemStats']);
    // A quoted id is a stat name, as the validator says; it does not resolve to id 194.
    expect(failedKeys({ itemStats: [{ stat: '194', op: '>=', value: 0 }] }, sockets)).toEqual(['itemStats']);
  });

  it('counts a missing stat as 0', () => {
    expect(applies({ itemStats: [{ stat: 14, op: '==', value: 0 }] }, sockets)).toBe(true);
    expect(applies({ itemStats: [{ stat: 14, op: '>=', value: 1 }] }, sockets)).toBe(false);
  });

  it('filters by param, or reads only the param-0 entry without one (verified in game)', () => {
    expect(applies({ itemStats: [{ stat: 188, param: 2, value: 3 }] }, sockets)).toBe(true);
    expect(applies({ itemStats: [{ stat: 188, param: 5, value: 3 }] }, sockets)).toBe(false);
    // The item's 188 entries are at params 2 and 5: without param the check reads param 0, a missing entry = 0
    expect(applies({ itemStats: [{ stat: 188, value: 1 }] }, sockets)).toBe(false);
    expect(applies({ itemStats: [{ stat: 188, op: '<', value: 1 }] }, sockets)).toBe(true);
    expect(applies({ itemStats: [{ stat: 188, value: 1 }] }, makeItem({ stats: [{ stat: 188, value: 2 }] }))).toBe(true);
    expect(applies({ itemStats: [{ stat: 188, param: 7, op: '==', value: 0 }] }, sockets)).toBe(true);
  });

  it('reads only param 0 for a check without param, per the omitted-param mode', () => {
    expect(OMITTED_PARAM).toBe('layerZero');
    expect(checkedLayer(50)).toBe(50);
    expect(checkedLayer(undefined)).toBe(0);
    expect(checkedLayer(undefined, 'anyLayer')).toBeUndefined();
    expect(checkedLayer(50, 'anyLayer')).toBe(50);
  });

  it('needs all of itemStats but any of itemStatsAnyOf', () => {
    const one = { stat: 194, value: 3 };
    const other = { stat: 194, value: 9 };
    expect(applies({ itemStats: [one, other] }, sockets)).toBe(false);
    expect(applies({ itemStatsAnyOf: [one, other] }, sockets)).toBe(true);
    expect(applies({ itemStatsAnyOf: [other] }, sockets)).toBe(false);
  });

  it('checks the player stats', () => {
    const context = makeContext({ playerStats: [{ stat: 12, value: 85 }] });
    expect(applies({ playerStats: [{ stat: 'level', value: 80 }] }, makeItem(), context)).toBe(true);
    expect(applies({ playerStats: [{ stat: 12, value: 90 }] }, makeItem(), context)).toBe(false);
    expect(
      applies(
        {
          playerStatsAnyOf: [
            { stat: 12, value: 90 },
            { stat: 12, op: '<', value: 86 },
          ],
        },
        makeItem(),
        context
      )
    ).toBe(true);
  });
});

describe('rule flow', () => {
  it('stops at the first rule that hides', () => {
    const result = evaluateFilter(
      makeFilter([
        { itemCodes: ['r33'], labelBackground: [1, 2, 3] },
        { itemCodes: ['r33'], hide: true },
        { itemCodes: ['r33'], replaceName: 'Never' },
      ]),
      makeItem(),
      makeContext()
    );
    expect(result.trace.map((rule) => rule.outcome)).toEqual(['applied', 'hidden']);
    expect(result.hidden).toBe(true);
    expect(result.hiddenBy).toBe(1);
    expect(result.name).toBe('Zod Rune');
    expect(result.labelBackground).toBeNull();
  });

  it('keeps only the hiding rule chatMessageWhenHidden for a hidden item', () => {
    const result = evaluateFilter(
      makeFilter([
        { itemCodes: ['r33'], chatMessage: 'shown', sound: 'item_rune' },
        { itemCodes: ['r33'], hide: true, chatMessageWhenHidden: 'hid {name}' },
      ]),
      makeItem(),
      makeContext()
    );
    expect(result.chatMessages).toEqual(['hid Zod Rune']);
    expect(result.sounds).toEqual([]);
  });

  it('hides with hideIfOtherConditionsFail when codes, types and location hold', () => {
    const rule: LootFilterRule = {
      itemCodes: ['r33'],
      sockets: { min: 2 },
      hideIfOtherConditionsFail: true,
      chatMessageWhenHidden: 'nope',
    };
    const result = evaluateFilter(makeFilter([rule, { replaceName: 'later' }]), makeItem(), makeContext());
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]?.outcome).toBe('hiddenByOtherConditions');
    expect(result.trace[0]?.failed).toEqual(['sockets']);
    expect(result.hidden).toBe(true);
    expect(result.hiddenBy).toBe(0);
    expect(result.chatMessages).toEqual(['nope']);
  });

  it('does not hide with hideIfOtherConditionsFail when the codes, location or level fail', () => {
    const rule: LootFilterRule = { itemCodes: ['r33'], sockets: { min: 2 }, hideIfOtherConditionsFail: true };
    expect(evaluateFilter(makeFilter([{ ...rule, itemCodes: ['r32'] }]), makeItem(), makeContext()).hidden).toBe(false);
    expect(evaluateFilter(makeFilter([rule]), makeItem({ location: 'stored' }), makeContext()).hidden).toBe(false);
    expect(evaluateFilter(makeFilter([{ ...rule, activeInLevels: [4] }]), makeItem(), makeContext()).hidden).toBe(false);
  });

  it('applies hideIfOtherConditionsFail rules normally when everything holds', () => {
    const rule: LootFilterRule = { itemCodes: ['r33'], sockets: 0, hideIfOtherConditionsFail: true, replaceName: 'kept' };
    const result = evaluateFilter(makeFilter([rule]), makeItem(), makeContext());
    expect(result.hidden).toBe(false);
    expect(result.name).toBe('kept');
  });

  it('hides unmatched ground items with hideUnmatchedItems', () => {
    const filter = makeFilter([{ itemCodes: ['r01'], replaceName: 'El' }], { hideUnmatchedItems: true });
    const ground = evaluateFilter(filter, makeItem(), makeContext());
    expect(ground.hidden).toBe(true);
    expect(ground.hiddenBy).toBeNull();
    expect(ground.matched).toBe(false);
    expect(evaluateFilter(filter, makeItem({ location: 'stored' }), makeContext()).hidden).toBe(false);
  });

  it('returns the game name when no rule applied', () => {
    const result = evaluateFilter(makeFilter([{ itemCodes: ['r01'], replaceName: 'El' }]), makeItem(), makeContext());
    expect(result.matched).toBe(false);
    expect(result.name).toBe('Zod Rune');
    expect(result.trace[0]).toEqual({ index: 0, outcome: 'skipped', failed: ['itemCodes'], actions: {} });
  });
});

describe('styles', () => {
  const styles: Readonly<Record<string, LootFilterStyle>> = {
    Gold: { labelBackground: [200, 150, 0, 255], sound: 'gong.mp3', chatMessage: 'style line', replaceName: 'style name' },
  };

  it('merges the style under the rule, the rule winning per key', () => {
    const filter = makeFilter([{ itemCodes: ['r33'], useStyle: 'Gold', replaceName: 'rule name' }], { styles });
    const result = evaluateFilter(filter, makeItem(), makeContext());
    expect(result.trace[0]?.actions).toEqual({
      labelBackground: [200, 150, 0, 255],
      sound: 'gong.mp3',
      chatMessage: 'style line',
      replaceName: 'rule name',
      useStyle: 'Gold',
    });
    expect(result.name).toBe('rule name');
    expect(result.chatMessages).toEqual(['style line']);
    expect(result.labelBackground).toEqual([200, 150, 0, 255]);
  });

  it('ignores a missing style', () => {
    const result = evaluateFilter(
      makeFilter([{ itemCodes: ['r33'], useStyle: 'Nope', nameSuffix: '!' }], { styles }),
      makeItem(),
      makeContext()
    );
    expect(result.trace[0]?.outcome).toBe('applied');
    expect(result.name).toBe('Zod Rune!');
  });

  it('can hide through a style', () => {
    const result = evaluateFilter(
      makeFilter([{ itemCodes: ['r33'], useStyle: 'Hide' }], { styles: { Hide: { hide: true } } }),
      makeItem(),
      makeContext()
    );
    expect(result.hidden).toBe(true);
  });
});

describe('actions', () => {
  it('lets later rules win per key and accumulates chat lines and sounds', () => {
    const result = evaluateFilter(
      makeFilter([
        {
          labelBackground: [1, 1, 1],
          labelBorder: { color: [1, 1, 1], width: 1 },
          icon: { iconName: 'a' },
          droplight: {},
          replaceName: 'first',
          namePrefix: '<',
          chatMessage: 'one',
          sound: 'a.mp3',
        },
        { labelBackground: [2, 2, 2, 100], icon: { iconName: 'b', iconSize: 16 }, nameSuffix: '>', chatMessage: 'two', sound: 7 },
        { replaceName: 'third', droplight: { color: [255, 0, 0] } },
      ]),
      makeItem(),
      makeContext()
    );
    expect(result.labelBackground).toEqual([2, 2, 2, 100]);
    expect(result.labelBorder).toEqual({ color: [1, 1, 1], width: 1 });
    expect(result.icon).toEqual({ iconName: 'b', iconSize: 16 });
    expect(result.droplight).toEqual({ color: [255, 0, 0] });
    expect(result.name).toBe('<third>');
    expect(result.replaceName).toBe('third');
    expect(result.namePrefix).toBe('<');
    expect(result.nameSuffix).toBe('>');
    expect(result.chatMessages).toEqual(['one', 'two']);
    expect(result.sounds.map((sound) => sound.sound)).toEqual(['a.mp3', 7]);
  });

  it('defaults the label background alpha to 242', () => {
    const result = evaluateFilter(makeFilter([{ labelBackground: [10, 20, 30] }]), makeItem(), makeContext());
    expect(result.labelBackground).toEqual([10, 20, 30, 242]);
  });

  it('prints the drop line for notify unless the rule has its own chatMessage', () => {
    const result = evaluateFilter(
      makeFilter([{ notify: true }, { notify: true, chatMessage: 'own line' }, { notify: true }], {
        notifications: { dropFormat: 'ÿc4Drop: {qualityColor}{name}' },
      }),
      makeItem({ quality: 7 }),
      makeContext()
    );
    expect(result.notified).toBe(true);
    expect(result.chatMessages).toEqual(['ÿc4Drop: ÿcDZod Rune', 'own line', 'ÿc4Drop: ÿcDZod Rune']);
  });

  it('uses the default drop format', () => {
    const result = evaluateFilter(
      makeFilter([{ notify: true }], { qualityColors: { magic: 'ÿc2' } }),
      makeItem({ quality: 4 }),
      makeContext()
    );
    expect(result.chatMessages).toEqual(['ÿc2Zod Rune']);
  });

  it('resolves per-language texts with an enUS fallback', () => {
    const filter = makeFilter([{ replaceName: { enUS: 'Rune', deDE: 'Rune (de)' }, chatMessage: { enUS: 'drop' } }]);
    expect(evaluateFilter(filter, makeItem(), makeContext({ language: 'deDE' })).name).toBe('Rune (de)');
    expect(evaluateFilter(filter, makeItem(), makeContext({ language: 'deDE' })).chatMessages).toEqual(['drop']);
    expect(evaluateFilter(filter, makeItem(), makeContext()).name).toBe('Rune');
  });

  it("takes the sound volume from the rule, else the filter's, else 100", () => {
    const rules: readonly LootFilterRule[] = [{ sound: 'a', soundVolume: 30 }, { sound: 'b' }];
    expect(evaluateFilter(makeFilter(rules, { soundVolume: 60 }), makeItem(), makeContext()).sounds).toEqual([
      { sound: 'a', volume: 30 },
      { sound: 'b', volume: 60 },
    ]);
    expect(evaluateFilter(makeFilter(rules), makeItem(), makeContext()).sounds[1]).toEqual({ sound: 'b', volume: 100 });
    const styled = makeFilter([{ sound: 'c', useStyle: 'Quiet' }], { styles: { Quiet: { soundVolume: 10 } } });
    expect(evaluateFilter(styled, makeItem(), makeContext()).sounds).toEqual([{ sound: 'c', volume: 10 }]);
  });
});

describe('expandPlaceholders', () => {
  const filter = makeFilter([], { qualityColors: { unique: 'ÿc;' } });
  const item = makeItem({
    code: 'uap',
    quality: 7,
    baseTier: 1,
    itemLevel: 87,
    sockets: 2,
    maxSockets: 3,
    isEthereal: true,
    uniqueOrSetId: 112,
    name: 'Harlequin Crest',
    stats: [
      { stat: 96, value: 20 },
      { stat: 188, param: 3, value: 2 },
    ],
  });
  const context = makeContext({ playerStats: [{ stat: 12, value: 90 }] });
  const expand = (text: string): string => expandPlaceholders(text, item, context, filter);

  it('expands the item placeholders', () => {
    expect(expand('{name}|{code}|{quality}|{baseTier}|{itemLevel}|{sockets}|{maxSockets}|{ethereal}|{uniqueOrSetId}|{link}')).toBe(
      'Harlequin Crest|uap|unique|exceptional|87|2|3|Ethereal|112|Harlequin Crest'
    );
    expect(expandPlaceholders('[{ethereal}]', makeItem(), context, filter)).toBe('[]');
  });

  it('uses qualityColors, else the default label colour', () => {
    expect(expand('{qualityColor}')).toBe('ÿc;');
    expect(expandPlaceholders('{qualityColor}', makeItem({ quality: 6 }), context, filter)).toBe('ÿc?');
    expect(expandPlaceholders('{qualityColor}', makeItem({ quality: 1 }), context, filter)).toBe('ÿc=');
  });

  it('expands item and player stats, with params and names', () => {
    expect(expand('{stat:96}% FRW')).toBe('20% FRW');
    expect(expand('{stat:188,3}/{stat:188,4}/{stat:999}')).toBe('2/0/0');
    // Without a param only the param-0 entry is read (verified in game: Tab {stat:188} / {stat:188,8} showed 0 / 4)
    const fireTab = makeItem({ stats: [{ stat: 188, param: 8, value: 4 }] });
    expect(expandPlaceholders('{stat:188} / {stat:188,8}', fireTab, context, filter)).toBe('0 / 4');
    expect(expand('{playerStat:12} {playerStat:level}')).toBe('90 90');
  });

  it('leaves game strings and unknown placeholders alone', () => {
    expect(expand('{string:r01} {foo} {level} {stat:nope}')).toBe('{string:r01} {foo} {level} {stat:nope}');
  });
});

describe("Sully's QoL filter", () => {
  // Read through the parser, as the app does: v0.6.9's Ancient Scroll hide rule writes `"activeInLevels": 4`, which the
  // parser reads as [4] (with a warning) instead of handing a number to the evaluator.
  const source = readFileSync(resolve(process.cwd(), 'src/features/loot-filter/engine/__fixtures__/sullys-qol-filter-0.9.2.json'), 'utf8');
  const sully = parseLootFilter(source).filter;
  // v0.9.0 names the gold stat (`"stat": "gold"`), which the app resolves through the game data's stat ids.
  const hell = makeContext({
    filterLevel: 3,
    area: 2,
    playerStats: [{ stat: 12, value: 92 }],
    statIds: new Map([
      ['item_numsockets', 194],
      ['level', 12],
      ['gold', 14],
    ]),
  });
  const appliedNames = (items: TestItem, context: TestContext): readonly number[] =>
    evaluateFilter(sully, items, context)
      .trace.filter((rule) => rule.outcome === 'applied')
      .map((rule) => rule.index);

  it('shows a Zod rune (r83) on the ground at level 3 with its high-rune treatment', () => {
    const zod = makeItem({ code: 'r83', name: 'Zod Rune' });
    const result = evaluateFilter(sully, zod, hell);
    expect(result.hidden).toBe(false);
    // Since v0.9.0 the never-hide rule for high runes (rule 8) applies too, then the Zod label rule.
    expect(appliedNames(zod, hell)).toEqual([8, 223]);
    expect(sully.rules[223]?.itemCodes).toContain('r83');
    expect(result.name).toBe('ÿc1Zod Rune');
    expect(result.chatMessages).toEqual(['ÿc1*ÿc3*ÿc2*   ÿc8High Rune Drop: ÿc0Zod   ÿc1*ÿc3*ÿc2*']);
    // The Jackpot style's sound at the filter's soundVolume 25.
    expect(result.sounds).toEqual([{ sound: 'tink.mp3', volume: 25 }]);
    expect(result.labelBackground).toEqual([255, 255, 255, 255]);
    expect(result.labelBorder).toEqual({ color: [240, 0, 0, 230], width: 2 });
    expect(result.icon).toEqual({ iconName: 'rune', iconSize: 50 });
    // v0.9.0 adds beams (droplight) to the styles.
    expect(result.droplight).toEqual({ color: [255, 0, 0] });
  });

  it('hides a tier 1 map (z01) at level 4 but labels it at level 3, and leaves it alone in the stash', () => {
    const map = makeItem({ code: 'z01', typeAncestors: ['map'], name: 'Cellar of Pain' });
    const maps = { ...hell, filterLevel: 4 };
    const hidden = evaluateFilter(sully, map, maps);
    expect(hidden.hidden).toBe(true);
    expect(hidden.hiddenBy).not.toBeNull();
    expect(sully.rules[hidden.hiddenBy ?? -1]?.activeInLevels).toEqual([4]);
    expect(hidden.trace.at(-1)?.outcome).toBe('hidden');

    const shown = evaluateFilter(sully, map, hell);
    expect(shown.hidden).toBe(false);
    expect(shown.name).toBe('Cellar of Pain (Tier 1)');
    expect(shown.chatMessages).toEqual(['Tier 1 Map: ÿc0Cellars of Pain']);
    expect(shown.icon).toEqual({ iconName: 'map', iconSize: 30 });

    const stored = evaluateFilter(sully, { ...map, location: 'stored' }, maps);
    expect(stored.hidden).toBe(false);
    expect(stored.matched).toBe(false);
  });

  it('lists the rune recipes on a stored Null rune (r50)', () => {
    const stored = evaluateFilter(sully, makeItem({ code: 'r50', name: 'Null Rune', location: 'stored' }), hell);
    expect(stored.name).toMatch(/^\nGod Rune: /);
  });

  it('hides small gold piles for a high level player but relabels larger ones', () => {
    const gold = (amount: number): TestItem =>
      makeItem({ code: 'gld', typeAncestors: ['gold'], name: `${String(amount)} Gold`, stats: [{ stat: 14, value: amount }] });
    expect(evaluateFilter(sully, gold(1), hell).hidden).toBe(true);
    expect(evaluateFilter(sully, gold(1500), hell).hidden).toBe(true);
    const big = evaluateFilter(sully, gold(5000), hell);
    expect(big.hidden).toBe(false);
    expect(big.name).toBe('ÿc0$$');
    // In town (area 1) only the 1-gold rule hides.
    expect(evaluateFilter(sully, gold(1500), { ...hell, area: 1 }).name).toBe('ÿc0$$');
  });

  it('hides Ancient Scrolls at level 4 only: rule 77\'s "activeInLevels": 4 reads as [4]', () => {
    // Sully writes a number where the format wants a list since v0.6.9 (rule 98 up to v0.7.0, rule 77 since v0.9.0); it
    // works in game (Sully, 2026-11).
    const scroll = makeItem({ code: '01b', typeAncestors: ['misc'], name: 'Ancient Scroll' });
    expect(wrongShapedKeys(sully.rules[77] ?? {})).toEqual([]);
    const maps = evaluateFilter(sully, scroll, { ...hell, filterLevel: 4 });
    expect(maps.hidden).toBe(true);
    expect(maps.hiddenBy).toBe(77);
    // At levels 1 to 3 rule 77 is inactive and the gong highlight (rule 136) applies.
    for (const filterLevel of [1, 2, 3]) {
      const shown = evaluateFilter(sully, scroll, { ...hell, filterLevel });
      expect(shown.hidden).toBe(false);
      expect(shown.trace.find((entry) => entry.index === 77)).toEqual(
        expect.objectContaining({ outcome: 'skipped', failed: ['activeInLevels'] })
      );
      expect(shown.name).toBe('ÿc6Ancient Scroll');
    }
  });

  it('labels a mythical unique with the Mythical style', () => {
    const bow = makeItem({ code: 'm01', typeAncestors: ['bow', 'miss', 'weap'], quality: 7, baseTier: 2, name: 'Some Unique', sockets: 2 });
    const result = evaluateFilter(sully, bow, hell);
    expect(result.hidden).toBe(false);
    expect(result.name).toBe('Mythical Marksmen Bow');
    expect(result.sounds).toEqual([{ sound: 'mythical.mp3', volume: 25 }]);
    expect(result.labelBorder).toEqual({ color: [240, 0, 0, 230], width: 2 });
    // The rule writes `myth`; the bundled file is Myth.sprite (the plugin's file names are case-insensitive).
    expect(result.icon).toEqual({ iconName: 'myth', iconSize: 50 });
  });
});

describe('wrong-shaped rules', () => {
  it('skips a rule with a wrong-shaped condition or action, but not one with an unknown key', () => {
    const filter = makeFilter([
      { itemCodes: ['r33'], hide: true, passthrough: { activeInLevels: 4 } },
      { itemCodes: ['r33'], hideIfOtherConditionsFail: true, quality: 'unique', passthrough: { labelBackground: [1, 2] } },
      { itemCodes: ['r32'], namePrefix: 'Y ', passthrough: { sockets: 'two' } },
      { itemCodes: ['r33'], namePrefix: 'X ', passthrough: { highlight: true } },
    ]);
    const result = evaluateFilter(filter, makeItem(), makeContext());
    expect(result.trace).toEqual([
      { index: 0, outcome: 'wrongShape', failed: [], actions: {}, wrongShaped: ['activeInLevels'] },
      { index: 1, outcome: 'wrongShape', failed: ['quality'], actions: {}, wrongShaped: ['labelBackground'] },
      { index: 2, outcome: 'wrongShape', failed: ['itemCodes'], actions: {}, wrongShaped: ['sockets'] },
      expect.objectContaining({ index: 3, outcome: 'applied' }),
    ]);
    expect(result.hidden).toBe(false);
    expect(result.name).toBe('X Zod Rune');
  });

  it('lists only known keys as wrong-shaped', () => {
    expect(wrongShapedKeys({ passthrough: { activeInLevels: 4, highlight: true, sound: [1] } })).toEqual(['activeInLevels', 'sound']);
    expect(wrongShapedKeys({ itemCodes: ['r33'] })).toEqual([]);
  });

  it('does not skip a rule for a wrong-shaped comment (the plugin ignores comments)', () => {
    const rule = { itemCodes: ['r33'], namePrefix: 'X ', passthrough: { comment: 42 } };
    expect(wrongShapedKeys(rule)).toEqual([]);
    const result = evaluateFilter(makeFilter([rule]), makeItem(), makeContext());
    expect(result.trace).toEqual([expect.objectContaining({ index: 0, outcome: 'applied' })]);
  });
});

describe('disabled rules', () => {
  it('skips a disabled rule with the outcome "disabled": it never applies or hides', () => {
    const filter = makeFilter([
      { itemCodes: ['r33'], hide: true, disabled: true },
      { itemCodes: ['r33'], hideIfOtherConditionsFail: true, quality: 'unique', disabled: true },
      { itemCodes: ['r33'], namePrefix: 'X ' },
    ]);
    const result = evaluateFilter(filter, makeItem(), makeContext());
    expect(result.trace).toEqual([
      { index: 0, outcome: 'disabled', failed: [], actions: {} },
      { index: 1, outcome: 'disabled', failed: [], actions: {} },
      expect.objectContaining({ index: 2, outcome: 'applied' }),
    ]);
    expect(result.hidden).toBe(false);
    expect(result.name).toBe('X Zod Rune');
  });
});

describe('show (plugin 1.8.2)', () => {
  it('protects the item from a later hide, whose other actions still apply', () => {
    const result = evaluateFilter(
      makeFilter([
        { itemCodes: ['r33'], show: true, labelBackground: [1, 2, 3] },
        { itemTypes: ['rune'], hide: true, chatMessageWhenHidden: 'hid', replaceName: 'Later' },
        { itemCodes: ['r33'], sound: 'item_rune' },
      ]),
      makeItem(),
      makeContext()
    );
    expect(result.hidden).toBe(false);
    expect(result.shownBy).toBe(0);
    expect(result.trace.map((entry) => entry.outcome)).toEqual(['applied', 'applied', 'applied']);
    expect(result.trace[1]?.hideBlockedBy).toBe(0);
    expect(result.name).toBe('Later');
    expect(result.labelBackground).toEqual([1, 2, 3, 242]);
    expect(result.chatMessages).toEqual([]);
    expect(result.sounds).toEqual([{ sound: 'item_rune', volume: 100 }]);
  });

  it('protects from hideIfOtherConditionsFail and hideUnmatchedItems', () => {
    const blocked = evaluateFilter(
      makeFilter([
        { itemCodes: ['r33'], show: true },
        { itemCodes: ['r33'], sockets: { min: 2 }, hideIfOtherConditionsFail: true },
      ]),
      makeItem(),
      makeContext()
    );
    expect(blocked.hidden).toBe(false);
    expect(blocked.trace[1]).toMatchObject({ outcome: 'skipped', hideBlockedBy: 0 });
    const unmatched = evaluateFilter(
      makeFilter([{ itemCodes: ['r33'], show: true }], { hideUnmatchedItems: true }),
      makeItem(),
      makeContext()
    );
    expect(unmatched.hidden).toBe(false);
  });

  it('does not protect from a hide before it, and only when it matched', () => {
    const before = evaluateFilter(
      makeFilter([
        { itemCodes: ['r33'], hide: true },
        { itemCodes: ['r33'], show: true },
      ]),
      makeItem(),
      makeContext()
    );
    expect(before.hiddenBy).toBe(0);
    const notMatched = evaluateFilter(
      makeFilter([
        { itemCodes: ['r01'], show: true },
        { itemCodes: ['r33'], hide: true },
      ]),
      makeItem(),
      makeContext()
    );
    expect(notMatched.hiddenBy).toBe(1);
  });

  it('switches off a rule that both shows and hides, also through its style', () => {
    const own = evaluateFilter(makeFilter([{ itemCodes: ['r33'], show: true, hide: true }]), makeItem(), makeContext());
    expect(own.trace[0]?.outcome).toBe('switchedOff');
    expect(own.hidden).toBe(false);
    expect(own.matched).toBe(false);
    const styled = evaluateFilter(
      makeFilter([{ itemCodes: ['r33'], useStyle: 'H', show: true }], { styles: { H: { hide: true } } }),
      makeItem(),
      makeContext()
    );
    expect(styled.trace[0]?.outcome).toBe('switchedOff');
  });
});

describe('evaluateFilter: formula', () => {
  const FCR = 105;
  const context = makeContext({
    statIds: new Map([
      ['item_fastercastrate', FCR],
      ['fireresist', 39],
      ['lightresist', 41],
      ['coldresist', 43],
      ['item_nonclassskill', 97],
      ['item_skillonhit', 201],
      ['item_numsockets', 194],
      ['level', 12],
    ]),
    skillIds: new Map([['teleport', 54]]),
    playerStats: [{ stat: 12, value: 70 }],
  });
  const ring = (overrides: Partial<TestItem> = {}) =>
    makeItem({ code: 'rin', typeAncestors: ['ring', 'misc'], quality: 4, name: 'Ring', ...overrides });
  const run = (rules: LootFilterRule[], item: TestItem = ring()) => evaluateFilter(makeFilter(rules), item, context);

  it('is ANDed with the other conditions and traces its value', () => {
    const rule: LootFilterRule = { itemTypes: ['ring'], formula: "stat('item_fastercastrate') >= 10", namePrefix: 'FCR ' };
    const hit = run([rule], ring({ stats: [{ stat: FCR, value: 10 }] }));
    expect(hit.trace[0]).toEqual({
      index: 0,
      outcome: 'applied',
      failed: [],
      actions: { namePrefix: 'FCR ' },
      formula: { status: 'value', value: 1 },
    });
    const miss = run([rule], ring({ stats: [{ stat: FCR, value: 5 }] }));
    expect(miss.trace[0]).toMatchObject({ outcome: 'skipped', failed: ['formula'], formula: { status: 'value', value: 0 } });
    const wrongType = run([rule], makeItem({ stats: [{ stat: FCR, value: 20 }] }));
    expect(wrongType.trace[0]).toMatchObject({ outcome: 'skipped', failed: ['itemTypes'], formula: { status: 'value', value: 1 } });
  });

  it('holds for any non-zero value, reads player stats and skill names', () => {
    const item = ring({ stats: [{ stat: 97, param: 54, value: 12 }] });
    expect(run([{ formula: "stat('fireresist') - 5", hide: true }], item).trace[0]).toMatchObject({ outcome: 'hidden' });
    expect(run([{ formula: "playerStat('level') > 60 && stat('item_nonclassskill', 'Teleport') > 10", hide: true }], item).hidden).toBe(
      true
    );
    expect(run([{ formula: "stat('item_nonclassskill', 'Teleport') > 12", hide: true }], item).hidden).toBe(false);
  });

  it('is an other condition for hideIfOtherConditionsFail (the guide example)', () => {
    const rule: LootFilterRule = {
      itemTypes: ['ring'],
      quality: 'magic',
      formula: "((stat('item_fastercastrate')>=10)&&((stat('fireresist')+stat('coldresist')+stat('lightresist'))>=40))",
      hideIfOtherConditionsFail: true,
    };
    const result = run([rule], ring({ stats: [{ stat: FCR, value: 10 }] }));
    expect(result.trace[0]).toMatchObject({ outcome: 'hiddenByOtherConditions', failed: ['formula'] });
    expect(result.hidden).toBe(true);
  });

  it('skips the whole rule on an unidentified item when the formula reads an item stat (the guide)', () => {
    const rule: LootFilterRule = { itemTypes: ['ring'], formula: "stat('item_fastercastrate') >= 10", hideIfOtherConditionsFail: true };
    const result = run([rule], ring({ isIdentified: false }));
    expect(result.trace[0]).toMatchObject({ outcome: 'skipped', failed: [], unidentified: true, formula: { status: 'unidentified' } });
    expect(result.hidden).toBe(false);
    // Player stats and the stats every item carries still work
    for (const formula of ["playerStat('level') > 1 && 0", "stat('item_numsockets') >= 9"]) {
      expect(run([{ ...rule, formula }], ring({ isIdentified: false })).trace[0]).toMatchObject({ outcome: 'hiddenByOtherConditions' });
    }
  });

  it('switches a rule with a syntax error off: it never runs, nor hides', () => {
    const rule: LootFilterRule = { itemTypes: ['ring'], formula: "stat('fireresist') = 1", hideIfOtherConditionsFail: true, hide: true };
    const result = run([rule, { itemTypes: ['ring'], namePrefix: 'x ' }]);
    expect(result.trace[0]).toEqual({
      index: 0,
      outcome: 'switchedOff',
      failed: [],
      actions: {},
      reason: 'its formula has an error',
      formula: { status: 'error', message: "'=' is not an operator; compare with '=='", offset: 19 },
    });
    expect(result.hidden).toBe(false);
    expect(result.name).toBe('x Ring');
  });

  it('switches rules with huge formulas off instead of overflowing the stack', () => {
    for (const formula of [`${'('.repeat(3000)}1${')'.repeat(3000)}`, `${'!'.repeat(10000)}1`, Array<string>(10000).fill('1').join('+')]) {
      expect(run([{ formula, hide: true }]).trace[0]).toMatchObject({ outcome: 'switchedOff', formula: { status: 'error' } });
    }
  });

  it('leaves rules without a formula untraced', () => {
    expect(run([{ itemTypes: ['ring'], namePrefix: 'x' }]).trace[0]).not.toHaveProperty('formula');
  });
});

describe('unidentified items (plugin 1.8.2)', () => {
  const context = makeContext({
    statIds: new Map([
      ['item_numsockets', 194],
      ['item_allskills', 127],
      ['level', 12],
    ]),
  });
  const ring = (isIdentified: boolean) => makeItem({ code: 'rin', typeAncestors: ['ring', 'misc'], quality: 4, isIdentified });

  it('skips a rule that checks an item stat: no actions, and it cannot hide the item', () => {
    const rule: LootFilterRule = {
      itemTypes: ['ring'],
      quality: 'magic',
      itemStats: [{ stat: 'item_allskills', op: '<', value: 1 }],
      hide: true,
    };
    const unidentified = evaluateFilter(makeFilter([rule]), ring(false), context);
    expect(unidentified.hidden).toBe(false);
    expect(unidentified.trace[0]).toEqual({ index: 0, outcome: 'skipped', failed: [], actions: {}, unidentified: true });
    expect(evaluateFilter(makeFilter([rule]), ring(true), context).hidden).toBe(true);
    const anyOf = evaluateFilter(
      makeFilter([{ itemTypes: ['ring'], itemStatsAnyOf: [{ stat: 127, value: 1 }], namePrefix: 'x' }]),
      ring(false),
      context
    );
    expect(anyOf.trace[0]).toMatchObject({ outcome: 'skipped', unidentified: true });
  });

  it('runs rules on the stats every item carries, player stats and no stats', () => {
    const rules: LootFilterRule[] = [
      { itemTypes: ['ring'], itemStats: [{ stat: 'item_numsockets', op: '<', value: 1 }], namePrefix: 'a ' },
      { itemTypes: ['ring'], playerStats: [{ stat: 'level', op: '<', value: 99 }], namePrefix: 'b ' },
      { itemTypes: ['ring'], hide: true },
    ];
    const result = evaluateFilter(makeFilter(rules), ring(false), context);
    expect(result.trace.map((entry) => entry.outcome)).toEqual(['applied', 'applied', 'hidden']);
  });
});

describe('unknown formula names, unidentified items without game data, trace order', () => {
  const context = makeContext({
    statIds: new Map([
      ['fireresist', 39],
      ['item_nonclassskill', 97],
      ['item_numsockets', 194],
      ['level', 12],
    ]),
    skillIds: new Map([['teleport', 54]]),
  });
  const ring = (overrides: Partial<TestItem> = {}) => makeItem({ code: 'rin', typeAncestors: ['ring', 'misc'], quality: 4, ...overrides });

  it('switches a rule off when its formula names a stat or skill the game data lacks, as the validator says', () => {
    const typo = evaluateFilter(makeFilter([{ itemCodes: ['rin'], formula: "!stat('firresist')", hide: true }]), ring(), context);
    expect(typo.hidden).toBe(false);
    expect(typo.trace[0]).toMatchObject({
      outcome: 'switchedOff',
      formula: { status: 'error', message: "Unknown stat 'firresist'", offset: 6 },
    });
    const skill = evaluateFilter(
      makeFilter([{ itemCodes: ['rin'], formula: "stat('item_nonclassskill', 'Hex: Bane') < 1", hide: true }]),
      ring(),
      context
    );
    expect(skill.trace[0]).toMatchObject({ outcome: 'switchedOff', formula: { status: 'error', message: "Unknown skill 'Hex: Bane'" } });
    // Without game data nothing is unknown
    const noData = evaluateFilter(
      makeFilter([{ itemCodes: ['rin'], formula: "!stat('firresist')", hide: true }]),
      ring(),
      makeContext({ statIds: new Map() })
    );
    expect(noData.hidden).toBe(true);
  });

  it('knows the stats every item carries before the game data loads, by name or id', () => {
    const noData = makeContext({ statIds: new Map() });
    for (const stat of ['gold', 'quantity', 'item_numsockets', 194, 14] as const) {
      const rule: LootFilterRule = { itemCodes: ['rin'], itemStats: [{ stat, op: '<', value: 1 }], hide: true };
      expect(evaluateFilter(makeFilter([rule]), ring({ isIdentified: false }), noData).trace[0], String(stat)).not.toHaveProperty(
        'unidentified'
      );
    }
    const other: LootFilterRule = { itemCodes: ['rin'], itemStats: [{ stat: 'fireresist', op: '<', value: 1 }], hide: true };
    expect(evaluateFilter(makeFilter([other]), ring({ isIdentified: false }), noData).trace[0]).toMatchObject({ unidentified: true });
  });

  it('reports a wrong shape or show + hide before the unidentified skip', () => {
    const stats = [{ stat: 'fireresist', value: 1 }] as const;
    const wrong = evaluateFilter(
      makeFilter([{ itemStats: stats, namePrefix: 'x', passthrough: { sockets: 'two' } }]),
      ring({ isIdentified: false }),
      context
    );
    expect(wrong.trace[0]?.outcome).toBe('wrongShape');
    const both = evaluateFilter(
      makeFilter([{ itemStats: stats, show: true, hide: true, formula: '1' }]),
      ring({ isIdentified: false }),
      context
    );
    expect(both.trace[0]).toMatchObject({ outcome: 'switchedOff', formula: { status: 'value', value: 1 } });
  });
});

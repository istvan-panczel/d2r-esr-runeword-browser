import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkedLayer, evaluateFilter, expandPlaceholders, OMITTED_PARAM } from './evaluate';
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

  it('filters by param, or takes any entry without one', () => {
    expect(applies({ itemStats: [{ stat: 188, param: 2, value: 3 }] }, sockets)).toBe(true);
    expect(applies({ itemStats: [{ stat: 188, param: 5, value: 3 }] }, sockets)).toBe(false);
    expect(applies({ itemStats: [{ stat: 188, value: 3 }] }, sockets)).toBe(true);
    expect(applies({ itemStats: [{ stat: 188, param: 7, op: '==', value: 0 }] }, sockets)).toBe(true);
  });

  it('reads every entry or only param 0 for a check without param, per the omitted-param mode', () => {
    expect(OMITTED_PARAM).toBe('anyLayer');
    expect(checkedLayer(50)).toBe(50);
    expect(checkedLayer(undefined)).toBeUndefined();
    expect(checkedLayer(undefined, 'layerZero')).toBe(0);
    expect(checkedLayer(50, 'layerZero')).toBe(50);
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
    expect(expand('{playerStat:12} {playerStat:level}')).toBe('90 90');
  });

  it('leaves game strings and unknown placeholders alone', () => {
    expect(expand('{string:r01} {foo} {level} {stat:nope}')).toBe('{string:r01} {foo} {level} {stat:nope}');
  });
});

describe("Sully's QoL filter", () => {
  const source = readFileSync(resolve(process.cwd(), 'public/loot-filters/sullys-qol-filter.json'), 'utf8');
  // Strip the `//` comment lines (leading and between rules) and parse the rest; no `//` appears inside strings.
  const json = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const parsed: unknown = JSON.parse(json);
  const sully = { ...(parsed as Omit<LootFilter, 'leadingComments'>), leadingComments: [] };
  const hell = makeContext({ filterLevel: 3, area: 2, playerStats: [{ stat: 12, value: 92 }] });
  const appliedNames = (items: TestItem, context: TestContext): readonly number[] =>
    evaluateFilter(sully, items, context)
      .trace.filter((rule) => rule.outcome === 'applied')
      .map((rule) => rule.index);

  it('shows a Zod rune (r83) on the ground at level 3 with its high-rune treatment', () => {
    const zod = makeItem({ code: 'r83', name: 'Zod Rune' });
    const result = evaluateFilter(sully, zod, hell);
    expect(result.hidden).toBe(false);
    expect(appliedNames(zod, hell)).toHaveLength(1);
    expect(result.name).toBe('ÿc1Zod Rune');
    expect(result.chatMessages).toEqual(['ÿc1*ÿc3*ÿc2*   ÿc8High Rune Drop: ÿc0Zod   ÿc1*ÿc3*ÿc2*']);
    // The Jackpot style's sound at the filter's soundVolume 25.
    expect(result.sounds).toEqual([{ sound: 'tink.mp3', volume: 25 }]);
    expect(result.labelBackground).toEqual([255, 255, 255, 255]);
    expect(result.labelBorder).toEqual({ color: [240, 0, 0, 230], width: 2 });
    expect(result.icon).toEqual({ iconName: 'rune', iconSize: 50 });
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

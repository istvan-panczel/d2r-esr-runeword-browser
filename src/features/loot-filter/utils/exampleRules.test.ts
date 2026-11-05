import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { evaluateFilter, type TestContext, type TestItem } from '../engine/evaluate';
import { parseLootFilter } from '../engine/parse';
import { buildLootFilterReference } from '../engine/reference';
import { serializeLootFilter } from '../engine/serialize';
import type { LootFilter, LootFilterRule, LootFilterStyle } from '../engine/types';
import { validateLootFilter } from '../engine/validate';
import { findBundledIcon, findBundledIconAsset, findBundledSound } from './bundledAssets';
import {
  buildExampleRule,
  chatOptions,
  DEFAULT_EXAMPLE_ICON_SIZE,
  defaultChoices,
  EXAMPLE_GROUPS,
  EXAMPLE_RULES,
  findExample,
  hasFixedAction,
  isHideExample,
  NO_CHOICES,
  PLAIN_CHAT_MESSAGE,
  type ExampleRule,
} from './exampleRules';
import { STYLE_PRESETS } from './stylePresets';

const json = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data', file), 'utf8')) as unknown;
const lootfilter = json('lootfilter.json') as LootFilterDataBundle;
const reference = buildLootFilterReference(lootfilter, json('types.json') as TypesBundle);

const filterOf = (rules: readonly LootFilterRule[], styles?: Readonly<Record<string, LootFilterStyle>>): LootFilter => ({
  formatVersion: 1,
  rules,
  leadingComments: [],
  ...(styles === undefined ? {} : { styles }),
});
const example = (id: string): ExampleRule => {
  const found = findExample(id);
  if (found === undefined) throw new Error(`no example ${id}`);
  return found;
};
const defaultRule = (id: string): LootFilterRule => buildExampleRule(example(id), defaultChoices(example(id))).rule;
const itemName = (code: string) => lootfilter.items.find((item) => item.code === code)?.name;

/** Writes and reads the filter, then validates it; returns the parse diagnostics and the validator's. */
function roundTrip(filter: LootFilter) {
  const parsed = parseLootFilter(serializeLootFilter(filter));
  return { parsed, problems: [...parsed.diagnostics, ...validateLootFilter(parsed.filter, reference)] };
}

describe('EXAMPLE_RULES', () => {
  it('has unique ids, a known group each, and between 40 and 70 examples', () => {
    expect(new Set(EXAMPLE_RULES.map((entry) => entry.id)).size).toBe(EXAMPLE_RULES.length);
    const groups = new Set(EXAMPLE_GROUPS.map((group) => group.id));
    for (const entry of EXAMPLE_RULES) expect(groups.has(entry.group), entry.id).toBe(true);
    for (const group of EXAMPLE_GROUPS)
      expect(
        EXAMPLE_RULES.some((entry) => entry.group === group.id),
        group.id
      ).toBe(true);
    expect(EXAMPLE_RULES.length).toBeGreaterThanOrEqual(40);
    expect(EXAMPLE_RULES.length).toBeLessThanOrEqual(70);
  });

  it.each(EXAMPLE_RULES.map((entry) => [entry.id, entry] as const))(
    '%s survives a write and read and validates without a problem, with its default presentation and without',
    (_id, entry) => {
      for (const choices of [defaultChoices(entry), NO_CHOICES]) {
        const { rule, stylesToAdd } = buildExampleRule(entry, choices);
        const filter = filterOf([rule], Object.keys(stylesToAdd).length === 0 ? undefined : stylesToAdd);
        const { parsed, problems } = roundTrip(filter);
        expect(parsed.filter.rules).toEqual([rule]);
        // With every choice None, a rule without a fixed action does nothing, and the validator says so (the dialog too).
        const doesNothing = choices === NO_CHOICES && !hasFixedAction(entry);
        expect(problems.map((problem) => problem.message)).toEqual(
          doesNothing ? ['The rule has conditions but no actions, so it does nothing'] : []
        );
      }
    }
  );

  it('has a title, a description, no activeInLevels and no presentation keys in the rule itself', () => {
    for (const entry of EXAMPLE_RULES) {
      expect(entry.title, entry.id).not.toBe('');
      expect(entry.description, entry.id).toMatch(/[.)]$/);
      expect(entry.rule.activeInLevels, entry.id).toBeUndefined();
      for (const key of ['useStyle', 'sound', 'icon', 'chatMessage', 'comment'] as const)
        expect(entry.rule[key], `${entry.id} ${key}`).toBeUndefined();
    }
  });

  it('gives hide rules no presentation and every other rule one, with sounds, icons and styles that exist', () => {
    const presets = new Set(STYLE_PRESETS.map((preset) => preset.id));
    for (const entry of EXAMPLE_RULES) {
      if (isHideExample(entry)) {
        expect(entry.presentation, entry.id).toBeUndefined();
        continue;
      }
      const presentation = entry.presentation ?? {};
      expect(entry.presentation, entry.id).toBeDefined();
      if (presentation.style !== undefined) expect(presets.has(presentation.style), entry.id).toBe(true);
      if (presentation.sound !== undefined) expect(findBundledSound(presentation.sound), entry.id).toBe(presentation.sound);
      if (presentation.icon !== undefined) expect(findBundledIcon(presentation.icon), entry.id).toBe(presentation.icon);
    }
  });

  it('defaults to the generated icons, drawn at 27 to 50 px', () => {
    const withIcon = EXAMPLE_RULES.filter((entry) => entry.presentation?.icon !== undefined);
    expect(withIcon.length).toBeGreaterThan(30);
    for (const entry of withIcon) {
      expect(findBundledIconAsset(entry.presentation?.icon)?.credit, entry.id).toBe('Generated for this app');
      const size = entry.presentation?.iconSize ?? DEFAULT_EXAMPLE_ICON_SIZE;
      expect(size, entry.id).toBeGreaterThanOrEqual(27);
      expect(size, entry.id).toBeLessThanOrEqual(50);
    }
    const icon = (id: string) => example(id).presentation?.icon;
    expect([icon('high-runes'), icon('upper-runes'), icon('unique-items'), icon('set-items'), icon('mythical-uniques')]).toEqual([
      'diamond_red',
      'diamond_orange',
      'star_gold',
      'star_green',
      'star_purple',
    ]);
    expect([icon('pandemonium-keys'), icon('uber-organs'), icon('elite-coupons'), icon('perfect-gems'), icon('tier-5-maps')]).toEqual([
      'key_purple',
      'skull_purple',
      'scroll_gold',
      'gem_gold',
      'map_white',
    ]);
  });

  it('never checks Enhanced Damage or Defense', () => {
    for (const { rule } of EXAMPLE_RULES) {
      const stats = [...(rule.itemStats ?? []), ...(rule.itemStatsAnyOf ?? [])].map((check) => String(check.stat));
      expect(stats.filter((stat) => /damage_percent|armor_percent|^1[678]$/.test(stat))).toEqual([]);
    }
  });

  it('names codes and ids that are what the titles say', () => {
    const uniques = example('unique-by-id').rule.uniqueOrSetIds?.map((id) => lootfilter.uniques.find((entry) => entry.id === id)?.name);
    expect(uniques).toEqual(['The Oculus', 'The Oculus']);
    const runes = (id: string) => example(id).rule.itemCodes?.map(itemName) ?? [];
    expect([runes('low-runes').at(0), runes('low-runes').at(-1)]).toEqual(['El Rune', 'Dol Rune']);
    expect([runes('mid-runes').at(0), runes('mid-runes').at(-1)]).toEqual(['Hel Rune', 'Um Rune']);
    expect(runes('upper-runes')).toEqual(['Mal Rune', 'Ist Rune', 'Gul Rune']);
    expect([runes('high-runes').at(0), runes('high-runes').at(-1)]).toEqual(['Vex Rune', 'Zod Rune']);
    expect([runes('kanji-runes').at(0), runes('kanji-runes').at(-1)]).toEqual(['I Rune', 'Mo Rune']);
    expect([runes('kanji-gold-runes').at(0), runes('kanji-gold-runes').at(-1)]).toEqual(['No Rune', 'Re Rune']);
    expect(runes('kanji-high-runes')).toEqual(['Su Rune', 'He Rune', 'Nu Rune', 'Wo Rune', 'Null Rune']);
    expect([runes('elemental-runes').at(0), runes('elemental-runes').at(-1)]).toEqual(['Moon Rune', 'God Rune']);
    expect([runes('high-rune-decals').at(0), runes('high-rune-decals').at(-1)]).toEqual([
      'Ancient Decal (To -> Mal)',
      'Ancient Decal (Wo -> Zod)',
    ]);
    expect(runes('aura-stones').every((name) => name?.endsWith('Aura Stone'))).toBe(true);
    expect(runes('ancient-scrolls').every((name) => name === 'Ancient Scroll')).toBe(true);
    expect(runes('legendary-materials')).toEqual([
      "Lilith's Crystallized Tear",
      "Tyrael's Eternal Feather",
      "Lucion's Essence",
      "Lucion's Relic of Sanctification",
      "Astrogha's Petrified Heart",
      "Inarius' Everburning Halo",
    ]);
    expect(runes('mythical-uniques').every((name) => name === 'Ring' || name === 'Amulet' || name?.startsWith('Mythical '))).toBe(true);
    expect(runes('weapon-mastery-tokens')).toEqual(['Weapon Mastery Token']);
    expect(runes('hourglass-pieces')).toEqual(['Broken hourglass shard', 'Broken hourglass shard', 'Broken hourglass']);
    expect(runes('unique-stones')).toEqual(['Unique Stone (nor)', 'Unique Stone (exc)', 'Unique Stone (eli)']);
    expect(runes('ore-and-fake-notes')).toEqual(['Ore', 'Fake Note']);
    const dropLists = [
      'mythical-uniques',
      'rune-crystals',
      'body-parts',
      'tier-5-maps',
      'weapon-mastery-tokens',
      'hourglass-pieces',
      'ore-and-fake-notes',
    ];
    for (const id of dropLists) {
      for (const code of example(id).rule.itemCodes ?? [])
        expect(lootfilter.items.find((item) => item.code === code)?.drops, `${id} ${code}`).toBe(true);
    }
  });

  it('lists one skill tab check per class tab, each naming a tab', () => {
    const checks = example('skill-tab-grand-charms').rule.itemStatsAnyOf ?? [];
    expect(checks).toHaveLength(24);
    for (const check of checks) expect(reference.skillTabNames.has(check.param ?? -1)).toBe(true);
  });
});

describe('buildExampleRule', () => {
  const high = example('high-runes');

  it('adds the title as comment, then the chosen style, sound, icon and chat line, and the style to add', () => {
    const { rule, stylesToAdd } = buildExampleRule(high, { style: 'high-rune', sound: 'tink.mp3', icon: 'rune', chatMessage: 'x {name}' });
    expect(rule).toEqual({
      comment: 'High runes: Vex to Zod',
      itemCodes: high.rule.itemCodes,
      useStyle: 'HighRune',
      sound: 'tink.mp3',
      icon: { iconName: 'rune', iconSize: 50 },
      chatMessage: 'x {name}',
    });
    expect(Object.keys(stylesToAdd)).toEqual(['HighRune']);
    expect(stylesToAdd.HighRune).toBe(STYLE_PRESETS.find((preset) => preset.id === 'high-rune')?.style);
  });

  it('leaves out every None choice', () => {
    expect(buildExampleRule(high, NO_CHOICES)).toEqual({ rule: { comment: high.title, itemCodes: high.rule.itemCodes }, stylesToAdd: {} });
  });

  it('gives an icon the default size when the example names none', () => {
    const { rule } = buildExampleRule(example('low-runes'), { ...NO_CHOICES, icon: 'rune' });
    expect(rule.icon).toEqual({ iconName: 'rune', iconSize: DEFAULT_EXAMPLE_ICON_SIZE });
  });

  it('ignores the choices of a hide rule', () => {
    const hide = example('hide-inferior');
    expect(defaultChoices(hide)).toEqual(NO_CHOICES);
    expect(buildExampleRule(hide, { style: 'muted', sound: 'tink.mp3', icon: 'rune', chatMessage: 'x' })).toEqual({
      rule: {
        comment: hide.title,
        itemTypes: ['weap', 'armo'],
        quality: 'inferior',
        playerStats: [{ stat: 'level', op: '>=', value: 10 }],
        excludeAreas: [1, 40, 75, 103, 109],
        hide: true,
      },
      stylesToAdd: {},
    });
  });

  it('offers its own chat line and the plain item name', () => {
    expect(chatOptions(high).map((option) => option.value)).toEqual(['ÿc1High rune: ÿc0{name}', PLAIN_CHAT_MESSAGE]);
    expect(chatOptions(example('low-runes')).map((option) => option.value)).toEqual([PLAIN_CHAT_MESSAGE]);
  });
});

describe('the examples in the Test tab evaluator', () => {
  const statIds = new Map(lootfilter.stats.map((stat) => [stat.name, stat.id]));
  const id = (name: string) => statIds.get(name) ?? -1;
  const context: TestContext = { playerStats: [{ stat: id('level'), value: 50 }], difficulty: 2, area: 2, filterLevel: 1, statIds };
  const item = (overrides: Partial<TestItem>): TestItem => ({
    code: 'axe',
    typeAncestors: ['axe', 'weap'],
    quality: 4,
    baseTier: 0,
    itemLevel: 50,
    sockets: 0,
    maxSockets: 4,
    isFullySocketed: false,
    isEthereal: false,
    isIdentified: true,
    isRuneword: false,
    uniqueOrSetId: null,
    stats: [],
    name: 'Axe',
    location: 'onGround',
    ...overrides,
  });
  const run = (rule: LootFilterRule, overrides: Partial<TestItem>, ctx: TestContext = context) =>
    evaluateFilter(filterOf([rule]), item(overrides), ctx);

  it('hides a magic weapon without the stats and keeps one with any of them, or a class weapon', () => {
    const rule = defaultRule('hide-weapons-except');
    expect(run(rule, {}).hidden).toBe(true);
    expect(run(rule, { stats: [{ stat: id('item_fastercastrate'), value: 10 }] }).hidden).toBe(false);
    expect(run(rule, { quality: 7 }).hidden).toBe(false);
    expect(run(rule, { code: 'ob1', typeAncestors: ['orb', 'weap', 'sorc', 'clas'] }).hidden).toBe(false);
  });

  it('keeps weapons and armour with +class skills or +a skill tab, whatever the class or tab', () => {
    const berserkers = [{ stat: id('item_addclassskills'), param: 4, value: 2 }];
    const martialArts = [{ stat: id('item_addskill_tab'), param: 50, value: 1 }];
    const weapons = defaultRule('hide-weapons-except');
    expect(run(weapons, { stats: berserkers }).hidden).toBe(false);
    expect(run(weapons, { stats: martialArts }).hidden).toBe(false);
    expect(run(weapons, { quality: 6, stats: [{ stat: id('item_addskill_tab'), param: 8, value: 3 }] }).hidden).toBe(false);
    const armour = defaultRule('hide-magic-armour-except');
    const tors = { code: 'qui', typeAncestors: ['tors', 'armo'] };
    expect(run(armour, tors).hidden).toBe(true);
    expect(run(armour, { ...tors, stats: [{ stat: id('item_addclassskills'), param: 1, value: 1 }] }).hidden).toBe(false);
    const circlet = { code: 'ci0', typeAncestors: ['circ', 'helm', 'armo', 'merc'] };
    expect(run(armour, { ...circlet, stats: martialArts }).hidden).toBe(false);
  });

  /** Each hide rule's character level gate, mirroring Sully's filter (undefined: no gate, as Sully's utility potion hide). */
  const LEVEL_GATES: Readonly<Record<string, number | undefined>> = {
    'hide-low-gems': 20,
    'hide-tiny-gold': 20,
    'hide-small-gold': 60,
    'hide-minor-potions': 12,
    'hide-light-potions': 20,
    'hide-normal-potions': 40,
    'hide-utility-potions': undefined,
    'hide-inferior': 10,
    'hide-weapons-except': 20,
    'hide-magic-armour-except': 20,
    'hide-plain-gear': 10,
    'hide-ammo-and-throwing-potions': 10,
  };
  const misc = (code: string, type: string, stats: TestItem['stats'] = []): Partial<TestItem> => ({
    code,
    typeAncestors: [type, 'misc'],
    baseTier: null,
    quality: 2,
    stats,
  });
  /** An item each hide rule hides once its level gate is reached. */
  const HIDDEN_ITEM: Readonly<Record<string, Partial<TestItem>>> = {
    'hide-low-gems': misc('gcv', 'gem0'),
    'hide-tiny-gold': misc('gld', 'gold', [{ stat: id('gold'), value: 50 }]),
    'hide-small-gold': misc('gld', 'gold', [{ stat: id('gold'), value: 300 }]),
    'hide-minor-potions': misc('hp1', 'hpot'),
    'hide-light-potions': misc('mp2', 'mpot'),
    'hide-normal-potions': misc('hp3', 'hpot'),
    'hide-utility-potions': misc('wms', 'wpot'),
    'hide-inferior': { quality: 1 },
    'hide-weapons-except': {},
    'hide-magic-armour-except': { code: 'qui', typeAncestors: ['tors', 'armo'] },
    'hide-plain-gear': { code: 'sst', typeAncestors: ['staf', 'blun', 'mele', 'weap'], quality: 2 },
    'hide-ammo-and-throwing-potions': { code: 'aq2', typeAncestors: ['arrm', 'bowq', 'seco', 'misl', 'misc'], baseTier: null, quality: 2 },
  };
  const atLevel = (value: number): TestContext => ({ ...context, playerStats: [{ stat: id('level'), value }] });

  it('gates every hide rule at the character level of Sully’s matching hide and leaves the towns out', () => {
    const hides = EXAMPLE_RULES.filter(isHideExample);
    expect(hides.map((entry) => entry.id).sort()).toEqual(Object.keys(LEVEL_GATES).sort());
    for (const entry of hides) {
      const gate = LEVEL_GATES[entry.id];
      expect(entry.rule.playerStats, entry.id).toEqual(gate === undefined ? undefined : [{ stat: 'level', op: '>=', value: gate }]);
      expect(entry.rule.excludeAreas, entry.id).toEqual([1, 40, 75, 103, 109]);
    }
  });

  it.each(Object.entries(LEVEL_GATES))('%s hides from its level on, not a level before and never in town', (exampleId, gate) => {
    const rule = defaultRule(exampleId);
    const sample = HIDDEN_ITEM[exampleId] ?? {};
    expect(run(rule, sample, atLevel(gate ?? 1)).hidden).toBe(true);
    if (gate !== undefined) expect(run(rule, sample, atLevel(gate - 1)).hidden).toBe(false);
    expect(run(rule, sample, { ...atLevel(99), area: 40 }).hidden).toBe(false);
  });

  it('never hides quest weapons or mythical bases in the broad gear hides', () => {
    const shaft = { code: 'msf', typeAncestors: ['staf', 'rod', 'blun', 'mele', 'weap'], quality: 2, sockets: 0 };
    const lowLevel = { ...context, playerStats: [{ stat: id('level'), value: 20 }] };
    const plain = defaultRule('hide-plain-gear');
    expect(run(plain, { ...shaft, code: 'sst' }, lowLevel).hidden).toBe(true);
    expect(run(plain, shaft, lowLevel).hidden).toBe(false);
    for (const code of ['qf1', 'qf2', 'hst', 'leg', 'g33', 'hdm', 'hfh', 'd33'])
      expect(run(plain, { ...shaft, code }, lowLevel).hidden, code).toBe(false);
    expect(run(plain, { ...shaft, code: 'm21', typeAncestors: ['axe', 'mele', 'weap'] }, lowLevel).hidden).toBe(false);
    expect(run(plain, { code: 'opm', typeAncestors: ['tpot', 'thro', 'weap'], quality: 2 }, lowLevel).hidden).toBe(false);
    for (const exampleId of ['hide-weapons-except', 'hide-magic-armour-except']) {
      expect(run(defaultRule(exampleId), { code: 'm21', typeAncestors: ['axe', 'mele', 'weap'] }).hidden, exampleId).toBe(false);
      expect(run(defaultRule(exampleId), { code: 'm06', typeAncestors: ['tors', 'armo'] }).hidden, exampleId).toBe(false);
    }
  });

  it('gives mythical uniques only the mythical rule, not the unique weapon or jewellery rule as well', () => {
    const mythicalBow = { code: 'm01', typeAncestors: ['bow', 'miss', 'weap'], quality: 7 };
    expect(run(defaultRule('unique-items'), mythicalBow).matched).toBe(false);
    expect(run(defaultRule('unique-items'), { ...mythicalBow, code: 'hax' }).matched).toBe(true);
    expect(run(defaultRule('mythical-uniques'), mythicalBow).matched).toBe(true);
    const ring = { typeAncestors: ['ring', 'misc'], baseTier: null, quality: 7 };
    expect(run(defaultRule('unique-jewellery'), { ...ring, code: 'mrn' }).matched).toBe(false);
    expect(run(defaultRule('unique-jewellery'), { ...ring, code: 'rin' }).matched).toBe(true);
    expect(run(defaultRule('mythical-uniques'), { ...ring, code: 'mrn' }).matched).toBe(true);
  });

  it('hides plain quivers and throwing potions from character level 10 and keeps magic quivers', () => {
    const rule = defaultRule('hide-ammo-and-throwing-potions');
    const arrows = { code: 'aq2', typeAncestors: ['arrm', 'bowq', 'seco', 'misl', 'misc'], baseTier: null, quality: 2 };
    expect(run(rule, arrows).hidden).toBe(true);
    expect(run(rule, { ...arrows, quality: 4 }).hidden).toBe(false);
    expect(run(rule, arrows, { ...context, playerStats: [{ stat: id('level'), value: 5 }] }).hidden).toBe(false);
    expect(run(rule, { code: 'opl', typeAncestors: ['tpot', 'thro', 'weap'], quality: 2 }).hidden).toBe(true);
  });

  it('needs both stats in the all-of example and one in the any-of example', () => {
    const ring = { code: 'rin', typeAncestors: ['ring', 'misc'], baseTier: null };
    const fcr = { stat: id('item_fastercastrate'), value: 10 };
    const mf = { stat: id('item_magicbonus'), value: 10 };
    expect(run(defaultRule('jewellery-all-of'), { ...ring, stats: [fcr] }).matched).toBe(false);
    expect(run(defaultRule('jewellery-all-of'), { ...ring, stats: [fcr, mf] }).matched).toBe(true);
    const charm = { code: 'cm1', typeAncestors: ['scha', 'char', 'misc'], baseTier: null };
    expect(run(defaultRule('charms-any-of'), { ...charm, stats: [mf] }).matched).toBe(true);
    expect(run(defaultRule('charms-any-of'), { ...charm, stats: [] }).matched).toBe(false);
  });

  it('hides small gold by steps and keeps the piles at or over each step', () => {
    const gold = (value: number) => misc('gld', 'gold', [{ stat: id('gold'), value }]);
    expect(run(defaultRule('hide-tiny-gold'), gold(99), atLevel(20)).hidden).toBe(true);
    expect(run(defaultRule('hide-tiny-gold'), gold(100), atLevel(99)).hidden).toBe(false);
    expect(run(defaultRule('hide-small-gold'), gold(499), atLevel(60)).hidden).toBe(true);
    expect(run(defaultRule('hide-small-gold'), gold(500), atLevel(99)).hidden).toBe(false);
  });

  it('puts $$ marks around Ore and Fake Notes, whatever the style choice', () => {
    for (const [code, type] of [
      ['ore', 'rock'],
      ['fkn', 'cube'],
    ] as const) {
      const result = run(buildExampleRule(example('ore-and-fake-notes'), NO_CHOICES).rule, misc(code, type));
      expect([result.matched, result.namePrefix, result.nameSuffix], code).toEqual([true, 'ÿc2$$ ', ' ÿc2$$']);
    }
  });

  it('gives a +3 class item the label and leaves +2 alone', () => {
    const rule = defaultRule('plus-three-class-items');
    const orb = { code: 'ob1', typeAncestors: ['orb', 'weap', 'sorc', 'clas'] };
    const fireTab = (value: number) => [{ stat: id('item_addskill_tab'), param: 8, value }];
    expect(run(rule, { ...orb, stats: fireTab(3) }).matched).toBe(true);
    expect(run(rule, { ...orb, stats: fireTab(2) }).matched).toBe(false);
  });
});

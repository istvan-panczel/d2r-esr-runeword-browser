import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { evaluateFilter, type EvaluationResult, type TestContext, type TestItem } from '../engine/evaluate';
import { parseLootFilter } from '../engine/parse';
import { buildLootFilterReference } from '../engine/reference';
import { serializeLootFilter } from '../engine/serialize';
import { statScale } from '../engine/statScale';
import { statQuirk } from '../engine/statQuirks';
import type { LootFilter, LootFilterRule } from '../engine/types';
import { validateLootFilter } from '../engine/validate';
import { findBundledIconAsset, findBundledSound } from './bundledAssets';
import { buildExampleSet, defaultChoices, findExample } from './exampleRules';
import { collectReferencedAssets } from './referencedAssets';
import { STYLE_PRESETS, styleWithoutIcon } from './stylePresets';
import { EXAMPLE_TEMPLATE } from './template';

/** The bundled example filter for new users (`public/loot-filters/example-filter.json`). */
const text = readFileSync(resolve(process.cwd(), 'public/loot-filters/example-filter.json'), 'utf8');
const json = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data', file), 'utf8')) as unknown;
const lootfilter = json('lootfilter.json') as LootFilterDataBundle;
const reference = buildLootFilterReference(lootfilter, json('types.json') as TypesBundle);

const parsed = parseLootFilter(text);
const filter = parsed.filter;

const LEVELING = 1;
const STRICT = 2;

/**
 * The file's rules in order: the example each one is (`buildExampleSet` with its default choices) and what the file
 * adds to it besides its comment. A changed example fails here until the file follows (and its version is bumped).
 */
const FROM_EXAMPLES: readonly (readonly [id: string, extra?: Partial<LootFilterRule>])[] = [
  ['high-runes'],
  ['elemental-runes'],
  ['upper-runes'],
  ['mid-runes'],
  ['perfect-gems'],
  ['unique-items', { notify: true }],
  ['unique-jewellery'],
  ['unique-by-id'],
  ['set-items'],
  ['mythical-uniques'],
  ['elite-coupons'],
  ['socket-count-tag'],
  ['elite-armour-bases'],
  ['ethereal-merc-bases'],
  ['all-skills-bases'],
  ['charms-any-of'],
  ['all-resist-charms'],
  ['rare-jewels'],
  ['pandemonium-keys'],
  ['tier-5-maps'],
  ['large-gold'],
  ['hide-inferior'],
  ['hide-plain-gear'],
  ['hide-minor-potions'],
  ['hide-low-gems', { activeInLevels: [STRICT] }],
  ['hide-small-gold', { activeInLevels: [STRICT] }],
  ['hide-weapons-except', { activeInLevels: [STRICT] }],
  ['hide-magic-armour-except', { activeInLevels: [STRICT] }],
];

/** The examples built as one set, as the picker adds them (`buildExampleSet`: the styles and the NoIcon copy they need). */
const fromExamples = buildExampleSet(
  FROM_EXAMPLES.map(([id]) => {
    const example = findExample(id);
    if (example === undefined) throw new Error(`no example ${id}`);
    return { example, choices: defaultChoices(example) };
  })
);

const items = new Map(lootfilter.items.map((item) => [item.code, item]));
const statIds = new Map(lootfilter.stats.map((stat) => [stat.name, stat.id]));
const statId = (name: string): number => {
  const id = statIds.get(name);
  if (id === undefined) throw new Error(`no stat ${name}`);
  return id;
};

const QUALITY = { inferior: 1, normal: 2, superior: 3, magic: 4, set: 5, rare: 6, unique: 7 } as const;
const TIERS = { normal: 0, exceptional: 1, elite: 2 } as const;

/** A ground item of `code` as the Test tab builds it from the game data (type ancestors, base tier, name). */
function item(code: string, overrides: Partial<TestItem> = {}): TestItem {
  const row = items.get(code);
  if (row === undefined) throw new Error(`no item ${code}`);
  return {
    code,
    typeAncestors: [...(reference.itemCodeTypes.get(code) ?? [])],
    quality: QUALITY.normal,
    baseTier: row.tier === undefined ? null : TIERS[row.tier],
    itemLevel: 85,
    sockets: 0,
    maxSockets: 4,
    isFullySocketed: false,
    isEthereal: false,
    isIdentified: true,
    isRuneword: false,
    uniqueOrSetId: null,
    stats: [],
    name: row.name,
    location: 'onGround',
    ...overrides,
  };
}

interface Where {
  readonly level?: number;
  /** levels.txt Id; Blood Moor (2) unless set */
  readonly area?: number;
  readonly characterLevel?: number;
}

function run(testItem: TestItem, { level = LEVELING, area = 2, characterLevel = 60 }: Where = {}): EvaluationResult {
  const context: TestContext = {
    playerStats: [{ stat: statId('level'), value: characterLevel }],
    difficulty: 2,
    area,
    filterLevel: level,
    statIds,
  };
  return evaluateFilter(filter, testItem, context);
}

const stat = (name: string, value: number) => ({ stat: statId(name), value });
/** The comment of the rule that hid the item, to make a failing expectation readable. */
const hiddenBy = (result: EvaluationResult): string | undefined =>
  result.hiddenBy === null ? undefined : filter.rules[result.hiddenBy]?.comment;

describe('example filter', () => {
  it('parses without a problem and without comments that the first edit would drop', () => {
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.notes).toEqual([]);
  });

  it('validates without a problem against the game data', () => {
    expect(validateLootFilter(filter, reference)).toEqual([]);
  });

  it('has the header new users see in the library, at the bundled version', () => {
    expect(filter).toMatchObject({
      formatVersion: 1,
      title: 'Example filter (with explanations)',
      author: 'D2R ESR Runeword Browser',
      version: EXAMPLE_TEMPLATE.version,
      filterLevels: [
        { id: LEVELING, name: 'Leveling' },
        { id: STRICT, name: 'Strict' },
      ],
      defaultLevel: LEVELING,
      notifications: { dropFormat: 'ÿc4Drop: {qualityColor}{name}' },
    });
    expect(EXAMPLE_TEMPLATE.version).toBe('2.1.0');
    expect(filter.description).toBeTruthy();
    expect(filter.updateUrl).toBeUndefined();
    expect(filter.leadingComments.length).toBeGreaterThan(0);
  });

  it('is the example rules with their default presentation, in order, plus the levels and the drop line', () => {
    expect(filter.rules).toHaveLength(FROM_EXAMPLES.length);
    filter.rules.forEach((rule, index) => {
      const [id, extra = {}] = FROM_EXAMPLES[index] ?? [''];
      const example = findExample(id);
      if (example === undefined) throw new Error(`no example ${id}`);
      expect(rule, id).toEqual({ ...fromExamples.rules[index], ...extra, comment: rule.comment });
      // The comment is the rule list's title line: the example's title first, then what the rule teaches.
      expect(rule.comment?.startsWith(`${example.title}. `), id).toBe(true);
      expect(rule.comment?.length ?? 0, id).toBeGreaterThan(example.title.length + 30);
    });
    expect(filter.rules.length).toBeGreaterThanOrEqual(20);
    expect(filter.rules.length).toBeLessThanOrEqual(30);
  });

  it('defines exactly the style presets its rules use, as the presets are, icons included, plus the one NoIcon copy', () => {
    const used = new Set(filter.rules.flatMap((rule) => (rule.useStyle === undefined ? [] : [rule.useStyle])));
    expect(new Set(Object.keys(filter.styles ?? {}))).toEqual(used);
    expect(filter.styles).toEqual(fromExamples.styles);
    for (const [name, style] of Object.entries(filter.styles ?? {})) {
      if (name === 'MidRuneNoIcon') continue;
      expect(style, name).toEqual(STYLE_PRESETS.find((preset) => preset.name === name)?.style);
      expect(style.icon, name).toBeDefined();
    }
    // Hel to Um keep no icon (as in v2.0.0): a rule cannot remove its style's icon, so they use a copy without it.
    expect(filter.styles?.MidRuneNoIcon).toEqual(styleWithoutIcon(STYLE_PRESETS.find((preset) => preset.id === 'mid-rune')?.style ?? {}));
    // A rule carries its own icon only where it differs from its style's.
    expect(filter.rules.filter((rule) => rule.icon !== undefined).map((rule) => rule.comment?.split('.')[0])).toEqual([
      'Unique rings and amulets',
      'Tier 5 maps and The Hidden Vault',
      'Gold piles of 100,000 or more',
    ]);
  });

  it('has rules for every level and rules for Strict only, label rules first and hide rules last', () => {
    const strictOnly = filter.rules.filter((rule) => rule.activeInLevels?.length === 1 && rule.activeInLevels[0] === STRICT);
    expect(strictOnly.length).toBeGreaterThan(0);
    expect(filter.rules.some((rule) => rule.hide === true && rule.activeInLevels === undefined)).toBe(true);
    const firstHide = filter.rules.findIndex((rule) => rule.hide === true);
    expect(filter.rules.slice(firstHide).every((rule) => rule.hide === true)).toBe(true);
  });

  it('uses only the bundled sounds and the generated icons, and only stats the plugin reads as shown', () => {
    const actions = [...Object.values(filter.styles ?? {}), ...filter.rules];
    for (const entry of actions) {
      if (entry.sound !== undefined) expect(findBundledSound(entry.sound)).toBeDefined();
      if (entry.icon !== undefined) expect(findBundledIconAsset(entry.icon.iconName)?.credit).toBe('Generated for this app');
    }
    const checks = filter.rules.flatMap((rule) => [
      ...(rule.itemStats ?? []),
      ...(rule.itemStatsAnyOf ?? []),
      ...(rule.playerStats ?? []),
      ...(rule.playerStatsAnyOf ?? []),
    ]);
    for (const check of checks) {
      expect(statQuirk(check.stat)).toBeUndefined();
      expect(statScale(check.stat)).toBeUndefined();
    }
  });

  it('puts every sound and icon it uses into the .zip download', () => {
    const { bundled, missing } = collectReferencedAssets(filter);
    expect(missing).toEqual([]);
    expect(bundled.map((file) => file.path)).toEqual(
      expect.arrayContaining(['sounds/tink.mp3', 'icons/diamond_red.sprite', 'icons/star_gold.sprite', 'icons/key_purple.sprite'])
    );
    expect(bundled.some((file) => file.path.endsWith('.lowend.sprite'))).toBe(false);
  });

  describe('behaves as its comments say (Test tab evaluator)', () => {
    it('gives a high rune the HighRune look and beam, the tink, a red diamond and a chat line at both levels', () => {
      const result = run(item('r80'));
      expect(result.hidden).toBe(false);
      expect(result.name).toBe('ÿc1Ber Rune');
      expect(result.sounds).toEqual([{ sound: 'tink.mp3', volume: 50 }]);
      expect(result.droplight).toEqual({ color: [255, 40, 0] });
      expect(result.icon).toEqual({ iconName: 'diamond_red', iconSize: 50 });
      expect(result.labelBorder).toEqual({ color: [240, 0, 0, 255], width: 2 });
      expect(result.chatMessages).toEqual(['ÿc1High rune: ÿc0Ber Rune']);
      expect(run(item('r80'), { level: STRICT })).toMatchObject({ hidden: false, droplight: { color: [255, 40, 0] } });
      expect(run(item('r90')).icon).toEqual({ iconName: 'diamond_red', iconSize: 50 });
    });

    it('gives Ist the mid sound and an orange diamond, and Hel only the MidRune look', () => {
      const ist = run(item('r74'));
      expect(ist.sounds).toEqual([{ sound: 'mid.mp3', volume: 50 }]);
      expect(ist.icon).toEqual({ iconName: 'diamond_orange', iconSize: 40 });
      expect(ist.droplight).toBeNull();
      const hel = run(item('r65'));
      expect(hel).toMatchObject({ sounds: [], icon: null, chatMessages: [], labelBorder: { color: [255, 168, 0, 255], width: 1 } });
    });

    it('notifies a unique with the drop line, and adds The Oculus’s own chat line and sound after it', () => {
      const shako = run(item('uap', { quality: QUALITY.unique, uniqueOrSetId: 1 }));
      expect(shako).toMatchObject({ hidden: false, notified: true, icon: { iconName: 'star_gold', iconSize: 30 } });
      // The drop line from notifications.dropFormat; {qualityColor} is the unique label colour.
      expect(shako.chatMessages).toEqual(['ÿc4Drop: ÿcDShako']);
      expect(shako.sounds).toEqual([{ sound: 'unique.mp3', volume: 50 }]);
      const oculus = run(item('oba', { quality: QUALITY.unique, uniqueOrSetId: 418, name: 'The Oculus' }));
      expect(oculus.chatMessages).toEqual(['ÿc4Drop: ÿcDThe Oculus', 'ÿc4The Oculus dropped']);
      expect(oculus.sounds).toHaveLength(2);
      expect(run(item('rin', { quality: QUALITY.unique })).icon).toEqual({ iconName: 'crown_gold', iconSize: 40 });
    });

    it('gives a mythical unique only the mythical treatment, and set items the green star', () => {
      const mythical = run(item('m01', { quality: QUALITY.unique }), { level: STRICT });
      expect(mythical).toMatchObject({ hidden: false, notified: false, icon: { iconName: 'star_purple', iconSize: 50 } });
      expect(mythical.sounds).toEqual([{ sound: 'mythical.mp3', volume: 50 }]);
      expect(run(item('lgl', { quality: QUALITY.set, uniqueOrSetId: 51 })).icon).toEqual({ iconName: 'star_green', iconSize: 30 });
    });

    it('tags white bases with their sockets, and a later name tag wins on a +All Skills base', () => {
      expect(run(item('crs', { sockets: 4 }), { level: STRICT })).toMatchObject({ hidden: false, name: 'Crystal Sword ÿc5[4]' });
      const armour = run(item('utp', { sockets: 3 }));
      expect(armour.labelBorder).toEqual({ color: [255, 255, 255, 255], width: 1 });
      const merc = run(item('7s8', { sockets: 5, isEthereal: true }));
      expect(merc.icon).toEqual({ iconName: 'shield_white', iconSize: 30 });
      expect(merc.chatMessages).toEqual(['ÿc5Ethereal base: ÿc0Thresher (5 sockets)']);
      const skills = run(item('crs', { quality: QUALITY.superior, sockets: 2, stats: [stat('item_allskills', 2)] }));
      expect(skills.name).toBe('ÿc1Crystal Sword ÿc1[+2 skills]');
      expect(skills.icon).toEqual({ iconName: 'cross_red', iconSize: 40 });
    });

    it('needs one stat for the any-of charm rule and every stat for the all-of one', () => {
      const style = (result: EvaluationResult) => result.labelBorder;
      const goodCharm = { color: [0, 200, 80, 255], width: 1 };
      expect(style(run(item('cm1', { quality: QUALITY.magic, stats: [stat('item_magicbonus', 5)] })))).toEqual(goodCharm);
      expect(style(run(item('cm1', { quality: QUALITY.magic, stats: [stat('fireresist', 5)] })))).toBeNull();
      const allRes = ['fireresist', 'lightresist', 'coldresist', 'poisonresist'].map((name) => stat(name, 5));
      expect(style(run(item('cm1', { quality: QUALITY.magic, stats: allRes })))).toEqual(goodCharm);
    });

    it('marks rare jewels, keys, tier 5 maps and large gold piles on the minimap', () => {
      expect(run(item('jew', { quality: QUALITY.rare })).icon).toEqual({ iconName: 'hexagon_yellow', iconSize: 27 });
      expect(run(item('pk1')).icon).toEqual({ iconName: 'key_purple', iconSize: 35 });
      expect(run(item('z17')).icon).toEqual({ iconName: 'map_white', iconSize: 40 });
      const gold = run(item('gld', { stats: [stat('gold', 150000)] }));
      expect(gold.icon).toEqual({ iconName: 'coin_gold', iconSize: 30 });
      expect(gold.name).toBe('ÿc2$$ Gold ÿc2$$');
    });

    it('hides inferior gear, white gear with at most one socket and minor potions at both levels, from their character level', () => {
      for (const level of [LEVELING, STRICT]) {
        expect(run(item('crs', { quality: QUALITY.inferior }), { level }).hidden).toBe(true);
        expect(run(item('crs', { sockets: 1 }), { level }).hidden).toBe(true);
        expect(run(item('hp1'), { level }).hidden).toBe(true);
      }
      expect(run(item('crs', { quality: QUALITY.inferior }), { characterLevel: 9 }).hidden).toBe(false);
      expect(run(item('hp1'), { characterLevel: 11 }).hidden).toBe(false);
      expect(run(item('crs', { sockets: 1 }), { area: 1 }).hidden).toBe(false);
      expect(run(item('crs', { quality: QUALITY.superior, sockets: 1 })).hidden).toBe(false);
      expect(run(item('hst')).hidden).toBe(false);
      expect(hiddenBy(run(item('crs')))).toContain('Hide white gear with 0 or 1 socket');
    });

    it('hides chipped gems and small gold piles only at Strict', () => {
      for (const testItem of [item('gcv'), item('gld', { stats: [stat('gold', 499)] })]) {
        expect(run(testItem, { level: LEVELING }).hidden).toBe(false);
        expect(run(testItem, { level: STRICT }).hidden).toBe(true);
      }
      expect(run(item('gld', { stats: [stat('gold', 500)] }), { level: STRICT }).hidden).toBe(false);
      expect(run(item('gvb'), { level: STRICT }).hidden).toBe(false);
    });

    it('at Strict hides a magic sword or magic armour unless it has an exception stat, and keeps magic rings', () => {
      const where = { level: STRICT };
      expect(run(item('crs', { quality: QUALITY.magic }), where).hidden).toBe(true);
      expect(run(item('crs', { quality: QUALITY.rare }), where).hidden).toBe(true);
      expect(run(item('crs', { quality: QUALITY.magic, stats: [stat('item_fastercastrate', 10)] }), where).hidden).toBe(false);
      expect(run(item('crs', { quality: QUALITY.magic, stats: [stat('item_allskills', 1)] }), where).hidden).toBe(false);
      expect(run(item('xtp', { quality: QUALITY.magic }), where).hidden).toBe(true);
      expect(run(item('xtp', { quality: QUALITY.magic, stats: [stat('item_magicbonus', 10)] }), where).hidden).toBe(false);
      expect(run(item('rin', { quality: QUALITY.magic }), where).hidden).toBe(false);
      expect(run(item('crs', { quality: QUALITY.magic }), { level: LEVELING }).hidden).toBe(false);
    });
  });

  describe('after an edit in the editor', () => {
    // An edit re-serializes the model: the rule comments and the leading // lines are part of it.
    const edited: LootFilter = {
      ...filter,
      title: 'My example filter',
      rules: [...filter.rules, { comment: 'My own rule: hide keys', itemCodes: ['key'], hide: true } satisfies LootFilterRule],
    };
    const reread = parseLootFilter(serializeLootFilter(edited));

    it('keeps every rule comment and the leading comment block', () => {
      expect(reread.diagnostics).toEqual([]);
      expect(reread.filter.rules.map((rule) => rule.comment)).toEqual(edited.rules.map((rule) => rule.comment));
      expect(reread.filter.leadingComments).toEqual(filter.leadingComments);
    });

    it('keeps the rules and styles as they were', () => {
      expect(reread.filter.rules).toEqual(edited.rules);
      expect(reread.filter.styles).toEqual(filter.styles);
      expect(validateLootFilter(reread.filter, reference)).toEqual([]);
    });
  });
});

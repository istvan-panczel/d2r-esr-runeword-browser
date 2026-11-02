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
import { findBundledIcon, findBundledSound } from './bundledAssets';

/** The bundled example filter for new users (`public/loot-filters/example-filter.json`). */
const text = readFileSync(resolve(process.cwd(), 'public/loot-filters/example-filter.json'), 'utf8');
const json = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data', file), 'utf8')) as unknown;
const lootfilter = json('lootfilter.json') as LootFilterDataBundle;
const reference = buildLootFilterReference(lootfilter, json('types.json') as TypesBundle);

const parsed = parseLootFilter(text);
const filter = parsed.filter;

const LEVELING = 1;
const STRICT = 2;

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

  it('has the header new users see in the library', () => {
    expect(filter).toMatchObject({
      formatVersion: 1,
      title: 'Example filter (with explanations)',
      author: 'D2R ESR Runeword Browser',
      version: '1.0.0',
      filterLevels: [
        { id: LEVELING, name: 'Leveling' },
        { id: STRICT, name: 'Strict' },
      ],
      defaultLevel: LEVELING,
    });
    expect(filter.description).toBeTruthy();
    expect(filter.updateUrl).toBeUndefined();
    expect(filter.leadingComments.length).toBeGreaterThan(0);
    expect(Object.keys(filter.styles ?? {})).toEqual(['Valuable', 'Good']);
  });

  it('explains every rule in its comment and keeps to a readable size', () => {
    for (const rule of filter.rules) expect(rule.comment?.trim()).toBeTruthy();
    expect(filter.rules.length).toBeGreaterThanOrEqual(20);
    expect(filter.rules.length).toBeLessThanOrEqual(30);
  });

  it('has rules for every level and rules for Strict only', () => {
    const strictOnly = filter.rules.filter((rule) => rule.activeInLevels?.length === 1 && rule.activeInLevels[0] === STRICT);
    expect(strictOnly.length).toBeGreaterThan(0);
    expect(filter.rules.some((rule) => rule.hide === true && rule.activeInLevels === undefined)).toBe(true);
  });

  it('uses only the bundled sounds and icons, and only stats the plugin reads as shown', () => {
    const actions = [...Object.values(filter.styles ?? {}), ...filter.rules];
    for (const entry of actions) {
      if (entry.sound !== undefined) expect(findBundledSound(entry.sound)).toBeDefined();
      if (entry.icon !== undefined) expect(findBundledIcon(entry.icon.iconName)).toBeDefined();
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

  describe('behaves as its comments say (Test tab evaluator)', () => {
    it('gives a high rune the sound, droplight, rune icon and chat line', () => {
      const result = run(item('r80'));
      expect(result.hidden).toBe(false);
      expect(result.sounds).toEqual([{ sound: 'tink.mp3', volume: 50 }]);
      expect(result.droplight).toEqual({ color: [255, 128, 0] });
      expect(result.icon).toEqual({ iconName: 'rune', iconSize: 50 });
      expect(result.labelBorder).toEqual({ color: [255, 0, 0, 255], width: 2 });
      expect(result.chatMessages).toEqual(['ÿc8High rune: ÿc0Ber Rune']);
      expect(run(item('r80'), { level: STRICT })).toMatchObject({ hidden: false, droplight: { color: [255, 128, 0] } });
    });

    it('gives a mid rune the Good style and a small icon, without a droplight', () => {
      const result = run(item('r74'));
      expect(result.sounds).toEqual([{ sound: 'mid.mp3', volume: 50 }]);
      expect(result.icon).toEqual({ iconName: 'rune', iconSize: 30 });
      expect(result.droplight).toBeNull();
    });

    it('shows a white 4-socket base with its socket count and hides a white 2-socket one at Strict', () => {
      const base = run(item('crs', { sockets: 4 }), { level: STRICT });
      expect(base.hidden).toBe(false);
      expect(base.name).toBe('Crystal Sword [4 sockets]');
      expect(base.labelBorder).toEqual({ color: [240, 240, 240, 255], width: 1 });
      expect(run(item('crs', { sockets: 2 }), { level: STRICT }).hidden).toBe(true);
      expect(run(item('crs', { sockets: 2 }), { level: LEVELING }).hidden).toBe(false);
    });

    it('hides white items without sockets once the character is level 12, except ethereal, superior, quest items and in town', () => {
      expect(run(item('crs'), { characterLevel: 11 }).hidden).toBe(false);
      const plain = run(item('crs'), { characterLevel: 12 });
      expect(plain.hidden).toBe(true);
      expect(hiddenBy(plain)).toContain('White weapons and armour without sockets');
      expect(run(item('crs', { isEthereal: true }), { characterLevel: 30 }).hidden).toBe(false);
      expect(run(item('crs', { quality: QUALITY.superior }), { characterLevel: 30 }).hidden).toBe(false);
      expect(run(item('hst'), { characterLevel: 30 }).hidden).toBe(false);
      expect(run(item('hst'), { characterLevel: 30, level: STRICT }).hidden).toBe(false);
      expect(run(item('crs'), { characterLevel: 30, area: 1 }).hidden).toBe(false);
      expect(run(item('crs'), { characterLevel: 30, area: 1, level: STRICT }).hidden).toBe(false);
    });

    it('hides inferior gear, plain arrows and stamina potions at every level', () => {
      for (const level of [LEVELING, STRICT]) {
        expect(run(item('crs', { quality: QUALITY.inferior, sockets: 4 }), { level }).hidden).toBe(true);
        expect(run(item('aq2'), { level }).hidden).toBe(true);
        expect(run(item('vps'), { level }).hidden).toBe(true);
      }
      expect(run(item('aq2', { quality: QUALITY.magic }), { level: STRICT }).hidden).toBe(false);
    });

    it('hides minor potions, chipped gems, scrolls and small gold piles only at Strict', () => {
      for (const code of ['hp1', 'mp2', 'gcv', 'skc', 'tsc', 'isc']) {
        expect(run(item(code), { level: LEVELING }).hidden).toBe(false);
        expect(run(item(code), { level: STRICT }).hidden).toBe(true);
      }
      expect(run(item('hp3'), { level: STRICT }).hidden).toBe(false);
      expect(run(item('gfv'), { level: STRICT }).hidden).toBe(false);
      expect(run(item('gld', { stats: [stat('gold', 499)] }), { level: LEVELING }).hidden).toBe(false);
      expect(run(item('gld', { stats: [stat('gold', 499)] }), { level: STRICT }).hidden).toBe(true);
      expect(run(item('gld', { stats: [stat('gold', 500)] }), { level: STRICT }).hidden).toBe(false);
    });

    it('at Strict shows a magic ring and a magic circlet but hides a magic sword unless it has an exception stat', () => {
      const where = { level: STRICT };
      expect(run(item('rin', { quality: QUALITY.magic }), where).hidden).toBe(false);
      expect(run(item('ci0', { quality: QUALITY.magic }), where).hidden).toBe(false);
      expect(run(item('crs', { quality: QUALITY.magic }), where).hidden).toBe(true);
      expect(run(item('crs', { quality: QUALITY.magic, stats: [stat('item_fastercastrate', 10)] }), where).hidden).toBe(true);
      expect(run(item('crs', { quality: QUALITY.magic, stats: [stat('item_fastercastrate', 20)] }), where).hidden).toBe(false);
      const skills = run(item('crs', { quality: QUALITY.magic, stats: [stat('item_allskills', 2)] }), where);
      expect(skills.hidden).toBe(false);
      expect(skills.name).toBe('Crystal Sword ÿc1[+2 skills]');
      expect(run(item('crs', { quality: QUALITY.magic }), { level: LEVELING }).hidden).toBe(false);
    });

    it('gives magic jewels and charms a blue border', () => {
      expect(run(item('jew', { quality: QUALITY.magic }), { level: STRICT }).labelBorder).toEqual({
        color: [110, 110, 255, 255],
        width: 1,
      });
      expect(run(item('cm3', { quality: QUALITY.magic }), { level: STRICT }).hidden).toBe(false);
    });

    it('highlights a rare amulet and keeps rare gloves, but hides a rare sword at Strict unless it has + to All Skills', () => {
      const where = { level: STRICT };
      const amulet = run(item('amu', { quality: QUALITY.rare }), where);
      expect(amulet.hidden).toBe(false);
      expect(amulet.icon).toEqual({ iconName: 'gem', iconSize: 25 });
      expect(amulet.chatMessages).toEqual(['ÿc9Rare: Amulet']);
      expect(run(item('lgl', { quality: QUALITY.rare }), where).hidden).toBe(false);
      expect(run(item('crs', { quality: QUALITY.rare }), where).hidden).toBe(true);
      expect(run(item('crs', { quality: QUALITY.rare, stats: [stat('item_allskills', 1)] }), where).hidden).toBe(false);
      expect(run(item('crs', { quality: QUALITY.rare }), { level: LEVELING }).hidden).toBe(false);
    });

    it('highlights uniques, and hides a normal-tier unique at Strict only', () => {
      const lowUnique = item('cap', { quality: QUALITY.unique, uniqueOrSetId: 426, name: 'Cap' });
      const leveling = run(lowUnique);
      expect(leveling.hidden).toBe(false);
      expect(leveling.notified).toBe(true);
      // The drop line from notifications.dropFormat; {qualityColor} is the unique label colour.
      expect(leveling.chatMessages).toEqual(['ÿc4Drop: ÿcDCap']);
      expect(leveling.sounds).toEqual([{ sound: 'unique.mp3', volume: 50 }]);
      expect(leveling.icon).toEqual({ iconName: 'goldstar', iconSize: 30 });
      expect(leveling.droplight).toEqual({ color: [199, 179, 119] });
      expect(run(lowUnique, { level: STRICT }).hidden).toBe(true);
      expect(run(lowUnique, { level: STRICT, area: 109 }).hidden).toBe(false);
      expect(run(item('xlm', { quality: QUALITY.unique }), { level: STRICT }).hidden).toBe(false);
      expect(run(item('rin', { quality: QUALITY.unique }), { level: STRICT }).hidden).toBe(false);
      expect(run(item('m01', { quality: QUALITY.unique }), { level: STRICT }).hidden).toBe(false);
    });

    it('highlights set items, and hides a normal-tier set item at Strict only', () => {
      const lowSet = item('lgl', { quality: QUALITY.set, uniqueOrSetId: 51 });
      const leveling = run(lowSet);
      expect(leveling.hidden).toBe(false);
      expect(leveling.notified).toBe(true);
      expect(leveling.icon).toEqual({ iconName: 'star', iconSize: 30 });
      expect(run(lowSet, { level: STRICT }).hidden).toBe(true);
      expect(run(item('xlm', { quality: QUALITY.set }), { level: STRICT }).hidden).toBe(false);
      expect(run(item('amu', { quality: QUALITY.set }), { level: STRICT }).hidden).toBe(false);
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

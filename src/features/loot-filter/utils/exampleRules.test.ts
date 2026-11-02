import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { evaluateFilter, type TestContext, type TestItem } from '../engine/evaluate';
import { parseLootFilter } from '../engine/parse';
import { buildLootFilterReference } from '../engine/reference';
import { serializeLootFilter } from '../engine/serialize';
import type { LootFilter, LootFilterRule } from '../engine/types';
import { validateLootFilter } from '../engine/validate';
import { findBundledIcon, findBundledSound } from './bundledAssets';
import { EXAMPLE_RULES } from './exampleRules';

const json = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data', file), 'utf8')) as unknown;
const lootfilter = json('lootfilter.json') as LootFilterDataBundle;
const reference = buildLootFilterReference(lootfilter, json('types.json') as TypesBundle);

const filterOf = (rules: readonly LootFilterRule[]): LootFilter => ({ formatVersion: 1, rules, leadingComments: [] });
const example = (id: string): LootFilterRule => {
  const found = EXAMPLE_RULES.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no example ${id}`);
  return found.rule;
};

describe('EXAMPLE_RULES', () => {
  it.each(EXAMPLE_RULES.map((entry) => [entry.id, entry.rule] as const))(
    '%s survives a write and read and validates without a problem against the game data',
    (_id, rule) => {
      const parsed = parseLootFilter(serializeLootFilter(filterOf([rule])));
      expect(parsed.diagnostics).toEqual([]);
      expect(parsed.filter.rules).toEqual([rule]);
      expect(validateLootFilter(parsed.filter, reference)).toEqual([]);
    }
  );

  it('uses only sounds and icons the zip download bundles, and never Enhanced Damage or Defense', () => {
    for (const { rule } of EXAMPLE_RULES) {
      if (typeof rule.sound === 'string') expect(findBundledSound(rule.sound)).toBeDefined();
      if (rule.icon !== undefined) expect(findBundledIcon(rule.icon.iconName)).toBeDefined();
      const stats = [...(rule.itemStats ?? []), ...(rule.itemStatsAnyOf ?? [])].map((check) => check.stat);
      expect(stats).not.toEqual(expect.arrayContaining(['item_maxdamage_percent']));
      expect(stats.filter((stat) => /damage_percent|armor_percent/.test(String(stat)))).toEqual([]);
    }
  });

  it('names ids that are what the descriptions say', () => {
    const uniques = example('unique-by-id').uniqueOrSetIds?.map((id) => lootfilter.uniques.find((entry) => entry.id === id)?.name);
    expect(uniques).toEqual(['The Oculus', 'The Oculus']);
    const runes = example('high-runes').itemCodes?.map((code) => lootfilter.items.find((item) => item.code === code)?.name);
    expect(runes?.at(0)).toBe('Ist Rune');
    expect(runes?.at(-1)).toBe('Zod Rune');
  });

  describe('behaves as described in the Test tab evaluator', () => {
    const statIds = new Map(lootfilter.stats.map((stat) => [stat.name, stat.id]));
    const id = (name: string) => statIds.get(name) ?? -1;
    const context: TestContext = { playerStats: [], difficulty: 2, area: 2, filterLevel: 1, statIds };
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
    const run = (rule: LootFilterRule, overrides: Partial<TestItem>) => evaluateFilter(filterOf([rule]), item(overrides), context);

    it('hides a magic weapon without the stats and keeps one with any of them', () => {
      const rule = example('hide-weapons-except');
      expect(run(rule, {}).hidden).toBe(true);
      expect(run(rule, { stats: [{ stat: id('item_fastercastrate'), value: 10 }] }).hidden).toBe(false);
      expect(run(rule, { quality: 7 }).hidden).toBe(false);
    });

    it('needs both stats in the all-of example and one in the any-of example', () => {
      const ring = { code: 'rin', typeAncestors: ['ring', 'misc'], baseTier: null };
      const fcr = { stat: id('item_fastercastrate'), value: 10 };
      const mf = { stat: id('item_magicbonus'), value: 10 };
      expect(run(example('jewellery-all-of'), { ...ring, stats: [fcr] }).matched).toBe(false);
      expect(run(example('jewellery-all-of'), { ...ring, stats: [fcr, mf] }).matched).toBe(true);
      const charm = { code: 'cm1', typeAncestors: ['scha', 'char', 'misc'], baseTier: null };
      expect(run(example('charms-any-of'), { ...charm, stats: [mf] }).matched).toBe(true);
      expect(run(example('charms-any-of'), { ...charm, stats: [] }).matched).toBe(false);
    });
  });
});

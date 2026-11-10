import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { evaluateFilter } from '../engine/evaluate';
import { parseLootFilter } from '../engine/parse';
import type { LootFilter } from '../engine/types';
import { buildLookup, EMPTY_LOOKUP } from './lookup';
import {
  applyPreset,
  defaultFilterLevel,
  defaultTestItem,
  newStatRow,
  parseUniqueOrSetValue,
  TEST_PRESETS,
  toTestContext,
  toTestItem,
  uniqueOrSetValue,
  withItem,
  withQuality,
  withUniqueOrSet,
  type TestItemForm,
  type TestPreset,
} from './testItemForm';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
}

const bundle = readJson('public/game-data/lootfilter.json') as LootFilterDataBundle;
const types = readJson('public/game-data/types.json') as TypesBundle;
const lookup = buildLookup(bundle, types);
const sully = parseLootFilter(readFileSync(resolve(process.cwd(), 'public/loot-filters/sullys-qol-filter.json'), 'utf8')).filter;

function preset(id: string): TestPreset {
  const found = TEST_PRESETS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
}

function form(overrides: Partial<TestItemForm> = {}): TestItemForm {
  return { ...defaultTestItem(), ...overrides };
}

const bareFilter: LootFilter = { formatVersion: 1, rules: [], leadingComments: [] };

describe('toTestItem', () => {
  it('takes the type ancestors from the game data', () => {
    const item = toTestItem(withItem(form(), 'r83', lookup), lookup);
    expect(item.code).toBe('r83');
    expect(item.name).toBe('Zod Rune');
    expect(item.typeAncestors).toEqual(expect.arrayContaining(['rune', 'misc']));
  });

  it("adds the ancestors of the base's type2 (a hand axe is also a one-handed swing weapon)", () => {
    const axe = withItem(form(), 'hax', lookup);
    expect(toTestItem(axe, lookup).typeAncestors).toEqual(['axe', 'mele', 'weap', '1hsw']);
    // A typed type other than the base's own leaves type2 out.
    expect(toTestItem({ ...axe, type: 'club' }, lookup).typeAncestors).not.toContain('1hsw');
  });

  it('falls back to the typed type alone without game data', () => {
    expect(toTestItem(form({ code: 'r83', type: 'rune' }), EMPTY_LOOKUP).typeAncestors).toEqual(['rune']);
    expect(toTestItem(form({ code: 'r83' }), EMPTY_LOOKUP).typeAncestors).toEqual([]);
  });

  it('turns complete stat rows into entries, resolving names and dropping incomplete rows', () => {
    const item = toTestItem(
      form({
        stats: [newStatRow(14, 1500), newStatRow('item_numsockets', 2), newStatRow('nope', 1), newStatRow(), newStatRow('97', 3, 54)],
      }),
      lookup
    );
    expect(item.stats).toEqual([
      { stat: 14, value: 1500 },
      { stat: 194, value: 2 },
      { stat: 97, param: 54, value: 3 },
    ]);
  });

  it('gives the unique or set id and treats empty numbers as 0', () => {
    const item = toTestItem(form({ uniqueOrSet: { id: 1072, kind: 'unique' }, itemLevel: undefined, sockets: undefined }), lookup);
    expect(item.uniqueOrSetId).toBe(1072);
    expect(item.itemLevel).toBe(0);
    expect(item.sockets).toBe(0);
    expect(toTestItem(form(), lookup).uniqueOrSetId).toBeNull();
  });
});

describe('base tier', () => {
  it('takes the base tier of every picked item from the game data', () => {
    expect(withItem(form(), 'cap', lookup).baseTier).toBe(0);
    expect(withItem(form(), 'xap', lookup).baseTier).toBe(1);
    expect(withItem(form(), 'yap', lookup).baseTier).toBe(2);
  });

  it('has no base tier for items without a tier family or unknown codes', () => {
    expect(withItem(form({ baseTier: 2 }), 'rin', lookup).baseTier).toBeNull();
    expect(withItem(form({ baseTier: 2 }), 'm01', lookup).baseTier).toBeNull();
    expect(withItem(form({ baseTier: 1 }), 'nope', lookup).baseTier).toBeNull();
    expect(withItem(form({ baseTier: 1 }), 'cap', EMPTY_LOOKUP).baseTier).toBeNull();
  });

  it('resets a changed base tier when another item is picked', () => {
    const changed = { ...withItem(form(), 'cap', lookup), baseTier: 2 };
    expect(withItem(changed, 'xap', lookup).baseTier).toBe(1);
  });

  it("gives a unique its base's tier", () => {
    expect(withUniqueOrSet(form({ baseTier: 0 }), { id: 1072, kind: 'unique' }, bundle, lookup).baseTier).toBeNull();
    const shako = bundle.uniques.find((entry) => entry.code === 'uap');
    if (!shako) throw new Error('no unique on uap');
    expect(withUniqueOrSet(form(), { id: shako.id, kind: 'unique' }, bundle, lookup).baseTier).toBe(2);
  });

  it('starts without a base tier', () => {
    expect(defaultTestItem().baseTier).toBeNull();
    expect(toTestItem(form(), lookup).baseTier).toBeNull();
  });
});

describe('unique or set picks', () => {
  it('round-trips picker values', () => {
    expect(parseUniqueOrSetValue('Unique:12')).toEqual({ id: 12, kind: 'unique' });
    expect(parseUniqueOrSetValue('Set:3')).toEqual({ id: 3, kind: 'set' });
    expect(parseUniqueOrSetValue('7')).toEqual({ id: 7, kind: null });
    expect(parseUniqueOrSetValue('x')).toBeNull();
    expect(uniqueOrSetValue({ id: 12, kind: 'unique' })).toBe('Unique:12');
    expect(uniqueOrSetValue({ id: 7, kind: null })).toBe('7');
    expect(uniqueOrSetValue(null)).toBeUndefined();
  });

  it('switches to the base item and sets the quality unless the user chose one', () => {
    const picked = withUniqueOrSet(form(), { id: 1072, kind: 'unique' }, bundle, lookup);
    expect(picked).toMatchObject({ code: 'm01', name: "Doomfletch's Prism", type: 'bow', quality: 7 });
    const chosen = withUniqueOrSet(withQuality(form(), 3), { id: 1072, kind: 'unique' }, bundle, lookup);
    expect(chosen.quality).toBe(3);
    expect(withUniqueOrSet(picked, null, bundle, lookup).uniqueOrSet).toBeNull();
  });
});

describe('toTestContext', () => {
  it('sends the player level as stat 12 before the extra player stats', () => {
    const context = toTestContext(form({ playerLevel: 92, playerStats: [newStatRow('strength', 100)] }), bareFilter, lookup);
    expect(context.playerStats).toEqual([
      { stat: 12, value: 92 },
      { stat: 0, value: 100 },
    ]);
  });

  it('resolves player stats by name through the game data and drops unknown names', () => {
    const rows = [newStatRow('item_numsockets', 2), newStatRow('nope', 1), newStatRow(7, 50)];
    const context = toTestContext(form({ playerStats: rows }), bareFilter, lookup);
    expect(context.playerStats).toEqual([
      { stat: 12, value: 1 },
      { stat: 194, value: 2 },
      { stat: 7, value: 50 },
    ]);
    expect(context.statIds.get('item_numsockets')).toBe(194);
    expect(toTestContext(form({ playerStats: rows }), bareFilter, EMPTY_LOOKUP).playerStats).toEqual([
      { stat: 12, value: 1 },
      { stat: 7, value: 50 },
    ]);
  });

  it("uses the filter's default level unless one is chosen", () => {
    expect(toTestContext(form(), sully, lookup).filterLevel).toBe(3);
    expect(toTestContext(form({ filterLevel: 1 }), sully, lookup).filterLevel).toBe(1);
    expect(defaultFilterLevel({ ...bareFilter, filterLevels: [{ id: 5, name: 'Five' }] })).toBe(5);
    expect(defaultFilterLevel(bareFilter)).toBe(1);
  });

  it('defaults to Rogue Encampment, normal difficulty', () => {
    expect(toTestContext(form(), bareFilter, lookup)).toMatchObject({ area: 1, difficulty: 0 });
  });
});

describe('presets', () => {
  it('fill the item fields and keep the context', () => {
    const start = form({ area: 2, playerLevel: 50, isEthereal: true });
    const gold = applyPreset(start, preset('gold'), lookup);
    expect(gold).toMatchObject({ code: 'gld', name: '1500 Gold', type: 'gold', area: 2, playerLevel: 50, isEthereal: false });
    expect(toTestItem(gold, lookup).stats).toEqual([{ stat: 14, value: 1500 }]);

    const bow = applyPreset(start, preset('unique-bow'), lookup);
    expect(bow).toMatchObject({ code: 'm01', quality: 7, sockets: 2, type: 'bow', baseTier: null });

    expect(applyPreset(start, preset('rare-ring'), lookup)).toMatchObject({ code: 'rin', quality: 6, name: 'Ring', baseTier: null });
  });

  it("take the game data's base tier, replacing the form's", () => {
    const elite = form({ baseTier: 2 });
    expect(applyPreset(elite, preset('rare-ring'), lookup).baseTier).toBeNull();
    expect(applyPreset(elite, preset('zod'), lookup).baseTier).toBeNull();
    expect(applyPreset(elite, preset('zod'), EMPTY_LOOKUP).baseTier).toBeNull();
  });

  it('work without the game data', () => {
    const zod = applyPreset(form(), preset('zod'), EMPTY_LOOKUP);
    expect(zod).toMatchObject({ code: 'r83', name: 'Zod Rune', type: 'rune', quality: 2 });
    expect(toTestItem(zod, EMPTY_LOOKUP).typeAncestors).toEqual(['rune']);
  });

  it("show the Zod preset with Sully's high-rune treatment", () => {
    const zod = applyPreset(form(), preset('zod'), lookup);
    const result = evaluateFilter(sully, toTestItem(zod, lookup), toTestContext(zod, sully, lookup));
    const applied = result.trace.filter((rule) => rule.outcome === 'applied');
    expect(result.hidden).toBe(false);
    // Sully's never-hide rule for high runes, then his Zod label rule (v0.9.0 on).
    expect(applied).toHaveLength(2);
    expect(sully.rules[applied[1]?.index ?? -1]?.itemCodes).toContain('r83');
    expect(result.name).toBe('ÿc1Zod Rune');
  });

  it("let Sully's filter hide small gold piles out of town", () => {
    const gold = applyPreset(form({ area: 2, playerLevel: 95 }), preset('gold'), lookup);
    const result = evaluateFilter(sully, toTestItem(gold, lookup), toTestContext(gold, sully, lookup));
    expect(result.hidden).toBe(true);
    const inTown = { ...gold, area: 1 };
    expect(evaluateFilter(sully, toTestItem(inTown, lookup), toTestContext(inTown, sully, lookup)).name).toBe('ÿc0$$');
  });
});

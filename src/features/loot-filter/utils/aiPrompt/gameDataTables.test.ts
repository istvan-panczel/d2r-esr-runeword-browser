import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { csvCell, gameDataTables, toCsv, type GameDataTable } from './gameDataTables';

const json = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data', file), 'utf8')) as unknown;
const data = json('lootfilter.json') as LootFilterDataBundle;
const types = json('types.json') as TypesBundle;

const compact = gameDataTables(data, types, 'compact');
const full = gameDataTables(data, types, 'full');

function table(tables: readonly GameDataTable[], path: string): string[] {
  const found = tables.find((entry) => entry.path === path);
  if (found === undefined) throw new Error(`no ${path}`);
  return found.text.trimEnd().split('\n');
}

/** The first cell of each data row (no quoted commas in the first columns of these tables). */
const firstCells = (lines: readonly string[]) => lines.slice(1).map((line) => line.split(',')[0] ?? '');

describe('csv', () => {
  it('quotes cells with commas, quotes and line breaks and leaves empty ones empty', () => {
    expect(csvCell('Ancient Coupon (Buckler, Pelta Lunata)')).toBe('"Ancient Coupon (Buckler, Pelta Lunata)"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect([csvCell(undefined), csvCell(null), csvCell(false), csvCell(true), csvCell(0)]).toEqual(['', '', '', 'yes', '0']);
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\n1,"x,y"\n');
  });
});

describe('gameDataTables', () => {
  it('lists the compact and full files in prompt order', () => {
    expect(compact.map((entry) => entry.path)).toEqual([
      'item-types.csv',
      'items.csv',
      'bases.csv',
      'stats.csv',
      'uniques-sets.csv',
      'areas.csv',
      'skills.csv',
      'skill-tabs.csv',
      'classes.csv',
    ]);
    expect(full.map((entry) => entry.path)).toEqual([
      'item-types.csv',
      'items.csv',
      'stats.csv',
      'uniques-sets.csv',
      'areas.csv',
      'skills.csv',
      'skill-tabs.csv',
      'classes.csv',
    ]);
    for (const entry of [...compact, ...full]) expect(entry.summary).not.toBe('');
  });

  it('keeps the Compact tables at about half of Full', () => {
    const size = (tables: readonly GameDataTable[]) => tables.reduce((sum, entry) => sum + entry.text.length, 0);
    expect(size(compact)).toBeLessThan(size(full) / 1.8);
  });

  it('has every item type and every stat in both sizes', () => {
    for (const tables of [compact, full]) {
      expect(firstCells(table(tables, 'item-types.csv'))).toEqual(types.types.map((type) => type.code));
      expect(firstCells(table(tables, 'stats.csv')).map(Number)).toEqual(data.stats.map((stat) => stat.id));
    }
  });

  it('notes the param kind, the plugin quirks and the storage scale on the stats', () => {
    const stats = table(compact, 'stats.csv');
    const row = (id: number) => stats.find((line) => line.startsWith(`${String(id)},`)) ?? '';
    expect(row(188)).toContain('skill tab: class × 8 + tab');
    expect(row(107)).toContain('skill id (skills.csv)');
    expect(row(17)).toContain('reads 0 on weapons');
    expect(row(16)).toContain('reads 0');
    expect(row(7)).toContain('reads the tooltip number');
    expect(row(220)).toContain("the character's level");
    expect(row(127)).toBe('127,item_allskills,All Skills,,');
  });

  it('Full lists every item code with its drop flag; Compact only items that drop, misc and bases apart', () => {
    expect(firstCells(table(full, 'items.csv'))).toEqual(data.items.map((item) => item.code));
    const dropping = new Set(data.items.filter((item) => item.drops).map((item) => item.code));
    const misc = firstCells(table(compact, 'items.csv')).filter((code) => code !== '');
    expect(misc.every((code) => dropping.has(code))).toBe(true);
    expect(misc).toContain('r51');
    expect(misc).toContain('r83');
    expect(misc).not.toContain('r48');
    const bases = table(compact, 'bases.csv').join('\n');
    expect(bases).toContain('hax Hand Axe');
    expect(
      data.items.filter((item) => item.kind !== 'misc' && item.drops).every((item) => bases.includes(`${item.code} ${item.name}`))
    ).toBe(true);
  });

  it('collapses stacks of identically named containers in Compact to one row per type', () => {
    const lines = table(compact, 'items.csv');
    const stockers = lines.filter((line) => line.includes('Rune Stocker'));
    expect(stockers).toHaveLength(1);
    expect(stockers[0]).toBe(',"Rune Stocker ×47 (one code each, all with this name: match them by item type can2)",can2,');
    // Rings and amulets (a few rows of one name) keep their codes.
    expect(lines.filter((line) => line.split(',')[1] === 'Ring').length).toBeGreaterThan(0);
  });

  it('groups the Compact bases by type with the tiers in order', () => {
    const axes = table(compact, 'bases.csv').filter((line) => line.startsWith('axe,'));
    expect(axes.map((line) => line.split(',')[2])).toEqual(['normal', 'exceptional', 'elite']);
  });

  it('merges uniques by name in Compact, dropped ids and Ancient Coupon ids apart; Full has one row per id', () => {
    expect(table(compact, 'uniques-sets.csv')).toContain('The Oculus,418,973,');
    const fullRows = table(full, 'uniques-sets.csv');
    expect(fullRows.some((line) => line.startsWith('unique,973,The Oculus,') && line.includes('Ancient Coupon row'))).toBe(true);
    expect(fullRows).toHaveLength(1 + data.uniques.length + data.sets.length);
    const disabled = data.uniques.find((entry) => entry.disabled === true);
    expect(disabled).toBeDefined();
    expect(table(compact, 'uniques-sets.csv').some((line) => line.startsWith(`${disabled?.name ?? ''},`))).toBe(false);
  });

  it('has the class skills in Compact and every skill in Full; the tabs and classes in both', () => {
    const classSkills = (data.skills ?? []).filter((skill) => skill.cls !== undefined).length;
    expect(table(compact, 'skills.csv')).toHaveLength(1 + classSkills);
    expect(table(full, 'skills.csv')).toHaveLength(1 + (data.skills ?? []).length);
    const tabs = table(compact, 'skill-tabs.csv');
    expect(tabs).toContain('8,Sorceress,Fire Skills');
    expect(tabs).toContain('50,Assassin,Martial Arts');
    expect(table(compact, 'classes.csv')).toContain('0,ama,Amazon');
  });

  it('lists no sounds.txt names in either size (the prompt asks the user for one)', () => {
    for (const tables of [compact, full]) {
      expect(tables.some((entry) => entry.path === 'sounds.csv')).toBe(false);
      expect(tables.some((entry) => entry.text.includes('item_rune'))).toBe(false);
    }
  });
});

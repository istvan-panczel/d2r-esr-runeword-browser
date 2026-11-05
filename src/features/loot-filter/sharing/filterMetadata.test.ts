import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsoncSyntaxError } from '../engine/jsonc';
import { filterMetadata } from './filterMetadata';

const SULLY = readFileSync(resolve(__dirname, '../../../../public/loot-filters/sullys-qol-filter.json'), 'utf-8');

describe('filterMetadata', () => {
  it("reads the bundled Sully's QoL filter (comments included)", () => {
    const meta = filterMetadata(SULLY);
    expect(meta.title).toBe("Sully's QoL Filter");
    expect(meta.author).toBe('Sully');
    expect(meta.file_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(meta.rule_count).toBe(225);
    expect(meta.levels).toHaveLength(4);
    expect(meta.levels?.[0]).toEqual({ id: 1, name: 'Leveling' });
  });

  it('accepts trailing commas and maps missing or blank header fields to null', () => {
    const meta = filterMetadata('{ "formatVersion": 1, "title": "  ", "rules": [{ "itemCodes": ["r01"] },], }');
    expect(meta).toEqual({ title: null, author: null, file_version: null, rule_count: 1, levels: null });
  });

  it('counts enabled rules only (disabledRules are not run by the plugin)', () => {
    const text = JSON.stringify({
      formatVersion: 1,
      rules: [{ itemCodes: ['a'] }, { itemCodes: ['b'] }],
      disabledRules: [{ at: 0, rule: { itemCodes: ['z'] } }],
    });
    expect(filterMetadata(text).rule_count).toBe(2);
  });

  it('clips header texts to the 200-character column limit', () => {
    const meta = filterMetadata(JSON.stringify({ formatVersion: 1, author: 'x'.repeat(250), rules: [] }));
    expect(meta.author).toHaveLength(200);
  });

  it('drops trailing levels that would not fit the 4 KB column', () => {
    const filterLevels = Array.from({ length: 60 }, (_, index) => ({ id: index + 1, name: 'n'.repeat(80) }));
    const meta = filterMetadata(JSON.stringify({ formatVersion: 1, filterLevels, rules: [] }));
    const levels = meta.levels ?? [];
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.length).toBeLessThan(60);
    expect(levels[0]).toEqual(filterLevels[0]);
  });

  it('gives empty metadata for JSON that is not a filter object', () => {
    expect(filterMetadata('[]')).toEqual({ title: null, author: null, file_version: null, rule_count: 0, levels: null });
  });

  it('throws on text that is not JSON', () => {
    expect(() => filterMetadata('{ nope')).toThrow(JsoncSyntaxError);
  });
});

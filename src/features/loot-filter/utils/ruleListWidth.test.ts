import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RULE_LIST_WIDTH_STORAGE_KEY,
  clampRuleListWidth,
  parseRuleListWidth,
  readRuleListWidth,
  ruleListBounds,
  ruleListWidthForKey,
  writeRuleListWidth,
} from './ruleListWidth';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('parseRuleListWidth', () => {
  it('reads a number of rem in range', () => {
    expect(parseRuleListWidth('24')).toBe(24);
    expect(parseRuleListWidth('31.5')).toBe(31.5);
    expect(parseRuleListWidth('18')).toBe(18);
  });

  it('rejects missing, junk and out-of-range values', () => {
    for (const raw of [null, '', '  ', 'wide', 'NaN', 'Infinity', '17.9', '-30', '401', '1e9']) {
      expect(parseRuleListWidth(raw)).toBeNull();
    }
  });
});

describe('ruleListBounds and clampRuleListWidth', () => {
  it('keeps the list between 18rem and 60% of the row', () => {
    const bounds = ruleListBounds(1200, 16);
    expect(bounds).toEqual({ min: 288, max: 720 });
    expect(clampRuleListWidth(100, bounds)).toBe(288);
    expect(clampRuleListWidth(500, bounds)).toBe(500);
    expect(clampRuleListWidth(900, bounds)).toBe(720);
  });

  it('lets the minimum win when 60% of a narrow row is less', () => {
    const bounds = ruleListBounds(400, 16);
    expect(bounds).toEqual({ min: 288, max: 288 });
    expect(clampRuleListWidth(350, bounds)).toBe(288);
  });

  it('follows the root font size', () => {
    expect(ruleListBounds(2000, 20).min).toBe(360);
  });
});

describe('ruleListWidthForKey', () => {
  const bounds = { min: 288, max: 720 };

  it('steps with the arrows (Shift: bigger) and stays in bounds', () => {
    expect(ruleListWidthForKey('ArrowRight', false, 400, bounds, 16)).toBe(416);
    expect(ruleListWidthForKey('ArrowLeft', false, 400, bounds, 16)).toBe(384);
    expect(ruleListWidthForKey('ArrowRight', true, 400, bounds, 16)).toBe(464);
    expect(ruleListWidthForKey('ArrowLeft', true, 300, bounds, 16)).toBe(288);
    expect(ruleListWidthForKey('ArrowRight', true, 710, bounds, 16)).toBe(720);
  });

  it('jumps to the ends with Home and End and ignores other keys', () => {
    expect(ruleListWidthForKey('Home', false, 400, bounds, 16)).toBe(288);
    expect(ruleListWidthForKey('End', false, 400, bounds, 16)).toBe(720);
    expect(ruleListWidthForKey('ArrowUp', false, 400, bounds, 16)).toBeNull();
    expect(ruleListWidthForKey('Enter', false, 400, bounds, 16)).toBeNull();
  });
});

describe('readRuleListWidth and writeRuleListWidth', () => {
  it('round-trips the width and removes it on reset', () => {
    expect(readRuleListWidth()).toBeNull();
    writeRuleListWidth(30.123);
    expect(localStorage.getItem(RULE_LIST_WIDTH_STORAGE_KEY)).toBe('30.12');
    expect(readRuleListWidth()).toBe(30.12);
    writeRuleListWidth(null);
    expect(localStorage.getItem(RULE_LIST_WIDTH_STORAGE_KEY)).toBeNull();
    expect(readRuleListWidth()).toBeNull();
  });

  it('works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readRuleListWidth()).toBeNull();
    expect(() => {
      writeRuleListWidth(30);
    }).not.toThrow();
  });
});

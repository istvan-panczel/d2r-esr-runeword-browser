import { describe, expect, it } from 'vitest';
import { areaLabel, bossTargets, ingredientIcon, ingredientText, killsText } from './killLedgerView';

describe('killsText', () => {
  it('groups thousands', () => {
    expect(killsText(500)).toBe('500');
    expect(killsText(10_000_000)).toBe('10,000,000');
  });
});

describe('ingredientText', () => {
  it('shows a count only above one', () => {
    expect(ingredientText({ name: 'Perfect Gem', qty: 2, icon: null })).toBe('2× Perfect Gem');
    expect(ingredientText({ name: 'Maple Leaf', qty: 1, icon: null })).toBe('Maple Leaf');
  });
});

describe('ingredientIcon', () => {
  it('reads a token, null when the ingredient has no art', () => {
    expect(ingredientIcon({ icon: 'i:map' })).toEqual({ kind: 'item', code: 'map' });
    expect(ingredientIcon({ icon: null })).toBeNull();
  });
});

describe('bossTargets', () => {
  const boss = (...names: string[]) => ({ monsters: names.map((name) => ({ id: name, name })) });

  it('lists the monsters of a group', () => {
    expect(bossTargets(boss('Talic', 'Madawc', 'Korlic'))).toBe('Talic, Madawc or Korlic');
  });

  it('is null for one monster', () => {
    expect(bossTargets(boss('Lucion'))).toBeNull();
  });
});

describe('areaLabel', () => {
  it('names the map tier', () => {
    expect(areaLabel({ name: 'Chaos Rift Level 4', tier: 2 })).toBe('Tier 2: Chaos Rift Level 4');
  });
});

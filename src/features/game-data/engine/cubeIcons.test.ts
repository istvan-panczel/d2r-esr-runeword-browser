import { describe, expect, it } from 'vitest';
import { cubeCellIcon, cubeCellKeys, cubeCellOptions, cubeCellToken, cubeIconRef, withoutCount, withoutTrailingNote } from './cubeIcons';

describe('cube cell icons', () => {
  const icons = {
    Heart: 'i:hrt',
    'Normal Weapon (elite tier, no sockets)': 't:weap',
    'Superior Weapon (elite tier, no sockets)': 't:weap',
    "Assassin's Choker": "u:Assassin's Choker",
    'Ancient Coupon (Wild Card)': 'i:99j',
    'Perfect Gem': 't:gem5',
    "Bul-Kathos' Wedding Band": "u:Bul-Kathos' Wedding Band",
    "Nature's Peace": "u:Nature's Peace",
    Jewel: 'i:jew',
  };

  it('splits a cell into options without counts, leaving out the "… (N variants)" tail and multi-output cells', () => {
    expect(withoutCount('3× Heart')).toBe('Heart');
    expect(cubeCellOptions('3× Greater Healing Potion / 9× Healing Potion')).toEqual(['Greater Healing Potion', 'Healing Potion']);
    expect(cubeCellOptions('A / B / C / … (7 variants)')).toEqual(['A', 'B', 'C']);
    expect(cubeCellOptions('Ring + Amulet')).toBeNull();
    expect(withoutTrailingNote("Assassin's Choker (Unique)")).toBe("Assassin's Choker");
    expect(withoutTrailingNote('Amulet (Crafted, +(5 to 10) to Life)')).toBe('Amulet');
    expect(withoutTrailingNote('Heart')).toBe('Heart');
    expect(cubeCellKeys('2× Jewel (Rare)')).toEqual(['Jewel (Rare)', 'Jewel']);
  });

  it('resolves a code key, a name after dropping the trailing note, and a name that has its own parentheses', () => {
    expect(cubeCellToken('3× Heart', icons)).toBe('i:hrt');
    expect(cubeCellIcon("Assassin's Choker (Unique)", icons)).toEqual({ kind: 'unique', name: "Assassin's Choker" });
    expect(cubeCellIcon('Ancient Coupon (Wild Card)', icons)).toEqual({ kind: 'item', code: '99j' });
    expect(cubeCellIcon('Jewel (Rare)', icons)).toEqual({ kind: 'item', code: 'jew' });
    expect(cubeCellIcon('The same item (3 sockets)', icons)).toBeNull();
    expect(cubeCellIcon('Heart', undefined)).toBeNull();
  });

  it('gives a type ingredient its type token, and options only an icon when they all name the same thing', () => {
    expect(cubeCellIcon('5× Perfect Gem', icons)).toEqual({ kind: 'type', code: 'gem5' });
    expect(cubeCellIcon('Normal Weapon (elite tier, no sockets) / Superior Weapon (elite tier, no sockets)', icons)).toEqual({
      kind: 'type',
      code: 'weap',
    });
    // Different items: no icon rather than the first one's
    expect(cubeCellIcon("Bul-Kathos' Wedding Band / Nature's Peace / … (7 variants)", icons)).toBeNull();
    expect(cubeCellIcon('Heart / Unknown', icons)).toBeNull();
  });

  it('parses tokens', () => {
    expect(cubeIconRef('s:Civerb')).toEqual({ kind: 'set', name: 'Civerb' });
    expect(cubeIconRef('x:abc')).toBeNull();
    expect(cubeIconRef('i:')).toBeNull();
    expect(cubeIconRef('iabc')).toBeNull();
  });
});

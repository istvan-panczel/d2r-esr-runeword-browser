import { describe, expect, it } from 'vitest';
import { crucibleGroupLabel, EXTRA_FAMILIES } from './cubeCatalog.ts';

describe('crucibleGroupLabel', () => {
  it('titles a crucible group by its forging kind, without the first row’s class, quality or slot', () => {
    expect(crucibleGroupLabel('Crucible - Weapon Skill Forging Ama')).toBe('Second class skill forging');
    expect(crucibleGroupLabel('Crucible - Low Quality Socketed Stat Forging Ama_weap')).toBe('Second stat forging');
    expect(crucibleGroupLabel('Crucible - Rune Forging wand')).toBe('Second rune forging');
    expect(crucibleGroupLabel('Crucible - All Skill Forging Set (Weapon)')).toBe('Second all skills forging');
    expect(crucibleGroupLabel('Crucible - Remove Rune Forging wand/staf')).toBe('Removing the second rune forging');
    expect(crucibleGroupLabel('Crucible - Remove All Skill Forging Set')).toBe('Removing the second all skills forging');
    expect(crucibleGroupLabel('[SECRET08] Crucible - Forging Exp +10% : Weapon + 5 Brains + 10 Souls')).toBe(
      'Second experience forging (secret recipe)'
    );
    // An unknown kind keeps the description shape
    expect(crucibleGroupLabel('Crucible - Something 3')).toBe('Crucible - Something #');
  });
});

describe('EXTRA_FAMILIES', () => {
  it('gives the former "Other recipes" rows a family with a readable title', () => {
    const familyOf = (description: string) => EXTRA_FAMILIES.find((family) => family.match.test(description))?.id;
    expect(familyOf('Introductory Book Cycle 4')).toBe('introductory-book');
    expect(familyOf('Negative MF Charm: SC + Decipherer + Stamina Pot')).toBe('negative-charms');
    expect(familyOf('Randomize Stone')).toBe('randomizing-stone');
    expect(familyOf('Opener Size Change')).toBe('can-opener');
    expect(familyOf('Morph Charm Refund')).toBe('morph-charm-refund');
    expect(familyOf("Anya's Gift (nor) 1st")).toBe('ancients-gift');
    expect(familyOf("Anya's Gift D-Stone End")).toBe('ancients-gift');
    expect(familyOf('Weapons Crate')).toBe('weapons-crate');
  });
});

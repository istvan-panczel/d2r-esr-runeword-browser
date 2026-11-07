import { describe, expect, it } from 'vitest';
import { parsePerkCheck, specializationHref, specializationSlug } from './specializationLinks.ts';

describe('specializationSlug / specializationHref', () => {
  it('makes lower-case kebab slugs of the English names', () => {
    expect(specializationSlug('Looter’s Rush')).toBe('looters-rush');
    expect(specializationSlug("One Man's Trash")).toBe('one-mans-trash');
    expect(specializationSlug('Six Peas in a Pod')).toBe('six-peas-in-a-pod');
    expect(specializationSlug('Archaeologist')).toBe('archaeologist');
  });

  it('links a tree and a perk', () => {
    expect(specializationHref('Alchemist', 'Hidden Elixirs')).toBe('/specializations?tree=alchemist&perk=hidden-elixirs');
    expect(specializationHref('Jeweler')).toBe('/specializations?tree=jeweler');
  });
});

describe('parsePerkCheck', () => {
  it('reads the Cube page perk conditions', () => {
    expect(parsePerkCheck('Needs the Jeweler perk Steady Pliers')).toEqual({
      prefix: 'Needs the ',
      tree: 'Jeweler',
      title: 'Steady Pliers',
      suffix: '',
    });
    expect(parsePerkCheck('Needs the Blacksmith perk The Secret Crucible (some variants)')).toEqual({
      prefix: 'Needs the ',
      tree: 'Blacksmith',
      title: 'The Secret Crucible',
      suffix: ' (some variants)',
    });
    expect(parsePerkCheck('Only without the Alchemist perk Alchemical Excellence')?.prefix).toBe('Only without the ');
    expect(parsePerkCheck('Hell only')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { findDropFinderTerm } from './dropFinder';

describe('findDropFinderTerm', () => {
  it('finds the first Primordial Soulstone, singular or plural', () => {
    expect(findDropFinderTerm('collecting 10 Primordial Soulstones that drop')).toEqual({ index: 14, term: 'Primordial Soulstones' });
    expect(findDropFinderTerm('one Primordial Soulstone at a time')).toEqual({ index: 4, term: 'Primordial Soulstone' });
  });

  it('returns null for text without one', () => {
    expect(findDropFinderTerm('Kill Nihlathak on Hell')).toBeNull();
  });
});

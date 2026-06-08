import { describe, expect, it } from 'vitest';
import { buildRecipeFavoriteId } from './recipeFavorites';

interface RecipeLike {
  readonly name: string;
  readonly variant: number;
}

const bowRecipe: RecipeLike = {
  name: 'Test Bow Word',
  variant: 1,
};

const armorRecipe: RecipeLike = {
  name: 'Test Armor Word',
  variant: 1,
};

describe('recipe favorite helpers', () => {
  it('builds ids from kind, name and variant only, so they stay stable across data refreshes', () => {
    expect(buildRecipeFavoriteId('runeword', bowRecipe)).toBe('runeword:Test Bow Word:1');
    expect(buildRecipeFavoriteId('gemword', armorRecipe)).toBe('gemword:Test Armor Word:1');
  });
});

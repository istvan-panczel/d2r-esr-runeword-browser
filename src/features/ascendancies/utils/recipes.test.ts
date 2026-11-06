import { describe, expect, it } from 'vitest';
import { splitCount, summariseRecipes } from './recipes';

describe('summariseRecipes', () => {
  it('returns null without recipes', () => {
    expect(summariseRecipes([])).toBeNull();
  });

  it('keeps a single recipe as it is', () => {
    const recipe = { inputs: ['Ascendancy Stone', 'Maple Leaf'], outputs: ['Ascendancy Stone', 'Upgraded to Tier 3'] };
    expect(summariseRecipes([recipe])).toEqual({ ...recipe, perAscendancy: false });
  });

  it('reduces one recipe per ascendancy to the shared inputs and a generic stone', () => {
    expect(
      summariseRecipes([
        { inputs: ['Orb of Creation', '2 Blemished Sapphire', '2 Blemished Obsidian'], outputs: ['Battlemage Ascendancy Stone'] },
        { inputs: ['Orb of Creation', '4 Blemished Obsidian'], outputs: ['Berserker Ascendancy Stone'] },
      ])
    ).toEqual({ inputs: ['Orb of Creation'], perAscendancy: true, outputs: ['The chosen Ascendancy Stone'] });
  });

  it('does not claim a stone when the outputs are something else', () => {
    expect(
      summariseRecipes([
        { inputs: ['A'], outputs: ['X'] },
        { inputs: ['B'], outputs: ['Y'] },
      ])
    ).toEqual({ inputs: [], perAscendancy: true, outputs: ['One of 2 results'] });
  });
});

describe('splitCount', () => {
  it('splits a leading count', () => {
    expect(splitCount('2 Blemished Sapphire')).toEqual({ count: 2, name: 'Blemished Sapphire' });
  });

  it('counts a bare name once', () => {
    expect(splitCount('Orb of Creation')).toEqual({ count: 1, name: 'Orb of Creation' });
  });
});

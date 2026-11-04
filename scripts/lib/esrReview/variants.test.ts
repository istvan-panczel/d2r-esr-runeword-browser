import { describe, expect, it } from 'vitest';
import { recipeSignature, variantMap, variantsCheck, type ParsedRecipe } from './variants.ts';

const recipe = (name: string, variant: number, ingredients: string[], extra: Partial<ParsedRecipe> = {}): ParsedRecipe => ({
  name,
  variant,
  ingredients,
  sockets: ingredients.length,
  ...extra,
});

describe('runeword variants', () => {
  it('signs a recipe by ingredients and sockets', () => {
    expect(recipeSignature(recipe('Moon', 1, ['Ko', 'Ist'], { socketsMax: 4, jewelInfo: '(0-2) Jewels' }))).toBe(
      'Ko + Ist (2-4 sockets, (0-2) Jewels)'
    );
  });

  it('keeps the first row of a repeated id', () => {
    expect(variantMap([recipe('A', 1, ['x']), recipe('A', 1, ['y'])]).get('A:1')).toBe('x (1 sockets)');
  });

  it('flags a row inserted before an existing variant', () => {
    const before = variantMap([recipe('Moon', 1, ['Ko']), recipe('Moon', 2, ['Ist'])]);
    const shifted = variantMap([recipe('Moon', 1, ['Zod']), recipe('Moon', 2, ['Ko']), recipe('Moon', 3, ['Ist'])]);
    const check = variantsCheck('runeword', before, shifted, 'old.htm');
    expect(check.status).toBe('finding');
    expect(check.details.slice(0, 2)).toEqual([
      'runeword:Moon:1: Ko (1 sockets) → Zod (1 sockets)',
      'runeword:Moon:2: Ist (1 sockets) → Ko (1 sockets)',
    ]);
  });

  it('is info for appended variants and ok when nothing moved', () => {
    const before = variantMap([recipe('Moon', 1, ['Ko'])]);
    expect(variantsCheck('gemword', before, before, 'x').status).toBe('ok');
    expect(variantsCheck('gemword', before, variantMap([recipe('Moon', 1, ['Ko']), recipe('Moon', 2, ['Ist'])]), 'x').status).toBe('info');
    expect(variantsCheck('gemword', null, before, 'none').status).toBe('info');
  });
});

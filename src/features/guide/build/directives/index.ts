import { resolveCardDirective } from './card.ts';
import { resolveDifficultyPenalties } from './difficultyPenalties.ts';
import { resolveDstoneCaps } from './dstoneCaps.ts';
import { resolveGlossary } from './glossary.ts';
import { resolveRecipeOutput } from './recipeOutput.ts';
import { resolveRecipes } from './recipes.ts';
import { resolveSecretRecipe, resolveSecretRecipes } from './secretRecipes.ts';
import { resolveSource } from './source.ts';
import type { DirectiveResolver } from './types.ts';
import { resolveVendor } from './vendor.ts';

export { cardKeyArg } from './card.ts';
export { resolveTerm } from './glossary.ts';
export type { DirectiveResolver } from './types.ts';

export type LeafDirectiveName =
  | 'source'
  | 'secret-recipes'
  | 'secret-recipe'
  | 'recipe-output'
  | 'recipes'
  | 'vendor'
  | 'difficulty-penalties'
  | 'dstone-caps'
  | 'glossary'
  | 'card';

/** Leaf directives (`::name[arg]`) by name */
export const LEAF_DIRECTIVES: Readonly<Record<LeafDirectiveName, DirectiveResolver>> = {
  source: resolveSource,
  'secret-recipes': resolveSecretRecipes,
  'secret-recipe': resolveSecretRecipe,
  'recipe-output': resolveRecipeOutput,
  recipes: resolveRecipes,
  vendor: resolveVendor,
  'difficulty-penalties': resolveDifficultyPenalties,
  'dstone-caps': resolveDstoneCaps,
  glossary: resolveGlossary,
  card: resolveCardDirective,
};

export function isLeafDirective(name: string): name is LeafDirectiveName {
  return Object.hasOwn(LEAF_DIRECTIVES, name);
}

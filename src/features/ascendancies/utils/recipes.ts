import type { AscendancyRecipe } from '@/core/db';

/** One tier's recipes as one Input → Output line */
export interface RecipeSummary {
  readonly inputs: readonly string[];
  /** True when the tier has one recipe per ascendancy (Tier 1): the inputs are the shared ones, each card has the rest */
  readonly perAscendancy: boolean;
  readonly outputs: readonly string[];
}

const STONE_OUTPUT = /\S\s+Ascendancy Stone$/i;

/**
 * A tier's recipes as one line: a single recipe as it is; several (Tier 1: one per ascendancy) as the inputs they all
 * share, with the output generalised. Null when the page listed none.
 */
export function summariseRecipes(recipes: readonly AscendancyRecipe[]): RecipeSummary | null {
  if (recipes.length === 0) return null;
  if (recipes.length === 1) return { inputs: recipes[0].inputs, perAscendancy: false, outputs: recipes[0].outputs };
  const shared = recipes[0].inputs.filter((input) => recipes.every((recipe) => recipe.inputs.includes(input)));
  const stones = recipes.every((recipe) => recipe.outputs.length === 1 && STONE_OUTPUT.test(recipe.outputs[0]));
  return {
    inputs: shared,
    perAscendancy: true,
    outputs: [stones ? 'The chosen Ascendancy Stone' : `One of ${String(recipes.length)} results`],
  };
}

/** "2 Blemished Sapphire" → { count: 2, name: "Blemished Sapphire" }; a line without a leading count is count 1 */
export function splitCount(input: string): { readonly count: number; readonly name: string } {
  const match = /^(\d+)\s+(.+)$/.exec(input);
  return match ? { count: Number(match[1]), name: match[2] } : { count: 1, name: input };
}

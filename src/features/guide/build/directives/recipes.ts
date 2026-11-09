/** `::recipes[dstone-cycle]`: a curated cube recipe family (see cubeFamilies.ts) as a `recipes` block. */
import { assignCubeRows } from '../../../game-data/build/bundleCube.ts';
import { CUBE_FAMILIES, familyBlock, findCubeFamily } from '../../../game-data/build/cube/cubeFamilies.ts';
import type { RecipesBlock } from '../../engine/schema.ts';
import { requireEsr, type DirectiveResolver } from './types.ts';

const KNOWN = CUBE_FAMILIES.map((family) => family.id).join(', ');

export const resolveRecipes: DirectiveResolver = (arg, ctx) => {
  if (arg === null) return { error: `::recipes needs a family id, e.g. ::recipes[dstone-cycle] (known: ${KNOWN})` };
  const family = findCubeFamily(arg);
  if (family === undefined) return { error: `::recipes[${arg}]: unknown recipe family (known: ${KNOWN})` };
  const esr = requireEsr(ctx, 'recipes');
  if ('error' in esr) return esr;
  const block = familyBlock(family, esr);
  if (block.rows.length === 0) {
    return { error: `::recipes[${arg}]: no cubemain.txt row matches ${String(family.match)}; update the family in cubeFamilies.ts` };
  }
  return withCubeLink(block, family.id, esr);
};

/** Links a block to its family on the Cube Recipes page ("All N recipes"), when the family has rows there */
export function withCubeLink(block: RecipesBlock, familyId: string, esr: Parameters<typeof assignCubeRows>[0]): RecipesBlock {
  const count = assignCubeRows(esr).assigned.get(familyId)?.rows.length ?? 0;
  if (count === 0) return block;
  return { ...block, link: { label: `All ${count.toLocaleString('en-US')} recipes`, href: `/cube-recipes?family=${familyId}` } };
}

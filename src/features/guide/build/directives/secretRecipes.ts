/**
 * `::secret-recipes` / `::secret-recipe[50]`: the `[SECRETnn]` rows of cubemain.txt, merged per recipe
 * number (the txt repeats a recipe per base type, quality or socket count).
 */
import type { RecipeRow } from '../../engine/schema.ts';
import {
  capGroup,
  clusterWithBonus,
  distinct,
  formatInput,
  formatOutput,
  type RecipeVariant,
} from '../../../game-data/build/cube/cubeText.ts';
import { perkCheckText } from '../../../game-data/build/cube/perks.ts';
import type { EsrGuideTables } from '../esrGuideSources.ts';
import { withCubeLink } from './recipes.ts';
import { requireEsr, type DirectiveResolver } from './types.ts';

const SECRET = /^\[SECRET(\d+)\]\s*(.*)$/;
const RETURNED = '(the Ancient Scroll is returned)';
/** ESR 3.3 "[SECRET08] Crucible - …": a second forging with a Blacksmith perk, listed with the crucible forgings */
const CRUCIBLE = /^Crucible\b/;
/** ESR 3.3 perk copies of a recipe ("… - Jeweler 14 Special"): the same recipe, not another variant */
const PERK_SUFFIX = / - (?:Alchemy|Blacksmithing|Jeweler|Archaeology) \d+ Special$/;

/**
 * Secret recipes keyed by number (each one or more rows, see clusterVariants), in file order. Blockers (`void`
 * outputs: ESR 3.3's perk traps) and the "Crucible - …" second forgings (the Cube page's crucible family) are left
 * out; rows that need a specialisation perk (ESR 3.3 "… - Jeweler 14 Special") are their own rows, the perk in the note.
 */
export function collectSecretRecipes(esr: EsrGuideTables): Map<number, RecipeRow[]> {
  const groups = new Map<number, Map<string, { variants: RecipeVariant[]; plain: RecipeVariant[]; descriptions: string[] }>>();
  for (const row of esr.cube) {
    const match = SECRET.exec(row.description);
    if (match === null || CRUCIBLE.test(match[2]) || row.outputs.some((output) => output.spec === 'void')) continue;
    const number = Number(match[1]);
    const perk = (esr.perkChecks?.(row) ?? [])
      .filter((check) => check.has)
      .map(perkCheckText)
      .join('; ');
    const byPerk = groups.get(number) ?? new Map<string, { variants: RecipeVariant[]; plain: RecipeVariant[]; descriptions: string[] }>();
    groups.set(number, byPerk);
    const group = byPerk.get(perk) ?? { variants: [], plain: [], descriptions: [] };
    byPerk.set(perk, group);
    // An output identical to an input (the Ancient Scroll) is returned unchanged; the caption says so instead.
    const outputs = row.outputs.filter((output) => !row.inputs.includes(output.spec));
    const inputs = row.inputs.map((input) => formatInput(input, esr));
    group.variants.push({ inputs, output: outputs.map((output) => formatOutput(output, esr)).join(' + ') });
    group.plain.push({ inputs, output: outputs.map((output) => formatOutput(output, esr, { bonus: false })).join(' + ') });
    group.descriptions.push(match[2].trim().replace(PERK_SUFFIX, ''));
  }

  const recipes = new Map<number, RecipeRow[]>();
  for (const [number, byPerk] of groups) {
    // The txt descriptions are dev labels ("Socket(4) Weapon: High-Q …"); players only see the recipe number.
    const descriptions = distinct([...byPerk.values()].flatMap((group) => group.descriptions));
    const more = descriptions.length - 1;
    const first = `#${String(number)}${more > 0 ? ` (+${String(more)} variant${more > 1 ? 's' : ''})` : ''}`;
    const rows = [...byPerk].flatMap(([perk, group], g) =>
      // With the bonus (level requirement, experience, gold …) unless it splits a recipe past the rows shown (#22)
      capGroup(clusterWithBonus(group.variants, group.plain), (i) => {
        const label = g === 0 && i === 0 ? first : `#${String(number)}`;
        return perk === '' ? label : `${label}: ${perk}`;
      })
    );
    recipes.set(number, rows);
  }
  return recipes;
}

export const resolveSecretRecipes: DirectiveResolver = (arg, ctx) => {
  if (arg !== null) return { error: '::secret-recipes takes no argument (use ::secret-recipe[N] for one recipe)' };
  const esr = requireEsr(ctx, 'secret-recipes');
  if ('error' in esr) return esr;
  const recipes = collectSecretRecipes(esr);
  if (recipes.size === 0) return { error: '::secret-recipes found no [SECRETnn] rows in cubemain.txt' };
  return withCubeLink({ kind: 'recipes', caption: `Secret recipes ${RETURNED}`, rows: [...recipes.values()].flat() }, 'secret', esr);
};

export const resolveSecretRecipe: DirectiveResolver = (arg, ctx) => {
  const number = Number(arg ?? '');
  if (arg === null || !Number.isInteger(number) || number <= 0)
    return { error: `::secret-recipe needs a recipe number, e.g. ::secret-recipe[50]` };
  const esr = requireEsr(ctx, 'secret-recipe');
  if ('error' in esr) return esr;
  const recipe = collectSecretRecipes(esr).get(number);
  if (recipe === undefined) return { error: `::secret-recipe[${arg}]: no [SECRET${arg.padStart(2, '0')}] rows in cubemain.txt` };
  return { kind: 'recipes', caption: `Secret recipe ${String(number)} ${RETURNED}`, rows: recipe };
};

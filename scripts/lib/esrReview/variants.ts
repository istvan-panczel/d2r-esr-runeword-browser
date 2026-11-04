/**
 * Runeword and gemword variants: the app's ids are `<name>:<variant>`, the variant being the page order of the rows with
 * that name (runewordsParser.ts / gemwordsParser.ts). Favourites (`runeword:<name>:<n>`) and build slots store them, so
 * a row inserted before an existing one, a changed recipe or a vanished row retargets them silently.
 */
import { capLines, finding, info, ok, type Check } from './report.ts';

export interface ParsedRecipe {
  name: string;
  variant: number;
  ingredients: readonly string[];
  sockets: number;
  socketsMax?: number;
  jewelInfo?: string;
}

/** What a favourite or build slot means by the variant: the ingredients and sockets. */
export function recipeSignature(recipe: ParsedRecipe): string {
  const sockets = recipe.socketsMax === undefined ? String(recipe.sockets) : `${String(recipe.sockets)}-${String(recipe.socketsMax)}`;
  const jewels = recipe.jewelInfo === undefined || recipe.jewelInfo === '' ? '' : `, ${recipe.jewelInfo}`;
  return `${recipe.ingredients.join(' + ')} (${sockets} sockets${jewels})`;
}

/** `name:variant` → signature; repeated identical rows (gemwords list some per socket count) keep the first. */
export function variantMap(recipes: readonly ParsedRecipe[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const recipe of recipes) {
    const id = `${recipe.name}:${String(recipe.variant)}`;
    if (!map.has(id)) map.set(id, recipeSignature(recipe));
  }
  return map;
}

export function variantsCheck(
  kind: 'runeword' | 'gemword',
  before: ReadonlyMap<string, string> | null,
  after: ReadonlyMap<string, string>,
  source: string
): Check {
  const id = `variants.${kind}s`;
  const title = `${kind === 'runeword' ? 'Runeword' : 'Gemword'} variants`;
  if (before === null) return info(id, title, `No old ${kind}s page to compare with (${source}).`);
  const changed: string[] = [];
  for (const [key, signature] of before) {
    const now = after.get(key);
    if (now !== signature) changed.push(`${kind}:${key}: ${signature} → ${now ?? '(gone)'}`);
  }
  const added = [...after.keys()].filter((key) => !before.has(key)).map((key) => `+ ${kind}:${key}: ${after.get(key) ?? ''}`);
  if (changed.length > 0) {
    return finding(
      id,
      title,
      `${String(changed.length)} ${kind} variants changed recipe or vanished (${String(before.size)} → ${String(after.size)}; old page: ${source})`,
      `favourites (${kind}:<name>:<n>, public counts included) and build slots store the variant, so they now point at another recipe or at nothing`,
      capLines([...changed, ...added])
    );
  }
  if (added.length > 0)
    return info(
      id,
      title,
      `${String(added.length)} variants added after the existing ones; none moved (old page: ${source}).`,
      capLines(added)
    );
  return ok(id, title, `All ${String(after.size)} variants unchanged (old page: ${source}).`);
}

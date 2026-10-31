import type { Runeword } from '@/core/db/models';

/** The recipe's runes and gems in order (old cached rows without `ingredients` fall back to the runes). */
function ingredientsOf(runeword: Pick<Runeword, 'runes'> & Partial<Pick<Runeword, 'ingredients'>>): readonly string[] {
  return runeword.ingredients !== undefined && runeword.ingredients.length > 0 ? runeword.ingredients : runeword.runes;
}

/** Same runeword, same runes / gems: the rows ESR adds per jewel count share it. */
function recipeKey(runeword: Runeword): string {
  return JSON.stringify([runeword.name, ingredientsOf(runeword)]);
}

/**
 * Everything a card shows except the jewel-count bookkeeping (`variant`, `sockets`, `socketsMax`, `jewelInfo`). The
 * other fields (`reqLevel`, `sortKey`, `isLod`, `tierPointTotals`) follow from the runes and gems.
 */
function contentKey(runeword: Runeword): string {
  return JSON.stringify([
    runeword.name,
    ingredientsOf(runeword),
    runeword.runes,
    runeword.gems,
    runeword.allowedItems,
    runeword.excludedItems,
    runeword.affixes,
    runeword.columnAffixes,
  ]);
}

/** The jewel info text in the parser's formats: "(0-3) Jewels" for a range, "(1) Jewel" / "(2) Jewels" for a count. */
export function formatJewelInfo(minJewels: number, maxJewels: number): string | undefined {
  if (maxJewels <= 0) return undefined;
  if (minJewels === maxJewels) return `(${String(maxJewels)}) Jewel${maxJewels > 1 ? 's' : ''}`;
  return `(${String(minJewels)}-${String(maxJewels)}) Jewels`;
}

/**
 * Folds the rows a jewel recipe has per jewel count into one entry per distinct content, for the runewords list.
 *
 * The game has no optional sockets, so ESR adds one runes.txt row per jewel count (jewels first: `r93 r33 r43`,
 * `jew r93 r33 r43`, `jew jew …`, plus the same with `mjw`). The site shows a range row ("(3-6 Socket)",
 * "(0-3) Jewels", the no-jewel recipe) followed by one row per count ("(4 Socket)" with a "Jewel" line, …). Rows of the
 * same runeword with the same content become one entry: the lowest variant (so favourites keep its id) with the
 * group's socket range and jewel counts. A range row only covers the counts no per-count row of its recipe lists, so
 * when those rows differ (Tourbillion, Wooden Colossus) its own `socketsMax` does not leak into its entry. Order is
 * kept (each entry at its first row's place); rows without jewels pass through unchanged. Display only: the database
 * keeps every row, and builds / guide refs use `[name, variant]`.
 */
export function foldJewelVariants(runewords: readonly Runeword[]): Runeword[] {
  const socketCountsByRecipe = new Map<string, number[]>();
  for (const runeword of runewords) {
    const key = recipeKey(runeword);
    const counts = socketCountsByRecipe.get(key) ?? [];
    counts.push(runeword.sockets);
    socketCountsByRecipe.set(key, counts);
  }

  /** The most sockets a row stands for: its range, unless per-count rows of its recipe list the higher counts. */
  const coveredMax = (runeword: Runeword): number => {
    const { sockets, socketsMax } = runeword;
    if (socketsMax === undefined) return sockets;
    const counts = socketCountsByRecipe.get(recipeKey(runeword)) ?? [];
    return counts.some((count) => count > sockets && count <= socketsMax) ? sockets : socketsMax;
  };

  const groups = new Map<string, Runeword[]>();
  for (const runeword of runewords) {
    const key = contentKey(runeword);
    const group = groups.get(key) ?? [];
    group.push(runeword);
    groups.set(key, group);
  }

  const result: Runeword[] = [];
  for (const group of groups.values()) {
    // Groups are never empty (each starts with the row that created it)
    const representative = group.reduce((lowest, runeword) => (runeword.variant < lowest.variant ? runeword : lowest));
    const min = Math.min(...group.map((runeword) => runeword.sockets));
    const max = Math.max(...group.map(coveredMax));
    if (group.length === 1 && min === representative.sockets && max === (representative.socketsMax ?? representative.sockets)) {
      result.push(representative);
      continue;
    }
    const ingredientCount = ingredientsOf(representative).length;
    const jewelInfo = formatJewelInfo(Math.max(0, min - ingredientCount), Math.max(0, max - ingredientCount));
    const { socketsMax: _socketsMax, jewelInfo: _jewelInfo, ...fields } = representative;
    result.push({ ...fields, sockets: min, ...(max > min && { socketsMax: max }), ...(jewelInfo !== undefined && { jewelInfo }) });
  }
  return result;
}

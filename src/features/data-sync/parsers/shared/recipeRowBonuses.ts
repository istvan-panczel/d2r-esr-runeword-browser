import type { Affix, BonusPool, ColumnBonusPools, SocketableBonusGroup, SocketableBonuses } from '@/core/db';
import { BONUS_CATEGORIES, getItemCategory, getRelevantCategories, type BonusCategory } from '@/core/utils/itemCategoryMapping';
import { parseRecipeAffixes, parseRecipeBonusesCell, parseRecipeBonusPools, parseSocketableBonusGroups } from './parserUtils';

/**
 * The two layouts of the runewords.htm / gemwords.htm recipe table:
 * - `columns` (before ESR 3.3): 6 cells — name, ingredients, allowed items, then one bonus column per item category
 *   ("Weapons / Gloves", "Helms / Boots", "Armor / Shields / Belts"), each holding
 *   [recipe bonuses]<br><br>[pools]...<br><br>[rune / gem bonuses]; columns that no allowed base uses are empty.
 * - `socketable-bonuses` (ESR 3.3+): 5 cells — name (now with "Req Lvl: N"), ingredients, allowed items, "Bonuses"
 *   (the recipe's own bonuses and pools, the same for every base) and "Socketable Bonuses" (the rune / gem bonuses,
 *   one list or one group per item-type label).
 */
export type RecipeTableLayout = 'columns' | 'socketable-bonuses';

/** The layout of a recipe row by its cell count (the header row says the same: "Weapons / Gloves" vs "Bonuses"). */
export function recipeRowLayout(cells: ArrayLike<Element>): RecipeTableLayout | null {
  if (cells.length >= 6) return 'columns';
  if (cells.length === 5) return 'socketable-bonuses';
  return null;
}

export interface RecipeRowBonuses {
  readonly affixes: Affix[];
  readonly columnAffixes: SocketableBonuses;
  readonly columnBonusPools: ColumnBonusPools;
  /** Only for the ESR 3.3+ layout */
  readonly socketableBonuses?: SocketableBonusGroup[];
}

function perCategory<T>(valueFor: (category: BonusCategory) => T): Record<BonusCategory, T> {
  return { weaponsGloves: valueFor('weaponsGloves'), helmsBoots: valueFor('helmsBoots'), armorShieldsBelts: valueFor('armorShieldsBelts') };
}

/** Legacy: the first non-empty column. */
function firstNonEmpty<T>(columns: Record<BonusCategory, readonly T[]>): T[] {
  return [...(BONUS_CATEGORIES.map((category) => columns[category]).find((column) => column.length > 0) ?? [])];
}

/**
 * The item categories (gems.htm columns) a row's bases use: the categories of its socketable bonus groups' item types,
 * or for an unlabelled group the categories of its allowed items (all three when none is known).
 */
export function socketableBonusCategories(groups: readonly SocketableBonusGroup[], allowedItems: readonly string[]): Set<BonusCategory> {
  const fromGroups = groups
    .flatMap((group) => group.itemTypes.map((type) => getItemCategory(type.name)))
    .filter((category) => category !== null);
  if (fromGroups.length > 0) return new Set(fromGroups);
  const fromItems = getRelevantCategories(allowedItems);
  return new Set(fromItems.length > 0 ? fromItems : BONUS_CATEGORIES);
}

/**
 * The recipe's own bonuses (and random bonus pools) of a runewords.htm / gemwords.htm row in either layout.
 *
 * `columnAffixes` / `columnBonusPools` keep the pre-3.3 shape: in the ESR 3.3 layout the one "Bonuses" list goes into
 * every category the row's bases use and the others stay empty, as the old per-category columns were. So builds saved
 * with old data (whose snapshots hold the columns) do not all read as changed. `socketableBonuses` holds the
 * "Socketable Bonuses" groups (3.3+ only).
 */
export function extractRecipeRowBonuses(cells: ArrayLike<Element>, allowedItems: readonly string[]): RecipeRowBonuses {
  if (recipeRowLayout(cells) === 'columns') {
    const columnAffixes = perCategory((category) => parseRecipeAffixes(cells[3 + BONUS_CATEGORIES.indexOf(category)]));
    const columnBonusPools = perCategory((category) => parseRecipeBonusPools(cells[3 + BONUS_CATEGORIES.indexOf(category)]));
    return { affixes: firstNonEmpty(columnAffixes), columnAffixes, columnBonusPools };
  }

  const { affixes, pools } = parseRecipeBonusesCell(cells[3]);
  const socketableBonuses = parseSocketableBonusGroups(cells[4]);
  const categories = socketableBonusCategories(socketableBonuses, allowedItems);
  return {
    affixes,
    columnAffixes: perCategory((category): Affix[] => (categories.has(category) ? affixes : [])),
    columnBonusPools: perCategory((category): BonusPool[] => (categories.has(category) ? pools : [])),
    socketableBonuses,
  };
}

/**
 * stash.json: what the shared stash (.d2i) parser (src/features/stash/parser) needs to walk the item bits. Items have
 * no length prefix, so every field of every item has to be read: the stat widths (itemstatcost.txt), which codes are
 * armor / weapons / charms / … (the item tables + the itemtypes.txt hierarchy), the inventory size of each code and the
 * stash page grid (inventory.txt). The Ancient Coupons are listed with their names and cube recipes (cubemain.txt:
 * how many coupons, or fewer coupons plus Wild Cards, make which unique) for the My Stash coupons page.
 */
import {
  STASH_ITEM_FLAGS,
  type StashBundle,
  type StashCoupon,
  type StashCouponTier,
  type StashCouponUnique,
  type StashItemInfo,
  type StashStatInfo,
} from '../engine/schema.ts';
import type { BuildResult } from './bundleTypes.ts';
import { isAncientCouponName, readCouponRecipes } from './coupons.ts';
import { resolveName } from './itemNames.ts';
import type { TsvTable } from './tsv.ts';

export interface StashInput {
  /** Parsed with `keepExpansionRows`: the row number is the stat id */
  itemstatcost: TsvTable;
  itemtypes: TsvTable;
  weapons: TsvTable;
  armor: TsvTable;
  misc: TsvTable;
  inventory: TsvTable;
  cubemain: TsvTable;
  /** Parsed with `keepExpansionRows`: the row number is the unique id a save stores */
  uniqueitems: TsvTable;
}

/** inventory.txt row of the shared stash page (the expansion "Big Bank"; "Bank Page 1" is the classic one) */
const STASH_PAGE_ROW = 'Big Bank Page 1';
const WILD_CARD_NAME = 'Coupon Wild Card';
/** itemtypes.txt names the coupon types "Coupon norm", "Coupon excep", "Coupon elite" */
const TIER_LABELS: Readonly<Record<string, string>> = { norm: 'Normal', excep: 'Exceptional', elite: 'Elite' };

function tierLabel(itemTypeName: string): string {
  const suffix = itemTypeName
    .replace(/^Coupon\s+/i, '')
    .trim()
    .toLowerCase();
  return TIER_LABELS[suffix] ?? itemTypeName;
}

/**
 * The first uniqueitems.txt row of each `index` with a base code (what a cube output ref resolves to); `named` is false
 * when the string table has no name for the index (the name is then the index itself).
 */
function uniquesByIndex(uniqueitems: TsvTable, strings: ReadonlyMap<string, string>): Map<string, StashCouponUnique & { named: boolean }> {
  const byIndex = new Map<string, StashCouponUnique & { named: boolean }>();
  uniqueitems.rows.forEach((row, id) => {
    const index = row.str('index');
    if (index === '' || row.str('code') === '' || byIndex.has(index)) return;
    const name = resolveName(strings, index, '');
    byIndex.set(index, { id, name: name === '' ? index : name, named: name !== '' });
  });
  return byIndex;
}

/** The unique a coupon's own name gives: "Ancient Coupon (Crystal Sword, Azurewrath)" → "Azurewrath"; null without one. */
export function uniqueNameOfCoupon(couponName: string): string | null {
  const inner = /\(([^()]*)\)\s*$/.exec(couponName)?.[1];
  const name = inner?.split(',').at(-1)?.trim() ?? '';
  return name === '' ? null : name;
}

/** Every type code that is `root` or descends from it through Equiv1 / Equiv2. */
function descendantsOf(root: string, parents: ReadonlyMap<string, readonly string[]>): Set<string> {
  const result = new Set<string>();
  const isDescendant = (code: string, seen: Set<string>): boolean => {
    if (code === root) return true;
    if (seen.has(code)) return false;
    seen.add(code);
    return (parents.get(code) ?? []).some((parent) => isDescendant(parent, seen));
  };
  for (const code of parents.keys()) if (isDescendant(code, new Set())) result.add(code);
  return result;
}

export function buildStashBundle(input: StashInput, strings: ReadonlyMap<string, string>): BuildResult<StashBundle> {
  const warnings: string[] = [];

  const stats: (StashStatInfo | null)[] = input.itemstatcost.rows.map((row) => {
    const bits = row.num('Save Bits');
    return bits > 0 ? [bits, row.num('Save Add'), row.num('Save Param Bits') > 0 ? 1 : 0] : null;
  });

  const parents = new Map<string, string[]>();
  for (const row of input.itemtypes.rows) {
    const code = row.str('Code');
    if (code !== '') parents.set(code, row.list('Equiv', 2));
  }
  const kinds = {
    armor: descendantsOf('armo', parents),
    weapon: descendantsOf('weap', parents),
    gold: descendantsOf('gold', parents),
    charm: descendantsOf('char', parents),
    body: descendantsOf('body', parents),
    playerBody: descendantsOf('play', parents),
    scroll: descendantsOf('scro', parents),
    book: descendantsOf('book', parents),
  };

  // Like the game, only the `type` column decides (not `type2`)
  const items: StashItemInfo[] = [];
  const seen = new Set<string>();
  for (const table of [input.weapons, input.armor, input.misc]) {
    for (const row of table.rows) {
      const code = row.str('code');
      if (code === '' || seen.has(code)) continue;
      seen.add(code);
      const type = row.str('type');
      let flags = 0;
      if (kinds.armor.has(type)) flags |= STASH_ITEM_FLAGS.armor;
      if (kinds.weapon.has(type)) flags |= STASH_ITEM_FLAGS.weapon;
      if (kinds.gold.has(type)) flags |= STASH_ITEM_FLAGS.gold;
      if (kinds.charm.has(type)) flags |= STASH_ITEM_FLAGS.charm;
      if (kinds.body.has(type) && !kinds.playerBody.has(type)) flags |= STASH_ITEM_FLAGS.bodyPart;
      if (kinds.scroll.has(type) || kinds.book.has(type)) flags |= STASH_ITEM_FLAGS.scrollOrBook;
      if (row.num('quest') !== 0 && row.has('questdiffcheck') && row.num('questdiffcheck') !== 0) flags |= STASH_ITEM_FLAGS.questDifficulty;
      items.push([code, flags, row.num('invwidth'), row.num('invheight')]);
    }
  }

  const couponRows = input.misc.rows.filter((row) => {
    const name = row.str('name');
    return row.str('code') !== '' && (isAncientCouponName(name) || name === WILD_CARD_NAME);
  });
  const wildCardCode = couponRows.find((row) => row.str('name') === WILD_CARD_NAME)?.str('code') ?? '';
  if (wildCardCode === '') warnings.push(`stash: misc.txt has no "${WILD_CARD_NAME}" row; no Wild Card recipes`);
  const ancientRows = couponRows.filter((row) => row.str('name') !== WILD_CARD_NAME);
  const couponTypes = new Set(ancientRows.map((row) => row.str('type')));
  const recipes = readCouponRecipes(input.cubemain, new Set(ancientRows.map((row) => row.str('code'))), couponTypes, wildCardCode);
  const uniques = uniquesByIndex(input.uniqueitems, strings);

  const coupons: StashCoupon[] = [];
  for (const row of couponRows) {
    const name = row.str('name');
    const code = row.str('code');
    const coupon: StashCoupon = { code, name: resolveName(strings, row.str('namestr'), name), type: row.str('type') };
    if (name === WILD_CARD_NAME) {
      coupon.wildCard = true;
    } else {
      const codeRecipes = recipes.byCode.get(code) ?? [];
      const plain = codeRecipes.filter((recipe) => recipe.wildCards === 0);
      const recipe = plain.at(0);
      if (plain.length > 1) warnings.push(`stash: coupon ${code} has ${String(plain.length)} coupon-only recipes; the first one counts`);
      const unique = recipe === undefined ? undefined : uniques.get(recipe.output);
      if (recipe !== undefined && unique === undefined) {
        warnings.push(`stash: coupon ${code} makes "${recipe.output}" (cubemain line ${String(recipe.line)}), which is no unique`);
      }
      if (recipe !== undefined && unique !== undefined) {
        // A unique without a string (ESR 3.2.24: "Azurewrath_old", the Crystal Sword Azurewrath) is named after the coupon
        const fallback = unique.named ? null : uniqueNameOfCoupon(coupon.name);
        if (fallback !== null)
          warnings.push(
            `stash: unique "${unique.name}" (row ${String(unique.id)}) has no string; named "${fallback}" after coupon ${code}`
          );
        coupon.unique = { id: unique.id, name: fallback ?? unique.name };
        coupon.qty = recipe.qty;
        const alternative =
          codeRecipes.find((other) => other.wildCards > 0 && other.output === recipe.output) ??
          codeRecipes.find((other) => other.wildCards > 0);
        if (alternative !== undefined) {
          coupon.withWildCards = { qty: alternative.qty, wildCards: alternative.wildCards };
          // The game matches numinputs against the cube's item count, so such a row most likely never fires
          if (alternative.numInputs !== alternative.qty + alternative.wildCards) coupon.withWildCards.suspect = true;
        }
        for (const used of [recipe, alternative]) {
          if (used !== undefined && used.numInputs !== used.qty + used.wildCards) {
            warnings.push(
              `stash: coupon ${code} recipe (cubemain line ${String(used.line)}) has numinputs ${String(used.numInputs)} for ` +
                `${String(used.qty + used.wildCards)} items`
            );
          }
        }
      }
    }
    coupons.push(coupon);
  }

  const typeNames = new Map(input.itemtypes.rows.map((row) => [row.str('Code'), row.str('ItemType')]));
  const couponTiers: StashCouponTier[] = [...couponTypes].sort().map((type) => ({
    type,
    label: tierLabel(typeNames.get(type) ?? type),
    wildCardFrom: recipes.wildCardFrom.get(type) ?? null,
  }));

  const page = input.inventory.rows.find((row) => row.str('class') === STASH_PAGE_ROW);
  if (page === undefined) warnings.push(`stash: inventory.txt has no "${STASH_PAGE_ROW}" row; the grid defaults to 16 × 13`);
  const grid = page === undefined ? { width: 16, height: 13 } : { width: page.num('gridX'), height: page.num('gridY') };

  return { bundle: { grid, stats, items, coupons, couponTiers }, warnings };
}

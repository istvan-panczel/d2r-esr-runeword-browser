/**
 * stash.json: what the shared stash (.d2i) parser (src/features/stash/parser) needs to walk the item bits. Items have
 * no length prefix, so every field of every item has to be read: the stat widths (itemstatcost.txt), which codes are
 * armor / weapons / charms / … (the item tables + the itemtypes.txt hierarchy), the inventory size of each code and the
 * stash page grid (inventory.txt). The Ancient Coupons are listed with their names for the coupon finder.
 */
import { STASH_ITEM_FLAGS, type StashBundle, type StashCoupon, type StashItemInfo, type StashStatInfo } from '../engine/schema.ts';
import type { BuildResult } from './bundleTypes.ts';
import { isAncientCouponName } from './coupons.ts';
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
}

/** inventory.txt row of the shared stash page (the expansion "Big Bank"; "Bank Page 1" is the classic one) */
const STASH_PAGE_ROW = 'Big Bank Page 1';
const WILD_CARD_NAME = 'Coupon Wild Card';

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

  const coupons: StashCoupon[] = [];
  for (const row of input.misc.rows) {
    const name = row.str('name');
    const code = row.str('code');
    if (code === '' || !(isAncientCouponName(name) || name === WILD_CARD_NAME)) continue;
    const coupon: StashCoupon = { code, name: resolveName(strings, row.str('namestr'), name), type: row.str('type') };
    if (name === WILD_CARD_NAME) coupon.wildCard = true;
    coupons.push(coupon);
  }

  const page = input.inventory.rows.find((row) => row.str('class') === STASH_PAGE_ROW);
  if (page === undefined) warnings.push(`stash: inventory.txt has no "${STASH_PAGE_ROW}" row; the grid defaults to 16 × 13`);
  const grid = page === undefined ? { width: 16, height: 13 } : { width: page.num('gridX'), height: page.num('gridY') };

  return { bundle: { grid, stats, items, coupons }, warnings };
}

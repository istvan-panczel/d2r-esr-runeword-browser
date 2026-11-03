/**
 * Ancient Coupons and the cube recipes that use them, shared by the sources and loot-filter bundles. ESR's "coupon
 * uniques" are uniqueitems.txt rows that never roll as a drop (`rarity` 0) and are only cubed from Ancient Coupons.
 */
import { parseCubeCell } from './cube/cubeText.ts';
import { refOf } from './treasureClasses.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

/** cubemain.txt has `input 1` … `input 7` */
const CUBE_INPUT_COUNT = 7;
export const CUBE_INPUTS = Array.from({ length: CUBE_INPUT_COUNT }, (_, i) => `input ${String(i + 1)}`);
export const CUBE_OUTPUTS = ['output', 'output b', 'output c'] as const;

/** Ancient Coupons ("Coupon nor Armor 1", …); the Wild Card is a coupon-shaped joker also used for gem recipes. */
export function isAncientCouponName(name: string): boolean {
  return name.startsWith('Coupon ') && !name.includes('Wild Card');
}

/** misc.txt codes of the Ancient Coupons. */
export function ancientCouponCodes(misc: TsvTable): Set<string> {
  return new Set(
    misc.rows
      .filter((row) => isAncientCouponName(row.str('name')))
      .map((row) => row.str('code'))
      .filter((code) => code !== '')
  );
}

/** The refs (codes or unique/set `index` names) of a cubemain row's inputs. */
export function cubeInputRefs(row: TsvRow): string[] {
  return CUBE_INPUTS.filter((column) => row.has(column)).map((column) => refOf(row.str(column)));
}

/**
 * The output refs of every enabled cubemain row that takes an Ancient Coupon, except an output that is also one of
 * the row's inputs (a reroll does not create the item).
 */
export function couponCubeOutputs(cubemain: TsvTable, couponCodes: ReadonlySet<string>): Set<string> {
  const outputs = new Set<string>();
  for (const row of cubemain.rows) {
    if (row.num('enabled') !== 1) continue;
    const inputs = cubeInputRefs(row);
    if (!inputs.some((input) => couponCodes.has(input))) continue;
    for (const column of CUBE_OUTPUTS) {
      if (!row.has(column)) continue;
      const output = refOf(row.str(column));
      if (output !== '' && !inputs.includes(output)) outputs.add(output);
    }
  }
  return outputs;
}

/** A cube recipe that turns `qty` of one Ancient Coupon (and `wildCards` Coupon Wild Cards) into `output`. */
export interface CouponRecipe {
  /** Coupons of the one code the recipe takes */
  qty: number;
  /** Coupon Wild Cards it takes besides; 0 for the coupon-only recipe */
  wildCards: number;
  /** Output ref: the uniqueitems.txt `index` of the coupon unique */
  output: string;
  /** `numinputs`: the item count the game matches; it should equal qty + wildCards */
  numInputs: number;
  /** cubemain.txt line, for warnings */
  line: number;
}

export interface CouponRecipeIndex {
  /** By coupon code, in file order: the coupon-only recipes and the coupon + Wild Card ones */
  byCode: Map<string, CouponRecipe[]>;
  /** By coupon item type (cpn1 …): how many coupons of that type (any codes) make one Wild Card */
  wildCardFrom: Map<string, number>;
}

/** The non-blank input cells of a cubemain row, as code + qty (`"01c,qty=3"` → 01c × 3). */
function cubeInputCells(row: TsvRow): { code: string; qty: number }[] {
  return CUBE_INPUTS.filter((column) => row.has(column) && row.str(column) !== '').map((column) => {
    const cell = parseCubeCell(row.str(column).replace(/"/g, ''));
    return { code: cell.token, qty: cell.qty };
  });
}

/**
 * The Ancient Coupon recipes of cubemain.txt (enabled rows only): `qty` of one coupon code, optionally with Coupon Wild
 * Cards, makes the coupon unique; `qty` coupons of one coupon type make a Wild Card. Other coupon rows (the rerolls,
 * which take a `rnd` input, or rows whose output is one of the inputs) are not coupon recipes.
 */
export function readCouponRecipes(
  cubemain: TsvTable,
  couponCodes: ReadonlySet<string>,
  couponTypes: ReadonlySet<string>,
  wildCardCode: string
): CouponRecipeIndex {
  const byCode = new Map<string, CouponRecipe[]>();
  const wildCardFrom = new Map<string, number>();
  for (const row of cubemain.rows) {
    if (row.num('enabled') !== 1) continue;
    const inputs = cubeInputCells(row);
    const output = refOf(row.str('output'));
    if (output === '' || inputs.some((input) => input.code === output)) continue;
    const coupons = inputs.filter((input) => couponCodes.has(input.code));
    const wildCards = inputs.filter((input) => input.code === wildCardCode);
    const coupon = coupons.at(0);
    if (coupon !== undefined && coupons.length === 1 && coupons.length + wildCards.length === inputs.length) {
      const recipe = {
        qty: coupon.qty,
        wildCards: wildCards.reduce((sum, input) => sum + input.qty, 0),
        output,
        numInputs: row.num('numinputs'),
        line: row.line,
      };
      const list = byCode.get(coupon.code);
      if (list === undefined) byCode.set(coupon.code, [recipe]);
      else list.push(recipe);
      continue;
    }
    const typed = inputs.at(0);
    if (
      output === wildCardCode &&
      inputs.length === 1 &&
      typed !== undefined &&
      couponTypes.has(typed.code) &&
      !wildCardFrom.has(typed.code)
    ) {
      wildCardFrom.set(typed.code, typed.qty);
    }
  }
  return { byCode, wildCardFrom };
}

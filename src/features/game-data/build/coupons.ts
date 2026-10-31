/**
 * Ancient Coupons and the cube recipes that use them, shared by the sources and loot-filter bundles. ESR's "coupon
 * uniques" are uniqueitems.txt rows that never roll as a drop (`rarity` 0) and are only cubed from Ancient Coupons.
 */
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

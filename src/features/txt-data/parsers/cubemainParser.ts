import { parseTsv } from '@/core/utils/tsvParser';

/**
 * Parse cubemain.txt to extract Ancient Coupon unique item names.
 * Coupon recipes start with "Coupon" in the description column and
 * have the output unique item name in the "output" column.
 *
 * @param content - Raw TSV content from cubemain.txt
 * @returns Set of unique item names that can be obtained from Ancient Coupons
 */
export function parseAncientCouponItems(content: string): Set<string> {
  const rows = parseTsv(content);
  const couponItems = new Set<string>();

  for (const row of rows) {
    const description = row['description'].trim();
    const output = row['output'].trim();

    // Only process Coupon recipes with valid output names
    // Skip entries where output is a numeric code (like "01c")
    if (description === 'Coupon' && output && !/^\d/.test(output)) {
      couponItems.add(output);
    }
  }

  return couponItems;
}

// The build detail page keeps the shown variant in `?variant=N` (1-based), so a shared link opens that variant.

export const VARIANT_PARAM = 'variant';

/** The 0-based variant index of a `?variant=` value; a missing, malformed or out-of-range value gives the first. */
export function variantIndexFromParam(raw: string | null, count: number): number {
  if (raw === null || !/^\d+$/.test(raw)) return 0;
  const number = Number(raw);
  return number >= 1 && number <= count ? number - 1 : 0;
}

/** The `?variant=` value of a 0-based index; null for the first variant, which needs no parameter. */
export function variantParamValue(index: number): string | null {
  return index > 0 ? String(index + 1) : null;
}

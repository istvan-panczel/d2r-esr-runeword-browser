/**
 * The modifier reference an item line carries (see `modifierRefs.ts`), and its `data-mod-ref` attribute form. Kept free
 * of imports: the app shell's peek layer reads the attribute without loading the modifier data.
 */

export interface ModifierRef {
  /** The /modifiers entry key (`?kind=`): a content key ("resists") or a key kind ("replenish-life") */
  readonly key: string;
  /** The modifiers.json kind of the line when the entry covers several ("magic-resist" in "resists") */
  readonly kind?: string;
  /** The line's first number as [min, max] (a rolled range "(5 to 8)" → [5, 8]); absent on lines without one */
  readonly value?: readonly [number, number];
  /** The line is a per-level stat ("(Based on Character Level)"): its number is not the effective value */
  readonly perLevel?: true;
}

/** The anchor attribute (`data-mod-ref`) that carries a reference */
export const MODIFIER_REF_ATTRIBUTE = 'data-mod-ref';
export const MODIFIER_REF_SELECTOR = `[${MODIFIER_REF_ATTRIBUTE}]`;

export function encodeModifierRef(ref: ModifierRef): string {
  return JSON.stringify(ref);
}

function isValue(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

/** The reference of an anchor attribute; null for anything that is not one */
export function decodeModifierRef(value: string | undefined): ModifierRef | null {
  if (value === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { key, kind, value: number, perLevel } = parsed as Record<string, unknown>;
  if (typeof key !== 'string' || key === '') return null;
  if (kind !== undefined && (typeof kind !== 'string' || kind === '')) return null;
  if (number !== undefined && !isValue(number)) return null;
  if (perLevel !== undefined && perLevel !== true) return null;
  return {
    key,
    ...(kind === undefined ? {} : { kind }),
    ...(number === undefined ? {} : { value: [number[0], number[1]] as const }),
    ...(perLevel === true ? { perLevel } : {}),
  };
}

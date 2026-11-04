// Pure helpers for build variants: the top level of build_data is the first variant and `variants`
// holds the rest (see BuildData). The editor and detail page work on a flat list of VariantData.

import type { AlternativesMap, BuildData, CraftAnnotation, ItemAlternative, ItemRef, VariantData } from '../buildData';
import { DEFAULT_VARIANT_NAME, VARIANTS_MAX } from '../constants';
import { compactItems } from './buildSnapshot';
import { hasCrafts } from './crafts';
import { hasSkillPoints } from './skillTree';

/** A variant without the `variants` key (one level of nesting only). */
function withoutVariants(data: BuildData): VariantData {
  const { variants: _variants, ...variant } = data;
  return variant;
}

/** The flat variant list of a build: the top level first, then `variants` in order. */
export function unpackVariants(buildData: BuildData): VariantData[] {
  return [withoutVariants(buildData), ...(buildData.variants ?? [])];
}

/**
 * The stored shape of a variant list: `list[0]` at the top level, the rest (at most VARIANTS_MAX - 1) in
 * `variants`, omitted when there are none. Empty-main slots are normalised (normalizeSlotAlternatives). A lone
 * variant named DEFAULT_VARIANT_NAME loses the name, so a single-variant build saves exactly as before variants.
 */
export function packVariants(list: readonly VariantData[]): BuildData {
  if (list.length === 0) return {};
  const [first, ...rest] = list.map((variant) => normalizeSlotAlternatives(withoutVariants(variant)));
  const extra = rest.slice(0, VARIANTS_MAX - 1);
  const top = extra.length === 0 && first.variantName === DEFAULT_VARIANT_NAME ? withoutName(first) : first;
  return extra.length > 0 ? { ...top, variants: extra } : top;
}

function withoutName(variant: VariantData): VariantData {
  const { variantName: _variantName, ...rest } = variant;
  return rest;
}

/** The display name of a variant: its stored name, else "Default" for the first and "Variant N" for the others. */
export function variantLabel(variant: VariantData, index: number): string {
  return variant.variantName ?? (index === 0 ? DEFAULT_VARIANT_NAME : `Variant ${String(index + 1)}`);
}

/** The number of variants a build holds (at least one: the top level). */
export function variantCount(buildData: BuildData): number {
  return 1 + (buildData.variants?.length ?? 0);
}

/** The variant at `index`, clamped to the build's range (a non-integer index gives the first). */
export function variantAt(buildData: BuildData, index: number): VariantData {
  const list = unpackVariants(buildData);
  const clamped = Number.isInteger(index) ? Math.min(Math.max(index, 0), list.length - 1) : 0;
  return list[clamped];
}

interface SlotMaps<K extends string> {
  readonly items: Partial<Record<K, ItemRef | null>> | undefined;
  readonly notes: Partial<Record<K, string>> | undefined;
  readonly crafts: Partial<Record<K, readonly CraftAnnotation[]>> | undefined;
  readonly alternatives: AlternativesMap<K> | undefined;
}

function nonEmpty<T extends object>(map: T): T | undefined {
  return Object.keys(map).length > 0 ? map : undefined;
}

/** A copy of `map` with `slot` set to `value`, or without `slot` when `value` is undefined. */
function withSlot<K extends string, V>(map: Partial<Record<K, V>>, slot: K, value: V | undefined): Partial<Record<K, V>> {
  const rest = Object.fromEntries(Object.entries(map).filter(([key]) => key !== slot)) as Partial<Record<K, V>>;
  return value === undefined ? rest : { ...rest, [slot]: value };
}

/**
 * Promotes the first alternative of every slot without a main item (with its note and crafts, replacing the
 * slot's), and drops empty alternative lists. Null when nothing changes.
 */
function promoteSection<K extends string>(maps: SlotMaps<K>): SlotMaps<K> | null {
  const { alternatives } = maps;
  if (alternatives === undefined) return null;
  const slots = Object.keys(alternatives) as K[];
  const needsWork =
    slots.length === 0 ||
    slots.some((slot) => {
      const list = alternatives[slot];
      return list === undefined || list.length === 0 || !maps.items?.[slot];
    });
  if (!needsWork) return null;
  const items: Partial<Record<K, ItemRef | null>> = { ...maps.items };
  let notes: Partial<Record<K, string>> = { ...maps.notes };
  let crafts: Partial<Record<K, readonly CraftAnnotation[]>> = { ...maps.crafts };
  const kept: Partial<Record<K, readonly ItemAlternative[]>> = {};
  for (const slot of slots) {
    const list = alternatives[slot] ?? [];
    if (list.length === 0) continue;
    if (items[slot]) {
      kept[slot] = list;
      continue;
    }
    const [promoted, ...others] = list;
    items[slot] = promoted.ref;
    notes = withSlot(notes, slot, promoted.note);
    crafts = withSlot(crafts, slot, promoted.crafts);
    if (others.length > 0) kept[slot] = others;
  }
  return { items: nonEmpty(items), notes: nonEmpty(notes), crafts: nonEmpty(crafts), alternatives: nonEmpty(kept) };
}

/**
 * A slot with alternatives but no main item gets its first alternative as the main item, together with that
 * alternative's note and crafts (they replace the slot-keyed ones). Empty alternative lists and maps are dropped.
 * Returns the same object when nothing changes.
 */
export function normalizeSlotAlternatives(variant: VariantData): VariantData {
  const player = promoteSection({
    items: variant.items,
    notes: variant.itemNotes,
    crafts: variant.itemCrafts,
    alternatives: variant.itemAlternatives,
  });
  const swap = promoteSection({
    items: variant.weaponSwap,
    notes: variant.weaponSwapNotes,
    crafts: variant.weaponSwapCrafts,
    alternatives: variant.weaponSwapAlternatives,
  });
  const merc = promoteSection({
    items: variant.mercenary,
    notes: variant.mercenaryNotes,
    crafts: variant.mercenaryCrafts,
    alternatives: variant.mercenaryAlternatives,
  });
  if (player === null && swap === null && merc === null) return variant;
  const merged: VariantData = {
    ...variant,
    ...(player !== null
      ? { items: player.items, itemNotes: player.notes, itemCrafts: player.crafts, itemAlternatives: player.alternatives }
      : {}),
    ...(swap !== null
      ? { weaponSwap: swap.items, weaponSwapNotes: swap.notes, weaponSwapCrafts: swap.crafts, weaponSwapAlternatives: swap.alternatives }
      : {}),
    ...(merc !== null
      ? { mercenary: merc.items, mercenaryNotes: merc.notes, mercenaryCrafts: merc.crafts, mercenaryAlternatives: merc.alternatives }
      : {}),
  };
  // Emptied maps are dropped rather than stored as undefined keys.
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));
}

const hasText = (value: string | null | undefined): boolean => value !== null && value !== undefined && value.trim().length > 0;

function hasAlternatives(map: AlternativesMap<string> | undefined): boolean {
  return map !== undefined && Object.values(map).some((list) => list !== undefined && list.length > 0);
}

function hasAlternativeCrafts(map: AlternativesMap<string> | undefined): boolean {
  return (
    map !== undefined &&
    Object.values(map).some((list) => list?.some((alternative) => alternative.crafts !== undefined && alternative.crafts.length > 0))
  );
}

/** Whether any slot of the variant (main item or alternative) carries a crafting annotation (gates the crafting bundles). */
export function variantHasCrafts(variant: VariantData): boolean {
  return (
    hasCrafts(variant.itemCrafts) ||
    hasCrafts(variant.weaponSwapCrafts) ||
    hasCrafts(variant.mercenaryCrafts) ||
    hasAlternativeCrafts(variant.itemAlternatives) ||
    hasAlternativeCrafts(variant.weaponSwapAlternatives) ||
    hasAlternativeCrafts(variant.mercenaryAlternatives)
  );
}

/** Whether the variant has anything for the Skills tab: skill text, a level or a skill point allocation. */
export function variantHasSkills(variant: VariantData): boolean {
  return hasText(variant.skills) || variant.level !== undefined || hasSkillPoints(variant.skillPoints);
}

/** Whether the variant has anything for the Mercenary tab: an item, an alternative, a note or a crafting annotation. */
export function variantHasMerc(variant: VariantData): boolean {
  return (
    Object.keys(compactItems(variant.mercenary ?? {})).length > 0 ||
    hasAlternatives(variant.mercenaryAlternatives) ||
    Object.values(variant.mercenaryNotes ?? {}).some(hasText) ||
    hasCrafts(variant.mercenaryCrafts)
  );
}

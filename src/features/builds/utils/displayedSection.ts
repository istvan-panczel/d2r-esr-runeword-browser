// The detail page can swap an alternative item into a slot (view only, never saved). These pure helpers apply
// those picks to one section (player gear, weapon swap or mercenary gear), so the grid, the set piece counts on
// the cards and the set bonuses all see the item that is shown.

import type { AlternativesMap, CraftAnnotation, EquipmentSlot, ItemAlternative, ItemRef } from '../buildData';
import type { ItemDiff } from './itemDiff';
import { setPieceCounts, type SectionItems } from './setBonuses';

/** The alternative shown per slot: an index into the slot's alternatives; absent or -1 is the main item. */
export type SlotPicks<K extends string> = Partial<Record<K, number>>;

/** What one section shows per slot: the item, its note, its crafts and its version diff. */
export interface SectionView<K extends string> {
  readonly items: Partial<Record<K, ItemRef | null>>;
  readonly notes: Partial<Record<K, string>> | undefined;
  readonly crafts: Partial<Record<K, readonly CraftAnnotation[]>> | undefined;
  /** Undefined while the diffs are not ready (no badges yet). */
  readonly diffs: Partial<Record<K, ItemDiff>> | undefined;
}

export interface DisplayedSectionInput<K extends string> extends SectionView<K> {
  readonly alternatives: AlternativesMap<K> | undefined;
  /** Index-aligned with `alternatives` (computeVariantItemDiffs); undefined while not ready. */
  readonly alternativeDiffs: Partial<Record<K, readonly ItemDiff[]>> | undefined;
  readonly picks: SlotPicks<K>;
}

export interface DisplayedSection<K extends string> extends SectionView<K> {
  /** The alternative index shown per slot; slots showing their main item are absent. */
  readonly shownIndex: SlotPicks<K>;
}

/** The alternative index a pick shows in a slot, or -1 (main) when the pick is absent, -1 or out of range. */
export function shownAlternative<K extends string>(
  alternatives: AlternativesMap<K> | undefined,
  slot: K,
  pick: number | undefined
): number {
  // Indexing a generic Partial record drops `| undefined` from the type, so it is spelled out.
  const list: readonly ItemAlternative[] | undefined = alternatives?.[slot];
  const count = list?.length ?? 0;
  return pick !== undefined && Number.isInteger(pick) && pick >= 0 && pick < count ? pick : -1;
}

/** A copy of `map` with `slot` set to `value`, or without `slot` when `value` is undefined. */
function withSlot<K extends string, V>(map: Partial<Record<K, V>> | undefined, slot: K, value: V | undefined): Partial<Record<K, V>> {
  const rest = Object.fromEntries(Object.entries(map ?? {}).filter(([key]) => key !== slot)) as Partial<Record<K, V>>;
  return value === undefined ? rest : { ...rest, [slot]: value };
}

/**
 * The section with the picks applied: a picked alternative replaces the slot's item, note, crafts and diff with its
 * own (an empty note or no crafts clears the main item's). Slots without a valid pick keep their main entry; with no
 * valid pick at all the input maps are returned as they are.
 */
export function displayedSection<K extends string>(input: DisplayedSectionInput<K>): DisplayedSection<K> {
  const { alternatives, alternativeDiffs, picks } = input;
  let items = input.items;
  let notes = input.notes;
  let crafts = input.crafts;
  let diffs = input.diffs;
  const shownIndex: SlotPicks<K> = {};
  for (const slot of Object.keys(picks) as K[]) {
    const index = shownAlternative(alternatives, slot, picks[slot]);
    const list: readonly ItemAlternative[] | undefined = alternatives?.[slot];
    if (index < 0 || list === undefined) continue;
    const alternative = list[index];
    shownIndex[slot] = index;
    items = { ...items, [slot]: alternative.ref };
    notes = withSlot(notes, slot, alternative.note);
    crafts = withSlot(crafts, slot, alternative.crafts);
    const slotDiffs: readonly ItemDiff[] | undefined = alternativeDiffs?.[slot];
    if (diffs !== undefined) diffs = withSlot(diffs, slot, index < (slotDiffs?.length ?? 0) ? slotDiffs?.[index] : undefined);
  }
  return { items, notes, crafts, diffs, shownIndex };
}

/** Whether any slot of the section has an alternative item. */
export function sectionHasAlternatives<K extends string>(alternatives: AlternativesMap<K> | undefined): boolean {
  return alternatives !== undefined && Object.values<readonly unknown[] | undefined>(alternatives).some((list) => (list?.length ?? 0) > 0);
}

/**
 * Set pieces the section would wear with `ref` in `slot` instead of what is shown there (for a set alternative
 * listed under "Show all", so its card marks the partial groups it would activate). Undefined for a non-set item.
 */
export function setPiecesIfWorn(items: SectionItems, slot: EquipmentSlot, ref: ItemRef): number | undefined {
  if (ref.type !== 'set') return undefined;
  return setPieceCounts({ ...items, [slot]: ref }).get(ref.snapshot.setId);
}

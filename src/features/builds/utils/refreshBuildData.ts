import type { AlternativesMap, BuildData, EquipmentSlot, ItemRef, VariantData, WeaponSwapSlot } from '../buildData';
import { resolveCurrentRef } from './itemDiff';

/**
 * Re-resolves one item reference against the current local data, rebuilding its
 * snapshot. Keeps the existing reference if the item no longer exists.
 */
async function refreshRef(ref: ItemRef): Promise<ItemRef> {
  return (await resolveCurrentRef(ref)) ?? ref;
}

async function refreshSection<K extends string>(
  section: Partial<Record<K, ItemRef | null>> | undefined
): Promise<Partial<Record<K, ItemRef>> | undefined> {
  if (section === undefined) return undefined;
  const entries = await Promise.all(
    (Object.keys(section) as K[]).map(async (slot) => {
      const ref = section[slot];
      return ref ? ([slot, await refreshRef(ref)] as const) : null;
    })
  );
  const result: Partial<Record<K, ItemRef>> = {};
  for (const entry of entries) {
    if (entry) result[entry[0]] = entry[1];
  }
  return result;
}

async function refreshAlternatives<K extends string>(section: AlternativesMap<K> | undefined): Promise<AlternativesMap<K> | undefined> {
  if (section === undefined) return undefined;
  const entries = await Promise.all(
    (Object.keys(section) as K[]).map(async (slot) => {
      const list = section[slot] ?? [];
      return [
        slot,
        await Promise.all(list.map(async (alternative) => ({ ...alternative, ref: await refreshRef(alternative.ref) }))),
      ] as const;
    })
  );
  const result: AlternativesMap<K> = {};
  for (const [slot, list] of entries) result[slot] = list;
  return result;
}

/**
 * Refreshes every item snapshot of one variant (main items and alternatives) to the current local ESR data.
 * Notes, crafts, charms, ascendancy, skills, level, skill points and the variant name / note are unchanged.
 */
export async function refreshVariant(variant: VariantData): Promise<VariantData> {
  const [items, weaponSwap, mercenary, itemAlternatives, weaponSwapAlternatives, mercenaryAlternatives] = await Promise.all([
    refreshSection<EquipmentSlot>(variant.items),
    refreshSection<WeaponSwapSlot>(variant.weaponSwap),
    refreshSection<EquipmentSlot>(variant.mercenary),
    refreshAlternatives<EquipmentSlot>(variant.itemAlternatives),
    refreshAlternatives<WeaponSwapSlot>(variant.weaponSwapAlternatives),
    refreshAlternatives<EquipmentSlot>(variant.mercenaryAlternatives),
  ]);
  return {
    ...variant,
    ...(items ? { items } : {}),
    ...(weaponSwap ? { weaponSwap } : {}),
    ...(mercenary ? { mercenary } : {}),
    ...(itemAlternatives ? { itemAlternatives } : {}),
    ...(weaponSwapAlternatives ? { weaponSwapAlternatives } : {}),
    ...(mercenaryAlternatives ? { mercenaryAlternatives } : {}),
  };
}

/**
 * Refreshes every item snapshot in a build (the top-level variant and every entry of `variants`) to the
 * current local ESR data, so an edit re-captures up-to-date stats (per the feature spec).
 */
export async function refreshBuildData(buildData: BuildData): Promise<BuildData> {
  const [top, variants] = await Promise.all([
    refreshVariant(buildData),
    buildData.variants ? Promise.all(buildData.variants.map(refreshVariant)) : Promise.resolve(undefined),
  ]);
  return { ...top, ...(variants ? { variants } : {}) };
}

import type { BuildData, EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
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

/**
 * Refreshes every item snapshot in a build to the current local ESR data, so an
 * edit re-captures up-to-date stats (per the feature spec). Charms, ascendancy,
 * and skills are unchanged.
 */
export async function refreshBuildData(buildData: BuildData): Promise<BuildData> {
  const [items, weaponSwap, mercenary] = await Promise.all([
    refreshSection<EquipmentSlot>(buildData.items),
    refreshSection<WeaponSwapSlot>(buildData.weaponSwap),
    refreshSection<EquipmentSlot>(buildData.mercenary),
  ]);
  return {
    ...buildData,
    ...(items ? { items } : {}),
    ...(weaponSwap ? { weaponSwap } : {}),
    ...(mercenary ? { mercenary } : {}),
  };
}

import { createContext, use } from 'react';
import type { SetItemMatch } from '../utils/setItems';
import { useEquipmentItems, type EquipmentItems } from './useEquipmentItems';
import { useSetItems } from './useSetItems';

/** What the equipment slot picker searches. Each part is undefined while loading. */
export interface EquipmentPickerData {
  readonly items: EquipmentItems | undefined;
  readonly setItems: readonly SetItemMatch[] | undefined;
}

/**
 * Form-level picker data, so the many slot pickers of the build form (main items and alternatives) share one
 * local-DB scan instead of each running its own. `null` = no provider above (the picker then loads its own).
 */
export const EquipmentPickerDataContext = createContext<EquipmentPickerData | null>(null);

export function useEquipmentPickerData(): EquipmentPickerData | null {
  return use(EquipmentPickerDataContext);
}

/** Loads the picker data once. Call at form level and provide via `EquipmentPickerDataContext`. */
export function useEquipmentPickerDataQuery(): EquipmentPickerData {
  const items = useEquipmentItems();
  const setItems = useSetItems();
  return { items, setItems };
}

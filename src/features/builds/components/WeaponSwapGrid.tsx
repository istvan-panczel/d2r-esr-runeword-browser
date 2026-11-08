import type { ReactNode } from 'react';
import type { CraftAnnotation, ItemRef, WeaponSwapSlot } from '../buildData';
import type { CraftDataState } from '../hooks/useCraftData';
import type { ItemDiff } from '../utils/itemDiff';
import { SlotCell } from './SlotCell';

const SWAP_LABELS: Record<WeaponSwapSlot, string> = { weapon2: 'Weapon', shield2: 'Shield' };
const SWAP_SLOTS: readonly WeaponSwapSlot[] = ['weapon2', 'shield2'];

interface WeaponSwapGridProps {
  readonly items: Partial<Record<WeaponSwapSlot, ItemRef | null>>;
  readonly onChange?: (slot: WeaponSwapSlot, ref: ItemRef | null) => void;
  readonly disabled?: boolean;
  /** Per-slot ESR version diffs (read-only display only). */
  readonly diffs?: Partial<Record<WeaponSwapSlot, ItemDiff>>;
  /** Per-slot crafting/corruption notes. */
  readonly notes?: Partial<Record<WeaponSwapSlot, string>>;
  /** When provided, slot notes become editable. */
  readonly onNoteChange?: (slot: WeaponSwapSlot, text: string) => void;
  /** Per-slot crafting annotations. */
  readonly crafts?: Partial<Record<WeaponSwapSlot, readonly CraftAnnotation[]>>;
  /** When provided, slot crafting annotations become editable. */
  readonly onCraftsChange?: (slot: WeaponSwapSlot, crafts: readonly CraftAnnotation[]) => void;
  /** The crafting / enhance bundles, loaded once by the screen. */
  readonly craftData?: CraftDataState;
  /** Extra content at the bottom of a slot's cell (its alternative items). */
  readonly renderSlotFooter?: (slot: WeaponSwapSlot) => ReactNode;
  /** Read-only only: extra content at the end of a slot's label row. */
  readonly renderSlotLabelExtra?: (slot: WeaponSwapSlot) => ReactNode;
  /** Editable only: the DOM id of a slot's cell. */
  readonly slotAnchorId?: (slot: WeaponSwapSlot) => string;
}

export function WeaponSwapGrid({
  items,
  onChange,
  disabled,
  diffs,
  notes,
  onNoteChange,
  crafts,
  onCraftsChange,
  craftData,
  renderSlotFooter,
  renderSlotLabelExtra,
  slotAnchorId,
}: WeaponSwapGridProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
      {SWAP_SLOTS.map((slot) => (
        <SlotCell
          key={slot}
          label={SWAP_LABELS[slot]}
          slot={slot}
          item={items[slot] ?? null}
          disabled={disabled}
          diff={diffs?.[slot]}
          note={notes?.[slot]}
          crafts={crafts?.[slot]}
          craftData={craftData}
          footer={renderSlotFooter?.(slot)}
          labelExtra={renderSlotLabelExtra?.(slot)}
          anchorId={slotAnchorId?.(slot)}
          onChange={
            onChange === undefined
              ? undefined
              : (ref) => {
                  onChange(slot, ref);
                }
          }
          onCraftsChange={
            onCraftsChange === undefined
              ? undefined
              : (list) => {
                  onCraftsChange(slot, list);
                }
          }
          onNoteChange={
            onNoteChange === undefined
              ? undefined
              : (text) => {
                  onNoteChange(slot, text);
                }
          }
        />
      ))}
    </div>
  );
}

import type { ItemRef, WeaponSwapSlot } from '../buildData';
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
}

export function WeaponSwapGrid({ items, onChange, disabled, diffs, notes, onNoteChange }: WeaponSwapGridProps) {
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
          onChange={
            onChange === undefined
              ? undefined
              : (ref) => {
                  onChange(slot, ref);
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

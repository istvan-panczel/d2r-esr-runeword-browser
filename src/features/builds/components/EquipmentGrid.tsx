import type { EquipmentSlot, ItemRef } from '../buildData';
import type { ItemDiff } from '../utils/itemDiff';
import { SlotCell } from './SlotCell';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  helmet: 'Helmet',
  weapon: 'Weapon',
  armor: 'Armor',
  shield: 'Shield',
  gloves: 'Gloves',
  belt: 'Belt',
  boots: 'Boots',
  ring1: 'Ring 1',
  amulet: 'Amulet',
  ring2: 'Ring 2',
};

type Cell = { readonly kind: 'slot'; readonly slot: EquipmentSlot } | { readonly kind: 'spacer'; readonly id: string };

// Document order; spacers (hidden on mobile) form the D2 equipment silhouette on
// md+ screens. On mobile the grid is a single column and slots stack in order.
const CELLS: readonly Cell[] = [
  { kind: 'spacer', id: 'top-left' },
  { kind: 'slot', slot: 'helmet' },
  { kind: 'spacer', id: 'top-right' },
  { kind: 'slot', slot: 'weapon' },
  { kind: 'slot', slot: 'armor' },
  { kind: 'slot', slot: 'shield' },
  { kind: 'slot', slot: 'gloves' },
  { kind: 'slot', slot: 'belt' },
  { kind: 'slot', slot: 'boots' },
  { kind: 'slot', slot: 'ring1' },
  { kind: 'slot', slot: 'amulet' },
  { kind: 'slot', slot: 'ring2' },
];

interface EquipmentGridProps {
  readonly items: Partial<Record<EquipmentSlot, ItemRef | null>>;
  /** When provided, slots become editable pickers; otherwise the grid is read-only. */
  readonly onChange?: (slot: EquipmentSlot, ref: ItemRef | null) => void;
  readonly disabled?: boolean;
  /** Per-slot ESR version diffs (read-only display only). */
  readonly diffs?: Partial<Record<EquipmentSlot, ItemDiff>>;
  /** Per-slot crafting/corruption notes. */
  readonly notes?: Partial<Record<EquipmentSlot, string>>;
  /** When provided, slot notes become editable. */
  readonly onNoteChange?: (slot: EquipmentSlot, text: string) => void;
}

export function EquipmentGrid({ items, onChange, disabled, diffs, notes, onNoteChange }: EquipmentGridProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
      {CELLS.map((cell) => {
        if (cell.kind === 'spacer') return <div key={cell.id} className="hidden md:block" />;
        const slot = cell.slot;
        return (
          <SlotCell
            key={slot}
            label={SLOT_LABELS[slot]}
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
        );
      })}
    </div>
  );
}

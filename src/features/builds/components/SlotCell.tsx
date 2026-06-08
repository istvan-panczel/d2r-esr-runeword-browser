import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ITEM_NOTE_MAX_LENGTH } from '../constants';
import type { EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
import type { ItemDiff } from '../utils/itemDiff';
import { BuildItemCard } from './BuildItemCard';
import { EquipmentSlotPicker } from './EquipmentSlotPicker';
import { ItemRefDisplay } from './ItemRefDisplay';

interface SlotCellProps {
  readonly label: string;
  readonly slot: EquipmentSlot | WeaponSwapSlot;
  readonly item: ItemRef | null;
  /** When provided, the cell is an editable picker; otherwise read-only. */
  readonly onChange?: (ref: ItemRef | null) => void;
  readonly disabled?: boolean;
  /**
   * ESR version diff for this slot (read-only display only). When present, a badge is
   * shown if the saved snapshot differs from the current local data.
   */
  readonly diff?: ItemDiff;
  /** Per-item crafting/corruption note (rune-forging, D-Stone, corruption, etc.). */
  readonly note?: string;
  /** When provided alongside an item, the note becomes editable. */
  readonly onNoteChange?: (text: string) => void;
}

/** One equipment slot — editable (picker + rich card preview + note) or read-only. */
export function SlotCell({ label, slot, item, onChange, disabled, diff, note, onNoteChange }: SlotCellProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  if (onChange !== undefined) {
    return (
      <div className="flex flex-col gap-2">
        <EquipmentSlotPicker label={label} value={item} disabled={disabled} onChange={onChange} />
        {item !== null && <BuildItemCard item={item} slot={slot} />}
        {item !== null && onNoteChange !== undefined && (
          <Textarea
            value={note ?? ''}
            maxLength={ITEM_NOTE_MAX_LENGTH}
            rows={2}
            disabled={disabled}
            placeholder="Crafting / corruption notes (optional) — e.g. D-Stone until very fast attack speed"
            className="text-sm"
            onChange={(event) => {
              onNoteChange(event.target.value);
            }}
          />
        )}
      </div>
    );
  }

  // Read-only: the rich card shows the viewer's current data (BuildItemCard falls back
  // to the saved snapshot when the item is missing from the current ESR data).
  const status = diff?.status;
  const noteText = note?.trim();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {status === 'changed' && (
          <button
            type="button"
            onClick={() => {
              setShowOriginal((value) => !value);
            }}
            className="inline-flex items-center gap-1 rounded border border-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
            title="Stats changed since this build was saved"
          >
            <TriangleAlert className="size-3" />
            {showOriginal ? 'Hide saved' : 'Stats updated'}
          </button>
        )}
      </div>

      {item !== null ? (
        <BuildItemCard item={item} slot={slot} />
      ) : (
        <Card className="p-3">
          <p className="text-sm text-muted-foreground">—</p>
        </Card>
      )}

      {status === 'missing' && (
        <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          This item may no longer exist in the current ESR version.
        </p>
      )}

      {status === 'changed' && showOriginal && diff !== undefined && (
        <div className="rounded-md border border-dashed bg-muted/40 p-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Saved with the build</p>
          <ItemRefDisplay item={diff.stored} slot={slot} />
        </div>
      )}

      {item !== null && noteText !== undefined && noteText.length > 0 && (
        <div className="rounded-md bg-muted/40 p-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Crafting / corruption</p>
          <p className="whitespace-pre-wrap text-xs">{noteText}</p>
        </div>
      )}
    </div>
  );
}

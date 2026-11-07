import { useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ITEM_NOTE_MAX_LENGTH } from '../constants';
import type { CraftAnnotation, EquipmentSlot, ItemRef, WeaponSwapSlot } from '../buildData';
import type { CraftDataState } from '../hooks/useCraftData';
import type { ItemDiff } from '../utils/itemDiff';
import { socketedOf } from '../utils/itemChoices';
import { itemRefKey } from '../utils/resolveItem';
import { BuildItemCard } from './BuildItemCard';
import { CraftsDisplay } from './CraftsDisplay';
import { CraftsEditor } from './CraftsEditor';
import { ItemChoicesEditor } from './ItemChoicesEditor';
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
  /** Set items only: pieces of the item's set equipped in this section. */
  readonly setPieces?: number;
  /** Structured crafting annotations of the slot (forging, D-stoning, melds, corruption, anointment). */
  readonly crafts?: readonly CraftAnnotation[];
  /** When provided alongside an item, the crafting annotations become editable. */
  readonly onCraftsChange?: (crafts: readonly CraftAnnotation[]) => void;
  /** The crafting / enhance bundles, loaded once per screen. */
  readonly craftData?: CraftDataState;
  /** Extra content at the bottom of the cell in both modes (the slot's alternative items). */
  readonly footer?: ReactNode;
  /** Read-only only: extra content at the end of the label row (e.g. which alternative is shown). */
  readonly labelExtra?: ReactNode;
}

const NO_CRAFT_DATA: CraftDataState = { status: 'idle', lookups: undefined };

/** One equipment slot — editable (picker + rich card preview + note) or read-only. */
export function SlotCell({
  label,
  slot,
  item,
  onChange,
  disabled,
  diff,
  note,
  onNoteChange,
  setPieces,
  crafts = [],
  onCraftsChange,
  craftData = NO_CRAFT_DATA,
  footer,
  labelExtra,
}: SlotCellProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  // A different item in the cell (an alternative swapped in on the detail page) starts with its saved snapshot hidden.
  const shownKey = item === null ? '' : itemRefKey(item);
  const [prevShownKey, setPrevShownKey] = useState(shownKey);
  if (prevShownKey !== shownKey) {
    setPrevShownKey(shownKey);
    setShowOriginal(false);
  }

  if (onChange !== undefined) {
    return (
      <div className="flex flex-col gap-2">
        <EquipmentSlotPicker label={label} slot={slot} value={item} disabled={disabled} onChange={onChange} />
        {item !== null && <ItemChoicesEditor item={item} slot={slot} disabled={disabled} onChange={onChange} />}
        {item !== null && <BuildItemCard item={item} slot={slot} setPieces={setPieces} showChoices={false} />}
        {item !== null && onCraftsChange !== undefined && (
          <CraftsEditor slot={slot} item={item} crafts={crafts} craftData={craftData} disabled={disabled} onChange={onCraftsChange} />
        )}
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
        {footer}
      </div>
    );
  }

  // Read-only: the rich card shows the viewer's current data (BuildItemCard falls back
  // to the saved snapshot when the item is missing from the current ESR data).
  const status = diff?.status;
  const noteText = note?.trim();
  const socketCount = item === null ? 0 : socketedOf(item).length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {label}
          {socketCount > 0 && (
            <span className="ml-1.5 font-normal" title={`${String(socketCount)} socketed`}>
              ⬢{socketCount}
            </span>
          )}
        </p>
        {labelExtra}
        {status === 'changed' && (
          <button
            type="button"
            onClick={() => {
              setShowOriginal((value) => !value);
            }}
            aria-expanded={showOriginal}
            className="inline-flex items-center gap-1 rounded border border-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
            title="Stats changed since this build was saved"
          >
            <TriangleAlert className="size-3" />
            {showOriginal ? 'Hide saved' : 'Stats updated'}
          </button>
        )}
      </div>

      {item !== null ? (
        <BuildItemCard item={item} slot={slot} setPieces={setPieces} />
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

      {item !== null && <CraftsDisplay slot={slot} item={item} crafts={crafts} craftData={craftData} />}

      {item !== null && noteText !== undefined && noteText.length > 0 && (
        <div className="rounded-md bg-muted/40 p-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Crafting / corruption</p>
          <p className="whitespace-pre-wrap text-xs">{noteText}</p>
        </div>
      )}

      {footer}
    </div>
  );
}

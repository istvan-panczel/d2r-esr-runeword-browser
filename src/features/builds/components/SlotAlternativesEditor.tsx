import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpToLine, ChevronUp, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { EquipmentSlot, ItemRef } from '../buildData';
import { ALTERNATIVES_MAX_PER_SLOT, ITEM_NOTE_MAX_LENGTH } from '../constants';
import type { CraftDataState } from '../hooks/useCraftData';
import { itemRefName } from '../utils/buildSnapshot';
import { setPieceCounts } from '../utils/setBonuses';
import { addAlternativeAction, type AlternativePatch, type SlotTarget, type VariantDraftAction } from '../utils/variantDrafts';
import type { DraftAlternative } from './buildFormModel';
import { BuildItemCard } from './BuildItemCard';
import { CraftsEditor } from './CraftsEditor';
import { EquipmentSlotPicker } from './EquipmentSlotPicker';
import { ItemChoicesEditor } from './ItemChoicesEditor';

const NOTE_EXCERPT_LENGTH = 40;

interface SlotAlternativesEditorProps {
  readonly target: SlotTarget;
  readonly mainItem: ItemRef | null;
  readonly alternatives: readonly DraftAlternative[];
  /** Player / merc gear: the section's main items, so a set alternative's preview counts its set pieces. */
  readonly sectionItems?: Partial<Record<EquipmentSlot, ItemRef | null>>;
  readonly craftData: CraftDataState;
  readonly disabled: boolean;
  readonly dispatch: (action: VariantDraftAction) => void;
}

/**
 * The alternative items of one slot, under the main item's editor: compact rows with Edit / Move up / Move down /
 * Make main / Remove. One row at a time expands to the main item's editor stack. Nothing while the slot is empty.
 */
export function SlotAlternativesEditor({
  target,
  mainItem,
  alternatives,
  sectionItems,
  craftData,
  disabled,
  dispatch,
}: SlotAlternativesEditorProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  if (mainItem === null && alternatives.length === 0) return null;

  const { slot } = target;
  const canAdd = mainItem !== null && alternatives.length < ALTERNATIVES_MAX_PER_SLOT;
  const patch = (position: number, next: AlternativePatch) => {
    dispatch({ ...target, type: 'setAlternative', position, patch: next });
  };

  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Alternatives ({alternatives.length}/{ALTERNATIVES_MAX_PER_SLOT})
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
          disabled={disabled || !canAdd}
          onClick={() => {
            const action = addAlternativeAction(target);
            dispatch(action);
            setExpandedKey(action.key);
          }}
        >
          <Plus className="size-3" />
          Add alternative
        </Button>
      </div>

      {alternatives.map((alternative, position) => {
        const expanded = alternative.key === expandedKey;
        const name = alternative.ref !== null ? itemRefName(alternative.ref) : null;
        const note = alternative.note.trim();
        const excerpt = note.length > NOTE_EXCERPT_LENGTH ? `${note.slice(0, NOTE_EXCERPT_LENGTH)}…` : note;
        const rowLabel = name ?? `Alternative ${String(position + 1)}`;
        const ref = alternative.ref;
        const setPieces =
          ref?.type === 'set' && sectionItems !== undefined
            ? setPieceCounts({ ...sectionItems, [slot]: ref }).get(ref.snapshot.setId)
            : undefined;
        return (
          <div key={alternative.key} className={cn('flex flex-col gap-2', expanded && 'rounded-md bg-muted/30 p-1.5')}>
            <div className="flex items-center gap-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn('truncate text-xs', name === null && 'italic text-muted-foreground')} title={name ?? undefined}>
                  {position + 1}. {name ?? 'No item picked'}
                </span>
                {excerpt.length > 0 && (
                  <span className="truncate text-[11px] text-muted-foreground" title={note}>
                    {excerpt}
                  </span>
                )}
              </div>
              <RowButton
                label={expanded ? `Collapse ${rowLabel}` : `Edit ${rowLabel}`}
                expanded={expanded}
                disabled={disabled}
                onClick={() => {
                  setExpandedKey(expanded ? null : alternative.key);
                }}
              >
                {expanded ? <ChevronUp /> : <Pencil />}
              </RowButton>
              <RowButton
                label={`Move ${rowLabel} up`}
                disabled={disabled || position === 0}
                onClick={() => {
                  dispatch({ ...target, type: 'moveAlternative', from: position, to: position - 1 });
                }}
              >
                <ArrowUp />
              </RowButton>
              <RowButton
                label={`Move ${rowLabel} down`}
                disabled={disabled || position === alternatives.length - 1}
                onClick={() => {
                  dispatch({ ...target, type: 'moveAlternative', from: position, to: position + 1 });
                }}
              >
                <ArrowDown />
              </RowButton>
              <RowButton
                label={`Make ${rowLabel} the main item`}
                disabled={disabled || ref === null}
                onClick={() => {
                  dispatch({ ...target, type: 'promoteAlternative', position });
                  setExpandedKey(null);
                }}
              >
                <ArrowUpToLine />
              </RowButton>
              <RowButton
                label={`Remove ${rowLabel}`}
                disabled={disabled}
                onClick={() => {
                  dispatch({ ...target, type: 'removeAlternative', position });
                }}
              >
                <X />
              </RowButton>
            </div>

            {expanded && (
              <div className="flex flex-col gap-2">
                <EquipmentSlotPicker
                  label={`Alternative ${String(position + 1)}`}
                  slot={slot}
                  value={ref}
                  disabled={disabled}
                  onChange={(next) => {
                    patch(position, { ref: next });
                  }}
                />
                {ref !== null && (
                  <>
                    <ItemChoicesEditor
                      item={ref}
                      slot={slot}
                      disabled={disabled}
                      onChange={(next) => {
                        patch(position, { ref: next });
                      }}
                    />
                    <BuildItemCard item={ref} slot={slot} setPieces={setPieces} showChoices={false} />
                    <CraftsEditor
                      slot={slot}
                      crafts={alternative.crafts}
                      craftData={craftData}
                      disabled={disabled}
                      onChange={(crafts) => {
                        patch(position, { crafts });
                      }}
                    />
                    <Textarea
                      value={alternative.note}
                      maxLength={ITEM_NOTE_MAX_LENGTH}
                      rows={2}
                      disabled={disabled}
                      placeholder="Notes (optional) — e.g. budget option until Ber"
                      aria-label={`${rowLabel} notes`}
                      className="text-sm"
                      onChange={(event) => {
                        patch(position, { note: event.target.value });
                      }}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface RowButtonProps {
  readonly label: string;
  readonly disabled: boolean;
  readonly expanded?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function RowButton({ label, disabled, expanded, onClick, children }: RowButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-6 text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5"
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Ellipsis, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { VARIANT_NAME_MAX_LENGTH, VARIANT_NOTE_MAX_LENGTH, VARIANTS_MAX } from '../constants';
import { variantLabel } from '../utils/buildVariants';
import { addVariantAction, draftLabel, draftLevelValid, nextVariantName, type VariantDraftAction } from '../utils/variantDrafts';
import { AddVariantDialog } from './AddVariantDialog';
import type { VariantDraft } from './buildFormModel';

interface VariantToolbarProps {
  readonly drafts: readonly VariantDraft[];
  readonly activeIndex: number;
  /** Switches the shown variant (navigation only: never marks the form changed). */
  readonly onSelect: (index: number) => void;
  readonly disabled: boolean;
  readonly dispatch: (action: VariantDraftAction) => void;
}

/**
 * The variant bar of the build form (inside its Tabs root): a scrollable tab per variant, "Add variant", a menu to move
 * or delete the active one, and the active variant's name and note. Shown with a single variant too, for discoverability.
 */
export function VariantToolbar({ drafts, activeIndex, onSelect, disabled, dispatch }: VariantToolbarProps) {
  const [adding, setAdding] = useState(false);
  // The variant the delete dialog asks about, captured when it opens: the dialog keeps its text while it animates
  // closed, after the active variant has already changed. Kept (not cleared) on close for that reason.
  const [pendingDelete, setPendingDelete] = useState<{ readonly index: number; readonly label: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const active = drafts[activeIndex];
  const labels = drafts.map(draftLabel);
  const activeLabel = labels[activeIndex];
  const canAdd = drafts.length < VARIANTS_MAX;

  const move = (to: number) => {
    dispatch({ type: 'moveVariant', from: activeIndex, to });
    onSelect(to);
  };

  return (
    <section aria-labelledby="build-variants-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="build-variants-heading" className="text-lg font-semibold">
          Variants
        </h2>
        <p className="text-sm text-muted-foreground">
          Everything below belongs to the selected variant. The build name, class and description are shared.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <TabsList className="w-max">
            {drafts.map((draft, index) => {
              const invalid = !draftLevelValid(draft);
              return (
                <TabsTrigger key={draft.key} value={draft.key} className="max-w-48 px-3" title={invalid ? 'Invalid level' : labels[index]}>
                  <span className="truncate">{labels[index]}</span>
                  {invalid && (
                    <>
                      <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />
                      <span className="sr-only">(invalid level)</span>
                    </>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canAdd}
          title={canAdd ? undefined : `At most ${String(VARIANTS_MAX)} variants`}
          onClick={() => {
            setAdding(true);
          }}
        >
          <Plus />
          <span className="hidden sm:inline">Add variant</span>
          <span className="sr-only sm:hidden">Add variant</span>
        </Button>
        {/* Not modal: a modal menu that opens a dialog leaves the page unclickable (Radix focus handoff). */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={`More actions for ${activeLabel}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={activeIndex === 0}
              onSelect={() => {
                move(activeIndex - 1);
              }}
            >
              <ArrowLeft />
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={activeIndex === drafts.length - 1}
              onSelect={() => {
                move(activeIndex + 1);
              }}
            >
              <ArrowRight />
              Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={drafts.length <= 1}
              onSelect={() => {
                setPendingDelete({ index: activeIndex, label: activeLabel });
                setConfirmingDelete(true);
              }}
            >
              <Trash2 />
              Delete variant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant-name" className="text-xs text-muted-foreground">
            Variant name
          </Label>
          <Input
            id="variant-name"
            value={active.name}
            maxLength={VARIANT_NAME_MAX_LENGTH}
            placeholder={variantLabel({}, activeIndex)}
            autoComplete="off"
            disabled={disabled}
            onChange={(event) => {
              dispatch({ type: 'renameVariant', variant: activeIndex, name: event.target.value });
            }}
            onKeyDown={(event) => {
              // Enter in a lone text input would submit the whole build form.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant-note" className="text-xs text-muted-foreground">
            Variant note (optional)
          </Label>
          <Textarea
            id="variant-note"
            value={active.note}
            maxLength={VARIANT_NOTE_MAX_LENGTH}
            rows={2}
            placeholder="e.g. Budget gear before Enigma"
            disabled={disabled}
            onChange={(event) => {
              dispatch({ type: 'setVariantNote', variant: activeIndex, note: event.target.value });
            }}
          />
        </div>
      </div>

      <AddVariantDialog
        open={adding}
        onOpenChange={setAdding}
        variants={drafts.map((draft, index) => ({ key: draft.key, label: labels[index] }))}
        activeIndex={activeIndex}
        defaultName={nextVariantName(drafts)}
        onCreate={(name, from) => {
          dispatch(addVariantAction(name, from));
          // The new variant is appended.
          onSelect(drafts.length);
          setAdding(false);
        }}
      />

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete variant?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.label}” and everything in it (gear, alternatives, skills, charms) is removed from the build when you save.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmingDelete(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingDelete !== null) {
                  dispatch({ type: 'deleteVariant', variant: pendingDelete.index });
                  onSelect(Math.min(pendingDelete.index, drafts.length - 2));
                }
                setConfirmingDelete(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

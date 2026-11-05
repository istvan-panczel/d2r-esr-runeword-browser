import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { BookOpenCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { LootFilter } from '../../engine/types';
import { addRules } from '../../store/lootFilterSlice';
import { mergeStyles } from '../../utils/examplePicker';
import { ExampleRulesDialog } from './ExampleRulesDialog';

interface ExampleRulesButtonProps {
  readonly filter: LootFilter;
  /** Where the rules go (after the selected rule); undefined = the end. */
  readonly insertAt: number | undefined;
  /** Called after rules were added (the Rules tab clears its search). */
  readonly onAdded?: () => void;
}

const names = (list: readonly string[]) => list.join(', ');

/**
 * The Rules tab's "Example rules" button and dialog. Confirm adds the rules in one edit (`addRules`) and the styles the filter lacks; a style
 * name the filter already uses keeps the filter's own style, and the toast says so.
 */
export function ExampleRulesButton({ filter, insertAt, onAdded }: ExampleRulesButtonProps) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => {
          setOpen(true);
        }}
      >
        <BookOpenCheck />
        Example rules
      </Button>
      <ExampleRulesDialog
        open={open}
        onOpenChange={setOpen}
        previewVolume={filter.soundVolume ?? 100}
        onConfirm={(rules, styles) => {
          const merge = mergeStyles(filter.styles, styles);
          dispatch(addRules({ rules, styles: merge.add, at: insertAt }));
          const added = Object.keys(merge.add);
          const notes = [
            added.length > 0 ? `Added the style${added.length === 1 ? '' : 's'} ${names(added)}.` : undefined,
            merge.reused.length > 0
              ? `Kept your own style${merge.reused.length === 1 ? '' : 's'} ${names(merge.reused)}; the new rules use ${merge.reused.length === 1 ? 'it' : 'them'} unchanged.`
              : undefined,
          ].filter((note) => note !== undefined);
          toast.success(rules.length === 1 ? 'Added 1 example rule' : `Added ${String(rules.length)} example rules`, {
            description: notes.length > 0 ? notes.join(' ') : undefined,
          });
          setOpen(false);
          onAdded?.();
        }}
      />
    </>
  );
}

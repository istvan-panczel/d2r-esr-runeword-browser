import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExampleRulesPicker, type ExampleRulesPickerProps } from './ExampleRulesPicker';

interface ExampleRulesDialogProps extends Omit<ExampleRulesPickerProps, 'onCancel'> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title?: string;
  /** The intro under the title; default: the Rules tab's (how rules run, the .zip). */
  readonly description?: ReactNode;
}

const EDITOR_DESCRIPTION =
  'Tick the rules you want; each ticked rule shows its style, sound, minimap icon and chat line, ready to change. Rules run top to bottom and every matching rule applies, later labels winning; a matching hide rule hides the item and stops there. The sounds and icons come with the .zip download.';

/**
 * The example rules picker in a wide, scrolling dialog. The picker unmounts on close, so every opening starts with
 * `initialState` (nothing ticked by default). `onConfirm` does not close the dialog; the caller does (after adding the rules).
 */
export function ExampleRulesDialog({
  open,
  onOpenChange,
  title = 'Example rules',
  description = EDITOR_DESCRIPTION,
  ...pickerProps
}: ExampleRulesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="px-4 pt-4 pb-3 pr-12 sm:px-6 sm:pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && (
          <ExampleRulesPicker
            {...pickerProps}
            onCancel={() => {
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

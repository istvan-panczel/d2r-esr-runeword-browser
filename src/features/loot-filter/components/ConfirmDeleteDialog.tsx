import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ConfirmDeleteDialogProps {
  /**
   * Whether the dialog is open. Default: while `name` is set. Pass it separately (and keep `name` after closing)
   * so the text does not change during the close animation.
   */
  readonly open?: boolean;
  /** The name in the default text. */
  readonly name: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  /** Default "Delete filter?". */
  readonly title?: string;
  /** Default: the library entry text ("removed from this browser…"). */
  readonly description?: React.ReactNode;
  /** Default "Delete". */
  readonly confirmLabel?: string;
}

/** Asks before deleting something (a library entry by default). */
export function ConfirmDeleteDialog({
  open,
  name,
  onCancel,
  onConfirm,
  title = 'Delete filter?',
  description,
  confirmLabel = 'Delete',
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog
      open={open ?? name !== null}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              `“${name ?? ''}” is removed from this browser. Download it first if you want to keep a copy; this cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VARIANT_NAME_MAX_LENGTH } from '../constants';

const EMPTY = 'empty';

interface AddVariantDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The existing variants (draft key + tab label), in order. */
  readonly variants: readonly { readonly key: string; readonly label: string }[];
  /** Preselected in "Start from". */
  readonly activeIndex: number;
  readonly defaultName: string;
  readonly onCreate: (name: string, from: number | 'empty') => void;
}

/** Name a new variant and pick what it starts from (a copy of any variant, or empty). Rendered only while open. */
export function AddVariantDialog({ open, onOpenChange, ...props }: AddVariantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <AddVariantForm
            {...props}
            onCancel={() => {
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface AddVariantFormProps extends Omit<AddVariantDialogProps, 'open' | 'onOpenChange'> {
  readonly onCancel: () => void;
}

function AddVariantForm({ variants, activeIndex, defaultName, onCreate, onCancel }: AddVariantFormProps) {
  const [name, setName] = useState(defaultName);
  const [from, setFrom] = useState(String(activeIndex));

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    // The dialog is portalled, but React still bubbles the submit to the build form around it.
    event.stopPropagation();
    onCreate(name.trim(), from === EMPTY ? 'empty' : Number(from));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add variant</DialogTitle>
        <DialogDescription>
          A variant has its own gear, alternatives, skills, charms and ascendancy. The build name, class and description are shared.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-variant-name">Name</Label>
          <Input
            id="new-variant-name"
            value={name}
            maxLength={VARIANT_NAME_MAX_LENGTH}
            autoComplete="off"
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-variant-from">Start from</Label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger id="new-variant-from" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variants.map(({ key, label }, index) => (
                <SelectItem key={key} value={String(index)}>
                  Copy of {label}
                </SelectItem>
              ))}
              <SelectItem value={EMPTY}>Empty</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </DialogFooter>
      </form>
    </>
  );
}

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { RequestState } from '@/core/types';
import {
  FILTER_DESCRIPTION_MAX_LENGTH,
  FILTER_NAME_MAX_LENGTH,
  selectFilterDetailsError,
  selectFilterDetailsStatus,
  updateFilterDetailsRequested,
  type SharedFilterDetails,
} from '../../sharing';

interface DetailsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The saved filter. */
  readonly id: string;
  readonly details: SharedFilterDetails;
}

/** A saved filter's server fields: name, description and Private, written at once (they are not part of the draft). */
export function DetailsDialog({ open, onClose, ...props }: DetailsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">{open && <DetailsForm {...props} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function DetailsForm({ id, details, onClose }: Omit<DetailsDialogProps, 'open'>) {
  const dispatch = useDispatch();
  const status = useSelector(selectFilterDetailsStatus);
  const error = useSelector(selectFilterDetailsError);
  const [name, setName] = useState(details.name);
  const [description, setDescription] = useState(details.description);
  const [isPrivate, setIsPrivate] = useState(details.isPrivate);
  const saving = status === RequestState.LOADING;

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (saving || name.trim() === '') return;
    dispatch(updateFilterDetailsRequested({ id, name, description, isPrivate }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Details</DialogTitle>
        <DialogDescription>Saved right away; the filter file and its unsaved changes are not touched.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-details-name">Name</Label>
        <Input
          id="filter-details-name"
          value={name}
          maxLength={FILTER_NAME_MAX_LENGTH}
          autoComplete="off"
          autoFocus
          disabled={saving}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-details-description">Description</Label>
        <Textarea
          id="filter-details-description"
          value={description}
          maxLength={FILTER_DESCRIPTION_MAX_LENGTH}
          rows={4}
          disabled={saving}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="filter-details-private"
          checked={isPrivate}
          disabled={saving}
          onCheckedChange={(checked) => {
            setIsPrivate(checked === true);
          }}
        />
        <Label htmlFor="filter-details-private" className="text-sm font-normal leading-snug">
          Private: only you can see it. Copies others already made keep working.
        </Label>
      </div>
      {error !== null && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ''}>
          {saving && <Spinner />}
          Save details
        </Button>
      </DialogFooter>
    </form>
  );
}

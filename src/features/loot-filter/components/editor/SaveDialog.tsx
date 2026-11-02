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
import { openSignInDialog, selectIsAuthenticated } from '@/features/auth';
import {
  CHANGE_NOTE_MAX_LENGTH,
  FILTER_DESCRIPTION_MAX_LENGTH,
  FILTER_NAME_MAX_LENGTH,
  saveFilterRequested,
  selectSaveFilterConflict,
  selectSaveFilterError,
  selectSaveFilterStatus,
  type SaveFilterMode,
} from '../../sharing';
import type { DiagnosticCounts } from '../../store/selectors';
import type { SaveDialogDetails } from '../../utils/editorRoute';

interface SaveDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** `insert`: the first save of a new draft (name, description, Private); `update`: a saved filter's changes. */
  readonly kind: 'insert' | 'update';
  /**
   * The draft's name (insert) or the saved filter's details (update; Save as a new filter reuses them). `isPrivate` is
   * null while a saved filter's privacy is unknown: no "What changed" note is asked and Save as a new filter starts
   * private.
   */
  readonly details: SaveDialogDetails;
  readonly counts: DiagnosticCounts;
  /** The JSON tab has text that was not applied: Save stores the model without it. */
  readonly jsonUnapplied: boolean;
}

/** Save: the first save's details, a public filter's optional "what changed" note, and the save's errors and conflicts. */
export function SaveDialog({ open, onClose, ...props }: SaveDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">{open && <SaveForm {...props} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function countsText({ errors, warnings }: DiagnosticCounts): string | null {
  if (errors === 0 && warnings === 0) return null;
  const parts = [
    `${String(errors)} ${errors === 1 ? 'error' : 'errors'}`,
    `${String(warnings)} ${warnings === 1 ? 'warning' : 'warnings'}`,
  ];
  return `${parts.join(', ')}: you can still save.`;
}

function SaveForm({ kind, details, counts, jsonUnapplied, onClose }: Omit<SaveDialogProps, 'open'>) {
  const dispatch = useDispatch();
  const signedIn = useSelector(selectIsAuthenticated);
  const status = useSelector(selectSaveFilterStatus);
  const error = useSelector(selectSaveFilterError);
  const conflict = useSelector(selectSaveFilterConflict);
  const [name, setName] = useState(details.name);
  const [description, setDescription] = useState(details.description);
  const insert = kind === 'insert';
  // Insert: public unless ticked. Save as a new filter (after a conflict): the saved filter's privacy, private when unknown.
  const [isPrivate, setIsPrivate] = useState(details.isPrivate ?? !insert);
  const [note, setNote] = useState('');

  const saving = status === RequestState.LOADING;
  const askNote = !insert && details.isPrivate === false;
  const problems = countsText(counts);

  const save = (mode: SaveFilterMode) => {
    if (mode === 'asNew') {
      dispatch(saveFilterRequested({ mode, details: { name: details.name, description: details.description, isPrivate } }));
    } else if (insert) {
      dispatch(saveFilterRequested({ mode, details: { name, description, isPrivate } }));
    } else {
      dispatch(saveFilterRequested({ mode, changeNote: askNote ? note : undefined }));
    }
  };

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (saving || (insert && name.trim() === '')) return;
    save('normal');
  };

  if (!signedIn) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Sign in to save</DialogTitle>
          <DialogDescription>
            Saved filters live in your account: public ones can be opened, downloaded and copied by everyone. Your draft stays in this
            browser meanwhile.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              dispatch(openSignInDialog());
            }}
          >
            Sign in
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{insert ? 'Save filter' : 'Save changes'}</DialogTitle>
        <DialogDescription>
          {insert
            ? 'A saved filter is public unless you tick Private: everyone can open, download and copy it.'
            : details.isPrivate === null
              ? 'Saves your changes to the saved filter.'
              : details.isPrivate
                ? 'Only you can see this filter.'
                : 'Everyone sees the new version; copies of it get "Update available".'}
        </DialogDescription>
      </DialogHeader>

      {insert && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="save-filter-name">Name</Label>
            <Input
              id="save-filter-name"
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
            <Label htmlFor="save-filter-description">Description (optional)</Label>
            <Textarea
              id="save-filter-description"
              value={description}
              maxLength={FILTER_DESCRIPTION_MAX_LENGTH}
              rows={3}
              disabled={saving}
              placeholder="What it shows and hides, which levels it has, who it is for"
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </div>
          <PrivateCheckbox checked={isPrivate} disabled={saving} onChange={setIsPrivate}>
            Private: only you can see it (you can change this later in Details)
          </PrivateCheckbox>
        </>
      )}

      {!insert && conflict !== null && (
        <PrivateCheckbox checked={isPrivate} disabled={saving} onChange={setIsPrivate}>
          Save as a new filter: Private (only you can see the new filter)
        </PrivateCheckbox>
      )}

      {askNote && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="save-filter-note">What changed (optional)</Label>
          <Input
            id="save-filter-note"
            value={note}
            maxLength={CHANGE_NOTE_MAX_LENGTH}
            autoComplete="off"
            autoFocus
            disabled={saving}
            placeholder="Shown to everyone who copied it"
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {note.length}/{CHANGE_NOTE_MAX_LENGTH}
          </p>
        </div>
      )}

      {(problems !== null || jsonUnapplied) && (
        <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          {problems !== null && <p>{problems}</p>}
          {jsonUnapplied && <p>The JSON tab has text you have not applied: it is not saved. Apply or revert it first to keep it.</p>}
        </div>
      )}

      {error !== null && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <DialogFooter className="flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        {conflict === null ? (
          <Button type="submit" disabled={saving || (insert && name.trim() === '')}>
            {saving && <Spinner />}
            Save
          </Button>
        ) : (
          <>
            {conflict === 'changed' && (
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => {
                  save('overwrite');
                }}
              >
                Overwrite
              </Button>
            )}
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                save('asNew');
              }}
            >
              {saving && <Spinner />}
              Save as a new filter
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}

interface PrivateCheckboxProps {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: React.ReactNode;
}

function PrivateCheckbox({ checked, disabled, onChange, children }: PrivateCheckboxProps) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id="save-filter-private"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => {
          onChange(next === true);
        }}
      />
      <Label htmlFor="save-filter-private" className="text-sm font-normal leading-snug">
        {children}
      </Label>
    </div>
  );
}

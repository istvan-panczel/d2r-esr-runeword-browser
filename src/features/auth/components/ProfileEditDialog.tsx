import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequestState } from '@/core/types';
import { resetDisplayNameStatus, selectAuthError, selectDisplayName, selectDisplayNameStatus, updateDisplayNameRequested } from '../store';
import { DISPLAY_NAME_MAX_LENGTH } from '../utils/profile';

// Automated account deletion isn't built yet; until then users request manual
// erasure by opening an issue on the public repo.
const DELETE_REQUEST_URL = 'https://github.com/istvan-panczel/d2r-esr-runeword-browser/issues/new?title=Account%20deletion%20request';

type DialogView = 'edit' | 'delete';

interface ProfileEditDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called after a successful save (e.g. to refresh the viewed profile). */
  readonly onSaved?: () => void;
}

/**
 * Owner-only dialog for changing the public display name. Saving regenerates the
 * discriminator (handled in the saga). The dialog seeds the input from the current
 * profile each time it opens and closes itself once the change succeeds. It also
 * exposes an account-deletion request flow (manual, for now).
 */
export function ProfileEditDialog({ open, onOpenChange, onSaved }: ProfileEditDialogProps) {
  const dispatch = useDispatch();
  const currentName = useSelector(selectDisplayName) ?? '';
  const status = useSelector(selectDisplayNameStatus);
  const error = useSelector(selectAuthError);
  const [name, setName] = useState(currentName);
  const [view, setView] = useState<DialogView>('edit');
  const wasOpen = useRef(false);

  // Seed the input and clear stale status only on the closed -> open transition,
  // so a profile update mid-session (which changes currentName) never resets the
  // in-flight success state we rely on to auto-close.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(currentName);
      setView('edit');
      dispatch(resetDisplayNameStatus());
    }
    wasOpen.current = open;
  }, [open, currentName, dispatch]);

  useEffect(() => {
    if (open && status === RequestState.SUCCESS) {
      onOpenChange(false);
      onSaved?.();
    }
  }, [open, status, onOpenChange, onSaved]);

  const trimmed = name.trim();
  const nameValid = trimmed.length > 0 && trimmed.length <= DISPLAY_NAME_MAX_LENGTH;
  const unchanged = trimmed === currentName.trim();
  const busy = status === RequestState.LOADING;
  const canSubmit = nameValid && !unchanged && !busy;

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    dispatch(updateDisplayNameRequested({ displayName: trimmed }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {view === 'edit' ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>Changing your display name assigns a new random #tag.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-display-name">Display name</Label>
                <Input
                  id="profile-display-name"
                  value={name}
                  maxLength={DISPLAY_NAME_MAX_LENGTH}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Shown publicly as <span className="font-medium text-foreground">{trimmed.length > 0 ? trimmed : 'Name'}#1234</span> — a
                  new 4-digit tag is assigned automatically.
                </p>
                {status === RequestState.ERROR && error !== null && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    onOpenChange(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {busy ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>

            <div className="mt-1 border-t pt-3">
              <button
                type="button"
                className="text-sm font-medium text-destructive hover:underline"
                onClick={() => {
                  setView('delete');
                }}
              >
                Delete account
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Delete account</DialogTitle>
              <DialogDescription>Automatic account deletion isn’t available yet.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 text-sm">
              <p>
                To permanently delete your account and all your data (profile, builds, and likes), please open a request and the developer
                will remove it manually. This action is irreversible.
              </p>
              <Button asChild variant="destructive">
                <a href={DELETE_REQUEST_URL} target="_blank" rel="noopener noreferrer">
                  Open a deletion request on GitHub
                </a>
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setView('edit');
                }}
              >
                Back
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

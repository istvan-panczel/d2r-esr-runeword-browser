import { Hammer } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { openSignInDialog, selectAuthIsConfigured, selectIsAuthenticated } from '@/features/auth';
import type { CharacterFileMeta } from '../db/characterDb';
import { saveHandoffState } from '../engine/buildHandoff';

interface CreateBuildActionProps {
  readonly file: CharacterFileMeta;
  readonly bytes: Uint8Array;
}

/**
 * "Create a build from this character": opens `/builds/new` with this stored save already in its "Start from a save
 * file" card (router state, see engine/buildHandoff.ts). Builds need the backend and an account: without the backend the
 * button is not shown, signed out it opens the sign-in dialog first.
 */
export function CreateBuildAction({ file, bytes }: CreateBuildActionProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const configured = useSelector(selectAuthIsConfigured);
  const signedIn = useSelector(selectIsAuthenticated);
  if (!configured) return null;

  const start = () => {
    if (!signedIn) {
      dispatch(openSignInDialog());
      return;
    }
    void navigate('/builds/new', {
      state: saveHandoffState({
        bytes,
        fileName: file.name,
        sidecarVersion: file.sidecar.status === 'matched' ? file.sidecar.esrVersion : null,
      }),
    });
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="button" onClick={start}>
        <Hammer className="size-4" />
        Create a build from this character
      </Button>
      <p className="text-xs text-muted-foreground">
        {signedIn
          ? 'Opens the build form filled in from this save; nothing is saved until you do.'
          : 'Sign in first: builds are saved to your account.'}
      </p>
    </div>
  );
}

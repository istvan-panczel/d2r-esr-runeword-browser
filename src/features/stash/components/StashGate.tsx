import type { ReactNode } from 'react';
import { DevNotice } from '@/core/components/DevNotice';
import { Spinner } from '@/components/ui/spinner';
import { TriangleAlert } from 'lucide-react';
import type { StashFileMeta } from '../db/stashDb';
import { useStash } from '../hooks/useStash';
import type { StashFile } from '../parser/types';
import { StashFileBar } from './StashFileBar';
import { StashLoadErrorPanel } from './StashLoadErrorPanel';
import { StashUpload } from './StashUpload';

interface StashGateProps {
  /** The page body once a stash is loaded */
  readonly children: (stash: StashFile, file: StashFileMeta) => ReactNode;
}

/**
 * The frame of every My Stash page: the upload card until a stash is loaded, then the file bar and the page. A failed
 * upload is shown above either one; the stash loaded before it stays.
 */
export function StashGate({ children }: StashGateProps) {
  const { state, uploadError, storageWarning, dismissUploadError } = useStash();

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-6" />
        <span>Reading the remembered stash...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {uploadError !== null && <StashLoadErrorPanel error={uploadError} onDismiss={dismissUploadError} />}
      {storageWarning !== null && (
        <DevNotice icon={TriangleAlert} title="Not remembered.">
          {storageWarning}
        </DevNotice>
      )}
      {state.status === 'error' && <StashLoadErrorPanel error={state.error} fileName={state.file?.name} />}
      {state.status === 'ready' ? (
        <>
          <StashFileBar file={state.file} stash={state.stash} />
          {children(state.stash, state.file)}
        </>
      ) : (
        <StashUpload />
      )}
    </div>
  );
}

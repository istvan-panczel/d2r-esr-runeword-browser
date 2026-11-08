import type { ReactNode } from 'react';
import { Trash2, TriangleAlert } from 'lucide-react';
import { DevNotice } from '@/core/components/DevNotice';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { CharacterFileMeta } from '../db/characterDb';
import { useCharacter } from '../hooks/useCharacter';
import type { CharacterFile } from '../parser/types';
import { CharacterFileBar } from './CharacterFileBar';
import { CharacterLoadErrorPanel } from './CharacterLoadErrorPanel';
import { CharacterUpload } from './CharacterUpload';

interface CharacterGateProps {
  /** The page body once a character is loaded */
  readonly children: (character: CharacterFile, file: CharacterFileMeta) => ReactNode;
}

/**
 * The frame of the My Character page (the StashGate of a character): the upload card until a character is loaded, then
 * the file bar and the page; a failed upload above either one, and the remembered character stays.
 */
export function CharacterGate({ children }: CharacterGateProps) {
  const { state, uploadError, storageWarning, dismissUploadError, clear } = useCharacter();

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-6" />
        <span>Reading the remembered character...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {uploadError !== null && <CharacterLoadErrorPanel error={uploadError} onDismiss={dismissUploadError} />}
      {storageWarning !== null && (
        <DevNotice icon={TriangleAlert} title="Not remembered.">
          {storageWarning}
        </DevNotice>
      )}
      {state.status === 'error' && (
        <CharacterLoadErrorPanel
          error={state.error}
          fileName={state.file?.name}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void clear();
              }}
            >
              <Trash2 className="size-4" />
              Forget stored file
            </Button>
          }
        />
      )}
      {state.status === 'ready' ? (
        <>
          <CharacterFileBar file={state.file} />
          {children(state.character, state.file)}
        </>
      ) : (
        <CharacterUpload />
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Trash2, TriangleAlert, X } from 'lucide-react';
import { DevNotice } from '@/core/components/DevNotice';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { CharacterFileMeta } from '../db/characterDb';
import { useCharacter } from '../hooks/useCharacter';
import type { CharacterFile } from '../parser/types';
import { CharacterLoadErrorPanel } from './CharacterLoadErrorPanel';
import { CharacterPageBoundary } from './CharacterPageBoundary';
import { CharacterSwitcher } from './CharacterSwitcher';
import { CharacterUpload } from './CharacterUpload';

interface CharacterGateProps {
  /** The page body for the shown character */
  readonly children: (character: CharacterFile, file: CharacterFileMeta, bytes: Uint8Array) => ReactNode;
}

/**
 * The frame of the My Character page: the upload card until a character is stored, then the switcher and the page of the
 * shown character (or the error of a stored save the parser now rejects). A failed upload shows above either one, and
 * the stored characters stay.
 */
export function CharacterGate({ children }: CharacterGateProps) {
  const { list, selected, uploadErrors, storageWarning, dismissUploadErrors, remove } = useCharacter();

  if (list.status === 'loading') {
    return (
      <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-6" />
        <span>Reading the remembered characters...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {uploadErrors.length > 0 && (
        <div className="space-y-2">
          {uploadErrors.length > 1 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="font-medium">{uploadErrors.length} files could not be used</p>
              <Button type="button" variant="ghost" size="sm" onClick={dismissUploadErrors}>
                <X className="size-4" />
                Dismiss all
              </Button>
            </div>
          )}
          {uploadErrors.map((entry, index) => (
            <CharacterLoadErrorPanel
              key={`${String(index)}:${entry.fileName ?? ''}`}
              error={entry.error}
              fileName={entry.fileName ?? undefined}
              onDismiss={uploadErrors.length === 1 ? dismissUploadErrors : undefined}
            />
          ))}
        </div>
      )}
      {storageWarning !== null && (
        <DevNotice icon={TriangleAlert} title="Not remembered.">
          {storageWarning}
        </DevNotice>
      )}
      {list.status === 'error' && <CharacterLoadErrorPanel error={list.error} />}
      {selected === null ? (
        <CharacterUpload />
      ) : (
        <>
          <CharacterSwitcher current={selected} />
          {selected.result.ok ? (
            // Keyed by the stored save: an error in one character's page never hides the switcher, and another starts afresh
            <CharacterPageBoundary key={`${selected.key}:${String(selected.file.uploadedAt)}`}>
              {children(selected.result.character, selected.file, selected.bytes)}
            </CharacterPageBoundary>
          ) : (
            <CharacterLoadErrorPanel
              error={selected.result.error}
              fileName={selected.file.name}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void remove(selected.key);
                  }}
                >
                  <Trash2 className="size-4" />
                  Forget this save
                </Button>
              }
            />
          )}
        </>
      )}
    </div>
  );
}

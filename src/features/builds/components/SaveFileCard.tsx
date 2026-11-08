import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Lock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { BuildDraft } from '@/features/character/engine/buildDraft';
import { checkSaveUpload, draftFromSaveBytes, type SaveDraftError, type SaveDraftResult } from '@/features/character/engine/buildDraftRead';
import { STASH_FILE_LOCATION } from '@/features/stash/engine/readStash';
import { useFileDrop } from '@/features/stash/hooks/useFileDrop';
import { useSaveDraftData } from '../hooks/useSaveDraftData';

interface SaveFileReaderProps {
  readonly file: File;
  readonly onResult: (result: SaveDraftResult) => void;
}

/** Mounted once a file is picked, so the game data is fetched only then. Reads the file once its data is ready. */
function SaveFileReader({ file, onResult }: SaveFileReaderProps) {
  const state = useSaveDraftData();
  const started = useRef(false);

  useEffect(() => {
    if (state.status === 'loading' || started.current) return;
    started.current = true;
    if (state.status === 'error') {
      onResult({ ok: false, error: { title: 'Item data not available', message: state.message } });
      return;
    }
    file.arrayBuffer().then(
      (buffer) => {
        onResult(draftFromSaveBytes(new Uint8Array(buffer), file.name, state.stash, state.data));
      },
      () => {
        onResult({
          ok: false,
          error: { title: 'Could not open the file', message: `"${file.name}" could not be read. Try picking it again.` },
        });
      }
    );
  }, [file, state, onResult]);

  return null;
}

interface SaveFileCardProps {
  /** The file behind the current draft; null before any import */
  readonly importedFileName: string | null;
  /** Whether a new draft may replace the form as it stands. Asked before reading the file. */
  readonly confirmReplace: () => boolean;
  readonly onDraft: (draft: BuildDraft) => void;
}

/** Picks or drops a character .d2s and hands back a draft. Parsing happens in the browser; a failure leaves the form alone. */
export function SaveFileCard({ importedFileName, confirmReplace, onDraft }: SaveFileCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<SaveDraftError | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = file !== null;

  const handleFile = (picked: File) => {
    if (busy) return;
    const invalid = checkSaveUpload(picked.name, picked.size);
    if (invalid !== null) {
      setError(invalid);
      return;
    }
    if (!confirmReplace()) return;
    setError(null);
    setFile(picked);
  };

  const handleResult = (result: SaveDraftResult) => {
    setFile(null);
    if (result.ok) onDraft(result.draft);
    else setError(result.error);
  };

  const { dragging, handlers } = useFileDrop(handleFile);

  return (
    <section aria-labelledby="save-file-title" className="mb-5 space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div
        {...handlers}
        className={cn(
          'flex flex-col gap-3 rounded-lg border-2 border-dashed p-3 transition-colors sm:flex-row sm:items-center',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
        )}
      >
        {busy ? <Spinner className="size-6 shrink-0" /> : <FileUp className="size-6 shrink-0 text-muted-foreground" aria-hidden />}
        <div className="min-w-0 flex-1">
          <h2 id="save-file-title" className="font-semibold">
            Start from a save file
          </h2>
          <p className="text-sm text-muted-foreground">
            {importedFileName === null
              ? 'Drop a character .d2s here to fill in the build below. You can edit everything before saving.'
              : `Filled in from ${importedFileName}. Pick another save to start over.`}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".d2s"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const picked = event.target.files?.item(0) ?? null;
            // Reset, so picking the same file again (after the game saved it) fires a change
            event.target.value = '';
            if (picked !== null) handleFile(picked);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            input.current?.click();
          }}
        >
          <Upload className="size-4" />
          {importedFileName === null ? 'Choose .d2s' : 'Use another save'}
        </Button>
      </div>

      {file !== null && <SaveFileReader file={file} onResult={handleResult} />}

      {error !== null && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">{error.title}</p>
            <p className="break-words">{error.message}</p>
            <p className="text-muted-foreground">You can still fill in the build by hand below.</p>
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          The file is read in your browser and never uploaded; only the build you save is stored. Saves are in{' '}
          <code className="break-all">{STASH_FILE_LOCATION}</code>.
        </span>
      </p>
    </section>
  );
}

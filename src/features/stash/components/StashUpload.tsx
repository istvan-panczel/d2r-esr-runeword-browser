import { FileUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { STASH_FILE_LOCATION, STASH_FILE_NAME } from '../engine/readStash';
import { useFileDrop } from '../hooks/useFileDrop';
import { useStash } from '../hooks/useStash';
import { CopyTextButton } from './CopyTextButton';
import { StashFileButton } from './StashFileButton';

/** The upload card: drop zone + file picker, where the file lives, and that it never leaves the browser. */
export function StashUpload() {
  const { upload, busy } = useStash();
  const { dragging, handlers } = useFileDrop((file) => {
    void upload(file);
  });

  return (
    <section aria-labelledby="stash-upload-title" className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <h2 id="stash-upload-title" className="text-lg font-semibold">
        Upload your shared stash
      </h2>
      <div
        {...handlers}
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
        )}
      >
        {busy ? <Spinner className="size-8" /> : <FileUp className="size-8 text-muted-foreground" aria-hidden />}
        <p className="text-sm">
          Drop <code className="rounded bg-muted px-1 break-all">{STASH_FILE_NAME}</code> here, or
        </p>
        <StashFileButton>Choose file</StashFileButton>
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium">Where the file is</p>
        <p className="text-muted-foreground">
          In the ESR save folder on Windows (paste the folder into the Explorer address bar). HardCore characters use the HardCore stash
          file next to it.
        </p>
        <div className="flex items-start gap-1 rounded-md bg-muted px-2 py-1.5">
          <code className="min-w-0 flex-1 text-xs break-all">
            {STASH_FILE_LOCATION}\{STASH_FILE_NAME}
          </code>
          <CopyTextButton text={STASH_FILE_LOCATION} label="Copy the folder path" />
        </div>
        <p className="text-xs text-muted-foreground">
          The old <code>SharedStashSoftCoreV2.d2i</code> in the same folder is the pre-3.2 stash and is not supported.
        </p>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          The file stays in your browser: it is read on this page and never sent anywhere. The page remembers the last file in this
          browser&apos;s storage so you do not have to upload it on every visit; clear it any time.
        </span>
      </p>
    </section>
  );
}

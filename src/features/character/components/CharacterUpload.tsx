import { FileUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { CopyTextButton } from '@/features/stash/components/CopyTextButton';
import { STASH_FILE_LOCATION } from '@/features/stash/engine/readStash';
import { useFilesDrop } from '@/features/stash/hooks/useFileDrop';
import { useCharacter } from '../hooks/useCharacter';
import { CharacterFileButton } from './CharacterFileButton';

/** The upload card (the page's empty state): drop zone + file picker, where the saves are, and that they never leave the browser. */
export function CharacterUpload() {
  const { upload, busy } = useCharacter();
  const { dragging, handlers } = useFilesDrop((files) => {
    void upload(files);
  });

  return (
    <section aria-labelledby="character-upload-title" className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <h2 id="character-upload-title" className="text-lg font-semibold">
        Upload your characters
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
          Drop one or more character saves (<code className="rounded bg-muted px-1">.d2s</code>) here, optionally together with their{' '}
          <code className="rounded bg-muted px-1">.d2rl</code> files, or
        </p>
        <CharacterFileButton>Choose files</CharacterFileButton>
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium">Where the files are</p>
        <p className="text-muted-foreground">
          In the ESR save folder on Windows (paste the folder into the Explorer address bar), named after each character. The{' '}
          <code>.d2rl</code> next to a save tells the exact ESR version that wrote it; without it the page goes by the date. You can select
          the whole folder&apos;s saves at once.
        </p>
        <div className="flex items-start gap-1 rounded-md bg-muted px-2 py-1.5">
          <code className="min-w-0 flex-1 text-xs break-all">{STASH_FILE_LOCATION}</code>
          <CopyTextButton text={STASH_FILE_LOCATION} label="Copy the folder path" />
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          The files stay in your browser: they are read on this page and never sent anywhere. The page remembers your characters in this
          browser&apos;s storage so you do not have to upload them on every visit; remove one or clear them all any time.
        </span>
      </p>
    </section>
  );
}

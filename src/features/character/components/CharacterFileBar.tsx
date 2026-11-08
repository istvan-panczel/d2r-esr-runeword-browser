import { FileCheck2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useFilesDrop } from '@/features/stash/hooks/useFileDrop';
import type { CharacterFileMeta } from '../db/characterDb';
import { useCharacter } from '../hooks/useCharacter';
import { CharacterFileButton } from './CharacterFileButton';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** The loaded save: file name, when it was uploaded; upload a newer one or forget it. */
export function CharacterFileBar({ file }: { readonly file: CharacterFileMeta }) {
  const { upload, clear } = useCharacter();
  const { dragging, handlers } = useFilesDrop((files) => {
    void upload(files);
  });

  return (
    <div
      {...handlers}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors',
        dragging && 'border-primary bg-primary/5'
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium break-all">
            {file.name}
            {file.sidecar.status === 'matched' && <span className="font-normal text-muted-foreground"> + {file.sidecar.name}</span>}
          </p>
          <p className="text-xs text-muted-foreground">Uploaded {DATE_FORMAT.format(file.uploadedAt)} · stays in this browser</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CharacterFileButton variant="outline" size="sm">
          Upload newer files
        </CharacterFileButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void clear();
          }}
        >
          <Trash2 className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}

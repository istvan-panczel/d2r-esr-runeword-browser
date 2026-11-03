import { FileCheck2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { StashFileMeta } from '../db/stashDb';
import { useFileDrop } from '../hooks/useFileDrop';
import { useStash } from '../hooks/useStash';
import type { StashFile } from '../parser/types';
import { StashFileButton } from './StashFileButton';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface StashFileBarProps {
  readonly file: StashFileMeta;
  readonly stash: StashFile;
}

/** The loaded file: name, when the game saved it and when it was uploaded, page count; upload a newer one or forget it. */
export function StashFileBar({ file, stash }: StashFileBarProps) {
  const { upload, clear } = useStash();
  const { dragging, handlers } = useFileDrop((dropped) => {
    void upload(dropped);
  });
  const pages = stash.sections.filter((section) => section.tabType === 'normal' && section.items.length > 0).length;
  const items = stash.sections.reduce((sum, section) => sum + section.items.length, 0);

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
          <p className="font-medium break-all">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {file.lastModified !== null && <>Saved by the game {DATE_FORMAT.format(file.lastModified)} · </>}
            Uploaded {DATE_FORMAT.format(file.uploadedAt)} · {pages} pages with items, {items} items · stays in this browser
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StashFileButton variant="outline" size="sm">
          Upload newer file
        </StashFileButton>
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

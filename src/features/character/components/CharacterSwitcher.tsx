import { ChevronsUpDown, Trash2, TriangleAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useFilesDrop } from '@/features/stash/hooks/useFileDrop';
import type { CharacterEntry } from '../engine/characterList';
import { useCharacter } from '../hooks/useCharacter';
import { CharacterFileButton } from './CharacterFileButton';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** "Barbarian · Level 102", or why the stored save cannot be shown */
function entrySummary(entry: CharacterEntry): string {
  if (!entry.result.ok) return 'Could not be read';
  const { className, level } = entry.result.character;
  return `${className} · Level ${String(level)}`;
}

function EntryItem({ entry }: { readonly entry: CharacterEntry }) {
  const saved = entry.result.ok ? DATE_FORMAT.format(entry.result.character.lastSavedAt * 1000) : null;
  return (
    <DropdownMenuRadioItem value={entry.key} className="items-start py-2">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium break-all">{entry.key}</span>
        <span className={cn('text-xs', entry.result.ok ? 'text-muted-foreground' : 'text-destructive')}>{entrySummary(entry)}</span>
        <span className="text-xs text-muted-foreground">
          {saved !== null && <>Saved {saved} · </>}Uploaded {DATE_FORMAT.format(entry.file.uploadedAt)}
        </span>
      </span>
    </DropdownMenuRadioItem>
  );
}

/**
 * The toolbar of a page with characters: which stored character is shown (a menu with name, class, level, last saved and
 * upload date), upload more saves (a save of a stored character replaces it), remove the shown one or clear them all.
 * Files dropped anywhere on it are uploaded.
 */
export function CharacterSwitcher({ current }: { readonly current: CharacterEntry }) {
  const { entries, select, upload, remove, clear, busy } = useCharacter();
  const { dragging, handlers } = useFilesDrop((files) => {
    void upload(files);
  });
  const { file } = current;

  return (
    <div
      {...handlers}
      className={cn(
        'space-y-2 rounded-xl border bg-card p-2 shadow-sm transition-colors sm:p-3',
        dragging && 'border-primary bg-primary/5'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-auto max-w-full min-w-0 justify-between gap-3 py-1.5 text-left sm:min-w-64"
              aria-label={`Character: ${current.key}. Switch character`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {current.result.ok ? (
                  <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{current.key}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{entrySummary(current)}</span>
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {entries.length === 1 ? '1 stored character' : `${String(entries.length)} stored characters`}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={current.key} onValueChange={select}>
              {entries.map((entry) => (
                <EntryItem key={entry.key} entry={entry} />
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <CharacterFileButton variant="outline" size="sm">
          Upload saves
        </CharacterFileButton>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Remove ${current.key} from this browser? You can upload the save again any time.`))
                void remove(current.key);
            }}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
          {entries.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm(`Remove all ${String(entries.length)} characters from this browser?`)) void clear();
              }}
            >
              Clear all
            </Button>
          )}
        </div>
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        <span className="break-all">{file.name}</span>
        {file.sidecar.status === 'matched' && <span className="break-all"> + {file.sidecar.name}</span>} · uploaded{' '}
        {DATE_TIME_FORMAT.format(file.uploadedAt)} · stays in this browser. Drop saves here to add characters; a newer save of a stored
        character replaces it.
      </p>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Copy, LogIn, Pencil, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { LootFilterEntry, LootFilterSource } from '../store/types';
import { summarizeEntry } from '../utils/entrySummary';
import { referencedAssetsOfText } from '../utils/referencedAssets';
import { FilterDownloadMenu } from './FilterDownloadMenu';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const SOURCE_LABELS: Readonly<Record<LootFilterSource, string>> = {
  blank: 'New',
  upload: 'Uploaded',
  template: 'Template',
};

/** What the card's Save does: open the editor's Save dialog, or ask to sign in first. */
export type EntrySaveAction = { readonly kind: 'link'; readonly to: string } | { readonly kind: 'sign-in'; readonly onSignIn: () => void };

interface LibraryEntryCardProps {
  readonly entry: LootFilterEntry;
  /** Where Open (and the name) go. */
  readonly openTo: string;
  /** Save; omitted when sharing is off (no Supabase). */
  readonly save?: EntrySaveAction;
  readonly onDuplicate: () => void;
  /** Rename; omitted for the edits of a saved filter (its name is a server field, changed in the editor's Details). */
  readonly onRename?: () => void;
  readonly onDelete: () => void;
  /** "Discard" for drafts once filters can be saved, "Delete" while the browser is the only store. */
  readonly deleteLabel?: string;
}

/** A draft in this browser: a new filter, or the unsaved edits of a saved one (`entry.savedId`). */
export function LibraryEntryCard({ entry, openTo, save, onDuplicate, onRename, onDelete, deleteLabel = 'Delete' }: LibraryEntryCardProps) {
  const summary = summarizeEntry(entry.text);
  const byline = [summary.title, summary.author === null ? null : `by ${summary.author}`].filter((part) => part !== null).join(' ');
  const editsSaved = entry.savedId !== undefined;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={openTo} className="block truncate font-semibold leading-tight hover:underline">
            {entry.name}
          </Link>
          {byline !== '' && <p className="mt-0.5 truncate text-sm text-muted-foreground">{byline}</p>}
        </div>
        {editsSaved ? (
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
            Unsaved changes
          </Badge>
        ) : (
          <Badge variant="outline">{SOURCE_LABELS[entry.source]}</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {summary.readable ? (
          <span>
            {summary.ruleCount} {summary.ruleCount === 1 ? 'rule' : 'rules'}
          </span>
        ) : (
          <span className="text-destructive">Not valid JSON: open it to fix</span>
        )}
        <span>Updated {dateFormatter.format(entry.updatedAt)}</span>
        {entry.basedOn !== undefined && <span>Based on {entry.basedOn.label}</span>}
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link to={openTo}>Open</Link>
        </Button>
        {save?.kind === 'link' && (
          <Button size="sm" variant="outline" asChild>
            <Link to={save.to}>
              <Save />
              Save
            </Link>
          </Button>
        )}
        {save?.kind === 'sign-in' && (
          <Button size="sm" variant="outline" onClick={save.onSignIn} title="Sign in to save this filter to your account">
            <LogIn />
            Sign in to save
          </Button>
        )}
        <FilterDownloadMenu name={entry.name} getText={() => entry.text} assets={referencedAssetsOfText(entry.text)} variant="outline" />
        <Button size="sm" variant="ghost" onClick={onDuplicate} aria-label={`Duplicate ${entry.name}`}>
          <Copy />
          Duplicate
        </Button>
        {onRename !== undefined && (
          <Button size="sm" variant="ghost" onClick={onRename} aria-label={`Rename ${entry.name}`}>
            <Pencil />
            Rename
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`${deleteLabel} ${entry.name}`}
        >
          <Trash2 />
          {deleteLabel}
        </Button>
      </div>
    </Card>
  );
}

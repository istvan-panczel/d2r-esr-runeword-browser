import { useId } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ListPlus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CommentAddress, HeadingRow, NoteRow } from '../../utils/sections';

/** Hover/focus toolbar of a heading or note row, as on rule rows: floats over the row's end with a mouse, a line on touch. */
const TOOLBAR = cn(
  'ml-auto flex shrink-0 items-start gap-0.5 pr-1 pb-1 transition-opacity',
  'pointer-fine:absolute pointer-fine:top-0.5 pointer-fine:right-0.5 pointer-fine:rounded-md pointer-fine:bg-card pointer-fine:py-0.5 pointer-fine:pl-0.5 pointer-fine:shadow-xs',
  'pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100'
);

interface HeadingRowViewProps {
  readonly row: HeadingRow;
  /** What the list holds, for the labels ("rules", "styles"). */
  readonly noun: string;
  /** Moving a section is off while a search filters the list. */
  readonly canMove: boolean;
  /** Folding is off while a search filters the list (a search lists its matches whatever is folded). Default true. */
  readonly canFold?: boolean;
  readonly onToggle: (row: HeadingRow) => void;
  readonly onEdit: (row: HeadingRow) => void;
  readonly onMove: (address: CommentAddress, direction: -1 | 1) => void;
  readonly onRemove: (address: CommentAddress) => void;
  /** Adds an item at the end of the section (the rule list only). */
  readonly onAddItem?: (address: CommentAddress) => void;
  /**
   * A marker after the title, shown folded or open (the Protection part: where Add rule puts new rules). `label` must
   * read on its own (touch has no tooltip); `description` is its tooltip and the row's accessible description.
   */
  readonly badge?: { readonly label: string; readonly description: string };
  readonly className?: string;
}

/** A `// ====` part or `// ----` section: click to fold; edit, add a rule, move the section, remove the heading. */
export function HeadingRowView({
  row,
  noun,
  canMove,
  canFold = true,
  onToggle,
  onEdit,
  onMove,
  onRemove,
  onAddItem,
  badge,
  className,
}: HeadingRowViewProps) {
  const badgeId = useId();
  const Chevron = row.collapsed ? ChevronRight : ChevronDown;
  const part = row.level === 1;
  const kind = part ? 'part' : 'section';
  return (
    <li data-section-heading={row.level} className={cn('group relative flex flex-wrap', part ? 'bg-muted' : 'bg-muted/40', className)}>
      <button
        type="button"
        disabled={!canFold}
        aria-expanded={canFold ? !row.collapsed : undefined}
        aria-describedby={badge === undefined ? undefined : badgeId}
        title={!canFold ? `Folds do not apply while searching` : row.collapsed ? `Show the ${noun} of this ${kind}` : `Fold this ${kind}`}
        className={cn(
          'flex min-w-0 flex-1 basis-full items-center gap-1.5 py-1.5 pr-3 text-left enabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
          part ? 'pl-2 text-sm font-semibold' : 'pl-5 text-sm font-medium'
        )}
        onClick={() => {
          onToggle(row);
        }}
      >
        <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {/* The badge follows the title (not the row's end, where the hover toolbar floats over the count). */}
        <span className="min-w-0 flex-1 break-words">
          {row.title}
          {badge !== undefined && (
            <Badge
              variant="outline"
              className="ml-2 border-emerald-600/50 px-1.5 py-0 align-middle text-[0.7rem] font-medium text-emerald-700 dark:text-emerald-300"
              title={badge.description}
            >
              {badge.label}
            </Badge>
          )}
        </span>
        <span
          className="shrink-0 font-mono text-xs font-normal text-muted-foreground tabular-nums"
          title={`${String(row.itemCount)} ${noun}`}
        >
          {row.itemCount}
        </span>
      </button>
      {badge !== undefined && (
        <span id={badgeId} className="sr-only">
          {badge.description}
        </span>
      )}
      {row.notes.length > 0 && !row.collapsed && (
        <p
          className={cn(
            'basis-full pr-3 pb-1.5 text-xs break-words whitespace-pre-line text-muted-foreground',
            part ? 'pl-[1.875rem]' : 'pl-[2.625rem]'
          )}
        >
          {row.notes.join('\n')}
        </p>
      )}
      <div className={TOOLBAR}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label={`Edit ${kind} ${row.title}`}
          title={`Edit the ${kind} title and description`}
          onClick={() => {
            onEdit(row);
          }}
        >
          <Pencil />
        </Button>
        {onAddItem && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label={`Add a rule to ${row.title}`}
            title={`Add a rule at the end of this ${kind}`}
            onClick={() => {
              onAddItem(row.address);
            }}
          >
            <ListPlus />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={!canMove || !row.canMoveUp}
          aria-label={`Move ${kind} ${row.title} up`}
          title={`Move the ${kind} and its ${noun} above the previous ${kind}`}
          onClick={() => {
            onMove(row.address, -1);
          }}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          disabled={!canMove || !row.canMoveDown}
          aria-label={`Move ${kind} ${row.title} down`}
          title={`Move the ${kind} and its ${noun} below the next ${kind}`}
          onClick={() => {
            onMove(row.address, 1);
          }}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 hover:text-destructive"
          aria-label={`Remove heading ${row.title}`}
          title={`Remove the heading and its description; the ${noun} stay`}
          onClick={() => {
            onRemove(row.address);
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

interface NoteRowViewProps {
  readonly row: NoteRow;
  readonly onEdit: (row: NoteRow) => void;
  readonly onRemove: (row: NoteRow) => void;
}

/** A comment between items that is not a heading. */
export function NoteRowView({ row, onEdit, onRemove }: NoteRowViewProps) {
  return (
    <li className="group relative flex flex-wrap">
      <p className="basis-full py-1 pr-3 pl-[2.625rem] text-xs break-words whitespace-pre-line text-muted-foreground italic">{row.text}</p>
      <div className={TOOLBAR}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Edit note"
          title="Edit the note"
          onClick={() => {
            onEdit(row);
          }}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 hover:text-destructive"
          aria-label="Remove note"
          title="Remove the note"
          onClick={() => {
            onRemove(row);
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

interface SectionToolbarProps {
  /** Where Add section puts the heading, for its tooltip ("above the selected rule"). */
  readonly addWhere: string;
  readonly onAdd: () => void;
  /** Collapse all / Expand all, when the list has headings. */
  readonly onCollapseAll?: () => void;
  readonly onExpandAll?: () => void;
}

/** Add section · Collapse all · Expand all, as small text buttons under a list's header (folds are remembered per filter). */
export function SectionToolbar({ addWhere, onAdd, onCollapseAll, onExpandAll }: SectionToolbarProps) {
  const link = 'text-muted-foreground underline underline-offset-2 hover:text-foreground';
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <button type="button" className={link} title={`Add a heading or a note ${addWhere}`} onClick={onAdd}>
        Add section
      </button>
      {onCollapseAll && (
        <button type="button" className={link} title="Fold every heading: only the parts show" onClick={onCollapseAll}>
          Collapse all
        </button>
      )}
      {onExpandAll && (
        <button type="button" className={link} onClick={onExpandAll}>
          Expand all
        </button>
      )}
    </div>
  );
}

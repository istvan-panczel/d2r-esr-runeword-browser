import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { headingLine, noteLines, type HeadingLevel, type HeadingRow, type NoteRow, type SectionEdit } from '../../utils/sections';

/** What the dialog edits: a new heading or note above item `at`, an existing heading, an existing note. */
export type SectionDialogState =
  | { readonly kind: 'add'; readonly at: number; readonly where: string }
  | { readonly kind: 'heading'; readonly row: HeadingRow }
  | { readonly kind: 'note'; readonly row: NoteRow };

type Kind = 'part' | 'section' | 'note';

interface SectionDialogProps {
  readonly state: SectionDialogState | null;
  readonly onClose: () => void;
  readonly onEdit: (edit: SectionEdit) => void;
}

/** Adds or edits a heading (part or section) or a note: the comment lines the file gets are shown as they are typed. */
export function SectionDialog({ state, onClose, onEdit }: SectionDialogProps) {
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {state !== null && <SectionForm state={state} onClose={onClose} onEdit={onEdit} />}
      </DialogContent>
    </Dialog>
  );
}

const LEVEL: Readonly<Record<Exclude<Kind, 'note'>, HeadingLevel>> = { part: 1, section: 2 };

function initialKind(state: SectionDialogState): Kind {
  if (state.kind === 'note') return 'note';
  if (state.kind === 'heading') return state.row.level === 1 ? 'part' : 'section';
  return 'section';
}

function SectionForm({ state, onClose, onEdit }: { readonly state: SectionDialogState } & Omit<SectionDialogProps, 'state'>) {
  const [kind, setKind] = useState<Kind>(() => initialKind(state));
  const [title, setTitle] = useState(state.kind === 'heading' ? state.row.title : '');
  const [text, setText] = useState(state.kind === 'heading' ? state.row.notes.join('\n') : state.kind === 'note' ? state.row.text : '');
  const isNote = kind === 'note';
  const kinds: readonly Kind[] = state.kind === 'add' ? ['part', 'section', 'note'] : state.kind === 'heading' ? ['part', 'section'] : [];
  const lines = isNote ? noteLines(text) : [headingLine(LEVEL[kind], title || 'Title'), ...noteLines(text)];
  const ready = isNote ? state.kind === 'note' || lines.length > 0 : title.trim() !== '';

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!ready) return;
    if (state.kind === 'add') onEdit({ kind: 'insert', at: state.at, lines });
    else if (state.kind === 'heading' && !isNote) {
      onEdit({ kind: 'heading', address: state.row.address, level: LEVEL[kind], title, description: text });
    } else if (state.kind === 'note') {
      onEdit({ kind: 'replace', address: state.row.address, count: state.row.count, lines });
    }
    onClose();
  };

  const heading = state.kind === 'add' ? 'Add a heading or note' : state.kind === 'heading' ? 'Edit heading' : 'Edit note';
  return (
    <>
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription>
          {state.kind === 'add' ? `Goes ${state.where}. ` : ''}A part (// ====) groups sections, a section (// ----) groups rules up to the
          next heading; a note is a comment in place. The game ignores comments.
        </DialogDescription>
      </DialogHeader>
      {/* min-w-0: the dialog is a grid, and a long comment line in the textarea or the preview would widen its column past the dialog. */}
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
        {kinds.length > 0 && (
          <div className="flex gap-1" role="radiogroup" aria-label="Kind">
            {kinds.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={kind === option ? 'default' : 'outline'}
                role="radio"
                aria-checked={kind === option}
                onClick={() => {
                  setKind(option);
                }}
              >
                {option === 'part' ? 'Part' : option === 'section' ? 'Section' : 'Note'}
              </Button>
            ))}
          </div>
        )}
        {!isNote && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="section-title">Title</Label>
            <Input
              id="section-title"
              value={title}
              autoFocus
              placeholder={kind === 'part' ? 'PART 1 - HIDING' : '1.1 Gold'}
              onChange={(event) => {
                setTitle(event.target.value.replace(/[\r\n]/g, ' '));
              }}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="section-text">{isNote ? 'Note' : 'Description (optional)'}</Label>
          <Textarea
            id="section-text"
            value={text}
            rows={3}
            autoFocus={isNote}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
          {state.kind === 'note' && <p className="text-xs text-muted-foreground">Empty removes the note.</p>}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">In the file</span>
          <pre
            className={cn('overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs', lines.length === 0 && 'text-muted-foreground')}
          >
            {lines.length === 0 ? '(nothing)' : lines.join('\n')}
          </pre>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready}>
            {state.kind === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

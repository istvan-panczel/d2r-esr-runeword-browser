import { useState } from 'react';
import { CircleAlert, ClipboardPaste, MessageSquareShare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LootFilterReference } from '../../engine/types';
import { validateLootFilter } from '../../engine/validate';
import { countDiagnostics } from '../../store/selectors';
import { extractFilterFromAnswer, type AiAnswerResult, type AiAnswerSuccess } from '../../utils/aiAnswer';
import { resendMessage } from '../../utils/aiFollowUp';
import { copyText } from './copyText';

/** `replace`: the open filter's content is replaced; `create`: a new draft with this name is made and opened. */
export type ImportAiAnswerMode = { readonly kind: 'replace' } | { readonly kind: 'create'; readonly name: string };

interface ImportAiAnswerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: ImportAiAnswerMode;
  /** For the problem count before importing; the empty reference counts only the shape problems. */
  readonly reference: LootFilterReference;
  readonly onImport: (answer: AiAnswerSuccess) => void;
}

/**
 * "Import AI answer": the user pastes the LLM's whole reply; the filter JSON is read out of it (prose and code fences
 * dropped, the last complete filter of several), and after a confirm it replaces the open filter or becomes a new draft.
 * Without readable JSON it offers a message asking the LLM to resend the complete filter. Rendered only while open, so
 * every opening starts empty.
 */
export function ImportAiAnswerDialog({ open, onOpenChange, ...props }: ImportAiAnswerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <ImportForm
            {...props}
            onCancel={() => {
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ImportFormProps extends Omit<ImportAiAnswerDialogProps, 'open' | 'onOpenChange'> {
  readonly onCancel: () => void;
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

function ImportForm({ mode, reference, onImport, onCancel }: ImportFormProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<AiAnswerResult | null>(null);

  const read = () => {
    setResult(extractFilterFromAnswer(text));
  };

  const found = result?.ok === true ? result : null;
  const failed = result !== null && !result.ok ? result : null;
  const counts =
    found === null ? null : countDiagnostics([...found.notes, ...found.diagnostics, ...validateLootFilter(found.filter, reference)]);
  const styleCount = found === null ? 0 : Object.keys(found.filter.styles ?? {}).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import AI answer</DialogTitle>
        <DialogDescription>
          Paste the AI&apos;s whole answer: the text around the filter and the code fences are dropped. With several JSON blocks, the last
          complete filter is taken.
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="loot-filter-ai-answer">The AI&apos;s answer</Label>
        <Textarea
          id="loot-filter-ai-answer"
          value={text}
          autoFocus
          spellCheck={false}
          placeholder={'Here is your filter:\n```json\n{ "formatVersion": 1, … }\n```'}
          className="max-h-[50vh] min-h-48 overflow-auto font-mono text-xs field-sizing-fixed"
          onChange={(event) => {
            setText(event.target.value);
            setResult(null);
          }}
        />
      </div>

      {failed !== null && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          <p className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <span>
              {failed.kind === 'empty'
                ? 'Paste the answer first.'
                : failed.kind === 'none'
                  ? 'No filter JSON found in this answer. The AI may still be asking questions; answer them, or ask it for the complete filter.'
                  : failed.kind === 'syntax'
                    ? `The JSON cannot be read: ${failed.message}. The answer may have been cut off.`
                    : `This JSON is not a complete filter: ${failed.message}.`}
            </span>
          </p>
          {failed.kind !== 'empty' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void copyText(resendMessage(failed), 'Copied the message', 'Paste it into the AI chat.')}
            >
              <MessageSquareShare />
              Copy a message asking the AI to resend the filter
            </Button>
          )}
        </div>
      )}

      {found !== null && counts !== null && (
        <div className="space-y-1 rounded-md border px-3 py-2 text-sm">
          <p>
            Found {found.filter.title === undefined ? 'a filter' : <>&ldquo;{found.filter.title}&rdquo;</>}:{' '}
            {plural(found.filter.rules.length, 'rule')}, {plural(styleCount, 'style')},{' '}
            {plural(found.filter.filterLevels?.length ?? 0, 'level')}.{' '}
            {counts.errors + counts.warnings === 0
              ? 'No problems found.'
              : `${plural(counts.errors, 'error')} and ${plural(counts.warnings, 'warning')}: the editor lists them after the import, with a button to copy them for the AI.`}
          </p>
          <p className="text-muted-foreground">
            {mode.kind === 'replace'
              ? 'Importing replaces the whole content of the open filter with this one.'
              : `Importing creates the draft “${mode.name}” in this browser and opens it.`}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {found === null ? (
          <Button type="button" onClick={read} disabled={text.trim() === ''}>
            <ClipboardPaste />
            Read the answer
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => {
              onImport(found);
            }}
          >
            {mode.kind === 'replace' ? 'Replace the filter' : 'Create the draft'}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

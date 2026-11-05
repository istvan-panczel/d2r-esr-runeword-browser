import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Check, ClipboardCopy, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { selectTheme } from '@/features/settings';
import { JsoncSyntaxError } from '../engine/jsonc';
import { locateJsoncPath } from '../engine/jsoncLocate';
import { jsoncErrorOffset } from '../engine/jsoncProblem';
import { parseLootFilter } from '../engine/parse';
import { serializeLootFilter } from '../engine/serialize';
import type { Diagnostic, LootFilter } from '../engine/types';
import { replaceFilter } from '../store/lootFilterSlice';
import { DIAGNOSTICS_LIST_ID, DiagnosticsList } from './DiagnosticsList';
import type { JsonCodeEditorHandle } from './json-editor/JsonCodeEditor';

// CodeMirror is a chunk of its own: only this tab loads it.
const JsonCodeEditor = lazy(() => import('./json-editor/JsonCodeEditor'));

interface JsonTabProps {
  /** The open model; null when the entry's text is not valid JSON (then the draft starts from `entryText`). */
  readonly filter: LootFilter | null;
  readonly entryText: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly onShowRule: (index: number) => void;
  /** The unapplied text, held by the editor screen so it survives tab switches; null while the text follows the model. */
  readonly draft: JsonDraft | null;
  readonly onDraftChange: (draft: JsonDraft | null) => void;
  /** Non-zero: scroll to the problems list (once this tab has rendered), then `onScrolledToProblems` resets it. */
  readonly scrollToProblems: number;
  readonly onScrolledToProblems: () => void;
}

export interface JsonDraft {
  /** The model text the draft was taken from. */
  readonly base: string;
  readonly text: string;
}

interface SyntaxProblem {
  readonly message: string;
}

/** Holds the editor's place (same size and frame) while its chunk loads. */
function EditorPlaceholder() {
  return (
    <div className="flex h-[60vh] min-h-64 items-center justify-center rounded-md border border-input text-sm text-muted-foreground">
      Loading editor…
    </div>
  );
}

/**
 * The filter file as text. The text follows the model (form edits in the other tabs) until the user types in it; then
 * the draft stays, also across tab switches, until Apply (parse and replace the model) or Revert.
 */
export function JsonTab({
  filter,
  entryText,
  diagnostics,
  onShowRule,
  draft,
  onDraftChange,
  scrollToProblems,
  onScrolledToProblems,
}: JsonTabProps) {
  const dispatch = useDispatch();
  const editor = useRef<JsonCodeEditorHandle>(null);
  const theme = useSelector(selectTheme);
  const modelText = filter === null ? entryText : serializeLootFilter(filter);
  const [problem, setProblem] = useState<SyntaxProblem | null>(null);

  const base = draft?.base ?? modelText;
  const text = draft?.text ?? modelText;
  const edited = text !== base;
  // The model changed (an edit in another editor tab) after the user started typing here.
  const stale = edited && base !== modelText;

  useEffect(() => {
    if (scrollToProblems === 0) return;
    document.getElementById(DIAGNOSTICS_LIST_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onScrolledToProblems();
  }, [scrollToProblems, onScrolledToProblems]);

  const handleApply = () => {
    try {
      const { filter: parsed, diagnostics: parseDiagnostics, notes } = parseLootFilter(text);
      dispatch(replaceFilter({ filter: parsed, diagnostics: parseDiagnostics, notes }));
      // The text follows the model again: the re-serialized draft (strict JSON, comments after the brace gone).
      onDraftChange(null);
      setProblem(null);
      toast.success('Applied', { description: notes.length === 0 ? undefined : notes.map((note) => `${note.message}.`).join(' ') });
    } catch (error) {
      if (error instanceof JsoncSyntaxError) {
        setProblem({ message: error.message });
        const offset = jsoncErrorOffset(text, error);
        if (offset !== undefined) editor.current?.select(offset, offset + 1);
      } else {
        setProblem({ message: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  const handleRevert = () => {
    onDraftChange(null);
    setProblem(null);
  };

  const handleShowInJson = (diagnostic: Diagnostic) => {
    // The current text (the draft, when there is one): the path may sit elsewhere than in the model's text, or be gone.
    const range = locateJsoncPath(text, diagnostic.path);
    if (range) editor.current?.select(range.from, range.to);
    else toast.info('Not found in the current text');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied to the clipboard'),
      () => toast.error('Could not copy to the clipboard')
    );
  };

  return (
    // Wide pages (from @9xl/page): the problems list sits beside the editor, so Show in JSON and the text are both in view.
    <div className="space-y-6 @9xl/page:grid @9xl/page:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] @9xl/page:items-start @9xl/page:gap-6 @9xl/page:space-y-0 @10xl/page:grid-cols-[minmax(0,1fr)_minmax(0,40rem)]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleApply} disabled={!edited && filter !== null}>
            <Check />
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={handleRevert} disabled={!edited}>
            <Undo2 />
            Revert
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <ClipboardCopy />
            Copy
          </Button>
          {edited && <span className="text-xs text-muted-foreground">Unapplied changes</span>}
        </div>
        {stale && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            The filter was changed in another editor tab since you started typing here. Apply replaces those changes with this text; Revert
            drops this text and loads them.
          </p>
        )}
        <Suspense fallback={<EditorPlaceholder />}>
          <JsonCodeEditor
            ref={editor}
            value={text}
            onChange={(next) => {
              // The live marker in the editor takes over from the failed Apply's message.
              setProblem(null);
              // Typed back to where it started: the text follows the model again (as before the first keystroke).
              onDraftChange(next === base ? null : { base, text: next });
            }}
            dark={theme === 'dark'}
            ariaLabel="Filter file (JSON)"
            invalid={problem !== null}
          />
        </Suspense>
        {problem !== null && (
          <p role="alert" className="text-sm text-destructive">
            Not applied: {problem.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground @8xl/page:max-w-4xl">
          Apply reads the text like an upload. Only the <code>{'//'}</code> comment lines at the top of the file are kept; comments between
          rules are not shown here and are dropped by Apply and by any edit in the other tabs. Syntax errors are underlined as you type; the
          coloured chips at the left show each rule&apos;s and style&apos;s label look (hover for details); Ctrl/Cmd+F searches.
        </p>
      </div>

      <DiagnosticsList diagnostics={diagnostics} onShowRule={onShowRule} onShowInJson={handleShowInJson} filter={filter} />
    </div>
  );
}

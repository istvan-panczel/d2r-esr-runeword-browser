/**
 * The loot filter file as a CodeMirror 6 editor (JSONC highlighting, folding, search, syntax lint, label chips). This
 * module is the entry of a lazily loaded chunk: everything CodeMirror is imported from here or below.
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { cn } from '@/lib/utils';
import {
  attributesCompartment,
  clamp,
  contentAttributes,
  diffChange,
  jsonEditorExtensions,
  themeCompartment,
  themeExtension,
} from './editorSetup';
import { externalChange } from './labelChipGutter';

/** What the editor exposes to its parent through `ref`. */
export interface JsonCodeEditorHandle {
  /** Focuses the editor, selects `from`–`to` (0-based offsets, clamped) and scrolls it to the centre, page included. */
  select(from: number, to: number): void;
  focus(): void;
}

interface JsonCodeEditorProps {
  readonly value: string;
  /** Called with the whole text after each user edit; not for changes of `value` itself. */
  readonly onChange: (value: string) => void;
  /** VS Code dark or light; the caller passes the app theme (`selectTheme(state) === 'dark'`). */
  readonly dark: boolean;
  readonly ariaLabel: string;
  readonly invalid?: boolean;
  readonly ref?: Ref<JsonCodeEditorHandle>;
  /** Classes for the resizable wrapper (its default height is 60vh). */
  readonly className?: string;
}

/**
 * A controlled JSONC editor. The view is created once; a new `value` that differs from the text replaces it without an
 * undo step and without calling `onChange`.
 */
export function JsonCodeEditor({ value, onChange, dark, ariaLabel, invalid = false, ref, className }: JsonCodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Created empty: the effects below (run after this one, also on mount) load the text, theme and attributes.
  useEffect(() => {
    const parent = host.current;
    if (parent === null) return;
    const editor = new EditorView({
      parent,
      state: EditorState.create({
        extensions: [
          jsonEditorExtensions(),
          themeCompartment.of([]),
          attributesCompartment.of([]),
          EditorView.updateListener.of((update) => {
            if (update.transactions.some((tr) => tr.docChanged && tr.annotation(externalChange) !== true)) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor === null) return;
    const current = editor.state.doc.toString();
    if (current === value) return;
    editor.dispatch({
      changes: diffChange(current, value),
      annotations: [externalChange.of(true), Transaction.addToHistory.of(false)],
    });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: themeCompartment.reconfigure(themeExtension(dark)) });
  }, [dark]);

  useEffect(() => {
    view.current?.dispatch({ effects: attributesCompartment.reconfigure(contentAttributes(ariaLabel, invalid)) });
  }, [ariaLabel, invalid]);

  useImperativeHandle(
    ref,
    () => ({
      select(from, to) {
        const editor = view.current;
        if (editor === null) return;
        const length = editor.state.doc.length;
        const anchor = clamp(from, length);
        const head = clamp(to, length);
        // The editor's own scroll centres only inside its scroller and moves the page just enough to show the line, which
        // leaves the editor at the window edge: bring the whole box into view on the page first (instantly).
        const box = host.current;
        if (box !== null) {
          const rect = box.getBoundingClientRect();
          if (rect.top < 0 || rect.bottom > window.innerHeight) box.scrollIntoView({ block: 'center' });
        }
        editor.focus();
        editor.dispatch({ selection: { anchor, head }, effects: EditorView.scrollIntoView(anchor, { y: 'center' }) });
      },
      focus() {
        view.current?.focus();
      },
    }),
    []
  );

  return (
    <div
      ref={host}
      className={cn(
        'h-[60vh] min-h-64 resize-y overflow-hidden rounded-md border border-input shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        invalid &&
          'border-destructive focus-within:border-destructive focus-within:ring-destructive/20 dark:focus-within:ring-destructive/40',
        className
      )}
    />
  );
}

export default JsonCodeEditor;

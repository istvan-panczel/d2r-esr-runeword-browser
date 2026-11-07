import { useRef, useState } from 'react';
import { Braces, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { COLOR_CODES } from '../../engine/colors';
import { PLACEHOLDERS, findPlaceholder, listPlaceholders, resolveText, type PlaceholderContext } from '../../engine/text';
import type { FilterText } from '../../engine/types';
import { previewPlaceholders } from '../../utils/effectiveActions';
import { insertAtCaret } from '../../utils/insertAtCaret';
import { Field } from '../Field';
import { LabelPreview } from '../LabelPreview';

interface ColorTextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: FilterText | undefined;
  /** The new plain string, or undefined when emptied. */
  readonly onChange: (value: string | undefined) => void;
  /** Which placeholders the insert menu offers and the field accepts. */
  readonly context: PlaceholderContext;
  readonly placeholder?: string;
  readonly hint?: React.ReactNode;
  /** The colour code before the first `ÿc` in the preview (`=` for labels, `0` for chat). */
  readonly defaultColor?: string;
  /** Shown after the label (the rule editor's "advanced" tag). */
  readonly badge?: React.ReactNode;
}

const CONTEXT_NAMES: Readonly<Record<PlaceholderContext, string>> = {
  names: 'item names',
  chat: 'chat lines',
  dropFormat: 'the drop line',
  levelChangeFormat: 'the level change line',
};

function placeholderProblems(text: string, context: PlaceholderContext): string[] {
  const problems: string[] = [];
  for (const token of new Set(listPlaceholders(text))) {
    const known = findPlaceholder(token);
    if (!known) problems.push(`${token} is not a placeholder the plugin knows; it is printed as written.`);
    else if (!known.contexts.includes(context)) problems.push(`${token} does not work in ${CONTEXT_NAMES[context]}.`);
  }
  return problems;
}

/**
 * A text field for a `FilterText` with raw `ÿc` colour codes: insert menus for colour codes and the
 * placeholders of its context, a small live preview, and hints for unknown placeholders. A per-language
 * text is shown read-only (it is edited in the JSON tab).
 */
export function ColorTextField({ id, label, value, onChange, context, placeholder, hint, defaultColor = '=', badge }: ColorTextFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [placeholdersOpen, setPlaceholdersOpen] = useState(false);
  // Where the caret goes after an insert. Set by `insert`, used once the menu has closed: Radix's close auto-focus
  // (after the close animation) would otherwise move the focus back to the menu button.
  const pendingCaret = useRef<number | null>(null);

  if (typeof value === 'object') {
    const enUS = resolveText(value);
    return (
      <Field id={id} label={label} badge={badge}>
        <div id={id} className="rounded-md border border-dashed px-3 py-2 text-sm">
          <p className="text-muted-foreground">Multi-language text, edit in the JSON tab.</p>
          {enUS !== undefined && <p className="mt-1 break-all font-mono text-xs">enUS: {enUS}</p>}
        </div>
        {enUS !== undefined && (
          <LabelPreview text={previewPlaceholders(enUS)} defaultColor={defaultColor} className="px-2 py-1.5 text-sm" />
        )}
      </Field>
    );
  }

  const text = value ?? '';
  const insert = (token: string) => {
    const input = inputRef.current;
    const result = insertAtCaret(text, token, input?.selectionStart ?? null, input?.selectionEnd ?? null);
    pendingCaret.current = result.caret;
    onChange(result.text);
  };
  // The menu has closed: after an insert, focus the field with the caret right after the inserted token instead of
  // letting Radix refocus the menu button. Closing without an insert (Escape, outside click) keeps Radix's behaviour.
  const restoreCaret = (event: Event) => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    event.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(caret, caret);
  };
  const problems = placeholderProblems(text, context);
  const offered = PLACEHOLDERS.filter((entry) => entry.contexts.includes(context));

  return (
    <Field id={id} label={label} hint={hint} badge={badge}>
      <div className="flex gap-1">
        <Input
          ref={inputRef}
          id={id}
          value={text}
          placeholder={placeholder}
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            onChange(event.target.value === '' ? undefined : event.target.value);
          }}
        />
        <Popover open={colorsOpen} onOpenChange={setColorsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Insert a colour code into ${label}`}
              title="Insert a colour code"
            >
              <Palette />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="max-h-80 w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-2"
            onCloseAutoFocus={restoreCaret}
          >
            <div className="grid grid-cols-2 gap-1">
              {COLOR_CODES.map((entry) => (
                <button
                  key={entry.code}
                  type="button"
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
                  title={entry.usedFor === '' ? entry.name : `${entry.name}: ${entry.usedFor}`}
                  onClick={() => {
                    setColorsOpen(false);
                    insert(`ÿc${entry.code}`);
                  }}
                >
                  <span
                    className="inline-block size-4 shrink-0 rounded-sm border"
                    style={{ backgroundColor: `rgb(${entry.rgb.join(' ')})` }}
                    aria-hidden
                  />
                  <span className="font-mono">ÿc{entry.code}</span>
                  <span className="truncate text-muted-foreground">{entry.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={placeholdersOpen} onOpenChange={setPlaceholdersOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Insert a placeholder into ${label}`}
              title="Insert a placeholder"
            >
              <Braces />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="max-h-80 w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-1"
            onCloseAutoFocus={restoreCaret}
          >
            {offered.map((entry) => (
              <button
                key={entry.token}
                type="button"
                className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => {
                  setPlaceholdersOpen(false);
                  insert(entry.token);
                }}
              >
                <span className="font-mono text-xs">{entry.token}</span>
                <span className="text-xs text-muted-foreground">{entry.description}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      {text !== '' && <LabelPreview text={previewPlaceholders(text)} defaultColor={defaultColor} className="px-2 py-1.5 text-sm" />}
      {problems.map((problem) => (
        <p key={problem} className="text-xs text-amber-600 dark:text-amber-400">
          {problem}
        </p>
      ))}
    </Field>
  );
}

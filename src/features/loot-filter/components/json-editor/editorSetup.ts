/** The CodeMirror setup behind JsonCodeEditor: extensions, compartments and the external-change diff. */
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit, type MatchResult } from '@codemirror/language';
import { linter, lintGutter, lintKeymap, type Diagnostic as LintDiagnostic } from '@codemirror/lint';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, Prec, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { findJsoncSyntaxProblem } from '../../engine/jsoncProblem';
import { computeLabelChips } from '../../utils/labelChips';
import { hangingIndent } from './hangingIndent';
import { BRACKET_SCAN_DISTANCE, jsonc } from './jsoncLanguage';
import { labelChipGutter, type ComputeLabelChips } from './labelChipGutter';

// Compartments are identities, not state: one set can serve every editor instance.
export const themeCompartment = new Compartment();
export const attributesCompartment = new Compartment();

const MONO_FONT = 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)';

/** The app's mono font at text-xs with relaxed line height, filling the wrapper and scrolling inside it. */
const layoutTheme = EditorView.theme({
  '&': { height: '100%' },
  '&.cm-focused': { outline: 'none' },
  // Same selector as the VS Code theme's font rule; Prec.highest mounts this one after it.
  '&.cm-editor .cm-scroller': { fontFamily: MONO_FONT, fontSize: '12px', lineHeight: '1.625', overflow: 'auto' },
});

/** A soft border in the panel's own text colour, so it works on both VS Code themes' panel backgrounds. */
const PANEL_BORDER = '1px solid color-mix(in srgb, currentColor 30%, transparent)';

/** The search panel's inputs and buttons as small rounded controls instead of the native look. */
const panelTheme = EditorView.theme({
  '.cm-panel.cm-search': { padding: '6px 28px 6px 8px', fontSize: '12px' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label': { margin: '2px 6px 2px 0' },
  '.cm-panel.cm-search label': { fontSize: '12px' },
  '.cm-textfield': {
    fontSize: '12px',
    padding: '2px 6px',
    borderRadius: '4px',
    border: PANEL_BORDER,
    backgroundColor: 'transparent',
    color: 'inherit',
    '&:focus': { outline: '2px solid color-mix(in srgb, currentColor 35%, transparent)', outlineOffset: '0' },
  },
  '.cm-button': {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    border: PANEL_BORDER,
    backgroundImage: 'none',
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    '&:hover': { backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)' },
    '&:active': { backgroundImage: 'none', backgroundColor: 'color-mix(in srgb, currentColor 18%, transparent)' },
  },
  '.cm-panel.cm-search [name=close]': { top: '4px', right: '8px', fontSize: '16px', cursor: 'pointer' },
});

/** `pos` limited to 0…`length`. */
export function clamp(pos: number, length: number): number {
  return Math.min(Math.max(pos, 0), length);
}

function syntaxLint(view: EditorView): LintDiagnostic[] {
  const problem = findJsoncSyntaxProblem(view.state.doc.toString());
  if (problem === undefined) return [];
  const length = view.state.doc.length;
  const from = clamp(problem.from, length);
  return [{ from, to: clamp(Math.max(problem.to, from), length), severity: 'error', message: problem.message }];
}

const matchingBracket = Decoration.mark({ class: 'cm-matchingBracket' });

/**
 * Marks matched pairs only. The stream parser stops at the viewport after an edit, so a bracket whose partner lies
 * below it looks unmatched to bracketMatching; a red "nonmatching" mark there would be a false error (the live lint
 * reports real ones).
 */
function matchedPairOnly(match: MatchResult): Range<Decoration>[] {
  if (!match.matched || match.end === undefined) return [];
  return [matchingBracket.range(match.start.from, match.start.to), matchingBracket.range(match.end.from, match.end.to)];
}

/** VS Code dark or light. */
export function themeExtension(dark: boolean): Extension {
  return dark ? vscodeDark : vscodeLight;
}

/** The content element's accessibility and input attributes. */
export function contentAttributes(ariaLabel: string, invalid: boolean): Extension {
  return EditorView.contentAttributes.of({
    'aria-label': ariaLabel,
    'aria-invalid': invalid ? 'true' : 'false',
    spellcheck: 'false',
    autocorrect: 'off',
    autocapitalize: 'off',
  });
}

/** Everything but the compartments and the change listener; `compute` is injectable for tests. */
export function jsonEditorExtensions(compute: ComputeLabelChips = computeLabelChips): Extension {
  return [
    Prec.highest([layoutTheme, panelTheme]),
    lintGutter(),
    lineNumbers(),
    labelChipGutter({ compute }),
    foldGutter(),
    highlightActiveLineGutter(),
    history(),
    indentUnit.of('  '),
    jsonc(),
    indentOnInput(),
    bracketMatching({ maxScanDistance: BRACKET_SCAN_DISTANCE, renderMatch: matchedPairOnly }),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search(),
    EditorView.lineWrapping,
    hangingIndent(),
    linter(syntaxLint, { delay: 500 }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, ...searchKeymap, ...lintKeymap]),
  ];
}

/** The shortest change turning `from` into `to` (common prefix and suffix kept), so history and selection map well. */
export function diffChange(from: string, to: string): { from: number; to: number; insert: string } {
  const max = Math.min(from.length, to.length);
  let start = 0;
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  let end = 0;
  while (end < max - start && from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)) end++;
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) };
}

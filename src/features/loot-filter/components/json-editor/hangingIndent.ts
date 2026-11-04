/**
 * A hanging indent for soft-wrapped lines: the continuation of a wrapped line starts under its own indentation plus two
 * columns instead of at column 0. Done per visible line with padding-left and an equal negative text-indent, so the
 * first visual line stays where it was.
 */
import { RangeSetBuilder, countColumn, type Extension } from '@codemirror/state';
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';

/** Extra columns for the continuation, past the line's own indentation. */
const CONTINUATION = 2;
/** The base theme's `.cm-line` left padding, kept for the first visual line. */
const LINE_PADDING = '6px';

/** The line style for a line's text: its leading whitespace in columns (tabs to the next tab stop) plus the continuation. */
export function hangingIndentStyle(lineText: string, tabSize: number): string {
  const leading = /^[ \t]*/.exec(lineText)?.[0] ?? '';
  const columns = countColumn(leading, tabSize) + CONTINUATION;
  return `padding-left: calc(${String(columns)}ch + ${LINE_PADDING}); text-indent: -${String(columns)}ch`;
}

const decorationCache = new Map<string, Decoration>();

function lineDecoration(style: string): Decoration {
  let decoration = decorationCache.get(style);
  if (decoration === undefined) {
    decoration = Decoration.line({ attributes: { style } });
    decorationCache.set(style, decoration);
  }
  return decoration;
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc, tabSize } = view.state;
  let lastLine = -1;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = doc.lineAt(pos);
      // A line split by a fold shows up in two visible ranges.
      if (line.number !== lastLine) builder.add(line.from, line.from, lineDecoration(hangingIndentStyle(line.text, tabSize)));
      lastLine = line.number;
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

/** The hanging indent extension (only useful together with EditorView.lineWrapping). */
export function hangingIndent(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
}

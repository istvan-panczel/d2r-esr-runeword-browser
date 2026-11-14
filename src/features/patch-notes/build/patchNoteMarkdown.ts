/**
 * Parses the markdown subset the ESR patch notes (`patchnotes/<version>.md`) use: bold-only lines as headings, `*` / `-`
 * bullets nested by indentation, `**bold**` runs, backslash escapes (`\-`, `\~`, `\+`) and trailing two-space line breaks.
 * Anything else stays plain text.
 */
import type { PatchNoteBlock, PatchNoteListItem, PatchNoteSpan } from '../engine/schema.ts';

const BULLET = /^(\s*)[*+-]\s+(.*)$/;
const BOLD_ONLY = /^\*\*([^*]+)\*\*:?$/;

function unescape(text: string): string {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, '$1');
}

/** `**bold**` runs; unmatched `**` stays as text. Adjacent text is merged and whitespace is collapsed. */
export function parseSpans(source: string): PatchNoteSpan[] {
  const spans: PatchNoteSpan[] = [];
  const push = (text: string, bold: boolean) => {
    const clean = unescape(text).replace(/\s+/g, ' ');
    if (clean === '') return;
    const last = spans.at(-1);
    if (last !== undefined && (last.bold === true) === bold)
      spans[spans.length - 1] = bold ? { text: last.text + clean, bold } : { text: last.text + clean };
    else spans.push(bold ? { text: clean, bold } : { text: clean });
  };
  let rest = source;
  for (;;) {
    const start = rest.indexOf('**');
    const end = start < 0 ? -1 : rest.indexOf('**', start + 2);
    if (end < 0) {
      push(rest, false);
      break;
    }
    push(rest.slice(0, start), false);
    push(rest.slice(start + 2, end), true);
    rest = rest.slice(end + 2);
  }
  // Trim the outer edges only: a space next to a bold run is meaningful
  const first = spans.at(0);
  if (first !== undefined) spans[0] = { ...first, text: first.text.trimStart() };
  const last = spans.at(-1);
  if (last !== undefined) spans[spans.length - 1] = { ...last, text: last.text.trimEnd() };
  return spans.filter((span) => span.text !== '');
}

interface MutableItem {
  spans: PatchNoteSpan[];
  items: MutableItem[];
  indent: number;
}

function freeze(items: MutableItem[]): PatchNoteListItem[] {
  return items.map((item) => (item.items.length > 0 ? { spans: item.spans, items: freeze(item.items) } : { spans: item.spans }));
}

export function parsePatchNoteMarkdown(markdown: string): PatchNoteBlock[] {
  const blocks: PatchNoteBlock[] = [];
  let list: MutableItem[] | null = null;
  /** The open bullets from the outermost in, so a deeper bullet nests under the last shallower one */
  let stack: MutableItem[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (list !== null) blocks.push({ type: 'list', items: freeze(list) });
    list = null;
    stack = [];
  };
  const flushParagraph = () => {
    const spans = parseSpans(paragraph.join(' '));
    if (spans.length > 0) blocks.push({ type: 'paragraph', spans });
    paragraph = [];
  };

  for (const raw of markdown.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet !== null && !line.trimStart().startsWith('**')) {
      flushParagraph();
      const indent = bullet[1].replace(/\t/g, '    ').length;
      const item: MutableItem = { spans: parseSpans(bullet[2]), items: [], indent };
      list ??= [];
      while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop();
      const parent = stack.at(-1);
      if (parent === undefined) list.push(item);
      else parent.items.push(item);
      stack.push(item);
      continue;
    }
    const heading = BOLD_ONLY.exec(line.trim());
    if (heading !== null) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: unescape(heading[1]).trim() });
      continue;
    }
    // An indented plain line continues the open bullet; anything else is paragraph text
    const open = stack.at(-1);
    if (open !== undefined && /^\s/.test(raw)) {
      open.spans = parseSpans(`${open.spans.map((span) => (span.bold === true ? `**${span.text}**` : span.text)).join('')} ${line.trim()}`);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

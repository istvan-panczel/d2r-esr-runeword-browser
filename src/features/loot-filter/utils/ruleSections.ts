/**
 * Turns the whole-line `//` comments around rules into the rows of the rule list (the ruleset:
 * docs/features/LOOT-FILTER.md "Section comments"):
 * - `// ==== Title` is a part (level 1), `// ---- Title` a section inside it (level 2), four or more marker characters;
 *   a run of the same markers after the title is decoration, and a line of markers only is a separator (not shown);
 * - any other comment is a note: under the heading right above it, otherwise a row of its own.
 * A section runs to the next heading of the same or a higher level. A filter without a heading has no sections, so
 * every per-rule comment of an older file stays out of the list.
 */

export type HeadingLevel = 1 | 2;

export type CommentLine =
  | { readonly kind: 'heading'; readonly level: HeadingLevel; readonly title: string }
  | { readonly kind: 'note'; readonly text: string }
  | { readonly kind: 'separator' };

const COMMENT_START = /^\/\/\s?/;
const MARKER_LINE = /^(={4,}|-{4,})\s*(.*?)\s*(?:={3,}|-{3,})?\s*$/;

/** One comment line, verbatim as in the file (`// ---- 1.1 Gold`). */
export function readCommentLine(line: string): CommentLine {
  const text = line.replace(COMMENT_START, '').trim();
  const marker = MARKER_LINE.exec(text);
  if (marker === null) return { kind: 'note', text };
  const title = marker[2];
  if (title === '') return { kind: 'separator' };
  return { kind: 'heading', level: marker[1].startsWith('=') ? 1 : 2, title };
}

export interface HeadingRow {
  readonly kind: 'heading';
  /** Stable across edits that do not touch the heading: level, title and which repeat of them it is. */
  readonly key: string;
  readonly level: HeadingLevel;
  readonly title: string;
  readonly notes: readonly string[];
  /** Rules until the next heading of the same or a higher level. */
  readonly ruleCount: number;
  readonly collapsed: boolean;
}

export interface NoteRow {
  readonly kind: 'note';
  readonly key: string;
  readonly text: string;
}

export interface RuleRowItem<Entry> {
  readonly kind: 'rule';
  readonly entry: Entry;
}

export type RuleListRow<Entry> = HeadingRow | NoteRow | RuleRowItem<Entry>;

interface RuleEntryLike {
  readonly index: number;
  readonly rule: { readonly commentsBefore?: readonly string[] };
}

type Item<Entry> = (Omit<HeadingRow, 'ruleCount' | 'collapsed' | 'notes'> & { readonly notes: string[] }) | NoteRow | RuleRowItem<Entry>;

/** The comments and rules in file order, each heading with the notes that follow it. */
function collectItems<Entry extends RuleEntryLike>(entries: readonly Entry[], endComments: readonly string[]): Item<Entry>[] {
  const items: Item<Entry>[] = [];
  const seen = new Map<string, number>();
  let noteCount = 0;
  const addComments = (comments: readonly string[]) => {
    let heading: Extract<Item<Entry>, { kind: 'heading' }> | undefined;
    for (const comment of comments) {
      const line = readCommentLine(comment);
      if (line.kind === 'heading') {
        const base = `${String(line.level)}:${line.title}`;
        const repeat = seen.get(base) ?? 0;
        seen.set(base, repeat + 1);
        heading = {
          kind: 'heading',
          key: repeat === 0 ? base : `${base}#${String(repeat)}`,
          level: line.level,
          title: line.title,
          notes: [],
        };
        items.push(heading);
      } else if (line.kind === 'note' && line.text !== '') {
        if (heading) heading.notes.push(line.text);
        else items.push({ kind: 'note', key: `note:${String(noteCount++)}`, text: line.text });
      }
    }
  };
  for (const entry of entries) {
    addComments(entry.rule.commentsBefore ?? []);
    items.push({ kind: 'rule', entry });
  }
  addComments(endComments);
  return items;
}

/** The keys of every heading, for Collapse all. */
export function headingKeys(entries: readonly RuleEntryLike[], endComments: readonly string[]): string[] {
  return collectItems(entries, endComments).flatMap((item) => (item.kind === 'heading' ? [item.key] : []));
}

/**
 * The rows of the rule list. Rules under a collapsed heading are left out, except the selected one, so a selection made
 * elsewhere (a problem link in the JSON tab) still shows in the list.
 */
export function buildRuleListRows<Entry extends RuleEntryLike>(
  entries: readonly Entry[],
  endComments: readonly string[],
  collapsed: ReadonlySet<string>,
  selectedRule: number | null
): RuleListRow<Entry>[] {
  const items = collectItems(entries, endComments);
  if (!items.some((item) => item.kind === 'heading')) return entries.map((entry) => ({ kind: 'rule', entry }));
  const rows: RuleListRow<Entry>[] = [];
  let hiddenBelow: HeadingLevel | null = null;
  items.forEach((item, position) => {
    if (item.kind === 'heading') {
      if (hiddenBelow !== null && item.level > hiddenBelow) return;
      let ruleCount = 0;
      for (const next of items.slice(position + 1)) {
        if (next.kind === 'heading' && next.level <= item.level) break;
        if (next.kind === 'rule') ruleCount++;
      }
      const isCollapsed = collapsed.has(item.key);
      hiddenBelow = isCollapsed ? item.level : null;
      rows.push({ ...item, ruleCount, collapsed: isCollapsed });
      return;
    }
    if (item.kind === 'rule' && item.entry.index === selectedRule) rows.push(item);
    else if (hiddenBelow === null) rows.push(item);
  });
  return rows;
}

/** The text of comment lines for reading: no `//`, no heading markers, separators and empty lines at the ends gone. */
export function commentLinesText(lines: readonly string[]): string {
  const text = lines.flatMap((line) => {
    const read = readCommentLine(line);
    if (read.kind === 'separator') return [];
    return [read.kind === 'heading' ? read.title : read.text];
  });
  return text.join('\n').trim();
}

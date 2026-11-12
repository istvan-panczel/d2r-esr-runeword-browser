/**
 * Section comments (the ruleset: docs/features/LOOT-FILTER.md "Section comments"): the whole-line `//` comments above
 * the rules (or the styles) of a filter, read as parts, sections and notes, and every edit of them.
 * - `// ==== Title` is a part (level 1), `// ---- Title` a section inside it (level 2), four or more marker characters;
 *   a run of three or more markers after the title is decoration, and a line of markers only is a separator.
 * - Other comments right under a heading are its description, up to a blank line; any other comment is a note in place,
 *   and a blank line ends a note too. A blank line is an empty string among the comment lines (engine/commentLines.ts).
 * - A section runs to the next heading of the same or a higher level.
 * - A list without a heading shows no comment rows, so the per-rule comments of older files stay out of the list.
 *
 * The comments live on the items (`commentsBefore`) and after the last one (`end`). The edits work on the list as one
 * stream of comment lines and items, so a section moves with its rules and a heading stays where it is put.
 */

import { BLANK_COMMENT_LINE, tidyCommentBlock } from '../engine/commentLines';

export type HeadingLevel = 1 | 2;

export type CommentLine =
  | { readonly kind: 'heading'; readonly level: HeadingLevel; readonly title: string }
  | { readonly kind: 'note'; readonly text: string }
  | { readonly kind: 'separator' }
  /** A blank line between comment lines (an empty string in the model). */
  | { readonly kind: 'blank' };

const COMMENT_START = /^\/\/\s?/;
const MARKER_LINE = /^(={4,}|-{4,})\s*(.*?)\s*(?:={3,}|-{3,})?\s*$/;
/** A heading line in parts: everything before the title, the title, everything after it. */
const HEADING_PARTS = /^(\/\/\s*(?:={4,}|-{4,})\s*)(.*?)(\s*(?:={3,}|-{3,})?\s*)$/;

/** One comment line, verbatim as in the file (`// ---- 1.1 Gold`). */
export function readCommentLine(line: string): CommentLine {
  if (line.trim() === '') return { kind: 'blank' };
  const text = line.replace(COMMENT_START, '').trim();
  const marker = MARKER_LINE.exec(text);
  if (marker === null) return { kind: 'note', text };
  const title = marker[2];
  if (title === '') return { kind: 'separator' };
  return { kind: 'heading', level: marker[1].startsWith('=') ? 1 : 2, title };
}

/**
 * The text of comment lines for reading: no `//`, no heading markers, separators and empty lines at the ends gone; a
 * blank line stays an empty line between paragraphs.
 */
export function commentLinesText(lines: readonly string[]): string {
  const text = lines.flatMap((line) => {
    const read = readCommentLine(line);
    if (read.kind === 'separator') return [];
    if (read.kind === 'blank') return [''];
    return [read.kind === 'heading' ? read.title : read.text];
  });
  return text.join('\n').trim();
}

/** The line of a new heading. */
export function headingLine(level: HeadingLevel, title: string): string {
  return `// ${level === 1 ? '====' : '----'} ${title.trim()}`;
}

/** A heading line renamed: the same level keeps the file's markers and decoration, another level is written anew. */
export function renameHeadingLine(line: string, level: HeadingLevel, title: string): string {
  const read = readCommentLine(line);
  const parts = HEADING_PARTS.exec(line);
  if (read.kind !== 'heading' || read.level !== level || parts === null) return headingLine(level, title);
  return `${parts[1]}${title.trim()}${parts[3]}`;
}

/** Note text as comment lines: one per line, inner empty lines kept as `//`, empty lines at the ends dropped. */
export function noteLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  // A note must stay a note: a line that would read as a heading or a separator is written as "Note: …".
  return lines.map((line) => {
    if (line.trim() === '') return '//';
    const comment = `// ${line}`;
    return readCommentLine(comment).kind === 'note' ? comment : `// Note: ${line.trim()}`;
  });
}

// ---------------------------------------------------------------------------
// The list as a stream of comment lines and items
// ---------------------------------------------------------------------------

/** Items (rules or styles) with the comments above each, and the comments after the last one. */
export interface SectionList<T> {
  readonly items: readonly T[];
  readonly end: readonly string[];
}

/** How the comments above an item are read and written. */
export interface CommentAccess<T> {
  readonly get: (item: T) => readonly string[] | undefined;
  /** The item with exactly these comments above it (an empty list removes them). */
  readonly set: (item: T, comments: readonly string[]) => T;
}

/** A comment line: in the block above item `at` (`at` = the item count: after the last item), its `line`th line. */
export interface CommentAddress {
  readonly at: number;
  readonly line: number;
}

type Token<T> = { readonly kind: 'line'; readonly text: string } | { readonly kind: 'item'; readonly item: T; readonly from: number };

function toTokens<T>(list: SectionList<T>, access: Pick<CommentAccess<T>, 'get'>): Token<T>[] {
  const tokens: Token<T>[] = [];
  list.items.forEach((item, from) => {
    for (const text of access.get(item) ?? []) tokens.push({ kind: 'line', text });
    tokens.push({ kind: 'item', item, from });
  });
  for (const text of list.end) tokens.push({ kind: 'line', text });
  return tokens;
}

/** The edited list and, for each new index, the old index of the item there (-1 for an added item). */
export interface SectionEditResult<T> extends SectionList<T> {
  readonly from: readonly number[];
}

/** The items with the comment lines above each; blank lines at the start or end of a block (left by an edit) go. */
function fromTokens<T>(tokens: readonly Token<T>[], access: CommentAccess<T>): SectionEditResult<T> {
  const items: T[] = [];
  const from: number[] = [];
  let pending: string[] = [];
  for (const token of tokens) {
    if (token.kind === 'line') {
      pending.push(token.text);
      continue;
    }
    const block = tidyCommentBlock(pending);
    const current = access.get(token.item) ?? [];
    const same = current.length === block.length && current.every((line, index) => line === block[index]);
    items.push(same ? token.item : access.set(token.item, block));
    from.push(token.from);
    pending = [];
  }
  return { items, end: tidyCommentBlock(pending), from };
}

/** The token position of the comment line at `address`, or of the item `at` itself with `line` -1. */
function position<T>(tokens: readonly Token<T>[], { at, line }: CommentAddress): number | undefined {
  let item = 0;
  let inBlock = 0;
  for (const [index, token] of tokens.entries()) {
    if (token.kind === 'item') {
      if (item === at && line === -1) return index;
      item++;
      inBlock = 0;
    } else {
      if (item === at && inBlock === line) return index;
      inBlock++;
    }
  }
  return undefined;
}

function headingLevel<T>(token: Token<T> | undefined): HeadingLevel | undefined {
  if (token?.kind !== 'line') return undefined;
  const read = readCommentLine(token.text);
  return read.kind === 'heading' ? read.level : undefined;
}

/** Where the section of the heading at `start` ends: the next heading of the same or a higher level, else the end. */
function sectionEnd<T>(tokens: readonly Token<T>[], start: number, level: HeadingLevel): number {
  let index = start + 1;
  while (index < tokens.length) {
    const next = headingLevel(tokens[index]);
    if (next !== undefined && next <= level) break;
    index++;
  }
  return index;
}

/** The heading's description: the note lines right under it, up to an item, a heading, a separator or a blank line. */
function descriptionEnd<T>(tokens: readonly Token<T>[], start: number): number {
  let index = start + 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.kind !== 'line' || readCommentLine(token.text).kind !== 'note') break;
    index++;
  }
  return index;
}

export type SectionEdit =
  /** New comment lines right above item `at` (`at` = the item count: after the last item). */
  | { readonly kind: 'insert'; readonly at: number; readonly lines: readonly string[] }
  /** `count` lines from `address` replaced by `lines` (none: removed). */
  | { readonly kind: 'replace'; readonly address: CommentAddress; readonly count: number; readonly lines: readonly string[] }
  /** A heading set anew: its line and its description (`level`, `title`, `description` as the dialog has them). */
  | {
      readonly kind: 'heading';
      readonly address: CommentAddress;
      readonly level: HeadingLevel;
      readonly title: string;
      readonly description: string;
    }
  /** A heading and its description removed; its items stay where they are. */
  | { readonly kind: 'removeHeading'; readonly address: CommentAddress }
  /** A heading's section (the heading, its items and its subsections) swapped with the previous or next section of its level. */
  | { readonly kind: 'move'; readonly address: CommentAddress; readonly direction: -1 | 1 };

/**
 * Applies one edit to the stream in place; false when it changes nothing (an address that is gone, a section that cannot
 * move). A heading set anew reports its old and new line token, so its fold can follow it (`headingKeyChanges`).
 */
function editTokens<T>(
  tokens: Token<T>[],
  itemCount: number,
  edit: SectionEdit
): { readonly renamed?: { readonly from: Token<T>; readonly to: Token<T> } } | false {
  const lines = (texts: readonly string[]): Token<T>[] => texts.map((text) => ({ kind: 'line', text }));
  switch (edit.kind) {
    case 'insert': {
      if (edit.lines.length === 0 || edit.at < 0 || edit.at > itemCount) return false;
      const at = edit.at === itemCount ? tokens.length : position(tokens, { at: edit.at, line: -1 });
      if (at === undefined) return false;
      // A note goes in as a note of its own: right under a heading, its description or another note it would join
      // them, so a blank line goes first.
      const previous = tokens[at - 1] as Token<T> | undefined;
      const previousKind = previous?.kind === 'line' ? readCommentLine(previous.text).kind : undefined;
      const joins = (previousKind === 'heading' || previousKind === 'note') && readCommentLine(edit.lines[0]).kind === 'note';
      tokens.splice(at, 0, ...lines(joins ? [BLANK_COMMENT_LINE, ...edit.lines] : edit.lines));
      return {};
    }
    case 'replace': {
      const at = position(tokens, edit.address);
      if (at === undefined || edit.count < 1) return false;
      // Only comment lines go: the count stops at the next item.
      let count = 0;
      while (count < edit.count && tokens[at + count]?.kind === 'line') count++;
      tokens.splice(at, count, ...lines(edit.lines));
      return {};
    }
    case 'heading':
    case 'removeHeading': {
      const at = position(tokens, edit.address);
      const token = at === undefined ? undefined : tokens[at];
      if (at === undefined || token?.kind !== 'line' || headingLevel(token) === undefined) return false;
      const replacement =
        edit.kind === 'heading' ? lines([renameHeadingLine(token.text, edit.level, edit.title), ...noteLines(edit.description)]) : [];
      tokens.splice(at, descriptionEnd(tokens, at) - at, ...replacement);
      return edit.kind === 'heading' ? { renamed: { from: token, to: replacement[0] } } : {};
    }
    case 'move': {
      const at = position(tokens, edit.address);
      const level = at === undefined ? undefined : headingLevel(tokens[at]);
      if (at === undefined || level === undefined) return false;
      const end = sectionEnd(tokens, at, level);
      if (edit.direction === -1) {
        let start = at - 1;
        while (start >= 0 && (headingLevel(tokens[start]) ?? 3) > level) start--;
        if (start < 0 || headingLevel(tokens[start]) !== level) return false;
        tokens.splice(start, end - start, ...tokens.slice(at, end), ...tokens.slice(start, at));
      } else {
        if (headingLevel(tokens[end]) !== level) return false;
        const next = sectionEnd(tokens, end, level);
        tokens.splice(at, next - at, ...tokens.slice(end, next), ...tokens.slice(at, end));
      }
      return {};
    }
  }
}

/** Applies one edit; undefined when it changes nothing (an address that is gone, a section that cannot move). */
export function applySectionEdit<T>(list: SectionList<T>, access: CommentAccess<T>, edit: SectionEdit): SectionEditResult<T> | undefined {
  const tokens = toTokens(list, access);
  return editTokens(tokens, list.items.length, edit) === false ? undefined : fromTokens(tokens, access);
}

/** The key of a heading: its level and title, and which repeat of that level and title it is (`2:Gold`, `2:Gold#1`). */
function headingKey(level: HeadingLevel, title: string, repeat: number): string {
  const base = `${String(level)}:${title}`;
  return repeat === 0 ? base : `${base}#${String(repeat)}`;
}

/** The key of every heading line token, as `buildSectionRows` gives them. */
function tokenHeadingKeys<T>(tokens: readonly Token<T>[]): Map<Token<T>, string> {
  const keys = new Map<Token<T>, string>();
  const seen = new Map<string, number>();
  for (const token of tokens) {
    if (token.kind !== 'line') continue;
    const read = readCommentLine(token.text);
    if (read.kind !== 'heading') continue;
    const base = `${String(read.level)}:${read.title}`;
    const repeat = seen.get(base) ?? 0;
    seen.set(base, repeat + 1);
    keys.set(token, headingKey(read.level, read.title, repeat));
  }
  return keys;
}

/** How an edit changes the heading keys: old key → new key for every heading it keeps, and the keys of new headings. */
export interface HeadingKeyChanges {
  /** Every heading of the list after the edit that was there before (renamed, moved or renumbered included), by its old key. */
  readonly kept: ReadonlyMap<string, string>;
  /** The headings the edit adds (an insert), by their new key. */
  readonly added: readonly string[];
}

/**
 * The heading keys before and after `edit`, matched line by line: a rename or a level change keeps its heading, and a
 * repeated title renumbered by the edit (`2:Gold#1` becoming `2:Gold`) is followed. Undefined when the edit changes
 * nothing.
 */
export function headingKeyChanges<T>(
  list: SectionList<T>,
  access: Pick<CommentAccess<T>, 'get'>,
  edit: SectionEdit
): HeadingKeyChanges | undefined {
  const tokens = toTokens(list, access);
  const before = tokenHeadingKeys(tokens);
  const result = editTokens(tokens, list.items.length, edit);
  if (result === false) return undefined;
  const kept = new Map<string, string>();
  const added: string[] = [];
  for (const [token, key] of tokenHeadingKeys(tokens)) {
    const old = token === result.renamed?.to ? before.get(result.renamed.from) : before.get(token);
    if (old !== undefined) kept.set(old, key);
    else if (edit.kind === 'insert') added.push(key);
  }
  return { kept, added };
}

// ---------------------------------------------------------------------------
// Moving an item one step
// ---------------------------------------------------------------------------

/** What each comment line of the stream is: a heading's description is told apart from a note. Undefined for items. */
type LineRole = 'heading' | 'description' | 'note' | 'blank' | 'separator';

function lineRoles<T>(tokens: readonly Token<T>[]): (LineRole | undefined)[] {
  let underHeading = false;
  return tokens.map((token) => {
    if (token.kind === 'item') {
      underHeading = false;
      return undefined;
    }
    const read = readCommentLine(token.text);
    if (read.kind === 'heading') {
      underHeading = true;
      return 'heading';
    }
    if (read.kind !== 'note') {
      underHeading = false;
      return read.kind;
    }
    return underHeading ? 'description' : 'note';
  });
}

/**
 * Lines a step hops over as one: headings with their descriptions, separators and the blank lines among them. A run
 * holds any number of parts and at most one section, the last heading in reading order (`stepItem`).
 */
const HEADING_RUN: readonly (LineRole | undefined)[] = ['heading', 'description', 'separator', 'blank'];

/**
 * Item `index` moved one step up (-1) or down (1), with its own notes: the note lines right above it, back to a blank
 * line, a heading's description or anything else (a heading and its description belong to their place, never to an
 * item). The neighbour it passes is
 * - another item: they swap, each with its own notes;
 * - a heading run (part headings and at most one section heading, the last of them, with their descriptions,
 *   separators and blank lines between): the item hops over the whole run, so it becomes the last item of the section
 *   before it (up) or the first of the section after it (down), and no other item moves. An empty section is a section
 *   of its own: the item stops in it;
 * - a free-standing note (one that is not an item's own): the item passes it, and the note stays a note.
 * Blank lines go where the new neighbours would otherwise join (a note under a description); the blocks are tidied.
 * Undefined when nothing is there to pass (the first item with nothing above its notes, the last with nothing after it).
 * A step and the opposite step give back the list (`stepItem` up, then down).
 */
export function stepItem<T>(
  list: SectionList<T>,
  access: CommentAccess<T>,
  index: number,
  direction: -1 | 1
): (SectionEditResult<T> & { readonly index: number }) | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= list.items.length) return undefined;
  const tokens = toTokens(list, access);
  const roles = lineRoles(tokens);
  const at = position(tokens, { at: index, line: -1 });
  if (at === undefined) return undefined;
  let start = at;
  while (start > 0 && roles[start - 1] === 'note') start--;
  const unit = tokens.slice(start, at + 1);
  const blank: Token<T> = { kind: 'line', text: BLANK_COMMENT_LINE };
  /** Where the run of notes that ends at `end` starts. */
  const notesFrom = (end: number) => {
    let from = end;
    while (from > 0 && roles[from - 1] === 'note') from--;
    return from;
  };

  if (direction === -1) {
    let above = start - 1;
    while (above >= 0 && roles[above] === 'blank') above--;
    if (above < 0) return undefined;
    const gap = tokens.slice(above + 1, start);
    let from: number;
    let passed: Token<T>[];
    if (tokens[above].kind === 'item') {
      // The item above, with its own notes.
      from = notesFrom(above);
      passed = [...gap, ...tokens.slice(from, above + 1)];
    } else if (roles[above] === 'note') {
      // A free-standing note (not an item's own: a blank line or another line separates it from the next item).
      from = notesFrom(above);
      passed = [blank, ...tokens.slice(from, above + 1), blank];
    } else {
      // Back over parts and at most one section, the one nearest the item (an empty section above it is the section
      // the item joins); a heading that ends the run keeps its description.
      let at = above;
      let sawHeading = false;
      from = 0;
      while (at >= 0 && HEADING_RUN.includes(roles[at])) {
        if (roles[at] === 'heading') {
          if (headingLevel(tokens[at]) === 2 && sawHeading) {
            from = descriptionEnd(tokens, at);
            break;
          }
          sawHeading = true;
        }
        from = at;
        at--;
      }
      passed = [blank, ...tokens.slice(from, above + 1), blank];
    }
    tokens.splice(from, at + 1 - from, blank, ...unit, ...passed);
  } else {
    let below = at + 1;
    while (below < tokens.length && roles[below] === 'blank') below++;
    if (below >= tokens.length) return undefined;
    const gap = tokens.slice(at + 1, below);
    let to = below;
    while (to < tokens.length && roles[to] === 'note') to++;
    let passed: Token<T>[];
    if (tokens[below].kind === 'item' || (roles[below] === 'note' && tokens[to]?.kind === 'item')) {
      // The item below, with its own notes.
      passed = tokens.slice(below, to + 1);
      tokens.splice(start, to + 1 - start, blank, ...passed, ...gap, ...unit);
    } else {
      if (roles[below] !== 'note') {
        // Over parts and at most one section with its description: the item becomes that section's first item.
        to = below;
        let sawSection = false;
        while (to < tokens.length && HEADING_RUN.includes(roles[to])) {
          if (roles[to] === 'heading') {
            if (sawSection) break;
            if (headingLevel(tokens[to]) === 2) sawSection = true;
          }
          to++;
        }
      }
      passed = tokens.slice(below, to);
      // A heading run needs no blank line above it; a free note does (it must not join a description or note above).
      tokens.splice(start, to - start, ...(roles[below] === 'note' ? [blank] : []), ...passed, blank, ...unit);
    }
  }
  const result = fromTokens(tokens, access);
  return { ...result, index: result.from.indexOf(index) };
}

/** Whether the first item can move up and the last one down: something other than its own notes and blank lines is beyond it. */
export function stepEdges<T>(
  list: SectionList<T>,
  access: Pick<CommentAccess<T>, 'get'>
): { readonly firstUp: boolean; readonly lastDown: boolean } {
  const first = list.items.at(0);
  const roles = lineRoles((first === undefined ? [] : (access.get(first) ?? [])).map((text): Token<T> => ({ kind: 'line', text })));
  let own = roles.length;
  while (own > 0 && roles[own - 1] === 'note') own--;
  return {
    firstUp: roles.slice(0, own).some((role) => role !== 'blank'),
    lastDown: list.items.length > 0 && list.end.some((line) => line.trim() !== ''),
  };
}

/** Adds `item` as the last item of the section whose heading is at `address`; undefined when the address is gone. */
export function addToSection<T>(
  list: SectionList<T>,
  access: CommentAccess<T>,
  address: CommentAddress,
  item: T
): (SectionEditResult<T> & { readonly index: number }) | undefined {
  const tokens = toTokens(list, access);
  const at = position(tokens, address);
  const level = at === undefined ? undefined : headingLevel(tokens[at]);
  if (at === undefined || level === undefined) return undefined;
  const end = sectionEnd(tokens, at, level);
  tokens.splice(end, 0, { kind: 'item', item, from: -1 });
  const index = tokens.slice(0, end).filter((token) => token.kind === 'item').length;
  return { ...fromTokens(tokens, access), index };
}

/** A section inside a part, by title (`addToPartSection`). */
export interface PartSection {
  /** The part's title (a level-1 heading). */
  readonly part: string;
  /** The section's title (a level-2 heading inside the part). */
  readonly section: string;
  /** The description written under the section's heading when it is created. */
  readonly description?: string;
}

/** The token positions of the part `place.part` (the first of that title) and of its section `place.section` (-1: none). */
function locatePartSection<T>(
  tokens: readonly Token<T>[],
  place: PartSection
): { readonly part: number; readonly section: number } | undefined {
  const titled = (token: Token<T>, level: HeadingLevel, title: string): boolean => {
    if (token.kind !== 'line') return false;
    const read = readCommentLine(token.text);
    return read.kind === 'heading' && read.level === level && read.title.toLowerCase() === title.trim().toLowerCase();
  };
  const part = tokens.findIndex((token) => titled(token, 1, place.part));
  if (part === -1) return undefined;
  const inPart = tokens.slice(part + 1, sectionEnd(tokens, part, 1)).findIndex((token) => titled(token, 2, place.section));
  return { part, section: inPart === -1 ? -1 : part + 1 + inPart };
}

/** The address of the comment line at token position `at` (`CommentAddress`, as the list rows have it). */
function addressAt<T>(tokens: readonly Token<T>[], at: number): CommentAddress {
  let item = 0;
  let line = 0;
  for (const token of tokens.slice(0, at)) {
    if (token.kind === 'item') {
      item++;
      line = 0;
    } else {
      line++;
    }
  }
  return { at: item, line };
}

/**
 * Where `addToPartSection` puts an item: the address of the part's heading line (as its heading row has it) and of the
 * section's, undefined when the section is not there yet (it would be created). Undefined without the part. Titles
 * match ignoring case and the spaces around them.
 */
export function findPartSection<T>(
  list: SectionList<T>,
  access: Pick<CommentAccess<T>, 'get'>,
  place: PartSection
): { readonly part: CommentAddress; readonly section: CommentAddress | undefined } | undefined {
  const tokens = toTokens(list, access);
  const found = locatePartSection(tokens, place);
  if (found === undefined) return undefined;
  return { part: addressAt(tokens, found.part), section: found.section === -1 ? undefined : addressAt(tokens, found.section) };
}

/**
 * Adds `item` as the last item of the section `place.section` inside the part `place.part` (`findPartSection`).
 * Without that section, the section is created at the end of the part (after its last section) with the heading and
 * description above `item`. Blank lines and separators right above the next heading stay with it. Undefined when the
 * list has no such part.
 */
export function addToPartSection<T>(
  list: SectionList<T>,
  access: CommentAccess<T>,
  place: PartSection,
  item: T
): (SectionEditResult<T> & { readonly index: number }) | undefined {
  const tokens = toTokens(list, access);
  const found = locatePartSection(tokens, place);
  if (found === undefined) return undefined;
  const { part, section } = found;
  const end = section === -1 ? sectionEnd(tokens, part, 1) : sectionEnd(tokens, section, 2);
  let at = end;
  while (at > 0) {
    const previous = tokens[at - 1];
    const kind = previous.kind === 'line' ? readCommentLine(previous.text).kind : undefined;
    if (kind !== 'blank' && kind !== 'separator') break;
    at--;
  }
  const heading =
    section === -1
      ? [BLANK_COMMENT_LINE, headingLine(2, place.section), ...(place.description === undefined ? [] : noteLines(place.description))]
      : [];
  tokens.splice(at, 0, ...heading.map((text): Token<T> => ({ kind: 'line', text })), { kind: 'item', item, from: -1 });
  const index = tokens.slice(0, at).filter((token) => token.kind === 'item').length;
  return { ...fromTokens(tokens, access), index };
}

// ---------------------------------------------------------------------------
// Rows of a list
// ---------------------------------------------------------------------------

export interface HeadingRow {
  readonly kind: 'heading';
  /** Stable across edits that do not touch the heading: level, title and which repeat of them it is. */
  readonly key: string;
  readonly level: HeadingLevel;
  readonly title: string;
  /** The description: the notes right under the heading, up to a blank line. */
  readonly notes: readonly string[];
  readonly address: CommentAddress;
  /** The part a section sits in; null for a part, or for a section above the first part. */
  readonly partKey: string | null;
  /** Items until the next heading of the same or a higher level. */
  readonly itemCount: number;
  /** Shown folded: not in the open set, or listed only above a kept item inside a folded part. */
  readonly collapsed: boolean;
  /** There is a section of the same level right before / after this one, inside the same part. */
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

export interface NoteRow {
  readonly kind: 'note';
  readonly key: string;
  /** The lines of the note, without `//`. */
  readonly text: string;
  readonly address: CommentAddress;
  /** How many comment lines the note is. */
  readonly count: number;
}

export interface ItemRow<Entry> {
  readonly kind: 'item';
  readonly entry: Entry;
}

export type SectionRow<Entry> = HeadingRow | NoteRow | ItemRow<Entry>;

type Draft<Entry> =
  | (Omit<HeadingRow, 'itemCount' | 'collapsed' | 'canMoveUp' | 'canMoveDown' | 'notes'> & { readonly notes: string[] })
  | (Omit<NoteRow, 'text' | 'count'> & { text: string; count: number })
  | (ItemRow<Entry> & { readonly index: number });

/** The comments and items in list order: each heading with its description, consecutive note lines as one note. */
function collect<Entry>(entries: readonly Entry[], commentsOf: (entry: Entry) => readonly string[] | undefined, end: readonly string[]) {
  const drafts: Draft<Entry>[] = [];
  const seen = new Map<string, number>();
  let part: string | null = null;
  const addBlock = (comments: readonly string[], at: number) => {
    // What the next note line joins: the heading's description right above, the open note, or nothing.
    let open: Draft<Entry> | undefined;
    comments.forEach((comment, line) => {
      const read = readCommentLine(comment);
      if (read.kind === 'heading') {
        const base = `${String(read.level)}:${read.title}`;
        const repeat = seen.get(base) ?? 0;
        seen.set(base, repeat + 1);
        const key = headingKey(read.level, read.title, repeat);
        open = {
          kind: 'heading',
          key,
          partKey: read.level === 1 ? null : part,
          level: read.level,
          title: read.title,
          notes: [],
          address: { at, line },
        };
        drafts.push(open);
        if (read.level === 1) part = key;
      } else if (read.kind === 'separator' || read.kind === 'blank') {
        open = undefined;
      } else if (open?.kind === 'heading') {
        if (read.text !== '') open.notes.push(read.text);
      } else if (open?.kind === 'note') {
        open.text = `${open.text}\n${read.text}`;
        open.count++;
      } else {
        open = { kind: 'note', key: `note:${String(at)}:${String(line)}`, text: read.text, address: { at, line }, count: 1 };
        drafts.push(open);
      }
    });
  };
  entries.forEach((entry, index) => {
    addBlock(commentsOf(entry) ?? [], index);
    drafts.push({ kind: 'item', entry, index });
  });
  addBlock(end, entries.length);
  // A note of empty `//` lines only has nothing to show.
  return drafts.flatMap((draft): Draft<Entry>[] =>
    draft.kind !== 'note' ? [draft] : draft.text.trim() === '' ? [] : [{ ...draft, text: draft.text.trim() }]
  );
}

/** True when the list has a heading, so its comments show as rows. */
export function hasHeadings<Entry>(
  entries: readonly Entry[],
  commentsOf: (entry: Entry) => readonly string[] | undefined,
  end: readonly string[] = []
): boolean {
  return [...entries.flatMap((entry) => commentsOf(entry) ?? []), ...end].some((line) => readCommentLine(line).kind === 'heading');
}

/** The keys of every heading, for Collapse all. */
export function headingKeys<Entry>(
  entries: readonly Entry[],
  commentsOf: (entry: Entry) => readonly string[] | undefined,
  end: readonly string[] = []
): string[] {
  return collect(entries, commentsOf, end).flatMap((draft) => (draft.kind === 'heading' ? [draft.key] : []));
}

/** The keys of the headings an item sits in, outermost first (its part, then its section); none outside any heading. */
export function enclosingHeadingKeys<Entry>(
  entries: readonly Entry[],
  commentsOf: (entry: Entry) => readonly string[] | undefined,
  end: readonly string[],
  index: number
): string[] {
  const stack: { readonly level: HeadingLevel; readonly key: string }[] = [];
  for (const draft of collect(entries, commentsOf, end)) {
    if (draft.kind === 'heading') {
      while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= draft.level) stack.pop();
      stack.push({ level: draft.level, key: draft.key });
    } else if (draft.kind === 'item' && draft.index === index) {
      return stack.map((heading) => heading.key);
    }
  }
  return [];
}

export interface SectionRowOptions {
  /**
   * The unfolded heading keys; every other heading is folded (a heading not seen before starts folded). Without it
   * every heading is open. Ignored while searching.
   */
  readonly open?: ReadonlySet<string>;
  /**
   * An item listed even inside a folded section, under its headings (shown folded): the selection after an edit moved
   * it into a folded section, so it stays in view.
   */
  readonly keep?: number | null;
  /**
   * A search: the items it matches, and the headings whose title it matches (their whole section is listed). The rows
   * are the listed items under the headings they sit in; notes are left out.
   */
  readonly search?: { readonly matches: (index: number) => boolean; readonly headingMatches: (title: string) => boolean };
}

/** The rows of a list: every item, and the headings and notes when the list has a heading. */
export function buildSectionRows<Entry>(
  entries: readonly Entry[],
  commentsOf: (entry: Entry) => readonly string[] | undefined,
  end: readonly string[],
  { open, keep = null, search }: SectionRowOptions = {}
): SectionRow<Entry>[] {
  const drafts = collect(entries, commentsOf, end);
  const item = (draft: Draft<Entry> & { kind: 'item' }): ItemRow<Entry> => ({ kind: 'item', entry: draft.entry });
  if (!drafts.some((draft) => draft.kind === 'heading')) {
    return drafts.flatMap((draft) => (draft.kind === 'item' && (search?.matches(draft.index) ?? true) ? [item(draft)] : []));
  }

  const headingRow = (draft: Draft<Entry> & { kind: 'heading' }, position: number): HeadingRow => {
    let itemCount = 0;
    let after = drafts.length;
    for (let index = position + 1; index < drafts.length; index++) {
      const next = drafts[index];
      if (next.kind === 'heading' && next.level <= draft.level) {
        after = index;
        break;
      }
      if (next.kind === 'item') itemCount++;
    }
    let before = position - 1;
    while (before >= 0) {
      const previous = drafts[before];
      if (previous.kind === 'heading' && previous.level <= draft.level) break;
      before--;
    }
    const previous = before >= 0 ? drafts[before] : undefined;
    const next = drafts.at(after);
    return {
      ...draft,
      itemCount,
      collapsed: search === undefined && open !== undefined && !open.has(draft.key),
      canMoveUp: previous?.kind === 'heading' && previous.level === draft.level,
      canMoveDown: next?.kind === 'heading' && next.level === draft.level,
    };
  };

  if (search !== undefined) {
    // The open headings above each draft, innermost last; a heading is listed when something under it is.
    const listed = new Set<number>();
    const rows: { readonly position: number; readonly row: SectionRow<Entry> }[] = [];
    const stack: { readonly position: number; readonly level: HeadingLevel; readonly matches: boolean }[] = [];
    drafts.forEach((draft, position) => {
      if (draft.kind === 'heading') {
        while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= draft.level) stack.pop();
        const matches = search.headingMatches(draft.title);
        stack.push({ position, level: draft.level, matches });
        if (matches) {
          for (const open of stack) listed.add(open.position);
        }
        return;
      }
      if (draft.kind !== 'item') return;
      if (!search.matches(draft.index) && !stack.some((open) => open.matches)) return;
      for (const open of stack) listed.add(open.position);
      rows.push({ position, row: item(draft) });
    });
    for (const position of listed) {
      const draft = drafts[position];
      if (draft.kind === 'heading') rows.push({ position, row: headingRow(draft, position) });
    }
    return rows.sort((a, b) => a.position - b.position).map(({ row }) => row);
  }

  const rows: SectionRow<Entry>[] = [];
  // The headings above the current draft (innermost last), with whether their row is listed.
  const stack: { readonly row: HeadingRow; listed: boolean }[] = [];
  let hiddenBelow: HeadingLevel | null = null;
  drafts.forEach((draft, position) => {
    if (draft.kind === 'heading') {
      while (stack.length > 0 && (stack.at(-1)?.row.level ?? 0) >= draft.level) stack.pop();
      if (hiddenBelow !== null && draft.level <= hiddenBelow) hiddenBelow = null;
      const row = headingRow(draft, position);
      const listed = hiddenBelow === null;
      stack.push({ row, listed });
      if (!listed) return;
      if (row.collapsed) hiddenBelow = row.level;
      rows.push(row);
      return;
    }
    if (hiddenBelow === null) {
      rows.push(draft.kind === 'item' ? item(draft) : draft);
    } else if (draft.kind === 'item' && draft.index === keep) {
      // The kept item shows under its own headings, so it does not read as part of the folded one above it.
      for (const heading of stack) {
        if (heading.listed) continue;
        heading.listed = true;
        // Hidden by a folded part: it reads as folded too, whatever its own state, as the rest of it is hidden.
        rows.push({ ...heading.row, collapsed: true });
      }
      rows.push(item(draft));
    }
  });
  return rows;
}

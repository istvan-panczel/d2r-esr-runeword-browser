/**
 * The comment lines the model keeps (`leadingComments`, `keyComments`, `commentsBefore`, `rulesEndComments`) are the
 * file's `//` lines verbatim, plus an empty string where the file has one or more blank lines between two comment
 * lines of the same block. `//` alone is an empty comment, not a blank line. The section reader ends a heading's
 * description and a note at a blank line (utils/sections.ts); the serializer writes it back as an empty line.
 */

/** A blank line between two comment lines. */
export const BLANK_COMMENT_LINE = '';

export function isBlankCommentLine(line: string): boolean {
  return line.trim() === '';
}

/** The lines without blank lines at the start and the end, and one blank line for each run of them. */
export function tidyCommentBlock(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const blank = isBlankCommentLine(line);
    if (blank && (out.length === 0 || out[out.length - 1] === BLANK_COMMENT_LINE)) continue;
    out.push(blank ? BLANK_COMMENT_LINE : line);
  }
  if (out.at(-1) === BLANK_COMMENT_LINE) out.pop();
  return out;
}

/** Two comment blocks as one (a deleted item's comments handed to the next): a blank line between them keeps them apart. */
export function joinCommentBlocks(first: readonly string[], second: readonly string[]): string[] {
  return tidyCommentBlock(first.length > 0 && second.length > 0 ? [...first, BLANK_COMMENT_LINE, ...second] : [...first, ...second]);
}

/** Whether the source has a blank line between the line of offset `from` and the line of offset `to`. */
export function blankLineBetween(source: string, from: number, to: number): boolean {
  return source
    .slice(from, to)
    .split('\n')
    .slice(1, -1)
    .some((line) => line.trim() === '');
}

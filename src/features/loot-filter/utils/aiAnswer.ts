/**
 * Reads a pasted LLM answer: finds the filter JSON among the prose and code fences and parses it as leniently as an
 * upload (`parseLootFilter`: `//` and block comments, trailing commas). With several code blocks the last complete
 * filter wins (the LLM's final version); an answer split over two blocks (a reply that was cut off and continued) is
 * tried joined. A reply without fences is tried whole, then from its first `{` to its last `}`.
 */
import { JsoncSyntaxError, parseJsonc } from '../engine/jsonc';
import { isPlainObject, parseLootFilter } from '../engine/parse';
import type { Diagnostic, LootFilter } from '../engine/types';

export interface AiAnswerSuccess {
  readonly ok: true;
  /** The filter file text to import (the block's content, leading `//` lines included). */
  readonly text: string;
  readonly filter: LootFilter;
  readonly diagnostics: readonly Diagnostic[];
  readonly notes: readonly Diagnostic[];
  /** How many code blocks the answer had (one of them, or all of them joined, is the filter). */
  readonly blocks: number;
}

export interface AiAnswerFailure {
  readonly ok: false;
  /** `empty`: nothing pasted; `none`: no JSON found; `syntax`: the JSON does not parse; `notFilter`: JSON, but not a whole filter. */
  readonly kind: 'empty' | 'none' | 'syntax' | 'notFilter';
  readonly message: string;
}

export type AiAnswerResult = AiAnswerSuccess | AiAnswerFailure;

/** A fenced code block: its info string (`json`) and content; `closed` false when the answer ends inside it. */
export interface CodeBlock {
  readonly info: string;
  readonly content: string;
  readonly closed: boolean;
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;

/** The fenced code blocks of a markdown text, in order. */
export function codeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let open: { fence: string; info: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (open === null) {
      const match = FENCE_OPEN.exec(line);
      // Both groups always take part in a match (the info string may be empty).
      if (match) open = { fence: match[1], info: match[2].toLowerCase(), lines: [] };
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith(open.fence.charAt(0)) && trimmed.length >= open.fence.length && /^(`+|~+)$/.test(trimmed)) {
      blocks.push({ info: open.info, content: open.lines.join('\n'), closed: true });
      open = null;
      continue;
    }
    open.lines.push(line);
  }
  if (open !== null) blocks.push({ info: open.info, content: open.lines.join('\n'), closed: false });
  return blocks;
}

const JSON_INFOS = new Set(['', 'json', 'jsonc', 'json5', 'javascript', 'js']);

/** Whether a block may hold the filter: a JSON-ish info string, or content that starts like a filter file. */
function mayBeFilter(block: CodeBlock): boolean {
  const start = block.content.trimStart();
  return JSON_INFOS.has(block.info) || start.startsWith('{') || start.startsWith('//');
}

type Attempt = { readonly ok: true; readonly result: AiAnswerSuccess } | { readonly ok: false; readonly failure: AiAnswerFailure };

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return 'it is a list; the file is one object with "formatVersion" and "rules"';
  if (isPlainObject(value)) return 'it has no "rules" list, so it looks like a single rule or a part of the file';
  return 'it is not an object';
}

/** Parses one candidate text; a whole filter has `rules` or `formatVersion` at the top. */
function attempt(text: string, blocks: number): Attempt {
  const source = `${text.trim()}\n`;
  try {
    const { value } = parseJsonc(source);
    if (!isPlainObject(value) || !('rules' in value || 'formatVersion' in value)) {
      return { ok: false, failure: { ok: false, kind: 'notFilter', message: describeValue(value) } };
    }
    const { filter, diagnostics, notes } = parseLootFilter(source);
    return { ok: true, result: { ok: true, text: source, filter, diagnostics, notes, blocks } };
  } catch (error) {
    const message = error instanceof JsoncSyntaxError || error instanceof Error ? error.message : String(error);
    return { ok: false, failure: { ok: false, kind: 'syntax', message } };
  }
}

/**
 * An answer without code fences: from the first line that opens an object (with the `//` lines right above it) to the
 * last line that is only `}`, and to the last `}` at all (prose after the JSON may hold braces too). Empty without one.
 */
function braceSpans(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.trimStart().startsWith('{'));
  if (first === -1) return [];
  let start = first;
  while (start > 0 && (lines[start - 1] ?? '').trimStart().startsWith('//')) start--;
  const rest = lines.slice(start);
  const spans: string[] = [];
  let lastLine = rest.length - 1;
  while (lastLine >= 0 && rest[lastLine]?.trim() !== '}') lastLine--;
  if (lastLine !== -1) spans.push(rest.slice(0, lastLine + 1).join('\n'));
  const joined = rest.join('\n');
  const end = joined.lastIndexOf('}');
  if (end !== -1) spans.push(joined.slice(0, end + 1));
  return [...new Set(spans)];
}

/** A top-level-looking `"formatVersion"` key: the candidate is a whole filter file, not a snippet. */
const WHOLE_FILE = /"formatVersion"\s*:/;

const NONE: AiAnswerFailure = { ok: false, kind: 'none', message: 'No JSON found in the answer' };

/** Reads the filter out of a pasted LLM answer. */
export function extractFilterFromAnswer(answer: string): AiAnswerResult {
  if (answer.trim() === '') return { ok: false, kind: 'empty', message: 'Nothing pasted yet' };
  const blocks = codeBlocks(answer).filter(mayBeFilter);
  // Fenced blocks, last first (the LLM's final version); without any, the brace spans (the longer one last).
  const candidates = blocks.length > 0 ? blocks.map((block) => block.content).reverse() : braceSpans(answer);
  if (candidates.length === 0) return NONE;
  const failures: AiAnswerFailure[] = [];
  // The latest block that is a whole file ("formatVersion" at the top) wins over a later snippet that only has "rules"
  // (an answer adding "to add a level, add this:" after the full filter); without one, the latest that reads.
  let snippet: AiAnswerSuccess | undefined;
  for (const candidate of candidates) {
    const tried = attempt(candidate, blocks.length);
    if (tried.ok) {
      if (WHOLE_FILE.test(tried.result.text)) return tried.result;
      snippet ??= tried.result;
    } else failures.push(tried.failure);
  }
  if (snippet !== undefined) return snippet;
  // A long answer continued in a second block: the blocks joined.
  if (blocks.length > 1) {
    const joined = attempt(blocks.map((block) => block.content).join('\n'), blocks.length);
    if (joined.ok) return joined.result;
  }
  // The JSON written outside the fences (ChatGPT once put the whole filter before its ```json line and only its closing
  // sentence inside): the brace spans of the whole answer.
  if (blocks.length > 0) {
    for (const span of braceSpans(answer)) {
      const tried = attempt(span, 0);
      if (tried.ok) return tried.result;
    }
  }
  // The first failure is the last block's (or the tightest span's): the one the LLM meant as its answer.
  return failures[0] ?? NONE;
}

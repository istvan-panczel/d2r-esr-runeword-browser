/**
 * The follow-up messages of the LLM loop: "Copy problems for the AI" (the validator's problems with rule numbers and
 * comments, and the instruction to fix only those) and the request to resend a complete filter when an answer had no
 * readable JSON. Also the name of the draft the AI page's first import creates.
 */
import type { Diagnostic, LootFilter } from '../engine/types';
import type { AiAnswerFailure } from './aiAnswer';

/** The closing line of every follow-up. */
export const FOLLOW_UP_CLOSE = 'Fix these and keep everything else; reply with the complete filter as one json block.';

/** Problems listed in one message; the rest are counted (a long list would drown the request). */
export const MAX_LISTED_PROBLEMS = 80;

const COMMENT_LENGTH = 80;

/** "Rule 12" (enabled rules, 1-based as in the file) or "Disabled rule 2", from a file path; null for other paths. */
export function ruleLabelOfPath(path: string): string | null {
  const enabled = /^rules\/(\d+)(\/|$)/.exec(path);
  if (enabled) return `Rule ${String(Number(enabled[1]) + 1)}`;
  const disabled = /^disabledRules\/(\d+)(\/|$)/.exec(path);
  return disabled ? `Disabled rule ${String(Number(disabled[1]) + 1)}` : null;
}

function shortComment(comment: string | undefined): string | null {
  const text = comment?.replace(/\s+/g, ' ').trim();
  if (text === undefined || text === '') return null;
  return text.length > COMMENT_LENGTH ? `${text.slice(0, COMMENT_LENGTH - 1)}…` : text;
}

/** One problem line: where (rule number and comment, or style), the path, the message. */
export function problemLine(diagnostic: Diagnostic, filter: LootFilter | null): string {
  const parts: string[] = [];
  const rule = ruleLabelOfPath(diagnostic.path);
  if (rule !== null) {
    const comment = diagnostic.rule === undefined ? null : shortComment(filter?.rules[diagnostic.rule]?.comment);
    parts.push(comment === null ? rule : `${rule} "${comment}"`);
  } else if (diagnostic.style !== undefined) {
    parts.push(`Style "${diagnostic.style}"`);
  }
  if (diagnostic.path !== '') parts.push(`(${diagnostic.path})`);
  const where = parts.join(' ');
  return `- ${where === '' ? '' : `${where}: `}${diagnostic.message}`;
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/**
 * The message for the LLM: the errors, then the warnings, each with its rule number (as in the file's `rules` list,
 * counting from 1), the rule's comment and the JSON path, then {@link FOLLOW_UP_CLOSE}. Null without problems.
 */
export function problemsMessage(diagnostics: readonly Diagnostic[], filter: LootFilter | null): string | null {
  if (diagnostics.length === 0) return null;
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  let budget = MAX_LISTED_PROBLEMS;
  const section = (title: string, list: readonly Diagnostic[]): string[] => {
    if (list.length === 0) return [];
    const shown = list.slice(0, Math.max(budget, 0));
    budget -= shown.length;
    const more = list.length - shown.length;
    return [
      `${title}:`,
      ...shown.map((diagnostic) => problemLine(diagnostic, filter)),
      ...(more > 0
        ? [`- … and ${plural(more, title === 'Errors' ? 'more error' : 'more warning')} (fix these first, I will send the rest)`]
        : []),
      '',
    ];
  };
  return [
    `The loot filter app checked your filter and reports ${plural(errors.length, 'error')} and ${plural(warnings.length, 'warning')}. Rule numbers count from 1 in the order of the "rules" list; the path in brackets is the JSON path (0-based).`,
    'Errors switch the rule off in the game; warnings are rules that may not do what they should. If a warning is intended (or a plugin limit you cannot work around), keep the rule and tell me why.',
    '',
    ...section('Errors', errors),
    ...section('Warnings', warnings),
    FOLLOW_UP_CLOSE,
  ].join('\n');
}

/** The message asking the LLM to resend the whole filter, when its answer had no readable filter JSON. */
export function resendMessage(failure: AiAnswerFailure): string {
  const reason =
    failure.kind === 'syntax'
      ? `The JSON in your last answer cannot be read: ${failure.message}. It may have been cut off.`
      : failure.kind === 'notFilter'
        ? `The JSON in your last answer is not a complete filter (${failure.message}).`
        : 'I could not find the filter JSON in your last answer.';
  return `${reason} Please reply with the complete filter file as ONE \`\`\`json code block: the whole file, not only the changes. If it is too long for one answer, tell me and we shorten it.`;
}

const NAME_LENGTH = 40;
/** A title is meant as a name, so it may be longer than a request's first line (saved filter names allow 100). */
const TITLE_LENGTH = 60;

/** Collapses whitespace and shortens to `max` characters, at a word when one ends past the middle (`…` when cut). */
function clipName(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  const cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The name of a new draft from an AI answer: the filter's `title` (colour codes dropped, shortened at a word), else
 * the request's first line (trailing punctuation dropped, shortened), else "AI filter".
 */
export function aiFilterName(request: string, title?: string): string {
  const fromTitle = clipName((title ?? '').replace(/ÿc./g, ''), TITLE_LENGTH);
  if (fromTitle !== '') return fromTitle;
  const firstLine = request
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '');
  const fromRequest = firstLine === undefined ? '' : clipName(firstLine.replace(/[.,;:!?]+$/, ''), NAME_LENGTH);
  return fromRequest === '' ? 'AI filter' : fromRequest;
}

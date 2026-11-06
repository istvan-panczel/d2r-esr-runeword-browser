/**
 * The hand-written modifier explanations (content/modifiers/modifiers.md + open-questions.md, docs/features/MODIFIERS.md
 * "Content"): the block parser, the inline tokenizer (code, bold, links, source tags) and the open-question parser.
 * Pure; the page imports the markdown as text (`?raw`) and the tests read the same files from disk.
 *
 * Block format, one per modifier explanation:
 *
 *   ## <key> — <title>
 *   stats: <the stats it covers, free text>
 *   summary: <one line>
 *   body: <paragraph with inline source tags [ESR config] / [ESR files] / [Vanilla] / [Community 3.9]>
 *   facts: (a bullet list, or inline text)
 *   caveats: (a bullet list, or inline text; "none…" = no caveats)
 *   sources: <entries separated by "; ">
 *
 * Numbers are `{placeholders}` (modifierPlaceholders.ts); an HTML comment after one holds the value it had when written.
 */

export interface ContentBlock {
  readonly key: string;
  readonly title: string;
  /** The `stats:` line as written (the kind mapping lives in modifierContentKinds.ts) */
  readonly stats: string;
  readonly summary: string;
  readonly body: string;
  /** Text in parentheses after `facts` ("facts (share of current life = …):") */
  readonly factsIntro: string;
  readonly facts: readonly string[];
  readonly caveats: readonly string[];
  readonly sources: readonly string[];
}

export interface ParsedContent {
  readonly blocks: readonly ContentBlock[];
  /** Duplicate keys, blocks without a summary or body */
  readonly errors: readonly string[];
}

const HEADING = /^## (\S+) — (.+)$/;
const FIELD = /^(stats|summary|body|facts|caveats|sources)(?:\s*\(([^)]*)\))?:\s*(.*)$/;
type Field = 'stats' | 'summary' | 'body' | 'facts' | 'caveats' | 'sources';

interface Draft {
  key: string;
  title: string;
  inline: Partial<Record<Field, string>>;
  lists: Partial<Record<Field, string[]>>;
  factsIntro: string;
}

function finishBlock(draft: Draft): ContentBlock {
  const listOrInline = (field: Field, none?: RegExp): string[] => {
    const list = draft.lists[field] ?? [];
    const inline = (draft.inline[field] ?? '').trim();
    if (inline === '' || (none !== undefined && none.test(inline))) return list;
    return [inline, ...list];
  };
  return {
    key: draft.key,
    title: draft.title.trim(),
    stats: (draft.inline.stats ?? '').trim(),
    summary: (draft.inline.summary ?? '').trim(),
    body: (draft.inline.body ?? '').trim(),
    factsIntro: draft.factsIntro,
    facts: listOrInline('facts'),
    caveats: listOrInline('caveats', /^none\b/i),
    sources: (draft.inline.sources ?? '')
      .split(/;\s+/)
      .map((source) => source.trim())
      .filter((source) => source !== ''),
  };
}

/** The `## key — title` blocks of modifiers.md (other headings, like the file's "How to read" section, are skipped) */
export function parseModifierContent(text: string): ParsedContent {
  const blocks: ContentBlock[] = [];
  const errors: string[] = [];
  let draft: Draft | null = null;
  let field: Field | null = null;
  const flush = () => {
    if (draft === null) return;
    const block = finishBlock(draft);
    if (blocks.some((other) => other.key === block.key)) errors.push(`duplicate content key ${block.key}`);
    if (block.summary === '') errors.push(`${block.key}: no summary`);
    if (block.body === '') errors.push(`${block.key}: no body`);
    blocks.push(block);
    draft = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith('## ') || line.startsWith('# ')) {
      flush();
      field = null;
      const heading = HEADING.exec(line);
      if (heading !== null) draft = { key: heading.at(1) ?? '', title: heading.at(2) ?? '', inline: {}, lists: {}, factsIntro: '' };
      continue;
    }
    if (draft === null) continue;
    const current: Draft = draft;
    if (line.trim() === '---') {
      field = null;
      continue;
    }
    const match = FIELD.exec(line);
    if (match !== null) {
      field = match[1] as Field;
      current.inline[field] = match.at(3) ?? '';
      const intro = match.at(2);
      if (field === 'facts' && intro !== undefined) current.factsIntro = intro.trim();
      continue;
    }
    if (line.trim() === '' || field === null) continue;
    const item = /^\s*[-*] (.*)$/.exec(line);
    const list = (current.lists[field] ??= []);
    const previous = list.at(-1);
    if (item !== null) list.push(item.at(1) ?? '');
    else if (previous !== undefined) list[list.length - 1] = `${previous} ${line.trim()}`;
    else current.inline[field] = `${current.inline[field] ?? ''} ${line.trim()}`.trim();
  }
  flush();
  return { blocks, errors };
}

// --- open questions -----------------------------------------------------------------------------------------------------

export interface OpenQuestion {
  readonly number: number;
  /** The bold title without the "(Test)" / "(Ask)" suffix */
  readonly title: string;
  /** "Test", "Ask", "Test, then ask" … */
  readonly how: string;
  /** Content keys it affects */
  readonly keys: readonly string[];
  /** Its lines (the explanation, then "Test: …" / "Ask: …") */
  readonly lines: readonly string[];
}

const QUESTION = /^(\d+)\. (\*\*.+?)\s+—\s+(.*)$/;

/** The numbered questions of open-questions.md (`N. **Title (Test)** — \`key\`, \`key\``, then indented lines) */
export function parseOpenQuestions(text: string): OpenQuestion[] {
  const questions: { number: number; title: string; how: string; keys: string[]; lines: string[] }[] = [];
  let current: (typeof questions)[number] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const match = QUESTION.exec(raw);
    if (match !== null) {
      // "**Title (Test)** **(new)**": the bold markers and the "(new)" flag go
      const heading = (match.at(2) ?? '')
        .replace(/\*\*/g, '')
        .replace(/\s*\(new\)\s*$/i, '')
        .trim();
      const how = /\(([^()]+)\)\s*$/.exec(heading);
      current = {
        number: Number(match[1]),
        title: (how === null ? heading : heading.slice(0, how.index)).trim(),
        how: how?.at(1)?.trim() ?? '',
        keys: [...(match.at(3) ?? '').matchAll(/`([^`]+)`/g)].map((key) => key.at(1) ?? ''),
        lines: [],
      };
      questions.push(current);
      continue;
    }
    if (current === null) continue;
    if (/^\s{2,}\S/.test(raw)) current.lines.push(raw.trim());
    else if (raw.trim() !== '') current = null;
  }
  return questions;
}

// --- inline text --------------------------------------------------------------------------------------------------------

export type SourceKind = 'esr-config' | 'esr-files' | 'vanilla' | 'community';

export interface SourceTag {
  readonly kind: SourceKind;
  /** "Community 3.9" → "3.9" */
  readonly version?: string;
  /** What follows the comma ("[Vanilla, D2MOO SUnitDmg.cpp:976–990]" → "D2MOO SUnitDmg.cpp:976–990") */
  readonly detail?: string;
}

export type InlineToken =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'strong'; readonly text: string }
  | { readonly type: 'link'; readonly text: string; readonly href: string }
  | { readonly type: 'tag'; readonly tag: SourceTag };

const TAG_KINDS: Readonly<Partial<Record<string, SourceKind>>> = {
  'ESR config': 'esr-config',
  'ESR files': 'esr-files',
  Vanilla: 'vanilla',
  Community: 'community',
};

/** `code`, **bold**, [text](url), bare URLs and the source tags */
const INLINE =
  /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s;,)]+[^\s;,).])|\[(ESR config|ESR files|Vanilla|Community)(?: (\d+(?:\.\d+)*))?(?:,\s*([^\]]+))?\]/g;

export function parseSourceTag(name: string, version?: string, detail?: string): SourceTag | null {
  const kind = TAG_KINDS[name];
  if (kind === undefined) return null;
  return { kind, ...(version === undefined ? {} : { version }), ...(detail === undefined ? {} : { detail: detail.trim() }) };
}

/** The tokens of one line of content text (placeholders already resolved) */
export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  const pushText = (value: string) => {
    if (value === '') return;
    const previous = tokens.at(-1);
    if (previous?.type === 'text') tokens[tokens.length - 1] = { type: 'text', text: previous.text + value };
    else tokens.push({ type: 'text', text: value });
  };
  for (const match of text.matchAll(INLINE)) {
    pushText(text.slice(last, match.index));
    last = match.index + match[0].length;
    const [, code, strong, linkText, linkHref, url, tagName, tagVersion, tagDetail] = Array.from({ length: 9 }, (_, i) => match.at(i));
    if (code !== undefined) tokens.push({ type: 'code', text: code });
    else if (strong !== undefined) tokens.push({ type: 'strong', text: strong });
    else if (linkText !== undefined && linkHref !== undefined) tokens.push({ type: 'link', text: linkText, href: linkHref });
    else if (url !== undefined) tokens.push({ type: 'link', text: url, href: url });
    else {
      const tag = parseSourceTag(tagName ?? '', tagVersion, tagDetail);
      if (tag === null) pushText(match[0]);
      else tokens.push({ type: 'tag', tag });
    }
  }
  pushText(text.slice(last));
  return tokens;
}

/** The text without source tags and markup, for search */
export function plainText(tokens: readonly InlineToken[]): string {
  return tokens
    .map((token) => (token.type === 'tag' ? '' : token.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- sources ------------------------------------------------------------------------------------------------------------

export const ESR_GITHUB = 'https://github.com/CelestialRayOne/Eastern_Sun_Resurrected/blob/main/';
export const D2MOO_GITHUB = 'https://github.com/ThePhrozenKeep/D2MOO/blob/4a60fca/source/';
export const UNOFFICIAL_WIKI = 'https://doubleeclipse.github.io/esr-tools/unofficial-wiki/';

const ESR_PREFIXES: readonly [string, string][] = [
  ['ESR/', ''],
  ['excel/', 'Eastern_Sun_Resurrected.mpq/data/global/excel/'],
  ['strings/', 'Eastern_Sun_Resurrected.mpq/data/local/lng/strings/'],
];

export interface SourceLink {
  readonly text: string;
  /** Null for a source with no public page (research notes, guide notes) */
  readonly href: string | null;
}

/** The file path of a source entry ("`excel/skills.txt` (Enchant)" → "excel/skills.txt") */
function sourcePath(entry: string): string {
  const code = /^`([^`]+)`/.exec(entry);
  return (code?.at(1) ?? entry.split(/[\s:]/).at(0) ?? '').replace(/[,…]+$/, '');
}

/**
 * A `sources:` entry as a link: ESR paths (`ESR/…`, `excel/…`, `strings/…`) to the ESR repository, D2MOO paths to the
 * D2MOO commit the drafts read, wiki page names to the unofficial wiki, URLs as they are. Local research files
 * (`scratchpad/…`) are left out (null).
 */
export function sourceLink(entry: string): SourceLink | null {
  const text = entry.replace(/`/g, '').trim();
  if (text.startsWith('scratchpad/')) return null;
  const url = /https?:\/\/\S+/.exec(text);
  if (url !== null) return { text: text.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: url[0] };
  if (text.startsWith('wiki')) return { text: `Unofficial wiki: ${text.replace(/^wiki\s*/, '')}`, href: UNOFFICIAL_WIKI };
  const path = sourcePath(entry);
  if (path.startsWith('D2MOO/')) {
    const file = path.replace(/^D2MOO\//, '').replace(/:[\d–-]+.*$/, '');
    return { text, href: `${D2MOO_GITHUB}${file}` };
  }
  for (const [prefix, repoPath] of ESR_PREFIXES) {
    if (path.startsWith(prefix)) return { text, href: `${ESR_GITHUB}${repoPath}${path.slice(prefix.length)}` };
  }
  return { text, href: null };
}

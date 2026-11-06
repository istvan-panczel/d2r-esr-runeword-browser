/**
 * content/guide (as raw texts) + game data + ESR tables → the guide bundle, counts, errors and warnings.
 * Pure: the fs reads live in readGuideInputs.ts so tests can run this on fixtures.
 */
import { normaliseItemName } from '../../../core/utils/itemName.ts';
import type { GuideBlock, GuideBundle, GuideInline, GuideNote } from '../engine/schema.ts';
import { compareCodeUnits } from './compare.ts';
import { parseGlossary, parseSourceRefs, parseSpine } from './content.ts';
import { resolveGlossaryEntries } from './glossaryEntries.ts';
import { createGuideContext, type DocsIndex, type GameDataInputs, type GuideContext } from './context.ts';
import type { EsrGuideTables } from './esrGuideSources.ts';
import type { EsrForGuide } from './readGuideInputs.ts';
import { buildGraph } from './graph.ts';
import { buildNoteIndex } from './noteIndex.ts';
import { countWords } from './markdown.ts';
import { parseNote, type ParsedNote } from './parseNote.ts';
import { hashDataBlocks, noteStaleReasons, type PatchNote } from './staleness.ts';
import { LOCK_FILE, parseVerifyLock, type BlockHashes } from './verifyLock.ts';

const WORDS_WARN = 400;

export interface GuideContentFiles {
  /** `notes/<slug>.md` files: path relative to the content dir + text */
  notes: { file: string; text: string }[];
  spine: string;
  /** null when the file does not exist (treated as empty) */
  glossary: string | null;
  sources: string | null;
  /** `.verify-lock.json`; null or omitted when the file does not exist (every verified note is then unrecorded) */
  verifyLock?: string | null;
}

export interface GenerateGuideInput {
  content: GuideContentFiles;
  gameData: GameDataInputs;
  /** null when the ESR clone is missing */
  esr: EsrGuideTables | null;
  docs: DocsIndex | null;
  /** `<esr>/patchnotes/*.md`; omitted (or empty) when the clone is missing */
  patchNotes?: readonly PatchNote[];
}

export interface GeneratedGuide {
  bundle: GuideBundle;
  /** Current data-block hashes per slug (what guide:verify records) */
  blockHashes: ReadonlyMap<string, BlockHashes>;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
}

/** Gives unlabeled `[[slug]]` links the target note's title. */
function labelInlines(inlines: readonly GuideInline[], titles: ReadonlyMap<string, string>): GuideInline[] {
  return inlines.map((inline): GuideInline => {
    switch (inline.type) {
      case 'link':
        if (inline.kind === 'note' && inline.children.length === 0) {
          return { ...inline, children: [{ type: 'text', value: titles.get(inline.href) ?? inline.href }] };
        }
        return { ...inline, children: labelInlines(inline.children, titles) };
      case 'strong':
      case 'emphasis':
      case 'term':
        return { ...inline, children: labelInlines(inline.children, titles) };
      default:
        return inline;
    }
  });
}

function labelBlocks(blocks: readonly GuideBlock[], titles: ReadonlyMap<string, string>): GuideBlock[] {
  return blocks.map((block): GuideBlock => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        return { ...block, children: labelInlines(block.children, titles) };
      case 'list':
        return { ...block, items: block.items.map((item) => labelBlocks(item, titles)) };
      case 'blockquote':
        return { ...block, children: labelBlocks(block.children, titles) };
      case 'table':
        return {
          ...block,
          header: block.header.map((cell) => labelInlines(cell, titles)),
          rows: block.rows.map((row) => row.map((cell) => labelInlines(cell, titles))),
        };
      default:
        return block;
    }
  });
}

function countDataBlocks(blocks: readonly GuideBlock[]): number {
  return blocks.reduce((sum, block) => {
    if (block.type === 'data') return sum + 1;
    if (block.type === 'list') return sum + block.items.reduce((itemSum, item) => itemSum + countDataBlocks(item), 0);
    if (block.type === 'blockquote') return sum + countDataBlocks(block.children);
    return sum;
  }, 0);
}

/** Normalised names (normaliseItemName) `mentions` may use; the sources.json part is the same set unique:/mythical:/socketable: links use. */
function knownItemNames(input: GenerateGuideInput, ctx: GuideContext): Set<string> {
  const names = [...input.gameData.runewords.runewords.map((runeword) => runeword.name), ...ctx.baseNames.values()];
  return new Set([
    ...[...names, ...(input.esr?.names ?? [])].map(normaliseItemName),
    ...ctx.sourceNames.unique,
    ...ctx.sourceNames.set,
    ...ctx.sourceNames.misc,
  ]);
}

export function generateGuide(input: GenerateGuideInput): GeneratedGuide {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (input.esr === null) warnings.push('ESR clone missing: directives that read the txt files cannot resolve');

  const spine = parseSpine(input.content.spine, 'spine.yml', errors);
  const parsedGlossary = parseGlossary(input.content.glossary ?? '', '_glossary.yml', errors);
  const sourceRefs = parseSourceRefs(input.content.sources ?? '', '_sources.yml', errors);
  const lock = parseVerifyLock(input.content.verifyLock ?? null, LOCK_FILE, errors);
  const baseCtx = createGuideContext({ gameData: input.gameData, glossary: parsedGlossary, esr: input.esr, docs: input.docs });
  // Fact values and links resolve against the game data the context holds; terms and owning notes stay as parsed.
  const glossary = resolveGlossaryEntries(parsedGlossary, baseCtx, '_glossary.yml', errors);
  const ctx: GuideContext = { ...baseCtx, glossary };

  const parsed: (ParsedNote & { file: string })[] = [...input.content.notes]
    .sort((a, b) => compareCodeUnits(a.file, b.file))
    .map(({ file, text }) => ({ ...parseNote(file, text, ctx), file }));

  const sourceIds = new Set(sourceRefs.map((ref) => ref.id));
  const itemNames = knownItemNames(input, ctx);
  const seen = new Map<string, string>();
  for (const { note, file, errors: noteErrors, warnings: noteWarnings, mentions } of parsed) {
    errors.push(...noteErrors);
    warnings.push(...noteWarnings);
    const duplicate = seen.get(note.slug);
    if (duplicate !== undefined) errors.push(`${file}: slug "${note.slug}" is also used by ${duplicate}`);
    seen.set(note.slug, file);
    for (const id of note.sources) if (!sourceIds.has(id)) errors.push(`${file}: sources: unknown id "${id}" (add it to _sources.yml)`);
    for (const name of mentions) {
      if (!itemNames.has(normaliseItemName(name)) && input.esr?.isKnown(name) !== true)
        warnings.push(`${file}: mentions: "${name}" not found in the game data`);
    }
  }

  const graph = buildGraph(
    parsed.map(({ note, file, noteLinks, nextOverride }) => ({
      slug: note.slug,
      file,
      noteLinks,
      knowFirst: note.knowFirst,
      related: note.related,
      nextOverride,
    })),
    spine,
    glossary
  );
  errors.push(...graph.errors);

  const titles = new Map(parsed.map(({ note }) => [note.slug, note.title]));
  const notes: GuideNote[] = parsed.map(({ note, file, dataBlocks }) => {
    const body = labelBlocks(note.body, titles);
    const words = countWords(body);
    const stale = noteStaleReasons({ note, dataBlocks, glossary, lock, patchNotes: input.patchNotes ?? [] });
    if (stale.unrecorded)
      warnings.push(`${file}: verified ${note.verified ?? ''} is not recorded in ${LOCK_FILE} (run npm run guide:verify -- ${note.slug})`);
    if (words > WORDS_WARN) warnings.push(`${file}: ${String(words)} words (target 150–250, warning above ${String(WORDS_WARN)})`);
    return {
      ...note,
      staleReasons: stale.reasons,
      backlinks: graph.backlinks.get(note.slug) ?? [],
      next: graph.next.get(note.slug) ?? null,
      spineStep: graph.spineStep.get(note.slug) ?? null,
      // counted again now that unlabeled [[links]] carry the target title
      words,
      body,
    };
  });

  const counts = {
    notes: notes.length,
    drafts: notes.filter((note) => note.verified === null).length,
    words: notes.reduce((sum, note) => sum + note.words, 0),
    dataBlocks: notes.reduce((sum, note) => sum + countDataBlocks(note.body), 0),
    spineSteps: spine.steps.length,
    questions: spine.questions.length,
    glossary: glossary.length,
    sourceRefs: sourceRefs.length,
  };
  const blockHashes = new Map(parsed.map(({ note, dataBlocks }) => [note.slug, hashDataBlocks(dataBlocks)]));
  const { familyNotes, itemNotes } = buildNoteIndex(
    parsed.map(({ note, dataBlocks }) => ({ slug: note.slug, dataBlocks })),
    ctx
  );
  return { bundle: { notes, spine, glossary, sourceRefs, familyNotes, itemNotes }, blockHashes, counts, errors, warnings };
}

/** generateGuide with the ESR tables, docs index and patch notes of a read clone (`readEsrForGuide`; null when missing). */
export function generateGuideWithEsr(content: GuideContentFiles, gameData: GameDataInputs, esr: EsrForGuide | null): GeneratedGuide {
  return generateGuide({ content, gameData, esr: esr?.tables ?? null, docs: esr?.docs ?? null, patchNotes: esr?.patchNotes ?? [] });
}

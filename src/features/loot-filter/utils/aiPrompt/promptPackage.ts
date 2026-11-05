/**
 * The LLM prompt package of the "Create a filter with AI help" page: the instructions (PROMPT.md), the reference files
 * (FORMAT.md, examples.md, assets.md, the game data tables) and the starter filter, as one .md, as a zip, or the
 * instructions alone for "Copy prompt". Nothing leaves the browser: the page only builds files.
 *
 * Loaded lazily by the page (`import('./promptPackage')`): the format text, the game data tables and the validator
 * runs stay out of the editor's chunk.
 */
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { slugify } from '@/utils/download';
import type { LootFilterReference } from '../../engine/types';
import { aiFilterName } from '../aiFollowUp';
import { EXAMPLE_RULES, type ExampleRule } from '../exampleRules';
import { buildZip } from '../zip';
import {
  buildAssets,
  buildExamples,
  buildFormatReference,
  DEFAULT_PROMPT_ASSETS,
  type PromptAssets,
  type PromptStylePreset,
} from './formatReference';
import { gameDataTables, type GameDataSize } from './gameDataTables';
import { buildInstructions, type PromptLayout, type StarterInfo } from './instructions';

export type { GameDataSize } from './gameDataTables';
export type { PromptAssets, PromptStylePreset } from './formatReference';

/** The filter the prompt starts from: its file text, its label and rule count. */
export interface PromptStarter extends StarterInfo {
  readonly text: string;
}

/** What the reference part depends on (everything but the request and the starter). */
export interface PromptReferenceInput {
  readonly data: LootFilterDataBundle;
  readonly types: TypesBundle;
  readonly reference: LootFilterReference;
  readonly esrVersion?: string;
  /** Default: the Rules tab's `EXAMPLE_RULES`. */
  readonly examples?: readonly ExampleRule[];
  /** Default: the bundled sounds and icons (`DEFAULT_PROMPT_ASSETS`). */
  readonly assets?: PromptAssets;
  /** Ready-made styles to show in examples.md; none by default. */
  readonly stylePresets?: readonly PromptStylePreset[];
}

export interface PromptPackageInput extends PromptReferenceInput {
  readonly request: string;
  readonly starter: PromptStarter | null;
  readonly size: GameDataSize;
  /** For the file names. */
  readonly date: Date;
}

export interface PromptFile {
  /** The file name in the zip, and the "File: <path>" heading of the single .md. */
  readonly path: string;
  readonly summary: string;
  readonly text: string;
}

export interface PromptPackage {
  /** `<name>-ai-prompt-<yyyy-mm-dd>`, the download names without extension. */
  readonly baseName: string;
  /** PROMPT.md: the instructions for attached files (also what "Copy prompt" copies). */
  readonly prompt: string;
  /** The reference files, then starter.json when there is a starter. */
  readonly files: readonly PromptFile[];
  /** Everything in one document. */
  readonly markdown: string;
}

/** About four characters per token for English text and code (an estimate; every model counts differently). */
export function approxTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// --- Reference files (cached: they depend only on the bundles and the seams, not on the request) ---

interface ReferenceCacheEntry {
  readonly key: readonly unknown[];
  readonly files: readonly PromptFile[];
}

let referenceCache: ReferenceCacheEntry[] = [];

function cacheKey(input: PromptReferenceInput, size: GameDataSize): unknown[] {
  return [input.data, input.types, input.reference, input.esrVersion, input.examples, input.assets, input.stylePresets, size];
}

/** FORMAT.md, examples.md, assets.md and the game data tables of one size. */
export function referenceFiles(input: PromptReferenceInput, size: GameDataSize): readonly PromptFile[] {
  const key = cacheKey(input, size);
  const hit = referenceCache.find((entry) => entry.key.every((part, index) => part === key[index]));
  if (hit !== undefined) return hit.files;
  const examples = input.examples ?? EXAMPLE_RULES;
  const files: PromptFile[] = [
    {
      path: 'FORMAT.md',
      summary:
        'the filter format: keys, conditions, stat checks, actions, how rules combine, hide rules and exceptions, texts and colours, plugin limits, the mistakes the app reports',
      text: buildFormatReference({ reference: input.reference, examples, esrVersion: input.esrVersion }),
    },
    {
      path: 'examples.md',
      summary: 'example rules, each teaching one idea (exceptions, all-of vs any-of, sockets, unique ids…)',
      text: buildExamples(examples, input.stylePresets),
    },
    {
      path: 'assets.md',
      summary: 'the bundled sound and icon files, the only ones to use',
      text: buildAssets(input.assets ?? DEFAULT_PROMPT_ASSETS),
    },
    ...gameDataTables(input.data, input.types, size),
  ];
  // Two sizes are in use at a time (the page measures both); keep one entry per size.
  referenceCache = [...referenceCache.filter((entry) => entry.key.at(-1) !== size), { key, files }];
  return files;
}

// --- The single document ---

const FENCE = '````';

/** A reference file as a section of the single .md: markdown files with their headings one level down, others fenced. */
function fileSection(file: PromptFile): string {
  const heading = `# File: ${file.path}`;
  if (file.path.endsWith('.md')) {
    let inFence = false;
    const body = file.text
      .split('\n')
      .map((line) => {
        if (line.startsWith('```')) inFence = !inFence;
        return !inFence && /^#{1,5} /.test(line) ? `#${line}` : line;
      })
      .join('\n');
    return `${heading}\n\n${body.trimEnd()}\n`;
  }
  const language = file.path.endsWith('.json') ? 'json' : file.path.endsWith('.csv') ? 'csv' : '';
  return `${heading}\n\n${FENCE}${language}\n${file.text.trimEnd()}\n${FENCE}\n`;
}

function instructionsFor(input: PromptPackageInput, files: readonly PromptFile[], layout: PromptLayout): string {
  return buildInstructions({
    request: input.request,
    starter: input.starter === null ? null : { label: input.starter.label, ruleCount: input.starter.ruleCount },
    size: input.size,
    files: files.map(({ path, summary }) => ({ path, summary })),
    layout,
    esrVersion: input.esrVersion,
  });
}

function starterFile(starter: PromptStarter): PromptFile {
  return {
    path: 'starter.json',
    summary: `the filter to start from ("${starter.label}", ${String(starter.ruleCount)} rules)`,
    text: starter.text,
  };
}

/** The whole package for one request. */
export function buildPromptPackage(input: PromptPackageInput): PromptPackage {
  const files = [...referenceFiles(input, input.size), ...(input.starter === null ? [] : [starterFile(input.starter)])];
  const name = input.starter?.label ?? aiFilterName(input.request);
  // "Sully's" → "sullys", not "sully-s".
  const baseName = `${slugify(name.replace(/['’]/g, ''), 'loot-filter')}-ai-prompt-${isoDate(input.date)}`;
  const markdown = [instructionsFor(input, files, 'single'), '---', '', ...files.map(fileSection)].join('\n');
  return { baseName, prompt: instructionsFor(input, files, 'files'), files, markdown };
}

/** The zip download: PROMPT.md, then the reference files and the starter. */
export function buildPromptZip(pkg: PromptPackage, modified?: Date): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  return buildZip(
    [{ path: 'PROMPT.md', text: pkg.prompt }, ...pkg.files].map((file) => ({ path: file.path, data: encoder.encode(file.text) })),
    modified
  );
}

/**
 * The size of each game data choice: the single .md for an empty request without a starter, in characters. The page
 * adds the request and the starter's text to show what the user's download will be.
 */
export function referenceSizes(input: PromptReferenceInput): Readonly<Record<GameDataSize, number>> {
  const measure = (size: GameDataSize) =>
    buildPromptPackage({ ...input, request: '', starter: null, size, date: new Date(0) }).markdown.length;
  return { compact: measure('compact'), full: measure('full') };
}

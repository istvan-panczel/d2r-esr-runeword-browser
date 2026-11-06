/** fs side of the guide generator: content dir, committed game-data bundles and the ESR clone. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BasesBundle,
  GameDataManifest,
  ModifiersBundle,
  SourcesBundle,
  TxtRunewordsBundle,
  TypesBundle,
} from '../../game-data/engine/schema.ts';
import type { DocsIndex, GameDataInputs } from './context.ts';
import { buildEsrGuideTables, readDocsIndex, readEsrGuideSources, type EsrGuideTables } from './esrGuideSources.ts';
import type { GuideContentFiles } from './generateGuide.ts';
import { versionFromPatchNoteFile, type PatchNote } from './staleness.ts';
import { LOCK_FILE } from './verifyLock.ts';

function readOptional(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** Number of `notes/*.md` files (0 when the folder is missing). */
export function countNoteFiles(contentDir: string): number {
  const notesDir = join(contentDir, 'notes');
  return existsSync(notesDir) ? readdirSync(notesDir).filter((name) => name.endsWith('.md')).length : 0;
}

export function readGuideContent(contentDir: string): GuideContentFiles {
  if (!existsSync(contentDir)) throw new Error(`Guide content folder not found: ${contentDir}`);
  const spine = readOptional(join(contentDir, 'spine.yml'));
  if (spine === null) throw new Error(`${join(contentDir, 'spine.yml')} is missing`);
  const notesDir = join(contentDir, 'notes');
  const notes = existsSync(notesDir)
    ? readdirSync(notesDir)
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => ({ file: `notes/${name}`, text: readFileSync(join(notesDir, name), 'utf8') }))
    : [];
  return {
    notes,
    spine,
    glossary: readOptional(join(contentDir, '_glossary.yml')),
    sources: readOptional(join(contentDir, '_sources.yml')),
    verifyLock: readOptional(join(contentDir, LOCK_FILE)),
  };
}

function readJson(path: string, hint: string): unknown {
  if (!existsSync(path)) throw new Error(`${path} is missing. ${hint}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function readGameDataInputs(gameDataDir: string, sourcesFile: string): GameDataInputs {
  const hint = 'Run npm run game-data:generate first.';
  return {
    runewords: readJson(join(gameDataDir, 'runewords.json'), hint) as TxtRunewordsBundle,
    bases: readJson(join(gameDataDir, 'bases.json'), hint) as BasesBundle,
    types: readJson(join(gameDataDir, 'types.json'), hint) as TypesBundle,
    sources: readJson(sourcesFile, `The guide's ::source[...] blocks need it; ${hint}`) as SourcesBundle,
    modifiers: readJson(join(gameDataDir, 'modifiers.json'), hint) as ModifiersBundle,
  };
}

export function readGameDataManifest(gameDataDir: string): GameDataManifest {
  return readJson(join(gameDataDir, 'manifest.json'), 'Run npm run game-data:generate first.') as GameDataManifest;
}

export interface EsrForGuide {
  esrVersion: string;
  tables: EsrGuideTables;
  docs: DocsIndex | null;
  patchNotes: PatchNote[];
}

/** `<esr>/patchnotes/<version>.md` files (others are ignored); empty when the folder is missing. */
function readPatchNotes(esrDir: string): PatchNote[] {
  const dir = join(esrDir, 'patchnotes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const version = versionFromPatchNoteFile(name);
      return version === null ? [] : [{ version, text: readFileSync(join(dir, name), 'utf8') }];
    });
}

/** Parsed ESR tables, docs anchors and patch notes, or null when the clone is missing. */
export function readEsrForGuide(esrDir: string): EsrForGuide | null {
  if (!existsSync(esrDir)) return null;
  const sources = readEsrGuideSources(esrDir);
  return {
    esrVersion: sources.esrVersion,
    tables: buildEsrGuideTables(sources),
    docs: readDocsIndex(esrDir),
    patchNotes: readPatchNotes(esrDir),
  };
}

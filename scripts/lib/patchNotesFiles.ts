/**
 * Writes or checks public/patch-notes/: index.json (the ESR patch notes from the clone's patchnotes/ folder, release
 * dates from its tags, our reports) and reports/ (copied from owner-notes/ when that local, gitignored folder exists).
 * Used by generate-game-data.ts and generate-patch-notes.ts. See docs/features/PATCH-NOTES.md.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeBundle } from '../../src/features/game-data/build/writeBundle.ts';
import { versionFromPatchNoteFile } from '../../src/features/guide/build/staleness.ts';
import { buildPatchNotesIndex, ownerNoteReport, publishedReportPath } from '../../src/features/patch-notes/build/patchNotesIndex.ts';
import type { PatchNotesIndex } from '../../src/features/patch-notes/engine/schema.ts';
import { ESR_REPO_URL, git, REPO_ROOT } from './esrClone.ts';

export const PATCH_NOTES_DIR = join(REPO_ROOT, 'public', 'patch-notes');
const INDEX_PATH = join(PATCH_NOTES_DIR, 'index.json');
const REPORTS_DIR = join(PATCH_NOTES_DIR, 'reports');
const OWNER_NOTES_DIR = join(REPO_ROOT, 'owner-notes');
const SOURCE_URL_BASE = `${ESR_REPO_URL.replace(/\.git$/, '')}/blob/main/patchnotes/`;

function readNotes(esrDir: string): Map<string, string> {
  const dir = join(esrDir, 'patchnotes');
  const notes = new Map<string, string>();
  if (!existsSync(dir)) return notes;
  for (const name of readdirSync(dir)) {
    const version = versionFromPatchNoteFile(name);
    if (version !== null) notes.set(version, readFileSync(join(dir, name), 'utf8'));
  }
  return notes;
}

function readTagDates(esrDir: string): Map<string, string> {
  const out = git(esrDir, ['for-each-ref', '--format=%(refname:short)\t%(creatordate:short)', 'refs/tags']) ?? '';
  const dates = new Map<string, string>();
  for (const line of out.split('\n')) {
    const [tag = '', date = ''] = line.split('\t');
    if (/^\d+(?:\.\d+)+$/.test(tag) && /^\d{4}-\d{2}-\d{2}$/.test(date)) dates.set(tag, date);
  }
  return dates;
}

function readPreviousDates(): Map<string, string> {
  if (!existsSync(INDEX_PATH)) return new Map();
  try {
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as PatchNotesIndex;
    return new Map(index.releases.flatMap((release) => (release.date === null ? [] : [[release.version, release.date] as const])));
  } catch {
    return new Map();
  }
}

/** Copies new or changed reports from owner-notes/ into reports/; returns the copied paths. */
function importOwnerNotes(): string[] {
  if (!existsSync(OWNER_NOTES_DIR)) return [];
  const copied: string[] = [];
  for (const name of readdirSync(OWNER_NOTES_DIR).sort()) {
    const report = ownerNoteReport(name);
    if (report === null) continue;
    const source = join(OWNER_NOTES_DIR, name);
    const relative = publishedReportPath(report.version, report.kind, report.ext);
    const target = join(PATCH_NOTES_DIR, relative);
    if (existsSync(target) && readFileSync(target).equals(readFileSync(source))) continue;
    mkdirSync(REPORTS_DIR, { recursive: true });
    copyFileSync(source, target);
    copied.push(relative);
  }
  return copied;
}

function listReports(): string[] {
  if (!existsSync(REPORTS_DIR)) return [];
  return readdirSync(REPORTS_DIR)
    .sort()
    .map((name) => `reports/${name}`);
}

/** Writes index.json (`check`: compares it, and copies nothing); false on a stale file with `check`. */
export function updatePatchNotes(esrDir: string, check: boolean): boolean {
  const copied = check ? [] : importOwnerNotes();
  const { index, warnings } = buildPatchNotesIndex({
    notes: readNotes(esrDir),
    tagDates: readTagDates(esrDir),
    previousDates: readPreviousDates(),
    reportFiles: listReports(),
    sourceUrlBase: SOURCE_URL_BASE,
  });
  const text = serializeBundle(index);
  const reportCount = index.releases.reduce((sum, release) => sum + release.reports.length, 0);
  console.log(`Patch notes: ${String(index.releases.length)} releases, ${String(reportCount)} reports`);
  for (const path of copied) console.log(`  copied from owner-notes/: public/patch-notes/${path}`);
  for (const warning of warnings) console.log(`  - ${warning}`);

  if (check) {
    if (!existsSync(INDEX_PATH) || readFileSync(INDEX_PATH, 'utf8') !== text) {
      console.error('Stale public/patch-notes/index.json. Run npm run patch-notes:generate.');
      return false;
    }
    console.log('Patch notes are up to date.');
    return true;
  }
  mkdirSync(PATCH_NOTES_DIR, { recursive: true });
  writeFileSync(INDEX_PATH, text, 'utf8');
  console.log(`Written public/patch-notes/index.json (${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)} KB)`);
  return true;
}

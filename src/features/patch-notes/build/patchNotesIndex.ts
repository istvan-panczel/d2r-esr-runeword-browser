/**
 * Builds `public/patch-notes/index.json` from the ESR patch-note files, the release tag dates and our report files.
 * Pure: the fs side is scripts/lib/patchNotesFiles.ts.
 */
import { compareVersions } from '../../../core/utils/versionUtils.ts';
import {
  PATCH_NOTE_REPORT_KINDS,
  PATCH_NOTES_SCHEMA,
  type PatchNoteBlock,
  type PatchNoteReport,
  type PatchNoteReportKind,
  type PatchNotesIndex,
} from '../engine/schema.ts';
import { parsePatchNoteMarkdown } from './patchNoteMarkdown.ts';

export interface PatchNotesInput {
  /** `patchnotes/<version>.md` contents by version */
  readonly notes: ReadonlyMap<string, string>;
  /** YYYY-MM-DD per release tag */
  readonly tagDates: ReadonlyMap<string, string>;
  /** Dates of the committed index: kept when the clone lacks the tag (shallow clones fetch only the newest) */
  readonly previousDates: ReadonlyMap<string, string>;
  /** Report files under public/patch-notes/, relative to it (`reports/3.3.04-item-changes.html`) */
  readonly reportFiles: readonly string[];
  /** Raw file URL base: `${base}${version}.md` */
  readonly sourceUrlBase: string;
}

/** The published file name of each report kind, without the extension. */
export const REPORT_FILE_STEMS: Readonly<Record<PatchNoteReportKind, string>> = {
  items: 'item-changes',
  check: 'patch-note-check',
};

/**
 * The report a generated file in owner-notes/ is, or null: `ESR-<version>-unique-runeword-changes.<ext>` (items) and
 * `esr-<version>-changelog-check.<ext>` (check), case-insensitive, html or pdf.
 */
export function ownerNoteReport(file: string): { version: string; kind: PatchNoteReportKind; ext: 'html' | 'pdf' } | null {
  const match = /^esr-(\d+(?:\.\d+)+)-(unique-runeword-changes|changelog-check)\.(html|pdf)$/i.exec(file);
  if (match === null) return null;
  return {
    version: match[1],
    kind: match[2].toLowerCase() === 'changelog-check' ? 'check' : 'items',
    ext: match[3].toLowerCase() === 'pdf' ? 'pdf' : 'html',
  };
}

/**
 * The path a report is published at, relative to public/patch-notes/. Flat (no version folders), so no public folder
 * shadows the /patch-notes/<version> routes.
 */
export function publishedReportPath(version: string, kind: PatchNoteReportKind, ext: 'html' | 'pdf'): string {
  return `reports/${version}-${REPORT_FILE_STEMS[kind]}.${ext}`;
}

/** The version of a published report path, or null for other files. */
export function publishedReportVersion(file: string): string | null {
  return /^reports\/(\d+(?:\.\d+)+)-/.exec(file)?.[1] ?? null;
}

/** The notes' own title line ("Eastern Sun Resurrected 3.2.04") repeats the page's release heading. */
function withoutTitle(blocks: PatchNoteBlock[]): PatchNoteBlock[] {
  const first = blocks.at(0);
  return first?.type === 'heading' && /^eastern sun resurrected\s+\d/i.test(first.text) ? blocks.slice(1) : blocks;
}

function reportsOf(version: string, files: ReadonlySet<string>): PatchNoteReport[] {
  return PATCH_NOTE_REPORT_KINDS.flatMap((kind) => {
    const html = publishedReportPath(version, kind, 'html');
    if (!files.has(html)) return [];
    const pdf = publishedReportPath(version, kind, 'pdf');
    return [{ kind, html, pdf: files.has(pdf) ? pdf : null }];
  });
}

export function buildPatchNotesIndex(input: PatchNotesInput): { index: PatchNotesIndex; warnings: string[] } {
  const files = new Set(input.reportFiles);
  const warnings: string[] = [];
  // A report without patch notes still gets a release, so it is never hidden
  const reportVersions = input.reportFiles.flatMap((file) => publishedReportVersion(file) ?? []);
  const versions = [...new Set([...input.notes.keys(), ...reportVersions])].sort((a, b) => compareVersions(b, a));

  const releases = versions.map((version) => {
    const text = input.notes.get(version);
    if (text === undefined) warnings.push(`${version}: reports but no patchnotes/${version}.md`);
    const reports = reportsOf(version, files);
    for (const file of input.reportFiles) {
      if (publishedReportVersion(file) === version && !reports.some((report) => report.html === file || report.pdf === file)) {
        warnings.push(`${file}: not listed (a PDF without its HTML, or an unknown file name)`);
      }
    }
    return {
      version,
      date: input.tagDates.get(version) ?? input.previousDates.get(version) ?? null,
      sourceUrl: `${input.sourceUrlBase}${version}.md`,
      blocks: text === undefined ? [] : withoutTitle(parsePatchNoteMarkdown(text)),
      reports,
    };
  });
  return { index: { schema: PATCH_NOTES_SCHEMA, releases }, warnings };
}

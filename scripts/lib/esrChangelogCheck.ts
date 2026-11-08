/**
 * The shareable "does the ESR patch note match the files?" report of an /esr-update: every patch-note line with what the
 * release diff shows for it, the changes no patch note mentions, and where the official pages lag. Deciding a verdict
 * takes reading the diff, so a person or agent fills a JSON file (`--init` writes the skeleton); this module validates it
 * (every patch-note line must have a verdict) and renders the page the PDF is printed from.
 */
import type { ReleaseDiff } from './releaseDiff.ts';

export const NOTE_STATUSES = ['confirmed', 'partial', 'differs', 'not-found', 'not-checkable'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

const STATUS_LABELS: Readonly<Record<NoteStatus, string>> = {
  confirmed: 'Confirmed',
  partial: 'Partly',
  differs: 'Differs',
  'not-found': 'Not found',
  'not-checkable': 'Not checkable',
};

const STATUS_MEANINGS: Readonly<Record<NoteStatus, string>> = {
  confirmed: 'the files show this change',
  partial: 'the files show a change, but not all of what the note says',
  differs: 'the files show something else',
  'not-found': 'the files that should carry it did not change',
  'not-checkable': 'lives in plugin binaries or the game client, or the note cannot be read',
};

export interface NoteCheck {
  section: string;
  note: string;
  status: NoteStatus | 'pending';
  evidence: string;
}

export interface UnlistedChange {
  what: string;
  evidence: string;
  playerVisible: boolean;
}

export interface DocsLag {
  page: string;
  detail: string;
}

export interface ChangelogCheck {
  from: string;
  to: string;
  intro: string;
  notes: NoteCheck[];
  unlisted: UnlistedChange[];
  docsLag: DocsLag[];
  notChecked: string[];
}

function cleanNoteText(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\\(.)/g, '$1').replace(/\s+/g, ' ').trim();
}

/** The lines of a patch note, one per change, under their `**Section**` headings; group lines ("* **Alchemist**") label their children */
export function patchNoteLines(text: string): { section: string; note: string }[] {
  const lines: { section: string; note: string }[] = [];
  let section = '';
  let group = '';
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') continue;
    const heading = /^\*\*(.+)\*\*$/.exec(line);
    if (heading !== null) {
      section = cleanNoteText(heading[1]);
      group = '';
      continue;
    }
    const bullet = /^(\s*)\*\s+(.*)$/.exec(line);
    const body = bullet?.[2] ?? line;
    const nested = (bullet?.[1] ?? '').length > 0;
    if (bullet !== null && /^\*\*[^*]+\*\*$/.test(body.trim())) {
      group = cleanNoteText(body);
      continue;
    }
    if (!nested) group = '';
    const note = cleanNoteText(body);
    lines.push({ section, note: nested && group !== '' ? `${group}: ${note}` : note });
  }
  return lines;
}

function revisionName(info: ReleaseDiff['from']): string {
  return info.describe ?? info.rev;
}

/** The file to fill in: one `pending` entry per patch-note line of the release */
export function changelogSkeleton(diff: ReleaseDiff): ChangelogCheck {
  return {
    from: revisionName(diff.from),
    to: revisionName(diff.to),
    intro: '',
    notes: diff.patchNotes.flatMap((file) =>
      patchNoteLines(file.text ?? '').map(({ section, note }): NoteCheck => ({ section, note, status: 'pending', evidence: '' }))
    ),
    unlisted: [],
    docsLag: [],
    notChecked: [],
  };
}

/** What is wrong with a filled-in file; empty when it can be rendered. Every line of the release's patch notes must be covered. */
export function changelogCheckErrors(check: ChangelogCheck, diff: ReleaseDiff): string[] {
  const errors: string[] = [];
  const covered = new Set(check.notes.map((entry) => cleanNoteText(entry.note)));
  for (const file of diff.patchNotes)
    for (const { note } of patchNoteLines(file.text ?? ''))
      if (!covered.has(cleanNoteText(note))) errors.push(`no verdict for the patch-note line "${note}"`);
  for (const entry of check.notes) {
    if (!(NOTE_STATUSES as readonly string[]).includes(entry.status)) errors.push(`"${entry.note}": status is ${entry.status}`);
    if (entry.evidence.trim() === '') errors.push(`"${entry.note}": no evidence`);
  }
  for (const entry of check.unlisted) if (entry.evidence.trim() === '') errors.push(`"${entry.what}": no evidence`);
  if (check.intro.trim() === '') errors.push('intro is empty');
  return errors;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fileName(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function statusPill(status: NoteCheck['status']): string {
  const label = status === 'pending' ? 'Pending' : STATUS_LABELS[status];
  return `<span class="pill ${status}">${label}</span>`;
}

function renderNotes(notes: readonly NoteCheck[]): string {
  const sections = [...new Set(notes.map((entry) => entry.section))];
  return sections
    .map((section) => {
      const rows = notes
        .filter((entry) => entry.section === section)
        .map(
          (entry) =>
            `<tr><td class="status">${statusPill(entry.status)}</td><td>${escapeHtml(entry.note)}</td><td>${escapeHtml(entry.evidence)}</td></tr>`
        )
        .join('');
      return `<h3>${escapeHtml(section)}</h3><table><thead><tr><th class="status">Verdict</th><th>Patch note says</th><th>Files show</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
}

function renderFilesAppendix(diff: ReleaseDiff): string {
  const tables = diff.tables
    .map(
      (table) =>
        `<tr><td>${escapeHtml(fileName(table.path))}</td><td class="num">${String(table.rowsBefore)} → ${String(table.rowsAfter)}</td><td class="num">+${String(table.added)}</td><td class="num">−${String(table.removed)}</td><td class="num">~${String(table.changed)}</td></tr>`
    )
    .join('');
  const strings = diff.strings.flatMap((file) =>
    file.enUSChanges.map(
      (change) => `<li><code>${escapeHtml(change.key)}</code>: ${escapeHtml(change.before)} → ${escapeHtml(change.after)}</li>`
    )
  );
  const isWikiPage = (path: string) => path.includes('/esr-wiki-overlay/');
  const launcher = diff.launcher.filter((file) => !isWikiPage(file.path));
  const wikiPages = diff.launcher.filter((file) => isWikiPage(file.path) && !file.path.endsWith('.meta')).length;
  const launcherItems = launcher.map(
    (file) =>
      `<li><code>${escapeHtml(file.path)}</code> (${file.status === 'A' ? 'new' : file.status === 'D' ? 'removed' : 'changed'})</li>`
  );
  return `<h2>Files changed</h2>
<table><thead><tr><th>Game table</th><th class="num">Rows</th><th class="num">Added</th><th class="num">Removed</th><th class="num">Changed</th></tr></thead><tbody>${tables}</tbody></table>
${strings.length > 0 ? `<h3>Changed strings (English)</h3><ul>${strings.join('')}</ul>` : ''}
<h3>Launcher</h3><ul>${launcherItems.join('')}<li>${String(wikiPages)} in-game wiki pages changed (<code>d2rloader/plugins/esr-wiki-overlay</code>)</li></ul>`;
}

/** The complete page, styled for printing */
export function renderChangelogCheck(check: ChangelogCheck, diff: ReleaseDiff): string {
  const counts = NOTE_STATUSES.map((status) => ({ status, count: check.notes.filter((entry) => entry.status === status).length })).filter(
    ({ count }) => count > 0
  );
  const summary = counts
    .map(({ status, count }) => `<li>${statusPill(status)} <b>${String(count)}</b> ${STATUS_MEANINGS[status]}</li>`)
    .join('');
  const unlisted = check.unlisted
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.what)}</td><td>${escapeHtml(entry.evidence)}</td><td class="status">${entry.playerVisible ? 'Yes' : 'No'}</td></tr>`
    )
    .join('');
  const docsLag = check.docsLag.map((entry) => `<li><code>${escapeHtml(entry.page)}</code>: ${escapeHtml(entry.detail)}</li>`).join('');
  const notChecked = check.notChecked.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');
  const title = `ESR ${check.from} → ${check.to}: patch notes vs game files`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font: 10pt/1.4 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1c1c1e; background: #fff; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 2pt; }
  h2 { font-size: 12.5pt; margin: 16pt 0 5pt; border-bottom: 1px solid #c8c8cc; padding-bottom: 2pt; }
  h3 { font-size: 10.5pt; margin: 10pt 0 4pt; }
  .meta { color: #636366; font-size: 9pt; margin-bottom: 8pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
  th { text-align: left; color: #636366; font-weight: 600; border-bottom: 1px solid #c8c8cc; padding: 3pt 5pt; }
  td { vertical-align: top; border-bottom: 1px solid #e5e5ea; padding: 3pt 5pt; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  .status { width: 72pt; white-space: nowrap; }
  .num { width: 58pt; }
  .num { text-align: right; white-space: nowrap; }
  code { font: 8.5pt ui-monospace, Menlo, Consolas, monospace; word-break: break-all; }
  ul { margin: 3pt 0; padding-left: 13pt; }
  ul.summary { list-style: none; padding: 0; }
  ul.summary li { margin: 2pt 0; }
  .pill { display: inline-block; min-width: 50pt; text-align: center; border-radius: 3pt; padding: 0 4pt; font-size: 8pt; font-weight: 600; }
  .confirmed { background: #d9f2df; color: #14532d; }
  .partial { background: #fdeccb; color: #7a4a00; }
  .differs { background: #fbd9d7; color: #7f1d1d; }
  .not-found { background: #fbd9d7; color: #7f1d1d; }
  .not-checkable { background: #e5e5ea; color: #3a3a3c; }
  .pending { background: #e5e5ea; color: #3a3a3c; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Compares ${escapeHtml(diff.from.commit.slice(0, 8))} (${escapeHtml(diff.from.date ?? 'date unknown')}) with ${escapeHtml(diff.to.commit.slice(0, 8))} (${escapeHtml(diff.to.date ?? 'date unknown')}) of the ESR repository</div>
<p>${escapeHtml(check.intro)}</p>
<ul class="summary">${summary}</ul>
<h2>Patch notes, line by line</h2>
${renderNotes(check.notes)}
${
  unlisted === ''
    ? ''
    : `<h2>Changed in the files, not in the patch notes</h2><table><thead><tr><th>Change</th><th>Evidence</th><th class="status">Player-visible</th></tr></thead><tbody>${unlisted}</tbody></table>`
}
${docsLag === '' ? '' : `<h2>Official pages behind the files</h2><ul>${docsLag}</ul>`}
${renderFilesAppendix(diff)}
${notChecked === '' ? '' : `<h2>Not checked</h2><ul>${notChecked}</ul>`}
</body>
</html>
`;
}

import type { PatchNoteRelease, PatchNoteReport, PatchNoteReportKind } from '../engine/schema';

/** The page's views: the official notes, then our reports. */
export type PatchNotesView = 'notes' | PatchNoteReportKind;

export const PATCH_NOTES_PATH = '/patch-notes';

export const VIEW_LABELS: Readonly<Record<PatchNotesView, string>> = {
  notes: 'Patch notes',
  items: 'Item changes',
  check: 'Patch-note check',
};

/** One line under the tabs: what the open view is. */
export const VIEW_DESCRIPTIONS: Readonly<Record<PatchNotesView, string>> = {
  notes: "The mod author's patch notes, as published in the ESR repository.",
  items: 'Every unique and runeword that changed in this release, old and new values side by side, read from the game files.',
  check:
    'Each patch-note line checked against the game files, plus the changes the notes do not mention. Nothing in it was tested in game.',
};

export function releasePath(version: string, view: PatchNotesView = 'notes'): string {
  return view === 'notes' ? `${PATCH_NOTES_PATH}/${version}` : `${PATCH_NOTES_PATH}/${version}?view=${view}`;
}

/** The views a release has: always its notes, then each report it has. */
export function releaseViews(release: PatchNoteRelease): PatchNotesView[] {
  return ['notes', ...release.reports.map((report) => report.kind)];
}

/** The requested view when the release has it, else the notes. */
export function resolveView(release: PatchNoteRelease, requested: string | null): PatchNotesView {
  return releaseViews(release).find((view) => view === requested) ?? 'notes';
}

export function reportOf(release: PatchNoteRelease, view: PatchNotesView): PatchNoteReport | null {
  return view === 'notes' ? null : (release.reports.find((report) => report.kind === view) ?? null);
}

export interface ReleaseGroup {
  /** "3.3" for 3.3, 3.3.02 … */
  readonly line: string;
  readonly releases: readonly PatchNoteRelease[];
}

/** Releases grouped by their first two version parts, keeping the index order (newest first). */
export function groupReleases(releases: readonly PatchNoteRelease[]): ReleaseGroup[] {
  const groups: { line: string; releases: PatchNoteRelease[] }[] = [];
  for (const release of releases) {
    const line = release.version.split('.').slice(0, 2).join('.');
    const last = groups.at(-1);
    if (last?.line === line) last.releases.push(release);
    else groups.push({ line, releases: [release] });
  }
  return groups;
}

/** "2026-11-11" → "11 Nov 2026"; null stays null. */
export function formatReleaseDate(date: string | null): string | null {
  if (date === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) return date;
  const monthIndex = Number(match[2]) - 1;
  const month =
    monthIndex < 0 ? undefined : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].at(monthIndex);
  return month === undefined ? date : `${String(Number(match[3]))} ${month} ${match[1]}`;
}

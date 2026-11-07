/**
 * Changed ESR files the app follows outside the tables: official docs pages and D2RLoader configs that hand-written app
 * data or prose depends on (scripts/lib/esrReferences.ts), plus every one the guide notes or the modifier texts under
 * content/ cite by file name. Pure: the CLI passes the changed paths and the content files.
 */
import { citedName, esrReferenceFor } from '../esrReferences.ts';
import { docKind } from '../releaseDiff.ts';
import { capLines, finding, info, ok, type Check } from './report.ts';

/** Citing files named per line before "+N more" */
const CITED_LIMIT = 5;

/**
 * Whether a citation makes the change worth a re-read: not for the docs pages generated from the tables (runewords.htm …),
 * which change every release and which the guide only links to.
 */
const citationMatters = (path: string) => !(path.startsWith('docs/') && docKind(path) === 'generated');

/** A changed path is a candidate when it is a docs page at the docs/ root, a D2RLoader config or patch, or listed. */
export function isReferenceCandidate(path: string): boolean {
  return /^docs\/[^/]+\.html?$/i.test(path) || /^d2rloader\/(config|patches)\/[^/]+$/.test(path) || esrReferenceFor(path) !== undefined;
}

/** For each path, the content files (by repo path) whose text names its file name. */
export function citationsIn(paths: readonly string[], files: readonly { path: string; text: string }[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const path of paths) {
    const name = citedName(path);
    const citing = files.filter((file) => file.text.includes(name)).map((file) => file.path);
    if (citing.length > 0) result.set(path, citing);
  }
  return result;
}

export function referencesCheck(changed: readonly string[], citations: ReadonlyMap<string, readonly string[]>): Check {
  const id = 'refs.followed';
  const title = 'Changed ESR files the app follows';
  const lines: string[] = [];
  let stale = 0;
  for (const path of [...new Set(changed)].sort()) {
    const reference = esrReferenceFor(path);
    const cited = citations.get(path) ?? [];
    if (reference === undefined && cited.length === 0) continue;
    if (reference?.kind === 'hand-kept' || (cited.length > 0 && citationMatters(path))) stale++;
    const more = cited.length > CITED_LIMIT ? ` +${String(cited.length - CITED_LIMIT)} more` : '';
    const parts = [
      ...(reference === undefined ? [] : [`[${reference.kind}] ${reference.follows}`]),
      ...(cited.length === 0 ? [] : [`cited by ${cited.slice(0, CITED_LIMIT).join(', ')}${more}`]),
    ];
    lines.push(`${path}: ${parts.join('; ')}`);
  }
  if (stale > 0) {
    return finding(
      id,
      title,
      `${String(stale)} changed ESR files have hand-written app data or notes that follow them (${String(lines.length)} listed)`,
      'no bundle diff shows a stale hand-written copy (map boss page figures, mastery rules, cube section notes, orb spots, modifier prose, guide notes): re-read the file diff and update or confirm each',
      capLines(lines)
    );
  }
  if (lines.length > 0)
    return info(
      id,
      title,
      `${String(lines.length)} changed files are read by a generator, a test or the app at runtime, or linked from the guide; their bundle diffs and tests show the effect.`,
      lines
    );
  return ok(id, title, 'No docs page or D2RLoader config the app follows changed.');
}

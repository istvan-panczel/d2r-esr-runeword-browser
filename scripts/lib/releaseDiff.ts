/**
 * Pure parsing, diffing and formatting helpers for scripts/esr-release-diff.ts (what changed in the ESR repository
 * between two revisions). The CLI does the git calls; everything here works on strings.
 */
import { ESR_EXCEL_DIR, ESR_STRINGS_DIR, TABLES as GENERATOR_TABLES } from '../../src/features/game-data/build/esrSources.ts';
import { STAT_TABLES } from '../../src/features/game-data/build/stats/statRenderer.ts';
import { GUIDE_TABLES } from '../../src/features/guide/build/esrGuideSources.ts';
import { stripHtmlTags } from '../../src/lib/html.ts';
import { formatLauncherVersions, type LauncherVersions } from './launcherInfo.ts';

/** How many keys/strings the text output lists per file before "… and N more". */
export const LIST_LIMIT = 20;
/** Launcher text files up to this many lines get a unified diff in the output. */
export const LAUNCHER_DIFF_MAX_LINES = 200;

/** Hand-written pages of the official site (the rest of docs/*.htm is generated from the tables). */
const HAND_WRITTEN_DOCS = [
  'cube recipes',
  'endgame_maps',
  'corruptions',
  'anointments',
  'vessel_of_souls',
  'kill_ledger',
  'weapon_mastery',
  'ascendancies',
  'skill_information',
  'maps',
  'index',
  'installation_guide',
];

export interface RevisionInfo {
  /** What the user asked for (or the default's source) */
  rev: string;
  commit: string;
  /** `git describe --tags`, null when no tag is reachable */
  describe: string | null;
  /** Commit date (YYYY-MM-DD) */
  date: string | null;
}

export interface FileChange {
  /** A, M, D, T (… from `git diff --name-status --no-renames`) */
  status: string;
  path: string;
  /** Line counts from --numstat; null for binary files */
  added: number | null;
  removed: number | null;
}

export type SectionName = 'patchNotes' | 'changelog' | 'tables' | 'tablesBase' | 'strings' | 'docs' | 'launcher' | 'lootFilters' | 'other';

/** Tables the app's generators read (game data, guide, stat renderer): changes there reach the bundles. */
export const APP_TABLES: ReadonlySet<string> = new Set<string>([...GENERATOR_TABLES, ...GUIDE_TABLES, ...STAT_TABLES]);

/** `…/excel/skills.txt` → whether a generator reads it */
export function isAppTable(path: string): boolean {
  return APP_TABLES.has((path.split('/').pop() ?? path).replace(/\.txt$/i, ''));
}

export function classifyPath(path: string): SectionName {
  if (path.startsWith('patchnotes/')) return 'patchNotes';
  if (path === 'docs/changelogs.html') return 'changelog';
  if (path.startsWith(`${ESR_EXCEL_DIR}/base/`)) return 'tablesBase';
  if (path.startsWith(`${ESR_EXCEL_DIR}/`) && path.endsWith('.txt')) return 'tables';
  if (path.startsWith(`${ESR_STRINGS_DIR}/`) && path.endsWith('.json')) return 'strings';
  if (path.startsWith('docs/')) return 'docs';
  if (path.startsWith('d2rloader/')) return 'launcher';
  if (path.startsWith('LootFilters/')) return 'lootFilters';
  return 'other';
}

/** Merges `git diff --name-status --no-renames` and `git diff --numstat --no-renames` output. */
export function parseChanges(nameStatus: string, numstat: string): FileChange[] {
  const counts = new Map<string, { added: number | null; removed: number | null }>();
  for (const line of numstat.split('\n')) {
    const match = /^(-|\d+)\t(-|\d+)\t(.+)$/.exec(line);
    if (!match) continue;
    const [, added, removed, path] = match;
    counts.set(path, { added: added === '-' ? null : Number(added), removed: removed === '-' ? null : Number(removed) });
  }
  const changes: FileChange[] = [];
  for (const line of nameStatus.split('\n')) {
    const match = /^([A-Z])\d*\t(.+)$/.exec(line);
    if (!match) continue;
    const [, status, path] = match;
    changes.push({ status, path, ...(counts.get(path) ?? { added: null, removed: null }) });
  }
  return changes;
}

/** "3.2.12" from "patchnotes/3.2.12.md" */
export function patchNoteVersion(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/i, '');
}

// ---------------------------------------------------------------------------------------------------------------------
// Changelog page

export interface ChangelogEntry {
  version: string;
  date: string;
  label: string;
  href: string;
}

const collapse = (text: string) => stripHtmlTags(text, ' ').replace(/\s+/g, ' ').trim();

/**
 * Entries of docs/changelogs.html: a "Eastern Sun Resurrected <version> - <date>" heading followed by a link (usually a
 * Google Doc) whose text is a short label. Tolerant regex; unknown markup in between is skipped.
 */
export function parseChangelogEntries(html: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const pattern = /Eastern\s+Sun\s+Resurrected\s+([\w.-]+)\s*-\s*([^<]*?)\s*<[\s\S]*?<a\s[^>]*?href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    entries.push({ version: match[1], date: collapse(match[2]), href: match[3].trim(), label: collapse(match[4]) });
  }
  return entries;
}

/** Entries of `after` that are not in `before` (compared by href, then version + label for link-less duplicates). */
export function newChangelogEntries(before: string, after: string): ChangelogEntry[] {
  const known = new Set(parseChangelogEntries(before).map((entry) => `${entry.href}|${entry.version}|${entry.label}`));
  return parseChangelogEntries(after).filter((entry) => !known.has(`${entry.href}|${entry.version}|${entry.label}`));
}

// ---------------------------------------------------------------------------------------------------------------------
// Game tables (TSV)

export interface TableDiff {
  path: string;
  status: string;
  rowsBefore: number;
  rowsAfter: number;
  added: number;
  removed: number;
  changed: number;
  /** First-column keys (blank keys show as "(blank)") */
  addedKeys: string[];
  removedKeys: string[];
  addedColumns: string[];
  removedColumns: string[];
  /** Same column names, different order */
  columnsReordered: boolean;
  /** A generator of the app reads this table (APP_TABLES) */
  readByApp: boolean;
}

function splitLines(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Data rows keyed by first column + occurrence index ("key", "key#2", …) so duplicates pair up by position. */
function keyedRows(lines: string[]): Map<string, string> {
  const rows = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const line of lines) {
    const key = line.split('\t', 1)[0] || '(blank)';
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    rows.set(n === 1 ? key : `${key}#${String(n)}`, line);
  }
  return rows;
}

const displayKey = (key: string) => key.replace(/#\d+$/, '');

/** Row-level diff of two TSV texts (empty string for a missing side). */
export function diffTsv(path: string, status: string, before: string, after: string): TableDiff {
  const [headerBefore = '', ...rowsBefore] = splitLines(before);
  const [headerAfter = '', ...rowsAfter] = splitLines(after);
  const columnsBefore = headerBefore === '' ? [] : headerBefore.split('\t');
  const columnsAfter = headerAfter === '' ? [] : headerAfter.split('\t');
  const a = keyedRows(rowsBefore);
  const b = keyedRows(rowsAfter);
  const addedKeys = [...b.keys()].filter((key) => !a.has(key));
  const removedKeys = [...a.keys()].filter((key) => !b.has(key));
  const changed = [...b].filter(([key, line]) => a.has(key) && a.get(key) !== line).length;
  const addedColumns = before === '' ? [] : columnsAfter.filter((c) => !columnsBefore.includes(c));
  const removedColumns = after === '' ? [] : columnsBefore.filter((c) => !columnsAfter.includes(c));
  const sameSet = addedColumns.length === 0 && removedColumns.length === 0;
  return {
    path,
    status,
    rowsBefore: rowsBefore.length,
    rowsAfter: rowsAfter.length,
    added: addedKeys.length,
    removed: removedKeys.length,
    changed,
    addedKeys: addedKeys.map(displayKey),
    removedKeys: removedKeys.map(displayKey),
    addedColumns,
    removedColumns,
    columnsReordered: before !== '' && after !== '' && sameSet && columnsBefore.join('\t') !== columnsAfter.join('\t'),
    readByApp: isAppTable(path),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Strings (JSON arrays of { Key, enUS, … })

export interface StringChange {
  key: string;
  before: string;
  after: string;
}

export interface StringsDiff {
  path: string;
  status: string;
  added: number;
  removed: number;
  /** Entries whose fields differ (any language) */
  changed: number;
  addedKeys: string[];
  removedKeys: string[];
  /** Changed entries whose enUS text differs */
  enUSChanges: StringChange[];
}

function parseStrings(text: string): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (text.trim() === '') return map;
  const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!Array.isArray(parsed)) return map;
  const seen = new Map<string, number>();
  for (const item of parsed as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const key = typeof record.Key === 'string' ? record.Key : '(no key)';
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    map.set(n === 1 ? key : `${key}#${String(n)}`, record);
  }
  return map;
}

const enUS = (record: Record<string, unknown> | undefined) => (typeof record?.enUS === 'string' ? record.enUS : '');

/** Key-level diff of two strings files (empty string for a missing side). */
export function diffStrings(path: string, status: string, before: string, after: string): StringsDiff {
  const a = parseStrings(before);
  const b = parseStrings(after);
  const addedKeys = [...b.keys()].filter((key) => !a.has(key)).map(displayKey);
  const removedKeys = [...a.keys()].filter((key) => !b.has(key)).map(displayKey);
  let changed = 0;
  const enUSChanges: StringChange[] = [];
  for (const [key, record] of b) {
    const old = a.get(key);
    if (old === undefined || JSON.stringify(old) === JSON.stringify(record)) continue;
    changed++;
    if (enUS(old) !== enUS(record)) enUSChanges.push({ key: displayKey(key), before: enUS(old), after: enUS(record) });
  }
  return { path, status, added: addedKeys.length, removed: removedKeys.length, changed, addedKeys, removedKeys, enUSChanges };
}

// ---------------------------------------------------------------------------------------------------------------------
// Docs, launcher, other

export type DocKind = 'hand-written' | 'generated' | 'asset';

export function docKind(path: string): DocKind {
  const name = (path.split('/').pop() ?? path).toLowerCase();
  if (!/\.html?$/.test(name)) return 'asset';
  const stem = name.replace(/\.html?$/, '');
  return HAND_WRITTEN_DOCS.some((page) => stem === page || stem.endsWith(` ${page}`)) ? 'hand-written' : 'generated';
}

export interface DocChange {
  path: string;
  status: string;
  kind: DocKind;
  bytesBefore: number | null;
  bytesAfter: number | null;
}

export interface PatchNote {
  path: string;
  status: string;
  version: string;
  /** Full text of an added file */
  text: string | null;
  /** Unified diff of a modified file */
  diff: string | null;
}

export interface LauncherChange extends FileChange {
  /** Unified diff for small text files, else null */
  diff: string | null;
}

export interface ReleaseDiff {
  from: RevisionInfo;
  to: RevisionInfo;
  patchNotes: PatchNote[];
  /** New entries of docs/changelogs.html; null when the page did not change */
  changelog: ChangelogEntry[] | null;
  tables: TableDiff[];
  /** Number of changed files under excel/base/ (a duplicate of excel/, not diffed) */
  tablesBaseIgnored: number;
  strings: StringsDiff[];
  docs: DocChange[];
  launcher: LauncherChange[];
  /** LootFilters/: the live filter repositories (sources.json) and any filter files the mod ships */
  lootFilters: LauncherChange[];
  /** Launcher versions at both revisions (metadata.json, d2rloader.toml, the loot filter DLL); null when not read */
  launcherVersions: { before: LauncherVersions; after: LauncherVersions } | null;
  other: FileChange[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Formatting

export function describeRevision(revision: RevisionInfo): string {
  return `${revision.commit.slice(0, 8)} (${revision.describe ?? 'no tag'}, ${revision.date ?? 'unknown date'})`;
}

/** Up to `limit` items joined by ", ", plus "… and N more". */
export function listWithMore(items: string[], limit = LIST_LIMIT): string {
  const shown = items.slice(0, limit).join(', ');
  return items.length > limit ? `${shown}, … and ${String(items.length - limit)} more` : shown;
}

/** Repeated keys collapsed in first-seen order: ["a", "b", "a"] → ["a ×2", "b"]. */
export function compactKeys(keys: string[]): string[] {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].map(([key, n]) => (n > 1 ? `${key} ×${String(n)}` : key));
}

function signed(n: number): string {
  return n > 0 ? `+${String(n)}` : String(n);
}

function heading(out: string[], title: string): void {
  out.push('', `=== ${title} ===`, '');
}

const indent = (text: string, prefix = '    ') =>
  text
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => `${prefix}${line}`);

export function isEmptyDiff(diff: ReleaseDiff): boolean {
  return (
    diff.patchNotes.length === 0 &&
    diff.changelog === null &&
    diff.tables.length === 0 &&
    diff.tablesBaseIgnored === 0 &&
    diff.strings.length === 0 &&
    diff.docs.length === 0 &&
    diff.launcher.length === 0 &&
    diff.lootFilters.length === 0 &&
    diff.other.length === 0
  );
}

function formatTable(table: TableDiff): string[] {
  const name = table.path.split('/').pop() ?? table.path;
  const out = [
    `${name} [${table.status}]${table.readByApp ? ' (read by the app)' : ''}: rows ${String(table.rowsBefore)} → ${String(table.rowsAfter)}` +
      ` (+${String(table.added)} added, -${String(table.removed)} removed, ~${String(table.changed)} changed)`,
  ];
  if (table.addedColumns.length > 0) out.push(`    columns added: ${table.addedColumns.join(', ')}`);
  if (table.removedColumns.length > 0) out.push(`    columns removed: ${table.removedColumns.join(', ')}`);
  if (table.columnsReordered) out.push('    columns reordered');
  if (table.addedKeys.length > 0) out.push(`    added rows: ${listWithMore(compactKeys(table.addedKeys))}`);
  if (table.removedKeys.length > 0) out.push(`    removed rows: ${listWithMore(compactKeys(table.removedKeys))}`);
  return out;
}

function formatStrings(file: StringsDiff): string[] {
  const name = file.path.split('/').pop() ?? file.path;
  const out = [
    `${name} [${file.status}]: +${String(file.added)} added, -${String(file.removed)} removed, ~${String(file.changed)} changed`,
  ];
  if (file.addedKeys.length > 0) out.push(`    added keys: ${listWithMore(compactKeys(file.addedKeys))}`);
  if (file.removedKeys.length > 0) out.push(`    removed keys: ${listWithMore(compactKeys(file.removedKeys))}`);
  for (const change of file.enUSChanges.slice(0, LIST_LIMIT)) {
    out.push(`    ${change.key}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)} (enUS)`);
  }
  if (file.enUSChanges.length > LIST_LIMIT) out.push(`    … and ${String(file.enUSChanges.length - LIST_LIMIT)} more enUS changes`);
  return out;
}

function formatLines(change: FileChange): string {
  return change.added === null || change.removed === null ? 'binary' : `+${String(change.added)} -${String(change.removed)} lines`;
}

/** `docs/deDE/runewords.htm` → `deDE`; the pages at the docs/ root are the English ones (`enUS`). */
const LOCALE_DIR = /^docs\/([a-z]{2}[A-Z]{2})\/(.+)$/;

export interface DocPageGroup {
  /** The English path (`docs/<page>`) the locale copies mirror */
  path: string;
  status: string;
  kind: DocKind;
  /** enUS first, then the locale folders in path order */
  locales: string[];
  /** Byte change of the enUS copy, else of the first locale */
  bytesBefore: number | null;
  bytesAfter: number | null;
}

/** Each docs page once with the locales it changed in (same status), in first-seen order. */
export function groupDocsByLocale(docs: readonly DocChange[]): DocPageGroup[] {
  const groups = new Map<string, DocPageGroup>();
  for (const doc of docs) {
    const match = LOCALE_DIR.exec(doc.path);
    const locale = match ? match[1] : 'enUS';
    const path = match ? `docs/${match[2]}` : doc.path;
    const key = `${doc.status}|${path}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        path,
        status: doc.status,
        kind: doc.kind,
        locales: [locale],
        bytesBefore: doc.bytesBefore,
        bytesAfter: doc.bytesAfter,
      });
      continue;
    }
    if (locale === 'enUS') {
      group.locales.unshift(locale);
      group.bytesBefore = doc.bytesBefore;
      group.bytesAfter = doc.bytesAfter;
    } else group.locales.push(locale);
  }
  return [...groups.values()];
}

/** Filter files (`*.json` other than sources.json) added and removed under LootFilters/. */
export function lootFilterFiles(changes: readonly FileChange[]): { added: string[]; removed: string[] } {
  const filters = changes.filter((change) => /\.json$/i.test(change.path) && !/\/sources\.json$/i.test(change.path));
  const name = (change: FileChange) => change.path.replace(/^LootFilters\//, '');
  return {
    added: filters.filter((change) => change.status === 'A').map(name),
    removed: filters.filter((change) => change.status === 'D').map(name),
  };
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? '' : 's'}`;
}

/** One line counting each section, e.g. "4 patch notes, 23 tables (12 read by the app), …". */
export function summaryLine(diff: ReleaseDiff): string {
  const appTables = diff.tables.filter((table) => table.readByApp).length;
  return [
    plural(diff.patchNotes.length, 'patch note'),
    `${plural(diff.tables.length, 'table')} (${String(appTables)} read by the app)`,
    plural(diff.strings.length, 'strings file'),
    plural(groupDocsByLocale(diff.docs).length, 'docs page'),
    plural(diff.launcher.length, 'launcher file'),
    plural(diff.lootFilters.length, 'LootFilters file'),
    plural(diff.other.length, 'other file'),
  ].join(', ');
}

/** The human-readable report, one string per line. */
export function formatReleaseDiff(diff: ReleaseDiff): string[] {
  const out = [`From: ${describeRevision(diff.from)}`, `To:   ${describeRevision(diff.to)}`];
  if (diff.launcherVersions !== null)
    out.push(`Launcher versions: ${formatLauncherVersions(diff.launcherVersions.before, diff.launcherVersions.after)}`);
  if (isEmptyDiff(diff)) {
    out.push('', `No changes between ${diff.from.commit.slice(0, 8)} and ${diff.to.commit.slice(0, 8)}.`);
    return out;
  }
  out.push(`Summary: ${summaryLine(diff)}`);

  heading(out, '1. Patch notes (patchnotes/)');
  if (diff.patchNotes.length === 0) out.push('(no changes)');
  for (const note of diff.patchNotes) {
    out.push(`--- ${note.path} [${note.status}] version ${note.version}`);
    if (note.text !== null) out.push(...indent(note.text));
    else if (note.diff !== null) out.push(...indent(note.diff));
    out.push('');
  }

  heading(out, '2. Changelog page (docs/changelogs.html)');
  if (diff.changelog === null) out.push('(unchanged; the page has no new headings since 3.2.02, see the patch notes)');
  else if (diff.changelog.length === 0) out.push('Changed, but no new entries were recognised.');
  for (const entry of diff.changelog ?? []) out.push(`${entry.version} (${entry.date}): ${entry.label} → ${entry.href}`);

  heading(out, '3. Game tables (excel/*.txt)');
  if (diff.tables.length === 0) out.push('(no changes)');
  for (const table of diff.tables) out.push(...formatTable(table));
  if (diff.tablesBaseIgnored > 0)
    out.push(`(${String(diff.tablesBaseIgnored)} changed files under excel/base/ ignored: duplicate of excel/)`);

  heading(out, '4. Strings');
  if (diff.strings.length === 0) out.push('(no changes)');
  for (const file of diff.strings) out.push(...formatStrings(file));

  heading(out, '5. Official docs pages (docs/)');
  if (diff.docs.length === 0) out.push('(no changes)');
  for (const page of groupDocsByLocale(diff.docs)) {
    const delta = page.bytesBefore !== null && page.bytesAfter !== null ? `${signed(page.bytesAfter - page.bytesBefore)} bytes` : '';
    const size = page.status === 'A' ? `${String(page.bytesAfter ?? 0)} bytes` : page.status === 'D' ? 'deleted' : delta;
    const shown = page.locales.length > 4 ? [...page.locales.slice(0, 3), '…'] : page.locales;
    const locales =
      page.locales.length === 1 && page.locales[0] === 'enUS' ? '' : ` (${shown.join(', ')} ${plural(page.locales.length, 'locale')})`;
    out.push(`[${page.status}] ${page.path} (${size}) ${page.kind === 'hand-written' ? '[HAND-WRITTEN]' : `[${page.kind}]`}${locales}`);
  }

  heading(out, '6. Launcher configs (d2rloader/)');
  if (diff.launcher.length === 0) out.push('(no changes)');
  for (const change of diff.launcher) {
    out.push(`[${change.status}] ${change.path} (${formatLines(change)})`);
    if (change.diff !== null) out.push(...indent(change.diff), '');
  }

  heading(out, '7. Loot filters (LootFilters/)');
  if (diff.lootFilters.length === 0) out.push('(no changes)');
  const filters = lootFilterFiles(diff.lootFilters);
  if (filters.added.length > 0) out.push(`filters added: ${filters.added.join(', ')}`);
  if (filters.removed.length > 0) out.push(`filters removed: ${filters.removed.join(', ')}`);
  for (const change of diff.lootFilters) {
    out.push(`[${change.status}] ${change.path} (${formatLines(change)})`);
    if (change.diff !== null) out.push(...indent(change.diff), '');
  }

  heading(out, '8. Everything else');
  if (diff.other.length === 0) out.push('(no changes)');
  for (const change of diff.other) out.push(`[${change.status}] ${change.path} (${formatLines(change)})`);
  return out;
}

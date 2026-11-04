/**
 * Pure formatting helpers for scripts/update-game-data.ts.
 */

export interface ManifestSnapshot {
  esrVersion: string;
  esrTag: string | null;
  esrCommit: string;
  counts: Record<string, number>;
  warnings: string[];
}

/** "a → b", or just "a (unchanged)" when equal. */
export function formatChange(before: string, after: string): string {
  return before === after ? `${after} (unchanged)` : `${before} → ${after}`;
}

export function shortCommit(commit: string | null | undefined): string {
  return commit ? commit.slice(0, 7) : '(none)';
}

/** One line per count that changed (added, removed or different), e.g. "bases: 653 → 660 (+7)". */
export function diffCounts(before: Record<string, number>, after: Record<string, number>): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const lines: string[] = [];
  for (const key of keys) {
    const a: number | undefined = key in before ? before[key] : undefined;
    const b: number | undefined = key in after ? after[key] : undefined;
    if (a === b) continue;
    if (a === undefined) lines.push(`${key}: (new) ${String(b)}`);
    else if (b === undefined) lines.push(`${key}: ${String(a)} → (removed)`);
    else lines.push(`${key}: ${String(a)} → ${String(b)} (${b > a ? '+' : ''}${String(b - a)})`);
  }
  return lines;
}

/** Changed paths from `git status --porcelain` output. */
export function parsePorcelain(output: string): string[] {
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.slice(3));
}

export interface SummaryStep {
  name: string;
  ok: boolean;
  note?: string;
  /** Extra lines printed under the step, e.g. the failing test files. */
  details?: string[];
}

export interface SummaryInput {
  before: ManifestSnapshot | null;
  after: ManifestSnapshot | null;
  steps: SummaryStep[];
  changedFiles: string[];
  /** Follow-ups printed after the steps (what a failure means and what to do). */
  notes?: string[];
}

/** The subset of Vitest's JSON reporter output the update script reads. */
export interface VitestJsonReport {
  testResults?: { name: string; status: string }[];
}

/** Failing test files of a Vitest JSON report, relative to `root` and sorted. */
export function failedTestFiles(report: VitestJsonReport, root: string): string[] {
  const prefix = root.endsWith('/') ? root : `${root}/`;
  return (report.testResults ?? [])
    .filter((result) => result.status !== 'passed')
    .map((result) => (result.name.startsWith(prefix) ? result.name.slice(prefix.length) : result.name))
    .sort();
}

/**
 * The note for an update without the vanilla art folder: the item icons were not regenerated, so icons.json keeps the
 * old esrVersion/esrTag and game-data --check, icons:check and bundleIntegrity.test.ts fail. Null when icons.json
 * matches the manifest (nothing to do).
 */
export function staleIconsNote(
  icons: { esrVersion: string; esrTag: string | null } | null,
  manifest: ManifestSnapshot | null,
  vanillaDir: string
): string | null {
  if (icons === null || manifest === null) return null;
  if (icons.esrVersion === manifest.esrVersion && icons.esrTag === manifest.esrTag) return null;
  return (
    `Item icons are stale: the vanilla art folder (${vanillaDir}) is missing, so they were not regenerated and ` +
    `icons.json still says ESR ${icons.esrVersion} (tag ${String(icons.esrTag)}) while the manifest says ` +
    `${manifest.esrVersion} (tag ${String(manifest.esrTag)}). game-data --check, icons:check and bundleIntegrity.test.ts ` +
    'fail because of it. Run `npm run game-data:icons` on a machine with ../d2r-vanilla-art (or set D2R_VANILLA_ART_DIR, ' +
    'or pass --vanilla <dir> to this script) and re-run the update; do not edit icons.json by hand.'
  );
}

export function formatSummary({ before, after, steps, changedFiles, notes = [] }: SummaryInput): string[] {
  const out: string[] = [];
  const version = (m: ManifestSnapshot | null) => m?.esrVersion ?? '(none)';
  const tag = (m: ManifestSnapshot | null) => m?.esrTag ?? '(none)';
  out.push(`ESR version: ${formatChange(version(before), version(after))}`);
  out.push(`ESR tag:     ${formatChange(tag(before), tag(after))}`);
  out.push(`ESR commit:  ${formatChange(shortCommit(before?.esrCommit), shortCommit(after?.esrCommit))}`);

  const countLines = diffCounts(
    { ...before?.counts, warnings: before?.warnings.length ?? 0 },
    { ...after?.counts, warnings: after?.warnings.length ?? 0 }
  );
  out.push('', countLines.length > 0 ? 'Changed counts:' : 'Counts: unchanged');
  for (const line of countLines) out.push(`  ${line}`);

  const warnings = after?.warnings ?? [];
  out.push('', `Generator warnings (${String(warnings.length)}):`);
  for (const warning of warnings) out.push(`  - ${warning}`);

  out.push('', 'Steps:');
  for (const step of steps) {
    out.push(`  ${step.ok ? 'OK  ' : 'FAIL'} ${step.name}${step.note ? ` (${step.note})` : ''}`);
    for (const line of step.details ?? []) out.push(`         ${line}`);
  }

  if (notes.length > 0) {
    out.push('', 'Notes:');
    for (const note of notes) out.push(`  - ${note}`);
  }

  out.push('', changedFiles.length > 0 ? 'Changed files:' : 'Changed files: none (the generated files under public/ are up to date)');
  for (const file of changedFiles) out.push(`  ${file}`);
  return out;
}

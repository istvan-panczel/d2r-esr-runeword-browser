/**
 * The scan result of scripts/check-user-data.ts and its text rendering: counts per category and per kind, then the
 * affected public items as `type: name → what no longer resolves`. Labels carry public display names and build or
 * filter names only (never emails or user ids).
 */
import type { Problem, RowCheck } from './resolve.ts';

export type Category = 'favourite' | 'build' | 'loot filter';

export interface Affected {
  readonly category: Category;
  /** `runeword:Spirit:3 (12 favourites)`, `"Hammerdin" by Name#1234` */
  readonly label: string;
  readonly problems: readonly Problem[];
}

export interface CategoryCounts {
  /** Rows scanned (favourite ids, public builds, public filters) */
  rows: number;
  /** References checked, and those that could not be checked (no HTM data) */
  checked: number;
  unchecked: number;
  /** Rows with at least one problem, and the problems */
  affectedRows: number;
  problems: number;
}

export interface ScanReport {
  readonly generatedAt: string;
  readonly context: readonly string[];
  readonly counts: Readonly<Record<Category, CategoryCounts>>;
  /** `<category> <kind>` → problem count */
  readonly byKind: Readonly<Record<string, number>>;
  /** ESR version stamps (`esr_version_updated ?? esr_version`) of the public builds and filters */
  readonly versions: Readonly<Record<'build' | 'loot filter', Readonly<Record<string, number>>>>;
  readonly affected: readonly Affected[];
  /** Still-resolving references the review lists (see resolve.ts reviewMentions): label → review lines */
  readonly reviewMentions: readonly { readonly label: string; readonly lines: readonly string[] }[];
}

export class ScanCollector {
  readonly counts: Record<Category, CategoryCounts> = {
    favourite: { rows: 0, checked: 0, unchecked: 0, affectedRows: 0, problems: 0 },
    build: { rows: 0, checked: 0, unchecked: 0, affectedRows: 0, problems: 0 },
    'loot filter': { rows: 0, checked: 0, unchecked: 0, affectedRows: 0, problems: 0 },
  };
  readonly byKind: Record<string, number> = {};
  readonly versions: Record<'build' | 'loot filter', Record<string, number>> = { build: {}, 'loot filter': {} };
  readonly affected: Affected[] = [];
  readonly reviewMentions: { label: string; lines: string[] }[] = [];

  add(category: Category, label: string, check: RowCheck): void {
    const counts = this.counts[category];
    counts.rows++;
    counts.checked += check.checked;
    counts.unchecked += check.unchecked;
    if (check.problems.length === 0) return;
    counts.affectedRows++;
    counts.problems += check.problems.length;
    for (const problem of check.problems) {
      const key = `${category} ${problem.kind}`;
      this.byKind[key] = (this.byKind[key] ?? 0) + 1;
    }
    this.affected.push({ category, label, problems: check.problems });
  }

  version(category: 'build' | 'loot filter', version: string | null): void {
    const key = version ?? '(none)';
    this.versions[category][key] = (this.versions[category][key] ?? 0) + 1;
  }

  report(context: readonly string[], now = new Date()): ScanReport {
    return {
      generatedAt: now.toISOString(),
      context,
      counts: this.counts,
      byKind: Object.fromEntries(Object.entries(this.byKind).sort(([a], [b]) => a.localeCompare(b))),
      versions: this.versions,
      affected: this.affected,
      reviewMentions: this.reviewMentions,
    };
  }
}

const LABELS: Readonly<Record<Category, string>> = {
  favourite: 'Favourite ids',
  build: 'Public builds',
  'loot filter': 'Public loot filters',
};

function versionLine(versions: Readonly<Record<string, number>>): string {
  const entries = Object.entries(versions).sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }));
  return entries.length === 0 ? '(none)' : entries.map(([version, count]) => `${version}: ${String(count)}`).join(', ');
}

/** Text output; `limit` caps the affected items and review mentions listed (0 lists all). */
export function formatScanText(report: ScanReport, limit: number): string {
  const out = ['User data scan (read-only)', ...report.context.map((line) => `  ${line}`), '', 'Counts:'];
  for (const category of Object.keys(LABELS) as Category[]) {
    const counts = report.counts[category];
    out.push(
      `  ${LABELS[category]}: ${String(counts.rows)} scanned, ${String(counts.checked)} references checked` +
        `${counts.unchecked > 0 ? ` (${String(counts.unchecked)} unchecked: no HTM data)` : ''}, ` +
        `${String(counts.affectedRows)} affected (${String(counts.problems)} references no longer resolve)`
    );
  }
  out.push(`  ESR version stamps of builds: ${versionLine(report.versions.build)}`);
  out.push(`  ESR version stamps of loot filters: ${versionLine(report.versions['loot filter'])}`);

  const kinds = Object.entries(report.byKind);
  out.push('', kinds.length === 0 ? 'No longer resolving, by kind: none' : 'No longer resolving, by kind:');
  for (const [kind, count] of kinds) out.push(`  ${kind}: ${String(count)}`);

  const cap = <T>(items: readonly T[]): readonly T[] => (limit > 0 ? items.slice(0, limit) : items);
  if (report.affected.length > 0) {
    out.push('', 'Affected public items:');
    for (const item of cap(report.affected)) {
      const problems = item.problems.map((problem) => `${problem.kind} ${problem.ref}: ${problem.reason}`);
      out.push(`  ${item.category}: ${item.label} → ${problems.join('; ')}`);
    }
    if (limit > 0 && report.affected.length > limit) out.push(`  … +${String(report.affected.length - limit)} more (--limit 0 lists all)`);
  }
  if (report.reviewMentions.length > 0) {
    out.push('', 'Still resolve, but the review lists them (check the recipe they now point at):');
    for (const mention of cap(report.reviewMentions)) out.push(`  ${mention.label}`, ...mention.lines.map((line) => `      ${line}`));
    if (limit > 0 && report.reviewMentions.length > limit) out.push(`  … +${String(report.reviewMentions.length - limit)} more`);
  }
  return `${out.join('\n')}\n`;
}

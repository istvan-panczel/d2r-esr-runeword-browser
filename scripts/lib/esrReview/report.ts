/**
 * The output model of esr-update-review.ts: a flat list of checks, each ok / finding / info / skipped, and its
 * Markdown and plain-text rendering (findings first, then info, ok and skipped).
 */

export type CheckStatus = 'ok' | 'finding' | 'info' | 'skipped';

export interface Check {
  /** Stable id, e.g. `ids.lootfilter`; the skill and reference notes key on it */
  id: string;
  title: string;
  status: CheckStatus;
  /** One line. A finding's summary ends with why it matters (what breaks for players or saved data). */
  summary: string;
  details: string[];
}

export interface ReviewReport {
  generatedAt: string;
  /** What was compared, e.g. "app HEAD 872ff8d (ESR 3.2.24) → working tree; clone b0622767 → b0622767" */
  context: string[];
  checks: Check[];
}

/** Details listed per check before "+N more". */
export const DETAIL_LIMIT = 40;

export const ok = (id: string, title: string, summary: string, details: string[] = []): Check => ({
  id,
  title,
  status: 'ok',
  summary,
  details,
});
export const info = (id: string, title: string, summary: string, details: string[] = []): Check => ({
  id,
  title,
  status: 'info',
  summary,
  details,
});
export const skipped = (id: string, title: string, reason: string): Check => ({
  id,
  title,
  status: 'skipped',
  summary: reason,
  details: [],
});

/** A finding: what was found, then why it matters. */
export function finding(id: string, title: string, what: string, why: string, details: string[] = []): Check {
  return { id, title, status: 'finding', summary: `${what.replace(/\.$/, '')}. Why it matters: ${why}`, details };
}

/** At most `limit` lines plus "… +N more". */
export function capLines(lines: readonly string[], limit = DETAIL_LIMIT): string[] {
  if (lines.length <= limit) return [...lines];
  return [...lines.slice(0, limit), `… +${String(lines.length - limit)} more`];
}

const ORDER: readonly { status: CheckStatus; heading: string }[] = [
  { status: 'finding', heading: 'Findings' },
  { status: 'info', heading: 'Info' },
  { status: 'ok', heading: 'OK' },
  { status: 'skipped', heading: 'Skipped' },
];

export function countByStatus(checks: readonly Check[]): Record<CheckStatus, number> {
  const counts: Record<CheckStatus, number> = { finding: 0, info: 0, ok: 0, skipped: 0 };
  for (const check of checks) counts[check.status]++;
  return counts;
}

function statusLine(checks: readonly Check[]): string {
  const counts = countByStatus(checks);
  return ORDER.map(({ status, heading }) => `${String(counts[status])} ${heading.toLowerCase()}`).join(' · ');
}

/** Markdown: summary line, then one section per status with one sub-heading per check. */
export function formatMarkdown(report: ReviewReport): string {
  const out = ['# ESR update review', '', ...report.context.map((line) => `- ${line}`), `- ${statusLine(report.checks)}`];
  for (const { status, heading } of ORDER) {
    const checks = report.checks.filter((check) => check.status === status);
    if (checks.length === 0) continue;
    out.push('', `## ${heading}`);
    for (const check of checks) {
      out.push('', `### ${check.title} (\`${check.id}\`)`, '', check.summary);
      if (check.details.length > 0) out.push('', ...check.details.map((line) => `    ${line}`));
    }
  }
  return `${out.join('\n')}\n`;
}

/** Plain text for the terminal: the same order, one block per check. */
export function formatText(report: ReviewReport): string {
  const out = ['ESR update review', ...report.context.map((line) => `  ${line}`), `  ${statusLine(report.checks)}`];
  for (const { status, heading } of ORDER) {
    const checks = report.checks.filter((check) => check.status === status);
    if (checks.length === 0) continue;
    out.push('', `=== ${heading} ===`);
    for (const check of checks) {
      out.push('', `[${status.toUpperCase()}] ${check.title} (${check.id}): ${check.summary}`);
      out.push(...check.details.map((line) => `    ${line}`));
    }
  }
  return `${out.join('\n')}\n`;
}

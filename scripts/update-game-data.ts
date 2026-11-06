#!/usr/bin/env node
/**
 * One-shot update after an ESR release: clone or pull the ESR repo, regenerate public/game-data/, keep the old HTM test
 * fixtures in test-fixtures/previous/ and refresh them, run the staleness checks, regenerate and check public/guide/ (and
 * public/sitemap.xml), print the guide freshness report (guide:report), run the whole test suite, then print a summary.
 * Never commits.
 *
 *   node scripts/update-game-data.ts [--esr <dir>] [--vanilla <dir>] [--tag <tag>] [--no-fixtures] [--no-pull]
 *
 *   --no-pull      use the clone as it is (no fetch/checkout; re-runs after a manual fix, offline runs)
 *   --no-fixtures  keep test-fixtures/ as is (no download, no copy to test-fixtures/previous/)
 *
 * The item icons need the vanilla art folder too (--vanilla | D2R_VANILLA_ART_DIR | ../d2r-vanilla-art); without it
 * they are not regenerated (a warning) and only their clone-derived part is checked. After a version bump that check
 * fails (icons.json keeps the old esrVersion); the summary says what to do.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { cloneEsr, readRevision, REPO_ROOT, resolveEsrDir, resolveVanillaArtDir, updateEsr } from './lib/esrClone.ts';
import {
  failedTestFiles,
  formatChange,
  formatSummary,
  parsePorcelain,
  shortCommit,
  staleIconsNote,
  type ManifestSnapshot,
  type SummaryStep,
  type VitestJsonReport,
} from './lib/updateSummary.ts';

const MANIFEST = join(REPO_ROOT, 'public', 'game-data', 'manifest.json');
const ICONS = join(REPO_ROOT, 'public', 'game-data', 'icons.json');
const FIXTURES_DIR = join(REPO_ROOT, 'test-fixtures');
/** The fixtures as they were before this run's download; the review script reads the old HTM pages from here. */
const PREVIOUS_FIXTURES_DIR = join(FIXTURES_DIR, 'previous');
const STASH_FIXTURES_DIR = join(FIXTURES_DIR, 'stash');
/** The generated files under public/ the summary lists and the commit hint adds (guide:generate writes the sitemap). */
const GENERATED_PATHS = ['public/game-data', 'public/guide', 'public/sitemap.xml'];

const USAGE = `Usage: node scripts/update-game-data.ts [--esr <dir>] [--vanilla <dir>] [--tag <tag>] [--no-fixtures] [--no-pull]

  --esr <dir>      ESR clone (default: ESR_SOURCE_DIR or ../Eastern_Sun_Resurrected); cloned when missing
  --vanilla <dir>  vanilla D2R art folder for the item icons (default: D2R_VANILLA_ART_DIR or ../d2r-vanilla-art)
  --tag <tag>      check out this ESR release tag instead of fast-forwarding main
  --no-pull        use the clone as it is (no fetch or checkout)
  --no-fixtures    do not refresh test-fixtures/ (and do not copy them to test-fixtures/previous/)

Writes public/game-data/, public/guide/, public/sitemap.xml and test-fixtures/ (gitignored). Never commits.`;

function header(title: string): void {
  console.log(`\n=== ${title} ===\n`);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Runs a command from the repo root with inherited stdio; returns true on exit code 0. */
function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): boolean {
  console.log(`$ ${command === process.execPath ? 'node' : command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: REPO_ROOT, stdio: 'inherit', env });
  if (result.error) console.error(result.error.message);
  return result.status === 0;
}

/** The HTM/HTML fixtures directly in test-fixtures/ (not the stash save, not previous/). */
function htmFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.html?$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** Replaces test-fixtures/previous/ with the current HTM fixtures; returns a note for the summary. */
function keepPreviousFixtures(): string {
  const files = htmFixtures();
  if (files.length === 0) return 'no fixtures to keep in test-fixtures/previous/';
  rmSync(PREVIOUS_FIXTURES_DIR, { recursive: true, force: true });
  mkdirSync(PREVIOUS_FIXTURES_DIR, { recursive: true });
  for (const file of files) cpSync(join(FIXTURES_DIR, file), join(PREVIOUS_FIXTURES_DIR, file));
  console.log(`Kept ${String(files.length)} old fixtures in test-fixtures/previous/: ${files.join(', ')}`);
  return `old ones kept in test-fixtures/previous/ (${String(files.length)} files)`;
}

function hasStashFixture(): boolean {
  return existsSync(STASH_FIXTURES_DIR) && readdirSync(STASH_FIXTURES_DIR).some((name) => name.endsWith('.d2i'));
}

/**
 * Runs the whole Vitest suite (some suites read the regenerated guide and bundles, so this runs last). Returns the step
 * with the failing test files, read from Vitest's JSON reporter.
 */
function runTests(esrDir: string): SummaryStep {
  const reportDir = mkdtempSync(join(tmpdir(), 'esr-update-vitest-'));
  const reportFile = join(reportDir, 'report.json');
  try {
    // The clone-dependent tests resolve the clone from ESR_SOURCE_DIR (an absolute path wins over the repo root).
    const ok = run('npx', ['vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${reportFile}`], {
      ...process.env,
      ESR_SOURCE_DIR: esrDir,
    });
    const report = readJson(reportFile) as VitestJsonReport | null;
    if (report === null) return { name: 'tests (full suite)', ok, note: ok ? undefined : 'no Vitest JSON report; see the output above' };
    const failed = failedTestFiles(report, REPO_ROOT);
    if (ok && failed.length === 0) return { name: 'tests (full suite)', ok: true };
    return {
      name: 'tests (full suite)',
      ok: false,
      note: failed.length > 0 ? `${String(failed.length)} failing file(s)` : 'failed outside a test file; see the output above',
      details: failed,
    };
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      esr: { type: 'string' },
      vanilla: { type: 'string' },
      tag: { type: 'string' },
      fixtures: { type: 'boolean', default: true },
      pull: { type: 'boolean', default: true },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowNegative: true,
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const esrDir = resolveEsrDir(values.esr);
  const vanillaDir = resolveVanillaArtDir(values.vanilla);
  const hasVanilla = existsSync(vanillaDir);
  const iconArgs = ['--esr', esrDir, '--vanilla', vanillaDir];
  const steps: SummaryStep[] = [];
  const notes: string[] = [];

  header(`1/7 ESR clone (${esrDir})`);
  const oldRevision = existsSync(esrDir) ? readRevision(esrDir) : null;
  if (!values.pull && oldRevision === null) {
    console.error(`\n--no-pull needs an existing clone; ${esrDir} does not exist.`);
    process.exit(1);
  }
  try {
    if (!values.pull) console.log('Skipped (--no-pull): using the clone as it is.');
    else if (oldRevision === null) cloneEsr(esrDir, values.tag);
    else updateEsr(esrDir, values.tag);
  } catch (error) {
    console.error(`\nESR clone update failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  const newRevision = readRevision(esrDir);
  console.log(`\nCommit: ${formatChange(shortCommit(oldRevision?.commit), shortCommit(newRevision.commit))}`);
  console.log(`Tag:    ${formatChange(oldRevision?.tag ?? '(none)', newRevision.tag ?? '(none)')}`);

  header('2/7 Previous manifest');
  const before = readJson(MANIFEST) as ManifestSnapshot | null;
  console.log(before ? `ESR ${before.esrVersion}, tag ${before.esrTag ?? '(none)'}, commit ${before.esrCommit.slice(0, 7)}` : '(none)');

  header('3/7 Generate');
  let generated = run(process.execPath, ['scripts/generate-game-data.ts', '--esr', esrDir]);
  if (generated) {
    // The icons cover the fresh bases.json; the second generate lists the new icons.json in the manifest.
    if (hasVanilla) {
      const icons = run(process.execPath, ['scripts/generate-item-icons.ts', ...iconArgs]);
      steps.push({ name: 'icons', ok: icons });
      generated = run(process.execPath, ['scripts/generate-game-data.ts', '--esr', esrDir]);
    } else {
      console.warn(
        `WARNING: vanilla art folder not found (${vanillaDir}); item icons not regenerated (icons:check verifies the clone-derived part, ` +
          'and fails if the ESR version changed).'
      );
      steps.push({ name: 'icons', ok: true, note: 'skipped, no vanilla art folder' });
    }
    // Skill icons need only the clone; their keys come from the fresh skilldetails.json
    steps.push({ name: 'skill icons', ok: run(process.execPath, ['scripts/generate-skill-icons.ts', '--esr', esrDir]) });
  }
  steps.push({ name: 'generate', ok: generated });
  const after = readJson(MANIFEST) as ManifestSnapshot | null;
  if (!hasVanilla) {
    const note = staleIconsNote(readJson(ICONS) as { esrVersion: string; esrTag: string | null } | null, after, vanillaDir);
    if (note !== null) {
      console.warn(`WARNING: ${note}`);
      notes.push(note);
    }
  }

  header('4/7 Test fixtures');
  if (!values.fixtures) {
    console.log('Skipped (--no-fixtures).');
    steps.push({ name: 'fixtures', ok: true, note: 'skipped' });
  } else {
    const kept = keepPreviousFixtures();
    if (run(process.execPath, ['scripts/fetch-test-fixtures.js'])) {
      steps.push({ name: 'fixtures', ok: true, note: kept });
    } else {
      console.warn('WARNING: fixture download failed; continuing (tests that need missing fixtures skip themselves).');
      steps.push({ name: 'fixtures', ok: true, note: `download failed, warning only; ${kept}` });
    }
  }

  header('5/7 Check');
  if (generated) {
    steps.push({ name: 'check', ok: run(process.execPath, ['scripts/generate-game-data.ts', '--check', '--esr', esrDir]) });
    steps.push({ name: 'icons:check', ok: run(process.execPath, ['scripts/generate-item-icons.ts', '--check', ...iconArgs]) });
    steps.push({ name: 'skill-icons:check', ok: run(process.execPath, ['scripts/generate-skill-icons.ts', '--check', '--esr', esrDir]) });
  } else {
    console.log('Skipped: generation failed.');
  }

  header('6/7 Guide');
  if (!existsSync(join(REPO_ROOT, 'content', 'guide', 'spine.yml'))) {
    console.log('Skipped: no content/guide/spine.yml.');
    steps.push({ name: 'guide', ok: true, note: 'skipped, no content' });
  } else if (generated) {
    // The guide's data blocks (secret recipes, vendors, sources) come from the clone and the fresh game data.
    const guide = run(process.execPath, ['scripts/generate-guide.ts', '--esr', esrDir]);
    steps.push({ name: 'guide:generate', ok: guide });
    // --check regenerates in memory and verifies the files just written match it (catches non-deterministic output).
    steps.push({ name: 'guide:check', ok: guide && run(process.execPath, ['scripts/generate-guide.ts', '--check', '--esr', esrDir]) });
    if (guide) {
      // Which verified notes the new data or patch notes flagged for review (informational, never fails the update).
      header('Guide freshness');
      if (!run(process.execPath, ['scripts/generate-guide.ts', 'report', '--esr', esrDir])) console.warn('WARNING: guide:report failed.');
    }
  } else {
    console.log('Skipped: generation failed.');
  }

  header('7/7 Tests');
  if (generated) {
    // After the guide step: guideIntegrity and other suites compare the committed guide and bundles with fresh builds.
    steps.push(runTests(esrDir));
    if (!hasStashFixture()) {
      notes.push('Stash fixture tests skipped: no test-fixtures/stash/*.d2i (a save from the owner, gitignored, copied by hand).');
    }
  } else {
    console.log('Skipped: generation failed.');
  }

  const porcelain = execFileSync('git', ['status', '--porcelain', '--', ...GENERATED_PATHS], { cwd: REPO_ROOT, encoding: 'utf8' });
  header('Summary');
  for (const line of formatSummary({ before, after, steps, changedFiles: parsePorcelain(porcelain), notes })) console.log(line);

  const failed = !generated || steps.some((step) => !step.ok);
  if (failed) {
    console.error('\nUpdate FAILED; see the steps above.');
    process.exit(1);
  }
  const version = after?.esrVersion ?? 'X.Y.Z';
  console.log(
    `\nNext: review the diff, then commit:\n  git add ${GENERATED_PATHS.join(' ')} && git commit -m 'chore(game-data): update to ESR ${version}'`
  );
}

main();

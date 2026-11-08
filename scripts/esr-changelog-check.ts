#!/usr/bin/env node
/**
 * The shareable report of an /esr-update: does the ESR patch note match what changed in the files?
 *
 *   node scripts/esr-changelog-check.ts --init --diff <esr:diff --json output> --out <check.json>
 *   node scripts/esr-changelog-check.ts --in <check.json> --diff <esr:diff --json output> --out <report.pdf>
 *
 * --init writes the file to fill in (one entry per patch-note line). The second form refuses a file with a line left
 * without a verdict, writes <report>.html and prints it to <report>.pdf with headless Chrome (CHROME_PATH, the macOS
 * app or `google-chrome` / `chromium` on the PATH); without Chrome only the HTML is written. Exit 1 on errors.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { changelogCheckErrors, changelogSkeleton, renderChangelogCheck, type ChangelogCheck } from './lib/esrChangelogCheck.ts';
import type { ReleaseDiff } from './lib/releaseDiff.ts';

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function findChrome(): string | null {
  const configured = process.env['CHROME_PATH'];
  if (configured !== undefined && configured !== '') return configured;
  if (existsSync(MAC_CHROME)) return MAC_CHROME;
  for (const command of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      execFileSync(command, ['--version'], { stdio: 'ignore' });
      return command;
    } catch {
      // not installed: try the next name
    }
  }
  return null;
}

/** Prints the page with a throwaway Chrome profile, so a running browser and its profile are not touched */
function printPdf(chrome: string, htmlPath: string, pdfPath: string): void {
  const profile = mkdtempSync(join(tmpdir(), 'esr-changelog-chrome-'));
  try {
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-pdf-header-footer',
        `--user-data-dir=${profile}`,
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
      ],
      { stdio: 'ignore', timeout: 60_000 }
    );
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

function main(): void {
  const { values } = parseArgs({
    options: { init: { type: 'boolean', default: false }, in: { type: 'string' }, diff: { type: 'string' }, out: { type: 'string' } },
  });
  if (values.diff === undefined || values.out === undefined) fail('Needs --diff <esr:diff --json output> and --out <file>.');
  const diff = JSON.parse(readFileSync(resolve(values.diff), 'utf8')) as ReleaseDiff;
  const out = resolve(values.out);
  mkdirSync(dirname(out), { recursive: true });

  if (values.init) {
    const skeleton = changelogSkeleton(diff);
    writeFileSync(out, `${JSON.stringify(skeleton, null, 2)}\n`);
    console.log(`Wrote ${out}: ${String(skeleton.notes.length)} patch-note lines to check.`);
    return;
  }

  if (values.in === undefined) fail('Needs --in <check.json>, or --init to create it.');
  const check = JSON.parse(readFileSync(resolve(values.in), 'utf8')) as ChangelogCheck;
  const errors = changelogCheckErrors(check, diff);
  if (errors.length > 0) fail(`${values.in} is not complete:\n${errors.map((error) => `  - ${error}`).join('\n')}`);

  const htmlPath = out.replace(/\.pdf$/i, '') + '.html';
  writeFileSync(htmlPath, renderChangelogCheck(check, diff));
  const chrome = findChrome();
  if (chrome === null) {
    console.warn(`No Chrome found (set CHROME_PATH): wrote only ${htmlPath}`);
    return;
  }
  printPdf(chrome, htmlPath, out);
  if (!existsSync(out)) fail(`Chrome did not write ${out}; the page is at ${htmlPath}`);
  console.log(`Wrote ${out} and ${htmlPath}`);
}

main();

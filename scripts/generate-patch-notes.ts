#!/usr/bin/env node
/**
 * Writes public/patch-notes/index.json, the Patch Notes page's data: the ESR patch notes (patchnotes/<version>.md in
 * the clone), release dates from its tags and our reports, which it first copies from owner-notes/ (local, gitignored)
 * into public/patch-notes/reports/. game-data:generate runs it too.
 *
 *   node scripts/generate-patch-notes.ts [--esr <dir>] [--check]
 *
 * --check exits 1 when the committed index is stale (copies nothing). See docs/features/PATCH-NOTES.md.
 */
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolveEsrDir } from './lib/esrClone.ts';
import { updatePatchNotes } from './lib/patchNotesFiles.ts';

const { values } = parseArgs({ options: { esr: { type: 'string' }, check: { type: 'boolean', default: false } } });
const esrDir = resolveEsrDir(values.esr);
if (!existsSync(esrDir)) {
  console.error(`ESR clone not found: ${esrDir}`);
  process.exit(1);
}
if (!updatePatchNotes(esrDir, values.check)) process.exit(1);

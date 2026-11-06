#!/usr/bin/env node
/**
 * Writes src/features/modifiers/data/modifierRefs.json, the modifier peek's data (whole-line templates, entry titles and
 * summaries, the facts its numbers use), from the committed public/game-data/modifiers.json and
 * content/modifiers/modifiers.md. Run after either changes (game-data:generate runs it too).
 *
 *   node scripts/generate-modifier-refs.ts [--check]
 *
 * --check exits 1 when the committed file is stale. See docs/features/MODIFIERS.md "Modifier peek".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ModifiersBundle } from '../src/features/game-data/engine/schema.ts';
import { serializeBundle } from '../src/features/game-data/build/writeBundle.ts';
import { buildModifierRefsData } from '../src/features/modifiers/utils/modifierRefsBuild.ts';
import { REPO_ROOT } from './lib/esrClone.ts';

const MODIFIER_REFS_PATH = join(REPO_ROOT, 'src', 'features', 'modifiers', 'data', 'modifierRefs.json');

function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
  const bundle = JSON.parse(readFileSync(join(REPO_ROOT, 'public', 'game-data', 'modifiers.json'), 'utf8')) as ModifiersBundle;
  const markdown = readFileSync(join(REPO_ROOT, 'content', 'modifiers', 'modifiers.md'), 'utf8');
  const { data, conflicts, problems } = buildModifierRefsData(bundle, markdown);
  const text = serializeBundle(data);

  console.log(
    `Modifier refs: ${String(data.entries.length)} entries, ${String(data.templates.length)} templates, ${String(data.patterns.length)} patterns, ${String(data.facts.length)} facts`
  );
  console.log(`Keys several entries claim (${String(conflicts.length)}; a tie is left out):`);
  for (const conflict of conflicts) console.log(`  - ${conflict}`);
  if (problems.length > 0) {
    console.error(`Problems:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    process.exit(1);
  }

  if (values.check) {
    if (!existsSync(MODIFIER_REFS_PATH) || readFileSync(MODIFIER_REFS_PATH, 'utf8') !== text) {
      console.error('Stale src/features/modifiers/data/modifierRefs.json. Run npm run modifiers:refs.');
      process.exit(1);
    }
    console.log('modifierRefs.json is up to date.');
    return;
  }
  mkdirSync(dirname(MODIFIER_REFS_PATH), { recursive: true });
  writeFileSync(MODIFIER_REFS_PATH, text, 'utf8');
  console.log(`Written src/features/modifiers/data/modifierRefs.json (${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)} KB)`);
}

main();

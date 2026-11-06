#!/usr/bin/env node
/**
 * Writes src/features/modifiers/data/modifierRefs.json, the modifier peek's data, from the committed
 * public/game-data/modifiers.json and content/modifiers/modifiers.md. Run after editing modifiers.md
 * (game-data:generate writes it too, from the bundle it generates).
 *
 *   node scripts/generate-modifier-refs.ts [--check]
 *
 * --check exits 1 when the committed file is stale. See docs/features/MODIFIERS.md "Modifier peek".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ModifiersBundle } from '../src/features/game-data/engine/schema.ts';
import { REPO_ROOT } from './lib/esrClone.ts';
import { updateModifierRefs } from './lib/modifierRefsFile.ts';

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
const bundle = JSON.parse(readFileSync(join(REPO_ROOT, 'public', 'game-data', 'modifiers.json'), 'utf8')) as ModifiersBundle;
if (!updateModifierRefs(bundle, values.check)) process.exit(1);

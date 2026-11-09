#!/usr/bin/env node
/**
 * Writes the loot filter agent pack, public/loot-filters/agent/ (served at <site>/loot-filters/agent/<file>), from the
 * committed public/game-data bundles: README.md for an AI agent that writes ESR loot filters, then the AI help page's
 * reference files with the full game data. game-data:generate writes it too, after the bundles.
 *
 *   node scripts/generate-loot-filter-agent-pack.ts [--check]
 *
 * --check exits 1 when the committed pack is stale. See docs/features/LOOT-FILTER.md "AI help".
 */
import { parseArgs } from 'node:util';
import { updateLootFilterAgentPack } from './lib/lootFilterAgentPack.ts';

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
if (!(await updateLootFilterAgentPack(values.check))) process.exit(1);

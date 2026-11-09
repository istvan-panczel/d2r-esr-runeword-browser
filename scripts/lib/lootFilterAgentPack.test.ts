/**
 * The committed loot filter agent pack (public/loot-filters/agent/) against a fresh build from the committed bundles,
 * like generate-loot-filter-agent-pack.ts --check, plus the README's promises: every file listed with its URL, and the
 * Section comments example reading back as the ruleset says.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GameDataManifest, LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { parseLootFilter } from '@/features/loot-filter/engine/parse';
import { buildLootFilterReference } from '@/features/loot-filter/engine/reference';
import { validateLootFilter } from '@/features/loot-filter/engine/validate';
import { AGENT_PACK_PATH, agentPackUrl, buildAgentPack } from '@/features/loot-filter/utils/aiPrompt/agentPack';
import { referenceFiles } from '@/features/loot-filter/utils/aiPrompt/promptPackage';
import { SITE_URL } from './sitemap.ts';

const root = resolve(__dirname, '../..');
const dir = join(root, 'public', ...AGENT_PACK_PATH.split('/').filter(Boolean));
const json = <T>(file: string) => JSON.parse(readFileSync(join(root, 'public', 'game-data', file), 'utf8')) as T;
const data = json<LootFilterDataBundle>('lootfilter.json');
const types = json<TypesBundle>('types.json');
const { esrVersion } = json<GameDataManifest>('manifest.json');
const reference = buildLootFilterReference(data, types);
const input = { data, types, reference, esrVersion };
const pack = buildAgentPack(input, SITE_URL);
const readme = pack.find((file) => file.path === 'README.md')?.text ?? '';

describe('loot filter agent pack', () => {
  it('is committed as generated (npm run loot-filter:agent-pack)', () => {
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir).sort()).toEqual(pack.map((file) => file.path).sort());
    for (const file of pack) expect(readFileSync(join(dir, file.path), 'utf8'), file.path).toBe(file.text);
  });

  it('holds README.md, then the AI page reference files with the full game data, under the same names', () => {
    expect(pack.map((file) => file.path)).toEqual(['README.md', ...referenceFiles(input, 'full').map((file) => file.path)]);
    expect(pack.slice(1).map((file) => file.text)).toEqual(referenceFiles(input, 'full').map((file) => file.text));
  });

  it('lists every file with its public URL, and the ESR version', () => {
    for (const file of pack) expect(readme).toContain(agentPackUrl(SITE_URL, file.path));
    expect(agentPackUrl(SITE_URL, 'README.md')).toBe(
      'https://istvan-panczel.github.io/d2r-esr-runeword-browser/loot-filters/agent/README.md'
    );
    expect(readme).toContain(`ESR ${esrVersion}`);
    expect(readme).toContain('## Section comments');
  });

  it('has a Section comments example that reads back with its parts, sections and notes', () => {
    const example = /```jsonc\n([\s\S]*?)\n```/.exec(readme)?.[1] ?? '';
    const { filter, diagnostics, notes } = parseLootFilter(example);
    expect(diagnostics).toEqual([]);
    expect(notes).toEqual([]);
    expect(validateLootFilter(filter, reference)).toEqual([]);
    expect(filter.leadingComments).toEqual(['// My ESR filter v1.0.0']);
    expect(filter.rules.map((rule) => rule.commentsBefore)).toEqual([
      ['// ==== Show ====', '// Label rules first: later rules change the looks of earlier ones.', '// ---- Runes'],
      ['// ==== Hide ====', '// Narrow hide rules last, each with its own exceptions.'],
    ]);
  });

  it('carries no date (deterministic output)', () => {
    for (const file of pack) expect(file.text, file.path).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });
});

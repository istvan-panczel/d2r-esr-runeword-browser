import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterDataBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { ACTION_KEYS, CONDITION_KEYS, parseLootFilter, TOP_LEVEL_KEYS } from '../../engine/parse';
import { buildLootFilterReference, EMPTY_LOOT_FILTER_REFERENCE } from '../../engine/reference';
import { serializeLootFilter } from '../../engine/serialize';
import { STAT_QUIRKS } from '../../engine/statQuirks';
import { PLACEHOLDERS } from '../../engine/text';
import { validateLootFilter } from '../../engine/validate';
import { BUNDLED_ICONS, BUNDLED_SOUNDS } from '../bundledAssets';
import { EXAMPLE_RULES } from '../exampleRules';
import {
  buildAssets,
  buildExamples,
  buildFormatReference,
  DEFAULT_PROMPT_ASSETS,
  MISTAKE_SAMPLES,
  mistakeMessages,
  ruleJson,
  SKELETON_FILTER,
} from './formatReference';

const json = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/game-data', file), 'utf8')) as unknown;
const reference = buildLootFilterReference(json('lootfilter.json') as LootFilterDataBundle, json('types.json') as TypesBundle);

const format = buildFormatReference({ reference, examples: EXAMPLE_RULES, esrVersion: '3.2.24' });

/** The JSON code blocks of a markdown text. */
const jsonBlocks = (text: string) => [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => match[1] ?? '');

describe('buildFormatReference', () => {
  it('has a table row for every top-level key, condition and action of the parser', () => {
    for (const key of [...TOP_LEVEL_KEYS, ...CONDITION_KEYS, ...ACTION_KEYS]) expect(format).toContain(`| \`${key}\` |`);
  });

  it('lists every placeholder, the plugin quirks and the omitted-param rule', () => {
    for (const placeholder of PLACEHOLDERS) expect(format).toContain(`\`${placeholder.token}\``);
    for (const quirk of STAT_QUIRKS) expect(format).toContain(quirk.message);
    expect(format).toContain('reads only the entry with param 0');
    expect(format).toContain('Game data: ESR 3.2.24.');
  });

  it('starts with a complete file that reads and validates without a problem', () => {
    const [skeleton] = jsonBlocks(format);
    expect(skeleton).toBe(serializeLootFilter(SKELETON_FILTER).trimEnd());
    const parsed = parseLootFilter(skeleton ?? '');
    expect(parsed.diagnostics).toEqual([]);
    expect(validateLootFilter(parsed.filter, reference)).toEqual([]);
  });

  it('prints what the app reports for every common mistake (the validator against the game data)', () => {
    for (const sample of MISTAKE_SAMPLES) {
      const messages = mistakeMessages(sample, reference);
      expect(messages.length, sample.what).toBeGreaterThan(0);
      for (const message of messages) expect(format).toContain(`  - app: ${message}`);
    }
    expect(format).toContain('Unknown item code "r99"');
    expect(format).toContain('There is no style named "Great"');
  });

  it('leaves out the samples that need game data when there is none', () => {
    const bare = buildFormatReference({ reference: EMPTY_LOOT_FILTER_REFERENCE, examples: EXAMPLE_RULES });
    expect(bare).not.toContain('Unknown item code');
    expect(bare).toContain('There is no style named "Great"');
  });
});

describe('buildExamples', () => {
  it('shows every example rule as JSON that reads back to the rule', () => {
    const text = buildExamples(EXAMPLE_RULES);
    const blocks = jsonBlocks(text);
    expect(blocks).toHaveLength(EXAMPLE_RULES.length);
    EXAMPLE_RULES.forEach((example, index) => {
      expect(text).toContain(`## ${example.title}`);
      const parsed = parseLootFilter(`{"formatVersion": 1, "rules": [${blocks[index] ?? ''}]}`);
      expect(parsed.diagnostics).toEqual([]);
      expect(parsed.filter.rules[0]).toEqual(example.rule);
    });
  });

  it('adds the style presets when given', () => {
    const text = buildExamples(
      [],
      [{ name: 'Gold', description: 'For uniques.', style: { labelBorder: { color: [199, 179, 119], width: 2 } } }]
    );
    expect(text).toContain('# Style presets');
    expect(text).toContain('## Gold');
    expect(jsonBlocks(text).map((block) => JSON.parse(block) as unknown)).toEqual([
      { Gold: { labelBorder: { color: [199, 179, 119], width: 2 } } },
    ]);
  });
});

describe('ruleJson', () => {
  it('writes one key per line', () => {
    expect(ruleJson({ comment: 'x', itemCodes: ['r51'], hide: true })).toBe(
      '{\n  "itemCodes": ["r51"],\n  "hide": true,\n  "comment": "x"\n}'
    );
  });
});

describe('buildAssets', () => {
  it('lists the bundled sounds and icons', () => {
    const text = buildAssets(DEFAULT_PROMPT_ASSETS);
    for (const name of [...BUNDLED_SOUNDS, ...BUNDLED_ICONS]) expect(text).toContain(`- \`${name}\``);
    expect(buildAssets({ sounds: [{ name: 'gong.mp3', note: 'a deep gong' }], icons: [] })).toContain('- `gong.mp3`: a deep gong');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModifiersBundle } from '@/features/game-data/engine/schema';
import { parseModifierContent, parseOpenQuestions, plainText, sourceLink, tokenizeInline } from './modifierContent';
import { CONTENT_KINDS, KEY_KINDS_WITHOUT_TEXT, KIND_CALCULATORS, KIND_FACTS } from './modifierContentKinds';
import { formatFactValue, resolvePlaceholder, resolveText } from './modifierPlaceholders';
import { buildModifiersView } from './modifiersView';

const ROOT = process.cwd();
const bundle = JSON.parse(readFileSync(resolve(ROOT, 'public/game-data/modifiers.json'), 'utf8')) as ModifiersBundle;
const contentText = readFileSync(resolve(ROOT, 'content/modifiers/modifiers.md'), 'utf8');
const questionsText = readFileSync(resolve(ROOT, 'content/modifiers/open-questions.md'), 'utf8');

describe('parseModifierContent', () => {
  const sample = [
    '# Title',
    '',
    '## How to read these drafts',
    '',
    '- [ESR config]: not a block',
    '',
    '## crushing-blow — Crushing Blow',
    '',
    'stats: item_crushingblow (136)',
    '',
    'summary: A chance on hit.',
    '',
    'body: Removes life [Vanilla]. ESR scales it [ESR config].',
    '',
    'facts (share = vanilla × config):',
    '',
    '- Normal: 25%.',
    '- Ranged: 100%',
    '  continued.',
    '',
    'caveats: none.',
    '',
    'sources: `excel/itemstatcost.txt` row 136; wiki "Q&A"',
    '',
    '---',
    '',
    '## light-radius — Light Radius',
    '',
    'summary: Cosmetic.',
    '',
    'body: More light [Vanilla].',
    '',
    'facts: Item rows 84.',
    '',
    'caveats: whether it matters at all.',
  ].join('\n');

  it('reads the keyed blocks and skips other headings', () => {
    const { blocks, errors } = parseModifierContent(sample);
    expect(errors).toEqual([]);
    expect(blocks.map((block) => block.key)).toEqual(['crushing-blow', 'light-radius']);
    expect(blocks[0]).toMatchObject({
      title: 'Crushing Blow',
      stats: 'item_crushingblow (136)',
      summary: 'A chance on hit.',
      factsIntro: 'share = vanilla × config',
      facts: ['Normal: 25%.', 'Ranged: 100% continued.'],
      caveats: [],
      sources: ['`excel/itemstatcost.txt` row 136', 'wiki "Q&A"'],
    });
    expect(blocks[1]).toMatchObject({ facts: ['Item rows 84.'], caveats: ['whether it matters at all.'] });
  });

  it('reports duplicate keys and blocks without text', () => {
    const { errors } = parseModifierContent('## a — A\n\nsummary: x\n\nbody: y\n\n## a — Again\n\nbody: z');
    expect(errors).toEqual(['duplicate content key a', 'a: no summary']);
  });
});

describe('tokenizeInline', () => {
  it('splits code, bold, links and source tags', () => {
    expect(
      tokenizeInline('Cap `75` **hard** [Vanilla, D2MOO x.cpp:1]. See [maxroll](https://maxroll.gg/a) [Community 3.9] [ESR files]')
    ).toEqual([
      { type: 'text', text: 'Cap ' },
      { type: 'code', text: '75' },
      { type: 'text', text: ' ' },
      { type: 'strong', text: 'hard' },
      { type: 'text', text: ' ' },
      { type: 'tag', tag: { kind: 'vanilla', detail: 'D2MOO x.cpp:1' } },
      { type: 'text', text: '. See ' },
      { type: 'link', text: 'maxroll', href: 'https://maxroll.gg/a' },
      { type: 'text', text: ' ' },
      { type: 'tag', tag: { kind: 'community', version: '3.9' } },
      { type: 'text', text: ' ' },
      { type: 'tag', tag: { kind: 'esr-files' } },
    ]);
  });

  it('keeps bare URLs as links and gives the plain text for search', () => {
    const tokens = tokenizeInline('see https://maxroll.gg/d2/resources/attack-modifiers; and [ESR config] more');
    expect(tokens[1]).toEqual({
      type: 'link',
      text: 'https://maxroll.gg/d2/resources/attack-modifiers',
      href: 'https://maxroll.gg/d2/resources/attack-modifiers',
    });
    expect(plainText(tokens)).toBe('see https://maxroll.gg/d2/resources/attack-modifiers; and more');
  });
});

describe('sourceLink', () => {
  it('links ESR paths, D2MOO files, the wiki and URLs; drops research files', () => {
    expect(sourceLink('`excel/itemstatcost.txt` row 136')?.href).toBe(
      'https://github.com/CelestialRayOne/Eastern_Sun_Resurrected/blob/main/Eastern_Sun_Resurrected.mpq/data/global/excel/itemstatcost.txt'
    );
    expect(sourceLink('`ESR/d2rloader/config/celestialrayone.bleed.toml`')?.href).toBe(
      'https://github.com/CelestialRayOne/Eastern_Sun_Resurrected/blob/main/d2rloader/config/celestialrayone.bleed.toml'
    );
    expect(sourceLink('D2MOO/D2Game/src/UNIT/SUnitDmg.cpp:560–580, 1163–1296')?.href).toBe(
      'https://github.com/ThePhrozenKeep/D2MOO/blob/4a60fca/source/D2Game/src/UNIT/SUnitDmg.cpp'
    );
    expect(sourceLink('wiki "Magic Find", Q&A')).toEqual({
      text: 'Unofficial wiki: "Magic Find", Q&A',
      href: 'https://doubleeclipse.github.io/esr-tools/unofficial-wiki/',
    });
    expect(sourceLink('https://maxroll.gg/d2/resources/attack-modifiers')).toEqual({
      text: 'maxroll.gg/d2/resources/attack-modifiers',
      href: 'https://maxroll.gg/d2/resources/attack-modifiers',
    });
    expect(sourceLink('`scratchpad/modifiers/out/skills-stat-refs.txt`')).toBeNull();
    expect(sourceLink('guide note `dstoning-and-mapling`')).toEqual({ text: 'guide note dstoning-and-mapling', href: null });
  });
});

describe('parseOpenQuestions', () => {
  it('reads numbered questions with their keys and lines', () => {
    const questions = parseOpenQuestions(
      '## Highest impact\n\n1. **Leech in Hell? (Test, then ask)** — `life-leech`, `mana-leech`\n   Line one.\n   Test: do it.\n\n2. **Other (Ask)** **(new)** — `x`, penalties table\n   Ask: why?\n\n## Follow-ups\n\n- not a question'
    );
    expect(questions).toEqual([
      {
        number: 1,
        title: 'Leech in Hell?',
        how: 'Test, then ask',
        keys: ['life-leech', 'mana-leech'],
        lines: ['Line one.', 'Test: do it.'],
      },
      { number: 2, title: 'Other', how: 'Ask', keys: ['x'], lines: ['Ask: why?'] },
    ]);
  });
});

describe('placeholders', () => {
  const facts = bundle.facts;

  it('resolves the difficulty, charstats, config, patch and derived names against the facts', () => {
    expect(resolvePlaceholder('difficulty.hell.lifeStealDivisor', facts)).toEqual({ text: '150', fact: 'difficulty.LifeStealDivisor' });
    expect(resolvePlaceholder('difficulty.*.aiCurseDivisor', facts)?.text).toBe('1 / 2 / 4');
    expect(resolvePlaceholder('charstats.amazon.BlockFactor', facts)?.text).toBe('5');
    expect(resolvePlaceholder('charstats.*.RunVelocity', facts)?.text).toBe('13');
    expect(resolvePlaceholder('config.crushing-blow.targets.unique', facts)).toEqual({ text: '25', fact: 'crushingBlow.settings' });
    expect(resolvePlaceholder('config.attack-rating.chance.level_scaling', facts)?.text).toBe('false');
    expect(resolvePlaceholder('patch.esr-resistance-floor-minus-1000.floor', facts)?.text).toBe('-1000');
    expect(resolvePlaceholder('monstats.drainH.blankCount', facts)?.text).toBe('648');
    expect(resolvePlaceholder('derived.crushing-blow.unique', facts)?.text).toBe('6.25%');
    expect(resolvePlaceholder('derived.leech.life.20.hell', facts)?.text).toBe('0.125%');
    expect(resolvePlaceholder('derived.leech.mana.10.nightmare', facts)?.text).toBe('0.656%');
    expect(resolvePlaceholder('difficulty.hell.noSuchColumn', facts)).toBeNull();
    expect(resolvePlaceholder('config.unknown.key', facts)).toBeNull();
  });

  it('continues "…" paths, drops value comments and keeps orphan comments as text', () => {
    const resolved = resolveText(
      '`pivot = {config.attack-rating.curve.pivot_ratio}`<!-- 5.0 -->, `tail = {…tail}`<!-- 3.0 --> Sorceress <!-- 4 -->, {nope.x}',
      facts
    );
    expect(resolved.text).toBe('`pivot = 5`, `tail = 3` Sorceress 4, {nope.x}');
    expect(resolved.facts).toEqual(['attackRating.curve']);
    expect(resolved.missing).toEqual(['nope.x']);
  });

  it('formats fact values', () => {
    expect(formatFactValue([1, 25, 150])).toBe('1 / 25 / 150');
    expect(formatFactValue({ a: 1, b: 1 })).toBe('1');
    expect(formatFactValue({ a: 1, b: 2 })).toBe('a 1, b 2');
    expect(formatFactValue(true)).toBe('true');
    expect(formatFactValue(0.1 + 0.2)).toBe('0.3');
  });
});

describe('committed modifier content', () => {
  const { blocks, errors } = parseModifierContent(contentText);
  const questions = parseOpenQuestions(questionsText);
  const kindKeys = new Set(bundle.kinds.map((kind) => kind.key));
  const factKeys = new Set(bundle.facts.map((fact) => fact.key));

  it('parses without errors', () => {
    expect(errors).toEqual([]);
    expect(blocks.length).toBeGreaterThanOrEqual(40);
    for (const block of blocks) {
      expect(block.summary, block.key).not.toBe('');
      expect(block.body, block.key).not.toBe('');
    }
  });

  it('resolves every placeholder against the committed facts', () => {
    const view = buildModifiersView(bundle, blocks, questions);
    expect(view.problems).toEqual([]);
    for (const entry of view.entries) {
      const tokens = [entry.content?.summary, entry.content?.body, ...(entry.content?.facts ?? []), ...(entry.content?.caveats ?? [])];
      for (const line of tokens)
        for (const token of line ?? []) if (token.type !== 'tag') expect(token.text, entry.key).not.toMatch(/\{[^{}\s]+\}|<!--/);
    }
  });

  it('maps every content key to existing kinds, claims each kind once and covers every key kind', () => {
    const contentKeys = blocks.map((block) => block.key);
    expect(contentKeys.filter((key) => CONTENT_KINDS[key] === undefined)).toEqual([]);
    expect(Object.keys(CONTENT_KINDS).filter((key) => !contentKeys.includes(key))).toEqual([]);
    const claimed = Object.values(CONTENT_KINDS).flatMap((mapping) => mapping?.kinds ?? []);
    expect(claimed.filter((key) => !kindKeys.has(key))).toEqual([]);
    expect(claimed.filter((key, index) => claimed.indexOf(key) !== index)).toEqual([]);
    const keyKinds = bundle.kinds.filter((kind) => kind.generated !== true).map((kind) => kind.key);
    expect(keyKinds.filter((key) => !claimed.includes(key) && !KEY_KINDS_WITHOUT_TEXT.includes(key))).toEqual([]);
    expect(KEY_KINDS_WITHOUT_TEXT.filter((key) => claimed.includes(key) || !keyKinds.includes(key))).toEqual([]);
  });

  it('names only existing kinds and facts in the fact and calculator tables', () => {
    expect(Object.keys(KIND_FACTS).filter((key) => !kindKeys.has(key))).toEqual([]);
    expect(
      Object.values(KIND_FACTS)
        .flatMap((keys) => keys ?? [])
        .filter((key) => !factKeys.has(key))
    ).toEqual([]);
    expect(Object.keys(KIND_CALCULATORS).filter((key) => !kindKeys.has(key))).toEqual([]);
  });

  it('ties every open question to existing content keys', () => {
    expect(questions.length).toBeGreaterThanOrEqual(15);
    const contentKeys = new Set(blocks.map((block) => block.key));
    for (const question of questions) {
      expect(question.keys.length, question.title).toBeGreaterThan(0);
      expect(question.title, question.title).not.toMatch(/\*|\(new\)/i);
      expect(question.how, question.title).not.toBe('');
      expect(
        question.keys.filter((key) => !contentKeys.has(key)),
        question.title
      ).toEqual([]);
    }
  });
});

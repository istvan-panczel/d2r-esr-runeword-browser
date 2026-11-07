import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModifierFactValue, ModifiersBundle } from '@/features/game-data/engine/schema';
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

  it('keeps app paths as links', () => {
    expect(tokenizeInline('See [Elixirs](/elixirs) and [x](javascript:alert(1)).')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'Elixirs', href: '/elixirs' },
      { type: 'text', text: ' and [x](javascript:alert(1)).' },
    ]);
    expect(tokenizeInline('[x](//example.com)')).toEqual([{ type: 'text', text: '[x](//example.com)' }]);
  });

  it('reads the mod author tag', () => {
    expect(tokenizeInline('No crit [Mod author].')[1]).toEqual({ type: 'tag', tag: { kind: 'mod-author' } });
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
  it('links ESR paths, D2MOO files, the wiki and URLs', () => {
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
    expect(sourceLink('  ')).toBeNull();
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
    expect(resolvePlaceholder('monstats.drainH.blankCount', facts)?.text).toBe('659');
    expect(resolvePlaceholder('derived.crushing-blow.unique', facts)?.text).toBe('6.25%');
    expect(resolvePlaceholder('derived.leech.life.20.hell', facts)?.text).toBe('0.125%');
    expect(resolvePlaceholder('derived.leech.mana.10.nightmare', facts)?.text).toBe('0.656%');
    expect(resolvePlaceholder('derived.leech-threshold.life.hell', facts)?.text).toBe('2.34%');
    expect(resolvePlaceholder('derived.critical-multiplier.50', facts)?.text).toBe('2.5');
    expect(resolvePlaceholder('derived.magic-find.unique.300', facts)?.text).toBe('166');
    expect(resolvePlaceholder('derived.fcr-rate.300', facts)?.text).toBe('185');
    expect(resolvePlaceholder('derived.fcr-frames.16.400', facts)?.text).toBe('8');
    expect(resolvePlaceholder('derived.fcr-max-useful', facts)?.text).toBe('480');
    expect(resolvePlaceholder('derived.max-resist-headroom', facts)?.text).toBe('20');
    expect(resolvePlaceholder('derived.attack-rating-table', facts)?.text).toMatch(/^1 → 0, 2 → 1, .* 104 → 100$/);
    expect(resolvePlaceholder('engine.absorb.percent-cap', facts)?.text).toBe('40');
    expect(resolvePlaceholder('config.crossbow-charges.crossbow_charges.default_max_bolts', facts)?.text).toBe('3');
    expect(resolvePlaceholder('skills.attack.crossbow-reload.base-frames', facts)?.text).toBe('60');
    expect(resolvePlaceholder('derived.crossbow-reload-seconds.base', facts)?.text).toBe('2.4');
    expect(resolvePlaceholder('derived.crossbow-standing-seconds.min', facts)?.text).toBe('0.8');
    expect(resolvePlaceholder('derived.crossbow-damage.0', facts)?.text).toBe('200%');
    expect(resolvePlaceholder('derived.crossbow-damage.50', facts)?.text).toBe('250%');
    expect(resolvePlaceholder('derived.crossbow-reload-seconds.nope', facts)).toBeNull();
    expect(resolvePlaceholder('config.extra-curses.curses.replace', facts)?.text).toBe('oldest');
    expect(resolvePlaceholder('config.jeweler.gem_effect.runesInItem', facts)?.text).toBe('1046');
    expect(resolvePlaceholder('derived.utility-potion-seconds.elixir', facts)?.text).toBe('45');
    expect(resolvePlaceholder('derived.utility-potion-seconds.stamina', facts)?.text).toBe('90');
    expect(resolvePlaceholder('derived.greater-elixir-multiplier', facts)?.text).toBe('1.25');
    expect(resolvePlaceholder('misc.utility-potion.perk-percent', facts)?.text).toBe('5');
    expect(resolvePlaceholder('vanilla.difficulty.*.lifeStealDivisor', facts)?.text).toBe('1 / 2 / 3');
    expect(resolvePlaceholder('vanilla.config.cast-rate-cap.cast-rate-cap.fcr_cap', facts)?.text).toBe('200');
    expect(resolvePlaceholder('vanilla.config.crushing-blow.targets.unique', facts)).toBeNull();
    expect(resolvePlaceholder('derived.leech.blood.10.hell', facts)).toBeNull();
    expect(resolvePlaceholder('derived.nothing', facts)).toBeNull();
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

  it("names in a block's stats: line exactly the stats of its kinds", () => {
    // stats: lists `name (id)`; a stat of the block's kinds may also be named by a bare id ("hidden twins 377, 378")
    const kindStats = new Map(bundle.kinds.map((kind) => [kind.key, kind.stats]));
    const statName = new Map(bundle.stats.map((stat) => [stat.id, stat.stat]));
    const mismatches = blocks.flatMap((block) => {
      const mapped = new Set((CONTENT_KINDS[block.key]?.kinds ?? []).flatMap((key) => kindStats.get(key) ?? []));
      const named = [...block.stats.matchAll(/(\w+) \((\d+)\)/g)].map((match) => ({ name: match[1], id: Number(match[2]) }));
      const mentioned = new Set([...block.stats.matchAll(/\b\d+\b/g)].map((match) => Number(match[0])));
      return [
        ...named
          .filter(({ id }) => !mapped.has(id))
          .map(({ name, id }) => `${block.key}: ${String(name)} (${String(id)}) is not a stat of its kinds`),
        ...named
          .filter(({ name, id }) => statName.has(id) && statName.get(id) !== name)
          .map(({ name, id }) => `${block.key}: ${String(id)} is not ${String(name)}`),
        ...[...mapped]
          .filter((id) => !mentioned.has(id))
          .map((id) => `${block.key}: ${statName.get(id) ?? '?'} (${String(id)}) is missing from stats:`),
      ];
    });
    expect(mismatches).toEqual([]);
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

  it('ships no local paths or internal research notes (both files are bundled whole into the page chunk)', () => {
    for (const text of [contentText, questionsText]) expect(text).not.toMatch(/\/Users\/|scratchpad|research-|research notes|factcheck/i);
  });

  it('has a value comment only right after a placeholder (any other comment would render as text)', () => {
    const orphans = [...contentText.matchAll(/<!--[\s\S]*?-->/g)].flatMap((match) =>
      /\}`?\s*$/.test(contentText.slice(Math.max(0, match.index - 3), match.index)) ? [] : [match[0]]
    );
    expect(orphans).toEqual([]);
  });

  it('types no number in a summary that a fact of its card holds (write a placeholder instead)', () => {
    const view = buildModifiersView(bundle, blocks, questions);
    const numbers = (value: ModifierFactValue | undefined): number[] => {
      if (typeof value === 'number') return [value];
      if (value === undefined || typeof value !== 'object') return [];
      return (Array.isArray(value) ? value : Object.values(value)).filter((entry) => typeof entry === 'number');
    };
    const typed = blocks.flatMap((block) => {
      // A percent fact also shows up as a multiplier (base_percent 200 → ×2)
      const values = new Set(
        (view.byKey.get(block.key)?.facts ?? [])
          .flatMap((fact) => [...numbers(fact.value), ...numbers(fact.vanilla)])
          .flatMap((value) => [value, value / 100])
          .filter((value) => Math.abs(value) > 1)
      );
      const text = block.summary.replace(/\{[^{}\s]+\}/g, '').replace(/<!--[\s\S]*?-->/g, '');
      return [...text.matchAll(/\d+(?:\.\d+)?/g)].flatMap((match) => (values.has(Number(match[0])) ? [`${block.key}: ${match[0]}`] : []));
    });
    expect(typed).toEqual([]);
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

import { describe, expect, it } from 'vitest';
import { countWords, markdownToBlocks } from './markdown.ts';
import { fixtureContext } from './testContext.mock.ts';

function convert(markdown: string) {
  return markdownToBlocks(markdown, fixtureContext(), 'notes/test.md');
}

describe('markdownToBlocks', () => {
  it('converts paragraphs with emphasis, strong, code and breaks', () => {
    const { blocks, errors } = convert('Plain *em* **strong** `code`  \nnext');
    expect(errors).toEqual([]);
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Plain ' },
          { type: 'emphasis', children: [{ type: 'text', value: 'em' }] },
          { type: 'text', value: ' ' },
          { type: 'strong', children: [{ type: 'text', value: 'strong' }] },
          { type: 'text', value: ' ' },
          { type: 'code', value: 'code' },
          { type: 'break' },
          { type: 'text', value: 'next' },
        ],
      },
    ]);
  });

  it('allows ### and #### headings and rejects # / ##', () => {
    const ok = convert('### Three\n\n#### Four');
    expect(ok.blocks).toEqual([
      { type: 'heading', depth: 3, children: [{ type: 'text', value: 'Three' }] },
      { type: 'heading', depth: 4, children: [{ type: 'text', value: 'Four' }] },
    ]);
    const bad = markdownToBlocks('text\n\n## Two', fixtureContext(), 'notes/test.md', 5);
    expect(bad.blocks).toHaveLength(1);
    expect(bad.errors).toEqual(["notes/test.md:8: only ### and #### headings are allowed (the title is the note's h1, got ##)"]);
    expect(convert('# One').errors).toHaveLength(1);
  });

  it('converts lists, blockquotes, thematic breaks, code blocks and tables', () => {
    const { blocks, errors } = convert('1. one\n2. two\n\n> quote\n\n---\n\n```\nx = 1\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(errors).toEqual([]);
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [
          [{ type: 'paragraph', children: [{ type: 'text', value: 'one' }] }],
          [{ type: 'paragraph', children: [{ type: 'text', value: 'two' }] }],
        ],
      },
      { type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'quote' }] }] },
      { type: 'thematicBreak' },
      { type: 'codeBlock', value: 'x = 1' },
      {
        type: 'table',
        header: [[{ type: 'text', value: 'a' }], [{ type: 'text', value: 'b' }]],
        rows: [[[{ type: 'text', value: '1' }], [{ type: 'text', value: '2' }]]],
      },
    ]);
  });

  it('parses [[slug]] and [[slug|label]] wikilinks, also escaped in tables, but not inside code spans', () => {
    const { blocks, noteLinks } = convert(
      'See [[cube-basics]] and [[forging|the forge]] `[[not-a-link]]`.\n\n| x |\n|---|\n| [[stockers\\|Stockers]] |'
    );
    expect(noteLinks).toEqual(['cube-basics', 'forging', 'stockers']);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'See ' },
        { type: 'link', kind: 'note', href: 'cube-basics', children: [] },
        { type: 'text', value: ' and ' },
        { type: 'link', kind: 'note', href: 'forging', children: [{ type: 'text', value: 'the forge' }] },
        { type: 'text', value: ' ' },
        { type: 'code', value: '[[not-a-link]]' },
        { type: 'text', value: '.' },
      ],
    });
    expect(blocks[1]).toMatchObject({
      rows: [[[{ type: 'link', kind: 'note', href: 'stockers', children: [{ type: 'text', value: 'Stockers' }] }]]],
    });
  });

  it('resolves links of every scheme and reports bad ones with the line', () => {
    const { blocks, errors, warnings } = convert(
      '[a](rw:Enigma) [b](<base:crs>) [c](type:swor) [d](<docs:Eastern Sun Resurrected Cube Recipes.html#nope>) [e](https://x.org)\n\n[f](rw:Nope)'
    );
    const links = blocks[0]?.type === 'paragraph' ? blocks[0].children.filter((inline) => inline.type === 'link') : [];
    expect(links.map((link) => [link.kind, link.href])).toEqual([
      ['app', '/runewords?name=Enigma'],
      ['app', '/bases?search=%22Crystal%20Sword%22'],
      ['app', '/item-types?type=swor'],
      ['external', 'https://easternsunresurrected.com/Eastern%20Sun%20Resurrected%20Cube%20Recipes.html#nope'],
      ['external', 'https://x.org'],
    ]);
    expect(warnings).toEqual(['notes/test.md:1: docs: anchor "#nope" not found in "Eastern Sun Resurrected Cube Recipes.html"']);
    expect(errors).toEqual(['notes/test.md:3: unknown runeword "Nope" (rw:)']);
    // a failed link keeps its label as text
    expect(blocks[1]).toEqual({ type: 'paragraph', children: [{ type: 'text', value: 'f' }] });
  });

  it('converts :term and keeps unknown inline directives (prose like "1:3") as text', () => {
    const { blocks, errors } = convert('A :term[Stocker]{label=stockers} at 1:3 ratio. Note:this');
    expect(errors).toEqual([]);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'A ' },
        { type: 'term', term: 'Stocker', children: [{ type: 'text', value: 'stockers' }] },
        { type: 'text', value: ' at 1:3 ratio. Note:this' },
      ],
    });
    expect(convert(':term[Nope]').errors).toEqual(['notes/test.md:1: unknown glossary term "Nope" (:term; add it to _glossary.yml)']);
  });

  it('passes directive attributes to the resolver', () => {
    const { blocks, errors } = convert('::source[Worldstone Shard]{item=misc}');
    expect(errors).toEqual([]);
    expect(blocks[0]).toMatchObject({ type: 'data', block: { kind: 'source', labels: [{ text: 'Drops from Baal' }] } });
  });

  it('accepts an unescaped [[slug|label]] in a table cell', () => {
    const { blocks, errors, noteLinks } = convert('| a | b |\n|---|---|\n| [[forging|the forge]] | [[x\\|y]] |');
    expect(errors).toEqual([]);
    expect(noteLinks).toEqual(['forging', 'x']);
    expect(blocks[0]).toMatchObject({ rows: [[[{ type: 'link', href: 'forging' }], [{ type: 'link', href: 'x' }]]] });
  });

  it('reports links the parser left as text', () => {
    const { errors } = convert(
      '[a](rw:Breath of the Dying)\n\n[b](docs:Eastern Sun Resurrected Cube Recipes.html#sec)\n\n[[forging|**the** forge]]'
    );
    expect(errors).toEqual([
      'notes/test.md:1: link not recognised in "[a](rw:Breath of the Dying)" (a target with spaces must be wrapped in <…> or use %20)',
      'notes/test.md:3: link not recognised in "[b](docs:Eastern Sun Resurrected Cube Recipes.html#sec)" (a target with spaces must be wrapped in <…> or use %20)',
      'notes/test.md:5: unresolved "[[" in "[[forging|" (note links are [[slug]] or [[slug|plain label]]; labels cannot contain formatting)',
    ]);
  });

  it('resolves leaf directives into data blocks and rejects unknown or inline ones', () => {
    const { blocks, errors } = convert('::source[Annihilus]\n\n::nope\n\nText ::source[Annihilus] inline');
    expect(blocks[0]).toEqual({
      type: 'data',
      block: { kind: 'source', item: 'Annihilus', labels: [{ kind: 'boss', text: 'Drops from Diablo Clone' }] },
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('unknown directive "::nope"');
    expect(errors[1]).toContain('must stand alone on its own line');
  });

  it('drops HTML comments silently and rejects other HTML and images', () => {
    const ok = convert('<!-- TODO verify -->\n\nText <!-- inline --> here\n\n<!--\nmulti\n-->');
    expect(ok.errors).toEqual([]);
    expect(ok.blocks).toEqual([{ type: 'paragraph', children: [{ type: 'text', value: 'Text  here' }] }]);
    expect(convert('<div>x</div>').errors).toHaveLength(1);
    expect(convert('a <b>x</b>').errors).toHaveLength(2);
    expect(convert('![alt](x.png)').errors).toEqual(['notes/test.md:1: images are not supported']);
    expect(convert('~~gone~~').errors).toHaveLength(1);
  });
});

describe('tables', () => {
  it('fails when the separator row has a different number of cells than the header', () => {
    const md = '| A | B |\n| --- | --- | --- |\n| 1 | 2 |\n';
    const result = markdownToBlocks(md, fixtureContext(), 'notes/test.md');
    expect(result.errors.some((error) => error.includes('table did not parse'))).toBe(true);
  });
});

describe('countWords', () => {
  it('counts body text but not data blocks or punctuation', () => {
    const { blocks } = convert(
      'One two, three — four.\n\n- five [[six-note|six]]\n\n| seven | eight |\n|---|---|\n| nine | 10 |\n\n::glossary'
    );
    expect(countWords(blocks)).toBe(10);
  });
});

describe('::card in a note', () => {
  it('parses the scheme:name argument and keys the block by it', () => {
    const result = markdownToBlocks("::card[rw:Enigma]\n\n::card[unique:Artemis' Wrath]", fixtureContext(), 'notes/test.md');
    expect(result.errors).toEqual([]);
    expect(result.dataBlocks.map((block) => block.key)).toEqual(['card:rw:Enigma', "card:unique:Artemis' Wrath"]);
    const spaced = markdownToBlocks('::card[ rw : Enigma ]', fixtureContext(), 'notes/test.md');
    expect(spaced.errors).toEqual([]);
    expect(spaced.dataBlocks.map((block) => block.key)).toEqual(['card:rw:Enigma']);
    expect(result.blocks[1]).toEqual({
      type: 'data',
      block: { kind: 'card', item: 'unique', name: "Artemis' Wrath", href: "/uniques?name=Artemis'%20Wrath" },
    });
  });
});

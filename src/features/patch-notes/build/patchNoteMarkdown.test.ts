import { describe, expect, it } from 'vitest';
import { parsePatchNoteMarkdown, parseSpans } from './patchNoteMarkdown.ts';

describe('parseSpans', () => {
  it('splits bold runs, unescapes and keeps the spaces around bold text', () => {
    expect(parseSpans('**Diablo** \\- Reduced fire nova by \\~33%.  ')).toEqual([
      { text: 'Diablo', bold: true },
      { text: ' - Reduced fire nova by ~33%.' },
    ]);
  });

  it('keeps an unmatched ** as text', () => {
    expect(parseSpans('a ** b')).toEqual([{ text: 'a ** b' }]);
  });
});

describe('parsePatchNoteMarkdown', () => {
  it('reads bold-only lines as headings and bullets as lists', () => {
    const blocks = parsePatchNoteMarkdown('**Bug Fixes**\n\n* Fixed one.  \n* Fixed **two**.\n\n**Items**\n\n* New item.');
    expect(blocks).toEqual([
      { type: 'heading', text: 'Bug Fixes' },
      {
        type: 'list',
        items: [{ spans: [{ text: 'Fixed one.' }] }, { spans: [{ text: 'Fixed ' }, { text: 'two', bold: true }, { text: '.' }] }],
      },
      { type: 'heading', text: 'Items' },
      { type: 'list', items: [{ spans: [{ text: 'New item.' }] }] },
    ]);
  });

  it('nests indented bullets under the previous shallower one', () => {
    const blocks = parsePatchNoteMarkdown('* Boss immunities:\n  * Baal: Resistant\n    * deep\n  * Diablo: Spectral Hit\n* Next');
    expect(blocks).toEqual([
      {
        type: 'list',
        items: [
          {
            spans: [{ text: 'Boss immunities:' }],
            items: [
              { spans: [{ text: 'Baal: Resistant' }], items: [{ spans: [{ text: 'deep' }] }] },
              { spans: [{ text: 'Diablo: Spectral Hit' }] },
            ],
          },
          { spans: [{ text: 'Next' }] },
        ],
      },
    ]);
  });

  it('keeps a bullet that starts with a bold term as a bullet', () => {
    const blocks = parsePatchNoteMarkdown('* **Ravens** \\- They are now **ranged**.');
    expect(blocks).toEqual([
      {
        type: 'list',
        items: [{ spans: [{ text: 'Ravens', bold: true }, { text: ' - They are now ' }, { text: 'ranged', bold: true }, { text: '.' }] }],
      },
    ]);
  });

  it('joins plain lines into paragraphs and indented lines into the open bullet', () => {
    expect(parsePatchNoteMarkdown('Some text\nmore text\n\n* Bullet\n  continued')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Some text more text' }] },
      { type: 'list', items: [{ spans: [{ text: 'Bullet continued' }] }] },
    ]);
  });
});

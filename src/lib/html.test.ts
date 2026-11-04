import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, stripHtmlTags } from './html';

describe('stripHtmlTags', () => {
  it('removes tags and keeps the text', () => {
    expect(stripHtmlTags('<font color="#FFA500">+2 to <b>All</b> Skills</font>')).toBe('+2 to All Skills');
  });

  it('leaves no tag behind in nested input', () => {
    expect(stripHtmlTags('<<b>script>alert(1)<</b>/script>')).not.toMatch(/<[^>]*>/);
  });

  it('can replace each tag with a space', () => {
    expect(stripHtmlTags('a<br>b', ' ')).toBe('a b');
  });

  it('keeps text without tags', () => {
    expect(stripHtmlTags('+15% Faster Cast Rate (Level 30 Charm)')).toBe('+15% Faster Cast Rate (Level 30 Charm)');
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes the common entities', () => {
    expect(decodeHtmlEntities('Fire &amp; Ice &lt;3 &gt; &quot;x&quot; it&#39;s')).toBe('Fire & Ice <3 > "x" it\'s');
  });

  it('does not unescape twice', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

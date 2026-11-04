import { describe, expect, it } from 'vitest';
import { safeAvatarUrl } from './avatar';

describe('safeAvatarUrl', () => {
  it('keeps Discord CDN avatars', () => {
    const url = 'https://cdn.discordapp.com/avatars/123/abc.png';
    expect(safeAvatarUrl(url)).toBe(url);
  });

  it.each([
    ['missing', null],
    ['undefined', undefined],
    ['another host', 'https://example.com/a.png'],
    ['a look-alike host', 'https://cdn.discordapp.com.example.com/a.png'],
    ['plain http', 'http://cdn.discordapp.com/avatars/1/a.png'],
    ['a data URL', 'data:image/png;base64,AAAA'],
    ['not a URL', 'not a url'],
  ])('drops %s', (_label, url) => {
    expect(safeAvatarUrl(url)).toBeNull();
  });
});

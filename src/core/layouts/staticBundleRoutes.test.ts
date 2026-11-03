import { describe, expect, it } from 'vitest';
import { isStaticBundlePath } from './staticBundleRoutes';

describe('isStaticBundlePath', () => {
  it('matches the home page exactly', () => {
    expect(isStaticBundlePath('/')).toBe(true);
  });

  it.each(['/runewords', '/gemwords', '/uniques', '/builds', '/game-data/bases', '/game-data', '/nope'])(
    'keeps %s behind the loading gate (/ is not a prefix)',
    (pathname) => {
      expect(isStaticBundlePath(pathname)).toBe(false);
    }
  );

  it.each([
    '/guide',
    '/guide/map',
    '/guide/start-here',
    '/loot-filters',
    '/loot-filters/abc',
    '/game-data/enhance',
    '/game-data/cube',
    '/game-data/materials',
    '/game-data/sets',
    '/stash',
    '/stash/coupons',
  ])('matches the prefix route %s', (pathname) => {
    expect(isStaticBundlePath(pathname)).toBe(true);
  });

  it('does not match a path that only shares the prefix text', () => {
    expect(isStaticBundlePath('/guides')).toBe(false);
    expect(isStaticBundlePath('/loot-filtersx')).toBe(false);
  });
});

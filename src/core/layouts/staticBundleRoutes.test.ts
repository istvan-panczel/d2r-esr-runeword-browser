import { describe, expect, it } from 'vitest';
import { isStaticBundlePath } from './staticBundleRoutes';

describe('isStaticBundlePath', () => {
  it('matches the home page exactly', () => {
    expect(isStaticBundlePath('/')).toBe(true);
  });

  it.each(['/runewords', '/gemwords', '/uniques', '/builds', '/bases', '/best-base', '/affixes', '/item-types', '/nope'])(
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
    '/enhance',
    '/cube-recipes',
    '/materials',
    '/sets',
    '/area-levels',
    '/game-data',
    '/game-data/enhance',
    '/game-data/bases',
    '/campaign-map',
    '/stash',
    '/stash/coupons',
    '/stash/items',
    '/stash/character',
    '/character',
    '/terror-zones',
    '/modifiers',
    '/elixirs',
  ])('matches the prefix route %s', (pathname) => {
    expect(isStaticBundlePath(pathname)).toBe(true);
  });

  it('does not match a path that only shares the prefix text', () => {
    expect(isStaticBundlePath('/guides')).toBe(false);
    expect(isStaticBundlePath('/loot-filtersx')).toBe(false);
    expect(isStaticBundlePath('/setsx')).toBe(false);
    expect(isStaticBundlePath('/characters')).toBe(false);
    expect(isStaticBundlePath('/skills')).toBe(false);
    expect(isStaticBundlePath('/enhanced')).toBe(false);
  });
});

import { matchRoutes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { router } from '@/core/router';
import { gameDataRedirectTarget } from './gameDataRedirect';

const MOVED = [
  ['bases', '/bases'],
  ['sets', '/sets'],
  ['best-base', '/best-base'],
  ['affixes', '/affixes'],
  ['types', '/item-types'],
  ['enhance', '/enhance'],
  ['cube', '/cube-recipes'],
  ['materials', '/materials'],
  ['areas', '/area-levels'],
] as const;

describe('gameDataRedirectTarget', () => {
  it.each(MOVED)('sends /game-data/%s to %s', (splat, target) => {
    expect(gameDataRedirectTarget(splat)).toBe(target);
  });

  it.each(MOVED)('/game-data/%s lands on a real route, %s', (_splat, target) => {
    expect(matchRoutes(router.routes, target)?.at(-1)?.route.path).not.toBe('*');
  });

  it('sends a bare /game-data to /bases', () => {
    expect(gameDataRedirectTarget('')).toBe('/bases');
  });

  it('keeps the query and hash of shared links', () => {
    expect(gameDataRedirectTarget('cube', '?family=map-portals')).toBe('/cube-recipes?family=map-portals');
    expect(gameDataRedirectTarget('types', '?type=swor', '#top')).toBe('/item-types?type=swor#top');
    expect(gameDataRedirectTarget('areas', '?search=%22Jail%20Level%201%22')).toBe('/area-levels?search=%22Jail%20Level%201%22');
    expect(gameDataRedirectTarget('', '?x=1', '#y')).toBe('/bases?x=1#y');
  });

  it('matches like the router: any case, trailing slash', () => {
    expect(gameDataRedirectTarget('Bases/')).toBe('/bases');
    expect(gameDataRedirectTarget('CUBE')).toBe('/cube-recipes');
  });

  it('leaves everything else to the not-found page', () => {
    expect(gameDataRedirectTarget('xyz')).toBeNull();
    expect(gameDataRedirectTarget('bases/extra')).toBeNull();
    expect(gameDataRedirectTarget('types.json')).toBeNull();
    expect(gameDataRedirectTarget('constructor')).toBeNull();
  });

  it('routes every old URL through the one redirect route', () => {
    for (const path of ['/game-data', '/game-data/bases', '/game-data/xyz']) {
      expect(matchRoutes(router.routes, path)?.at(-1)?.route.path).toBe('game-data/*');
    }
  });
});

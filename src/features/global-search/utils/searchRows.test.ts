import { describe, expect, it } from 'vitest';
import type { HomeSearchGroup } from '@/features/home/utils/homeSearch';
import { firstRowValue, pageRowValue } from './searchRows';

const groups: HomeSearchGroup[] = [
  { category: 'runewords', label: 'Runewords', results: [{ name: 'Enigma', href: '/runewords?name=Enigma' }] },
];
const pages = [{ name: 'Cube Recipes', href: '/cube-recipes', section: 'Recipes' }];

describe('firstRowValue', () => {
  it('prefers a page', () => {
    expect(firstRowValue(pages, groups)).toBe('page:/cube-recipes');
  });

  it('falls back to the best item', () => {
    expect(firstRowValue([], groups)).toBe('runewords:/runewords?name=Enigma');
  });

  it('is the runewords search row when nothing else matches', () => {
    expect(firstRowValue([], [])).toBe('__search-runewords');
  });
});

describe('pageRowValue', () => {
  it('keys a page row by its path', () => {
    expect(pageRowValue('/bases')).toBe('page:/bases');
  });
});

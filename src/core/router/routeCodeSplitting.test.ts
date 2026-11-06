import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeScreenImports = [
  '@/features/home',
  '@/features/runewords',
  '@/features/gemwords',
  '@/features/socketables',
  '@/features/htm-unique-items',
  '@/features/mythical-uniques',
  '@/features/ascendancies',
  '@/features/skills',
  '@/features/modifiers',
  '@/features/game-data',
  '@/features/guide',
  '@/features/loot-filter',
  '@/features/stash',
  '@/features/terror-zones',
] as const;

function readRouterSource(): string {
  return readFileSync(resolve(process.cwd(), 'src/core/router/index.tsx'), 'utf8');
}

describe('route code splitting', () => {
  it('lazy-loads feature screens instead of statically importing every heavy page into the entry chunk', () => {
    const source = readRouterSource();

    expect(source).toContain('lazy(');
    expect(source).toContain('<Suspense');

    for (const importPath of routeScreenImports) {
      expect(source, importPath).not.toContain(`from '${importPath}'`);
      expect(source, importPath).toContain(`import('${importPath}')`);
    }
  });
});
